-- Registo de pedidos e orçamentos da MDM (22/10/2026)
-- Três tabelas e uma lista de colaboradores autorizados. Só quem está em colaboradores lê e escreve.

create table if not exists public.colaboradores (
  email text primary key,
  nome text,
  criado timestamptz not null default now()
);

create table if not exists public.pedidos (
  id text primary key,
  dados jsonb not null,
  versao integer not null default 1,
  atualizado timestamptz not null default now(),
  atualizado_por text
);

create table if not exists public.config (
  chave text primary key,
  valor jsonb not null,
  versao integer not null default 1,
  atualizado timestamptz not null default now(),
  atualizado_por text
);

-- Registo só de acrescentar: cada mudança gravada, por quem e quando.
create table if not exists public.eventos (
  id bigserial primary key,
  pedido_id text not null,
  em timestamptz not null default now(),
  por text,
  texto text not null,
  estado text,
  prioridade text
);
create index if not exists eventos_pedido_idx on public.eventos (pedido_id, em);

-- Quem está autorizado: o email da sessão tem de estar em colaboradores.
create or replace function public.autorizado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.colaboradores c
    where lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.autorizado() from public;
grant execute on function public.autorizado() to authenticated;

alter table public.colaboradores enable row level security;
alter table public.pedidos enable row level security;
alter table public.config enable row level security;
alter table public.eventos enable row level security;

drop policy if exists "colaboradores: ver a própria conta" on public.colaboradores;
create policy "colaboradores: ver a própria conta" on public.colaboradores
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) or public.autorizado());

drop policy if exists "pedidos: colaboradores" on public.pedidos;
create policy "pedidos: colaboradores" on public.pedidos
  for all to authenticated
  using (public.autorizado()) with check (public.autorizado());

drop policy if exists "config: colaboradores" on public.config;
create policy "config: colaboradores" on public.config
  for all to authenticated
  using (public.autorizado()) with check (public.autorizado());

drop policy if exists "eventos: ler" on public.eventos;
create policy "eventos: ler" on public.eventos
  for select to authenticated using (public.autorizado());
drop policy if exists "eventos: acrescentar" on public.eventos;
create policy "eventos: acrescentar" on public.eventos
  for insert to authenticated with check (public.autorizado());

-- Guardar um pedido com controlo de versão: se outra pessoa gravou entretanto, falha com «conflito».
create or replace function public.guardar_pedido(p_id text, p_dados jsonb, p_versao integer, p_evento text default null)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nova integer;
  v_email text := auth.jwt() ->> 'email';
begin
  if not public.autorizado() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if p_versao = 0 then
    insert into public.pedidos (id, dados, versao, atualizado, atualizado_por)
      values (p_id, p_dados, 1, now(), v_email);
    v_nova := 1;
  else
    update public.pedidos
      set dados = p_dados, versao = versao + 1, atualizado = now(), atualizado_por = v_email
      where id = p_id and versao = p_versao
      returning versao into v_nova;
    if v_nova is null then
      raise exception 'conflito: o pedido % foi alterado entretanto', p_id using errcode = 'P0001';
    end if;
  end if;
  if p_evento is not null then
    insert into public.eventos (pedido_id, por, texto, estado, prioridade)
      values (p_id, v_email, p_evento, p_dados ->> 'estado', p_dados ->> 'prioridade');
  end if;
  return v_nova;
end;
$$;
revoke all on function public.guardar_pedido(text, jsonb, integer, text) from public;
grant execute on function public.guardar_pedido(text, jsonb, integer, text) to authenticated;

create or replace function public.apagar_pedido(p_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.autorizado() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  insert into public.eventos (pedido_id, por, texto)
    values (p_id, auth.jwt() ->> 'email', 'Pedido apagado');
  delete from public.pedidos where id = p_id;
end;
$$;
revoke all on function public.apagar_pedido(text) from public;
grant execute on function public.apagar_pedido(text) to authenticated;

-- Tempo real: a página ouve as mudanças nestas duas tabelas.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pedidos') then
    alter publication supabase_realtime add table public.pedidos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'config') then
    alter publication supabase_realtime add table public.config;
  end if;
end $$;

-- Faturação (SAF-T): um resumo por mês dos ficheiros DadosFat_AAAA-MM (faturas, notas de crédito e recibos), lido pela
-- página «Faturação» do registo. Só o que a página mostra: número, data, cliente, valores e a descrição; sem NIF, morada
-- nem contactos. Correr este bloco outra vez não estraga nada.
create table if not exists public.faturacao (
  mes text primary key,
  dados jsonb not null,
  atualizado timestamptz not null default now(),
  atualizado_por text
);
alter table public.faturacao enable row level security;
drop policy if exists "faturacao: colaboradores" on public.faturacao;
create policy "faturacao: colaboradores" on public.faturacao
  for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'faturacao') then
    alter publication supabase_realtime add table public.faturacao;
  end if;
end $$;

-- Fichas de cliente (separador «Clientes»): dados de contacto, equipamentos instalados, contrato de manutenção, notas e
-- as marcas «contactado» e «ignorar». A chave é o nome normalizado, a mesma que junta o cliente das faturas (SAF-T) ao dos
-- pedidos. Correr este bloco outra vez não estraga nada.
create table if not exists public.clientes (
  id text primary key,
  dados jsonb not null,
  versao integer not null default 1,
  atualizado timestamptz not null default now(),
  atualizado_por text
);
alter table public.clientes enable row level security;
drop policy if exists "clientes: colaboradores" on public.clientes;
create policy "clientes: colaboradores" on public.clientes
  for all to authenticated
  using (public.autorizado()) with check (public.autorizado());
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'clientes') then
    alter publication supabase_realtime add table public.clientes;
  end if;
end $$;
