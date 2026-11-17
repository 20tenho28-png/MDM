# Perguntas para a Melperfaz

O site novo está pronto, mas há coisas que só a Melperfaz sabe. Enquanto não houver resposta, o site esconde a frase
ou a linha que precisa dessa informação: nunca aparece um espaço por preencher e nunca escrevemos nada que a empresa
não tenha confirmado.

As perguntas estão por ordem de importância: a primeira é a que mais falta faz. Pode responder por escrito, a todas de
uma vez ou aos poucos. Uma resposta curta chega.

Cada pergunta diz onde a resposta aparece no site e, para quem a vai pôr no site, o ficheiro e o campo onde fica
guardada.

## Resumo

| N.º | Pergunta | Onde fica guardada |
| --- | --- | --- |
| 1 | Em que concelhos ou distritos trabalham? | `data/dados-melperfaz.json` › `zona` |
| 2 | Aprova o verde e o vermelho, e o logótipo em verde? | Nenhum campo de dados: cores em `assets/css/site.css`, logótipo em `assets/img/` |
| 3 | Qual o horário de atendimento? | `data/dados-melperfaz.json` › `horario` |
| 4 | Qual o número do alvará e qual o seguro? | `data/dados-melperfaz.json` › `alvara` e `seguro` |
| 5 | Qual o NIF, a morada, o email e o perfil do Google? | `data/dados-melperfaz.json` › `nif`, `morada`, `email` e `googleMaps` |
| 6 | Confirma as garantias que o site já promete? | Nenhum campo de dados: se não confirmar, o texto sai |
| 7 | O que se fez em cada uma das 5 obras? | `data/obras.json` › `factos` e `fotosExtra` de cada obra |
| 8 | Aceita o campo «Localidade» no formulário? | Nenhum campo de dados: é um campo do formulário |
| 9 | Usa o «Tipo de obra» dos pedidos em filtros ou folhas? | Nenhum campo de dados: os nomes vêm de `data/site.json` › `servicos` |
| 10 | Aprova a legenda por cima das fotografias na página inicial, no telemóvel? | Nenhum campo de dados: é uma escolha de desenho |

## 1. Em que concelhos ou distritos trabalham?

É a pergunta mais importante. Quem visita o site quer saber logo se a Melperfaz trabalha na sua zona. Até haver
resposta, é melhor não divulgar o site.

- **Onde aparece**: no topo da página inicial, ao lado de «Reabilitação e construção»; em «Quem somos», na página
  inicial («Trabalhamos em …»); no rodapé de todas as páginas; e na ficha da empresa que o Google lê.
- **Onde fica guardada**: `data/dados-melperfaz.json`, campo `zona`. Escreve-se sem ponto final (o site já o põe), por
  exemplo uma lista de concelhos ou o nome de uma região.

## 2. Aprova o verde e o vermelho, e o logótipo em verde?

A pedido da Melperfaz, o site deixou o azul-marinho e o laranja e passou a verde e vermelho. Para isso, o logótipo foi
recolorido de azul-marinho para verde. O logótipo branco do rodapé fica igual. O ícone do separador do browser e a
imagem que aparece quando alguém partilha uma ligação do site (no WhatsApp ou no Facebook) também passaram ao verde.

Os tons escolhidos são:

