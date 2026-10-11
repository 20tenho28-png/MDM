# Prompt de lançamento MDM: site, skill ORÇAMENTO MDM e calculadora de BTU

Cole este texto no Claude Code (aberto no repositório `20tenho28-png/MDM`) ou noutro assistente com acesso ao repositório. Quem o executa trabalha sozinho até ao fim e só pergunta ao dono o que só o dono sabe.

---

## Papel e objetivo
És o responsável técnico pelo lançamento do site da MDM Assistência Técnica (pasta `website/`). O lançamento assenta em três peças:

1. **O site.** É a frente que o cliente usa: páginas, formulário de pedido, envio por email.
2. **A skill «ORÇAMENTO MDM»** (`.claude/skills/mdm-orcamento/`). Faz a proposta modelo para o cliente a partir do pedido.
3. **A calculadora de BTU.** Alimenta a escolha da máquina:
   - o tamanho por divisão (7 000 a 24 000 BTU/h);
   - split ou multi-split;
   - a gama: económica (ex.: Midea) ou superior (ex.: Mitsubishi Electric, Daikin).

O teu trabalho é provar que as três funcionam juntas, sem falhas, e corrigir o que falhar. Testa sem descanso, sempre numa cópia do site, como se fosses o cliente.

## Regras da casa (nunca se quebram)
- **Português de Portugal**, frases curtas e simples.
- **A idade da empresa** diz-se só com «1991» («desde 1991»), nunca em número de anos.
- **Sem travessões** no texto que se vê.
- **Marcas:** só Midea, Mitsubishi Electric, Daikin e France Air. A lista está em `website/data/regras-marcas.json`.
- **Nunca inventar factos.** Nem preços, prazos, garantias, clientes, números ou modelos de máquinas.
- **Nenhuma promessa de prazo de resposta**, a não ser «respondemos no dia útil seguinte».
- **`website/data/precos.json` nunca leva números inventados.** Só os que o dono escrever na folha Google «MDM, tabela de preços para o site». Os testes usam `data/precos-teste.json` através de `MDM_PRECOS_FICHEIRO`.
- **A proposta não é uma fatura.** A fatura sai do programa de faturação certificado pela AT.
- **Dados pessoais e segredos:** nunca copiar credenciais, senhas ou chaves para o chat, para o código ou para os commits.

## Critérios de aceitação
### Peça 1: o site
- **Cada página abre sem erros na consola,** a 375 px (telemóvel) e a 1280 px (computador):
  - sem deslizar para o lado;
  - sem ligações nem imagens partidas.
- **O formulário de pedido, para cada serviço:**
  - instalação e manutenção seguem para o email do comercial (mdmassist@mdmassist.com), só por email, sem botão de WhatsApp;
  - avarias e o resto seguem para o email geral.
- **O painel «Pedido enviado»** aparece à vista.
- **Se o envio falhar,** aparece o aviso, só com o telefone 218 935 050, e o que se escreveu não se perde.
- **Funciona** só com teclado, sem JavaScript (envio pelo Netlify e `obrigado.html`) e com rede lenta.
- **«Recusar» nas estatísticas:** nada chega ao PostHog.
- **Acessibilidade:** rótulos em todos os campos, foco visível, ordem do foco lógica, mensagens anunciadas, contraste suficiente.
- **`python3 website/build.py --check`** sem avisos.

### Peça 2: a skill ORÇAMENTO MDM
- **Para qualquer pedido** que o site envie (o email do Apps Script ou a linha da folha «Pedidos»), o script `scripts/orcamento.mjs` dá:
  - a mesma potência, o mesmo tamanho, a mesma gama e o mesmo preço que o cliente viu no site;
  - com a tabela preenchida, a mesma proposta que a página da equipa (`equipa/proposta`). Com a tabela vazia, a página da equipa não faz proposta e a skill faz a de visita.
- **Com a tabela vazia,** a proposta sai com a potência e as gamas, e com o preço depois da visita. Nenhum valor em euros.
- **Avisa a equipa** quando os números mudaram depois do pedido.
- **Faltando um dado** (uma área, o depósito), diz o que falta e não adivinha.
- **Trabalhos sem tabela** (avarias, manutenção, ventilação, eletricidade): diz que se marca a visita.
- **O texto e o HTML para PDF** cumprem as regras da casa. O pacote para o claude.ai corre fora do repositório.

