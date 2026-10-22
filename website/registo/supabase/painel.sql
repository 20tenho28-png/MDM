-- Painel do registo: as vistas que o separador «Painel» lê (22/10/2026).
-- Migração só de acrescentar: não muda nem apaga tabelas, colunas, estados ou dados dos pedidos. Corre-se no SQL Editor do
-- projeto Supabase da MDM, depois de migracao.sql. Pode correr-se outra vez: começa por apagar só as vistas do painel
-- (que não guardam nada) e volta a criá-las.
--
-- Regras, as mesmas da página (index.html), para o painel e a lista dizerem o mesmo:
-- - Horas úteis: 9h às 18h, hora de Lisboa, sem fins de semana, feriados nacionais nem Santo António (13 de junho).
-- - Prazos: config, chave «prazos» (valores[estado][P1|P2|P3], limiteDono, provisorio); sem config, os valores de origem.
-- - Pedidos «por confirmar» (importados) não têm relógio: não contam como atrasados.
-- - Os 12 passos e o «à espera de quem» são calculados a partir do estado e dos campos do pedido (passo_de, aguarda_de);
--   nada se guarda. O único campo novo é opcional: dados.aguarda = 'revisao', posto pelas automações quando deixarem um
--   rascunho para uma pessoa rever (ainda nenhuma o faz).
-- - Uma data mal escrita num pedido não parte o painel: as leituras de datas e números devolvem null em vez de erro.
-- Todas as vistas usam security_invoker: quem lê vê só o que as regras (RLS) das tabelas lhe deixam ver.

drop view if exists public.v_cobertura, public.v_tendencia, public.v_perdas, public.v_bloqueados, public.v_followups,
  public.v_carga, public.v_tempos, public.v_funil, public.v_atrasos, public.v_fila_humana, public.v_passos, public.v_itens,
  public.v_catalogo_passos, public.v_config;

-- ---------- Leituras seguras ----------

create or replace function public.data_de(t text)
returns date language plpgsql immutable as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return left(t, 10)::date;
exception when others then return null;
end $$;

create or replace function public.instante_de(t text)
returns timestamptz language plpgsql stable as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}' then return null; end if;
  return t::timestamptz;
exception when others then return null;
end $$;

create or replace function public.numero_de(t text)
returns numeric language plpgsql immutable as $$
begin
  if t is null or btrim(t) = '' then return null; end if;
  return replace(btrim(t), ',', '.')::numeric;
exception when others then return null;
end $$;

-- ---------- Calendário ----------

create or replace function public.pascoa(ano int)
returns date language sql immutable as $$
  with v as (
    select ano % 19 as a, ano / 100 as b, ano % 100 as c
  ), w as (
    select a, b, c, b / 4 as d, b % 4 as e, (b + 8) / 25 as f from v
  ), x as (
    select a, b, c, d, e, (b - f + 1) / 3 as g from w
  ), y as (
    select a, c, e, (19 * a + b - d - g + 15) % 30 as h from x
  ), z as (
    select a, h, (32 + 2 * e + 2 * (c / 4) - h - (c % 4)) % 7 as l from y
  ), m as (
    select h, l, (a + 11 * h + 22 * l) / 451 as mm from z
  )
  select make_date(ano, (h + l - 7 * mm + 114) / 31, ((h + l - 7 * mm + 114) % 31) + 1) from m;
$$;

create or replace function public.dia_util(dia date)
returns boolean language sql immutable as $$
  select extract(isodow from dia) < 6
    and to_char(dia, 'MM-DD') not in ('01-01','04-25','05-01','06-10','06-13','08-15','10-05','11-01','12-01','12-08','12-25')
    and dia not in (public.pascoa(extract(year from dia)::int) - 2, public.pascoa(extract(year from dia)::int), public.pascoa(extract(year from dia)::int) + 60);
$$;

-- Horas úteis entre dois instantes (hora de Lisboa, 9h às 18h). 0 se b não for depois de a.
create or replace function public.horas_uteis(a timestamptz, b timestamptz)
returns numeric language sql stable as $$
  select coalesce(sum(greatest(0, extract(epoch from (
           least(b at time zone 'Europe/Lisbon', x.d + time '18:00') - greatest(a at time zone 'Europe/Lisbon', x.d + time '09:00')
         )) / 3600.0)), 0)::numeric
  from generate_series((a at time zone 'Europe/Lisbon')::date, (b at time zone 'Europe/Lisbon')::date, interval '1 day') g(d0),
       lateral (select d0::date::timestamp as d) x
  where a is not null and b is not null and b > a and public.dia_util(d0::date);
