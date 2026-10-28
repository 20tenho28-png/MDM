# O «Odoo da MDM»: o plano, módulo a módulo

O objetivo é uma só ferramenta, com o aspeto do registo de hoje, que faça para a MDM o que o Odoo faz para uma empresa de serviços: cada aplicação do Odoo passa a ser um módulo do registo, ligado aos outros pelo cliente e pelo pedido. Tudo num ficheiro (`index.html`), com os dados no Supabase e sem servidor próprio. Este documento diz o que cada módulo é no Odoo, o que já existe aqui, o que falta, e a ordem.

A regra que manda em tudo: **nada se perde**. Todo o pedido tem dono, próxima ação e data; todo o cliente tem um ritmo e uma data da próxima visita; toda a fatura tem um recibo ou um lembrete. O separador «Pipeline» mostra as fugas; os módulos existem para as fechar.

## O que não se copia

- **Faturação certificada.** Em Portugal a fatura sai de um programa certificado pela AT (hoje o SoftGCom, n.º 161). O registo lê o SAF-T todos os meses e liga cada fatura ao pedido pelo n.º do orçamento; não emite faturas. Odoo «Invoicing» e «Accounting» ficam de fora, por lei.
- **Contabilidade, salários, bancos.** Ficam com o contabilista.
- **Loja online, site, marketing automático.** O site já existe (`site/`); os pedidos entram pelo formulário.

## Mapa: aplicação do Odoo → módulo do registo

| Odoo | No registo | O que já há | O que falta |
|---|---|---|---|
| **Contacts** | «Clientes › Contactos» (quadro ao estilo do monday) e a **ficha do cliente** | Quadro de todos os clientes (SAF-T + registo) com grupos por situação, dono, prioridade, tipo e localidade, edição na célula com controlo de versão, colunas da equipa e CSV; situação, ritmo, próxima visita; ficha com dados (NIF, telefone, email, morada, pessoa de contacto, notas), contrato, equipamentos instalados, histórico de pedidos, faturas, recibos e visitas, botões «Pedidos», «Faturas», «Por cobrar». Os dados de contacto entram da tabela de clientes do SAF-T. | Várias moradas por cliente (sede e locais de obra); contactos múltiplos; fornecedores como contactos; importar a lista de clientes do SoftGCom de uma vez. |
| **CRM** | «Gerir pedidos» + «Pipeline» | Pedidos com P, estado, dono, próxima ação e data; funil; motivos de perda; origem; taxa de aceitação; escalada automática do P. | Leads sem pedido (um nome e um telefone de uma feira); atividades agendadas (chamada, email) com lembrete; equipas comerciais. |
| **Sales** | O orçamento dentro do pedido | N.º ORC seguido, valor, data e meio de envio, revisões, aceite por escrito (data), seguimentos 3/5/7 dias. Linhas do orçamento (equipamento, mão de obra, deslocação, material, descontos) com a tabela de preços privada da MDM, potência por divisão, até três opções de marca lado a lado, condições de pagamento e o PDF com o aspeto da proposta da equipa; o texto para enviar por WhatsApp ou email. | Guardar o PDF no pedido (Supabase Storage, passo 10); o cliente aceitar pelo portal (passo 9); custo e margem por linha (passo 7). |
| **Field Service** | Visita técnica e obra | Visita marcada com data, hora e técnico; folha da visita; obra por passos (adjudicado, encomendado, material, instalação marcada com equipa, véspera, RI). | **Agenda dos técnicos** (calendário por dia e por técnico, arrastar a visita); a **folha da visita** com os campos do levantamento (metros de tubo, desnível, parede, condensados, quadro, fotos); o **RI** preenchido no telemóvel e assinado pelo cliente; fotos guardadas no Supabase Storage. |
| **Helpdesk** | As avarias (P1) no mesmo registo | P1 avaria com 4 h úteis de resposta; relógio em horas úteis; «resolvido ao telefone». | SLA por contrato (clientes com contrato têm prazos próprios); histórico de avarias por equipamento; portal do cliente para ver o estado do pedido (ligação pública por pedido). |
| **Invoicing** | «Faturação» (leitura do SAF-T) e os estados «Por faturar» e «Faturado» | Faturado e recebido por mês, meses em falta, clientes que mais faturam, IVA, documentos ligados ao pedido, faturas sem recibo, pagamento em atraso a 30 dias. | Mapa de **vencimentos** (por cobrar a 30, 60, 90 dias) por cliente; lembretes de cobrança com texto pronto; importar o SAF-T de forma automática (hoje é arrastar o ficheiro). |
| **Purchase** | Encomenda dentro da obra | Data da encomenda, fornecedor, entrega prevista, «à espera de fornecedor» com pergunta a 3/5/10 dias. | **Notas de encomenda** com linhas e preço de custo; fornecedores com contactos e prazos habituais; margem por obra (venda menos custo). |
| **Inventory** | Equipamentos instalados no cliente | Lista de equipamentos por cliente (tipo, marca, modelo, onde, data). | Stock da carrinha e do armazém (material corrente: tubo, cabo, suportes, gás); mínimos e alerta de reposição; número de série por equipamento e garantia. |
| **Maintenance** / **Subscriptions** | Contrato na ficha e a lista «Para contactar» | Tipo, periodicidade, início, fim e valor do contrato; a próxima visita calcula-se do ritmo; aviso um mês antes; renovação a vencer. | **Plano anual de visitas** gerado do contrato (as datas de cada visita do ano, já com técnico), que gera o pedido sozinho na data; checklist da manutenção preventiva por tipo de máquina; a renovação do contrato como pedido. |
| **Planning** / **Calendar** | Visitas a 7 dias no painel | Lista das visitas marcadas e das atrasadas. | O calendário semanal da equipa (técnicos nas linhas, dias nas colunas), com as instalações (1 a 2 dias por máquina) e as visitas; férias e ausências. |
| **Project** | A obra | Os passos 6 a 8 com datas. | Obras grandes com várias máquinas e vários dias: tarefas por dia e por técnico; autos de medição parciais (80 % / 20 %, como já se fatura). |
| **Documents** | A pasta do pedido (ligação) | Ligação à pasta na Drive. | Fotos e PDFs no Supabase Storage, ligados ao pedido, à visita e ao RI; o ORC em PDF guardado no pedido. |
| **Employees** / **Timesheets** | A tabela «Equipa» | Quem tem acesso; carga por dono com limite. | Horas por obra (começa e acaba no telemóvel), para saber o custo real de cada instalação. |
| **Discuss** | Histórico do pedido | Notas com data no histórico; eventos gravados por quem e quando. | Notas internas com menção a um colega e aviso; mensagem ao cliente por WhatsApp com texto pronto (ligação `wa.me`), registada no histórico. |
| **Dashboards** | «Painel» | Indicadores, para decidir hoje, visitas, fila, donos, meses, orçamentos, origem, atividade. | Comparação com o mês e o ano anteriores; metas (faturação, taxa de aceitação, tempo de resposta). |

