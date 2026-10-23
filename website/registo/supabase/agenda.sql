-- Agenda dos técnicos do registo da MDM (23/10/2026)
-- Quem vai onde e quando: técnicos com competências, zonas e horário; marcações de visitas, manutenções e instalações;
-- conflitos (sobreposição, fora de horas, almoço, sem tempo para a viagem); sugestão do melhor dia e técnico; uma
-- ligação para o cliente escolher o dia da visita sem entrar no registo; e o calendário de cada técnico para o Google
-- Calendar ou o iPhone (só leitura).
--
-- Corre depois de migracao.sql e de seguimentos.sql (usa seg_util, seg_patch e seg_hoje). Só acrescenta: tabelas novas,
-- funções, vistas, a chave «agenda» em config. Pode correr-se outra vez sem estragar nada. Nada aqui envia mensagens.
-- Todas as tabelas novas têm a coluna «empresa» (hoje sempre «mdm»), para o registo servir várias empresas mais tarde.

do $$
begin
  if to_regprocedure('public.seg_patch(text, jsonb, text, text)') is null then
    raise exception 'Corra primeiro supabase/seguimentos.sql: a agenda usa as funções dele.';
  end if;
end $$;

-- ---------- Tabelas ----------

create table if not exists public.tecnicos (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'mdm',
  nome text not null,
  cor text not null default '#0D6788',
  telefone text,
  email text,
  competencias text[] not null default '{instalacao,manutencao,reparacao,obra}',
  zonas text[] not null default '{}',            -- vazio: vai a todas
  horario jsonb not null default '{"inicio":"08:00","fim":"17:00","cliente":"09:00","almoco":["12:00","13:00"],"dias":[1,2,3,4,5]}',
  ativo boolean not null default true,
  ical_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  criado timestamptz not null default now()
);

create table if not exists public.marcacoes (
  id bigserial primary key,
  empresa text not null default 'mdm',
  pedido_id text not null references public.pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('visita', 'manutencao', 'reparacao', 'instalacao', 'outro')),
  tecnicos uuid[] not null default '{}',
  inicio timestamptz not null,
  fim timestamptz not null check (fim > inicio),
  estado text not null default 'marcada' check (estado in ('proposta', 'marcada', 'confirmada', 'feita', 'cancelada')),
  origem text not null default 'escritorio' check (origem in ('escritorio', 'cliente', 'sugestao', 'importada')),
  zona text,
  notas text,
  criado timestamptz not null default now(),
  criado_por text
);
create index if not exists marcacoes_inicio_idx on public.marcacoes (inicio) where estado <> 'cancelada';
create index if not exists marcacoes_pedido_idx on public.marcacoes (pedido_id);

-- Ligações para o cliente escolher o dia. O cliente só vê as opções guardadas aqui, nunca a agenda.
create table if not exists public.agenda_links (
  token text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  empresa text not null default 'mdm',
  pedido_id text not null references public.pedidos(id) on delete cascade,
  opcoes jsonb not null default '[]',
  criado timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  marcacao_id bigint references public.marcacoes(id) on delete set null
);
create index if not exists agenda_links_pedido_idx on public.agenda_links (pedido_id);

alter table public.tecnicos enable row level security;
alter table public.marcacoes enable row level security;
alter table public.agenda_links enable row level security;
drop policy if exists "tecnicos: colaboradores" on public.tecnicos;
create policy "tecnicos: colaboradores" on public.tecnicos for all to authenticated using (public.autorizado()) with check (public.autorizado());
drop policy if exists "marcacoes: colaboradores" on public.marcacoes;
create policy "marcacoes: colaboradores" on public.marcacoes for all to authenticated using (public.autorizado()) with check (public.autorizado());
drop policy if exists "agenda_links: colaboradores" on public.agenda_links;
create policy "agenda_links: colaboradores" on public.agenda_links for select to authenticated using (public.autorizado());
revoke all on public.tecnicos, public.marcacoes, public.agenda_links from anon;
grant select, insert, update, delete on public.tecnicos, public.marcacoes to authenticated;
grant select on public.agenda_links to authenticated;
grant usage, select on sequence public.marcacoes_id_seq to authenticated;

-- ---------- Configuração (chave «agenda»; muda-se na página, em «Prazos e exportar») ----------

insert into public.config (chave, valor) values ('agenda', $json$
{
  "duracoes": {"visita": 60, "reparacao": 90, "manutencaoUnidade": 45, "manutencaoMin": 60, "instalacaoDiasPorUnidade": 1, "instalacaoMaxDias": 2},
  "viagem": {
    "PN": {"PN": 15, "Lisboa": 25, "Arredores": 35},
    "Lisboa": {"PN": 25, "Lisboa": 20, "Arredores": 40},
    "Arredores": {"PN": 35, "Lisboa": 40, "Arredores": 45}
  },
  "partida": "PN",
  "passo": 30,
  "diasProcura": 10,
  "sabado": false,
  "opcoesLink": 6,
  "validadeLinkDias": 7,
  "urlMarcar": "https://www.mdmassist.pt/marcar/?t="
}
$json$::jsonb)
on conflict (chave) do nothing;

create or replace function public.ag_cfg()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select valor from public.config where chave = 'agenda'), '{}'::jsonb);
$$;

-- ---------- Regras pequenas ----------