### Peça 3: a calculadora de BTU
- **As contas são iguais** no formulário do site (`assets/js/site.js`), na função da equipa (`netlify/lib/calculo.mjs`) e na skill, em todos os casos de `tests/paridade.mjs`.
- **Casos de limite:**
  - área mínima e máxima (2 e 200 m²);
  - acima de 200 m² (a dimensionar na visita);
  - a folga de 10% (12 100 BTU/h fica em 12 000);
  - cada tipo de divisão, sol e último andar;
  - de 1 a 8 divisões;
  - mais de 4 divisões (visita);
  - acima de 24 000 BTU/h (visita).
- **Entradas estranhas** não partem nada e dão uma mensagem clara: «12,5», «12.5», «-4», «abc», texto colado, campo vazio.

## Método
1. **Ler** `website/README.md` e o cabeçalho de cada teste em `website/tests/`.
2. **Gerar a cópia do site** numa pasta temporária. Nunca em `public/`, nunca a mexer em `precos.json`:
   ```
   cd website && MDM_OUT=/tmp/mdm-copia MDM_PRECOS_FICHEIRO=data/precos-teste.json python3 build.py --check
   ```
   Gerar também uma cópia com a tabela vazia, como estará no lançamento.
3. **Correr todos os testes**, a partir de `website/`:
   - `python3 build.py --check`;
   - `node tests/orcamento-skill.mjs`;
   - `node tests/funcao.mjs`;
   - `node tests/apps-script.mjs`.

   Com o Playwright:
   - `tests/paridade.mjs`;
   - `tests/encaminhamento.mjs`;
   - `tests/pagina.mjs`;
   - `tests/pedidos-google.mjs`.
4. **Clientes simulados no browser,** na cópia, cada um do princípio ao fim:
   1. Telemóvel, T2 com duas divisões na calculadora, pedido de instalação com fotografia.
   2. Computador, três divisões com sol e último andar, «Juntar ao pedido».
   3. Telemóvel de 320 px, ar condicionado avariado, só telefone, com fotografia.
   4. Gestora de condomínio, contrato de manutenção: segue para o comercial, sem WhatsApp.
   5. Restaurante, ventilação: segue para o comercial.
   6. Quadro elétrico do ar condicionado: segue para o comercial.
   7. Bomba de calor para águas quentes, depósito de 300 L.
   8. Só teclado, do primeiro campo ao envio.
   9. Sem JavaScript.
   10. «Recusar» nas estatísticas, depois navegar e enviar um pedido.
   11. Uma divisão de 250 m² e outro pedido com 6 divisões.
   12. Rede cortada no envio, depois rede de volta e reenvio.
   13. Áreas estranhas na calculadora.
   14. Voltar atrás no browser depois de enviar, e enviar outra vez.

   O pedido que cada cliente envia passa depois pela skill (`node .claude/skills/mdm-orcamento/scripts/orcamento.mjs --pedido <email> --teste`). A proposta tem de bater com o que o cliente viu.
5. **Cada falha:**
   1. reproduzir;
   2. confirmar que é mesmo uma falha: tentar desmenti-la, e se não se reproduz, não é falha;
   3. corrigir no código verdadeiro, com a mudança mais pequena;
   4. acrescentar o caso a um teste;
   5. correr tudo outra vez.

   Repetir até duas voltas seguidas sem nenhuma falha nova.
6. **No fim:** commit com uma mensagem clara e push para o ramo de trabalho. Nunca para `main` sem o dono pedir.

## Relatório final (para o dono, em português simples)
- O que se testou e quantas verificações passaram.
- Cada falha encontrada: o que o cliente via, o que se corrigiu e o teste que a guarda.
- **O que só o dono pode fazer:**
  - preencher a tabela de preços;
  - instalar o Apps Script e enviar o endereço `/exec`;
  - ligar o Netlify ao GitHub;
  - revisão jurídica da política de privacidade;
  - os técnicos confirmarem os números de «btu»;
  - o domínio;
  - dizer «lança».
- O que ficou por fazer e porquê. Nunca esconder um teste falhado.
