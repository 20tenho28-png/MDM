# Funil de pedidos MDM

Reconstrói cada pedido de cliente, do primeiro contacto até à fatura, a partir dos ficheiros em bruto (emails,
WhatsApp, chamadas, orçamentos ORC, faturas e formulário do site). Mede quanto tempo demora cada etapa, onde os pedidos
ficam parados, porque se perdem e quanto custa responder devagar. A partir daí propõe as prioridades P1, P2 e P3 e
testa-as em pedidos que não viu.

Corre no teu computador. Os dados não saem da tua máquina.

## Instalar

1. Instala o Python 3.11 ou mais recente (python.org; no Windows, marca "Add Python to PATH").
2. Abre um terminal na pasta do projeto e corre:

```
pip install -r requirements.txt
```

## Experimentar primeiro com dados inventados

```
python -m funil exemplo
```

Cria a pasta `exemplo/` com um ano de pedidos inventados (clientes "Ana Exemplo 017" e afins) e abre caminho para
`exemplo/saida/relatorio.html`. Serve para veres o relatório antes de juntares os teus dados.

## Preparar os teus dados

Cria uma pasta de projeto com esta estrutura (os nomes das subpastas contam):

```
funil-mdm/
  config.toml          (copia de config.exemplo.toml, com os teus dados)
  dados/
    email/             ficheiros .mbox
    whatsapp/          conversas exportadas (.txt ou .zip)
    chamadas/          registo de chamadas (.xml ou .csv)
    orc/               ficheiros ORC0034_2026 Nome do cliente.xlsx (podem estar em subpastas)
    faturas/           lista de faturas (.csv ou .xlsx)
    site/              exportação do formulário do site (.csv ou .json)
    agenda/            agenda do ERP (.csv), opcional: as visitas e as peças para o modo sombra
```

Como obter cada ficheiro sem pagar nada:

| Fonte | Como exportar |
|---|---|
| Gmail (mdmassistencia@gmail.com) | takeout.google.com, desmarca tudo menos "Correio", formato MBOX. Põe o `.mbox` em `dados/email/`. |
| Outra caixa (IMAP) | Thunderbird com o extra ImportExportTools NG: exporta a Entrada e os Enviados como mbox. |
| WhatsApp / WhatsApp Business | Em cada conversa de cliente: Mais, Exportar conversa, Sem multimédia. As conversas com técnicos, fornecedores ou família ou não as exportas, ou escreves o nome em `conversas_ignorar` (secção `[whatsapp]`). |
| Chamadas no Android | App "SMS Backup & Restore": faz cópia só das chamadas e copia o `.xml`. É a única fonte das chamadas **recebidas e perdidas**. |
| Chamadas no iPhone ou no fixo | A fatura detalhada do operador normalmente só lista as chamadas **efetuadas**. Converte-a para CSV e escreve `direcao_fixa = "saida"` em `[chamadas]`. As chamadas recebidas e perdidas não aparecem. |
| Orçamentos | Copia a pasta dos ORC. O nome tem de começar por `ORC0034_2026`. |
| Faturas | Exporta a lista de documentos do programa de faturação (data, número, cliente, NIF, valor sem IVA, descrição e, se houver, tipo de documento) e ajusta os nomes das colunas em `[faturas]`. |
| Site | Supabase, Table Editor, a tabela dos pedidos, Export to CSV. |
| Agenda do ERP | No ERP (`/erp`), «exportar a agenda para o funil» no rodapé, ou `/erp/exportar/agenda.csv`. Uma linha por visita, com o relatório de intervenção que a fechou. Põe o ficheiro em `dados/agenda/` (o mais recente basta: tem a agenda toda). |

Três hábitos que tornam a análise muito mais certa, sem trabalho extra:

- **Escrever o número ORC na mensagem** quando enviam o orçamento por WhatsApp ou email (ou anexar o PDF com o
  nome `ORC0034_2026 ...`). É assim que a conversa fica ligada ao orçamento, e é a prova de que foi enviado: sem
  essa mensagem, o orçamento conta a partir da data do ORC e fica marcado como envio por confirmar (coluna
  `envio_confirmado` em `saida/pedidos.csv`).
