"""Regras do ERP: estados das visitas, receção dos relatórios da app de intervenção e a exportação para o funil."""
from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mdm.erp.models import (
    PRIORIDADES,
    TIPOS_TRABALHO,
    Cliente,
    Equipamento,
    Intervencao,
    Tecnico,
    Visita,
)

LX = ZoneInfo("Europe/Lisbon")
DIAS_SEMANA = ("Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo")
_HORA = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")


class Invalido(ValueError):
    """Dados que não se podem guardar; a mensagem é para mostrar ao utilizador."""


def agora() -> datetime:
    return datetime.now(LX).replace(tzinfo=None, microsecond=0)


# ---------------------------------------------------------------- leitura dos formulários


def texto(dados, nome: str, maximo: int = 5000) -> str:
    return str(dados.get(nome) or "").strip()[:maximo]


def ler_data(valor: str) -> date | None:
    valor = (valor or "").strip()
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError as erro:
        raise Invalido(f"Data inválida: «{valor}» (usa AAAA-MM-DD).") from erro


def ler_hora(valor: str) -> str:
    valor = (valor or "").strip()
    if not valor:
        return ""
    m = _HORA.match(valor)
    if not m:
        raise Invalido(f"Hora inválida: «{valor}» (usa HH:MM).")
    return f"{int(m.group(1)):02d}:{m.group(2)}"


def ler_numero(valor: str) -> float | None:
    valor = (valor or "").strip().replace(",", ".")
    if not valor:
        return None
    try:
        return float(valor)
    except ValueError as erro:
        raise Invalido(f"Número inválido: «{valor}».") from erro


def ler_id(valor) -> int | None:
    valor = str(valor or "").strip()
    return int(valor) if valor.isdigit() else None


def juntar(dia: date | None, hora: str) -> datetime | None:
    if dia is None:
        return None
    h, m = (int(x) for x in (hora or "09:00").split(":"))
    return datetime.combine(dia, time(h, m))


# ---------------------------------------------------------------- clientes e técnicos


def preencher_cliente(c: Cliente, dados) -> Cliente:
    c.nome = texto(dados, "nome", 255)
    if not c.nome:
        raise Invalido("O cliente precisa de um nome.")
    c.telefone = texto(dados, "telefone", 40)
    c.email = texto(dados, "email", 320).lower()
    c.nif = re.sub(r"\D", "", texto(dados, "nif", 20))
    if c.nif and len(c.nif) != 9:
        raise Invalido("O NIF tem 9 algarismos.")
    c.morada = texto(dados, "morada", 500)
    c.codigo_postal = texto(dados, "codigo_postal", 20)
    c.localidade = texto(dados, "localidade", 120)
    c.notas = texto(dados, "notas")
    return c


async def procurar_clientes(session: AsyncSession, q: str = "", limite: int = 200) -> list[Cliente]:
    stmt = select(Cliente).order_by(Cliente.nome).limit(limite)
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        digitos = re.sub(r"\D", "", q)
        condicoes = [Cliente.nome.ilike(like), Cliente.email.ilike(like), Cliente.localidade.ilike(like),
                     Cliente.morada.ilike(like)]
        if len(digitos) >= 3:
            condicoes += [Cliente.nif.contains(digitos),
                          func.replace(Cliente.telefone, " ", "").contains(digitos)]
        stmt = stmt.where(or_(*condicoes))
    return list((await session.execute(stmt)).scalars())


def preencher_equipamento(e: Equipamento, dados) -> Equipamento:
    e.tipo = texto(dados, "tipo", 80)
    e.marca = texto(dados, "marca", 80)
    e.modelo = texto(dados, "modelo", 120)
    e.numero_serie = texto(dados, "numero_serie", 120)
    e.localizacao = texto(dados, "localizacao", 120)
    e.gas = texto(dados, "gas", 20).upper()
    e.carga_kg = ler_numero(texto(dados, "carga_kg"))
    e.instalado_em = ler_data(texto(dados, "instalado_em"))
    e.notas = texto(dados, "notas")
    if not (e.tipo or e.marca or e.modelo):
        raise Invalido("Escreve pelo menos o tipo, a marca ou o modelo do equipamento.")
    return e


