-- Papéis no registo (passo 2 do plano do tablet, 2026-11): chefe, escritório e técnico.
-- Corre-se uma vez no SQL Editor do projeto Supabase da MDM, depois de migracao.sql. Pode correr outra vez sem estragar.
--
-- O que muda:
-- * colaboradores ganha a coluna «papel». Quem já lá está fica «escritorio», que é o que tem hoje: nada muda até alguém
--   ser marcado «tecnico».
-- * Um técnico continua a ler e mudar os pedidos e os clientes (precisa deles na rua), mas a base de dados deixa de lhe
--   dar a faturação (SAF-T) nem, em config, os objetivos de faturação. A tabela de preços do orçamento continua à vista
--   (só tem preços de venda, e o técnico precisa dela para orçamentar no local).
-- * Mudar as chaves de config (prazos, seguimentos, agenda, objetivos, preços…) fica para o chefe e o escritório; o
--   técnico só avança o contador dos números de orçamento.
-- O resto (margens e custos da folha de obra, números do negócio) esconde-se na página.

alter table public.colaboradores add column if not exists papel text not null default 'escritorio';
alter table public.colaboradores drop constraint if exists colaboradores_papel_chk;
alter table public.colaboradores add constraint colaboradores_papel_chk check (papel in ('chefe', 'escritorio', 'tecnico'));

-- O papel de quem tem a sessão aberta (null se não estiver em colaboradores).
create or replace function public.papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select c.papel from public.colaboradores c
  where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;
revoke all on function public.papel() from public;
grant execute on function public.papel() to authenticated;

-- Autorizado e não técnico: chefe ou escritório.
create or replace function public.do_escritorio()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.papel() in ('chefe', 'escritorio'), false);
$$;
revoke all on function public.do_escritorio() from public;
grant execute on function public.do_escritorio() to authenticated;

-- Faturação: só chefe e escritório.
drop policy if exists "faturacao: colaboradores" on public.faturacao;
drop policy if exists "faturacao: escritorio" on public.faturacao;
create policy "faturacao: escritorio" on public.faturacao
  for all to authenticated
  using (public.do_escritorio()) with check (public.do_escritorio());

-- Config: todos leem, menos as chaves de dinheiro para o técnico; só chefe e escritório escrevem.
drop policy if exists "config: colaboradores" on public.config;
drop policy if exists "config: ler" on public.config;
drop policy if exists "config: escrever" on public.config;
drop policy if exists "config: mudar" on public.config;
drop policy if exists "config: apagar" on public.config;
create policy "config: ler" on public.config
  for select to authenticated
  using (public.autorizado() and (public.do_escritorio() or chave <> 'objetivos'));
-- O contador dos números de orçamento é a exceção: um técnico que faça o PDF de um orçamento no local avança-o.
create policy "config: escrever" on public.config
  for insert to authenticated with check (public.do_escritorio() or (public.autorizado() and chave = 'orcamento_numero'));
create policy "config: mudar" on public.config
  for update to authenticated
  using (public.do_escritorio() or (public.autorizado() and chave = 'orcamento_numero'))
  with check (public.do_escritorio() or (public.autorizado() and chave = 'orcamento_numero'));
create policy "config: apagar" on public.config
  for delete to authenticated using (public.do_escritorio());