- **Pôr o telefone do cliente no campo "Contacto" do ORC.** Quando o cliente liga e o orçamento segue por email, é
  a única coisa que liga a chamada ao email.
- **A data do ORC no ano certo.** Se a data estiver em falta ou com o ano errado, o funil usa a data da primeira
  mensagem com o número; sem nenhuma, o ORC fica de fora e o relatório avisa.

O que o funil ignora sozinho: spam, newsletters, rascunhos, respostas automáticas de ausência, mensagens do sistema
do WhatsApp (encriptação, código de segurança), saudações automáticas do WhatsApp Business (as que se repetem em
várias conversas logo depois da mensagem do cliente; podes também escrever o início delas em
`mensagens_automaticas`), recibos (RG), pró-formas (PF) e outros documentos que não são vendas. As notas de crédito
(NC) descontam ao valor faturado. Um ficheiro estragado fica de fora com aviso, sem parar a análise.

Como trata os casos com várias pessoas:

- Um email da MDM para várias pessoas (cliente e arquiteto, por exemplo) conta para o cliente: quem escreveu à MDM,
  ou o cliente do orçamento em anexo. Se responde a duas pessoas que tinham escrito (um casal, por exemplo), conta
  como resposta para as duas, sem as juntar.
- Quando o arquiteto ou outra pessoa em cópia responde num fio de email de um cliente, a mensagem fica no pedido
  desse cliente.
- Um grupo de WhatsApp (de obra, por exemplo) é tratado como um cliente à parte: as pessoas lá dentro não ligam
  grupos diferentes. Os números de `[empresa] telefones` (a MDM e os técnicos) escrevem pela MDM.
- Um contacto ligado a clientes diferentes (um técnico, um parceiro, uma administração de condomínios) é ignorado,
  com as mensagens trocadas com ele, e aparece no relatório. Se for de um só cliente, escreve-o em
  `nunca_partilhados` (secção `[pedidos]`).
- Uma queixa do preço seguida de orçamento revisto e aceitação fica no mesmo pedido, ganho.

## Correr a análise

```
python -m funil analisar --pasta CAMINHO/PARA/funil-mdm
```

Antes da primeira análise vale a pena correr `python -m funil remetentes --pasta ...`. Mostra os domínios que mais
enviam email e ajuda a escolher os fornecedores e serviços a pôr em `dominios_ignorar`.

## O que sai

| Ficheiro | Para quê |
|---|---|
| `saida/relatorio.html` | O relatório para ti e para o chefe. |
| `saida/pedidos.csv` | Uma linha por pedido, com a data de cada etapa. Cada número do relatório pode ser verificado aqui. |
| `saida/segmentos.csv` | Custo do atraso e prioridade sugerida por segmento. |
| `saida/semanal.csv` | Série semanal (pedidos, primeira resposta, ganhos). |
| `saida/teste_regras.csv` | Regras atual e sugerida, testadas em pedidos que não viram. |
| `saida/rever_ligacoes.csv` | Clientes juntados pelo nome, documentos sem contacto, orçamentos sem contacto com os pedidos que podem ser os seus, e contactos tratados como partilhados. Para confirmares. |
| `revisao/pedidos.csv` | **Escreves tu.** Correções por pedido: `incluir` (S/N), `tipo`, `empresa` (S/N), `resultado` (ganho, perdido, sem_orcamento, em_aberto), `motivo`, `nota`. Não se perdem quando voltas a correr. |
| `saida/sombra.html` | Só com `python -m funil sombra`. Os estados e os prazos aplicados ao histórico, para validar com o chefe. |
| `saida/prazos_propostos.toml` | Os prazos propostos, prontos a copiar para a secção `[prazos]` do `config.toml`. |
| `saida/sombra_*.csv` | Os números do modo sombra para Excel: prazos e vermelhos por estado e P, comparação de percentis, lei de Little e tempos. |
| `revisao/ligacoes.csv` | **Escreves tu.** Dois contactos do mesmo cliente por linha, nas colunas `chave_a` e `chave_b`: telefones (`912 345 678`), emails, números ORC (`ORC0034_2026`) ou NIF (`nif:500000017`). O relatório avisa se uma chave não se percebe ou não aparece nos dados. |