$$;

-- O n-ésimo dia útil depois de «dia».
create or replace function public.mais_dias_uteis(dia date, n int)
returns date language sql immutable as $$
  select d from (
    select x.d, row_number() over (order by x.d) as k
    from generate_series(dia + 1, dia + 30 + n * 2, interval '1 day') g(dd), lateral (select dd::date as d) x
    where public.dia_util(x.d)
  ) t where k = n;
$$;

-- ---------- Configuração ----------

create or replace function public.prazos_padrao()
returns jsonb language sql immutable as $$
  select '{"novo":{"P1":4,"P2":9,"P3":18},"visita_por_marcar":{"P1":1,"P2":2,"P3":3},"orcamento_por_fazer":{"P1":1,"P2":2,"P3":3},
           "espera_cliente":{"P1":3,"P2":5,"P3":7},"espera_fornecedor":{"P1":3,"P2":5,"P3":10},"em_execucao":{"P1":2,"P2":10,"P3":15},
           "por_faturar":{"P1":2,"P2":2,"P3":2},"faturado":{"P1":30,"P2":30,"P3":30}}'::jsonb;
$$;

-- Prazo de um estado para uma prioridade (horas para «novo»; dias úteis ou de calendário para os outros).
create or replace function public.prazo_de(prazos jsonb, estado text, p text)
returns numeric language sql immutable as $$
  select public.numero_de(prazos -> estado ->> coalesce(p, 'P3'));
$$;

create view public.v_config with (security_invoker = true) as
  select coalesce(public.numero_de(c.valor ->> 'limiteDono')::int, 7) as limite_dono,
         coalesce((c.valor ->> 'provisorio')::boolean, true) as sla_provisorio,
         public.prazos_padrao() || coalesce(c.valor -> 'valores', '{}'::jsonb) as prazos
  from (select 1) um left join public.config c on c.chave = 'prazos';

-- ---------- Os 12 passos ----------

-- estado_principal: o estado cujo prazo (config) é o SLA de referência do passo; tem_estado: o registo tem onde guardar
-- itens deste passo.
create view public.v_catalogo_passos with (security_invoker = true) as
  select * from (values
    (1,  'Pedido',              'Responder e decidir o caminho', true,  'novo'),
    (2,  'Marcar visita',       'Abrir a PAT e marcar a visita', true,  'visita_por_marcar'),
    (3,  'Folha pré-visita',    'Preparar e confirmar a visita', true,  null),
    (4,  'Levantamento',        'Entregar a folha da visita', true,     null),
    (5,  'Orçamento',           'Fazer e enviar o orçamento', true,     'orcamento_por_fazer'),
    (6,  'Seguimento',          'Ligar ao cliente', true,               'espera_cliente'),
    (7,  'Encomenda',           'Adjudicar e encomendar', true,         'em_execucao'),
    (8,  'Preparar instalação', 'Material, data e equipa', true,        'em_execucao'),
    (9,  'RI',                  'Instalar e trazer o RI assinado', true, 'em_execucao'),
    (10, 'Faturar',             'Emitir a fatura e registar o número', true, 'por_faturar'),
    (11, 'Cobrar',              'Confirmar o pagamento', true,          'faturado'),
    (12, 'Contratos',           'Aprovar as visitas do contrato', false, null)
  ) as t(passo, nome, acao_padrao, tem_estado, estado_principal);

-- Passo de um pedido (null = fechado). As pausas contam no passo de onde vieram.
create or replace function public.passo_de(d jsonb, hoje date)
returns int language plpgsql stable as $$
declare
  e text := d ->> 'estado';
  o jsonb := coalesce(d -> 'obra', '{}'::jsonb);
