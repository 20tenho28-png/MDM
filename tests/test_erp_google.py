"""ERP: as visitas marcadas no Google Calendar de cada técnico (a API do Google é simulada)."""
from __future__ import annotations

import json
from datetime import datetime
from urllib.parse import unquote

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from mdm.config import get_settings
from mdm.erp import google
from mdm.erp import service as s
from mdm.erp.models import Cliente, Tecnico, Visita
from mdm.main import create_app


class GoogleFalso:
    """Um Google Calendar em memória: {(calendário, evento): corpo}. Regista os pedidos."""

    def __init__(self, recusar: set[str] = frozenset()):
        self.eventos: dict[tuple[str, str], dict] = {}
        self.pedidos: list[tuple[str, str]] = []
        self.recusar = recusar

    def __call__(self, pedido: httpx.Request) -> httpx.Response:
        # /calendar/v3/calendars/{calendário}/events[/{evento}]
        cal, _, evento = pedido.url.raw_path.decode().split("/calendars/")[1].partition("/events")
        cal, evento = unquote(cal), evento.lstrip("/")
        self.pedidos.append((pedido.method, evento or cal))
        assert pedido.headers["authorization"] == "Bearer token-teste"
        if cal in self.recusar:
            return httpx.Response(403, json={"error": {"message": "Forbidden"}})
        if pedido.method == "PUT":
            if (cal, evento) not in self.eventos:
                return httpx.Response(404, json={"error": {"message": "Not Found"}})
            self.eventos[(cal, evento)] = json.loads(pedido.content)
            return httpx.Response(200, json={})
        if pedido.method == "POST":
            corpo = json.loads(pedido.content)
            self.eventos[(cal, corpo["id"])] = corpo
            return httpx.Response(200, json=corpo)
        if pedido.method == "DELETE":
            return httpx.Response(204 if self.eventos.pop((cal, evento), None) else 410)
        return httpx.Response(405)


def _calendario(falso: GoogleFalso) -> google.Calendario:
    async def token():
        return "token-teste"
    return google.Calendario(token, httpx.AsyncClient(transport=httpx.MockTransport(falso)))


async def _dados(sm) -> tuple[int, int, int]:
    async with sm() as session:
        async with session.begin():
            c = Cliente(nome="Ana Exemplo", telefone="912 345 678", morada="Rua do Teste 1", localidade="Lisboa",
                        criado_em=datetime(2026, 10, 1))
            a = Tecnico(nome="Abdul", ativo=True, calendario_id="abdul@group.calendar.google.com")
            b = Tecnico(nome="Leonardo", ativo=True, calendario_id="leo@group.calendar.google.com")
            session.add_all([c, a, b])
            await session.flush()
            v = s.nova_visita(c, {"tipo_trabalho": "avaria", "prioridade": "P1", "referencia": "ORC0034_2026",
                                  "descricao": "Não arrefece", "tecnico_id": str(a.id), "dia": "2026-10-21",
                                  "hora": "09:30", "duracao_horas": "2"}, momento=datetime(2026, 10, 18, 9))
            session.add(v)
        return v.id, a.id, b.id


@pytest.fixture
def erp_url(monkeypatch):
    monkeypatch.setenv("ERP_URL", "https://erp.exemplo.pt/")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_visita_marcada_vai_para_o_calendario_do_tecnico(sessionmaker, erp_url):
    vid, _, _ = await _dados(sessionmaker)
    falso = GoogleFalso()
    r = await google.sincronizar_visitas([vid], cal=_calendario(falso))
    assert r == {"ativo": True, "visitas": 1, "erros": 0}
    ev = falso.eventos[("abdul@group.calendar.google.com", f"mdmv{vid:06d}")]
    assert ev["summary"] == "Ana Exemplo · Avaria (P1)"
    assert ev["location"] == "Rua do Teste 1, Lisboa"
    assert ev["start"] == {"dateTime": "2026-10-21T09:30:00", "timeZone": "Europe/Lisbon"}
    assert ev["end"]["dateTime"] == "2026-10-21T11:30:00"
    assert ev["colorId"] == "11"
    assert f"https://erp.exemplo.pt/erp/ri?visita={vid}" in ev["description"]
    assert "912 345 678" in ev["description"] and f"V{vid:04d}" in ev["description"]
    async with sessionmaker() as session:
        v = await session.get(Visita, vid)
        assert v.google_calendario == "abdul@group.calendar.google.com" and v.google_erro == ""
    # Outra vez: atualiza o mesmo evento, não cria outro.
    await google.sincronizar_visitas([vid], cal=_calendario(falso))
    assert len(falso.eventos) == 1 and falso.pedidos[-1] == ("PUT", f"mdmv{vid:06d}")


