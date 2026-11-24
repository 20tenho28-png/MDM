-- Espelho da caixa de correio oficial (só leitura). Aplicar uma vez, à mão, no SQL Editor do Supabase.
-- Só acrescenta: duas tabelas novas, não toca nas existentes. Para desfazer: drop table public.correio, public.correio_estado.
--
-- Quem escreve: só a função agendada do Netlify (netlify/functions/correio-espelho.mts), com a chave de serviço, que
-- passa por cima das regras abaixo. Quem lê: os colaboradores com conta no registo. Ninguém escreve pelo browser,
-- exceto os dois campos que a equipa preenche ao confirmar uma mensagem (classificacao e pedido_id).

create table if not exists public.correio (
  id bigserial primary key,
  pasta text not null default 'INBOX',
  uid bigint not null,
  message_id text,
  de_nome text,
  de_email text,
  assunto text,
  recebido_em timestamptz,
  resumo text,
  em_resposta_a text,
  classificacao text check (classificacao in ('cliente', 'fornecedor', 'interno', 'ruido', 'duvida')),
  pedido_id text references public.pedidos (id) on delete set null,
  classificado_por text,
  classificado_em timestamptz,
  criado timestamptz not null default now(),
  unique (pasta, uid)
);

create index if not exists correio_recebido_idx on public.correio (recebido_em desc);
create index if not exists correio_por_classificar_idx on public.correio (recebido_em desc) where classificacao is null;

create table if not exists public.correio_estado (
  pasta text primary key,
  uidvalidity bigint,
  ultimo_uid bigint not null default 0,
  atualizado timestamptz not null default now()
);

alter table public.correio enable row level security;
alter table public.correio_estado enable row level security;

drop policy if exists "correio: ler" on public.correio;
create policy "correio: ler" on public.correio
  for select to authenticated
  using (public.autorizado());

drop policy if exists "correio: classificar" on public.correio;
create policy "correio: classificar" on public.correio
  for update to authenticated
  using (public.autorizado()) with check (public.autorizado());

-- O browser só pode mudar a classificação e a ligação ao pedido; o resto da mensagem fica como chegou.
revoke update on public.correio from authenticated;
grant update (classificacao, pedido_id, classificado_por, classificado_em) on public.correio to authenticated;
revoke all on public.correio_estado from anon, authenticated;
