-- Tabela de leads do site MDM (faixa de orçamento + formulário).
-- RLS ligado e sem políticas públicas: só a edge function (service role) escreve;
-- lê-se no painel Supabase (Table Editor → leads) ou por SQL.
create table if not exists public.leads (
  id          bigint generated always as identity primary key,
  criado_em   timestamptz not null default now(),
  origem      text not null,            -- 'faixa-orcamento' | 'formulario'
  nome        text,
  email       text,
  telefone    text,
  servico     text,
  mensagem    text,
  pagina      text,
  referrer    text,
  utm         text,
  ip          inet,
  user_agent  text
);
alter table public.leads enable row level security;
create index if not exists leads_criado_em_idx on public.leads (criado_em desc);