begin
  if e = 'novo' then return 1;
  elsif e = 'visita_por_marcar' then return 2;
  elsif e = 'visita_marcada' then
    return case when public.data_de(d ->> 'dataVisita') < hoje then 4 else 3 end;
  elsif e = 'orcamento_por_fazer' then return 5;
  elsif e in ('espera_cliente', 'espera_fornecedor') then
    if e = 'espera_cliente' and coalesce(d ->> 'esperaMotivo', 'decisao') = 'decisao' then return 6; end if;
    if nullif(d ->> 'esperaDe', '') is not null and d ->> 'esperaDe' not in ('espera_cliente', 'espera_fornecedor') then
      return public.passo_de(jsonb_set(d, '{estado}', to_jsonb(d ->> 'esperaDe')), hoje);
    end if;
    return case when e = 'espera_cliente' then 1 else 7 end;
  elsif e = 'em_execucao' then
    if public.data_de(o ->> 'adjudicadoEm') is null or public.data_de(o ->> 'encomendadoEm') is null then return 7; end if;
    if public.data_de(o ->> 'dataInstalacao') <= hoje then return 9; end if;
    return 8;
  elsif e = 'por_faturar' then return 10;
  elsif e = 'faturado' then return 11;
  end if;
  return null;
end $$;

-- À espera de quem, antes do relógio: input (uma pessoa tem de fazer), revisao (há um rascunho para rever), maquina (uma
-- automação está a trabalhar; ainda nenhuma), externo (cliente ou fornecedor, até ao dia da próxima ação). Em v_itens,
-- um «externo» com o prazo passado passa a «input»: é altura de alguém insistir.
create or replace function public.aguarda_de(d jsonb, hoje date)
returns text language sql stable as $$
  select case
    when d ->> 'aguarda' in ('revisao', 'maquina') then d ->> 'aguarda'
    when d ->> 'estado' in ('espera_cliente', 'espera_fornecedor', 'faturado')
         and coalesce(public.data_de(d ->> 'dataProximaAcao') > hoje, true) then 'externo'
    else 'input'
  end;
$$;

-- ---------- Base: um pedido aberto por linha, com o relógio ----------

create view public.v_itens with (security_invoker = true) as
with base as (
  select p.id, p.dados as d,
         (now() at time zone 'Europe/Lisbon')::date as hoje, now() as agora,
         cfg.prazos, cfg.sla_provisorio
  from public.pedidos p cross join public.v_config cfg
  where coalesce(p.dados ->> 'estado', '') not in ('resolvido', 'perdido')
), r as (
  select b.*,
         d ->> 'estado' as estado,
         coalesce(nullif(d ->> 'prioridade', ''), 'P3') as prioridade,
         coalesce((d ->> 'porConfirmar')::boolean, false) as por_confirmar,
         coalesce((d ->> 'escalado')::boolean, false) as escalado,
         public.instante_de(d ->> 'entrouNoEstado') as desde,
         coalesce(public.instante_de(d ->> 'ultimoSeguimento'), public.instante_de(d ->> 'entrouNoEstado')) as base_seg,
         public.prazo_de(b.prazos, d ->> 'estado', coalesce(nullif(d ->> 'prioridade', ''), 'P3')) as prazo,
         public.data_de(d ->> 'dataVisita') as data_visita
  from base b
), relogio as (
  select r.*,
    case
      when por_confirmar or desde is null then null
      when estado = 'visita_marcada' then
        case when data_visita is null then null
             else public.horas_uteis(((public.mais_dias_uteis(data_visita, 1) + time '18:00') at time zone 'Europe/Lisbon'), agora) end
      when prazo is null then null
      when estado in ('espera_cliente', 'faturado') then
        greatest(0, extract(epoch from (agora - (base_seg + make_interval(days => prazo::int)))) / 3600.0)
      when estado = 'espera_fornecedor' then
        greatest(0, public.horas_uteis(base_seg, agora) - prazo * 9)
      when estado = 'novo' then
        greatest(0, coalesce(public.numero_de(d ->> 'acumuladoH'), 0) + public.horas_uteis(desde, agora) - prazo)
      else
        greatest(0, coalesce(public.numero_de(d ->> 'acumuladoH'), 0) + public.horas_uteis(desde, agora) - prazo * 9)
    end as atraso_h
  from r
)
select id,
       d ->> 'cliente' as cliente,
       estado,
       public.passo_de(d, hoje) as passo,
       (estado = 'em_execucao' and not (d ? 'obra')) as passo_incerto,
       case when public.aguarda_de(d, hoje) = 'externo' and coalesce(atraso_h, 0) > 0 then 'input'
            else public.aguarda_de(d, hoje) end as aguarda,
       prioridade,
       case when not escalado and not por_confirmar and prioridade <> 'P1' and coalesce(atraso_h, 0) > 0
                 and estado in ('novo','visita_por_marcar','visita_marcada','orcamento_por_fazer','em_execucao','por_faturar')
            then case prioridade when 'P3' then 'P2' else 'P1' end
            else prioridade end as prioridade_efetiva,
       nullif(d ->> 'dono', '') as dono,
       exists (select 1 from public.colaboradores c
               where lower(btrim(c.nome)) = lower(btrim(d ->> 'dono'))
                 and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))) as e_meu,
       nullif(d ->> 'proximaAcao', '') as acao,
       public.data_de(d ->> 'dataProximaAcao') as data_acao,
       desde,
       round(public.horas_uteis(desde, agora), 1) as horas_uteis_espera,
       por_confirmar,
       prazo,
       coalesce(atraso_h, 0) > 0 as atrasado,
       round(coalesce(atraso_h, 0), 1) as atraso_h,
       sla_provisorio,
       estado in ('novo','visita_por_marcar','visita_marcada','orcamento_por_fazer','em_execucao','por_faturar') as bola_mdm,
       public.numero_de(d ->> 'valor') as valor,
       nullif(d ->> 'num', '') as num,
       nullif(d ->> 'origem', '') as origem,
       public.data_de(d ->> 'dataPedido') as data_pedido,
       coalesce(public.numero_de(d ->> 'seguimentos')::int, 0) as seguimentos,
       d ->> 'esperaMotivo' as espera_motivo,
       data_visita