async def tecnicos_ativos(session: AsyncSession) -> list[Tecnico]:
    stmt = select(Tecnico).where(Tecnico.ativo.is_(True)).order_by(Tecnico.nome)
    return list((await session.execute(stmt)).scalars())


# ---------------------------------------------------------------- visitas (agenda)


def preencher_visita(v: Visita, dados, momento: datetime | None = None) -> Visita:
    """Lê o formulário da visita. Com dia marcado passa a «marcada»; sem dia volta a «por marcar»."""
    if v.estado in ("feita", "cancelada"):
        raise Invalido(f"A visita está {v.nome_estado.lower()}: já não se altera.")
    momento = momento or agora()
    v.tecnico_id = ler_id(dados.get("tecnico_id"))
    v.referencia = texto(dados, "referencia", 80).upper()
    v.tipo_trabalho = texto(dados, "tipo_trabalho", 20) or "avaria"
    if v.tipo_trabalho not in TIPOS_TRABALHO:
        raise Invalido("Tipo de trabalho desconhecido.")
    v.prioridade = texto(dados, "prioridade", 2).upper()
    if v.prioridade and v.prioridade not in PRIORIDADES:
        raise Invalido("A prioridade é P1, P2 ou P3.")
    v.descricao = texto(dados, "descricao")
    v.morada = texto(dados, "morada", 500)
    dia = ler_data(texto(dados, "dia"))
    hora = ler_hora(texto(dados, "hora")) or "09:00"
    duracao = ler_numero(texto(dados, "duracao_horas")) or 1.0
    if not 0 < duracao <= 24:
        raise Invalido("A duração vai de 0,25 a 24 horas.")
    v.inicio = juntar(dia, hora)
    v.fim = v.inicio + timedelta(hours=duracao) if v.inicio else None
    if v.inicio and v.estado == "por_marcar":
        v.estado, v.marcada_em = "marcada", momento
    elif not v.inicio and v.estado == "marcada":
        v.estado, v.marcada_em = "por_marcar", None
    return v


def nova_visita(cliente: Cliente, dados, momento: datetime | None = None) -> Visita:
    momento = momento or agora()
    v = Visita(cliente_id=cliente.id, estado="por_marcar", criada_em=momento)
    preencher_visita(v, dados, momento)
    if not v.morada:
        v.morada = cliente.morada_completa
    return v


def cancelar_visita(v: Visita, motivo: str, momento: datetime | None = None) -> None:
    if v.estado in ("feita", "cancelada"):
        raise Invalido(f"A visita já está {v.nome_estado.lower()}.")
    if v.relatorios:
        raise Invalido("A visita já tem relatório de intervenção.")
    v.estado, v.cancelada_em = "cancelada", momento or agora()
    v.motivo_cancelamento = (motivo or "").strip()[:500]


def _carregar_visita():
    return (selectinload(Visita.cliente), selectinload(Visita.tecnico), selectinload(Visita.relatorios))


async def obter_visita(session: AsyncSession, visita_id: int) -> Visita | None:
    stmt = select(Visita).where(Visita.id == visita_id).options(*_carregar_visita())
    return (await session.execute(stmt)).scalar_one_or_none()


def inicio_da_semana(dia: date) -> date:
    return dia - timedelta(days=dia.weekday())


async def visitas_entre(session: AsyncSession, inicio: date, fim: date, tecnico_id: int | None = None) -> list[Visita]:
    stmt = (select(Visita)
            .where(Visita.inicio >= datetime.combine(inicio, time.min),
                   Visita.inicio < datetime.combine(fim, time.min),
                   Visita.estado != "cancelada")
            .options(*_carregar_visita())
            .order_by(Visita.inicio))
    if tecnico_id:
        stmt = stmt.where(Visita.tecnico_id == tecnico_id)
    return list((await session.execute(stmt)).scalars())


def _ordem_por_marcar(v: Visita):
    return (PRIORIDADES.index(v.prioridade) if v.prioridade in PRIORIDADES else 3, v.criada_em)


async def visitas_por_marcar(session: AsyncSession) -> list[Visita]:
    """Por marcar, P1 primeiro e depois as mais antigas. As que esperam por uma peça ficam à parte."""
    stmt = select(Visita).where(Visita.estado == "por_marcar").options(*_carregar_visita())
    visitas = list((await session.execute(stmt)).scalars())
    pendentes = await _anteriores_a_espera_de_peca(session)
    return sorted((v for v in visitas if v.anterior_id not in pendentes), key=_ordem_por_marcar)


