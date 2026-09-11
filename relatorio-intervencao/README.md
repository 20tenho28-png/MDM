# Relatório de Intervenção — MDM (FM-TEC-04 / V07, digital)

Substitui o impresso de 3 vias em papel. **Um ficheiro** (`index.html`), sem servidor, sem
dependências externas: abre-se no telemóvel do técnico (Chrome/Android, Safari/iOS) ou no PC
do escritório, também por `file://`. Os dados ficam só no aparelho (localStorage + IndexedDB).

## O que faz

- **Passos mínimos no terreno**: número automático (`RI-AAAA-<código do aparelho>-NNNN`), data e
  hora de início preenchidas, técnico e viatura das definições, clientes e equipamentos
  recentes a 1 toque, descrição por atalhos, "Agora" para as horas, rascunho gravado a cada
  alteração (fechar o browser não perde nada).
- **Registo de gases fluorados** (art. 7.º do Reg. (UE) 2024/573 · DL n.º 145/2017): só aparece
  quando há manuseamento de gás. Calcula t CO2e com os **GWP do Anexo I do Reg. 2024/573
  (AR6; misturas pelo Anexo VI — ex.: R410A 2256, R32 771)**, se a verificação de fugas é
  obrigatória e com que periodicidade (art. 5.º: 5 / 50 / 500 t, com e sem deteção,
  herméticos < 10 t; HFO do Anexo II ≥ 1 kg, "a confirmar com o OC"; **HCFC/R22 ≥ 3 kg pelo
  Reg. (CE) 1005/2009, art. 23.º**), a data limite da nova verificação após reparação (1 mês)
  e a próxima verificação periódica. Bloqueia registos ilegais: **R22 nunca pode ser carregado
  nem instalado** (também via "Outro": HCFC-22, R408A…), recarga sem verificação de fugas,
  recarga com fuga por reparar ou que persiste, recarga sem ensaio final, gás
  reciclado/regenerado sem instalação e certificado, técnico sem n.º de certificado. Avisa em
  recargas sem fuga registada ("top-up"), recuperações muito abaixo da carga em
  desmantelamentos, vários circuitos num só relatório e certificado da empresa em falta.
- **Fotografias** reduzidas no aparelho (≤ 1600 px, sem EXIF/GPS), até 8 por relatório.
- **Assinaturas no ecrã** com data/hora: técnico (emissão; texto de declaração) e cliente
  (aceitação; nome legível, qualidade, "Li e aceito", texto de aceitação). Alternativas:
  cliente ausente (validação por email) ou recusa com motivo.
- **Relatório congelado** ao emitir: hash SHA-256 do conteúdo (incluindo o SHA-256 da
  assinatura do técnico e de cada fotografia) impresso no rodapé ("Ref."), estável depois da
  aceitação e da exportação — o escritório recomputa-o com `RI.hash(json)`; a aceitação do
  cliente tem a sua própria "Ref. aceitação". Antes de o cliente validar, **Corrigir antes da
  validação** volta a rascunho com o mesmo número; depois, só **Retificar** (nova versão,
  número novo; o original imprime "RETIFICADO — sem efeito"). Relatórios de teste não
  exportados podem ser **anulados** (ficam registados em `mdm_ri_anulados`).
- **PDF A4** pelo browser (Imprimir → Guardar como PDF): cabeçalho com legislação atual,
  resumo executivo, secções vazias escondidas, página própria de registo F-gas, anexo de
  fotografias (6 por página), "Pág. n de N", rodapé fiscal completo. Nome do ficheiro
  `RI-2026-AL-0042 Paula Lemos 2026-09-07`.
- **Entrega**: email com resumo (mailto; o PDF anexa-se à mão), JSON por relatório ou em lote,
  partilha (Web Share) no telemóvel, importação validada no PC do escritório (rejeita JSON
  inválido, nunca regride um relatório aceite para emitido, pergunta antes de substituir um
  número vindo de outro aparelho). "Exportado" só fica marcado depois de o ficheiro sair.
