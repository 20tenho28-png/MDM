"""Web routes for the stock dashboard (PT-PT).

`GET /`                 dashboard com KPIs + tabela de stock atual
`GET /stock`            partial HTMX auto-refresh da tabela
`GET /guias/nova`       formulário de upload de guia
`POST /guias`           cria guia pendente -> redireciona para revisão
`GET /guias/{id}/rever` ecrã de revisão das linhas parseadas
`POST /guias/{id}/confirmar`  aplica as entradas ao stock
`GET|POST /saida`       registar saída/consumo
`GET /artigos` + CRUD   gestão de artigos
"""
from __future__ import annotations

from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from stock.config import Settings, get_settings
from stock.db import get_sessionmaker
from stock.models import Categoria
from stock.services import artigos as artigos_svc
from stock.services import guias as guias_svc
from stock.services import stock as stock_svc

TEMPLATE_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


def stock_class(artigo) -> str:
    """CSS class reflecting stock health, reusing the base.html vocabulary."""
    if artigo.stock_atual <= artigo.stock_minimo:
        return "card-red"
    if artigo.stock_atual <= artigo.stock_minimo * 1.5:
        return "card-yellow"
    return "card-green"


CATEGORIA_LABELS = {
    Categoria.material_eletrico: "Material Elétrico",
    Categoria.tubo_cobre: "Tubo de Cobre",
}

templates.env.filters["stock_class"] = stock_class
templates.env.globals["categoria_label"] = lambda c: CATEGORIA_LABELS.get(c, c)
templates.env.globals["categorias"] = list(Categoria)


router = APIRouter()


async def _session() -> AsyncSession:  # pragma: no cover - thin wrapper
    sm = get_sessionmaker()
    async with sm() as session:
        yield session


async def _stock_context(session: AsyncSession, settings: Settings) -> dict:
    artigos = await artigos_svc.listar_artigos(session)
    indicadores = await stock_svc.kpis(session)
    return {
        "artigos": artigos,
        "kpis": indicadores,
        "wall_refresh_seconds": settings.wall_refresh_seconds,
    }