async def _anteriores_a_espera_de_peca(session: AsyncSession) -> set[int]:
    stmt = select(Intervencao.visita_id).where(
        Intervencao.aguarda_peca.is_(True), Intervencao.peca_recebida_em.is_(None),
        Intervencao.retificado_por == "", Intervencao.visita_id.is_not(None))
    return set((await session.execute(stmt)).scalars())


async def a_espera_de_peca(session: AsyncSession) -> list[Intervencao]:
    stmt = (select(Intervencao)
            .where(Intervencao.aguarda_peca.is_(True), Intervencao.peca_recebida_em.is_(None),
                   Intervencao.retificado_por == "")
            .options(selectinload(Intervencao.visita), selectinload(Intervencao.cliente))
            .order_by(Intervencao.data))
    return list((await session.execute(stmt)).scalars())


# ---------------------------------------------------------------- relatórios de intervenção (app FM-TEC-04)

SCHEMA_RELATORIO = "mdm-ri/1"
SCHEMA_LOTE = "mdm-ri-lote/1"
_NUMERO_RI = re.compile(r"^RI-\d{4}-[A-Z0-9]{1,3}-\d{4}$")
_REF_VISITA = re.compile(r"^\s*V-?0*(\d{1,9})\s*$", re.IGNORECASE)
# Como na app: um estado mais avançado nunca é substituído por um anterior (aceite não volta a emitido).
_RANK = {"emitido": 1, "ausente": 2, "recusado": 2, "aceite": 3}


def ref_visita(v: Visita) -> str:
    """O que o técnico escreve em «Ref. interna / folha de obra» para o relatório entrar nesta visita."""
    return f"V{v.id:04d}"


def relatorios_do_ficheiro(obj) -> list:
    """Um relatório (mdm-ri/1) ou o lote de «Exportar tudo» (mdm-ri-lote/1), como lista."""
    if isinstance(obj, dict) and isinstance(obj.get("relatorios"), list):
        return obj["relatorios"]
    return obj if isinstance(obj, list) else [obj]


def importavel(r) -> bool:
    """A mesma verificação que a app faz ao importar: rascunhos e ficheiros de outra coisa ficam de fora."""
    return (isinstance(r, dict) and isinstance(r.get("numero"), str) and bool(_NUMERO_RI.match(r["numero"]))
            and r.get("schema") == SCHEMA_RELATORIO and r.get("estado") in _RANK
            and isinstance(r.get("cliente"), dict) and isinstance(r.get("descricao"), str)
            and all(isinstance(r.get(k), list) for k in ("equipamentos", "materiais", "fotos"))
            and isinstance(r.get("tecnico"), dict) and isinstance(r.get("deslocacao"), dict)
            and isinstance(r.get("fgas"), dict))


def _kg(valor) -> float | None:
    try:
        n = float(str(valor).strip().replace(",", ".")) if str(valor or "").strip() else None
    except ValueError:
        return None
    return n if n else None


def _data_iso(valor) -> date | None:
    try:
        return date.fromisoformat(str(valor or "")[:10])
    except ValueError:
        return None


def _so_digitos(valor) -> str:
    return re.sub(r"\D", "", str(valor or ""))


def _aguarda_peca(pendentes: str) -> bool:
    t = (pendentes or "").lower().replace("ç", "c")
    return "aguarda peca" in t or "falta peca" in t or "encomendar peca" in t or "aguarda material" in t


def _refrigerante(r: dict) -> str:
    eqs = [e for e in r.get("equipamentos") or [] if isinstance(e, dict) and e.get("refrigerante")]
    f = r.get("fgas") or {}
    eq = next((e for e in eqs if e.get("id") and e.get("id") == f.get("equip_id")), eqs[0] if eqs else None)
    if not eq:
        return ""
    return str(eq.get("refrigerante_outro") if eq.get("refrigerante") == "Outro" else eq.get("refrigerante"))[:40]