from relogio;

-- ---------- As vistas do Painel ----------

-- Itens abertos por passo, divididos por «à espera de quem», com donos e horas de espera.
create view public.v_passos with (security_invoker = true) as
with i as (select * from public.v_itens),
por_dono as (
  select passo, jsonb_object_agg(dono, n) as donos
  from (select passo, coalesce(dono, 'Sem dono') as dono, count(*) as n from i group by 1, 2) x group by passo
)
select c.passo, c.nome, c.acao_padrao, c.tem_estado,
       count(i.id) as n_total,
       count(i.id) filter (where i.aguarda = 'input') as n_input,
       count(i.id) filter (where i.aguarda = 'revisao') as n_revisao,
       count(i.id) filter (where i.aguarda = 'maquina') as n_maquina,
       count(i.id) filter (where i.aguarda = 'externo') as n_externo,
       count(i.id) filter (where i.atrasado) as n_atrasados,
       count(i.id) filter (where i.por_confirmar) as n_por_confirmar,
       count(i.id) filter (where i.passo_incerto) as n_incerto,
       coalesce(max(pd.donos::text)::jsonb, '{}'::jsonb) as donos,
       max(i.horas_uteis_espera) as horas_espera_max,
       round(percentile_cont(0.5) within group (order by i.horas_uteis_espera)::numeric, 1) as horas_espera_mediana,
       -- registado: há ou já houve itens neste passo (agora, no registo de eventos, ou nos campos que o passo usa).
       -- Falso = «ainda não registado», que o painel mostra a cinzento em vez de um zero.
       c.tem_estado and (count(i.id) > 0
         or exists (select 1 from public.eventos e
                    where public.passo_de(jsonb_build_object('estado', e.estado), current_date) = c.passo)
         or (c.passo in (3, 4) and exists (select 1 from public.pedidos p where public.data_de(p.dados ->> 'dataVisita') is not null))
         or (c.passo in (7, 8, 9) and exists (select 1 from public.pedidos p where p.dados ? 'obra' or public.data_de(p.dados ->> 'dataAceite') is not null))
         or (c.passo in (10, 11) and exists (select 1 from public.pedidos p where nullif(p.dados ->> 'fatura', '') is not null))
       ) as registado
from public.v_catalogo_passos c
left join i on i.passo = c.passo
left join por_dono pd on pd.passo = c.passo
group by c.passo, c.nome, c.acao_padrao, c.tem_estado;