## A ordem

Cada passo é um PR pequeno, que se usa logo. A ordem segue o processo interno e o que mais fecha fugas.

1. **Feito.** Pedidos com os 9 passos, pipeline e fugas, painel, clientes com ficha, faturação pelo SAF-T.
2. **Agenda dos técnicos.** O calendário semanal com visitas e instalações, arrastar para mudar a data, e a confirmação da véspera como tarefa. Fecha a fuga «visita sem data» e dá ao técnico o dia dele.
3. **Folha da visita e RI no telemóvel.** O levantamento por divisão com os campos do processo (passo 3), fotos, e o RI com assinatura no ecrã (passo 8). Guardado no pedido; o ORC passa a sair «só com dados medidos».
4. **Feito: linhas do orçamento e PDF.** O ORC feito no registo com a tabela de preços e as opções de marca, a sair em PDF com o aspeto da proposta da equipa (`equipa/proposta.html`); o n.º continua seguido. Junta a skill «ORÇAMENTO MDM» ao registo.
5. **Plano anual de manutenção.** Do contrato nascem as visitas do ano, cada uma um pedido na data, com técnico. É o que garante que nenhum cliente com contrato se perde.
6. **Vencimentos e cobrança.** Mapa de 30/60/90 dias por cliente a partir do SAF-T, com a mensagem de cobrança pronta a enviar.
7. **Encomendas, fornecedores e margem.** Notas de encomenda com custo, para cada obra mostrar a margem.
8. **Stock da carrinha e do armazém.** Material corrente com mínimos.
9. **Portal do cliente.** Uma ligação por pedido para o cliente ver o estado, aceitar o orçamento e marcar a visita.
10. **Fotos e documentos.** Supabase Storage para fotos da visita, do RI e os PDFs.

**O registo no tablet** (plano à parte, por passos, cada um publicado sozinho): 0. **Feito: fundações** (iPad antigo, ecrã principal, não perder trabalho, endereços, a vista à frente desenhada primeiro). 1. Hoje e o pedido como «Trabalho» ao lado da lista, procura única, pedido novo curto. 2. No local: o dia do técnico, levantamento por divisão com fotos, folha de obra, RI. 3. Com o cliente: o orçamento mostrado num modo fechado, aceite e assinatura. 4. Agenda da semana, clientes, números. 5. O resto.

## Como se liga tudo

- **Cliente** (`clientes`): a chave é o nome normalizado, a mesma que junta o SAF-T ao registo. Tudo o resto aponta para o cliente pelo nome.
- **Pedido** (`pedidos`): o objeto central; orçamento, visita, obra, fatura e pagamento vivem dentro dele, como hoje. As tabelas novas (agenda, encomendas, stock) apontam para o pedido pelo `id`.
- **Faturação** (`faturacao`): leitura mensal do SAF-T; liga ao pedido pelo n.º do orçamento na descrição da fatura, ou pelo n.º da fatura registado no pedido.
- **Configuração** (`config`): prazos, limites, e o que for tabela pequena (preços, técnicos, tipos de máquina).

Cada tabela nova segue o mesmo molde: `id`, `dados` (JSON), `versao`, RLS pela tabela `colaboradores`, tempo real. O `migracao.sql` é sempre seguro de correr outra vez.