def _preencher(i: Intervencao, r: dict, momento: datetime) -> None:
    c, f = r.get("cliente") or {}, r.get("fgas") or {}
    i.estado = r["estado"]
    i.retifica = str(r.get("retifica") or "")[:30]
    i.retificado_por = str(r.get("retificado_por") or i.retificado_por or "")[:30]
    i.data = _data_iso(r.get("data_inicio")) or momento.date()
    i.hora_inicio = str(r.get("hora_inicio") or "")[:5]
    i.hora_fim = str(r.get("hora_fim") or "")[:5]
    i.tecnico = ", ".join(x for x in [str((r.get("tecnico") or {}).get("nome") or "")]
                          + [s.strip() for s in str(r.get("outros_tecnicos_txt") or "").split(",")] if x)[:255]
    i.cliente_nome = str(c.get("nome") or "")[:255]
    i.morada = ", ".join(x for x in (str(c.get("morada") or ""), str(c.get("local") or "")) if x)[:500]
    i.tipo_intervencao = str(r.get("tipo_intervencao") or "")[:80]
    i.orcamento_numero = str(r.get("orcamento_numero") or "").upper()[:80]
    i.ref_interna = str(r.get("ref_interna") or "")[:80]
    i.descricao = str(r.get("descricao") or "")
    i.obra_concluida = r.get("obra_concluida") != "nao"
    i.pendentes = str(r.get("pendentes") or "")
    i.proxima_visita = _data_iso(r.get("proxima_visita"))
    i.houve_gas = bool(r.get("houve_gas"))
    i.refrigerante = _refrigerante(r) if i.houve_gas else ""
    i.gas_adicionado_kg = _kg(f.get("qty_add")) if i.houve_gas else None
    i.gas_recuperado_kg = _kg(f.get("qty_rec")) if i.houve_gas else None
    i.aguarda_peca = not i.obra_concluida and _aguarda_peca(i.pendentes)
    i.hash = str(r.get("hash") or "")[:64]
    i.criado_na_app = str(r.get("criado_em") or "")[:25]
    i.dados = r
    i.atualizado_em = momento


async def _cliente_do_relatorio(session: AsyncSession, r: dict, momento: datetime) -> Cliente:
    """O cliente do ERP com o mesmo NIF, telefone, email ou nome; se não houver, cria-o com os dados do relatório."""
    c = r.get("cliente") or {}
    nif, tel = _so_digitos(c.get("nif")), _so_digitos(c.get("contacto"))[-9:]
    email, nome = str(c.get("email") or "").strip().lower(), str(c.get("nome") or "").strip()
    condicoes = []
    if len(nif) == 9:
        condicoes.append(Cliente.nif == nif)
    if len(tel) == 9:
        condicoes.append(func.replace(Cliente.telefone, " ", "").contains(tel))
    if email:
        condicoes.append(func.lower(Cliente.email) == email)
    if nome:
        condicoes.append(func.lower(Cliente.nome) == nome.lower())
    if condicoes:
        achado = (await session.execute(select(Cliente).where(or_(*condicoes)).order_by(Cliente.id))).scalars().first()
        if achado:
            return achado
    novo = Cliente(nome=nome or "(sem nome no relatório)", telefone=str(c.get("contacto") or "")[:40], email=email,
                   nif=nif if len(nif) == 9 else "", morada=str(c.get("morada") or "")[:500], criado_em=momento,
                   notas="Criado a partir do relatório " + r["numero"] + ".")
    session.add(novo)
    await session.flush()
    return novo


async def _visita_do_relatorio(session: AsyncSession, r: dict, cliente: Cliente) -> Visita | None:
    """A visita pela «Ref. interna» (V0012); sem ela, a visita por fazer deste cliente marcada para o mesmo dia."""
    m = _REF_VISITA.match(str(r.get("ref_interna") or ""))
    if m:
        v = await obter_visita(session, int(m.group(1)))
        if v is not None:
            return v
    dia = _data_iso(r.get("data_inicio"))
    if dia is None:
        return None
    stmt = (select(Visita)
            .where(Visita.cliente_id == cliente.id, Visita.estado.in_(("marcada", "por_marcar")),
                   Visita.inicio >= datetime.combine(dia, time.min),
                   Visita.inicio < datetime.combine(dia + timedelta(days=1), time.min))
            .options(*_carregar_visita()).order_by(Visita.inicio))
    return (await session.execute(stmt)).scalars().first()


