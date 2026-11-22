"""Execução completa: lê os dados, liga clientes, constrói pedidos e calcula a análise."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from . import analise, prioridade
from .config import carregar, data_referencia
from .datas import Calendario
from .estatistica import xmr
from .fontes import ler_tudo
from .fontes.tabelas import ler_tabela
from .identidade import chave_manual, resolver
from .modelo import Evento, Pedido
from .pedidos import aplicar_revisao, construir, sugerir_ligacoes


@dataclass
class Resultado:
    pasta: Path
    cfg: dict
    hoje: date
    cal: Calendario
    eventos: list[Evento]
    pedidos: list[Pedido]
    cobertura: dict
    ligacoes: list[dict]
    partilhados: set
    contagem: dict
    corrigidos: int
    funil: list
    tempos: list
    velocidade: list
    esperas: dict
    gargalo: dict
    motivos: list
    segmentos: list
    mapa: dict
    efeito: dict | None
    teste: dict | None
    semanal: list
    xmr_resposta: dict | None
    xmr_ganhos: dict | None
    semanas_xmr: list
    periodos_ganhos: list
    ganhos_periodo: list


def _ler_se_existe(caminho: Path) -> list[dict]:
    return ler_tabela(caminho) if caminho.exists() else []


def _ligacoes_manuais(linhas: list[dict], eventos: list[Evento], avisos: list[str]) -> list[tuple[str, str]]:
    """Pares de chaves de revisao/ligacoes.csv, na forma interna. Avisa das que não se percebem ou não existem."""
    existentes = set().union(*(e.chaves for e in eventos)) if eventos else set()
    existentes |= {f"orc:{r}" for e in eventos for r in e.refs_orc}
    pares, problemas = [], []
    for l in linhas:
        brutas = [str(l.get("chave_a") or "").strip(), str(l.get("chave_b") or "").strip()]
        if not any(brutas):
            continue
        chaves = [chave_manual(b) for b in brutas]
        for bruta, chave in zip(brutas, chaves):
            if chave is None:
                problemas.append(f"«{bruta}» não se percebe" if bruta else "falta uma das duas chaves")
            elif chave not in existentes:
                problemas.append(f"«{bruta}» não aparece nos dados")
        if all(chaves):
            pares.append((chaves[0], chaves[1]))
    if problemas:
        avisos.append("Em revisao/ligacoes.csv: " + "; ".join(problemas[:8]) + (" e outros" if len(problemas) > 8 else "")
                      + ". Escreve telefones, emails, NIF (nif:123456789) ou números ORC como aparecem nos ficheiros.")
    return pares


def executar(pasta: Path | str) -> Resultado:
    pasta = Path(pasta)
    cfg = carregar(pasta / "config.toml")
    hoje = data_referencia(cfg)
    cal = Calendario.de_config(cfg)

    eventos, cobertura = ler_tudo(pasta / "dados", cfg)
    juntar = _ligacoes_manuais(_ler_se_existe(pasta / "revisao" / "ligacoes.csv"), eventos, cobertura["avisos"])
    ligacoes, partilhados, descartados = resolver(eventos, cfg, juntar)
    pedidos, contagem = construir([e for e in eventos if e.cliente is not None], cfg, cal, hoje)
    if descartados:
        contagem["mensagens com contactos partilhados (técnicos, parceiros), ignoradas"] = descartados
    corrigidos = aplicar_revisao(pedidos, _ler_se_existe(pasta / "revisao" / "pedidos.csv"))
    ligacoes = ligacoes + sugerir_ligacoes(pedidos)

    segmentos, mapa, efeito = prioridade.custo_atraso(pedidos, cfg)
    prioridade.classificar(pedidos, cfg, mapa)

    sem = analise.semanal(pedidos, cfg, cal, hoje)
    completas = [s for s in sem if not s["parcial"]]
    # Os ganhos são poucos por semana: somados em blocos de 4 semanas (os mais recentes completos), para o gráfico
    # não mostrar «sinais» que são só acaso das contagens pequenas.
    blocos = [completas[i:i + 4] for i in range(len(completas) % 4, len(completas), 4)]
    mudanca = str(cfg["semanal"].get("data_mudanca") or "").strip()
    corte = date.fromisoformat(mudanca) if mudanca else None
    base_resp = base_ganhos = None
    if corte:
        antes = [s for s in completas if s["semana"] < corte]
        base_resp = sum(1 for s in antes if s["mediana_resposta"] is not None)
        base_ganhos = sum(1 for b in blocos if b[-1]["semana"] < corte)
    return Resultado(
        pasta=pasta, cfg=cfg, hoje=hoje, cal=cal, eventos=eventos, pedidos=pedidos, cobertura=cobertura,
        ligacoes=ligacoes, partilhados=partilhados, contagem=contagem, corrigidos=corrigidos,
        funil=analise.funil(pedidos), tempos=analise.tempos(pedidos, cal), velocidade=analise.velocidade(pedidos, cal),
        esperas=analise.esperas(pedidos, cal, hoje),
        gargalo=analise.gargalo(pedidos, cfg, hoje), motivos=analise.motivos(pedidos),
        segmentos=segmentos, mapa=mapa, efeito=efeito, teste=prioridade.teste_retido(pedidos, cfg),
        semanal=sem,
        xmr_resposta=xmr([s["mediana_resposta"] for s in completas], base_resp),
        xmr_ganhos=xmr([float(sum(s["ganhos"] for s in b)) for b in blocos], base_ganhos),
        semanas_xmr=[s["semana"] for s in completas],
        periodos_ganhos=[b[0]["semana"] for b in blocos],
        ganhos_periodo=[float(sum(s["ganhos"] for s in b)) for b in blocos],
    )
