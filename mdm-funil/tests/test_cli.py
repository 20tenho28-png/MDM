"""Comandos de ponta a ponta: exemplo, revisão manual, amostra cega, concordância e remetentes."""

import csv
import random

from funil.__main__ import principal
from funil.fontes.tabelas import ler_tabela


def _ler(caminho):
    with open(caminho, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def _escrever(caminho, linhas):
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(linhas)


def test_fluxo_completo(tmp_path, capsys):
    assert principal(["--pasta", str(tmp_path), "exemplo", "mundo"]) == 0
    projeto = tmp_path / "mundo"
    for nome in ("relatorio.html", "pedidos.csv", "segmentos.csv", "semanal.csv", "teste_regras.csv", "rever_ligacoes.csv"):
        assert (projeto / "saida" / nome).exists(), nome
    revisao = projeto / "revisao" / "pedidos.csv"
    linhas = _ler(revisao)
    assert linhas and {"incluir", "tipo", "empresa", "resultado", "motivo", "nota"} <= set(linhas[0])

    # Correções à mão: excluir um pedido, marcar outro como ganho e escrever uma nota.
    alvo_excluir, alvo_ganho = linhas[0]["id"], linhas[1]["id"]
    linhas[0]["incluir"] = "N"
    linhas[1]["resultado"] = "ganho"
    linhas[1]["nota"] = "fechado por telefone"
    _escrever(revisao, linhas)
    assert principal(["--pasta", str(projeto), "analisar"]) == 0
    pedidos = {l["id"]: l for l in _ler(projeto / "saida" / "pedidos.csv")}
    assert pedidos[alvo_excluir]["incluir"] == "N"
    assert pedidos[alvo_ganho]["ganho"] == "S" and pedidos[alvo_ganho]["revisto"] == "S"
    depois = {l["id"]: l for l in _ler(revisao)}
    assert depois[alvo_ganho]["nota"] == "fechado por telefone"
    assert depois[alvo_excluir]["incluir"] == "N"

    # Amostra cega e concordância.
    assert principal(["--pasta", str(projeto), "amostra", "--n", "30"]) == 0
    a = _ler(projeto / "saida" / "amostra_A.csv")
    assert len(a) == 30 and all(l["prioridade"] == "" for l in a)
    rng = random.Random(1)
    for l in a:
        l["prioridade"] = rng.choice(["P1", "P2", "P3"])
    b = [dict(l, prioridade=(l["prioridade"] if rng.random() < 0.8 else rng.choice(["P1", "P2", "P3"]))) for l in a]
    _escrever(projeto / "saida" / "amostra_A.csv", a)
    _escrever(projeto / "saida" / "amostra_B.csv", b)
    capsys.readouterr()
    assert principal(["--pasta", str(projeto), "concordancia", "saida/amostra_A.csv", "saida/amostra_B.csv"]) == 0
    saida = capsys.readouterr().out
    assert "30 pedidos classificados" in saida and "kappa" in saida
    assert (projeto / "saida" / "desacordos.csv").exists()

    # Remetentes.
    assert principal(["--pasta", str(projeto), "remetentes"]) == 0
    dominios = [l["dominio"] for l in ler_tabela(projeto / "saida" / "remetentes.csv")]
    assert "distribuidor-exemplo.pt" in dominios and "gmail.com" in dominios


def test_pasta_sem_dados(tmp_path, capsys):
    assert principal(["--pasta", str(tmp_path), "analisar"]) == 1
    assert "dados" in capsys.readouterr().out
    # A ordem do README também tem de funcionar: comando primeiro, --pasta depois.
    assert principal(["analisar", "--pasta", str(tmp_path)]) == 1
