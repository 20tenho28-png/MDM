-- Pedidos do site entram sozinhos no registo.
-- O formulário do site (Netlify Forms «orcamento» e «orcamento-comercial») dispara a função do Netlify
-- submission-created (netlify/functions/submission-created.mts) em cada envio que o Netlify não marcou como spam. A função
-- chama pedido_do_site com a chave MDM_SITE_ENTRADA (variável do Netlify) e o pedido aparece em Novo, com origem «site».
--
-- Segurança: pedido_do_site corre com a chave publicável (anon), por isso só aceita quem traz a chave certa. A base
-- guarda só o sha256 da chave, numa tabela sem leitura para ninguém. O documento do pedido é montado aqui, a partir de
-- campos de texto curtos; quem chama não escolhe o estado, o dono nem o número.
-- Correr este bloco outra vez não estraga nada. Para trocar a chave: novo valor no Netlify e
--   update public.segredos set hash = encode(extensions.digest('<chave nova>', 'sha256'), 'hex') where nome = 'site_entrada';

create table if not exists public.segredos (
  nome text primary key,
  hash text not null,
  atualizado timestamptz not null default now()
);
alter table public.segredos enable row level security;
revoke all on public.segredos from anon, authenticated;

create or replace function public.pedido_do_site(
  p_chave text,
  p_referencia text,
  p_formulario text,
  p_cliente text,
  p_telefone text,
  p_email text,
  p_tipo text,
  p_localidade text,
  p_descricao text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_id text;
  v_ano int := extract(year from (now() at time zone 'Europe/Lisbon'))::int;
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_agora text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_max int;
  v_tipo text := case when p_tipo in ('instalacao','manutencao','reparacao','obra') then p_tipo else null end;
  v_prio text;
  v_contacto text;
  v_cliente text := left(nullif(btrim(coalesce(p_cliente, '')), ''), 120);
  v_ref text := left(nullif(btrim(coalesce(p_referencia, '')), ''), 60);
  v_texto text;
begin
  select hash into v_hash from public.segredos where nome = 'site_entrada';
  if v_hash is null or p_chave is null or encode(extensions.digest(p_chave, 'sha256'), 'hex') <> v_hash then
    raise exception 'sem permissão' using errcode = '42501';
  end if;

  -- O mesmo envio pode chegar duas vezes (o Netlify repete se a função falhar): a referência do site identifica-o.
  if v_ref is not null then
    select id into v_id from public.pedidos where dados ->> 'referenciaSite' = v_ref limit 1;
    if v_id is not null then return v_id; end if;
  end if;

  -- Um número de cada vez, para não colidir com outro envio nem com o registo.
  perform pg_advisory_xact_lock(hashtext('pedidos_numero'));
  select coalesce(max((regexp_match(id, '^PED(\d{4})_(\d{4})$'))[1]::int), 0) into v_max
    from public.pedidos where id ~ ('^PED\d{4}_' || v_ano || '$');
  v_id := 'PED' || lpad((v_max + 1)::text, 4, '0') || '_' || v_ano;

  -- As mesmas regras de prioridade do registo (sugerirP): avaria P1, obra P2, o resto P3.
  v_prio := case v_tipo when 'reparacao' then 'P1' when 'obra' then 'P2' else 'P3' end;
  v_contacto := coalesce(nullif(btrim(coalesce(p_telefone, '')), ''), nullif(btrim(coalesce(p_email, '')), ''));
  v_texto := 'Pedido do site' || case when v_ref is not null then ' (' || v_ref || ')' else '' end;

  insert into public.pedidos (id, dados, versao, atualizado, atualizado_por) values (v_id, jsonb_build_object(
    'cliente', coalesce(v_cliente, 'Pedido do site'),
    'contacto', left(v_contacto, 120),
    'email', left(nullif(btrim(coalesce(p_email, '')), ''), 120),
    'canal', case when nullif(btrim(coalesce(p_telefone, '')), '') is null and coalesce(p_email, '') like '%@%' then 'email' else 'telefone' end,
    'localidade', left(nullif(btrim(coalesce(p_localidade, '')), ''), 200),
    'tipo', v_tipo,
    'origem', 'site',
    'referenciaSite', v_ref,
    'formularioSite', left(coalesce(p_formulario, ''), 40),
    'descricao', left(coalesce(p_descricao, ''), 3000),
    'dataPedido', to_char(v_hoje, 'YYYY-MM-DD'),
    'estado', 'novo',
    'entrouNoEstado', v_agora,
    'criado', v_agora,
    'prioridade', v_prio,
    'prioridadeEntrada', v_prio,
    'dono', null,
    'proximaAcao', 'Responder ao cliente',
    'dataProximaAcao', to_char(v_hoje, 'YYYY-MM-DD'),
    'acumuladoH', 0, 'seguimentos', 0, 'escalado', false, 'porConfirmar', false,
    'num', null, 'valor', null, 'dataImposta', false,
    'atualizado', v_agora, 'atualizadoPor', 'site',
    'historico', jsonb_build_array(jsonb_build_object('em', v_agora, 'texto', v_texto || ': entrou em Novo, sem dono'))
  ), 1, now(), 'site');

  insert into public.eventos (pedido_id, por, texto, estado, prioridade) values (v_id, 'site', v_texto, 'novo', v_prio);
  return v_id;
end;
$$;
revoke all on function public.pedido_do_site(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.pedido_do_site(text, text, text, text, text, text, text, text, text) to anon, authenticated;
