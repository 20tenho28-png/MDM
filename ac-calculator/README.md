# Calculadora de ar condicionado (MDM Assist)

Ferramenta para clientes: calcula a potência de ar condicionado (bomba de calor
ar-ar) que cada divisão precisa, em BTU/h e kW, e prepara o pedido de
orçamento. Em português europeu, pensada para telemóvel, com a linguagem de
design do site da MDM (Lora / Inter / JetBrains Mono, creme, tinta e vermelho,
botões em pílula, cartões de 10 px).

## Fluxo (4 passos, como os configuradores dos fabricantes)

1. **Selecionar**: 1 divisão ou várias (até 5), idade do edifício, quer
   aquecer no inverno.
2. **Dimensionamento**: por divisão, nome, área (m²), altura (cm), área de
   janelas (m²), sombreamento, orientação, pessoas, último andar, equipamentos
   que aquecem (escritório, cozinha). A potência recomendada atualiza ao
   escrever, com o detalhe "Como chegámos a este valor".
3. **Localização**: código postal. Dá a zona climática de verão e inverno do
   REH (V1/V2/V3, I1/I2/I3) e diz se a morada está na Área Metropolitana de
   Lisboa (área de intervenção da MDM).
4. **Resultado**: unidade por divisão (9 000 / 12 000 / 18 000 / 24 000 BTU),
   total, comparação mono-split vs multi-split, verificação de aquecimento,
   "Como calculámos", e botões para pedir orçamento por WhatsApp, telefone ou
   email com o resumo já escrito. Imprime ou guarda em PDF.

O estado fica em `localStorage` para o cliente poder voltar.

## Como correr

- **Pela app MDM:** `uvicorn mdm.main:app --reload` e abrir
  `http://localhost:8000/calculadora`.
- **Sozinha:** `python -m http.server 8080` nesta pasta e abrir
  `http://localhost:8080/` (módulos ES não funcionam por `file://`).

## Ficheiros

| Ficheiro | Para que serve |
| --- | --- |
| `index.html` | Página, CSS e os tokens de design |
| `app.js` | Interface: passos, formulários, barra fixa, folha de contacto |
| `calc_model.js` | Modelo de cálculo, **sem DOM**, com todas as constantes no topo |
| `prices.js` | Tabela de preços "desde" (opcional, `null` por omissão) |
| `test/calc.test.mjs` | Testes do modelo (`node ac-calculator/test/calc.test.mjs`) |

## O modelo em duas linhas

Carga de frio por divisão (W) = [envolvente (W/m³ × volume × idade do
edifício) + sol pelas janelas (m² × orientação × sombreamento × tipo de vidro)
+ telhado em último andar] × zona climática + pessoas e equipamentos, tudo
× 1,05 de margem e arredondado a 10 W. Converte-se para BTU/h (× 3,412) e
escolhe-se a classe comercial mais pequena que cobre a carga; acima de 7 kW
divide-se por n unidades iguais. Para 2 a 5 divisões a unidade exterior do multi-split é
escolhida com um fator de simultaneidade e respeitando a soma máxima de
interiores ligáveis. Com aquecimento pedido, verifica-se a capacidade de calor
da unidade num dia frio da zona de inverno (com perda de capacidade pelo frio).

Todas as constantes (`K`, `UNIT_CLASSES`, `MULTI_OUTDOOR`, zonas e intervalos
de código postal) estão no topo de `calc_model.js` para um técnico as rever.

## Preços

Regra da casa: nunca inventar preços. Enquanto `PRICES` em `prices.js` for
`null`, a calculadora não mostra euros e remete para o orçamento gratuito.
Para mostrar "desde X €", preencher a tabela como está exemplificado no
ficheiro.

## Testes

```bash
node ac-calculator/test/calc.test.mjs   # a partir da raiz do repositório
python -m pytest tests/test_calculator.py
```

O `pytest` corre também os testes Node e confirma que as páginas e módulos são
servidos em `/calculadora` e que o modelo continua sem DOM e sem travessões.
