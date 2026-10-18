"""Tabelas do ERP: clientes, técnicos, equipamentos, visitas (a agenda) e relatórios de intervenção.

As horas guardam-se como hora de Lisboa, sem fuso: a agenda é hora de parede (uma visita às 9h é às 9h no inverno e
no verão), e é assim que o funil as lê na exportação.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mdm.db import Base


# Valores possíveis (guardados como texto; a validação está no serviço).
TIPOS_TRABALHO = {
    "avaria": "Avaria",
    "manutencao": "Manutenção",
    "instalacao": "Instalação",
    "obra": "Obra",
    "avaliacao": "Visita para orçamento",
}
ESTADOS_VISITA = {
    "por_marcar": "Por marcar",
    "marcada": "Marcada",
    "feita": "Feita",
    "cancelada": "Cancelada",
}
RESULTADOS = {
    "concluida": "Obra concluída",
    "pendente_peca": "Aguarda peça",
    "nova_visita": "Precisa de nova visita",
}
# Estados do relatório na app FM-TEC-04 (o rascunho nunca sai do telemóvel).
ESTADOS_RELATORIO = {
    "emitido": "Emitido, aguarda validação do cliente",
    "aceite": "Aceite pelo cliente",
    "recusado": "Cliente recusou assinar",
    "ausente": "Cliente ausente, validação por email",
}
PRIORIDADES = ("P1", "P2", "P3")


class Cliente(Base):
    __tablename__ = "erp_clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255))
    telefone: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    nif: Mapped[str] = mapped_column(String(20), default="")
    morada: Mapped[str] = mapped_column(String(500), default="")
    codigo_postal: Mapped[str] = mapped_column(String(20), default="")
    localidade: Mapped[str] = mapped_column(String(120), default="")
    notas: Mapped[str] = mapped_column(Text, default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime)

    equipamentos: Mapped[list[Equipamento]] = relationship(
        back_populates="cliente", order_by="Equipamento.id", cascade="all, delete-orphan"
    )
    visitas: Mapped[list[Visita]] = relationship(back_populates="cliente", order_by="Visita.id")

    @property
    def morada_completa(self) -> str:
        linha2 = " ".join(x for x in (self.codigo_postal, self.localidade) if x)
        return ", ".join(x for x in (self.morada, linha2) if x)


class Tecnico(Base):
    __tablename__ = "erp_tecnicos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120))
    telefone: Mapped[str] = mapped_column(String(40), default="")
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)


class Equipamento(Base):
    __tablename__ = "erp_equipamentos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("erp_clientes.id", ondelete="CASCADE"), index=True)
    tipo: Mapped[str] = mapped_column(String(80), default="")        # split, multi-split, bomba de calor...
    marca: Mapped[str] = mapped_column(String(80), default="")
    modelo: Mapped[str] = mapped_column(String(120), default="")
    numero_serie: Mapped[str] = mapped_column(String(120), default="")
    localizacao: Mapped[str] = mapped_column(String(120), default="")  # sala, quarto 1, cobertura...
    gas: Mapped[str] = mapped_column(String(20), default="")          # R32, R410A...
    carga_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    instalado_em: Mapped[date | None] = mapped_column(Date, nullable=True)
    notas: Mapped[str] = mapped_column(Text, default="")

    cliente: Mapped[Cliente] = relationship(back_populates="equipamentos")

    @property
    def descricao(self) -> str:
        partes = [self.tipo, self.marca, self.modelo]
        texto = " ".join(p for p in partes if p) or "Equipamento"
        return f"{texto} ({self.localizacao})" if self.localizacao else texto


class Visita(Base):
    """Uma deslocação ao cliente. Nasce «por marcar»; fica «marcada» quando tem dia e hora; «feita» quando chega o
    relatório de intervenção dela."""

    __tablename__ = "erp_visitas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("erp_clientes.id"), index=True)
    tecnico_id: Mapped[int | None] = mapped_column(ForeignKey("erp_tecnicos.id"), nullable=True, index=True)
    # Número ORC ou outra referência do pedido: é o que liga a visita ao pedido no funil.
    referencia: Mapped[str] = mapped_column(String(80), default="")
    tipo_trabalho: Mapped[str] = mapped_column(String(20), default="avaria")
    prioridade: Mapped[str] = mapped_column(String(2), default="")
    descricao: Mapped[str] = mapped_column(Text, default="")
    morada: Mapped[str] = mapped_column(String(500), default="")
    estado: Mapped[str] = mapped_column(String(20), default="por_marcar")
    inicio: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    fim: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(DateTime)
    marcada_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    feita_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelada_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    motivo_cancelamento: Mapped[str] = mapped_column(String(500), default="")
    # A visita que esta continua (nova visita ou peça que chegou).
    anterior_id: Mapped[int | None] = mapped_column(ForeignKey("erp_visitas.id"), nullable=True)

    cliente: Mapped[Cliente] = relationship(back_populates="visitas")
    tecnico: Mapped[Tecnico | None] = relationship()
    relatorios: Mapped[list[Intervencao]] = relationship(back_populates="visita", order_by="Intervencao.id")

    __table_args__ = (Index("ix_erp_visitas_estado_inicio", "estado", "inicio"),)

    @property
    def nome_tipo(self) -> str:
        return TIPOS_TRABALHO.get(self.tipo_trabalho, self.tipo_trabalho)

    @property
    def nome_estado(self) -> str:
        return ESTADOS_VISITA.get(self.estado, self.estado)


class Intervencao(Base):
    """Relatório de intervenção (FM-TEC-04) emitido na app dos técnicos e recebido pelo ERP.

    O relatório faz-se no telemóvel, na app de sempre (funciona sem rede). O ERP guarda o JSON tal como veio (`dados`,
    com assinaturas e fotografias) e tira dele as colunas de que precisa para a agenda, as pesquisas e o funil."""

    __tablename__ = "erp_intervencoes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    numero: Mapped[str] = mapped_column(String(30), unique=True, index=True)   # RI-2026-AL-0001
    visita_id: Mapped[int | None] = mapped_column(ForeignKey("erp_visitas.id"), nullable=True, index=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("erp_clientes.id"), nullable=True, index=True)
    # emitido | aceite | recusado | ausente (como na app); retificado_por diz se foi substituído.
    estado: Mapped[str] = mapped_column(String(20))
    retifica: Mapped[str] = mapped_column(String(30), default="")
    retificado_por: Mapped[str] = mapped_column(String(30), default="")
    data: Mapped[date] = mapped_column(Date, index=True)
    hora_inicio: Mapped[str] = mapped_column(String(5), default="")
    hora_fim: Mapped[str] = mapped_column(String(5), default="")
    tecnico: Mapped[str] = mapped_column(String(255), default="")
    cliente_nome: Mapped[str] = mapped_column(String(255), default="")
    morada: Mapped[str] = mapped_column(String(500), default="")
    tipo_intervencao: Mapped[str] = mapped_column(String(80), default="")
    orcamento_numero: Mapped[str] = mapped_column(String(80), default="")
    ref_interna: Mapped[str] = mapped_column(String(80), default="")
    descricao: Mapped[str] = mapped_column(Text, default="")
    obra_concluida: Mapped[bool] = mapped_column(Boolean, default=True)
    pendentes: Mapped[str] = mapped_column(Text, default="")
    proxima_visita: Mapped[date | None] = mapped_column(Date, nullable=True)
    houve_gas: Mapped[bool] = mapped_column(Boolean, default=False)
    refrigerante: Mapped[str] = mapped_column(String(40), default="")
    gas_adicionado_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    gas_recuperado_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Obra por concluir à espera de uma peça: até a peça chegar, a visita seguinte não se marca.
    aguarda_peca: Mapped[bool] = mapped_column(Boolean, default=False)
    peca_recebida_em: Mapped[date | None] = mapped_column(Date, nullable=True)
    hash: Mapped[str] = mapped_column(String(64), default="")
    criado_na_app: Mapped[str] = mapped_column(String(25), default="")
    dados: Mapped[dict] = mapped_column(JSON)
    importado_em: Mapped[datetime] = mapped_column(DateTime)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime)

    visita: Mapped[Visita | None] = relationship(back_populates="relatorios")
    cliente: Mapped[Cliente | None] = relationship()

    @property
    def nome_estado(self) -> str:
        if self.retificado_por:
            return f"Retificado por {self.retificado_por}"
        return ESTADOS_RELATORIO.get(self.estado, self.estado)

    @property
    def resultado(self) -> str:
        """Para a agenda e o funil: concluida, pendente_peca ou nova_visita."""
        if self.obra_concluida:
            return "concluida"
        return "pendente_peca" if self.aguarda_peca else "nova_visita"

    @property
    def nome_resultado(self) -> str:
        return RESULTADOS.get(self.resultado, self.resultado)
