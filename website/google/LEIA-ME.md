# Pedidos do site por email (Google Apps Script)

O formulário de orçamento do site envia cada pedido para um pequeno programa da Google, um *Apps Script*, que corre numa conta Google da MDM. O programa está em `pedidos.gs`, nesta pasta. Para cada pedido, ele:

- envia o pedido por email à MDM: **instalação e manutenção** para o comercial (`mdmassist@mdmassist.com`); **avarias, «outro» e pedidos sem serviço** para o email geral;
- junta a fotografia ao email, se o cliente escolheu uma;
- escreve uma linha na folha de cálculo «Pedidos do site MDM», no separador «Pedidos».

Não tem custos além da conta Google: o Apps Script e as folhas de cálculo (Google Sheets) vêm com ela. O site continua alojado no Netlify. Enquanto o endereço do script não estiver em `website/data/site.json`, o site continua a enviar os pedidos para o Netlify Forms, como até aqui.

Os nomes dos menus vão abaixo em inglês, com a tradução entre parênteses quando há dúvida: se a conta Google estiver em português, aparecem traduzidos e podem ser ligeiramente diferentes.

## Que conta Google usar

O script corre na conta Google em que for criado. É dessa conta que saem os emails dos pedidos (com o nome «Site MDM») e é no Google Drive dessa conta que fica a folha de cálculo.

Não tem de ser a conta do endereço que recebe os pedidos: os emails vão para os endereços que puser nas propriedades do script (passo 3), seja qual for o serviço de email desses endereços. Escolha uma conta que a MDM controle e mantenha, e não a conta pessoal de alguém da equipa.

O tipo de conta conta para o número de emails por dia (ver «Quotas e limites»).

## 1. Criar a folha de cálculo

1. Entre no Google Drive com a conta escolhida e crie uma folha de cálculo nova (Google Sheets).
2. Dê-lhe o nome **Pedidos do site MDM**.
3. Não é preciso criar colunas: o script cria o separador «Pedidos», com os títulos, no primeiro pedido.

## 2. Colar o script

1. Na folha, abra o menu **Extensions** (Extensões) e escolha **Apps Script**. O editor abre num separador novo, já ligado a esta folha.
2. No topo, carregue no nome do projeto («Untitled project») e chame-lhe, por exemplo, «Pedidos do site MDM».
3. No ficheiro que já lá está (`Code.gs`), apague tudo, cole o conteúdo inteiro de `website/google/pedidos.gs` e guarde (o ícone da disquete, ou Ctrl+S).

## 3. Os endereços de email

Os endereços ficam nas propriedades do script, não no código.

1. No editor, na barra da esquerda, abra **Project Settings** (a roda dentada).
2. Lá em baixo, em **Script Properties**, carregue para editar e acrescente:

   | Propriedade | Valor |
   |---|---|
   | `EMAIL_COMERCIAL` | `mdmassist@mdmassist.com` (obrigatório) |
   | `EMAIL_GERAL` | o email geral, quando estiver decidido. Vazio ou sem esta linha, os pedidos gerais também vão para `EMAIL_COMERCIAL` |
   | `FOLHA_ID` | não é preciso (ver «Para quem mexe no código») |

3. Guarde as propriedades.

Pode pôr mais do que um endereço na mesma propriedade, separados por vírgulas; cada um conta para a quota diária (ver «Quotas e limites»). Mudar os endereços mais tarde não obriga a publicar de novo: o script lê-os em cada pedido.

## 4. Autorizar e experimentar no editor