- **verde-floresta** (código #12392b): os textos, o cabeçalho, o rodapé e as secções escuras;
- **vermelho** (código #c8102e): os botões e o painel de contacto no fim de cada página. Sobre o vermelho o texto é
  sempre branco, para se ler bem.

Pedimos que confirme estes tons e o logótipo em verde. Se a Melperfaz tiver cores oficiais (por exemplo, os códigos de
uma gráfica) ou um ficheiro do logótipo já em verde, envie-os e usamos esses. Mudar um tom é rápido, e o site confere
sozinho que o texto continua fácil de ler.

- **Onde aparece**: em todas as páginas (logótipo, botões, cabeçalho, rodapé e o painel de contacto vermelho), no
  ícone do separador do browser e na imagem de partilha.
- **Onde fica guardada**: não é um campo de `dados-melperfaz.json` nem de `obras.json`. As cores estão no início de
  `assets/css/site.css` (`--ink` é o verde e `--clay` o vermelho, com as cores que os acompanham); o logótipo em
  `assets/img/logo-melperfaz.png`, os ícones em `assets/img/favicon-32.png` e `favicon-180.png`, e a imagem de partilha
  em `assets/img/og-melperfaz.jpg` (refaz-se com `python3 gerar_fotos.py --partilha` depois de mudar o verde).

## 3. Qual o horário de atendimento do telefone e do WhatsApp?

- **Onde aparece**: junto ao telefone no cabeçalho (no computador), no painel de contacto vermelho (no fim da página
  inicial, de Obras e da página de cada obra), no rodapé, na página «Pedir Orçamento» e na política de privacidade.
- **Onde fica guardada**: `data/dados-melperfaz.json`, campo `horario`, como a Melperfaz o escreve (por exemplo
  «2ª a 6ª, 8h–18h»).

## 4. Qual o número do alvará no IMPIC, e qual o seguro de responsabilidade civil?

O site já diz «Licenciada & segurada». Com o número do alvará e o nome da seguradora, essa promessa fica provada.

- **Onde aparece**: o alvará na linha de garantias por baixo dos botões (no topo da página inicial e no painel de
  contacto vermelho), em «Licenciada & segurada» (na página inicial e na página «Pedir Orçamento») e na linha legal do rodapé. O
  seguro aparece em «Licenciada & segurada», na página inicial e na página «Pedir Orçamento».
- **Onde fica guardada**: `data/dados-melperfaz.json`, campos `alvara` (por exemplo «12345-PUB») e `seguro` (a
  seguradora e, se quiser, o número da apólice), os dois sem ponto final. O site escreve «Alvará n.º»: se a empresa
  tiver outro título do IMPIC (um registo, por exemplo), diga qual, e o campo fica vazio até mudarmos o texto.

## 5. Qual o NIF, a morada da sede e o email público? Há perfil da empresa no Google Maps?

- **Onde aparece**:
  - o NIF na linha legal do rodapé, na política de privacidade e na ficha da empresa que o Google lê;
  - a morada no rodapé, em «Quem somos» na página inicial («Sede: …»), na política de privacidade e na ficha do Google;
  - o email no rodapé, na política de privacidade e na ficha do Google;
  - o perfil do Google no rodapé («Ver no Google Maps»), em «Porque nos escolhem» na página inicial («Ver o perfil e
    as avaliações no Google») e na ficha do Google.
- **Onde fica guardada**: `data/dados-melperfaz.json`, campos `nif` (nove algarismos), `morada` (rua, código postal e
  localidade, sem ponto final), `email` e `googleMaps` (a ligação do perfil no Google Maps).

## 6. Confirma, por escrito, as garantias que o site já promete?

Estas frases já estavam no site antigo e ficaram no novo. Precisamos que a Melperfaz confirme cada uma. Se alguma não
for verdade, sai do site; não a suavizamos.

- «Orçamento a preço fixo» (e «O valor que lhe damos é o valor que paga»);
- «2 anos de garantia de execução»;
- «Equipa própria»;
- «Atualizações semanais» durante a obra.

- **Onde aparece**: o preço fixo, a garantia e a equipa própria na linha de garantias por baixo dos botões (no topo da
  página inicial e no painel de contacto vermelho da página inicial, de Obras e da página de cada obra), em «Porque nos escolhem» na página inicial e na
  página «Pedir Orçamento»; a equipa própria também em «Quem somos». As atualizações semanais estão em «O que acontece a
  seguir», na página «Pedir Orçamento».
- **Onde fica guardada**: não é um campo de `dados-melperfaz.json` nem de `obras.json`. São textos do site:
  `data/site.json` › `provas` (a linha de garantias), `src/partials/garantias.html` («Porque nos escolhem») e
  `src/pages/orcamento.html` («O que acontece a seguir»).

## 7. O que se fez em cada uma das 5 obras? E há mais fotografias?

Hoje cada obra mostra só o que se vê na fotografia. Com os factos, cada página de obra conta a história completa. Para
cada obra precisamos de:

- o local (bairro ou concelho, nunca o nome do cliente);
- a data (o ano ou o mês e o ano chegam);
- a duração;
- qual era o problema (uma ou duas frases);
- o que a Melperfaz fez (uma ou duas frases);
- o resultado, numa frase.

E, se houver, 2 a 4 fotografias de cada obra (antes, durante e depois). Nós tratamos de as preparar para o site.

As obras são estas:

| Código | Obra |
| --- | --- |
| M01 | Recuperação integral de fachada e estrutura |
| M02 | Espaço interior pronto a entregar |
| M03 | Edifícios e apartamentos |
| M04 | Reboco e tratamento de fachada |
| M05 | Da remoção ao revestimento novo |

- **Onde aparece**: na página de cada obra (Obras › nome da obra). O problema e o que se fez aparecem em «O problema» e
  «O que fizemos», antes de «Na obra»; o local, a data, a duração e o resultado na «Ficha da obra», ao lado; as
  fotografias novas por baixo de «Na obra».
- **Onde fica guardada**: `data/obras.json`, em cada obra: `factos.localExato`, `factos.data`, `factos.duracao`,
  `factos.problema`, `factos.trabalho` e `factos.resultado`; as fotografias novas em `fotosExtra` (cada uma registada
  antes em `data/fotos.json`, como o README explica).

## 8. Aceita o campo opcional «Localidade» no formulário?

O formulário de pedido de orçamento ganhou um campo «Localidade (opcional)», para a Melperfaz saber logo onde é a obra.
Quem pede pode deixá-lo vazio. Se preferir que não exista, tiramo-lo.

- **Onde aparece**: no formulário da página «Pedir Orçamento», e a política de privacidade explica que é recolhido.
- **Onde fica guardada**: não é um campo de `dados-melperfaz.json` nem de `obras.json`. É o campo `localidade` do
  formulário (`src/partials/orcamento-form.html`), que chega em cada pedido.

## 9. Usa o «Tipo de obra» dos pedidos em algum filtro de email ou folha de cálculo?

Os nomes das opções do «Tipo de obra» mudaram um pouco, para serem iguais aos nomes dos serviços no resto do site. Cada
pedido que chega traz o nome novo:

| Antes | Agora |
| --- | --- |
| Reabilitação de Edifício | Reabilitação de Edifícios |
| Espaço Comercial | Espaços Comerciais |
| Apartamento | Apartamentos |
| Fachadas / Impermeabilização | Fachadas e Impermeabilização |
| (não existia) | Acabamentos |

«Trabalhos de Estrutura» e «Outro» ficam iguais. Se algum filtro de email ou folha de cálculo procura os nomes antigos,
tem de passar a procurar os novos. Os pedidos antigos ficam com os nomes antigos.

- **Onde aparece**: no formulário da página «Pedir Orçamento» e no email de cada pedido.
- **Onde fica guardada**: não é um campo de `dados-melperfaz.json` nem de `obras.json`. Os nomes vêm de
  `data/site.json` › `servicos` (campo `nome` de cada serviço).

## 10. Aprova a legenda por cima da fotografia nas obras em destaque da página inicial, no telemóvel?

No telemóvel, os cartões das obras mostram o nome da obra por baixo da fotografia. Na página inicial, nas três obras em
destaque, o nome fica por cima da fotografia, numa faixa escura, para a página não ficar demasiado comprida. Se
preferir o nome por baixo também aí, mudamos, mas a página inicial fica mais longa no telemóvel.

- **Onde aparece**: na página inicial, nas obras em destaque, só no telemóvel.
- **Onde fica guardada**: não é um campo de dados; é uma escolha de desenho (`assets/css/site.css`).

## Já resolvido

A fotografia do espaço interior (M02) tinha uma faixa preta em cima, que vinha da fotografia original. Foi cortada sem
tirar nada da imagem. Se a Melperfaz tiver essa fotografia sem a faixa, pode enviá-la e trocamos.

## Para quem põe as respostas no site

1. Escrever cada resposta no campo `valor` da chave certa em `data/dados-melperfaz.json` (as perguntas 1, 3, 4 e 5),
   ou nos `factos` e `fotosExtra` de cada obra em `data/obras.json` (a pergunta 7). Só o que a Melperfaz confirmou.
2. Correr `python3 build.py --check`: falha se um valor tiver o formato errado (um email ou um NIF mal escritos, um
   ponto final a mais, um travessão).
3. Correr `python3 build.py --faltam` para ver o que ainda falta. Hoje lista 14 dados: os 8 da empresa (`email`,
   `zona`, `horario`, `googleMaps`, `nif`, `morada`, `alvara`, `seguro`) e os 6 factos de cada obra (`problema`,
   `trabalho`, `data`, `localExato`, `duracao`, `resultado`), em falta nas 5 obras.

As perguntas 2, 6, 8, 9 e 10 não preenchem dados: mudam o código ou o texto do site, conforme a resposta.
