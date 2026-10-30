"""ERP: agenda (visitas por marcar, marcadas, feitas) e os relatórios de intervenção vindos da app FM-TEC-04.

Os relatórios de teste têm a forma exata do que a app exporta (schema mdm-ri/1 e o lote mdm-ri-lote/1).
"""
from __future__ import annotations

import copy
import csv
import io
import json
from datetime import date, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from mdm.config import get_settings
from mdm.erp import service as s
from mdm.erp.models import Cliente, Intervencao, Tecnico, Visita
from mdm.main import create_app


def relatorio(numero="RI-2026-AL-0001", estado="emitido", ref="", data="2026-10-20", **mudar) -> dict:
    """Um relatório como a app o exporta (só os campos que importam; a app manda mais)."""
    r = {
        "schema": "mdm-ri/1", "impresso": "FM-TEC-04 / V07", "numero": numero, "estado": estado,
        "criado_em": f"{data}T08:55:00", "atualizado_em": f"{data}T11:10:00", "data_inicio": data,
        "hora_inicio": "09:10", "hora_fim": "11:05",
        "tecnico": {"nome": "Abdul Latif", "cert": "F-123", "oc": "APIRAC", "empresa_cert": ""},
        "outros_tecnicos_txt": "Rui",
        "cliente": {"nome": "Ana Exemplo", "morada": "Rua do Teste 1, Lisboa", "local": "Cobertura",
                    "contacto": "912 345 678", "email": "ana@exemplo.pt", "nif": "", "contrato": "", "pessoa": ""},
        "tipo_intervencao": "Pagamento pontual", "conforme_orcamento": "sem", "orcamento_numero": "",
        "orcamento_desvio": "", "pedido_origem": "", "ref_interna": ref,
        "equipamentos": [{"id": "e1", "categoria": "Split / multi-split", "marca": "Daikin", "modelo": "FTXM35",
                          "serie": "J001", "localizacao": "Sala", "refrigerante": "R32", "refrigerante_outro": "",
                          "gwp_manual": "", "carga_kg": "0,8", "hermetico": False, "detecao": False}],
        "descricao": "Diagnóstico de avaria; substituição do sensor de temperatura.",
        "medicoes": {}, "houve_gas": True,
        "fgas": {"equip_id": "e1", "motivo": "Manutenção / assistência", "verificacao": "sem_fuga", "metodo": [],
                 "qty_add": "0,35", "qty_rec": "", "tecnico_cert": "F-123"},
        "materiais": [{"designacao": "Sensor NTC", "qty": 1, "unidade": "un", "origem": "Stock"}],
        "deslocacao": {"taxa": "sim", "matricula": "AA-00-00", "km": "24", "tempo_min": "40"},
        "obra_concluida": "sim", "pendentes": "", "recomendacoes": "", "proxima_visita": "", "observacoes": "",
        "fotos": [], "assinatura_tecnico": {"png": "data:image/png;base64,AAAA", "datahora": f"{data}T11:06:00"},
        "aceitacao": None, "hash": "a" * 64, "hash_aceitacao": "", "retifica": "", "motivo_retificacao": "",
    }
    r.update(mudar)
    return r


async def _visita(sm, *, dia: datetime | None = None, referencia="ORC0034_2026", **cliente) -> int:
    async with sm() as session:
        async with session.begin():
            c = Cliente(nome=cliente.get("nome", "Ana Exemplo"), telefone=cliente.get("telefone", "912345678"),
                        email=cliente.get("email", ""), nif=cliente.get("nif", ""), morada="Rua do Teste 1",
                        localidade="Lisboa", criado_em=datetime(2026, 10, 1, 10))
            t = Tecnico(nome="Abdul Latif", ativo=True)
            session.add_all([c, t])
            await session.flush()
            dados = {"tipo_trabalho": "avaria", "prioridade": "P2", "referencia": referencia,
                     "descricao": "Não arrefece", "tecnico_id": str(t.id)}
            if dia:
                dados.update(dia=dia.date().isoformat(), hora=dia.strftime("%H:%M"), duracao_horas="2")
            v = s.nova_visita(c, dados, momento=datetime(2026, 10, 15, 9, 30))
            session.add(v)
        return v.id