1. Volte ao código (o ícone `< >` na barra da esquerda).
2. No topo, ao lado de **Run** (Executar), escolha a função **experimentar** e carregue em **Run**.
3. Da primeira vez, a Google pede autorização: escolha a conta onde criou o script. Pode aparecer um aviso de que a Google não verificou a aplicação. É o que acontece com um script feito pela própria conta: abra **Advanced** (Avançadas), siga a ligação para continuar para o projeto e aceite. O script pede para enviar email em seu nome e para ver e editar folhas de cálculo.
4. No registo de execução, em baixo, aparece `{"ok":true,"ref":"…"}`. Confirme que:
   - chegou a `EMAIL_COMERCIAL` um email «[Teste] Pedido de orçamento MDM · …», enviado por «Site MDM». Se não estiver na caixa de entrada, veja a pasta de spam desse endereço e marque o email como «não é spam»;
   - a folha tem agora o separador «Pedidos», com os títulos e uma linha de teste (pode apagá-la).

## 5. Publicar como aplicação web

1. No editor, carregue no botão azul **Deploy**, no canto superior direito, e escolha **New deployment**.
2. Em **Select type** (a roda dentada), escolha **Web app**.
3. Preencha:
   - **Description**: «Pedidos do site»;
   - **Execute as**: **Me** (a conta onde criou o script). Os emails saem desta conta e é ela que escreve na folha;
   - **Who has access**: **Anyone**. Tem de ser esta opção, porque o site envia os pedidos sem conta Google. Quer dizer que qualquer pessoa pode *enviar* um pedido, que é o que o formulário faz; ninguém de fora vê a folha, os emails ou o código.
4. Carregue em **Deploy**. Se a Google pedir autorização outra vez, aceite como no passo 4.
5. Copie o **Web app URL**: é um endereço `https://script.google.com/macros/s/…/exec`. Numa conta do Google Workspace pode ser `https://script.google.com/a/macros/<domínio>/s/…/exec`; também serve.
6. Abra esse endereço no browser. Deve aparecer `{"ok":true,"servico":"pedidos MDM"}`: o script está publicado.

## 6. Ligar o site

1. Em `website/data/site.json`, ponha o endereço em `pedidosUrl` e, em `pedidosDesde`, o dia em que o site passa a enviar para o script (o dia em que publica esta mudança), no formato AAAA-MM-DD:

   ```json
   "pedidosUrl": "https://script.google.com/macros/s/…/exec",
   "pedidosDesde": "AAAA-MM-DD",
   ```

   Os dois vão juntos: preenchidos os dois ou vazios os dois. Com só um deles, `build.py --check` falha e o Netlify não publica. `pedidosDesde` é a data que a política de privacidade mostra no topo, porque nesse dia o texto passa a falar do Google.
2. Corra `python3 build.py --check` (deve terminar sem problemas), faça commit e push. O Netlify publica o site de novo.
3. Experimente no site com dois pedidos, com um email seu no campo do email:
   - um de **instalação de ar condicionado**: tem de chegar ao comercial;
   - um de **avaria**, com uma fotografia: tem de chegar a `EMAIL_GERAL` (ou ao comercial, se `EMAIL_GERAL` estiver vazio), com a fotografia em anexo.

   Os dois têm de aparecer na folha, cada um com a sua referência. Escreva na mensagem palavras com acentos e «ç» (por exemplo, «Instalação na sala e no escritório, com ligação à varanda») e confirme que aparecem bem no email e na folha.
4. Num dos emails, carregue em **Responder** e confirme que o destinatário é o email que escreveu no formulário. Se aparecer o endereço da própria MDM, o serviço de email ignorou o «responder a» (pode acontecer quando a conta que envia é a mesma que recebe). Nesse caso, para responder a um cliente, escreva para o endereço que o email do pedido mostra na linha «Email» (é uma ligação) e no fim.

## Mudar o script mais tarde

Quando `pedidos.gs` mudar neste repositório:

1. Cole a versão nova no editor, por cima da antiga, e guarde.
2. **Deploy** → **Manage deployments**, escolha a implementação que está ativa e carregue no lápis (**Edit**).
3. Em **Version**, escolha **New version** e carregue em **Deploy**.

O endereço `/exec` fica o mesmo e o site não precisa de mudar. Não use **New deployment** para atualizar: cria um endereço novo, e o site continuaria a usar o antigo, com a versão antiga do script.

## No dia a dia

