-- Motor de seguimentos do registo da MDM (23/10/2026)
-- Cada cliente é seguido do primeiro contacto até a fatura estar paga, e nenhum pedido aberto fica esquecido.
-- Corre depois de migracao.sql, no SQL Editor do projeto. Só acrescenta: uma tabela nova (seguimentos), colunas
-- calculadas da fatura em pedidos (lidas do JSON, não se escrevem), funções, vistas, uma chave em config e a tarefa
-- diária das 07:00 (pg_cron). Pode correr-se outra vez sem estragar nada: a configuração já gravada não é substituída.
--
-- O sistema nunca envia mensagens. Prepara o rascunho; o escritório toca «Enviar» (abre o WhatsApp, o email ou o
-- telefone) e só aí o relógio começa. Sequências, dias e textos ficam em config, chave «seguimentos».
--   A  primeiro contacto sem resposta (novo, visita por marcar): resposta, depois dias 1, 3, 5; dia 7 perdido
--   B  falta informação do cliente (à espera do cliente, pausa): pedido com a lista, depois dias 2, 4, 6; dia 7 perdido
--   C  orçamento enviado (à espera do cliente, decisão): dias 3, 5, 7 depois do envio; sem resposta, perdido
--   D  pagamento (faturado): lembretes aos 30, 45 e 60 dias da fatura; depois dos 60, tarefa P1 do chefe, nunca perdido
-- P1 (avarias) usa metade dos intervalos, arredondada para cima (A, B e C). Envios nunca ao fim de semana nem em
-- feriado: passam para o dia útil seguinte. A perda por silêncio é automática, fica nos eventos e reabre-se num toque.
-- Os textos do primeiro contacto (A) levam {link_marcacao}: com a agenda (agenda.sql), a página troca-o pela ligação
-- para o cliente escolher o dia da visita; sem a agenda, desaparece.

-- ---------- Leituras seguras (o JSON vem da página: nunca rebenta com uma data mal escrita) ----------

create or replace function public.seg_data(t text)
returns date language plpgsql immutable set search_path = public as $$
declare m text[];
begin
  m := regexp_match(coalesce(t, ''), '^(\d{4})-(\d{2})-(\d{2})');
  if m is null then return null; end if;
  return make_date(m[1]::int, m[2]::int, m[3]::int);
exception when others then return null;
end $$;

create or replace function public.seg_numero(t text)
returns numeric language plpgsql immutable set search_path = public as $$
begin
  if t is null or btrim(t) = '' then return null; end if;
  return replace(btrim(t), ',', '.')::numeric;
exception when others then return null;
end $$;

-- O relógio do motor. «mdm.agora» só serve para os testes (simular dias numa cópia local); a página não o consegue mudar.
create or replace function public.seg_agora()
returns timestamptz language plpgsql stable set search_path = public as $$
begin
  return coalesce(nullif(current_setting('mdm.agora', true), '')::timestamptz, now());
exception when others then return now();
end $$;

create or replace function public.seg_hoje()
returns date language sql stable set search_path = public as $$ select (public.seg_agora() at time zone 'Europe/Lisbon')::date $$;

-- Instante no formato que a página escreve (2026-10-23T07:00:00.000Z).
create or replace function public.seg_iso(t timestamptz)
returns text language sql stable set search_path = public as $$ select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- ---------- Calendário: fins de semana, feriados nacionais e Santo António ----------

