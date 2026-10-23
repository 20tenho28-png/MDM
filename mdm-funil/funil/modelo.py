"""Estruturas de dados: eventos (cada contacto ou documento) e pedidos (um pedido de cliente do início ao fim)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Evento:
    ts: datetime
    fonte: str             # email | whatsapp | chamada | site | orc | fatura
    direcao: str | None    # entrada (cliente para MDM) | saida (MDM para cliente) | None (documentos)
    tipo: str              # mensagem | chamada_atendida | chamada_perdida | chamada_saida | formulario | orcamento | fatura
    uid: str               # identificador estável na origem
    nome: str = ""
    chaves: set = field(default_factory=set)      # tel:..., email:..., nif:..., nome:..., wa:...
    texto: str = ""
    refs_orc: set = field(default_factory=set)    # números de orçamento mencionados
    valor: float | None = None
    numero: str = ""
    extra: dict = field(default_factory=dict)
    cliente: int | None = None


@dataclass
class Pedido:
    id: str
    cliente: int
    origem: Evento | None
    eventos: list = field(default_factory=list)
    incluir: bool = True
    confianca: str = "alta"
    nome: str = ""
    canal: str = "desconhecido"
    t_inicio: datetime | None = None
    t_contacto: datetime | None = None
    t_resposta: datetime | None = None
    h_resposta: float | None = None
    orc: str = ""
    n_orc: int = 0
    t_orc: datetime | None = None
    t_envio: datetime | None = None
    envio_confirmado: bool = False   # há uma mensagem enviada com o número ORC ou o PDF (senão, data do ORC)
    valor_orc: float | None = None
    t_aceite: datetime | None = None
    t_recusa: datetime | None = None
    motivo: str = ""
    decisao_ambigua: bool = False
    decisao_texto: str = ""
    t_fatura: datetime | None = None
    valor_fatura: float | None = None
    resultado: str = ""
    maduro: bool = False
    ganho: bool = False
    nunca_respondido: bool = False
    caracteristicas: dict = field(default_factory=dict)
    texto_inicial: str = ""
    prioridade_atual: str = ""
    prioridade_sugerida: str = ""
    revisto: bool = False

    @property
    def valor(self) -> float | None:
        return self.valor_fatura if self.valor_fatura else self.valor_orc

    @property
    def t_ganho(self) -> datetime | None:
        if not self.ganho:
            return None
        datas = [t for t in (self.t_aceite, self.t_fatura) if t]
        return min(datas) if datas else None

    @property
    def t_decisao(self) -> datetime | None:
        datas = [t for t in (self.t_aceite, self.t_recusa, self.t_fatura) if t]
        return min(datas) if datas else None