async def _fechar_visita(session: AsyncSession, i: Intervencao, v: Visita, momento: datetime) -> Visita | None:
    """A visita fica feita. Obra por concluir deixa a seguinte por marcar (uma só vez) e devolve-a."""
    if v.estado not in ("feita", "cancelada"):
        fim = juntar(i.data, i.hora_fim) if i.hora_fim else juntar(i.data, "18:00")
        v.estado, v.feita_em = "feita", fim or momento
    if i.obra_concluida or i.retificado_por:
        return None
    existe = (await session.execute(select(Visita.id).where(Visita.anterior_id == v.id))).first()
    if existe:
        return None
    motivo = f"Aguarda peça ({i.numero}): {i.pendentes}" if i.aguarda_peca else f"Continuação do {i.numero}: {i.pendentes}"
    seguinte = Visita(cliente_id=v.cliente_id, tecnico_id=v.tecnico_id, referencia=v.referencia,
                      tipo_trabalho=v.tipo_trabalho, prioridade=v.prioridade, morada=v.morada, estado="por_marcar",
                      criada_em=momento, anterior_id=v.id, descricao=motivo.strip().rstrip(":"))
    session.add(seguinte)
    await session.flush()
    return seguinte


async def importar_relatorios(session: AsyncSession, relatorios: list, momento: datetime | None = None) -> dict:
    """Guarda os relatórios recebidos da app. Devolve o resumo para mostrar (novos, atualizados, ignorados...)."""
    momento = momento or agora()
    # "visitas": as visitas que mudaram (para o Google Calendar).
    resumo = {"novos": [], "atualizados": [], "iguais": [], "ignorados": [], "invalidos": 0, "visitas_seguintes": 0,
              "sem_visita": [], "visitas": []}
    for r in relatorios:
        if not importavel(r):
            resumo["invalidos"] += 1
            continue
        numero = r["numero"]
        i = (await session.execute(select(Intervencao).where(Intervencao.numero == numero))).scalar_one_or_none()
        if i is not None:
            if i.criado_na_app and r.get("criado_em") and i.criado_na_app != r.get("criado_em"):
                resumo["ignorados"].append(f"{numero}: já existe um relatório com este número, de outro telemóvel "
                                           "ou de outra data (confirma o código do aparelho nas definições da app)")
                continue
            if _RANK[i.estado] > _RANK[r["estado"]]:
                resumo["ignorados"].append(f"{numero}: o ERP já tem uma versão mais avançada ({i.nome_estado})")
                continue
            if i.hash == r.get("hash") and i.estado == r["estado"] and \
                    (i.retificado_por or "") == (r.get("retificado_por") or i.retificado_por or ""):
                resumo["iguais"].append(numero)
                continue
            _preencher(i, r, momento)
            resumo["atualizados"].append(numero)
        else:
            i = Intervencao(numero=numero, importado_em=momento)
            _preencher(i, r, momento)
            cliente = await _cliente_do_relatorio(session, r, momento)
            i.cliente_id = cliente.id
            v = await _visita_do_relatorio(session, r, cliente)
            if v is not None:
                i.visita_id, i.cliente_id = v.id, v.cliente_id
            session.add(i)
            await session.flush()
            resumo["novos"].append(numero)
        if i.retifica:
            original = (await session.execute(
                select(Intervencao).where(Intervencao.numero == i.retifica))).scalar_one_or_none()
            if original is not None and not original.retificado_por:
                original.retificado_por = i.numero
                if not i.visita_id and original.visita_id:
                    i.visita_id = original.visita_id
        if i.visita_id:
            v = await obter_visita(session, i.visita_id)
            if v is not None:
                resumo["visitas"].append(v.id)
                seguinte = await _fechar_visita(session, i, v, momento)
                if seguinte:
                    resumo["visitas_seguintes"] += 1
                    resumo["visitas"].append(seguinte.id)
        else:
            resumo["sem_visita"].append(numero)
    return resumo


async def associar_visita(session: AsyncSession, i: Intervencao, v: Visita, momento: datetime | None = None) -> None:
    if v.estado == "cancelada":
        raise Invalido("A visita está cancelada.")
    i.visita_id, i.cliente_id = v.id, v.cliente_id
    await session.flush()
    await _fechar_visita(session, i, v, momento or agora())


def registar_peca(i: Intervencao, dia: date | None) -> None:
    if not i.aguarda_peca:
        raise Invalido("Este relatório não está à espera de peça.")
    i.peca_recebida_em = dia or agora().date()