- **O email** chega com o assunto do site (com a triagem, por exemplo «[P1 · Montagem AC] Pedido de orçamento, …») e a referência no fim, depois de « · ». A referência é a data e a hora do pedido e quatro caracteres ao acaso; é a mesma da folha.
- **Para responder ao cliente**, quando ele deixou um email válido: o email do pedido leva esse endereço em «responder a», mostra-o como ligação na linha «Email» e repete-o no fim («Para responder ao cliente, escreva para …»). Se «Responder» não puser o endereço do cliente (ver o passo 6), use a ligação. Se o cliente não deixou email, ou o que escreveu não parece válido, o fim do email diz para usar o telefone.
- **Na folha**, as colunas são: Data e hora (de Lisboa), Ref, Destino, Triagem, Serviço, Nome, Email, Telefone, Mensagem, Potência, Estimativa, Página, Fotografia, Estado e Notas. O que o cliente escreveu fica como texto, tal como veio (um telefone 00351… não perde os zeros). «Estado» e «Notas» são para a equipa (por exemplo, «respondido» ou «visita marcada»). O script só escreve em «Notas» quando o email não seguiu.
- **Não mude o nome do separador «Pedidos» nem a ordem das colunas**: o script escreve as colunas por esta ordem e, se não encontrar o separador «Pedidos», cria outro. Pode acrescentar colunas à direita de «Notas» e mudar o nome do ficheiro.

## Quotas e limites

- **Emails por dia.** O Apps Script só envia emails a um certo número de destinatários por dia, e esse número depende do tipo de conta Google que corre o script: numa conta Google gratuita (Gmail), cerca de 100 por dia; numa conta do Google Workspace, mais. A Google pode mudar estes números: confirme na página «Quotas for Google Services», em https://developers.google.com/apps-script/guides/services/quotas (a linha «Email recipients per day»). Cada endereço em `EMAIL_COMERCIAL` ou `EMAIL_GERAL` conta como um destinatário por pedido, e o pedido de teste do passo 4 também conta.
- **Quando já restam poucos** (a conta só pode enviar mais 10 pedidos ou menos nesse dia), cada email avisa no fim quantos ainda podem seguir.
- **Quando a quota acaba**, o email desse pedido não segue. O pedido fica na folha, com «O email não seguiu: a quota diária de emails da conta acabou» em «Notas», e o visitante vê no site o aviso de que o pedido não seguiu (o que escreveu continua no formulário, com o telefone para ligar). A Google repõe a quota ao fim de um período de 24 horas.
- **A quota pode ser gasta de propósito.** O endereço `/exec` está nas páginas do site, e qualquer pessoa pode enviar-lhe pedidos falsos sem passar pelo formulário. O travão (a seguir) trava enxurradas, mas deixa passar 30 pedidos em cada 10 minutos: numa conta gratuita, isso chega para gastar a quota de um dia em menos de uma hora. Se acontecer, os pedidos verdadeiros desse dia continuam na folha, com o motivo em «Notas»: veja a folha e contacte esses clientes. Se se repetir, pode baixar o travão (`JANELA_MAX`, no início do script) e publicar a versão nova (ver «Mudar o script mais tarde»).
- **Travão contra enxurradas**: no máximo 30 pedidos em cada 10 minutos, contando o site inteiro. Acima disso, o script recusa o pedido e o visitante vê o mesmo aviso de falha. Os números estão no início do script (`JANELA_MAX` e `JANELA_S`). Se a cache da Google, onde o travão conta os pedidos, falhar, o pedido passa na mesma.
- **Pedidos repetidos**: se a resposta de um pedido se perder na rede e o cliente carregar em «Tentar novamente», o site manda outra vez o mesmo identificador e o script responde com a referência do primeiro, sem outro email nem outra linha na folha. O script lembra-se de cada pedido durante 6 horas, na mesma cache; se a cache falhar, o pedido segue (mais vale um email repetido do que um pedido perdido).
- **Fotografia**: uma imagem até 8 MB, como no site. O anexo só segue se o conteúdo do ficheiro for mesmo de uma fotografia em JPG, PNG, HEIC ou HEIF, WEBP, AVIF, GIF, BMP ou TIFF, e o nome do anexo leva a extensão desse formato (o resto do nome é o do cliente). Um ficheiro que se diz imagem mas não é nenhum destes formatos (por exemplo, um SVG, que pode levar código) não segue: o pedido chega sem anexo, o email diz que a fotografia não seguiu e a folha também. Nesse caso, se precisar da fotografia, peça-a ao cliente. Um ficheiro que nem se diz imagem (um PDF, uma página HTML) faz recusar o pedido; o site não deixa escolher estes ficheiros.
- **Robôs**: um pedido com o campo escondido `bot-field` preenchido recebe uma resposta de sucesso, mas não envia email nem escreve na folha.