create or replace function public.seg_pascoa(ano int)
returns date language plpgsql immutable set search_path = public as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  a := ano % 19; b := ano / 100; c := ano % 100; d := b / 4; e := b % 4; f := (b + 8) / 25; g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30; i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  return make_date(ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end $$;

create or replace function public.seg_util(dia date, feriados boolean default true)
returns boolean language sql immutable set search_path = public as $$
  select extract(isodow from dia) < 6 and (not feriados or (
    to_char(dia, 'MM-DD') not in ('01-01','04-25','05-01','06-10','06-13','08-15','10-05','11-01','12-01','12-08','12-25')
    and dia not in (public.seg_pascoa(extract(year from dia)::int) - 2, public.seg_pascoa(extract(year from dia)::int),
                    public.seg_pascoa(extract(year from dia)::int) + 60)));
$$;

-- O próprio dia se for útil; senão o dia útil seguinte (sábado e domingo passam para segunda).
create or replace function public.seg_dia_envio(dia date, feriados boolean default true)
returns date language plpgsql immutable set search_path = public as $$
declare d date := dia;
begin
  if d is null then return null; end if;
  for i in 1..15 loop
    exit when public.seg_util(d, feriados);
    d := d + 1;
  end loop;
  return d;
end $$;

-- ---------- Tabela ----------

create table if not exists public.seguimentos (
  id bigserial primary key,
  pedido_id text not null references public.pedidos(id) on delete cascade,
  sequencia text not null check (sequencia in ('A','B','C','D')),
  ciclo integer not null default 1,          -- a mesma sequência pode voltar (orçamento revisto, pedido reaberto)
  numero integer not null,                   -- 0 é a mensagem inicial (A, B) ou o envio do orçamento ou da fatura (C, D)
  entrada text not null default '',          -- entrouNoEstado do pedido quando o ciclo começou (não repete o ciclo)
  ancora date,                               -- dia a partir do qual se contam os dias (o toque em «enviado»)
  devido_em date not null,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','email','telefone')),
  assunto text,
  rascunho text,
  estado text not null default 'pendente' check (estado in ('pendente','enviado','respondido','cancelado')),
  enviado_em timestamptz,
  enviado_por text,
  resultado text,
  fechado_em timestamptz,                    -- o ciclo acabou (resposta, mudança de estado, perda); nulo = ativo
  fecho text,
  criado_em timestamptz not null default now(),
  unique (pedido_id, sequencia, ciclo, numero)
);
create index if not exists seguimentos_ativos_idx on public.seguimentos (pedido_id) where fechado_em is null;
create index if not exists seguimentos_devido_idx on public.seguimentos (devido_em) where estado = 'pendente';

alter table public.seguimentos enable row level security;
drop policy if exists "seguimentos: colaboradores" on public.seguimentos;
create policy "seguimentos: colaboradores" on public.seguimentos
  for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
revoke all on public.seguimentos from anon;
grant select, insert, update, delete on public.seguimentos to authenticated;
grant usage, select on sequence public.seguimentos_id_seq to authenticated;

-- ---------- Campos da fatura em pedidos ----------
-- A página continua a escrever no JSON (fatura, dataFatura, valorFatura, adiantamento, dataPagamento); estas colunas
-- leem-no, para as vistas e para consultas. São calculadas: nunca ficam diferentes do JSON.
alter table public.pedidos add column if not exists fatura_num text generated always as (nullif(btrim(dados ->> 'fatura'), '')) stored;
alter table public.pedidos add column if not exists fatura_data date generated always as (public.seg_data(dados ->> 'dataFatura')) stored;
alter table public.pedidos add column if not exists fatura_valor numeric generated always as (public.seg_numero(dados ->> 'valorFatura')) stored;
alter table public.pedidos add column if not exists fatura_adiantamento boolean generated always as (case dados ->> 'adiantamento' when 'true' then true when 'false' then false end) stored;
alter table public.pedidos add column if not exists pagamento_data date generated always as (public.seg_data(dados ->> 'dataPagamento')) stored;

-- ---------- Configuração (chave «seguimentos»; muda-se na página, em «Prazos e exportar») ----------

insert into public.config (chave, valor) values ('seguimentos', $json$
{
  "instalado": null,
  "chefe": "",
  "assinatura": "Com os melhores cumprimentos,\nMDM Assistência Técnica\n218 935 050",
  "saltarFeriados": true,
  "sequencias": {
    "A": {"nome": "Primeiro contacto", "dias": [1, 3, 5], "perdidoDia": 7, "motivo": "sem resposta (primeiro contacto)", "metadeP1": true, "inicial": true},
    "B": {"nome": "Informação em falta", "dias": [2, 4, 6], "perdidoDia": 7, "motivo": "sem resposta (informação em falta)", "metadeP1": true, "inicial": true},
    "C": {"nome": "Orçamento", "dias": [3, 5, 7], "perdidoDia": 7, "motivo": "sem resposta (orçamento)", "metadeP1": true, "inicial": false},
    "D": {"nome": "Pagamento", "dias": [30, 45, 60], "escalarDepoisDia": 60, "metadeP1": false, "inicial": false}
  },
  "textos": {
    "A": [
      {"whatsapp": "Olá {nome}, obrigado pelo seu pedido à MDM. Para marcarmos a visita técnica, que dia e hora lhe dão mais jeito?{link_marcacao}",
       "email_assunto": "O seu pedido à MDM",
       "email": "Olá {nome},\n\nObrigado pelo seu pedido. Para marcarmos a visita técnica, diga-nos por favor que dia e hora lhe dão mais jeito.{link_marcacao}\n\n{assinatura}",
       "telefone": "Agradecer o pedido. Propor dois horários para a visita técnica e confirmar a morada."},
      {"whatsapp": "Olá {nome}, ficámos a aguardar a sua resposta para marcarmos a visita. Que dia lhe dá jeito?{link_marcacao}",
       "email_assunto": "Marcação da visita técnica",
       "email": "Olá {nome},\n\nFicámos a aguardar a sua resposta para marcarmos a visita técnica. Que dia lhe dá mais jeito?{link_marcacao}\n\n{assinatura}",
       "telefone": "Perguntar se ainda precisa da visita. Propor dois horários."},
      {"whatsapp": "Olá {nome}, ainda precisa da nossa visita? Basta responder com um dia e uma hora e nós tratamos do resto.{link_marcacao}",
       "email_assunto": "Ainda precisa da visita?",
       "email": "Olá {nome},\n\nAinda precisa da nossa visita? Basta responder com um dia e uma hora e nós tratamos do resto.{link_marcacao}\n\n{assinatura}",
       "telefone": "Perguntar se ainda está interessado(a). Se sim, marcar já a visita."},
      {"whatsapp": "Olá {nome}, como não tivemos resposta, vamos encerrar o seu pedido nos próximos dias. Se ainda precisar, responda a esta mensagem e retomamos de imediato.{link_marcacao}",
       "email_assunto": "O seu pedido à MDM",
       "email": "Olá {nome},\n\nComo não tivemos resposta, vamos encerrar o seu pedido nos próximos dias. Se ainda precisar, responda a este email e retomamos de imediato.{link_marcacao}\n\n{assinatura}",
       "telefone": "Última tentativa: avisar que o pedido vai ser encerrado. Se ainda quiser, marcar a visita."}
    ],
    "B": [
      {"whatsapp": "Olá {nome}, para avançarmos com o seu pedido precisamos de: {falta}. Pode enviar-nos por aqui quando lhe for possível? Obrigado.",
       "email_assunto": "Informação em falta para o seu pedido",
       "email": "Olá {nome},\n\nPara avançarmos com o seu pedido precisamos de: {falta}.\n\nPode enviar-nos em resposta a este email quando lhe for possível? Obrigado.\n\n{assinatura}",
       "telefone": "Pedir: {falta}. Combinar se envia por WhatsApp ou email."},
      {"whatsapp": "Olá {nome}, ainda estamos à espera de: {falta}. Assim que nos enviar, avançamos.",
       "email_assunto": "Informação em falta para o seu pedido",
       "email": "Olá {nome},\n\nAinda estamos à espera de: {falta}. Assim que nos enviar, avançamos.\n\n{assinatura}",
       "telefone": "Lembrar o que falta: {falta}."},
      {"whatsapp": "Olá {nome}, só para lembrar que ainda precisamos de: {falta}. Precisa de ajuda com alguma coisa?",
       "email_assunto": "Informação em falta para o seu pedido",
       "email": "Olá {nome},\n\nSó para lembrar que ainda precisamos de: {falta}. Precisa de ajuda com alguma coisa?\n\n{assinatura}",
       "telefone": "Perguntar se precisa de ajuda para enviar: {falta}."},
      {"whatsapp": "Olá {nome}, ainda não recebemos: {falta}. Sem isso não conseguimos avançar e, se não tivermos resposta, encerramos o pedido nos próximos dias; pode sempre retomá-lo respondendo a esta mensagem.",
       "email_assunto": "O seu pedido à MDM",
       "email": "Olá {nome},\n\nAinda não recebemos: {falta}. Sem isso não conseguimos avançar e, se não tivermos resposta, encerramos o pedido nos próximos dias; pode sempre retomá-lo respondendo a este email.\n\n{assinatura}",
       "telefone": "Última tentativa: sem o que falta ({falta}) o pedido vai ser encerrado."}
    ],
    "C": [
      null,
      {"whatsapp": "Olá {nome}, enviámos o orçamento {orc}, no valor de {valor} + IVA. Conseguiu ver? Se tiver alguma dúvida, estamos ao dispor.",
       "email_assunto": "Orçamento {orc}",
       "email": "Olá {nome},\n\nEnviámos o orçamento {orc}, no valor de {valor} + IVA. Conseguiu ver? Se tiver alguma dúvida, estamos ao dispor.\n\n{assinatura}",
       "telefone": "Perguntar se viu o orçamento {orc} ({valor} + IVA) e se tem dúvidas."},
      {"whatsapp": "Olá {nome}, voltamos ao orçamento {orc}. Quer que ajustemos alguma coisa (equipamento, prazo ou condições)? Também podemos falar por telefone.",
       "email_assunto": "Orçamento {orc}",
       "email": "Olá {nome},\n\nVoltamos ao orçamento {orc}. Quer que ajustemos alguma coisa (equipamento, prazo ou condições)? Também podemos falar por telefone, se preferir.\n\n{assinatura}",
       "telefone": "Perguntar se quer ajustar o orçamento {orc} (equipamento, prazo, condições)."},
      {"whatsapp": "Olá {nome}, para organizarmos a agenda, gostávamos de saber se avançamos com o orçamento {orc}. Sem resposta, damos o orçamento por encerrado, mas pode sempre retomá-lo connosco.",
       "email_assunto": "Orçamento {orc}",
       "email": "Olá {nome},\n\nPara organizarmos a agenda, gostávamos de saber se avançamos com o orçamento {orc}. Sem resposta, damos o orçamento por encerrado, mas pode sempre retomá-lo connosco.\n\n{assinatura}",
       "telefone": "Perguntar se avançamos com o orçamento {orc}. Se não, perguntar o motivo."}
    ],
    "D": [
      null,
      {"whatsapp": "Olá {nome}, lembramos que a fatura {fatura} de {data_fatura}, no valor de {valor_fatura}, ainda consta por liquidar. Se já pagou, agradecemos o comprovativo e pedimos desculpa pelo incómodo.",
       "email_assunto": "Fatura {fatura}",
       "email": "Olá {nome},\n\nLembramos que a fatura {fatura} de {data_fatura}, no valor de {valor_fatura}, ainda consta por liquidar. Se já pagou, agradecemos que nos envie o comprovativo e pedimos desculpa pelo incómodo.\n\n{assinatura}",
       "telefone": "Lembrar a fatura {fatura} de {data_fatura} ({valor_fatura}). Pedir a data prevista de pagamento."},
      {"whatsapp": "Olá {nome}, a fatura {fatura} de {data_fatura} ({valor_fatura}) continua por liquidar. Pode indicar-nos a data prevista de pagamento?",
       "email_assunto": "Fatura {fatura} por liquidar",
       "email": "Olá {nome},\n\nA fatura {fatura} de {data_fatura} ({valor_fatura}) continua por liquidar. Pode indicar-nos a data prevista de pagamento?\n\n{assinatura}",
       "telefone": "Fatura {fatura} ({valor_fatura}) com {dias} dias. Pedir a data de pagamento."},
      {"whatsapp": "Olá {nome}, a fatura {fatura} de {data_fatura} ({valor_fatura}) está por liquidar há {dias} dias. Pedimos que regularize o pagamento ou nos contacte para combinarmos uma solução.",
       "email_assunto": "Fatura {fatura} por liquidar há {dias} dias",
       "email": "Olá {nome},\n\nA fatura {fatura} de {data_fatura} ({valor_fatura}) está por liquidar há {dias} dias. Pedimos que regularize o pagamento ou nos contacte para combinarmos uma solução.\n\n{assinatura}",
       "telefone": "Fatura {fatura} ({valor_fatura}) com {dias} dias. Combinar a data de pagamento; avisar que o caso passa para a gerência."}
    ]
  }
}
$json$::jsonb)
on conflict (chave) do nothing;
-- A data de instalação marca a partir de quando um fecho sem data de pagamento conta como falha.
update public.config set valor = jsonb_set(valor, '{instalado}', to_jsonb(public.seg_hoje()::text))
  where chave = 'seguimentos' and (valor ->> 'instalado') is null;

-- Lida com as permissões de quem chama: só quem está em colaboradores vê a configuração (a tarefa diária corre como dono).
create or replace function public.seg_cfg()
returns jsonb language sql stable set search_path = public as $$
  select coalesce((select valor from public.config where chave = 'seguimentos'), '{}'::jsonb);
$$;

-- ---------- Regras: que sequência corre em cada estado, os dias e os textos ----------

-- A sequência do estado atual do pedido, ou nula (bola com a MDM ou com o fornecedor, fechado, por confirmar).
create or replace function public.seg_sequencia_de(d jsonb)
returns text language sql immutable set search_path = public as $$
  select case
    when coalesce(d ->> 'porConfirmar', 'false') = 'true' then null
    when d ->> 'estado' in ('novo', 'visita_por_marcar') then 'A'
    when d ->> 'estado' = 'espera_cliente' and d ->> 'esperaMotivo' = 'pausa' then 'B'
    when d ->> 'estado' = 'espera_cliente' then 'C'
    when d ->> 'estado' = 'faturado' then 'D'
  end;
$$;

-- Os dias de cada passo contados da âncora: [1, 3, 5] e o dia da perda (ou da escalada, no D).
-- P1 usa metade de cada intervalo, arredondada para cima.
create or replace function public.seg_dias(cfg jsonb, seq text, p1 boolean)
returns int[] language plpgsql immutable set search_path = public as $$
declare
  s jsonb := cfg -> 'sequencias' -> seq;
  base int[] := array(select x::int from jsonb_array_elements_text(coalesce(s -> 'dias', '[]'::jsonb)) x);
  fim int := coalesce((s ->> 'perdidoDia')::int, (s ->> 'escalarDepoisDia')::int + 1);
  r int[] := '{}'; ant int := 0; acc int := 0;
begin
  base := base || fim;
  if not (p1 and coalesce((s ->> 'metadeP1')::boolean, false)) then return base; end if;
  foreach fim in array base loop
    acc := acc + ceil(greatest(fim - ant, 0) / 2.0)::int; ant := fim; r := r || acc;
  end loop;
  return r;
end $$;

-- 1 250,00 € (o «,» e o «.» do to_char não dependem da língua do servidor).
create or replace function public.seg_eur(v numeric)
returns text language sql immutable set search_path = public as $$
  select case when v is null then '' else
    replace(replace(replace(to_char(round(v, 2), 'FM999,999,990.00'), ',', '#'), '.', ','), '#', ' ') || ' €' end;
$$;

-- O canal preferido do cliente: o que ficou registado no primeiro contacto; senão, a origem do pedido.
create or replace function public.seg_canal(d jsonb)
returns text language sql immutable set search_path = public as $$
  select case
    when d ->> 'canal' in ('whatsapp', 'email', 'telefone') then d ->> 'canal'
    when d ->> 'origem' = 'whatsapp' then 'whatsapp'
    when d ->> 'origem' = 'telefone' then 'telefone'
    when d ->> 'origem' in ('email', 'site') or coalesce(d ->> 'contacto', '') like '%@%' then 'email'
    else 'whatsapp' end;
$$;

create or replace function public.seg_falta(d jsonb)
returns text language sql immutable set search_path = public as $$
  select coalesce(nullif(case jsonb_typeof(d -> 'falta')
      when 'array' then (select string_agg(x, ', ') from jsonb_array_elements_text(d -> 'falta') x where btrim(x) <> '')
      else btrim(d ->> 'falta') end, ''), 'a informação em falta');
$$;

-- O rascunho de um passo, com o nome, o ORC, o valor, a fatura e o que falta já preenchidos.
create or replace function public.seg_texto(cfg jsonb, seq text, num int, canal text, d jsonb, hoje date, out assunto text, out texto text)
language plpgsql stable set search_path = public as $$
declare
  t jsonb := cfg -> 'textos' -> seq -> num;
  dfat date := public.seg_data(d ->> 'dataFatura');
  subs text[][];
begin
  if t is null or jsonb_typeof(t) <> 'object' then assunto := null; texto := ''; return; end if;
  subs := array[
    ['{nome}', coalesce(nullif(btrim(d ->> 'contactoNome'), ''), nullif(btrim(d ->> 'cliente'), ''), 'cliente')],
    ['{orc}', coalesce(d ->> 'num', '')],
    ['{valor}', public.seg_eur(public.seg_numero(d ->> 'valor'))],
    ['{falta}', public.seg_falta(d)],
    ['{fatura}', coalesce(d ->> 'fatura', '')],
    ['{data_fatura}', coalesce(to_char(dfat, 'DD/MM/YYYY'), '')],
    ['{valor_fatura}', public.seg_eur(coalesce(public.seg_numero(d ->> 'valorFatura'), public.seg_numero(d ->> 'valor')))],
    ['{dias}', coalesce((hoje - dfat)::text, '')],
    ['{assinatura}', coalesce(cfg ->> 'assinatura', '')]];
  texto := coalesce(t ->> case canal when 'email' then 'email' when 'telefone' then 'telefone' else 'whatsapp' end, '');
  assunto := case when canal = 'email' then t ->> 'email_assunto' end;
  for i in 1 .. array_length(subs, 1) loop
    texto := replace(texto, subs[i][1], subs[i][2]);
    assunto := replace(assunto, subs[i][1], subs[i][2]);
  end loop;
end $$;

create or replace function public.seg_rotulo(seq text, num int, total int)
returns text language sql immutable set search_path = public as $$
  select case seq when 'A' then 'Primeiro contacto' when 'B' then 'Informação em falta' when 'C' then 'Orçamento' else 'Pagamento' end
    || case when num = 0 then case seq when 'A' then ': resposta' when 'B' then ': pedido' when 'C' then ' enviado' else ': fatura emitida' end
            else ' ' || num || '/' || total end;
$$;

-- ---------- Sincronizar: abre e fecha ciclos conforme o estado do pedido ----------
-- Corre em cada gravação do pedido (gatilho) e na tarefa diária. Abre a sequência do estado se ainda não houve
-- nenhuma para esta entrada no estado (a chave é entrouNoEstado), fecha as que já não se aplicam.
create or replace function public.seg_sincronizar(p_id text, d jsonb, p_hoje date default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  hoje date := coalesce(p_hoje, public.seg_hoje());
  cfg jsonb := public.seg_cfg();
  v_seq text := public.seg_sequencia_de(d);
  v_entrada text := coalesce(d ->> 'entrouNoEstado', d ->> 'criado', '');
  fer boolean := coalesce((cfg ->> 'saltarFeriados')::boolean, true);
  sem_resposta boolean := d ->> 'estado' = 'perdido' and coalesce(d ->> 'motivo', '') ilike 'sem resposta%';
  c record; v_ciclo int; v_canal text; v_txt record; v_ancora date;
begin
  -- Fechar o que já não se aplica. Mudar de estado depois de um contacto conta como resposta do cliente
  -- (aceitou, recusou, pediu revisão, pagou), exceto a perda por silêncio.
  for c in select distinct s.sequencia, s.ciclo from public.seguimentos s
           where s.pedido_id = p_id and s.fechado_em is null and s.sequencia is distinct from v_seq loop
    if not sem_resposta then
      update public.seguimentos s set estado = 'respondido', resultado = coalesce(s.resultado || '; ', '') || 'mudou para ' || coalesce(d ->> 'estado', '?')
        where s.id = (select x.id from public.seguimentos x where x.pedido_id = p_id and x.sequencia = c.sequencia and x.ciclo = c.ciclo
                      and x.estado = 'enviado' order by x.numero desc limit 1);
    end if;
    update public.seguimentos s set estado = 'cancelado', resultado = coalesce(s.resultado, 'mudou de estado')
      where s.pedido_id = p_id and s.sequencia = c.sequencia and s.ciclo = c.ciclo and s.estado = 'pendente';
    update public.seguimentos s set fechado_em = public.seg_agora(), fecho = case when sem_resposta then 'perdido' else 'mudou_estado' end
      where s.pedido_id = p_id and s.sequencia = c.sequencia and s.ciclo = c.ciclo and s.fechado_em is null;
  end loop;

  if v_seq is null then return; end if;
  -- Já há um ciclo ativo, ou já houve um para esta entrada no estado (o cliente respondeu e a ação é outra).
  if exists (select 1 from public.seguimentos s where s.pedido_id = p_id and s.sequencia = v_seq
             and (s.fechado_em is null or s.entrada = v_entrada)) then
    return;
  end if;

  select coalesce(max(s.ciclo), 0) + 1 into v_ciclo from public.seguimentos s where s.pedido_id = p_id and s.sequencia = v_seq;
  v_canal := public.seg_canal(d);
  if v_seq in ('A', 'B') then
    -- A mensagem inicial fica pronta já; o relógio só começa quando o escritório a envia.
    select * into v_txt from public.seg_texto(cfg, v_seq, 0, v_canal, d, hoje);
    insert into public.seguimentos (pedido_id, sequencia, ciclo, numero, entrada, devido_em, canal, assunto, rascunho)
      values (p_id, v_seq, v_ciclo, 0, v_entrada, public.seg_dia_envio(hoje, fer), v_canal, v_txt.assunto, v_txt.texto)
      on conflict do nothing;
  else
    -- O orçamento ou a fatura já foram enviados: são a âncora (passo 0, já enviado).
    v_ancora := case v_seq
      when 'C' then coalesce(public.seg_data(d ->> 'dataEnvio'), public.seg_data(v_entrada), hoje)
      else coalesce(public.seg_data(d ->> 'dataFatura'), public.seg_data(v_entrada), hoje) end;
    if v_ancora > hoje then v_ancora := hoje; end if;
    insert into public.seguimentos (pedido_id, sequencia, ciclo, numero, entrada, ancora, devido_em, canal, estado, enviado_em, enviado_por, resultado)
      values (p_id, v_seq, v_ciclo, 0, v_entrada, v_ancora, v_ancora,
              case when v_seq = 'C' and d ->> 'enviadoPorOnde' in ('email', 'whatsapp') then d ->> 'enviadoPorOnde' else v_canal end,
              'enviado', v_ancora::timestamp at time zone 'Europe/Lisbon',
              case when v_seq = 'C' then d ->> 'enviadoPor' end,
              case when v_seq = 'C' then 'orçamento ' || coalesce(d ->> 'num', '') else 'fatura ' || coalesce(d ->> 'fatura', '') end)
      on conflict do nothing;
  end if;
end $$;

create or replace function public.seg_gatilho()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seg_sincronizar(new.id, new.dados);
  return null;
end $$;
drop trigger if exists pedidos_seguimentos on public.pedidos;
create trigger pedidos_seguimentos after insert or update of dados on public.pedidos
  for each row execute function public.seg_gatilho();

-- ---------- O passo seguinte de um ciclo ativo ----------
-- tipo: «enviar» (há um rascunho pendente), «passo» (o próximo seguimento, ainda por preparar), «perdido» (o dia em
-- que, sem resposta, o pedido fica perdido) ou «escalar» (pagamento: o dia em que passa ao chefe).
-- Cada passo conta da âncora (o envio da mensagem inicial, do orçamento ou da fatura) e nunca vem antes do dia
-- seguinte ao envio do passo anterior: um seguimento enviado tarde não junta dois no mesmo dia.
create or replace function public.seg_proximo(p_id text)
returns table (sequencia text, ciclo int, numero int, total int, devido date, tipo text, rotulo text, canal text, seg_id bigint)
language plpgsql stable set search_path = public as $$
declare
  cfg jsonb := public.seg_cfg();
  fer boolean := coalesce((cfg ->> 'saltarFeriados')::boolean, true);
  d jsonb; c record; ult record; pend record; dias int[]; n int; v_ancora date; v_ult date;
begin
  select p.dados into d from public.pedidos p where p.id = p_id;
  if d is null then return; end if;
  for c in select distinct s.sequencia as sq, s.ciclo as ci from public.seguimentos s where s.pedido_id = p_id and s.fechado_em is null loop
    dias := public.seg_dias(cfg, c.sq, d ->> 'prioridade' = 'P1');
    n := coalesce(array_length(dias, 1), 1) - 1;
    select s.* into pend from public.seguimentos s where s.pedido_id = p_id and s.sequencia = c.sq and s.ciclo = c.ci and s.estado = 'pendente'
      order by s.numero limit 1;
    if found then
      return query select c.sq, c.ci, pend.numero, n, pend.devido_em, 'enviar'::text, public.seg_rotulo(c.sq, pend.numero, n), pend.canal, pend.id;
      continue;
    end if;
    select s.* into ult from public.seguimentos s where s.pedido_id = p_id and s.sequencia = c.sq and s.ciclo = c.ci order by s.numero desc limit 1;
    select s.ancora into v_ancora from public.seguimentos s where s.pedido_id = p_id and s.sequencia = c.sq and s.ciclo = c.ci and s.numero = 0;
    if v_ancora is null then continue; end if;
    v_ult := coalesce((ult.enviado_em at time zone 'Europe/Lisbon')::date, v_ancora);
    if ult.numero < n then
      return query select c.sq, c.ci, ult.numero + 1, n,
        public.seg_dia_envio(greatest(v_ancora + dias[ult.numero + 1], v_ult + 1), fer), 'passo'::text,
        public.seg_rotulo(c.sq, ult.numero + 1, n), public.seg_canal(d), null::bigint;
    elsif c.sq = 'D' then
      continue when coalesce(d ->> 'cobrancaEscalada', '') <> '';
      return query select c.sq, c.ci, ult.numero + 1, n, v_ancora + dias[n + 1], 'escalar'::text, 'Cobrança em atraso'::text, public.seg_canal(d), null::bigint;
    else
      return query select c.sq, c.ci, ult.numero + 1, n, greatest(v_ancora + dias[n + 1], v_ult + 1), 'perdido'::text, 'Sem resposta: perdido'::text, public.seg_canal(d), null::bigint;
    end if;
  end loop;
end $$;

create or replace function public.seg_canal_txt(c text)
returns text language sql immutable set search_path = public as $$ select case c when 'email' then 'email' when 'telefone' then 'telefone' else 'WhatsApp' end $$;

-- A próxima ação que o motor escreve no pedido, para nunca ficar sem uma (regra 5).
-- Devolve nulo quando o motor não deve mexer na ação (nada ativo, ou a cobrança já passou ao chefe).
create or replace function public.seg_acao(p_id text, out acao text, out data date)
language plpgsql stable set search_path = public as $$
declare x record;
begin
  -- Depois da escalada da cobrança, a próxima ação é do chefe: o motor deixa de a mudar.
  if exists (select 1 from public.pedidos p where p.id = p_id and coalesce(p.dados ->> 'cobrancaEscalada', '') <> '' and p.dados ->> 'estado' = 'faturado') then
    acao := null; data := null; return;
  end if;
  select * into x from public.seg_proximo(p_id) order by devido limit 1;
  if not found then acao := null; data := null; return; end if;
  data := x.devido;
  acao := case x.tipo
    when 'enviar' then case when x.canal = 'telefone' then 'Ligar: ' || x.rotulo else 'Enviar ' || x.rotulo || ' por ' || public.seg_canal_txt(x.canal) end
    when 'passo' then 'Aguardar resposta; a seguir ' || x.rotulo || ' a ' || to_char(x.devido, 'DD/MM')
    when 'escalar' then 'Aguardar o pagamento; passa à gerência a ' || to_char(x.devido, 'DD/MM')
    else 'Aguardar resposta; sem resposta fica perdido a ' || to_char(x.devido, 'DD/MM') end;
end $$;

-- ---------- Escrever no pedido (com versão, histórico e evento, como a página) ----------
create or replace function public.seg_patch(p_id text, patch jsonb, p_nota text, p_por text)
returns void language plpgsql security definer set search_path = public as $$
declare v_agora text := public.seg_iso(public.seg_agora());
begin
  update public.pedidos p set
    dados = (p.dados || patch || jsonb_build_object('atualizado', v_agora, 'atualizadoPor', p_por))
      || jsonb_build_object('historico',
           coalesce((select jsonb_agg(e order by o) from jsonb_array_elements(case when jsonb_typeof(p.dados -> 'historico') = 'array' then p.dados -> 'historico' else '[]'::jsonb end)
                     with ordinality h(e, o) where o > jsonb_array_length(case when jsonb_typeof(p.dados -> 'historico') = 'array' then p.dados -> 'historico' else '[]'::jsonb end) - 60), '[]'::jsonb)
           || case when p_nota is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('em', v_agora, 'texto', p_nota)) end),
    versao = p.versao + 1, atualizado = now(), atualizado_por = p_por
  where p.id = p_id;
  if p_nota is not null then
    insert into public.eventos (pedido_id, em, por, texto, estado, prioridade)
      select p.id, public.seg_agora(), p_por, p_nota, p.dados ->> 'estado', p.dados ->> 'prioridade' from public.pedidos p where p.id = p_id;
  end if;
end $$;

create or replace function public.seg_patch_acao(a text, d date)
returns jsonb language sql immutable set search_path = public as $$
  select case when a is null then '{}'::jsonb else jsonb_build_object('proximaAcao', a, 'dataProximaAcao', d::text) end;
$$;

create or replace function public.seg_quem()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select c.nome from public.colaboradores c where lower(c.email) = lower(auth.jwt() ->> 'email')), auth.jwt() ->> 'email', 'motor');
$$;