def _cliente_http():
    return AsyncClient(transport=ASGITransport(app=create_app()), base_url="http://test")


# ---------------------------------------------------------------- visitas


def test_visita_sem_dia_fica_por_marcar_e_com_dia_fica_marcada():
    c = Cliente(id=1, nome="X", morada="Rua A", codigo_postal="1000-001", localidade="Lisboa")
    v = s.nova_visita(c, {"tipo_trabalho": "manutencao"}, momento=datetime(2026, 10, 1, 9))
    assert v.estado == "por_marcar" and v.marcada_em is None
    assert v.morada == "Rua A, 1000-001 Lisboa"
    s.preencher_visita(v, {"tipo_trabalho": "manutencao", "dia": "2026-10-20", "hora": "14:30",
                           "duracao_horas": "1,5", "morada": v.morada}, momento=datetime(2026, 10, 2, 11))
    assert v.estado == "marcada"
    assert v.marcada_em == datetime(2026, 10, 2, 11)
    assert v.inicio == datetime(2026, 10, 20, 14, 30) and v.fim == datetime(2026, 10, 20, 16)
    # Tirar o dia volta a pôr a visita por marcar.
    s.preencher_visita(v, {"tipo_trabalho": "manutencao", "morada": v.morada})
    assert v.estado == "por_marcar" and v.marcada_em is None and v.inicio is None


def test_dados_invalidos_da_visita():
    c = Cliente(id=1, nome="X")
    for dados, erro in [({"tipo_trabalho": "outro"}, "Tipo"), ({"prioridade": "P9"}, "P1"),
                        ({"dia": "20/10/2026"}, "Data"), ({"dia": "2026-10-20", "hora": "25:00"}, "Hora")]:
        with pytest.raises(s.Invalido, match=erro):
            s.nova_visita(c, dados)


@pytest.mark.asyncio
async def test_agenda_mostra_a_visita_da_semana(sessionmaker):
    await _visita(sessionmaker, dia=datetime(2026, 10, 21, 9))
    async with _cliente_http() as ac:
        resp = await ac.get("/erp/agenda?semana=2026-10-21")
        assert resp.status_code == 200
        assert "Ana Exemplo" in resp.text and "09:00–11:00" in resp.text
        outra = await ac.get("/erp/agenda?semana=2026-10-28")
        assert "Ana Exemplo" not in outra.text


@pytest.mark.asyncio
async def test_criar_cliente_e_visita_pelas_paginas(sessionmaker):
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/clientes", data={"nome": "Condomínio Teste", "telefone": "218 000 000",
                                                    "nif": "123 456 789"})
        assert resp.status_code == 303
        cliente_url = resp.headers["location"].split("?")[0]
        cliente_id = int(cliente_url.rsplit("/", 1)[1])
        resp = await ac.post("/erp/visitas", data={"cliente_id": cliente_id, "tipo_trabalho": "manutencao",
                                                   "dia": "2026-10-22", "hora": "10:00", "duracao_horas": "1"})
        assert resp.status_code == 303 and "marcada" in resp.headers["location"]
        ficha = await ac.get(resp.headers["location"])
        assert "Condomínio Teste" in ficha.text and "/erp/ri?visita=" in ficha.text
        mau = await ac.post("/erp/clientes", data={"nome": "Y", "nif": "12"})
        assert "erro=" in mau.headers["location"]