## Fotografias

Seguem **só como anexo do email**. O script não as guarda no Google Drive nem na folha: na folha fica apenas o nome do ficheiro. Ficam com os emails do pedido, na caixa de correio de quem os recebe. Veja também a pasta dos enviados da conta Google que corre o script, que pode guardar uma cópia de cada email.

## Privacidade

- Cada pedido fica em dois sítios: nos emails do pedido, no serviço de email dos endereços em `EMAIL_COMERCIAL` e `EMAIL_GERAL`; e na folha de cálculo, no Google Drive da conta que corre o script. A Google fornece o Apps Script e a folha de cálculo dessa conta.
- O endereço `/exec` só recebe pedidos novos: não mostra pedidos, a folha ou o código.
- Partilhe a folha só com quem trata dos pedidos.
- Para apagar os dados de um cliente, siga «Apagar os dados de um cliente», a seguir. Apagar a linha na folha não chega: ela continua no histórico de versões da folha.
- A política de privacidade do site (`src/pages/privacidade.html`) explica para onde vão os pedidos. Se mudar a conta Google, os endereços que recebem os pedidos ou o que o script guarda, confirme que a política continua certa.
- Diga a quem rever a política (README.md, «Privacidade») que tipo de conta Google corre o script, gratuita ou do Google Workspace: os termos em que a Google trata os dados não são os mesmos.

## Apagar os dados de um cliente

Quando um cliente pede para apagar os seus dados:

1. **Na folha**, apague a linha do pedido (ou as linhas, se ele fez mais de um pedido).
2. **No email**, apague os emails desse pedido e as respostas trocadas com o cliente, na caixa de correio de quem os recebeu e nos enviados da conta Google que corre o script. Depois esvazie o lixo do email nas duas contas: enquanto lá estiverem, os emails podem ser recuperados.
3. **No histórico da folha.** A linha apagada continua no histórico de versões da folha (**File** → **Version history**, Ficheiro → Histórico de versões): quem pode editar a folha ainda a vê lá e pode repor uma versão antiga. Para a tirar também daí:
   - passe a folha para um ficheiro novo, como se explica a seguir: uma cópia começa sem histórico. Não confirmámos se o histórico das folhas do Google deixa apagar versões; a ajuda da Google «Find what's changed in a file» (https://support.google.com/docs/answer/190843) explica o que o histórico permite.
4. **No Netlify**, se o pedido chegou sem JavaScript (ver «Quando o script não está ligado»): no painel do Netlify, em **Forms**, apague esse pedido nos formulários `orcamento` e `orcamento-comercial`.
5. **No Claude**, se a equipa passou o pedido ao Claude para fazer a proposta (skill «ORÇAMENTO MDM»): apague essa conversa no claude.ai, e a proposta guardada (o PDF ou o HTML), onde estiver. A página interna da equipa (`equipa/proposta.html`) guarda o formulário e as propostas só no separador do browser: fechar o separador apaga-os.

### Passar a folha para um ficheiro novo

O script está dentro da folha. Por isso, trocar de ficheiro obriga a publicar o script de novo e a mudar o endereço no site.