-- ---------- A tarefa diária (07:00 de Lisboa) ----------
-- 1. confirma os ciclos de todos os pedidos (abre os que faltam, fecha os que já não se aplicam);
-- 2. prepara os rascunhos que vencem hoje (ou antes) e põe-nos como próxima ação;
-- 3. sem resposta depois do último seguimento, dá o pedido por perdido (com motivo, no histórico e nos eventos);
-- 4. pagamento com mais de 60 dias: tarefa P1 do chefe «cobrança em atraso», uma vez só.
-- Correr duas vezes no mesmo dia não muda nada.
create or replace function public.seg_diario(p_hoje date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  hoje date := coalesce(p_hoje, public.seg_hoje());
  cfg jsonb := public.seg_cfg();
  fer boolean := coalesce((cfg ->> 'saltarFeriados')::boolean, true);
  r record; x record; v_txt record; v_acao record; d jsonb; s jsonb; v_ancora date; v_dias int;
  n_rasc int := 0; n_perd int := 0; n_esc int := 0; v_chefe text;
begin
  for r in select p.id, p.dados from public.pedidos p
           where p.dados ->> 'estado' in ('novo','visita_por_marcar','visita_marcada','orcamento_por_fazer','espera_cliente','espera_fornecedor','em_execucao','por_faturar','faturado')
              or exists (select 1 from public.seguimentos z where z.pedido_id = p.id and z.fechado_em is null) loop
    perform public.seg_sincronizar(r.id, r.dados, hoje);
  end loop;

  for x in select p.id as pid, p.dados as pd, q.* from public.pedidos p cross join lateral public.seg_proximo(p.id) q
           where exists (select 1 from public.seguimentos z where z.pedido_id = p.id and z.fechado_em is null) loop
    continue when x.devido is null or x.devido > hoje;
    if x.tipo = 'passo' then
      select * into v_txt from public.seg_texto(cfg, x.sequencia, x.numero, x.canal, x.pd, hoje);
      insert into public.seguimentos (pedido_id, sequencia, ciclo, numero, entrada, devido_em, canal, assunto, rascunho)
        select x.pid, x.sequencia, x.ciclo, x.numero, z.entrada, x.devido, x.canal, v_txt.assunto, v_txt.texto
        from public.seguimentos z where z.pedido_id = x.pid and z.sequencia = x.sequencia and z.ciclo = x.ciclo and z.numero = 0
        on conflict do nothing;
      if found then
        n_rasc := n_rasc + 1;
        select * into v_acao from public.seg_acao(x.pid);
        perform public.seg_patch(x.pid, public.seg_patch_acao(v_acao.acao, v_acao.data)
            || jsonb_build_object('dono', coalesce(nullif(x.pd ->> 'dono', ''), nullif(cfg ->> 'chefe', ''))),
          'Rascunho pronto: ' || x.rotulo || ' (' || public.seg_canal_txt(x.canal) || ')', 'motor');
      end if;
    elsif x.tipo = 'perdido' then
      s := cfg -> 'sequencias' -> x.sequencia;
      update public.seguimentos z set fechado_em = public.seg_agora(), fecho = 'perdido'
        where z.pedido_id = x.pid and z.sequencia = x.sequencia and z.ciclo = x.ciclo and z.fechado_em is null;
      perform public.seg_patch(x.pid, jsonb_build_object(
          'estado', 'perdido', 'motivo', coalesce(s ->> 'motivo', 'sem resposta'), 'dataFecho', hoje::text,
          'proximaAcao', null, 'dataProximaAcao', null, 'entrouNoEstado', public.seg_iso(public.seg_agora()),
          'acumuladoH', 0, 'esperaDe', null, 'esperaMotivo', null,
          'perdidoSilencio', jsonb_build_object('sequencia', x.sequencia, 'ciclo', x.ciclo, 'em', hoje::text,
             'estado', x.pd ->> 'estado', 'esperaMotivo', x.pd -> 'esperaMotivo', 'esperaDe', x.pd -> 'esperaDe', 'dono', x.pd -> 'dono')),
        'Perdido por silêncio: ' || coalesce(s ->> 'motivo', 'sem resposta') || '. Reabre-se num toque em Seguimentos.', 'motor');
      n_perd := n_perd + 1;
    end if;
  end loop;

  -- Pagamento: depois dos 60 dias, a cobrança passa ao chefe, com P1. Nunca fica perdido.
  v_dias := coalesce((cfg -> 'sequencias' -> 'D' ->> 'escalarDepoisDia')::int, 60);
  v_chefe := nullif(btrim(coalesce(cfg ->> 'chefe', '')), '');
  for r in select p.id, p.dados from public.pedidos p
           where p.dados ->> 'estado' = 'faturado' and coalesce(p.dados ->> 'cobrancaEscalada', '') = '' loop
    v_ancora := coalesce(public.seg_data(r.dados ->> 'dataFatura'),
      (select min(z.ancora) from public.seguimentos z where z.pedido_id = r.id and z.sequencia = 'D' and z.numero = 0));
    continue when v_ancora is null or hoje - v_ancora <= v_dias;
    perform public.seg_patch(r.id, jsonb_build_object(
        'prioridade', 'P1', 'dono', coalesce(v_chefe, nullif(r.dados ->> 'dono', '')),
        'proximaAcao', 'Cobrança em atraso: fatura ' || coalesce(r.dados ->> 'fatura', '') || ' com ' || (hoje - v_ancora) || ' dias',
        'dataProximaAcao', hoje::text, 'cobrancaEscalada', hoje::text,
        'prioridadeAntesCobranca', r.dados -> 'prioridade'),
      'Cobrança em atraso (' || (hoje - v_ancora) || ' dias): tarefa P1 para ' || coalesce(v_chefe, 'o chefe'), 'motor');
    n_esc := n_esc + 1;
  end loop;

  -- A última corrida fica em config; a segunda corrida no mesmo dia não a muda.
  insert into public.config (chave, valor) values ('seguimentos_motor', jsonb_build_object('dia', hoje::text, 'em', public.seg_iso(public.seg_agora()),
      'rascunhos', n_rasc, 'perdidos', n_perd, 'escaladas', n_esc))
    on conflict (chave) do update set valor = excluded.valor, versao = public.config.versao + 1, atualizado = now()
    where coalesce(public.config.valor ->> 'dia', '') < excluded.valor ->> 'dia'
       or n_rasc + n_perd + n_esc > 0;
  return jsonb_build_object('dia', hoje, 'rascunhos', n_rasc, 'perdidos', n_perd, 'escaladas', n_esc);
end $$;

-- O pg_cron corre em UTC: duas marcações (06:00 e 07:00 UTC) e só a que cai às 07:00 de Lisboa faz o trabalho,
-- de inverno e de verão.
create or replace function public.seg_cron()
returns void language plpgsql security definer set search_path = public as $$
begin
  if extract(hour from public.seg_agora() at time zone 'Europe/Lisbon') = 7 then perform public.seg_diario(public.seg_hoje()); end if;
end $$;

-- ---------- O que o escritório toca ----------

create or replace function public.seg_exigir()
returns void language plpgsql stable set search_path = public as $$
begin
  if not public.autorizado() then raise exception 'sem permissão' using errcode = '42501'; end if;
end $$;

-- «Enviar» (ou «Não atendeu», no telefone): o relógio começa aqui. Devolve a próxima ação.
create or replace function public.seg_enviar(p_id bigint, p_texto text default null, p_assunto text default null,
                                             p_canal text default null, p_resultado text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record; v_quem text := public.seg_quem(); v_acao record; v_d jsonb; v_total int; v_nao boolean := p_resultado = 'nao_atendeu';
begin
  perform public.seg_exigir();
  select * into s from public.seguimentos where id = p_id for update;
  if not found or s.estado <> 'pendente' or s.fechado_em is not null then raise exception 'este seguimento já não está pendente' using errcode = 'P0001'; end if;
  update public.seguimentos set estado = 'enviado', enviado_em = public.seg_agora(), enviado_por = v_quem,
    rascunho = coalesce(p_texto, rascunho), assunto = coalesce(p_assunto, assunto),
    canal = case when p_canal in ('whatsapp','email','telefone') then p_canal else canal end,
    resultado = coalesce(p_resultado, 'enviado'),
    ancora = case when numero = 0 then public.seg_hoje() else ancora end
  where id = p_id;
  select p.dados into v_d from public.pedidos p where p.id = s.pedido_id;
  v_total := coalesce(array_length(public.seg_dias(public.seg_cfg(), s.sequencia, v_d ->> 'prioridade' = 'P1'), 1), 1) - 1;
  select * into v_acao from public.seg_acao(s.pedido_id);
  perform public.seg_patch(s.pedido_id,
    public.seg_patch_acao(v_acao.acao, v_acao.data) || jsonb_build_object('ultimoSeguimento', public.seg_iso(public.seg_agora()),
                       'seguimentos', coalesce(public.seg_numero(v_d ->> 'seguimentos'), 0) + case when s.numero > 0 then 1 else 0 end)
      || case when v_nao then '{}'::jsonb else jsonb_build_object('ultimoContacto', public.seg_iso(public.seg_agora())) end,
    public.seg_rotulo(s.sequencia, s.numero, v_total) || case when v_nao then ': ligou, não atendeu' else ': enviado por ' || public.seg_canal_txt(coalesce(p_canal, s.canal)) end || ' (' || v_quem || ')',
    v_quem);
  return jsonb_build_object('acao', v_acao.acao, 'data', v_acao.data);
end $$;

-- Desfazer um envio feito por engano (só nos 15 minutos seguintes e só o último passo do ciclo).
create or replace function public.seg_desfazer(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_acao record; v_d jsonb;
begin
  perform public.seg_exigir();
  select * into s from public.seguimentos where id = p_id for update;
  if not found or s.estado <> 'enviado' or s.fechado_em is not null or s.enviado_em < public.seg_agora() - interval '15 minutes'
     or exists (select 1 from public.seguimentos z where z.pedido_id = s.pedido_id and z.sequencia = s.sequencia and z.ciclo = s.ciclo and z.numero > s.numero) then
    raise exception 'já não é possível desfazer' using errcode = 'P0001';
  end if;
  update public.seguimentos set estado = 'pendente', enviado_em = null, enviado_por = null, resultado = null,
    ancora = case when numero = 0 and sequencia in ('A','B') then null else ancora end where id = p_id;
  select p.dados into v_d from public.pedidos p where p.id = s.pedido_id;
  select * into v_acao from public.seg_acao(s.pedido_id);
  perform public.seg_patch(s.pedido_id, public.seg_patch_acao(v_acao.acao, v_acao.data) || jsonb_build_object(
      'seguimentos', greatest(coalesce(public.seg_numero(v_d ->> 'seguimentos'), 0) - case when s.numero > 0 then 1 else 0 end, 0)),
    'Envio desfeito', public.seg_quem());
end $$;

-- «Editar»: muda o texto, o assunto ou o canal de um rascunho. Mudar só o canal refaz o texto para esse canal.
create or replace function public.seg_editar(p_id bigint, p_texto text default null, p_assunto text default null, p_canal text default null)
returns void language plpgsql security definer set search_path = public as $$
declare s record; v_txt record; v_d jsonb;
begin
  perform public.seg_exigir();
  select * into s from public.seguimentos where id = p_id for update;
  if not found or s.estado <> 'pendente' then raise exception 'este seguimento já não está pendente' using errcode = 'P0001'; end if;
  if p_texto is null and p_canal in ('whatsapp','email','telefone') and p_canal <> s.canal then
    select p.dados into v_d from public.pedidos p where p.id = s.pedido_id;
    select * into v_txt from public.seg_texto(public.seg_cfg(), s.sequencia, s.numero, p_canal, v_d, public.seg_hoje());
    update public.seguimentos set canal = p_canal, rascunho = v_txt.texto, assunto = v_txt.assunto where id = p_id;
  else
    update public.seguimentos set rascunho = coalesce(p_texto, rascunho), assunto = coalesce(p_assunto, assunto),
      canal = case when p_canal in ('whatsapp','email','telefone') then p_canal else canal end where id = p_id;
  end if;
end $$;

-- «Respondeu»: o cliente respondeu. Cancela os seguimentos pendentes desta fase e pede a próxima ação.
create or replace function public.seg_respondeu(p_pedido text, p_nota text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c record; v_quem text := public.seg_quem(); n int := 0;
begin
  perform public.seg_exigir();
  for c in select distinct sequencia, ciclo from public.seguimentos where pedido_id = p_pedido and fechado_em is null loop
    update public.seguimentos set estado = 'respondido', resultado = coalesce(p_nota, 'cliente respondeu')
      where id = (select id from public.seguimentos where pedido_id = p_pedido and sequencia = c.sequencia and ciclo = c.ciclo
                  and estado = 'enviado' order by numero desc limit 1);
    update public.seguimentos set estado = 'cancelado', resultado = 'cliente respondeu'
      where pedido_id = p_pedido and sequencia = c.sequencia and ciclo = c.ciclo and estado = 'pendente';
    update public.seguimentos set fechado_em = public.seg_agora(), fecho = 'respondeu'
      where pedido_id = p_pedido and sequencia = c.sequencia and ciclo = c.ciclo and fechado_em is null;
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'este pedido não tem seguimentos ativos' using errcode = 'P0001'; end if;
  perform public.seg_patch(p_pedido, jsonb_build_object('ultimoContacto', public.seg_iso(public.seg_agora()),
      'proximaAcao', 'Definir a próxima ação: o cliente respondeu', 'dataProximaAcao', public.seg_hoje()::text),
    'O cliente respondeu' || coalesce(': ' || nullif(btrim(p_nota), ''), '') || ' (' || v_quem || ')', v_quem);
end $$;

-- Um ciclo novo da sequência do estado, a contar de hoje (passo 0 já feito). Para reabrir e para recomeçar.
create or replace function public.seg_novo_ciclo(p_pedido text, p_seq text, p_entrada text, p_resultado text)
returns void language plpgsql security definer set search_path = public as $$
declare v_d jsonb;
begin
  select p.dados into v_d from public.pedidos p where p.id = p_pedido;
  insert into public.seguimentos (pedido_id, sequencia, ciclo, numero, entrada, ancora, devido_em, canal, estado, enviado_em, enviado_por, resultado)
    values (p_pedido, p_seq, (select coalesce(max(ciclo), 0) + 1 from public.seguimentos where pedido_id = p_pedido and sequencia = p_seq),
            0, p_entrada, public.seg_hoje(), public.seg_hoje(), public.seg_canal(v_d), 'enviado', public.seg_agora(), public.seg_quem(), p_resultado);
end $$;

-- «Reabrir» um pedido perdido por silêncio: volta ao estado onde estava e os seguimentos recomeçam hoje.
create or replace function public.seg_reabrir(p_pedido text)
returns void language plpgsql security definer set search_path = public as $$
declare v_d jsonb; ps jsonb; v_entrada text := public.seg_iso(public.seg_agora()); v_quem text := public.seg_quem();
begin
  perform public.seg_exigir();
  select p.dados into v_d from public.pedidos p where p.id = p_pedido for update;
  ps := v_d -> 'perdidoSilencio';
  if v_d ->> 'estado' <> 'perdido' or ps is null or ps ->> 'reabertoEm' is not null then
    raise exception 'este pedido não foi perdido por silêncio' using errcode = 'P0001';
  end if;
  -- O ciclo primeiro, com a entrada nova: assim a sincronização do gatilho não abre outro.
  perform public.seg_novo_ciclo(p_pedido, ps ->> 'sequencia', v_entrada, 'reaberto');
  perform public.seg_patch(p_pedido, jsonb_build_object(
      'estado', ps ->> 'estado', 'esperaMotivo', ps -> 'esperaMotivo', 'esperaDe', ps -> 'esperaDe',
      'motivo', null, 'dataFecho', null, 'entrouNoEstado', v_entrada,
      'dono', coalesce(nullif(ps ->> 'dono', ''), v_d ->> 'dono', v_quem),
      'reaberturas', coalesce(public.seg_numero(v_d ->> 'reaberturas'), 0) + 1,
      'proximaAcao', 'Retomar o contacto com o cliente (pedido reaberto)', 'dataProximaAcao', public.seg_hoje()::text,
      'perdidoSilencio', ps || jsonb_build_object('reabertoEm', public.seg_iso(public.seg_agora()), 'reabertoPor', v_quem)),
    'Reaberto depois da perda por silêncio (' || v_quem || '); os seguimentos recomeçam hoje', v_quem);
end $$;

-- «Recomeçar os seguimentos»: o cliente respondeu mas voltou a calar-se, no mesmo estado.
create or replace function public.seg_recomecar(p_pedido text)
returns void language plpgsql security definer set search_path = public as $$
declare v_d jsonb; v_seq text; v_quem text := public.seg_quem(); v_acao record;
begin
  perform public.seg_exigir();
  select p.dados into v_d from public.pedidos p where p.id = p_pedido for update;
  v_seq := public.seg_sequencia_de(v_d);
  if v_seq is null or exists (select 1 from public.seguimentos where pedido_id = p_pedido and fechado_em is null) then
    raise exception 'este pedido já tem seguimentos ativos, ou o estado não tem sequência' using errcode = 'P0001';
  end if;
  perform public.seg_novo_ciclo(p_pedido, v_seq, coalesce(v_d ->> 'entrouNoEstado', v_d ->> 'criado', ''), 'recomeçado');
  select * into v_acao from public.seg_acao(p_pedido);
  perform public.seg_patch(p_pedido, public.seg_patch_acao(v_acao.acao, v_acao.data),
    'Seguimentos recomeçados (' || v_quem || ')', v_quem);
end $$;

-- A página corre a tarefa do dia se o pg_cron ainda não a correu (ou não estiver ligado). Mesmo efeito, uma vez por dia.
create or replace function public.seg_correr()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.seg_exigir();
  return public.seg_diario(public.seg_hoje());
end $$;

-- ---------- Vistas (todas com security_invoker: só quem está em colaboradores as lê) ----------

drop view if exists public.v_seguimentos_hoje, public.v_violacoes, public.v_taxa_resposta, public.v_perdidos_silencio,
  public.v_perdidos_silencio_lista, public.v_dias_pagamento, public.v_seg_proximo;

-- Para enviar hoje: os rascunhos que vencem hoje e os atrasados, por dono.
create view public.v_seguimentos_hoje with (security_invoker = true) as
select s.id, s.pedido_id, p.dados ->> 'cliente' as cliente, coalesce(nullif(p.dados ->> 'dono', ''), 'Sem dono') as dono,
       coalesce(p.dados ->> 'prioridade', 'P3') as prioridade, p.dados ->> 'estado' as estado_pedido,
       s.sequencia, s.ciclo, s.numero, t.total, public.seg_rotulo(s.sequencia, s.numero, t.total) as passo,
       s.canal, s.assunto, s.rascunho, s.devido_em, public.seg_hoje() - s.devido_em as dias_atraso,
       p.dados ->> 'contacto' as contacto, p.dados ->> 'num' as orcamento
from public.seguimentos s
join public.pedidos p on p.id = s.pedido_id
cross join lateral (select coalesce(array_length(public.seg_dias(public.seg_cfg(), s.sequencia, p.dados ->> 'prioridade' = 'P1'), 1), 1) - 1 as total) t
where s.estado = 'pendente' and s.fechado_em is null and s.devido_em <= public.seg_hoje()
order by dono, s.devido_em, prioridade;

-- O próximo passo de cada ciclo ativo (para a linha do tempo do pedido e para «a seguir»).
create view public.v_seg_proximo with (security_invoker = true) as
select p.id as pedido_id, q.* from public.pedidos p cross join lateral public.seg_proximo(p.id) q;

-- Regra 5: todo o pedido aberto tem uma próxima ação, com data e dono. E os fechos fora das regras.
create view public.v_violacoes with (security_invoker = true) as
with p as (
  select id, dados, dados ->> 'estado' as estado,
         dados ->> 'estado' in ('novo','visita_por_marcar','visita_marcada','orcamento_por_fazer','espera_cliente','espera_fornecedor','em_execucao','por_faturar','faturado') as aberto
  from public.pedidos
)
select p.id as pedido_id, p.dados ->> 'cliente' as cliente, p.estado, nullif(p.dados ->> 'dono', '') as dono, v.tipo, v.texto
from p cross join lateral (values
  ('sem_acao', 'Pedido aberto sem próxima ação', p.aberto and coalesce(btrim(p.dados ->> 'proximaAcao'), '') = ''),
  ('sem_data', 'Pedido aberto sem data na próxima ação', p.aberto and public.seg_data(p.dados ->> 'dataProximaAcao') is null),
  ('sem_dono', 'Pedido aberto sem dono', p.aberto and coalesce(btrim(p.dados ->> 'dono'), '') = ''),
  ('fatura_sem_data', 'Faturado sem data da fatura: os lembretes de pagamento não sabem quando contar', p.estado = 'faturado' and public.seg_data(p.dados ->> 'dataFatura') is null),
  ('fechado_sem_pagamento', 'Concluído sem data de pagamento', p.estado = 'resolvido' and public.seg_data(p.dados ->> 'dataPagamento') is null
     and public.seg_data(p.dados ->> 'dataFecho') >= coalesce(public.seg_data(public.seg_cfg() ->> 'instalado'), date '2999-01-01')),
  ('perdido_sem_motivo', 'Perdido sem motivo', p.estado = 'perdido' and coalesce(btrim(p.dados ->> 'motivo'), '') = '')
) v(tipo, texto, falha)
where v.falha;

-- Taxa de resposta por sequência, passo e canal. A resposta conta no último passo enviado antes dela.
create view public.v_taxa_resposta with (security_invoker = true) as
select sequencia, numero, canal,
       count(*) as enviados, count(*) filter (where estado = 'respondido') as respondidos,
       round(100.0 * count(*) filter (where estado = 'respondido') / nullif(count(*), 0), 1) as taxa
from public.seguimentos
where enviado_em is not null and coalesce(resultado, '') not in ('reaberto', 'recomeçado')
group by grouping sets ((sequencia, numero, canal), (sequencia, numero), (sequencia));

-- Perdidos por silêncio: um por ciclo, com a semana e se foi reaberto.
create view public.v_perdidos_silencio_lista with (security_invoker = true) as
select distinct on (s.pedido_id, s.sequencia, s.ciclo)
       date_trunc('week', s.fechado_em at time zone 'Europe/Lisbon')::date as semana, s.pedido_id, p.dados ->> 'cliente' as cliente,
       s.sequencia, s.ciclo, p.dados ->> 'num' as orcamento, (s.fechado_em at time zone 'Europe/Lisbon')::date as perdido_em,
       exists (select 1 from public.seguimentos z where z.pedido_id = s.pedido_id and z.sequencia = s.sequencia and z.ciclo > s.ciclo) as reaberto,
       p.dados ->> 'estado' as estado_atual
from public.seguimentos s join public.pedidos p on p.id = s.pedido_id
where s.fecho = 'perdido'
order by s.pedido_id, s.sequencia, s.ciclo;

create view public.v_perdidos_silencio with (security_invoker = true) as
select semana, sequencia, count(*) as perdidos, count(*) filter (where reaberto) as reabertos
from public.v_perdidos_silencio_lista group by semana, sequencia;

-- Da fatura ao pagamento, em dias.
create view public.v_dias_pagamento with (security_invoker = true) as
select id as pedido_id, dados ->> 'cliente' as cliente, fatura_num, fatura_data, pagamento_data,
       pagamento_data - fatura_data as dias, fatura_valor, fatura_adiantamento,
       date_trunc('month', pagamento_data)::date as mes
from public.pedidos
where fatura_data is not null and pagamento_data is not null;

-- ---------- Permissões ----------
revoke all on public.v_seguimentos_hoje, public.v_seg_proximo, public.v_violacoes, public.v_taxa_resposta,
  public.v_perdidos_silencio, public.v_perdidos_silencio_lista, public.v_dias_pagamento from anon, public;
grant select on public.v_seguimentos_hoje, public.v_seg_proximo, public.v_violacoes, public.v_taxa_resposta,
  public.v_perdidos_silencio, public.v_perdidos_silencio_lista, public.v_dias_pagamento to authenticated;

do $$
declare f text;
begin
  -- Internas: só o gatilho, a tarefa diária e as outras funções as chamam.
  foreach f in array array['seg_sincronizar(text, jsonb, date)', 'seg_gatilho()', 'seg_patch(text, jsonb, text, text)', 'seg_diario(date)',
                           'seg_cron()', 'seg_novo_ciclo(text, text, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- O que a página chama (cada uma confirma que a conta está em colaboradores).
  foreach f in array array['seg_enviar(bigint, text, text, text, text)', 'seg_desfazer(bigint)', 'seg_editar(bigint, text, text, text)',
                           'seg_respondeu(text, text)', 'seg_reabrir(text)', 'seg_recomecar(text)', 'seg_correr()',
                           'seg_proximo(text)', 'seg_acao(text)', 'seg_cfg()', 'seg_quem()'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- Tempo real ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'seguimentos') then
    alter publication supabase_realtime add table public.seguimentos;
  end if;
end $$;

-- ---------- Arranque: os pedidos que já estão abertos entram no motor ----------
-- Só cria linhas em seguimentos (mensagens iniciais por enviar e as âncoras dos orçamentos e faturas); não muda pedidos.
-- Os rascunhos dos seguimentos seguintes nascem na primeira corrida da tarefa diária.
do $$
declare r record;
begin
  for r in select id, dados from public.pedidos loop
    perform public.seg_sincronizar(r.id, r.dados);
  end loop;
end $$;

-- ---------- A tarefa das 07:00 (pg_cron) ----------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mdm-seguimentos-0600utc', '0 6 * * *', 'select public.seg_cron()');
    perform cron.schedule('mdm-seguimentos-0700utc', '0 7 * * *', 'select public.seg_cron()');
  else
    raise notice 'pg_cron não está disponível: a página corre a tarefa do dia na primeira abertura (seg_correr).';
  end if;
end $$;