## O trabalho, por ordem

1. **Linha de base.** Junta 6 a 12 meses de dados e corre a análise. Lê primeiro a secção "De onde vêm os números":
   diz que fontes faltam e o que isso enviesa.
2. **Rever.** Corrige os pedidos e as ligações que o cálculo não acertou e volta a correr.
3. **Gargalo.** Vê onde os pedidos ficam parados (lei de Little) e onde se perdem.
4. **Prioridades.** Vê o custo do atraso por segmento e o teste das regras em dados retidos.
5. **Concordância.** `python -m funil amostra` cria `saida/amostra_A.csv` e `saida/amostra_B.csv`. Tu e o teu chefe
   classificam P1/P2/P3 sem ver o do outro. Depois
   `python -m funil concordancia saida/amostra_A.csv saida/amostra_B.csv`. Adotem as regras só com kappa de 0,7 ou mais.
   Para repetir, `python -m funil amostra` outra vez: a amostra nova usa pedidos que ainda não foram classificados,
   e os ficheiros já preenchidos nunca são apagados (os novos ficam com `_2` no nome).
6. **Estados e prazos (modo sombra).** `python -m funil sombra` aplica ao histórico os estados (novo, orçamento por
   fazer, à espera do cliente, em execução) e propõe um prazo por estado e P: o p80 do tempo de cada P, com a ordem
   por P simulada ao responder e ao orçamentar (os mesmos pedidos, despachados nos mesmos momentos, o de P mais alto
   primeiro), e nunca depois do momento em que 1 em cada 5 clientes já cobrou ("então, já viram?"). Na espera do
   cliente, o prazo é o primeiro seguimento: quando metade dos clientes já decidiu. Com a agenda do ERP em
   `dados/agenda/`, mede também a visita por marcar, a visita marcada e a espera de peça/fornecedor. Mostra quantos
   pedidos teriam ficado vermelhos, se os perdidos e os clientes que cobraram teriam ficado vermelhos a tempo, os
   vermelhos por manhã e se os prazos cabem na capacidade (lei de Little). Para ajustar, copia
   `saida/prazos_propostos.toml` para o `config.toml`, muda os números e corre outra vez, até o vermelho ser raro e
   útil.
7. **Mudar e medir.** No dia em que mudarem o processo, escreve a data em `data_mudanca` (secção `[semanal]`) e corre a
   análise todas as semanas. Os gráficos de comportamento (XmR) dizem se a mudança é real ou ruído: o da primeira
   resposta é semanal; o dos ganhos soma blocos de 4 semanas, porque com tão poucos ganhos por semana um gráfico
   semanal daria alarmes falsos.

## Como se lê o relatório

- **Maduros**: pedidos com o primeiro contacto há mais de 120 dias (`dias_maturidade`). As taxas de ganho, o modelo e
  o teste das regras usam só estes. Os ganhos veem-se logo e as perdas só meses depois; com os pedidos recentes, a
  taxa de ganho parecia melhor do que é.
- **Gargalo**: as etapas que dependem da MDM (responder, orçamentar, executar) e a que depende do cliente (decidir)
  estão separadas. A fila maior do lado da MDM é onde falta capacidade; os orçamentos sem resposta do cliente são
  onde o seguimento pode recuperar trabalho. Um pedido nunca respondido conta como parado até 30 dias; um pedido
  respondido que nunca teve orçamento conta até ao último contacto (é um mínimo: se a MDM ficou de enviar e não
  enviou, esperou mais). Enquanto a conversa estiver ativa, o pedido conta como em aberto.
- **Prioridades**: os pedidos que nunca tiveram resposta entram no modelo como os mais lentos de todos, para não
  esconderem o custo da demora.

## Como se sabe que está certo