-- A zona pela morada, igual à da folha de obra (zonaDe na página): 1990 e 1998 Parque das Nações, 1000 a 1999 Lisboa.
create or replace function public.ag_zona(t text)
returns text language plpgsql immutable set search_path = public as $$
declare cp text := (regexp_match(coalesce(t, ''), '\m(\d{4})-\d{3}\M'))[1];
begin
  if coalesce(t, '') ~* 'parque das na[çc][õo]es|\morient' or cp in ('1990', '1998') then return 'PN'; end if;
  if (cp is not null and cp between '1000' and '1999') or (cp is null and coalesce(t, '') ~* '\mlisboa\M') then return 'Lisboa'; end if;
  return 'Arredores';
end $$;

create or replace function public.ag_viagem(cfg jsonb, de text, para text)
returns int language sql immutable set search_path = public as $$
  select coalesce((cfg -> 'viagem' -> coalesce(de, 'Arredores') ->> coalesce(para, 'Arredores'))::int, 40);
$$;

-- O tipo de marcação que um pedido precisa agora, e quanto tempo leva (minutos; instalação em dias inteiros).
create or replace function public.ag_tipo_de(d jsonb)
returns text language sql immutable set search_path = public as $$
  select case
    when d ->> 'estado' in ('em_execucao', 'espera_fornecedor') then 'instalacao'
    when d ->> 'tipo' = 'manutencao' then 'manutencao'
    when d ->> 'tipo' = 'reparacao' then 'reparacao'
    else 'visita' end;
$$;

create or replace function public.ag_duracao(cfg jsonb, tipo text, d jsonb)
returns int language plpgsql immutable set search_path = public as $$
declare du jsonb := coalesce(cfg -> 'duracoes', '{}'); n int := greatest(coalesce(public.seg_numero(d ->> 'unidades')::int, 1), 1);
begin
  return case tipo
    when 'reparacao' then coalesce((du ->> 'reparacao')::int, 90)
    when 'manutencao' then greatest(coalesce((du ->> 'manutencaoMin')::int, 60), n * coalesce((du ->> 'manutencaoUnidade')::int, 45))
    when 'instalacao' then least(greatest(n * coalesce((du ->> 'instalacaoDiasPorUnidade')::int, 1), 1), coalesce((du ->> 'instalacaoMaxDias')::int, 2))
    else coalesce((du ->> 'visita')::int, 60) end;
end $$;

-- A competência que o técnico tem de ter para este pedido.
create or replace function public.ag_competencia(tipo text, d jsonb)
returns text language sql immutable set search_path = public as $$
  select case when tipo = 'instalacao' then case when d ->> 'tipo' = 'obra' then 'obra' else 'instalacao' end
              when tipo in ('manutencao', 'reparacao') then tipo
              else coalesce(nullif(d ->> 'tipo', ''), 'instalacao') end;
$$;

create or replace function public.ag_hora(dia date, hhmm text)
returns timestamptz language sql stable set search_path = public as $$
  select (dia + hhmm::time) at time zone 'Europe/Lisbon';
$$;

-- ---------- Sugestão: o melhor técnico e a melhor hora ----------
-- Percorre os próximos dias úteis; em cada um, cada técnico ativo com a competência e a zona certas; em cada técnico,
-- as horas de 30 em 30 minutos dentro do horário, sem o almoço, sem o que já está marcado e com tempo para a viagem
-- desde a marcação anterior (e até à seguinte). Pontua: mais cedo é melhor (muito mais nos P1), bónus se o técnico já
-- está nessa zona nesse dia, castigo para o técnico mais carregado. Instalações: dias inteiros livres seguidos.
create or replace function public.agenda_sugerir(p_pedido text, p_n int default 3, p_tipo text default null,
                                                 p_ignorar bigint default null, p_desde date default null)
returns table (tecnico uuid, tecnico_nome text, inicio timestamptz, fim timestamptz, pontos numeric, razao text)
language plpgsql stable set search_path = public as $$
declare
  cfg jsonb := public.ag_cfg();
  d jsonb; v_tipo text; v_dur int; v_zona text; v_comp text; v_p text;
  v_agora timestamptz := public.seg_agora(); v_hoje date := public.seg_hoje();
  v_dia date; v_n_dias int := 0; v_max_dias int; v_passo int := coalesce((cfg ->> 'passo')::int, 30);
  t record; h jsonb; v_ini timestamptz; v_fim timestamptz; v_cli timestamptz; v_alm1 timestamptz; v_alm2 timestamptz;
  s timestamptz; e timestamptz; ok boolean; m record; v_carga int; v_mesma_zona boolean; v_pontos numeric; v_peso numeric;
  v_dias_inst int; k int; livre boolean;
  cand_tec uuid[] := '{}'; cand_nome text[] := '{}'; cand_ini timestamptz[] := '{}'; cand_fim timestamptz[] := '{}';
  cand_pts numeric[] := '{}'; cand_raz text[] := '{}';