-- Tudo o que espera por uma pessoa (input ou revisão). A página ordena por ordem_prioridade e desde.
create view public.v_fila_humana with (security_invoker = true) as
select i.id, i.cliente, i.passo, c.nome as passo_nome,
       coalesce(i.acao, c.acao_padrao) as acao, i.acao is null as acao_em_falta,
       i.aguarda, i.dono, i.e_meu, i.desde, i.data_acao,
       i.data_acao < (now() at time zone 'Europe/Lisbon')::date as acao_atrasada,
       i.prioridade, i.prioridade_efetiva, substr(i.prioridade_efetiva, 2)::int as ordem_prioridade,
       i.atrasado, i.atraso_h, i.por_confirmar, i.passo_incerto
from public.v_itens i join public.v_catalogo_passos c on c.passo = i.passo
where i.aguarda in ('input', 'revisao');

-- Atrasados por passo e prioridade (SLA de config; «por confirmar» não conta).
create view public.v_atrasos with (security_invoker = true) as
select c.passo, c.nome, pr.prioridade,
       count(i.id) as n_abertos,
       count(i.id) filter (where i.atrasado) as n_atrasados,
       count(i.id) filter (where i.por_confirmar) as n_sem_relogio,
       (select sla_provisorio from public.v_config) as sla_provisorio
from public.v_catalogo_passos c
cross join (values ('P1'), ('P2'), ('P3')) pr(prioridade)
left join public.v_itens i on i.passo = c.passo and i.prioridade = pr.prioridade
group by c.passo, c.nome, pr.prioridade;

-- Funil por mês do pedido: pedido, visita, orçamento enviado, aceite, perdido. Aceite (ou perdido com n.º de orçamento)
-- conta como orçamento enviado, para as percentagens não passarem de 100.
create view public.v_funil with (security_invoker = true) as
with p as (
  select coalesce(public.data_de(dados ->> 'dataPedido'), (public.instante_de(dados ->> 'criado') at time zone 'Europe/Lisbon')::date) as dia,
         public.data_de(dados ->> 'dataPedido') is null as sem_data_pedido,
         public.data_de(dados ->> 'dataVisita') is not null as com_visita,
         public.data_de(dados ->> 'dataAceite') is not null as aceite,
         dados ->> 'estado' = 'perdido' as perdido,
         nullif(dados ->> 'num', '') is not null as com_num,
         public.data_de(dados ->> 'dataEnvio') is not null or coalesce((dados ->> 'envioConfirmado')::boolean, false) as com_envio
  from public.pedidos
), q as (
  select *, (com_num and com_envio) or aceite or (perdido and com_num) as orcamento_enviado from p
)
select to_char(date_trunc('month', dia), 'YYYY-MM') as mes,
       count(*) as pedidos,
       count(*) filter (where sem_data_pedido) as sem_data_pedido,
       count(*) filter (where com_visita) as visitas,
       count(*) filter (where orcamento_enviado) as orcamentos_enviados,
       count(*) filter (where aceite) as aceites,
       count(*) filter (where perdido) as perdidos,
       round(100.0 * count(*) filter (where com_visita) / nullif(count(*), 0), 1) as pct_visita,
       round(100.0 * count(*) filter (where orcamento_enviado) / nullif(count(*), 0), 1) as pct_orcamento,
       round(100.0 * count(*) filter (where aceite) / nullif(count(*) filter (where orcamento_enviado), 0), 1) as pct_aceite_sobre_enviados,
       round(100.0 * count(*) filter (where perdido) / nullif(count(*) filter (where aceite or perdido), 0), 1) as pct_perdido_sobre_decididos
from q where dia is not null
group by 1;