async def obter_relatorio(session: AsyncSession, numero: str) -> Intervencao | None:
    stmt = (select(Intervencao).where(Intervencao.numero == numero)
            .options(selectinload(Intervencao.visita).selectinload(Visita.cliente), selectinload(Intervencao.cliente)))
    return (await session.execute(stmt)).scalar_one_or_none()


async def listar_relatorios(session: AsyncSession, q: str = "", limite: int = 300) -> list[Intervencao]:
    stmt = (select(Intervencao)
            .options(selectinload(Intervencao.visita), selectinload(Intervencao.cliente))
            .order_by(Intervencao.data.desc(), Intervencao.numero.desc()).limit(limite))
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Intervencao.numero.ilike(like), Intervencao.cliente_nome.ilike(like),
                              Intervencao.morada.ilike(like), Intervencao.orcamento_numero.ilike(like),
                              Intervencao.tecnico.ilike(like)))
    return list((await session.execute(stmt)).scalars())


async def manutencoes_previstas(session: AsyncSession, ate: date) -> list[Intervencao]:
    """Relatórios com «próxima visita» até esta data, de clientes sem visita marcada depois do relatório."""
    stmt = (select(Intervencao)
            .where(Intervencao.proxima_visita.is_not(None), Intervencao.proxima_visita <= ate,
                   Intervencao.retificado_por == "")
            .options(selectinload(Intervencao.cliente)).order_by(Intervencao.proxima_visita))
    out = []
    for i in (await session.execute(stmt)).scalars():
        if i.cliente_id is None:
            out.append(i)
            continue
        depois = (await session.execute(select(Visita.id).where(
            Visita.cliente_id == i.cliente_id, Visita.estado != "cancelada",
            Visita.criada_em > datetime.combine(i.data, time.max)))).first()
        if not depois:
            out.append(i)
    return out


def duracao_relatorio(i: Intervencao) -> str:
    try:
        (h1, m1), (h2, m2) = (map(int, i.hora_inicio.split(":")), map(int, i.hora_fim.split(":")))
    except ValueError:
        return ""
    minutos = (h2 * 60 + m2) - (h1 * 60 + m1)
    return f"{minutos // 60}:{minutos % 60:02d}" if minutos >= 0 else ""

# ---------------------------------------------------------------- exportação para o funil

COLUNAS_EXPORTACAO = (
    "visita", "anterior", "cliente", "telefone", "email", "nif", "referencia", "tipo_trabalho", "prioridade",
    "tecnico", "estado", "criada_em", "marcada_em", "inicio", "fim", "feita_em", "cancelada_em", "relatorio",
    "resultado", "peca_encomendada_em", "peca_recebida_em",
)


def _iso(valor) -> str:
    if valor is None:
        return ""
    return valor.isoformat(sep=" ") if isinstance(valor, datetime) else valor.isoformat()


async def linhas_exportacao(session: AsyncSession) -> list[dict]:
    """Uma linha por visita, com o relatório que a fechou (o que vale, não o retificado). É o ficheiro que o funil
    lê em dados/agenda/."""
    stmt = select(Visita).options(*_carregar_visita()).order_by(Visita.criada_em, Visita.id)
    linhas = []
    for v in (await session.execute(stmt)).scalars():
        validos = [r for r in v.relatorios if not r.retificado_por]
        r = validos[-1] if validos else None
        c = v.cliente
        linhas.append({
            "visita": v.id, "anterior": v.anterior_id or "", "cliente": c.nome, "telefone": c.telefone,
            "email": c.email, "nif": c.nif, "referencia": v.referencia, "tipo_trabalho": v.tipo_trabalho,
            "prioridade": v.prioridade, "tecnico": v.tecnico.nome if v.tecnico else "", "estado": v.estado,
            "criada_em": _iso(v.criada_em), "marcada_em": _iso(v.marcada_em), "inicio": _iso(v.inicio),
            "fim": _iso(v.fim), "feita_em": _iso(v.feita_em), "cancelada_em": _iso(v.cancelada_em),
            "relatorio": r.numero if r else "", "resultado": r.resultado if r else "",
            "peca_encomendada_em": _iso(r.data) if r and r.aguarda_peca else "",
            "peca_recebida_em": _iso(r.peca_recebida_em) if r else "",
        })
    return linhas