begin
  select p.dados into d from public.pedidos p where p.id = p_pedido;
  if d is null then return; end if;
  v_tipo := coalesce(p_tipo, public.ag_tipo_de(d));
  v_dur := public.ag_duracao(cfg, v_tipo, d);
  v_zona := public.ag_zona(coalesce(d ->> 'localidade', ''));
  v_comp := public.ag_competencia(v_tipo, d);
  v_p := coalesce(d ->> 'prioridade', 'P3');
  v_peso := case v_p when 'P1' then 30 when 'P2' then 10 else 5 end;
  v_max_dias := case when v_p = 'P1' then 5 else coalesce((cfg ->> 'diasProcura')::int, 10) end;
  v_dia := coalesce(p_desde, case when v_p = 'P1' then v_hoje else v_hoje + 1 end);

  while v_n_dias < v_max_dias loop
    if public.seg_util(v_dia) or (coalesce((cfg ->> 'sabado')::boolean, false) and extract(isodow from v_dia) = 6) then
      for t in select * from public.tecnicos x where x.ativo and (v_comp = any(x.competencias) or cardinality(x.competencias) = 0)
                 and (cardinality(x.zonas) = 0 or v_zona = any(x.zonas)) order by x.nome loop
        h := t.horario;
        continue when not (extract(isodow from v_dia)::int = any(array(select jsonb_array_elements_text(coalesce(h -> 'dias', '[1,2,3,4,5]'))::int)));
        v_ini := public.ag_hora(v_dia, coalesce(h ->> 'inicio', '08:00'));
        v_fim := public.ag_hora(v_dia, coalesce(h ->> 'fim', '17:00'));
        v_cli := greatest(v_ini, public.ag_hora(v_dia, coalesce(h ->> 'cliente', h ->> 'inicio', '09:00')));
        v_alm1 := public.ag_hora(v_dia, coalesce(h -> 'almoco' ->> 0, '12:00'));
        v_alm2 := public.ag_hora(v_dia, coalesce(h -> 'almoco' ->> 1, '13:00'));
        select count(*), bool_or(x.zona = v_zona) into v_carga, v_mesma_zona from public.marcacoes x
          where t.id = any(x.tecnicos) and x.estado not in ('cancelada', 'proposta') and x.id is distinct from p_ignorar
            and x.inicio < v_fim and x.fim > v_ini;
        v_mesma_zona := coalesce(v_mesma_zona, false);

        if v_tipo = 'instalacao' then
          -- dias inteiros livres seguidos (o primeiro é este)
          v_dias_inst := v_dur; livre := v_carga = 0; k := 1; e := v_fim;
          while livre and k < v_dias_inst loop
            s := v_ini + (k || ' days')::interval;
            if not public.seg_util((s at time zone 'Europe/Lisbon')::date) then
              v_dias_inst := v_dias_inst + 1;   -- salta o fim de semana sem contar
            else
              livre := not exists (select 1 from public.marcacoes x where t.id = any(x.tecnicos) and x.estado not in ('cancelada', 'proposta')
                                   and x.id is distinct from p_ignorar and x.inicio < v_fim + (k || ' days')::interval and x.fim > s);
            end if;
            e := v_fim + (k || ' days')::interval; k := k + 1;
          end loop;
          if livre and v_ini > v_agora then
            v_pontos := 100 - v_n_dias * v_peso;
            cand_tec := cand_tec || t.id; cand_nome := cand_nome || t.nome; cand_ini := cand_ini || v_ini; cand_fim := cand_fim || e;
            cand_pts := cand_pts || v_pontos; cand_raz := cand_raz || (t.nome || ', ' || v_dur || case when v_dur > 1 then ' dias livres' else ' dia livre' end);
          end if;
          continue;
        end if;

        s := v_cli;
        while s + (v_dur || ' minutes')::interval <= v_fim loop
          e := s + (v_dur || ' minutes')::interval;
          ok := s > v_agora + interval '60 minutes' and not (s < v_alm2 and e > v_alm1);
          -- a primeira saída do dia vem da base
          if ok and s < v_ini + (public.ag_viagem(cfg, cfg ->> 'partida', v_zona) || ' minutes')::interval then ok := false; end if;
          if ok then
            for m in select x.inicio as mi, x.fim as mf, x.zona as mz from public.marcacoes x
                     where t.id = any(x.tecnicos) and x.estado not in ('cancelada', 'proposta') and x.id is distinct from p_ignorar
                       and x.inicio < v_fim and x.fim > v_ini loop
              if s < m.mf + (public.ag_viagem(cfg, m.mz, v_zona) || ' minutes')::interval
                 and e + (public.ag_viagem(cfg, v_zona, m.mz) || ' minutes')::interval > m.mi then
                ok := false; exit;
              end if;
            end loop;
          end if;
          if ok then
            v_pontos := 100 - v_n_dias * v_peso + case when v_mesma_zona then 15 else 0 end - v_carga * 3
                        - extract(epoch from (s - v_cli)) / 3600.0 * 0.5;
            cand_tec := cand_tec || t.id; cand_nome := cand_nome || t.nome; cand_ini := cand_ini || s; cand_fim := cand_fim || e;
            cand_pts := cand_pts || round(v_pontos, 1);
            cand_raz := cand_raz || (t.nome || case when v_mesma_zona then ', já está em ' || v_zona || ' nesse dia'
                                                    when v_carga = 0 then ', dia livre' else ', ' || v_carga || ' marcação(ões) nesse dia' end);
          end if;
          s := s + (v_passo || ' minutes')::interval;
        end loop;
      end loop;
      v_n_dias := v_n_dias + 1;
    end if;
    v_dia := v_dia + 1;
    exit when v_dia > v_hoje + 60;
  end loop;

  -- As n melhores, variadas: no máximo uma por técnico em cada meio dia.
  return query
    with c as (
      select u.tc, u.nm, u.ini, u.fi, u.pt, u.rz,
             row_number() over (partition by u.tc, (u.ini at time zone 'Europe/Lisbon')::date,
                                (extract(hour from u.ini at time zone 'Europe/Lisbon') >= 13) order by u.pt desc, u.ini) as rn
      from unnest(cand_tec, cand_nome, cand_ini, cand_fim, cand_pts, cand_raz) as u(tc, nm, ini, fi, pt, rz)
    )
    select c.tc, c.nm, c.ini, c.fi, c.pt, c.rz from c where c.rn = 1 order by c.pt desc, c.ini limit greatest(p_n, 1);