-- Dias medianos por passo (do registo de eventos: cada gravação regista o estado) e do pedido à fatura.
create view public.v_tempos with (security_invoker = true) as
with ev as (
  select e.pedido_id, e.estado, e.em,
         lead(e.em) over (partition by e.pedido_id order by e.em, e.id) as ate,
         lead(e.estado) over (partition by e.pedido_id order by e.em, e.id) as estado_seguinte
  from public.eventos e where e.estado is not null
), dur as (
  select public.passo_de(jsonb_build_object('estado', ev.estado), (ev.em at time zone 'Europe/Lisbon')::date) as passo,
         extract(epoch from (ev.ate - ev.em)) / 86400.0 as dias
  from ev where ev.ate is not null and ev.estado_seguinte is distinct from ev.estado
), fat as (
  select public.data_de(dados ->> 'dataFatura')
         - coalesce(public.data_de(dados ->> 'dataPedido'), (public.instante_de(dados ->> 'criado') at time zone 'Europe/Lisbon')::date) as dias
  from public.pedidos where public.data_de(dados ->> 'dataFatura') is not null
)
select c.passo, c.nome,
       count(dur.dias) as n_amostras,
       round(percentile_cont(0.5) within group (order by dur.dias)::numeric, 1) as dias_mediana,
       public.prazo_de(cfg.prazos, c.estado_principal, 'P1') as sla_p1,
       public.prazo_de(cfg.prazos, c.estado_principal, 'P2') as sla_p2,
       public.prazo_de(cfg.prazos, c.estado_principal, 'P3') as sla_p3,
       case when c.estado_principal is null then null when c.estado_principal = 'novo' then 'horas úteis'
            when c.estado_principal in ('espera_cliente', 'faturado') then 'dias' else 'dias úteis' end as sla_unidade,
       case c.passo when 3 then 'a data da visita' when 4 then 'até ao dia útil seguinte à visita' end as sla_texto,
       cfg.sla_provisorio,
       (select count(*) from fat) as n_faturados,
       (select round(percentile_cont(0.5) within group (order by fat.dias)::numeric, 1) from fat) as dias_pedido_fatura_mediana
from public.v_catalogo_passos c cross join public.v_config cfg left join dur on dur.passo = c.passo
group by c.passo, c.nome, c.estado_principal, cfg.prazos, cfg.sla_provisorio;

-- Carga por dono: pedidos com a bola na MDM contra o limite.
create view public.v_carga with (security_invoker = true) as
select coalesce(i.dono, 'Sem dono') as dono,
       count(*) as abertos,
       count(*) filter (where i.bola_mdm) as bola_mdm,
       count(*) filter (where not i.bola_mdm) as em_espera,
       count(*) filter (where i.atrasado) as atrasados,
       (select limite_dono from public.v_config) as limite,
       count(*) filter (where i.bola_mdm) > (select limite_dono from public.v_config) as acima_limite
from public.v_itens i group by 1;

-- Seguimentos (dias 3, 5 e 7 pela prioridade) e cobranças devidos hoje ou em atraso.
create view public.v_followups with (security_invoker = true) as
with s as (
  select p.id, p.dados as d,
         coalesce(public.instante_de(p.dados ->> 'ultimoSeguimento'), public.instante_de(p.dados ->> 'entrouNoEstado')) as base,
         public.prazo_de(cfg.prazos, p.dados ->> 'estado', coalesce(nullif(p.dados ->> 'prioridade', ''), 'P3')) as prazo
  from public.pedidos p cross join public.v_config cfg
  where (p.dados ->> 'estado' = 'espera_cliente' and coalesce(p.dados ->> 'esperaMotivo', 'decisao') = 'decisao')
     or p.dados ->> 'estado' = 'faturado'
), t as (
  select s.*, (base at time zone 'Europe/Lisbon')::date + prazo::int as devido_em from s where base is not null and prazo is not null
)
select id, d ->> 'cliente' as cliente, nullif(d ->> 'dono', '') as dono,
       case when d ->> 'estado' = 'faturado' then 'cobranca' else 'seguimento' end as tipo,
       coalesce(public.numero_de(d ->> 'seguimentos')::int, 0) + 1 as numero,
       coalesce(nullif(d ->> 'prioridade', ''), 'P3') as prioridade,
       devido_em,
       (now() at time zone 'Europe/Lisbon')::date - devido_em as dias_atraso,
       nullif(d ->> 'num', '') as num, public.numero_de(d ->> 'valor') as valor,
       coalesce((d ->> 'porConfirmar')::boolean, false) as por_confirmar
from t
where devido_em <= (now() at time zone 'Europe/Lisbon')::date;

