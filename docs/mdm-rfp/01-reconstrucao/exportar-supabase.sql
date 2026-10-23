-- Correr no SQL Editor do projeto Supabase da MDM. Descarregar cada resultado como CSV.
-- 1) pedidos.csv
select
  id,
  dados ->> 'num'            as num,
  dados ->> 'cliente'        as cliente,
  dados ->> 'tipo'           as tipo,
  dados ->> 'origem'         as origem,
  dados ->> 'estado'         as estado,
  dados ->> 'prioridade'     as prioridade,
  dados ->> 'dono'           as dono,
  dados ->> 'dataPedido'     as data_pedido,
  dados ->> 'dataVisita'     as data_visita,
  dados ->> 'dataEnvio'      as data_envio,
  dados ->> 'dataAceite'     as data_aceite,
  dados ->> 'dataFecho'      as data_fecho,
  dados ->> 'motivo'         as motivo,
  dados ->> 'valor'          as valor,
  (dados ->> 'porConfirmar')::boolean as por_confirmar,
  dados ->> 'criado'         as criado
from public.pedidos
order by (dados ->> 'criado');

-- 2) eventos.csv
select id, pedido_id, em, por, texto, estado, prioridade
from public.eventos
order by em;