@pytest.mark.asyncio
async def test_post_de_outro_site_e_recusado(sessionmaker):
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/clientes", data={"nome": "Z"}, headers={"origin": "https://mau.example"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_erp_pede_palavra_passe_quando_definida(sessionmaker, monkeypatch):
    monkeypatch.setenv("ERP_UTILIZADOR", "mdm")
    monkeypatch.setenv("ERP_PALAVRA_PASSE", "segredo")
    get_settings.cache_clear()
    try:
        async with _cliente_http() as ac:
            assert (await ac.get("/erp")).status_code == 401
            assert (await ac.get("/erp", auth=("mdm", "errada"))).status_code == 401
            assert (await ac.get("/erp", auth=("mdm", "segredo"))).status_code == 200
    finally:
        get_settings.cache_clear()


# ---------------------------------------------------------------- relatórios da app


@pytest.mark.asyncio
async def test_relatorio_com_ref_interna_fecha_a_visita(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/api/relatorios", json=relatorio(ref=f"V{vid:04d}"))
        assert resp.status_code == 200
        resumo = resp.json()
        assert resumo["novos"] == ["RI-2026-AL-0001"] and not resumo["sem_visita"]
        pagina = await ac.get("/erp/relatorios/RI-2026-AL-0001")
        assert "Ana Exemplo" in pagina.text and "R32" in pagina.text
        assert (await ac.get("/erp/api/relatorios/RI-2026-AL-0001")).json()["numero"] == "RI-2026-AL-0001"
    async with sessionmaker() as session:
        v = await s.obter_visita(session, vid)
        assert v.estado == "feita" and v.feita_em == datetime(2026, 10, 20, 11, 5)
        i = v.relatorios[0]
        assert i.tecnico == "Abdul Latif, Rui"
        assert i.refrigerante == "R32" and i.gas_adicionado_kg == pytest.approx(0.35)
        assert len((await session.execute(select(Cliente))).scalars().all()) == 1   # não criou cliente novo


@pytest.mark.asyncio
async def test_sem_ref_liga_pela_visita_do_mesmo_dia_e_cliente(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    async with sessionmaker() as session:
        async with session.begin():
            resumo = await s.importar_relatorios(session, [relatorio()])
    assert not resumo["sem_visita"]
    async with sessionmaker() as session:
        assert (await s.obter_visita(session, vid)).estado == "feita"


@pytest.mark.asyncio
async def test_relatorio_sem_visita_cria_cliente_e_espera_associacao(sessionmaker):
    r = relatorio(cliente={"nome": "Bruno Novo", "morada": "Av. X", "contacto": "934 444 555", "email": "",
                           "nif": "501234567"})
    async with sessionmaker() as session:
        async with session.begin():
            resumo = await s.importar_relatorios(session, [r])
    assert resumo["sem_visita"] == ["RI-2026-AL-0001"]
    async with sessionmaker() as session:
        c = (await session.execute(select(Cliente))).scalar_one()
        assert (c.nome, c.nif, c.telefone) == ("Bruno Novo", "501234567", "934 444 555")
        session.add(Visita(cliente_id=c.id, estado="por_marcar", criada_em=datetime(2026, 10, 19, 9)))
        await session.commit()
        vid = (await session.execute(select(Visita.id))).scalar_one()
    async with _cliente_http() as ac:
        pagina = await ac.get("/erp/relatorios/RI-2026-AL-0001")
        assert "Associar" in pagina.text
        resp = await ac.post("/erp/relatorios/RI-2026-AL-0001/visita", data={"visita_id": vid})
        assert resp.status_code == 303
    async with sessionmaker() as session:
        assert (await s.obter_visita(session, vid)).estado == "feita"


@pytest.mark.asyncio
async def test_aceite_atualiza_e_nunca_volta_a_emitido(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    emitido = relatorio(ref=f"V{vid}")
    aceite = copy.deepcopy(emitido)
    aceite.update(estado="aceite", aceitacao={"png": "data:image/png;base64,BBBB", "nome": "Ana",
                                               "qualidade": "O próprio / titular", "datahora": "2026-10-20T11:09:00"})
    async with sessionmaker() as session:
        async with session.begin():
            assert (await s.importar_relatorios(session, [emitido]))["novos"]
            assert (await s.importar_relatorios(session, [aceite]))["atualizados"] == ["RI-2026-AL-0001"]
            assert (await s.importar_relatorios(session, [aceite]))["iguais"] == ["RI-2026-AL-0001"]
            volta = await s.importar_relatorios(session, [emitido])
            assert volta["ignorados"] and "mais avançada" in volta["ignorados"][0]
    async with sessionmaker() as session:
        i = (await session.execute(select(Intervencao))).scalar_one()
        assert i.estado == "aceite" and i.dados["aceitacao"]["nome"] == "Ana"


@pytest.mark.asyncio
async def test_mesmo_numero_de_outro_telemovel_nao_substitui(sessionmaker):
    async with sessionmaker() as session:
        async with session.begin():
            await s.importar_relatorios(session, [relatorio()])
            outro = relatorio(criado_em="2026-10-21T10:00:00", estado="aceite")
            resumo = await s.importar_relatorios(session, [outro])
    assert resumo["ignorados"] and "outro telemóvel" in resumo["ignorados"][0]


@pytest.mark.asyncio
async def test_obra_por_concluir_deixa_a_visita_seguinte_por_marcar_e_a_peca(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    r = relatorio(ref=f"V{vid}", obra_concluida="nao", pendentes="Aguarda peça; placa eletrónica da UE")
    async with sessionmaker() as session:
        async with session.begin():
            resumo = await s.importar_relatorios(session, [r])
            assert resumo["visitas_seguintes"] == 1
            # Receber outra vez não cria outra visita.
            r2 = copy.deepcopy(r)
            r2["estado"] = "aceite"
            assert (await s.importar_relatorios(session, [r2]))["visitas_seguintes"] == 0
    async with sessionmaker() as session:
        seguinte = (await session.execute(select(Visita).where(Visita.anterior_id == vid))).scalar_one()
        assert seguinte.estado == "por_marcar" and "Aguarda peça" in seguinte.descricao
        assert seguinte.referencia == "ORC0034_2026" and seguinte.prioridade == "P2"
        # À espera da peça, não aparece por marcar; aparece nas peças.
        assert [v.id for v in await s.visitas_por_marcar(session)] == []
        pecas = await s.a_espera_de_peca(session)
        assert [i.numero for i in pecas] == ["RI-2026-AL-0001"]
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/relatorios/RI-2026-AL-0001/peca", data={"dia": "2026-10-24"})
        assert resp.status_code == 303
        csv_txt = (await ac.get("/erp/exportar/agenda.csv")).text
    async with sessionmaker() as session:
        assert [v.id for v in await s.visitas_por_marcar(session)] == [seguinte.id]
    linhas = list(csv.DictReader(io.StringIO(csv_txt.lstrip("﻿")), delimiter=";"))
    primeira = next(l for l in linhas if l["visita"] == str(vid))
    assert primeira["resultado"] == "pendente_peca"
    assert primeira["peca_encomendada_em"] == "2026-10-20" and primeira["peca_recebida_em"] == "2026-10-24"
    assert primeira["telefone"] == "912345678" and primeira["referencia"] == "ORC0034_2026"
    assert primeira["criada_em"] == "2026-10-15 09:30:00" and primeira["feita_em"] == "2026-10-20 11:05:00"
    segunda = next(l for l in linhas if l["visita"] == str(seguinte.id))
    assert segunda["anterior"] == str(vid) and segunda["estado"] == "por_marcar"


@pytest.mark.asyncio
async def test_retificacao_substitui_o_original(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    original = relatorio(ref=f"V{vid}", obra_concluida="nao", pendentes="Aguarda orçamento")
    novo = relatorio(numero="RI-2026-AL-0002", ref=f"V{vid}", retifica="RI-2026-AL-0001",
                     motivo_retificacao="Horas erradas", hash="b" * 64)
    async with sessionmaker() as session:
        async with session.begin():
            await s.importar_relatorios(session, [original])
            await s.importar_relatorios(session, s.relatorios_do_ficheiro({"schema": "mdm-ri-lote/1", "relatorios": [novo]}))
    async with sessionmaker() as session:
        orig = await s.obter_relatorio(session, "RI-2026-AL-0001")
        assert orig.retificado_por == "RI-2026-AL-0002"
        assert [l["relatorio"] for l in await s.linhas_exportacao(session) if l["visita"] == vid] == ["RI-2026-AL-0002"]


@pytest.mark.asyncio
async def test_importar_por_ficheiro_lote_rascunho_e_lixo(sessionmaker):
    lote = {"schema": "mdm-ri-lote/1", "exportado_em": "2026-10-20T18:00:00", "aparelho": "AL",
            "relatorios": [relatorio(), relatorio(numero="RI-2026-AL-0002", estado="rascunho")]}
    ficheiros = [("ficheiros", ("mdm-ri-2026-10-20-AL.json", json.dumps(lote).encode(), "application/json")),
                 ("ficheiros", ("foto.json", b"isto nao e json", "application/json"))]
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/relatorios/importar", files=ficheiros)
    assert resp.status_code == 200
    assert "1 novo(s)" in resp.text and "foto.json" in resp.text and "1 registo(s)" in resp.text


@pytest.mark.asyncio
async def test_api_recusa_o_que_nao_e_json(sessionmaker):
    async with _cliente_http() as ac:
        resp = await ac.post("/erp/api/relatorios", content=b"x", headers={"content-type": "text/plain"})
    assert resp.status_code == 415


@pytest.mark.asyncio
async def test_app_servida_com_a_ponte_e_dados_da_visita(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime(2026, 10, 20, 9))
    async with _cliente_http() as ac:
        app = await ac.get("/erp/ri")
        assert app.status_code == 200
        assert "FM-TEC-04" in app.text and app.text.rstrip().endswith("</html>")
        assert app.text.index("ri-erp.js") > app.text.index("window.RI_UI")
        dados = (await ac.get(f"/erp/api/visitas/{vid}")).json()
        assert dados["ref_interna"] == f"V{vid:04d}" and dados["orcamento_numero"] == "ORC0034_2026"
        assert dados["cliente"]["contacto"] == "912345678"
        assert (await ac.get("/erp/static/ri-erp.js")).status_code == 200


@pytest.mark.asyncio
async def test_painel_e_paginas_abrem(sessionmaker):
    vid = await _visita(sessionmaker, dia=datetime.combine(date.today(), datetime.min.time()) + timedelta(hours=10))
    await _visita(sessionmaker, nome="Carla Por Marcar", telefone="913000000")
    async with sessionmaker() as session:
        async with session.begin():
            await s.importar_relatorios(session, [relatorio(
                ref="", cliente={"nome": "Sem Visita", "morada": "", "contacto": "", "email": "", "nif": ""},
                proxima_visita=(date.today() + timedelta(days=10)).isoformat())])
    async with _cliente_http() as ac:
        painel = await ac.get("/erp")
        assert painel.status_code == 200
        assert "Ana Exemplo" in painel.text and "Carla Por Marcar" in painel.text
        assert "Relatórios sem visita" in painel.text and "Próximas visitas previstas" in painel.text
        for url in ("/erp/por-marcar", "/erp/clientes", "/erp/clientes?q=912", "/erp/tecnicos", "/erp/relatorios",
                    "/erp/relatorios?q=Sem", "/erp/relatorios/importar", f"/erp/visitas/{vid}",
                    f"/erp/visitas/{vid}?editar=1", "/erp/clientes/1", "/erp/clientes/1?editar=1",
                    "/erp/visitas/nova?cliente=1&dia=2026-10-30", "/erp/agenda?tecnico=1"):
            assert (await ac.get(url)).status_code == 200, url
        assert (await ac.get("/erp/visitas/999")).status_code == 404
