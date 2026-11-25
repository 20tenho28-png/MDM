-- Funil de pedidos por mês e canal de entrada (Telefone, WhatsApp, Presencial, Site).
-- Já aplicado em produção a 25/11/2026 (migração v_funil_canal_leads). Só lê: não muda tabelas nem outras vistas.
-- Lê a origem que o registo grava no pedido novo (obrigatória desde este PR) e junta valores soltos no canal certo.

create or replace function public.origem_canal(t text) returns text
language sql immutable set search_path to 'public' as $$
  select case
    when nullif(btrim(coalesce(t,'')),'') is null then 'sem_origem'
    when lower(t) like '%whats%' then 'whatsapp'
    when lower(t) ~ '(site|web|form|imap|email|e-mail|mail)' then 'site'
    when lower(t) ~ '(telef|chamada|call|tlm|movel|móvel|fixo)' then 'telefone'
    when lower(t) ~ '(presencial|balc|walk|loja|escrit)' then 'presencial'
    else 'outro' end
$$;

create or replace view public.v_funil_canal with (security_invoker = true) as
with p as (
  select origem_canal(dados->>'origem') as canal,
    coalesce(data_de(dados->>'dataPedido'), ((instante_de(dados->>'criado') at time zone 'Europe/Lisbon'))::date) as dia,
    instante_de(dados->>'criado') as entrada,
    instante_de(dados->>'ultimoContacto') as primeiro_contacto,
    data_de(dados->>'dataVisita') is not null as com_visita,
    data_de(dados->>'dataAceite') is not null as aceite,
    (dados->>'estado') = 'perdido' as perdido,
    nullif(dados->>'num','') is not null as com_num,
    (data_de(dados->>'dataEnvio') is not null or coalesce((dados->>'envioConfirmado')::boolean,false)) as com_envio,
    pagamento_data is not null as pago
  from pedidos
), q as (
  select *, ((com_num and com_envio) or aceite or (perdido and com_num)) as orcamento_enviado from p
)
select to_char(date_trunc('month', dia::timestamptz),'YYYY-MM') as mes,
  canal,
  count(*) as pedidos,
  count(*) filter (where com_visita) as visitas,
  count(*) filter (where orcamento_enviado) as orcamentos_enviados,
  count(*) filter (where aceite) as aceites,
  count(*) filter (where pago) as pagos,
  count(*) filter (where perdido) as perdidos,
  round(100.0*count(*) filter (where aceite)/nullif(count(*),0),1) as pct_pedido_aceite,
  round(avg(extract(epoch from (primeiro_contacto-entrada))/3600.0) filter (where primeiro_contacto >= entrada),1) as horas_ate_contacto,
  count(*) filter (where primeiro_contacto is null) as sem_contacto_registado
from q where dia is not null
group by 1,2;