- `python -m pytest` corre 161 testes. Um deles gera um ano de pedidos inventados com a verdade guardada e com as
  armadilhas do dia a dia (técnico e arquiteto nos emails, férias com resposta automática, saudação do WhatsApp
  Business, rascunhos, recibos, pró-formas e notas de crédito, datas escritas como texto) e confirma que o funil
  recupera a verdade: todos os pedidos encontrados, tempos de resposta exatos, orçamentos, valores, aceitações e
  recusas certos, e o efeito real da demora dentro do intervalo que o modelo calcula. Os outros testes reproduzem,
  um a um, os erros encontrados em duas revisões independentes (grupos de WhatsApp, emails com várias pessoas,
  negociações, frases de decisão, ficheiros estragados e outros). Os do modo sombra confirmam as contas do relógio
  (horas e dias úteis com feriados), a simulação da ordem por P, a lei de Little numa fila conhecida, a deteção das
  cobranças dos clientes (no mundo de exemplo, todas encontradas e nenhuma a mais) e a divisão dos estados pelas
  visitas da agenda do ERP (o mundo de exemplo também tem agenda, com peças encomendadas entre duas visitas).
- Com os teus dados, a prova vem de fora do funil: as **faturas** dizem o que foi ganho, o **registo de chamadas** diz
  quantas chamadas ficaram por atender, o **chefe às cegas** (kappa) diz se as regras são claras, o **teste em dados
  retidos** diz se as regras acertam em pedidos novos, e o **gráfico semanal** depois da mudança diz se ela resultou.

## Limites conhecidos

- Chamadas não têm texto: o tipo de trabalho fica "desconhecido" até o preencheres em `revisao/pedidos.csv`.
- Um cliente só por telefone cuja fatura não tem telefone nem número ORC fica como "fatura sem pedido".
- Quando o cliente liga e o orçamento segue por email sem o telefone no ORC, a chamada e o orçamento ficam como dois
  pedidos. O relatório sugere a chamada provável em `saida/rever_ligacoes.csv`; confirma e junta-os em
  `revisao/ligacoes.csv`.
- As chamadas do telefone fixo não ficam registadas: esses pedidos só aparecem a partir do orçamento.
- Uma conversa de WhatsApp com um técnico que só menciona um orçamento não é reconhecida como de técnico. Põe-na em
  `conversas_ignorar`, ou o número dele em `[empresa] telefones`.
- Se a mesma pessoa tem orçamentos em nomes diferentes (o dela e o da loja, ou o de um familiar), o contacto dela é
  tratado como partilhado. O relatório mostra-o; escreve-o em `nunca_partilhados`.
- As decisões dos clientes vêm de frases («aceito», «fica para o próximo ano», «achei caro»...). Frases ambíguas
  ficam para confirmares em `revisao/pedidos.csv`; um ganho com fatura conta sempre, mesmo sem frase.
- A relação entre rapidez e ganhos é observada, não provada: se respondem mais depressa aos pedidos bons, o efeito
  parece maior do que é. A mudança medida semana a semana é o teste que tira a dúvida.
- Sem a agenda do ERP, o modo sombra mede quatro estados e a visita fica dentro de "orçamento por fazer" ou de "em
  execução". Com ela, a visita conta por marcar desde que o cliente espera por ela (o início de "orçamento por fazer"
  ou de "em execução") até ter dia, marcada até chegar o relatório de intervenção, e à espera de peça desde a visita
  que a pediu até o escritório registar que a peça chegou. A visita liga-se ao pedido pelo número ORC (campo
  «Referência» da visita) ou, sem ele, pelo cliente, se houver contacto nos 60 dias antes; as outras ficam de fora
  e são contadas no relatório. As visitas não são contactos: não mudam a primeira resposta nem os resultados.
- A simulação da ordem por P supõe que a MDM teria despachado nos mesmos momentos e que um orçamento vale outro. É uma
  estimativa do que a capacidade permite, não uma promessa; a prova é o gráfico semanal depois da mudança.
- Os seguimentos da MDM (voltar a contactar um cliente que não respondeu) contam-se pelas mensagens enviadas. Uma
  chamada feita de um telefone sem registo não aparece.
- Com 250 a 300 pedidos por ano, o efeito da demora por segmento tem intervalos largos. O modelo partilha informação
  entre segmentos para não exagerar os pequenos e mostra sempre o intervalo. Com um ano de dados, o efeito médio da
  demora só se distingue do acaso se for forte (no mundo de exemplo, cerca de 9 pontos percentuais por dia útil,
  distingue-se em todos os 11 mundos testados); um efeito fraco precisa de mais meses ou da mudança medida semana a
  semana.
