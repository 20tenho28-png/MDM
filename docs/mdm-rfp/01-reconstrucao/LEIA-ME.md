# 01. Reconstrução do percurso dos pedidos

> Só os scripts e os testes estão no repositório (que é público). O resto do dossier do pedido de proposta (instruções de export `00-exportar-dados.md`, RFP, seleção, anexos, revisão) fica fora do GitHub, porque tem dados internos da empresa e as rubricas de seleção dos candidatos. Os dados reais (`entrada/`, `saida/`, `*.mbox`, `*.csv`, `*.xml`) nunca entram: estão no `.gitignore` desta pasta.

Um script, biblioteca padrão mais `openpyxl`, que lê os exports de `00-exportar-dados.md` e devolve o funil real de julho a setembro de 2026.

```bash
pip install openpyxl
python3 exportar-imap.py --servidor <servidor IMAP> --listar      # a conta mdmassist@mdmassist.com é IMAP, não Gmail
python3 exportar-imap.py --servidor <servidor IMAP>                # → entrada/imap-comercial.mbox, só leitura
python3 testes_reconstruir.py                       # 18 testes: um por cada erro corrigido na revisão de 23/10/2026, e o export IMAP
python3 reconstruir.py --demo                       # dados fictícios, para ver o formato da saída
python3 reconstruir.py --entrada entrada --saida saida --desde 2026-07-01 --ate 2026-09-30
```

Opções: `--pagamentos-ate` (até quando contam recibos de faturas do trimestre; por omissão 120 dias depois de `--ate`), `--intervalo` (dias sem nada que separam dois pedidos do mesmo cliente; 60), `--eu` (nomes da MDM nas conversas de WhatsApp; «MDM»).

## O que faz

1. Lê cada canal e transforma tudo em **toques**: (fonte, data, cliente, etapa). Email (todos os `.mbox` da pasta: o do Gmail e o da conta IMAP) e WhatsApp dão a etapa `pedido`; a agenda dá `visita`; os ficheiros ORC dão `orcamento` e o valor; as folhas de obra dão `obra`; o SAF-T dá `fatura` (FT, FS, FR) e `pagamento` (recibos e faturas-recibo); o export do registo dá o que lá estiver preenchido e os `perdido`. Os emails de quem está em `remetentes-excluir.txt` (fornecedores, bancos, a própria MDM) não contam.
2. **Agrupa por cliente** com correspondência de nomes tolerante (acentos, «Lda», ordem das palavras). Números diferentes separam clientes («Escola Básica n.º 3» e «n.º 5»), e palavras que muitos clientes partilham («condomínio», «escola», «rua», «clínica») sozinhas não chegam para juntar dois nomes. Mesmo assim vai haver erros: corrigir à mão em `nao_correspondidos.csv` e, se preciso, renomear nos exports e voltar a correr.
3. **Divide cada cliente em pedidos**: abre-se um pedido novo quando chega um pedido depois de o anterior estar faturado ou perdido, ou quando passam mais de 60 dias sem nada. Os recibos vão para o último pedido faturado e ainda por pagar.
4. Para cada pedido, a **primeira data de cada etapa**. Se duas fontes dão datas diferentes para a mesma etapa, guarda as duas na coluna `conflitos`; também lá fica «perdido e faturado». Não escolhe. Adjudicação e obra sem registo próprio são inferidas da fatura e marcadas na coluna `inferido`.
5. Escreve `funil.md`, `reconciliacao.md`, `chamadas.md`, `pedidos_reconstruidos.csv`, `nao_correspondidos.csv`, `remetentes.csv`, `orc_sem_data.csv`.

## Como ler a saída

- **funil.md**: N por etapa, % da etapa anterior, % do pedido inicial, dias medianos entre etapas, euros orçamentados, ganhos, perdidos, faturados, por cobrar (em euros à portuguesa, 1 234,56 €). «Ainda aberto» são pedidos sem fatura e sem perdido: os que estão a arrastar-se.
- **reconciliacao.md**: por mês, faturas (FT, FS, FR) e o seu valor, notas de crédito e o seu valor, e o **líquido do mês** (faturas menos notas de crédito, mais notas de débito), sem anuladas. É o líquido que se compara com o contabilista. Diz também quantas faturas têm um pedido a montante e a diferença em euros entre o valor das faturas e o que o percurso encontrou. **Esta diferença é a prova de que o problema é de registo**: trabalho que foi faturado mas que não deixou rasto em nenhum canal.
- **chamadas.md**: recebidas e perdidas por mês e por linha. A fatura do operador não diz quais viraram pedido; isso vem da folha de contagem de um dia.
- **pedidos_reconstruidos.csv**: a tabela completa, uma linha por pedido, para abrir no Excel e verificar caso a caso. Tem nomes de clientes: não sai da empresa.
- **remetentes.csv**: quantos emails por domínio. Serve para completar `remetentes-excluir.txt` depois da primeira corrida.
- **orc_sem_data.csv**: orçamentos sem data na folha nem no nome do ficheiro. Ficam fora do funil até se corrigir.

## Limites conhecidos

- Chamadas telefónicas que viraram pedido sem email nem WhatsApp aparecem só se tiverem agenda, ORC ou fatura. Os que morreram ao telefone não aparecem em lado nenhum. É o buraco que o passo 2 mede.
- Clientes recorrentes com contrato aparecem como «fatura sem pedido». É correto: não houve pedido, houve contrato. Separar à mão na coluna `fontes`.
- O valor do ORC é lido da célula «Valor Total: X € + IVA» da primeira folha. Se o ficheiro tiver outro formato, fica vazio e o euro não conta.
- Datas da agenda anteriores ao primeiro email dão dias negativos. Acontece quando o pedido entrou por telefone e o email veio depois. Não é erro do script; é informação.
- O nome de quem envia o email nem sempre é o nome que está na fatura (pessoa no email, empresa no SAF-T). É a principal fonte de «não correspondidos».
- As conversas de WhatsApp leem a data no formato dia/mês. Num telemóvel configurado em inglês dos EUA (mês/dia) as datas saem trocadas: confirmar numa conversa antes de correr.

## O que vai para o RFP

Só os três `.md`, depois de revistos, e sem a lista de clientes. Copiam-se os números para os marcadores `[EVIDÊNCIA]` de `04-rfp.md`.
