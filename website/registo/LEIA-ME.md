# Registo de pedidos e orçamentos (equipa, uso interno)

Página interna em `/registo/` (https://www.mdmassist.pt/registo/): os pedidos de clientes do primeiro contacto à fatura, com os 9 estados, dono e próxima ação, relógio de prazos, triagem diária e exportação em CSV. Vários colaboradores ao mesmo tempo, com as mudanças a aparecer em tempo real.

- `index.html`: a app, um só ficheiro, sem build. Usa `@supabase/supabase-js` (CDN) e as letras do Google.
- `supabase/migracao.sql`: tabelas (`pedidos`, `config`, `eventos`, `colaboradores`), permissões (só quem está em `colaboradores` lê e escreve) e as funções `guardar_pedido` (com controlo de versão) e `apagar_pedido`. Corre-se uma vez no SQL Editor do projeto Supabase da MDM.
- Os dados (pedidos, clientes) vivem no Supabase e **nunca entram no repositório** (`.gitignore` guarda `dados*.sql`).

Entrar: email e palavra-passe criados no Supabase (Authentication, Users) e o email na tabela `colaboradores`, com o nome que aparece como dono. Tirar o acesso: apagar a linha em `colaboradores`.

`publica.py` copia esta pasta para `public/registo/` sem este ficheiro nem `supabase/`; o `netlify.toml` põe `/registo/*` fora dos motores de busca e sem cache, como `/equipa/*`.
