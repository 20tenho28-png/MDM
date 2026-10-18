"""Páginas do ERP, em /erp.

`GET  /erp`                          painel do dia: visitas de hoje, por marcar, relatórios sem visita, peças
`GET  /erp/agenda?semana=AAAA-MM-DD` a semana de visitas, por dia (e por técnico com `tecnico=`)
`GET  /erp/por-marcar`               visitas à espera de dia, P1 primeiro
`GET  /erp/clientes`                 clientes, com pesquisa; ficha em /erp/clientes/{id}
`GET  /erp/visitas/{id}`             ficha da visita; editar, marcar, cancelar, abrir o relatório
`GET  /erp/ri`                       a app dos relatórios de intervenção (FM-TEC-04), com a ponte para o ERP
`POST /erp/api/relatorios`           recebe da app os relatórios emitidos (JSON); também em /erp/relatorios/importar
`GET  /erp/relatorios/{numero}`      o relatório recebido; ligado à visita, que fica feita
`GET  /erp/exportar/agenda.csv`      uma linha por visita, para a pasta dados/agenda/ do funil
"""
from __future__ import annotations

import csv
import io
import json
import re
import secrets
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import quote, urlsplit

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.templating import Jinja2Templates
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mdm.config import Settings, get_settings
from mdm.db import get_sessionmaker
from mdm.erp import service as s
from mdm.erp.models import (
    ESTADOS_RELATORIO,
    ESTADOS_VISITA,
    PRIORIDADES,
    RESULTADOS,
    TIPOS_TRABALHO,
    Cliente,
    Equipamento,
    Tecnico,
    Visita,
)

TEMPLATE_DIR = Path(__file__).parent / "templates"
STATIC_DIR = Path(__file__).parent / "static"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals.update(
    TIPOS_TRABALHO=TIPOS_TRABALHO, ESTADOS_VISITA=ESTADOS_VISITA, RESULTADOS=RESULTADOS, PRIORIDADES=PRIORIDADES,
    ESTADOS_RELATORIO=ESTADOS_RELATORIO, DIAS_SEMANA=s.DIAS_SEMANA, duracao_relatorio=s.duracao_relatorio,
    ref_visita=s.ref_visita,
)


def _data_pt(valor) -> str:
    return valor.strftime("%d/%m/%Y") if valor else ""


def _hora(valor) -> str:
    return valor.strftime("%H:%M") if valor else ""


def _num(valor, casas: int = 2) -> str:
    if valor is None:
        return ""
    return f"{valor:.{casas}f}".rstrip("0").rstrip(",.").replace(".", ",") if casas else f"{valor:.0f}"


def _equipamentos(lista) -> list:
    campos = ("marca", "modelo", "serie", "localizacao", "refrigerante", "carga_kg")
    return [e for e in lista or [] if isinstance(e, dict) and any(str(e.get(k) or "").strip() for k in campos)]


templates.env.filters.update(data_pt=_data_pt, hora=_hora, num=_num, equipamentos=_equipamentos)

_basic = HTTPBasic(auto_error=False)


def autenticar(credenciais: HTTPBasicCredentials | None = Depends(_basic),
               settings: Settings = Depends(get_settings)) -> None:
    """Com ERP_UTILIZADOR e ERP_PALAVRA_PASSE definidos, o ERP pede-os. Sem eles fica aberto (só para a rede local)."""
    if not settings.erp_utilizador:
        return
    certo = credenciais is not None and secrets.compare_digest(
        credenciais.username.encode(), settings.erp_utilizador.encode()) and secrets.compare_digest(
        credenciais.password.encode(), settings.erp_palavra_passe.encode())
    if not certo:
        raise HTTPException(status_code=401, detail="Credenciais do ERP em falta ou erradas.",
                            headers={"WWW-Authenticate": 'Basic realm="MDM ERP"'})