@router.get("/", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    session: AsyncSession = Depends(_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    ctx = await _stock_context(session, settings)
    return templates.TemplateResponse(request, "dashboard.html", ctx)


@router.get("/stock", response_class=HTMLResponse)
async def stock_partial(
    request: Request,
    session: AsyncSession = Depends(_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    ctx = await _stock_context(session, settings)
    return templates.TemplateResponse(request, "partials/stock_table.html", ctx)


@router.get("/guias/nova", response_class=HTMLResponse)
async def upload_form(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request, "guias_upload.html", {})


@router.post("/guias")
async def upload_guia(
    ficheiro: UploadFile = File(...),
    categoria: str = Form(...),
    fornecedor: str = Form(""),
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    try:
        cat = Categoria(categoria)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Categoria inválida.") from exc

    content = await ficheiro.read()
    async with session.begin():
        guia = await guias_svc.criar_guia_pendente(
            session,
            filename=ficheiro.filename or "guia",
            content=content,
            categoria=cat,
            fornecedor=fornecedor or None,
        )
    return RedirectResponse(url=f"/guias/{guia.id}/rever", status_code=303)


@router.get("/guias/{guia_id}/rever", response_class=HTMLResponse)
async def guia_review(
    guia_id: str,
    request: Request,
    session: AsyncSession = Depends(_session),
) -> HTMLResponse:
    guia = await guias_svc.get_guia(session, guia_id)
    if guia is None:
        raise HTTPException(status_code=404, detail="Guia não encontrada.")

    # Annotate each line with whether the article already exists.
    linhas = []
    for linha in guia.linhas_raw or []:
        existente = await artigos_svc.get_por_referencia(
            session, str(linha["referencia"])
        )
        linhas.append({**linha, "novo": existente is None})

    return templates.TemplateResponse(
        request, "guia_review.html", {"guia": guia, "linhas": linhas}
    )


@router.post("/guias/{guia_id}/confirmar")
async def confirmar_guia(
    guia_id: str,
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    async with session.begin():
        guia = await guias_svc.confirmar_guia(session, guia_id)
    if guia is None:
        raise HTTPException(status_code=404, detail="Guia não encontrada.")
    return RedirectResponse(url="/", status_code=303)


@router.get("/saida", response_class=HTMLResponse)
async def saida_form(
    request: Request,
    session: AsyncSession = Depends(_session),
    aviso: str | None = None,
) -> HTMLResponse:
    artigos = await artigos_svc.listar_artigos(session)
    return templates.TemplateResponse(
        request, "saida.html", {"artigos": artigos, "aviso": aviso}
    )


@router.post("/saida", response_model=None)
async def registar_saida(
    request: Request,
    artigo_id: str = Form(...),
    quantidade: int = Form(...),
    nota: str = Form(""),
    session: AsyncSession = Depends(_session),
) -> HTMLResponse | RedirectResponse:
    if quantidade <= 0:
        raise HTTPException(status_code=400, detail="A quantidade deve ser positiva.")

    async with session.begin():
        artigo = await artigos_svc.get_artigo(session, artigo_id)
        if artigo is None:
            raise HTTPException(status_code=404, detail="Artigo não encontrado.")
        resultado = await stock_svc.registar_saida(
            session, artigo=artigo, quantidade=quantidade, nota=nota or None
        )

    if resultado.aviso:
        # Re-render the form with the warning instead of redirecting.
        artigos = await artigos_svc.listar_artigos(session)
        return templates.TemplateResponse(
            request,
            "saida.html",
            {"artigos": artigos, "aviso": resultado.aviso},
        )
    return RedirectResponse(url="/", status_code=303)


@router.get("/artigos", response_class=HTMLResponse)
async def listar_artigos(
    request: Request,
    session: AsyncSession = Depends(_session),
) -> HTMLResponse:
    artigos = await artigos_svc.listar_artigos(session)
    return templates.TemplateResponse(
        request, "artigos.html", {"artigos": artigos}
    )


@router.post("/artigos")
async def criar_artigo(
    referencia: str = Form(...),
    descricao: str = Form(""),
    categoria: str = Form(...),
    unidade: str = Form("un"),
    stock_minimo: int = Form(0),
    localizacao: str = Form(""),
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    try:
        cat = Categoria(categoria)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Categoria inválida.") from exc
    async with session.begin():
        existente = await artigos_svc.get_por_referencia(session, referencia)
        if existente is not None:
            raise HTTPException(
                status_code=400, detail="Já existe um artigo com essa referência."
            )
        await artigos_svc.criar_artigo(
            session,
            referencia=referencia,
            descricao=descricao,
            categoria=cat,
            unidade=unidade,
            stock_minimo=stock_minimo,
            localizacao=localizacao or None,
        )
    return RedirectResponse(url="/artigos", status_code=303)


@router.post("/artigos/{artigo_id}")
async def editar_artigo(
    artigo_id: str,
    descricao: str = Form(""),
    categoria: str = Form(...),
    unidade: str = Form("un"),
    stock_minimo: int = Form(0),
    localizacao: str = Form(""),
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    try:
        cat = Categoria(categoria)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Categoria inválida.") from exc
    async with session.begin():
        artigo = await artigos_svc.editar_artigo(
            session,
            artigo_id,
            descricao=descricao,
            categoria=cat,
            unidade=unidade,
            stock_minimo=stock_minimo,
            localizacao=localizacao or None,
        )
    if artigo is None:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")
    return RedirectResponse(url="/artigos", status_code=303)


@router.post("/artigos/{artigo_id}/eliminar")
async def eliminar_artigo(
    artigo_id: str,
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    async with session.begin():
        ok = await artigos_svc.eliminar_artigo(session, artigo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Artigo não encontrado.")
    return RedirectResponse(url="/artigos", status_code=303)
