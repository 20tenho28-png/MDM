# MDM

Este repositório contém **dois serviços independentes** que partilham a mesma
infraestrutura (FastAPI + SQLAlchemy async + PostgreSQL + Jinja2/HTMX/Tailwind):

1. **`mdm`** — rastreador de *tickets* de email por IMAP, com mural para TV.
2. **`stock`** — dashboard de gestão de stock de material elétrico e tubo de cobre,
   com atualização automática a partir de guias de compras.
3. **`agua`** — mapa interativo (só consulta) de fontes/chafarizes e nascentes em
   Portugal, com dados do OpenStreetMap.

## Pré-requisitos

```bash
pip install -e ".[dev]"
docker compose up -d        # PostgreSQL
alembic upgrade head        # cria tabelas de ambos os serviços
```

## Correr os serviços

Cada serviço é uma app FastAPI própria, lançada em portas distintas:

```bash
# Rastreador de tickets (app mdm)
uvicorn mdm.main:app --reload --port 8000

# Dashboard de stock (app stock)
uvicorn stock.main:app --reload --port 8001

# Mapa de água potável e fontes (app agua)
uvicorn agua.main:app --reload --port 8002
```

## Mapa de Água (`agua`)

Mapa interativo (só consulta) de **fontes/chafarizes** (`amenity=fountain`) e
**nascentes** (`natural=spring`) em Portugal, com indicação de potabilidade
(do tag `drinking_water`). Frontend em Leaflet + markercluster.

- **`/`** — mapa com filtros por tipo e potabilidade e pesquisa por nome.
- **`/api/pontos.geojson`** — pontos em GeoJSON (aceita `?tipo=` e `?potavel=`).
- **`/api/stats`** — contagens agregadas.

Dados:

```bash
# Importar de OpenStreetMap (requer rede aberta para o Overpass API):
python -m agua.importer

# Alternativa para arranque rápido / redes restritas: seed de exemplo:
python -m agua.seed
```

> Nota: a importação do Overpass precisa de acesso de saída ao
> `overpass-api.de`. Em ambientes com rede restrita a importação falha; nesse
> caso use `python -m agua.seed` para carregar um conjunto de pontos de exemplo.
> Os tiles do mapa são carregados pelo browser (OpenStreetMap).

## Dashboard de Stock (`stock`)

- **`/`** — stock atual (KPIs + tabela, com destaque de stock baixo) e auto-refresh.
- **`/guias/nova`** — carregar uma guia de compras em **CSV, Excel (.xlsx) ou PDF**.
  As linhas são lidas automaticamente; escolhe-se a categoria (material elétrico /
  tubo de cobre) aplicada aos artigos novos dessa guia.
- **`/guias/{id}/rever`** — rever as linhas extraídas (e quais os artigos novos)
  **antes** de aplicar ao stock. A confirmação cria as entradas de forma atómica.
- **`/saida`** — registar saídas/consumo. Saídas que excedam o stock são permitidas
  mas mostram um aviso (o stock pode ficar negativo).
- **`/artigos`** — gestão de artigos (criar/editar/eliminar, definir stock mínimo).

Configuração via variáveis `STOCK_*` (ver `.env.example`). Por omissão usa a mesma
base de dados PostgreSQL do `mdm`, com tabelas próprias (`artigos`,
`movimentos_stock`, `guias_compra`).

## Testes

```bash
pytest
```