end $$;

-- ---------- Marcar (o escritório, ou o cliente pela ligação) ----------
-- Grava a marcação e põe o pedido em dia: visita marcada com data e hora (o ciclo de seguimentos do primeiro contacto
-- fecha sozinho, pelo gatilho do motor), ou a instalação na obra. Com p_id, muda uma marcação existente.
create or replace function public.ag_marcar(p_pedido text, p_tipo text, p_tecnicos uuid[], p_inicio timestamptz, p_fim timestamptz,
                                            p_origem text, p_notas text, p_id bigint, p_quem text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  d jsonb; v_id bigint; v_nomes text; v_dia date := (p_inicio at time zone 'Europe/Lisbon')::date;
  v_hora text := to_char(p_inicio at time zone 'Europe/Lisbon', 'HH24:MI'); patch jsonb := '{}'; v_nota text; v_mudou boolean := p_id is not null;
begin
  select p.dados into d from public.pedidos p where p.id = p_pedido for update;
  if d is null then raise exception 'pedido não encontrado' using errcode = 'P0001'; end if;
  select string_agg(t.nome, ' e ' order by array_position(p_tecnicos, t.id)) into v_nomes from public.tecnicos t where t.id = any(p_tecnicos);
  if p_id is null then
    insert into public.marcacoes (pedido_id, tipo, tecnicos, inicio, fim, origem, zona, notas, criado_por)
      values (p_pedido, p_tipo, coalesce(p_tecnicos, '{}'), p_inicio, p_fim, p_origem, public.ag_zona(d ->> 'localidade'), p_notas, p_quem)
      returning id into v_id;
  else
    update public.marcacoes set tipo = p_tipo, tecnicos = coalesce(p_tecnicos, '{}'), inicio = p_inicio, fim = p_fim,
      notas = coalesce(p_notas, notas), estado = case when estado = 'cancelada' then 'marcada' else estado end
      where id = p_id and pedido_id = p_pedido returning id into v_id;
    if v_id is null then raise exception 'marcação não encontrada' using errcode = 'P0001'; end if;
  end if;

  if p_tipo = 'instalacao' then
    patch := jsonb_build_object('obra', coalesce(d -> 'obra', '{}'::jsonb) || jsonb_build_object('dataInstalacao', v_dia::text, 'equipa', v_nomes),
                                'proximaAcao', 'Instalar e trazer o RI assinado', 'dataProximaAcao', v_dia::text);
    v_nota := 'Instalação ' || case when v_mudou then 'mudada para ' else 'marcada para ' end || to_char(v_dia, 'DD/MM') || coalesce(' com ' || v_nomes, '');
  else
    patch := jsonb_build_object('dataVisita', v_dia::text, 'horaVisita', v_hora, 'ultimoContacto', public.seg_iso(public.seg_agora()),
                                'proximaAcao', 'Fazer a visita' || coalesce(' (' || v_nomes || ')', ''), 'dataProximaAcao', v_dia::text);
    if d ->> 'estado' in ('novo', 'visita_por_marcar') then
      patch := patch || jsonb_build_object('estado', 'visita_marcada', 'entrouNoEstado', public.seg_iso(public.seg_agora()), 'acumuladoH', 0);
    end if;
    if v_mudou then patch := patch || jsonb_build_object('remarcacoes', coalesce(public.seg_numero(d ->> 'remarcacoes'), 0) + 1); end if;
    v_nota := case p_tipo when 'manutencao' then 'Manutenção' when 'reparacao' then 'Reparação' else 'Visita' end
              || case when v_mudou then ' mudada para ' else ' marcada para ' end || to_char(v_dia, 'DD/MM') || ' às ' || v_hora
              || coalesce(' com ' || v_nomes, '') || case when p_origem = 'cliente' then ' (o cliente escolheu pela ligação)' else '' end;
  end if;
  perform public.seg_patch(p_pedido, patch, v_nota, coalesce(p_quem, 'cliente'));
  return v_id;
end $$;

create or replace function public.agenda_marcar(p_pedido text, p_tipo text, p_tecnicos uuid[], p_inicio timestamptz, p_fim timestamptz,
                                                p_notas text default null, p_id bigint default null)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  perform public.seg_exigir();
  return public.ag_marcar(p_pedido, p_tipo, p_tecnicos, p_inicio, p_fim, 'escritorio', p_notas, p_id, public.seg_quem());
end $$;

-- Cancelar: a visita volta a «visita por marcar» se era esta a visita do pedido.
create or replace function public.agenda_cancelar(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m record; d jsonb;
begin
  perform public.seg_exigir();
  update public.marcacoes set estado = 'cancelada' where id = p_id and estado <> 'cancelada' returning * into m;
  if not found then return; end if;
  select p.dados into d from public.pedidos p where p.id = m.pedido_id;
  if m.tipo <> 'instalacao' and d ->> 'estado' = 'visita_marcada' and d ->> 'dataVisita' = ((m.inicio at time zone 'Europe/Lisbon')::date)::text then
    perform public.seg_patch(m.pedido_id, jsonb_build_object('estado', 'visita_por_marcar', 'entrouNoEstado', public.seg_iso(public.seg_agora()),
        'dataVisita', null, 'horaVisita', null, 'proximaAcao', 'Marcar outra vez a visita', 'dataProximaAcao', public.seg_hoje()::text),
      'Visita de ' || to_char(m.inicio at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') || ' cancelada', public.seg_quem());
  else
    perform public.seg_patch(m.pedido_id, '{}'::jsonb, 'Marcação de ' || to_char(m.inicio at time zone 'Europe/Lisbon', 'DD/MM HH24:MI') || ' cancelada', public.seg_quem());
  end if;
end $$;

create or replace function public.agenda_estado(p_id bigint, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.seg_exigir();
  if p_estado not in ('marcada', 'confirmada', 'feita') then raise exception 'estado inválido' using errcode = 'P0001'; end if;
  update public.marcacoes set estado = p_estado where id = p_id and estado <> 'cancelada';
end $$;

-- Pedido perdido ou concluído: as marcações futuras caem.
create or replace function public.ag_gatilho()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.dados ->> 'estado' in ('perdido', 'resolvido') and coalesce(old.dados ->> 'estado', '') is distinct from new.dados ->> 'estado' then
    update public.marcacoes set estado = 'cancelada' where pedido_id = new.id and inicio > now() and estado in ('proposta', 'marcada', 'confirmada');
  end if;
  return null;
end $$;
drop trigger if exists pedidos_agenda on public.pedidos;
create trigger pedidos_agenda after update of dados on public.pedidos for each row execute function public.ag_gatilho();

-- ---------- A ligação para o cliente ----------

-- Opções novas para um pedido: ao cliente não interessa o técnico, interessa o dia. Uma hora por manhã e por tarde
-- (a melhor), as primeiras N por ordem de data: escolhas em dias diferentes, nunca a mesma hora repetida.
create or replace function public.ag_opcoes(p_pedido text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('t', y.tecnico, 'i', y.inicio, 'f', y.fim) order by y.inicio), '[]'::jsonb)
  from (
    select * from (
      select distinct on (x.dia, x.tarde) x.tecnico, x.inicio, x.fim
      from (select s.*, (s.inicio at time zone 'Europe/Lisbon')::date as dia,
                   extract(hour from s.inicio at time zone 'Europe/Lisbon') >= 13 as tarde
            from public.agenda_sugerir(p_pedido, 200, 'visita') s) x
      order by x.dia, x.tarde, x.pontos desc, x.inicio
    ) z order by z.inicio limit coalesce((public.ag_cfg() ->> 'opcoesLink')::int, 6)
  ) y;
$$;

-- Uma ligação ativa por pedido (reaproveita a que já existe). Devolve o token.
create or replace function public.ag_link(p_pedido text)
returns text language plpgsql security definer set search_path = public as $$
declare v_token text; cfg jsonb := public.ag_cfg();
begin
  select l.token into v_token from public.agenda_links l
    where l.pedido_id = p_pedido and l.usado_em is null and l.expira_em > public.seg_agora() order by l.criado desc limit 1;
  if v_token is null then
    insert into public.agenda_links (pedido_id, opcoes, expira_em)
      values (p_pedido, public.ag_opcoes(p_pedido), public.seg_agora() + (coalesce((cfg ->> 'validadeLinkDias')::int, 7) || ' days')::interval)
      returning token into v_token;
  end if;
  return v_token;
end $$;

-- Para a página: as ligações dos pedidos que estão à espera de marcar a visita (os que pedem), de uma vez.
create or replace function public.agenda_links_para(p_pedidos text[])
returns table (pedido_id text, token text, url text)
language plpgsql security definer set search_path = public as $$
declare p text; v_url text := coalesce(public.ag_cfg() ->> 'urlMarcar', 'https://www.mdmassist.pt/marcar/?t=');
begin
  perform public.seg_exigir();
  foreach p in array coalesce(p_pedidos, '{}') loop
    if exists (select 1 from public.pedidos x where x.id = p and x.dados ->> 'estado' in ('novo', 'visita_por_marcar')) then
      pedido_id := p; token := public.ag_link(p); url := v_url || token; return next;
    end if;
  end loop;
end $$;

create or replace function public.ag_livre(p_tec uuid, p_ini timestamptz, p_fim timestamptz, p_ignorar bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.marcacoes x where p_tec = any(x.tecnicos) and x.estado not in ('cancelada', 'proposta')
                     and x.id is distinct from p_ignorar and x.inicio < p_fim and x.fim > p_ini);
$$;

-- Público (sem entrar): o que a página /marcar/ mostra. Só o primeiro nome da pessoa de contacto e a localidade.
create or replace function public.agenda_link_ver(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; d jsonb; v_ops jsonb; o jsonb; v_livres jsonb := '[]'; i int := 0; v_marc record;
begin
  select * into l from public.agenda_links where token = p_token;
  if not found then return jsonb_build_object('estado', 'invalida'); end if;
  select p.dados into d from public.pedidos p where p.id = l.pedido_id;
  if l.usado_em is not null then
    select * into v_marc from public.marcacoes where id = l.marcacao_id;
    return jsonb_build_object('estado', 'usada', 'inicio', v_marc.inicio, 'fim', v_marc.fim);
  end if;
  if l.expira_em < public.seg_agora() or d ->> 'estado' not in ('novo', 'visita_por_marcar') then
    return jsonb_build_object('estado', 'expirada');
  end if;
  v_ops := l.opcoes;
  -- Se o tempo passou e já sobram poucas opções, refaz-se a lista com o que está livre agora.
  if (select count(*) from jsonb_array_elements(v_ops) x where (x ->> 'i')::timestamptz > public.seg_agora() + interval '2 hours'
        and public.ag_livre((x ->> 't')::uuid, (x ->> 'i')::timestamptz, (x ->> 'f')::timestamptz, null)) < 2 then
    v_ops := public.ag_opcoes(l.pedido_id);
    update public.agenda_links set opcoes = v_ops where token = p_token;
  end if;
  for o in select value from jsonb_array_elements(v_ops) loop
    if (o ->> 'i')::timestamptz > public.seg_agora() + interval '2 hours'
       and public.ag_livre((o ->> 't')::uuid, (o ->> 'i')::timestamptz, (o ->> 'f')::timestamptz, null) then
      v_livres := v_livres || jsonb_build_object('n', i, 'inicio', o ->> 'i', 'fim', o ->> 'f');
    end if;
    i := i + 1;
  end loop;
  return jsonb_build_object('estado', 'ativa',
    'nome', case when split_part(btrim(coalesce(d ->> 'contactoNome', '')), ' ', 1) ~* '^(sr|sra|srª|d|dr|dra|drª|eng|enga|engª)\.?$'
                 then split_part(btrim(d ->> 'contactoNome'), ' ', 1) || ' ' || split_part(btrim(d ->> 'contactoNome'), ' ', 2)
                 else split_part(btrim(coalesce(d ->> 'contactoNome', '')), ' ', 1) end,
    'localidade', split_part(coalesce(d ->> 'localidade', ''), E'\n', 1),
    'opcoes', v_livres);
end $$;

-- Público: o cliente escolhe a opção n. Uma vez só; volta a confirmar que está livre.
create or replace function public.agenda_link_marcar(p_token text, p_n int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; d jsonb; o jsonb; v_id bigint; v_tipo text;
begin
  select * into l from public.agenda_links where token = p_token for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'invalida'); end if;
  if l.usado_em is not null then return jsonb_build_object('ok', false, 'erro', 'usada'); end if;
  select p.dados into d from public.pedidos p where p.id = l.pedido_id;
  if l.expira_em < public.seg_agora() or d ->> 'estado' not in ('novo', 'visita_por_marcar') then
    return jsonb_build_object('ok', false, 'erro', 'expirada');
  end if;
  o := l.opcoes -> p_n;
  if o is null or (o ->> 'i')::timestamptz <= public.seg_agora() + interval '2 hours'
     or not public.ag_livre((o ->> 't')::uuid, (o ->> 'i')::timestamptz, (o ->> 'f')::timestamptz, null) then
    return jsonb_build_object('ok', false, 'erro', 'ocupada');
  end if;
  v_tipo := case when d ->> 'tipo' in ('manutencao', 'reparacao') then d ->> 'tipo' else 'visita' end;
  v_id := public.ag_marcar(l.pedido_id, v_tipo, array[(o ->> 't')::uuid], (o ->> 'i')::timestamptz, (o ->> 'f')::timestamptz,
                           'cliente', null, null, 'cliente');
  update public.agenda_links set usado_em = public.seg_agora(), marcacao_id = v_id where token = p_token;
  return jsonb_build_object('ok', true, 'inicio', o ->> 'i', 'fim', o ->> 'f');
end $$;

-- ---------- Calendário de cada técnico (Google Calendar, iPhone) ----------
-- Devolve as marcações do técnico do token (30 dias para trás, 120 para a frente) em iCalendar. A função do Netlify
-- /api/agenda/<token>.ics só a chama e devolve o texto; quem tem o endereço vê nomes, moradas e telefones: é secreto.
create or replace function public.ag_ics_txt(t text)
returns text language sql immutable set search_path = public as $$
  select replace(replace(replace(replace(coalesce(t, ''), '\', '\\'), ';', '\;'), ',', '\,'), E'\n', '\n');
$$;

create or replace function public.agenda_ical(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare t record; m record; d jsonb; linhas text[] := array['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MDM//Registo//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
        f text := 'YYYYMMDD"T"HH24MISS"Z"'; v_tipo text;
begin
  select * into t from public.tecnicos where ical_token = p_token and ativo;
  if not found then return null; end if;
  linhas := linhas || ('X-WR-CALNAME:MDM, ' || public.ag_ics_txt(t.nome)) || 'X-WR-TIMEZONE:Europe/Lisbon'::text;
  for m in select x.* from public.marcacoes x where t.id = any(x.tecnicos) and x.estado <> 'cancelada'
           and x.fim > now() - interval '30 days' and x.inicio < now() + interval '120 days' order by x.inicio loop
    select p.dados into d from public.pedidos p where p.id = m.pedido_id;
    v_tipo := case m.tipo when 'visita' then 'Visita' when 'manutencao' then 'Manutenção' when 'reparacao' then 'Reparação'
                          when 'instalacao' then 'Instalação' else 'Marcação' end;
    linhas := linhas || 'BEGIN:VEVENT'::text
      || ('UID:marcacao-' || m.id || '@mdmassist.pt')
      || ('DTSTAMP:' || to_char(now() at time zone 'UTC', f))
      || ('DTSTART:' || to_char(m.inicio at time zone 'UTC', f))
      || ('DTEND:' || to_char(m.fim at time zone 'UTC', f))
      || ('SUMMARY:' || public.ag_ics_txt(v_tipo || ': ' || coalesce(d ->> 'cliente', m.pedido_id) || coalesce(' (' || nullif(split_part(d ->> 'localidade', E'\n', 1), '') || ')', '')))
      || ('LOCATION:' || public.ag_ics_txt(coalesce(d ->> 'localidade', '')))
      || ('DESCRIPTION:' || public.ag_ics_txt(concat_ws(E'\n', m.pedido_id || coalesce(' · ' || (d ->> 'num'), ''),
            nullif('Contacto: ' || coalesce(d ->> 'contacto', ''), 'Contacto: '), nullif(d ->> 'descricao', ''), nullif(m.notas, ''),
            case when coalesce(d ->> 'localidade', '') <> '' then 'Mapa: https://www.google.com/maps/search/?api=1&query=' || replace(replace(split_part(d ->> 'localidade', E'\n', 1), ' ', '+'), '&', '') end)))
      || ('STATUS:' || case when m.estado = 'proposta' then 'TENTATIVE' else 'CONFIRMED' end)
      || 'END:VEVENT'::text;
  end loop;
  linhas := linhas || 'END:VCALENDAR'::text;
  return array_to_string(linhas, E'\r\n') || E'\r\n';
end $$;

create or replace function public.agenda_novo_token(p_tecnico uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  perform public.seg_exigir();
  update public.tecnicos set ical_token = v where id = p_tecnico;
  return v;
end $$;

-- ---------- Vistas ----------

drop view if exists public.v_agenda, public.v_agenda_conflitos, public.v_por_marcar;

create view public.v_agenda with (security_invoker = true) as
select m.id, m.pedido_id, m.tipo, m.estado, m.origem, m.inicio, m.fim, m.tecnicos, m.zona, m.notas,
       (select array_agg(t.nome order by array_position(m.tecnicos, t.id)) from public.tecnicos t where t.id = any(m.tecnicos)) as nomes,
       p.dados ->> 'cliente' as cliente, p.dados ->> 'localidade' as localidade, p.dados ->> 'contacto' as contacto,
       coalesce(p.dados ->> 'prioridade', 'P3') as prioridade, p.dados ->> 'estado' as estado_pedido, p.dados ->> 'num' as orcamento
from public.marcacoes m join public.pedidos p on p.id = m.pedido_id
where m.estado <> 'cancelada';

-- Conflitos: o mesmo técnico em dois sítios, fora do horário, por cima do almoço, ou sem tempo para a viagem.
create view public.v_agenda_conflitos with (security_invoker = true) as
with x as (
  select m.id, m.tipo, m.inicio, m.fim, m.zona, u.tec, t.nome, t.horario, (m.inicio at time zone 'Europe/Lisbon')::date as dia
  from public.marcacoes m cross join lateral unnest(m.tecnicos) as u(tec) join public.tecnicos t on t.id = u.tec
  where m.estado not in ('cancelada', 'proposta')
)
select a.id as marcacao_id, a.tec as tecnico, a.nome, 'sobreposicao' as tipo, a.nome || ' tem outra marcação à mesma hora' as texto
from x a join x b on a.tec = b.tec and a.id <> b.id and a.inicio < b.fim and a.fim > b.inicio
union all
select a.id, a.tec, a.nome, 'viagem', a.nome || ' não tem tempo para a viagem desde a marcação anterior'
from x a join x b on a.tec = b.tec and a.id <> b.id and a.dia = b.dia and b.fim <= a.inicio and a.tipo <> 'instalacao'
  and a.inicio < b.fim + (public.ag_viagem(public.ag_cfg(), b.zona, a.zona) || ' minutes')::interval
union all
select a.id, a.tec, a.nome, 'horario', a.nome || ' não trabalha a essa hora ou nesse dia'
from x a
where a.tipo <> 'instalacao' and (
  not (extract(isodow from a.dia)::int = any(array(select jsonb_array_elements_text(coalesce(a.horario -> 'dias', '[1,2,3,4,5]'))::int)))
  or a.inicio < public.ag_hora(a.dia, coalesce(a.horario ->> 'inicio', '08:00')) or a.fim > public.ag_hora(a.dia, coalesce(a.horario ->> 'fim', '17:00')))
union all
select a.id, a.tec, a.nome, 'almoco', 'Por cima do almoço de ' || a.nome
from x a
where a.tipo <> 'instalacao' and a.inicio < public.ag_hora(a.dia, coalesce(a.horario -> 'almoco' ->> 1, '13:00'))
  and a.fim > public.ag_hora(a.dia, coalesce(a.horario -> 'almoco' ->> 0, '12:00'));

-- Por marcar: visitas que ainda não têm dia, e obras em execução sem data de instalação.
create view public.v_por_marcar with (security_invoker = true) as
select p.id as pedido_id, p.dados ->> 'cliente' as cliente, p.dados ->> 'localidade' as localidade, public.ag_zona(p.dados ->> 'localidade') as zona,
       coalesce(p.dados ->> 'prioridade', 'P3') as prioridade, p.dados ->> 'tipo' as tipo_pedido, p.dados ->> 'estado' as estado,
       public.ag_tipo_de(p.dados) as tipo, nullif(p.dados ->> 'dono', '') as dono, p.dados ->> 'contacto' as contacto,
       public.seg_hoje() - coalesce(public.seg_data(p.dados ->> 'entrouNoEstado'), public.seg_data(p.dados ->> 'criado'), public.seg_hoje()) as dias_espera
from public.pedidos p
where coalesce(p.dados ->> 'porConfirmar', 'false') <> 'true'
  and (p.dados ->> 'estado' in ('novo', 'visita_por_marcar')
       or (p.dados ->> 'estado' = 'em_execucao' and coalesce(p.dados -> 'obra' ->> 'dataInstalacao', '') = ''))
  and not exists (select 1 from public.marcacoes m where m.pedido_id = p.id and m.estado not in ('cancelada', 'feita') and m.fim > now());

-- ---------- Arranque: as visitas que já têm data entram na agenda (sem técnico, para o escritório atribuir) ----------
insert into public.marcacoes (pedido_id, tipo, tecnicos, inicio, fim, origem, zona)
select p.id, case when p.dados ->> 'tipo' in ('manutencao', 'reparacao') then p.dados ->> 'tipo' else 'visita' end, '{}',
       public.ag_hora(public.seg_data(p.dados ->> 'dataVisita'), coalesce(nullif(p.dados ->> 'horaVisita', ''), '09:00')),
       public.ag_hora(public.seg_data(p.dados ->> 'dataVisita'), coalesce(nullif(p.dados ->> 'horaVisita', ''), '09:00'))
         + (public.ag_duracao(public.ag_cfg(), case when p.dados ->> 'tipo' in ('manutencao', 'reparacao') then p.dados ->> 'tipo' else 'visita' end, p.dados) || ' minutes')::interval,
       'importada', public.ag_zona(p.dados ->> 'localidade')
from public.pedidos p
where p.dados ->> 'estado' = 'visita_marcada' and public.seg_data(p.dados ->> 'dataVisita') >= public.seg_hoje()
  and not exists (select 1 from public.marcacoes m where m.pedido_id = p.id and m.tipo <> 'instalacao');

-- ---------- Seguimentos: a mensagem do primeiro contacto leva a ligação para escolher o dia ----------
-- A página troca {link_marcacao} pela ligação quando prepara o envio. Acrescenta-se aos textos A (WhatsApp e email)
-- que ainda não o têm, sem mexer no resto do texto.
update public.config c set valor = jsonb_set(c.valor, '{textos,A}', (
  select jsonb_agg(case when jsonb_typeof(e) <> 'object' then e else e
           || case when coalesce(e ->> 'whatsapp', '') <> '' and position('{link_marcacao}' in e ->> 'whatsapp') = 0
                   then jsonb_build_object('whatsapp', (e ->> 'whatsapp') || '{link_marcacao}') else '{}'::jsonb end
           || case when coalesce(e ->> 'email', '') <> '' and position('{link_marcacao}' in e ->> 'email') = 0
                   then jsonb_build_object('email', replace(e ->> 'email', E'\n\n{assinatura}', '{link_marcacao}' || E'\n\n{assinatura}')) else '{}'::jsonb end
         end order by n)
  from jsonb_array_elements(c.valor -> 'textos' -> 'A') with ordinality as a(e, n)))
where c.chave = 'seguimentos' and jsonb_typeof(c.valor -> 'textos' -> 'A') = 'array';

-- ---------- Permissões ----------
revoke all on public.v_agenda, public.v_agenda_conflitos, public.v_por_marcar from anon, public;
grant select on public.v_agenda, public.v_agenda_conflitos, public.v_por_marcar to authenticated;

do $$
declare f text;
begin
  -- Internas (gatilho e funções chamadas por outras).
  foreach f in array array['ag_marcar(text, text, uuid[], timestamptz, timestamptz, text, text, bigint, text)', 'ag_gatilho()',
                           'ag_link(text)', 'ag_opcoes(text)', 'ag_livre(uuid, timestamptz, timestamptz, bigint)', 'ag_cfg()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- A página do registo (cada uma confirma que a conta está em colaboradores, ou lê com RLS).
  foreach f in array array['agenda_sugerir(text, int, text, bigint, date)', 'agenda_marcar(text, text, uuid[], timestamptz, timestamptz, text, bigint)',
                           'agenda_cancelar(bigint)', 'agenda_estado(bigint, text)', 'agenda_links_para(text[])', 'agenda_novo_token(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- Públicas: só estas três, cada uma presa a um token secreto.
  foreach f in array array['agenda_link_ver(text)', 'agenda_link_marcar(text, int)', 'agenda_ical(text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
-- agenda_sugerir lê a configuração pelos técnicos e marcações com RLS; o cliente nunca a chama diretamente.
grant execute on function public.ag_cfg() to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'marcacoes') then
      alter publication supabase_realtime add table public.marcacoes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tecnicos') then
      alter publication supabase_realtime add table public.tecnicos;
    end if;
  end if;
end $$;