1. Na folha antiga, já sem a linha do cliente, escolha **File** → **Make a copy** (Ficheiro → Fazer uma cópia) e dê à cópia o nome **Pedidos do site MDM**. A cópia leva também uma cópia do script.
2. Na cópia, abra **Extensions** → **Apps Script**. Em **Project Settings**, confirme que as propriedades do passo 3 estão lá; se faltarem, acrescente-as.
3. Faça com a cópia os passos 4, 5 e 6. O endereço `/exec` da cópia é novo: é esse que vai para `pedidosUrl`.
4. Quando o site já estiver publicado com o endereço novo, veja se chegaram pedidos à folha antiga entretanto e passe essas linhas para a cópia.
5. Só então apague a folha antiga no Google Drive e, no lixo do Drive, apague-a para sempre. O script antigo, que está dentro dela, deixa de receber pedidos.
6. Partilhe a cópia com quem trata dos pedidos.

## Quando o script não está ligado

- **Sem `pedidosUrl`** em `site.json`, o site envia os pedidos para o Netlify Forms, como antes.
- **Visitantes sem JavaScript** (poucos) continuam a enviar pelo envio normal da página, para o Netlify Forms. Esses pedidos aparecem no painel do Netlify, em **Forms**. Para não os perder, ligue os avisos por email desse formulário no painel do Netlify (README.md, «Encaminhamento dos pedidos») ou veja esse painel de vez em quando.

## Quando algo corre mal

- No editor do Apps Script, na barra da esquerda, **Executions** mostra cada pedido e os avisos do script: «Pedido recusado: …», «o email não seguiu: …», «a linha não ficou na folha: …». Estes avisos não levam dados do cliente: nem nomes, nem telefones, nem mensagens, e os endereços de email aparecem como «[email]».
- **A ordem é: primeiro a folha, depois o email.** Assim, se a folha falhar (por exemplo, foi apagada ou o separador está ocupado), o email segue na mesma e diz no fim «Atenção: este pedido não ficou na folha «Pedidos» (…). Guarde este email.» Se for o email a falhar, a linha fica na folha com o motivo em «Notas» e o visitante vê o aviso de falha, para tentar de novo ou ligar. Se tentar de novo, o pedido pode aparecer duas vezes na folha.
- Se um pedido está na folha sem «Notas» mas o email não aparece, veja a pasta de spam do endereço que devia recebê-lo.
- Se o site disser sempre que o pedido não seguiu, confirme que o endereço em `pedidosUrl` é o da implementação ativa (acaba em `/exec`), que **Who has access** está em **Anyone** e que `EMAIL_COMERCIAL` está preenchido.

## Para quem mexe no código

- **O formato do pedido** (o que o site envia e o que o script responde) está no comentário do início de `pedidos.gs`. O site envia `POST` com `Content-Type: text/plain;charset=utf-8` e o JSON no corpo; o script responde `{"ok":true,"ref":"…"}` ou `{"ok":false,"erro":"…"}`, sempre com o código HTTP 200 (o Apps Script não deixa escolher outro).
- **`python3 build.py --check`** lê de `pedidos.gs` a lista `CAMPOS` e os limites `CAMPO_MAX`, `FOTO_MAX` e `PEDIDO_MAX` e confere-os com o formulário e o `site.js`. Mantenha-os escritos como estão (`const NOME = número;`, ou números multiplicados).
- **`FOLHA_ID`** só é preciso se o script for criado à parte, em script.google.com, sem estar ligado a uma folha. Aceita o ID da folha ou o endereço inteiro.
- **Testes**, a partir de `website/`: `node tests/apps-script.mjs`. Corre o script em Node com imitações dos serviços da Google (sem rede e sem conta) e termina com «tudo certo». Outros testes podem importar `carregaScript()` desse ficheiro para pôr o script a responder a pedidos do site, e `fotoAmostra()` para ter os bytes de uma fotografia que o script aceita em anexo.
