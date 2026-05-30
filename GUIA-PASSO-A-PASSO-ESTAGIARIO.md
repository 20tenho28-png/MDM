# Guia passo a passo (estagiário)
## Implementar e visualizar o website MDM Assist

Este guia explica, de forma prática, como levantar o projeto localmente, editar páginas e validar se tudo está correto antes de publicar.

---

## 1) Pré-requisitos

Instalar no computador:
- **Git**
- **VS Code** (ou editor equivalente)
- **Python 3** (para correr servidor local)

Verificar versões no terminal:
```bash
git --version
python3 --version
```

---

## 2) Obter o projeto

```bash
git clone <URL_DO_REPOSITORIO>
cd MDM
```

Se já tens o repositório:
```bash
cd MDM
git pull
```

---

## 3) Entender a estrutura de ficheiros

Ficheiros principais:
- `index.html` → Homepage comercial principal
- `styles.css` → Estilos globais (cores, tipografia, botões, grids)
- `script.js` → Comportamento do menu mobile
- `servicos.html` → Visão geral de serviços
- `instalacao-ar-condicionado.html` → Serviço de instalação
- `manutencao-assistencia.html` → Manutenção e assistência
- `orcamento.html` → Página dedicada a pedido de orçamento
- `avaliacoes.html` → Página de prova social / reviews
- `projetos.html` → Projetos e trabalhos realizados
- `sobre.html` → História e posicionamento da empresa
- `contactos.html` → Contactos e localização
- `AUDITORIA-E-PLANO.md` → Estratégia comercial e roadmap

---

## 4) Visualizar o site no browser (local)

Na pasta do projeto:
```bash
python3 -m http.server 5500
```

Abrir no browser:
- `http://localhost:5500/index.html`

Para parar o servidor: `Ctrl + C` no terminal.

---

## 5) Fluxo de trabalho recomendado (sempre)

1. Criar branch de trabalho:
```bash
git checkout -b feat/nome-da-tarefa
```

2. Fazer alterações nos ficheiros.

3. Testar no browser (desktop + mobile).

4. Rever mudanças:
```bash
git status
git diff
```

5. Commit:
```bash
git add -A
git commit -m "Descrição curta da tarefa"
```

6. Enviar branch:
```bash
git push -u origin feat/nome-da-tarefa
```

---

## 6) Como editar a homepage (index.html)

Secções principais da homepage:
1. Topbar (contacto rápido)
2. Header + navegação
3. Hero (proposta de valor + CTAs)
4. Serviços principais
5. Processo (3 passos)
6. Avaliações
7. Áreas de atuação
8. Formulário de orçamento
9. FAQ
10. Footer

### Regras rápidas
- Manter linguagem direta e comercial.
- Repetir CTA “Pedir Orçamento” em zonas estratégicas.
- Evitar blocos longos de texto.

---

## 7) Como editar estilos (styles.css)

Ordem sugerida para alterar design:
1. Variáveis em `:root` (cores e tokens globais)
2. Componentes (`.btn`, `.card`, `.section-title`)
3. Layout (`.container`, `.cards`, `.hero-grid`)
4. Responsivo (`@media (max-width: 900px)`)

### Boas práticas
- Não duplicar estilos se já existir classe reutilizável.
- Validar contraste de texto em fundos escuros.
- Testar sempre em ecrãs pequenos.

---

## 8) Como editar menu mobile (script.js)

O `script.js` atual:
- abre/fecha menu mobile no botão de menu;
- fecha menu quando o utilizador clica num link âncora.

Se mexeres no HTML do menu, confirma:
- presença de `data-menu-toggle` no botão;
- presença de `data-menu` na navegação.

---

## 9) Checklist de qualidade antes de terminar

### Visual/UI
- [ ] Homepage abre sem layout partido
- [ ] Botões principais visíveis e clicáveis
- [ ] Menu mobile abre e fecha corretamente
- [ ] Formulário aparece completo

### Conteúdo/CRO
- [ ] Proposta de valor clara no hero
- [ ] Telefone visível
- [ ] CTA “Pedir Orçamento” em destaque
- [ ] Avaliações presentes

### Técnico
- [ ] Sem links quebrados entre páginas
- [ ] Sem erros de consola no browser
- [ ] Site legível em mobile

---

## 10) Como validar links internos rapidamente

No terminal, confirmar ficheiros HTML:
```bash
ls *.html
```

No browser, testar manualmente navegação:
- Home → Serviços
- Home → Orçamento
- Home → Contactos
- Serviços → páginas específicas

---

## 11) Processo de entrega (estagiário)

1. Garantir checklist completa.
2. Commit final com mensagem clara.
3. Abrir Pull Request com:
   - O que foi alterado
   - Porque foi alterado
   - Como foi testado
4. Pedir revisão ao responsável.

---

## 12) Problemas comuns e solução rápida

### “O CSS não está a atualizar”
- Fazer hard refresh no browser (`Ctrl+Shift+R`).

### “Página abre sem estilos”
- Confirmar se `styles.css` está na mesma pasta do HTML.

### “Menu mobile não funciona”
- Confirmar se `script.js` está importado no fim do `body`.
- Confirmar atributos `data-menu-toggle` e `data-menu`.

### “Não consigo ver o site localmente”
- Confirmar se o servidor foi iniciado com `python3 -m http.server 5500`.
- Confirmar URL: `http://localhost:5500/index.html`.

---

## 13) Objetivo final (o que nunca esquecer)

Este site é comercial. Cada secção deve ajudar o visitante a pensar:
- “Esta empresa é de confiança.”
- “É rápido pedir orçamento.”
- “Vou contactar agora.”