-- Bloqueados, para o scrum: o que não anda sem uma decisão. Um pedido pode ter mais de um motivo.
create view public.v_bloqueados with (security_invoker = true) as
select i.id, i.cliente, i.passo, i.dono, i.prioridade_efetiva, i.desde, m.motivo
from public.v_itens i
cross join lateral (values
  (case when i.dono is null or i.acao is null or i.data_acao is null then 'Sem dono, próxima ação ou data' end),
  (case when i.data_acao < (now() at time zone 'Europe/Lisbon')::date - 3 then 'Ação parada há mais de 3 dias' end),
  (case when i.estado = 'espera_fornecedor' and i.atrasado then 'Fornecedor sem resposta no prazo' end),
  (case when i.estado = 'espera_cliente' and i.seguimentos >= 3 then 'Três seguimentos sem resposta' end),
  (case when i.estado = 'visita_marcada' and i.data_visita is null then 'Visita marcada sem data' end),
  (case when i.passo_incerto then 'Em execução sem dados de obra' end)
) as m(motivo)
where m.motivo is not null;

-- Motivos de perda (todos e últimos 90 dias).
create view public.v_perdas with (security_invoker = true) as
select coalesce(nullif(dados ->> 'motivo', ''), 'Sem motivo') as motivo,
       count(*) as n_total,
       count(*) filter (where public.data_de(dados ->> 'dataFecho') >= (now() at time zone 'Europe/Lisbon')::date - 90) as n_90_dias,
       count(*) filter (where nullif(dados ->> 'num', '') is not null) as com_orcamento
from public.pedidos where dados ->> 'estado' = 'perdido'
group by 1;

-- Tendência dos últimos 30 dias: pedidos novos e fechados por dia.
create view public.v_tendencia with (security_invoker = true) as
with dias as (
  select g.d::date as dia
  from generate_series((now() at time zone 'Europe/Lisbon')::date - 29, (now() at time zone 'Europe/Lisbon')::date, interval '1 day') g(d)
), p as (
  select coalesce(public.data_de(dados ->> 'dataPedido'), (public.instante_de(dados ->> 'criado') at time zone 'Europe/Lisbon')::date) as entrada,
         public.data_de(dados ->> 'dataFecho') as fecho
  from public.pedidos
)
select dias.dia,
       (select count(*) from p where p.entrada = dias.dia) as novos,
       (select count(*) from p where p.fecho = dias.dia) as fechados
from dias;

-- Cobertura dos campos: quantos pedidos têm cada campo preenchido (para o painel não mostrar números enganadores).
create view public.v_cobertura with (security_invoker = true) as
select x.campo, count(*) filter (where x.preenchido) as preenchidos, count(*) as total
from public.pedidos p
cross join lateral (values
  ('valor', public.numero_de(p.dados ->> 'valor') is not null),
  ('origem', nullif(p.dados ->> 'origem', '') is not null),
  ('dataPedido', public.data_de(p.dados ->> 'dataPedido') is not null),
  ('num', nullif(p.dados ->> 'num', '') is not null),
  ('contacto', nullif(p.dados ->> 'contacto', '') is not null),
  ('dataVisita', public.data_de(p.dados ->> 'dataVisita') is not null),
  ('porConfirmar', coalesce((p.dados ->> 'porConfirmar')::boolean, false)),
  ('dataFatura', public.data_de(p.dados ->> 'dataFatura') is not null),
  ('obra', p.dados ? 'obra')
) as x(campo, preenchido)
group by x.campo
union all
select 'eventos', count(*), count(*) from public.eventos;

-- Só a equipa autorizada lê as vistas (as regras das tabelas aplicam-se por baixo, via security_invoker).
do $$
declare v text;
begin
  foreach v in array array['v_config','v_catalogo_passos','v_itens','v_passos','v_fila_humana','v_atrasos','v_funil','v_tempos',
                            'v_carga','v_followups','v_bloqueados','v_perdas','v_tendencia','v_cobertura'] loop
    execute format('revoke all on public.%I from anon, public', v);
    execute format('grant select on public.%I to authenticated', v);
  end loop;
  -- as funções auxiliares não ficam abertas a visitantes sem sessão (a API do Supabase expõe as funções de public)
  foreach v in array array['data_de(text)','instante_de(text)','numero_de(text)','pascoa(int)','dia_util(date)',
                            'horas_uteis(timestamptz,timestamptz)','mais_dias_uteis(date,int)','prazos_padrao()',
                            'prazo_de(jsonb,text,text)','passo_de(jsonb,date)','aguarda_de(jsonb,date)'] loop
    execute format('revoke all on function public.%s from anon, public', v);
    execute format('grant execute on function public.%s to authenticated', v);
  end loop;
end $$;
