---
name: mdm-orcamento
description: "ORÇAMENTO MDM. Faz a proposta modelo (orçamento) para um cliente da MDM Assistência Técnica a partir de um pedido do site (email, linha da folha «Pedidos»), de uma mensagem de WhatsApp ou de notas da equipa: potência em BTU/h por divisão, tamanho e gama do aparelho (split, multi-split, bomba de calor para águas quentes) e preço da tabela da MDM, em texto e em HTML para PDF. Usar sempre que a equipa pedir um orçamento, uma proposta, «quanto custa», a máquina certa ou os BTU para um cliente de ar condicionado ou de bomba de calor (MDM quote, AC sizing, BTU calculator)."
---

# ORÇAMENTO MDM

Faz a proposta modelo para o cliente com as mesmas contas e o mesmo texto do site e do assistente da equipa. As contas são sempre do script `scripts/orcamento.mjs`, nesta pasta. Tu nunca fazes contas.

## Regras que nunca se quebram
- **Os números vêm só do script.** Potência, tamanho, gama e preço: nunca calcules, arredondes, somes ou estimes um número de cabeça. Repete os valores exatamente como o script os escreve.
- **Nada se inventa:**
  - preços, descontos, prazos de obra, garantias, datas;
  - marcas e modelos de máquinas.

  Sem preço na tabela, a proposta diz que o preço se dá depois da visita, que é gratuita. É verdade e chega.
- **Proposta, não fatura.** Se pedirem uma fatura, diz que a fatura tem de sair de um programa de faturação certificado pela AT. Esta skill faz a proposta modelo, que não é vinculativa.
- **A escolha da máquina é tamanho e gama, nunca um modelo:**
  - 1 divisão: split do tamanho calculado;
  - 2 a 4 divisões: multi-split;
  - mais de 4 divisões, uma divisão acima de 24 000 BTU/h ou com mais de 200 m²: dimensiona-se na visita.
  - Gamas:
    - económica (ex.: Midea);
    - superior (ex.: Mitsubishi Electric, Daikin).
- **Português de Portugal.** Frases curtas.
- **Marcas:** só Midea, Mitsubishi Electric, Daikin e France Air.
- **A idade da empresa** diz-se só com «desde 1991», nunca em anos.
- **Nenhum prazo de resposta**, a não ser «respondemos no dia útil seguinte».
- **Sem travessões.**
- **Dados pessoais do cliente** (nome, telefone, email, local) só nos campos da proposta. Nunca noutro sítio.

## Passos
1. **Arranjar o pedido.** O email do pedido do site, a linha copiada da folha «Pedidos» do Google, ou o texto que a equipa colar. Guarda-o num ficheiro de texto (por exemplo `pedido.txt`), tal como veio.
2. **Correr o script**, a partir da pasta desta skill:
   ```
   node scripts/orcamento.mjs --pedido pedido.txt --html proposta.html
   ```
   No repositório da MDM, o caminho é `.claude/skills/mdm-orcamento/scripts/orcamento.mjs`.

   O script lê do pedido:
   - a potência que o cliente juntou no site (divisões, áreas, sol, último andar);
   - as respostas que mudam o preço (o que vem em «Preço provável mostrado»);
   - o serviço, o nome, o email e o telefone.
3. **Pedido sem estimativa do site** (WhatsApp, telefone, email livre): passa as divisões e as respostas à mão.
   ```
   node scripts/orcamento.mjs --divisao "Sala;25;sol" --divisao "Quarto;12" --resposta pre=sim --nome "Nome" --contacto "912 000 000" --local "Oeiras" --pedido-texto "O que o cliente pediu, numa frase"
   ```
   - **Divisão:** `tipo;área` e, se for o caso, `sol` e `ultimo`.
     - Tipos: Quarto, Sala, Cozinha, Escritório, Outra divisão.
     - Área em m², de 2 a 200.
     - No máximo 8 divisões.
   - **Se faltar uma área, pergunta-a.** «Um T2» não chega. Nunca adivinhes uma área.
   - **Respostas:** `pre` (sim, nao), `dist` (0, 5, 10, mais), `furo` (sim, nao, nsei), `fora` (chao, escada, alta), `luz` (sim, nao, nsei), `antigas` (0 a 4), `deposito` (200, 300, nsei). Só existem as que a tabela de preços tiver.
   - **Bomba de calor para águas quentes:** `--servico aguasQuentes --resposta deposito=200`.
   - **Notas para a proposta:** `--nota "A máquina de fora fica na varanda das traseiras."` (pode repetir). Sem preços, prazos, garantias nem promessas.
4. **Ler a parte «PARA A EQUIPA»** do que o script escreve:
   - **«Perguntas que ainda mudam o preço»:** faz no máximo três de cada vez ao cliente (ou à equipa) e volta a correr com `--resposta`. Também se pode enviar já a proposta com o que há: o intervalo de preço cobre o que falta.
   - **«Avisos»:**
     - a potência ou o preço mudaram desde o pedido: os números do site mudaram depois de o cliente os ver;
     - a tabela é de TESTE.

     Diz isso à equipa antes de entregar.
   - **«Ficou de fora da proposta»:** o pedido ou uma nota quebrava uma regra do dono e foi tirado. Diz porquê.
   - **«Sem proposta»** (o script sai com o código 2): diz o motivo.
     - Faltam dados: pede-os.
     - Trabalho sem tabela (avarias, manutenção, ventilação, eletricidade): marca-se a visita, que é gratuita.
5. **Entregar à equipa:**
   - o texto da proposta: tudo o que vem antes da linha `==========`, para copiar para o email ou para o WhatsApp do cliente;
   - o ficheiro `proposta.html`: abre-se no browser e, em Imprimir, Guardar como PDF, sai a folha A4 da proposta.

   A parte «PARA A EQUIPA» nunca vai para o cliente. Uma proposta marcada TESTE também não.

## De onde vêm os números
- **Potência:** `btu` em `website/data/site.json`. A conta é área × 400 BTU/h por m² × fator do tipo de divisão × sol × último andar, arredondada ao tamanho de aparelho (7 000, 9 000, 12 000, 18 000, 24 000 BTU/h) com 10% de folga. Os técnicos confirmam estes números.
- **Preços:** `website/data/precos.json`, copiados da folha Google «MDM, tabela de preços para o site». Com IVA, por gama.

  Enquanto a tabela estiver vazia, a proposta sai com a potência e as gamas, e com o preço depois da visita.
- **As contas e o texto** são os de `website/netlify/lib/calculo.mjs` e `proposta-modelo.mjs`: os mesmos do formulário do site e da página da equipa.

  `website/tests/orcamento-skill.mjs` e `website/tests/paridade.mjs` confirmam que os três dão o mesmo.

## Opções do script
- `--json` escreve o resultado em JSON.
- `--teste` usa a tabela de teste: números falsos, e a proposta sai marcada.
- `--precos ficheiro` usa outra tabela.
- `--ajuda` mostra tudo.