@pytest.mark.asyncio
async def test_mudar_de_tecnico_desmarcar_e_cancelar_tiram_o_evento(sessionmaker, erp_url):
    vid, _, bid = await _dados(sessionmaker)
    falso = GoogleFalso()
    cal = _calendario(falso)
    await google.sincronizar_visitas([vid], cal=cal)
    async with sessionmaker() as session:
        v = await session.get(Visita, vid)
        v.tecnico_id = bid
        await session.commit()
    await google.sincronizar_visitas([vid], cal=cal)
    assert list(falso.eventos) == [("leo@group.calendar.google.com", f"mdmv{vid:06d}")]
    async with sessionmaker() as session:
        v = await s.obter_visita(session, vid)
        s.preencher_visita(v, {"tipo_trabalho": "avaria", "tecnico_id": str(bid)})   # sem dia: desmarcada
        await session.commit()
    await google.sincronizar_visitas([vid], cal=cal)
    assert falso.eventos == {}
    async with sessionmaker() as session:
        assert (await session.get(Visita, vid)).google_calendario == ""


@pytest.mark.asyncio
async def test_visita_feita_fica_verde_e_sem_ligacao_ao_relatorio(sessionmaker, erp_url):
    vid, _, _ = await _dados(sessionmaker)
    async with sessionmaker() as session:
        v = await session.get(Visita, vid)
        v.estado, v.feita_em = "feita", datetime(2026, 10, 21, 11, 10)
        await session.commit()
    falso = GoogleFalso()
    await google.sincronizar_visitas([vid], cal=_calendario(falso))
    ev = next(iter(falso.eventos.values()))
    assert ev["summary"].startswith("Feita · ") and ev["colorId"] == "10"
    assert "/erp/ri?visita=" not in ev["description"] and "/erp/visitas/" in ev["description"]


@pytest.mark.asyncio
async def test_calendario_sem_permissao_fica_registado_na_visita(sessionmaker):
    vid, _, _ = await _dados(sessionmaker)
    falso = GoogleFalso(recusar={"abdul@group.calendar.google.com"})
    r = await google.sincronizar_visitas([vid], cal=_calendario(falso))
    assert r["erros"] == 1
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as ac:
        pagina = await ac.get(f"/erp/visitas/{vid}")
        tecnicos = await ac.get("/erp/tecnicos")
    assert "Não chegou ao Google Calendar" in pagina.text and "Fazer alterações a eventos" in pagina.text
    assert "não chegaram ao Google Calendar" in tecnicos.text


@pytest.mark.asyncio
async def test_sem_credenciais_nao_sincroniza(sessionmaker):
    vid, _, _ = await _dados(sessionmaker)
    assert await google.sincronizar_visitas([vid]) == {"ativo": False}
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as ac:
        resp = await ac.post("/erp/tecnicos/sincronizar")
        assert "erro=" in resp.headers["location"]
        pagina = await ac.get("/erp/tecnicos")
    assert "Ainda não está ligado" in pagina.text


@pytest.mark.asyncio
async def test_paginas_pedem_a_sincronizacao_das_visitas_que_mudam(sessionmaker, monkeypatch):
    pedidas: list[list[int]] = []

    async def registar(ids):
        pedidas.append(sorted(ids))
    monkeypatch.setattr(google, "sincronizar_visitas", registar)
    vid, aid, _ = await _dados(sessionmaker)
    async with AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test") as ac:
        resp = await ac.post("/erp/visitas", data={"cliente_id": 1, "tipo_trabalho": "manutencao",
                                                   "dia": "2026-10-22", "hora": "10:00", "tecnico_id": aid})
        nova = int(resp.headers["location"].split("?")[0].rsplit("/", 1)[1])
        await ac.post(f"/erp/visitas/{vid}", data={"tipo_trabalho": "avaria", "dia": "2026-10-23", "hora": "11:00",
                                                   "tecnico_id": aid})
        await ac.post(f"/erp/visitas/{nova}/cancelar", data={"motivo": "Cliente desmarcou"})
        from tests.test_erp import relatorio
        resumo = (await ac.post("/erp/api/relatorios", json=relatorio(ref=f"V{vid}", obra_concluida="nao",
                                                                       pendentes="Aguarda orçamento"))).json()
        resp = await ac.post(f"/erp/tecnicos/{aid}", data={"nome": "Abdul", "calendario_id": "novo@group.calendar.google.com"})
        assert "aviso=" in resp.headers["location"]
    seguinte = resumo["visitas"][1]
    assert pedidas == [[nova], [vid], [nova], sorted([vid, seguinte]), [vid]]
    async with sessionmaker() as session:
        t = await session.get(Tecnico, aid)
        assert t.calendario_id == "novo@group.calendar.google.com"
        assert (await session.execute(select(Visita).where(Visita.id == seguinte))).scalar_one().estado == "por_marcar"