def mesma_origem(request: Request) -> None:
    """Um formulário de outro site não pode escrever no ERP com as credenciais guardadas no browser."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    origem = request.headers.get("origin") or request.headers.get("referer") or ""
    if origem and urlsplit(origem).netloc != request.headers.get("host", ""):
        raise HTTPException(status_code=403, detail="Pedido de outro site recusado.")


router = APIRouter(prefix="/erp", dependencies=[Depends(autenticar), Depends(mesma_origem)])


async def _session():  # pragma: no cover - thin wrapper
    sm = get_sessionmaker()
    async with sm() as session:
        yield session


def _pagina(request: Request, nome: str, settings: Settings, **ctx) -> HTMLResponse:
    ctx.setdefault("erro", request.query_params.get("erro", ""))
    ctx.setdefault("aviso", request.query_params.get("aviso", ""))
    ctx["empresa"] = settings
    ctx["hoje"] = s.agora().date()
    return templates.TemplateResponse(request, f"erp/{nome}", ctx)


def _ir(url: str, erro: str = "", aviso: str = "") -> RedirectResponse:
    if erro or aviso:
        url += ("&" if "?" in url else "?") + ("erro=" + quote(erro) if erro else "aviso=" + quote(aviso))
    return RedirectResponse(url=url, status_code=303)


async def _ou_404(session: AsyncSession, modelo, id_: int):
    obj = await session.get(modelo, id_)
    if obj is None:
        raise HTTPException(status_code=404, detail="Não existe.")
    return obj


# ---------------------------------------------------------------- painel e agenda


@router.get("", response_class=HTMLResponse)
async def painel(request: Request, session: AsyncSession = Depends(_session),
                 settings: Settings = Depends(get_settings)) -> HTMLResponse:
    hoje = s.agora().date()
    return _pagina(
        request, "painel.html", settings,
        de_hoje=await s.visitas_entre(session, hoje, hoje + timedelta(days=1)),
        por_marcar=await s.visitas_por_marcar(session),
        sem_visita=[i for i in await s.listar_relatorios(session, limite=500) if i.visita_id is None],
        previstas=await s.manutencoes_previstas(session, hoje + timedelta(days=30)),
        pecas=await s.a_espera_de_peca(session),
        semana=len(await s.visitas_entre(session, s.inicio_da_semana(hoje), s.inicio_da_semana(hoje)
                                         + timedelta(days=7))),
    )


@router.get("/agenda", response_class=HTMLResponse)
async def agenda(request: Request, semana: str = "", tecnico: str = "", session: AsyncSession = Depends(_session),
                 settings: Settings = Depends(get_settings)) -> HTMLResponse:
    try:
        base = s.ler_data(semana) or s.agora().date()
    except s.Invalido:
        base = s.agora().date()
    inicio = s.inicio_da_semana(base)
    tecnico_id = s.ler_id(tecnico)
    visitas = await s.visitas_entre(session, inicio, inicio + timedelta(days=7), tecnico_id)
    dias = [inicio + timedelta(days=i) for i in range(7)]
    por_dia = {d: [v for v in visitas if v.inicio.date() == d] for d in dias}
    # Domingo só aparece se houver alguma visita.
    if not por_dia[dias[-1]]:
        dias = dias[:-1]
    return _pagina(request, "agenda.html", settings, dias=dias, por_dia=por_dia, inicio=inicio,
                   anterior=inicio - timedelta(days=7), seguinte=inicio + timedelta(days=7),
                   tecnicos=await s.tecnicos_ativos(session), tecnico_id=tecnico_id)


@router.get("/por-marcar", response_class=HTMLResponse)
async def por_marcar(request: Request, session: AsyncSession = Depends(_session),
                     settings: Settings = Depends(get_settings)) -> HTMLResponse:
    return _pagina(request, "por_marcar.html", settings, visitas=await s.visitas_por_marcar(session),
                   pecas=await s.a_espera_de_peca(session))


# ---------------------------------------------------------------- clientes e equipamentos


@router.get("/clientes", response_class=HTMLResponse)
async def clientes(request: Request, q: str = "", dia: str = "", session: AsyncSession = Depends(_session),
                   settings: Settings = Depends(get_settings)) -> HTMLResponse:
    return _pagina(request, "clientes.html", settings, clientes=await s.procurar_clientes(session, q), q=q,
                   dia=dia if re.fullmatch(r"\d{4}-\d{2}-\d{2}", dia) else "")


@router.get("/clientes/novo", response_class=HTMLResponse)
async def cliente_novo(request: Request, settings: Settings = Depends(get_settings)) -> HTMLResponse:
    return _pagina(request, "cliente_form.html", settings, cliente=None)


@router.post("/clientes")
async def cliente_criar(request: Request, session: AsyncSession = Depends(_session)) -> RedirectResponse:
    dados = await request.form()
    try:
        c = s.preencher_cliente(Cliente(criado_em=s.agora()), dados)
    except s.Invalido as erro:
        return _ir("/erp/clientes/novo", str(erro))
    session.add(c)
    await session.commit()
    return _ir(f"/erp/clientes/{c.id}", aviso="Cliente criado.")


@router.get("/clientes/{cliente_id}", response_class=HTMLResponse)
async def cliente_ficha(request: Request, cliente_id: int, editar: bool = False,
                        session: AsyncSession = Depends(_session),
                        settings: Settings = Depends(get_settings)) -> HTMLResponse:
    stmt = (select(Cliente).where(Cliente.id == cliente_id)
            .options(selectinload(Cliente.equipamentos),
                     selectinload(Cliente.visitas).selectinload(Visita.relatorios),
                     selectinload(Cliente.visitas).selectinload(Visita.tecnico)))
    c = (await session.execute(stmt)).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="Cliente não existe.")
    if editar:
        return _pagina(request, "cliente_form.html", settings, cliente=c)
    visitas = sorted(c.visitas, key=lambda v: v.inicio or v.criada_em, reverse=True)
    return _pagina(request, "cliente.html", settings, cliente=c, visitas=visitas)


@router.post("/clientes/{cliente_id}")
async def cliente_guardar(request: Request, cliente_id: int,
                          session: AsyncSession = Depends(_session)) -> RedirectResponse:
    c = await _ou_404(session, Cliente, cliente_id)
    try:
        s.preencher_cliente(c, await request.form())
    except s.Invalido as erro:
        await session.rollback()
        return _ir(f"/erp/clientes/{cliente_id}?editar=1", str(erro))
    await session.commit()
    return _ir(f"/erp/clientes/{cliente_id}", aviso="Guardado.")


@router.post("/clientes/{cliente_id}/equipamentos")
async def equipamento_criar(request: Request, cliente_id: int,
                            session: AsyncSession = Depends(_session)) -> RedirectResponse:
    await _ou_404(session, Cliente, cliente_id)
    try:
        e = s.preencher_equipamento(Equipamento(cliente_id=cliente_id), await request.form())
    except s.Invalido as erro:
        return _ir(f"/erp/clientes/{cliente_id}#equipamentos", str(erro))
    session.add(e)
    await session.commit()
    return _ir(f"/erp/clientes/{cliente_id}", aviso="Equipamento registado.")


# ---------------------------------------------------------------- técnicos


@router.get("/tecnicos", response_class=HTMLResponse)
async def tecnicos(request: Request, session: AsyncSession = Depends(_session),
                   settings: Settings = Depends(get_settings)) -> HTMLResponse:
    todos = list((await session.execute(select(Tecnico).order_by(Tecnico.ativo.desc(), Tecnico.nome))).scalars())
    return _pagina(request, "tecnicos.html", settings, tecnicos=todos)


@router.post("/tecnicos")
async def tecnico_criar(request: Request, session: AsyncSession = Depends(_session)) -> RedirectResponse:
    dados = await request.form()
    nome = s.texto(dados, "nome", 120)
    if not nome:
        return _ir("/erp/tecnicos", "O técnico precisa de um nome.")
    session.add(Tecnico(nome=nome, telefone=s.texto(dados, "telefone", 40), ativo=True))
    await session.commit()
    return _ir("/erp/tecnicos", aviso=f"{nome} acrescentado.")


@router.post("/tecnicos/{tecnico_id}/ativo")
async def tecnico_ativo(tecnico_id: int, session: AsyncSession = Depends(_session)) -> RedirectResponse:
    t = await _ou_404(session, Tecnico, tecnico_id)
    t.ativo = not t.ativo
    await session.commit()
    return _ir("/erp/tecnicos")


# ---------------------------------------------------------------- visitas


@router.get("/visitas/nova", response_class=HTMLResponse)
async def visita_nova(request: Request, cliente: int, dia: str = "", session: AsyncSession = Depends(_session),
                      settings: Settings = Depends(get_settings)) -> HTMLResponse:
    c = await _ou_404(session, Cliente, cliente)
    dia = dia if re.fullmatch(r"\d{4}-\d{2}-\d{2}", dia) else ""
    return _pagina(request, "visita_form.html", settings, cliente=c, visita=None, dia=dia,
                   tecnicos=await s.tecnicos_ativos(session))


@router.post("/visitas")
async def visita_criar(request: Request, session: AsyncSession = Depends(_session)) -> RedirectResponse:
    dados = await request.form()
    c = await _ou_404(session, Cliente, s.ler_id(dados.get("cliente_id")) or 0)
    try:
        v = s.nova_visita(c, dados)
    except s.Invalido as erro:
        return _ir(f"/erp/visitas/nova?cliente={c.id}", str(erro))
    session.add(v)
    await session.commit()
    aviso = f"Visita marcada para {v.inicio:%d/%m às %H:%M}." if v.inicio else "Visita por marcar."
    return _ir(f"/erp/visitas/{v.id}", aviso=aviso)


@router.get("/visitas/{visita_id}", response_class=HTMLResponse)
async def visita_ficha(request: Request, visita_id: int, editar: bool = False,
                       session: AsyncSession = Depends(_session),
                       settings: Settings = Depends(get_settings)) -> HTMLResponse:
    v = await s.obter_visita(session, visita_id)
    if v is None:
        raise HTTPException(status_code=404, detail="Visita não existe.")
    if editar:
        return _pagina(request, "visita_form.html", settings, cliente=v.cliente, visita=v, dia="",
                       tecnicos=await s.tecnicos_ativos(session))
    anterior = await s.obter_visita(session, v.anterior_id) if v.anterior_id else None
    return _pagina(request, "visita.html", settings, visita=v, anterior=anterior)


@router.post("/visitas/{visita_id}")
async def visita_guardar(request: Request, visita_id: int,
                         session: AsyncSession = Depends(_session)) -> RedirectResponse:
    v = await s.obter_visita(session, visita_id)
    if v is None:
        raise HTTPException(status_code=404, detail="Visita não existe.")
    try:
        s.preencher_visita(v, await request.form())
    except s.Invalido as erro:
        await session.rollback()
        return _ir(f"/erp/visitas/{visita_id}?editar=1", str(erro))
    await session.commit()
    return _ir(f"/erp/visitas/{visita_id}", aviso="Guardado.")


@router.post("/visitas/{visita_id}/cancelar")
async def visita_cancelar(request: Request, visita_id: int,
                          session: AsyncSession = Depends(_session)) -> RedirectResponse:
    v = await s.obter_visita(session, visita_id)
    if v is None:
        raise HTTPException(status_code=404, detail="Visita não existe.")
    try:
        s.cancelar_visita(v, s.texto(await request.form(), "motivo", 500))
    except s.Invalido as erro:
        return _ir(f"/erp/visitas/{visita_id}", str(erro))
    await session.commit()
    return _ir(f"/erp/visitas/{visita_id}", aviso="Visita cancelada.")


# ---------------------------------------------------------------- relatórios de intervenção

# A app dos técnicos (FM-TEC-04), tal como é usada no terreno. O ERP serve-a com uma ponte (ri-erp.js) que preenche
# o relatório a partir da visita e envia os relatórios emitidos para o escritório; a app em si não muda.
APP_RELATORIO = STATIC_DIR / "relatorio-intervencao.html"
PONTE = '<script src="/erp/static/ri-erp.js"></script>\n'


@router.get("/ri", response_class=HTMLResponse)
async def app_relatorio() -> HTMLResponse:
    html = APP_RELATORIO.read_text(encoding="utf-8")
    fim = html.rfind("</body>")
    html = html[:fim] + PONTE + html[fim:] if fim >= 0 else html + PONTE
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})


@router.get("/api/visitas/{visita_id}")
async def api_visita(visita_id: int, session: AsyncSession = Depends(_session)) -> dict:
    """O que a app precisa para começar o relatório desta visita."""
    v = await s.obter_visita(session, visita_id)
    if v is None:
        raise HTTPException(status_code=404, detail="Visita não existe.")
    c = v.cliente
    orc = v.referencia if v.referencia.startswith("ORC") else ""
    return {
        "ref_interna": s.ref_visita(v), "estado": v.estado, "nome_estado": v.nome_estado,
        "quando": v.inicio.strftime("%d/%m %H:%M") if v.inicio else "", "tipo": v.nome_tipo,
        "descricao": v.descricao, "tecnico": v.tecnico.nome if v.tecnico else "",
        "orcamento_numero": orc, "pedido_origem": "" if orc else v.referencia,
        "cliente": {"nome": c.nome, "morada": v.morada or c.morada_completa, "contacto": c.telefone,
                    "email": c.email, "nif": c.nif},
        "relatorios": [r.numero for r in v.relatorios],
    }


@router.post("/api/relatorios")
async def api_relatorios(request: Request, session: AsyncSession = Depends(_session)) -> dict:
    """Recebe da app um relatório (mdm-ri/1) ou o lote de «Exportar tudo» (mdm-ri-lote/1), em JSON."""
    if not request.headers.get("content-type", "").startswith("application/json"):
        raise HTTPException(status_code=415, detail="Envia o relatório em JSON.")
    try:
        obj = await request.json()
    except ValueError as erro:
        raise HTTPException(status_code=400, detail="JSON inválido.") from erro
    resumo = await s.importar_relatorios(session, s.relatorios_do_ficheiro(obj))
    await session.commit()
    return resumo


@router.get("/api/relatorios/{numero}")
async def api_relatorio(numero: str, session: AsyncSession = Depends(_session)) -> dict:
    i = await s.obter_relatorio(session, numero)
    if i is None:
        raise HTTPException(status_code=404, detail="Relatório não existe.")
    return i.dados


@router.get("/relatorios", response_class=HTMLResponse)
async def relatorios(request: Request, q: str = "", session: AsyncSession = Depends(_session),
                     settings: Settings = Depends(get_settings)) -> HTMLResponse:
    return _pagina(request, "relatorios.html", settings, relatorios=await s.listar_relatorios(session, q), q=q)


@router.get("/relatorios/importar", response_class=HTMLResponse)
async def relatorios_importar_form(request: Request, settings: Settings = Depends(get_settings)) -> HTMLResponse:
    return _pagina(request, "importar.html", settings, resumo=None)


@router.post("/relatorios/importar", response_class=HTMLResponse)
async def relatorios_importar(request: Request, session: AsyncSession = Depends(_session),
                              settings: Settings = Depends(get_settings)) -> HTMLResponse:
    form = await request.form()
    relatorios_lidos, ilegiveis = [], []
    for f in form.getlist("ficheiros"):
        if not hasattr(f, "read"):
            continue
        try:
            relatorios_lidos += s.relatorios_do_ficheiro(json.loads((await f.read()).decode("utf-8-sig")))
        except (ValueError, UnicodeDecodeError):
            ilegiveis.append(f.filename or "?")
    resumo = await s.importar_relatorios(session, relatorios_lidos)
    await session.commit()
    resumo["ilegiveis"] = ilegiveis
    return _pagina(request, "importar.html", settings, resumo=resumo)


@router.get("/relatorios/{numero}", response_class=HTMLResponse)
async def relatorio(request: Request, numero: str, session: AsyncSession = Depends(_session),
                    settings: Settings = Depends(get_settings)) -> HTMLResponse:
    i = await s.obter_relatorio(session, numero)
    if i is None:
        raise HTTPException(status_code=404, detail="Relatório não existe.")
    candidatas = []
    if i.visita_id is None and i.cliente_id:
        stmt = (select(Visita).where(Visita.cliente_id == i.cliente_id, Visita.estado.in_(("marcada", "por_marcar")))
                .order_by(Visita.inicio))
        candidatas = list((await session.execute(stmt)).scalars())
    return _pagina(request, "relatorio.html", settings, i=i, r=i.dados, candidatas=candidatas)


@router.post("/relatorios/{numero}/visita")
async def relatorio_visita(request: Request, numero: str,
                           session: AsyncSession = Depends(_session)) -> RedirectResponse:
    i = await s.obter_relatorio(session, numero)
    if i is None:
        raise HTTPException(status_code=404, detail="Relatório não existe.")
    v = await s.obter_visita(session, s.ler_id((await request.form()).get("visita_id")) or 0)
    if v is None:
        return _ir(f"/erp/relatorios/{numero}", "Escolhe a visita.")
    try:
        await s.associar_visita(session, i, v)
    except s.Invalido as erro:
        return _ir(f"/erp/relatorios/{numero}", str(erro))
    await session.commit()
    return _ir(f"/erp/relatorios/{numero}", aviso=f"Associado à visita {s.ref_visita(v)}, que ficou feita.")


@router.post("/relatorios/{numero}/peca")
async def relatorio_peca(request: Request, numero: str,
                         session: AsyncSession = Depends(_session)) -> RedirectResponse:
    i = await s.obter_relatorio(session, numero)
    if i is None:
        raise HTTPException(status_code=404, detail="Relatório não existe.")
    try:
        s.registar_peca(i, s.ler_data(s.texto(await request.form(), "dia")))
    except s.Invalido as erro:
        return _ir("/erp/por-marcar", str(erro))
    await session.commit()
    return _ir("/erp/por-marcar", aviso=f"Peça do {numero} recebida: a visita para a montar já se pode marcar.")


# ---------------------------------------------------------------- exportação


@router.get("/exportar/agenda.csv")
async def exportar_agenda(session: AsyncSession = Depends(_session)) -> Response:
    linhas = await s.linhas_exportacao(session)
    saida = io.StringIO()
    w = csv.DictWriter(saida, fieldnames=s.COLUNAS_EXPORTACAO, delimiter=";")
    w.writeheader()
    w.writerows(linhas)
    nome = f"agenda_{date.today():%Y-%m-%d}.csv"
    return Response(content="﻿" + saida.getvalue(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{nome}"'})