- **Vários rascunhos**: começar um relatório com outro a meio guarda o anterior no histórico
  como *rascunho*, de onde se retoma com as fotografias. Histórico com pesquisa, marca "por
  exportar" e limpeza dos relatórios já exportados há mais de 90 dias (RGPD).

## Como usar

1. Abrir `index.html`. Na primeira vez pede as **definições do aparelho**: técnico, código do
   aparelho (2–3 letras, entra na numeração — único por telemóvel), n.º de certificado F-gas,
   matrícula habitual, colegas, assinatura guardada (opcional).
2. **Novo relatório** → cliente → equipamento → intervenção (+ gás se houver) → materiais →
   deslocação → conclusão → fotografias → **Validar e assinar** → entregar o aparelho ao
   cliente para assinar → **Imprimir / Guardar PDF** e **Enviar por email**.
3. No fim do dia: **Exportar tudo (JSON)** e enviar ao escritório; o escritório importa no PC
   (mesma página) para arquivar e reimprimir. O arquivo legal de 5 anos é do escritório.

## Testes

```bash
npm test     # extrai os <script> do HTML, verifica a sintaxe e corre os testes da lógica pura
```

Os testes cobrem durações, GWP/CO2e, limiares e periodicidades do art. 5.º, fim de mês em
`addMonths`, numeração, NIF/telefone/matrícula, totais de materiais e as validações (R22,
recarga sem verificação, fuga pendente, desmantelamento, certificado, hash canónico, email).
Verificação manual de ponta a ponta feita com Playwright (375×667): preenchimento completo com
fuga reparada e recarga, assinaturas, PDF, recarga da página, retificação, retoma de rascunho
com fotografias, vários rascunhos, hash estável após aceitação. A app foi ainda revista por três
revisores independentes (conformidade F-gas/RGPD, uso no terreno, robustez técnica) e as
correções aplicadas: GWP do Anexo I, HCFC ≥ 3 kg, hash canónico, fotos ao retomar rascunho,
paginação medida no DOM, sanitização de imagens importadas, fallback sem IndexedDB, CSS
compatível com Chrome 80 / Safari 13, alvos ≥ 44 px, textos legais e RGPD.

## Limites e decisões (v1)

- **Não substitui a ficha do caderno de registo do Organismo de Certificação** (DL 145/2017):
  recolhe os mesmos dados para a preencher sem retrabalho; a ficha do OC continua a ser feita
  pelo técnico (se ficar por fazer, entra nos pendentes do relatório). Formato do n.º de
  certificado, certificado da empresa, tratamento de HFO (Anexo II) e os valores de GWP do
  Anexo I/VI estão marcados "a confirmar com o OC" — o cabeçalho só afirma certificação quando
  os dois números (empresa e técnico) estão nas definições.
- Numeração por aparelho (código + contador anual); sem servidor não há sequência global.
  O escritório consolida pelos JSON. Rascunhos apagados ficam em `mdm_ri_anulados`.
- `mailto` não anexa ficheiros: o técnico anexa o PDF, ou partilha o JSON e o escritório
  regenera o PDF (a impressão parte sempre do JSON, por isso o resultado é idêntico).
- RGPD: dados mínimos, sem geolocalização nas fotos, "Apagar tudo" nas definições. Recomenda-se
  exportar e apagar do telemóvel ao fim de 90 dias; bloqueio de ecrã do aparelho obrigatório.
- Assinatura no ecrã = assinatura manuscrita digitalizada com data/hora e hash; não é
  assinatura eletrónica qualificada.
- Fora do âmbito: faturação/IVA, sincronização entre aparelhos, comunicações à APA,
  formulários PDF preenchíveis, migração dos relatórios em papel anteriores.

## Estrutura do ficheiro

- `<style>`: interface (alvos ≥ 44 px, alto contraste para sol) + `.page` A4 em mm + `@media print`.
- `<script id="ri-core">`: `RI` — lógica pura (cálculos, validações, email, SHA-256, modelo
  `RI.novo()`); exportado para node.
- `<script>` final: interface, armazenamento (`mdm_ri_*` em localStorage; base `mdm_ri` em
  IndexedDB com `relatorios` e `blobs`), assinaturas, fotografias, `renderPaginas()`.
