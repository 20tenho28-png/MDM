-- Cálculo do orçamento (motor de preços, 2026-11): o que se escreve no cálculo de cada opção e não pode ficar nos
-- pedidos, porque um técnico lê os pedidos. São os custos da mão de obra e do material a mais, os custos do material da
-- manutenção, o equipamento escrito à mão (preço de tabela ou custo), a margem única, o valor final fixado, o total
-- pretendido com IVA e a 1.ª hora escrita à mão. O resto do cálculo (marca, gama, modelos, interiores, dias) e as linhas
-- do orçamento ficam no pedido, como até aqui.
-- Corre-se uma vez no SQL Editor do projeto Supabase da MDM, depois de papeis.sql (usa public.do_escritorio()). Pode
-- correr outra vez sem estragar. Sem esta tabela o registo funciona na mesma: o que se escreve no cálculo fica só no
-- aparelho onde se escreveu.

create table if not exists public.orcamento_calculo (
  pedido_id text primary key,
  -- {criado: o «criado» do pedido (um número apagado e reutilizado é outro pedido), v: a versão do orçamento,
  --  motores: {<id do cálculo de cada opção>: {extraMO, extraMat, mats, equipMan, margem, alvo, alvoIva, primeira}}}
  dados jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  atualizado_por text
);

-- Só o chefe e o escritório: a base de dados não dá nem deixa mudar estas linhas a um técnico (nem a quem não entrou).
alter table public.orcamento_calculo enable row level security;
drop policy if exists "orcamento_calculo: escritorio" on public.orcamento_calculo;
create policy "orcamento_calculo: escritorio" on public.orcamento_calculo
  for all to authenticated
  using (public.do_escritorio()) with check (public.do_escritorio());
revoke all on public.orcamento_calculo from anon;
grant select, insert, update, delete on public.orcamento_calculo to authenticated;
