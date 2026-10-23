"""As visitas marcadas no Google Calendar de cada técnico.

Cada técnico tem um calendário Google (o «ID do calendário» na ficha dele no ERP), partilhado com a conta de serviço
do ERP com permissão para fazer alterações. O ERP mantém lá um evento por visita marcada ou feita, com a morada, o
telefone e a ligação que abre a app dos relatórios já com a visita; tira-o quando a visita é cancelada, desmarcada ou
muda de técnico. O ID do evento sai do número da visita, por isso sincronizar duas vezes não duplica nada.

Sem GOOGLE_CREDENCIAIS (o ficheiro JSON da conta de serviço), nada disto corre e o ERP funciona como sempre.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from urllib.parse import quote

import httpx
from sqlalchemy import or_, select

from mdm.config import Settings, get_settings
from mdm.db import get_sessionmaker
from mdm.erp.models import Visita

log = logging.getLogger(__name__)

API = "https://www.googleapis.com/calendar/v3"
ESCOPO = "https://www.googleapis.com/auth/calendar.events"
FUSO = "Europe/Lisbon"
# Cores do Google Calendar: 11 vermelho (P1), 6 laranja (P2), 9 azul (P3), 10 verde (feita).
_COR = {"P1": "11", "P2": "6", "P3": "9"}


class ErroGoogle(Exception):
    """O Google recusou o pedido; a mensagem é para mostrar no ERP."""


def ativo(settings: Settings | None = None) -> bool:
    return bool((settings or get_settings()).google_credenciais)


def id_evento(visita_id: int) -> str:
    """ID do evento no Google: só letras a-v e algarismos (base32hex), 5 ou mais caracteres."""
    return f"mdmv{visita_id:06d}"


class Credenciais:
    """O token de acesso da conta de serviço, renovado antes de expirar."""

    def __init__(self, caminho: str):
        self.caminho = caminho
        self._cred = None

    def _renovar(self) -> str:
        from google.auth.transport.requests import Request
        from google.oauth2 import service_account

        if self._cred is None:
            self._cred = service_account.Credentials.from_service_account_file(self.caminho, scopes=[ESCOPO])
        if not self._cred.valid:
            self._cred.refresh(Request())
        return self._cred.token

    async def token(self) -> str:
        return await asyncio.to_thread(self._renovar)


class Calendario:
    """As três operações de que o ERP precisa na API do Google Calendar."""

    def __init__(self, token, cliente: httpx.AsyncClient):
        self._token = token
        self._cliente = cliente

    async def _pedido(self, metodo: str, url: str, **kw) -> httpx.Response:
        cabecalhos = {"Authorization": f"Bearer {await self._token()}"}
        return await self._cliente.request(metodo, API + url, headers=cabecalhos, timeout=20, **kw)

    @staticmethod
    def _url(calendario: str, evento: str = "") -> str:
        return f"/calendars/{quote(calendario, safe='')}/events" + (f"/{evento}" if evento else "")

    @staticmethod
    def _falhou(resp: httpx.Response, o_que: str) -> ErroGoogle:
        try:
            motivo = resp.json()["error"]["message"]
        except (ValueError, KeyError, TypeError):
            motivo = resp.text[:200]
        if resp.status_code == 404:
            motivo = "o calendário não existe ou não está partilhado com a conta do ERP"
        elif resp.status_code == 403:
            motivo = "sem permissão: partilha o calendário com a conta do ERP com «Fazer alterações a eventos»"
        return ErroGoogle(f"Google Calendar ({o_que}, {resp.status_code}): {motivo}")

    async def guardar(self, calendario: str, evento: dict) -> None:
        """Atualiza o evento; se ainda não existir, cria-o com o mesmo ID (também repõe um evento apagado)."""
        resp = await self._pedido("PUT", self._url(calendario, evento["id"]), json=evento)
        if resp.status_code == 404:
            resp = await self._pedido("POST", self._url(calendario), json=evento)
            if resp.status_code == 409:   # já existia (apagado): o PUT com estado confirmado repõe-no
                resp = await self._pedido("PUT", self._url(calendario, evento["id"]), json=evento)
        if resp.status_code >= 400:
            raise self._falhou(resp, "guardar")

    async def apagar(self, calendario: str, evento_id: str) -> None:
        resp = await self._pedido("DELETE", self._url(calendario, evento_id))
        if resp.status_code >= 400 and resp.status_code not in (404, 410):
            raise self._falhou(resp, "apagar")


def evento(v: Visita, settings: Settings) -> dict:
    """O evento do Google Calendar desta visita."""
    c = v.cliente
    feita = v.estado == "feita"
    titulo = f"{c.nome} · {v.nome_tipo}" + (f" ({v.prioridade})" if v.prioridade else "")
    linhas = [f"Telefone: {c.telefone}" if c.telefone else "", f"Referência: {v.referencia}" if v.referencia else "",
              v.descricao, ""]
    base = settings.erp_url.rstrip("/")
    if base and not feita:
        linhas.append(f"Fazer o relatório: {base}/erp/ri?visita={v.id}")
    if base:
        linhas.append(f"Visita no ERP: {base}/erp/visitas/{v.id}")
    linhas.append(f"Ref. interna para o relatório: V{v.id:04d}")
    fim = v.fim or v.inicio + timedelta(hours=1)
    return {
        "id": id_evento(v.id),
        "status": "confirmed",
        "summary": ("Feita · " if feita else "") + titulo,
        "location": v.morada or c.morada_completa,
        "description": "\n".join(l for l in linhas if l is not None).strip(),
        "start": {"dateTime": v.inicio.isoformat(timespec="seconds"), "timeZone": FUSO},
        "end": {"dateTime": fim.isoformat(timespec="seconds"), "timeZone": FUSO},
        "colorId": "10" if feita else _COR.get(v.prioridade, "9"),
        "reminders": {"useDefault": False, "overrides": [] if feita else [{"method": "popup", "minutes": 60}]},
        "extendedProperties": {"private": {"mdm_visita": str(v.id)}},
    }


def destino(v: Visita) -> str:
    """O calendário onde a visita deve estar ("" = em nenhum)."""
    if v.estado not in ("marcada", "feita") or v.inicio is None or v.tecnico is None:
        return ""
    return (v.tecnico.calendario_id or "").strip()


async def sincronizar(cal: Calendario, v: Visita, settings: Settings, momento: datetime) -> None:
    """Põe o Google Calendar como a visita está agora e regista o resultado na visita (sem fazer commit)."""
    alvo = destino(v)
    try:
        if v.google_calendario and v.google_calendario != alvo:
            await cal.apagar(v.google_calendario, id_evento(v.id))
            v.google_calendario = ""
        if alvo:
            await cal.guardar(alvo, evento(v, settings))
            v.google_calendario = alvo
        v.google_erro = ""
    except (ErroGoogle, httpx.HTTPError) as erro:
        v.google_erro = str(erro)[:500]
        log.warning("Visita %s: %s", v.id, erro)
    v.google_sincronizada_em = momento


async def sincronizar_visitas(ids: list[int] | None = None, desde: date | None = None,
                              cal: Calendario | None = None) -> dict:
    """Sincroniza estas visitas (ou, sem ids, todas as que começam a partir de `desde`). Corre depois da resposta."""
    settings = get_settings()
    if cal is None and not ativo(settings):
        return {"ativo": False}
    from mdm.erp.service import _carregar_visita, agora

    stmt = select(Visita).options(*_carregar_visita())
    if ids is not None:
        if not ids:
            return {"ativo": True, "visitas": 0, "erros": 0}
        stmt = stmt.where(Visita.id.in_(ids))
    else:
        inicio = datetime.combine(desde or agora().date(), time.min)
        # As que têm data a partir de hoje e as que ainda estão num calendário (para as tirar, se for o caso).
        stmt = stmt.where(or_(Visita.inicio >= inicio, Visita.google_calendario != ""))
    sm = get_sessionmaker()
    async with httpx.AsyncClient() as cliente, sm() as session:
        cal = cal or Calendario(Credenciais(settings.google_credenciais).token, cliente)
        visitas = list((await session.execute(stmt)).scalars())
        momento = agora()
        for v in visitas:
            await sincronizar(cal, v, settings, momento)
        await session.commit()
    return {"ativo": True, "visitas": len(visitas), "erros": sum(1 for v in visitas if v.google_erro)}


async def em_segundo_plano(ids: list[int]) -> None:
    """Para as BackgroundTasks: um erro aqui nunca deve aparecer ao utilizador como erro da página."""
    try:
        await sincronizar_visitas(ids)
    except Exception:  # noqa: BLE001
        log.exception("Sincronização com o Google Calendar falhou (visitas %s)", ids)
