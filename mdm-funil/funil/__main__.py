"""Linha de comandos: python -m funil <comando> [--pasta PASTA]."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path


def _analisar(pasta: Path, silencioso: bool = False):
    from . import saidas
    from .motor import executar
    from .relatorio import gerar_html

    r = executar(pasta)
    saida = pasta / "saida"
    saida.mkdir(parents=True, exist_ok=True)
    saidas.escrever_pedidos(r.pedidos, saida / "pedidos.csv")
    saidas.escrever_segmentos(r.segmentos, saida / "segmentos.csv")
    saidas.escrever_semanal(r.semanal, saida / "semanal.csv")
    saidas.escrever_teste(r.teste, saida / "teste_regras.csv")
    saidas.escrever_ligacoes(r.ligacoes, r.partilhados, saida / "rever_ligacoes.csv")
    novos = saidas.atualizar_revisao(r.pedidos, pasta / "revisao" / "pedidos.csv")
    saidas.garantir_ligacoes(pasta / "revisao" / "ligacoes.csv")
    (saida / "relatorio.html").write_text(gerar_html(r), encoding="utf-8")
    if not silencioso:
        incl = [p for p in r.pedidos if p.incluir]
        print(f"Eventos lidos: {len(r.eventos)}  |  pedidos: {len(r.pedidos)} (analisados: {len(incl)})")
        for fonte, c in r.cobertura["fontes"].items():
            print(f"  {c['descricao']}: {c['ficheiros']} ficheiro(s), {c['eventos']} registo(s)")
        for aviso in r.cobertura["avisos"]:
            print(f"  Aviso: {aviso}")
        print(f"Relatório: {saida / 'relatorio.html'}")
        print(f"Um pedido por linha: {saida / 'pedidos.csv'}")
        print(f"Para rever à mão: {pasta / 'revisao' / 'pedidos.csv'} ({novos} pedido(s) novo(s))"
              f" e {saida / 'rever_ligacoes.csv'} ({len(r.ligacoes)} linha(s))")
    return r


def _remetentes(pasta: Path) -> None:
    from .config import carregar
    from .fontes import correio
    cfg = carregar(pasta / "config.toml")
    caixas = sorted((pasta / "dados" / "email").rglob("*.mbox"))
    if not caixas:
        print("Não há ficheiros .mbox em dados/email.")
        return
    linhas = correio.remetentes(caixas, cfg)
    destino = pasta / "saida" / "remetentes.csv"
    destino.parent.mkdir(parents=True, exist_ok=True)
    with open(destino, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["dominio", "mensagens", "automaticas", "remetentes", "exemplos_de_assunto"])
        for l in linhas:
            w.writerow([l["dominio"], l["mensagens"], l["automaticas"], l["remetentes"], l["assuntos"]])
    print("Domínios com mais mensagens (copia os de fornecedores para [email] dominios_ignorar):")
    for l in linhas[:25]:
        print(f"  {l['mensagens']:>5}  {l['dominio']:<35} {l['assuntos'][:60]}")
    print(f"Lista completa: {destino}")


def _amostra(pasta: Path, n: int, semente: int) -> None:
    from .concordancia import escrever_amostra, gerar_amostra
    from .motor import executar
    from .fontes.tabelas import ler_tabela
    r = executar(pasta)
    saida, k = pasta / "saida", 1
    # Uma amostra nova usa pedidos que ainda não foram classificados.
    anteriores = sorted(saida.glob("amostra_*.csv")) if saida.exists() else []
    usados = {str(l.get("id", "")).strip() for f in anteriores for l in ler_tabela(f)}
    amostra = gerar_amostra(r.pedidos, n, semente, excluir=usados)
    if not amostra:
        print("Não há pedidos novos para uma amostra (todos os pedidos com texto já foram classificados).")
        return
    # Nunca escreve por cima de uma amostra anterior (pode já ter classificações).
    while True:
        sufixo = "" if k == 1 else f"_{k}"
        nomes = [f"amostra_A{sufixo}.csv", f"amostra_B{sufixo}.csv"]
        if not any((saida / x).exists() for x in nomes):
            break
        k += 1
    for nome in nomes:
        escrever_amostra(amostra, saida / nome)
    print(f"{len(amostra)} pedidos em saida/{nomes[0]} e saida/{nomes[1]}.")
    print("Cada pessoa preenche a coluna 'prioridade' (P1, P2 ou P3) no seu ficheiro, sem ver o outro.")
    print(f"Depois: python -m funil concordancia saida/{nomes[0]} saida/{nomes[1]}")


def _concordancia(pasta: Path, a: str, b: str) -> None:
    from .concordancia import comparar, ler_classificacoes
    from .motor import executar
    from .relatorio import num
    r = executar(pasta)
    ca, cb = ler_classificacoes(pasta / a if not Path(a).is_absolute() else Path(a)), \
        ler_classificacoes(pasta / b if not Path(b).is_absolute() else Path(b))
    res = comparar(ca, cb, r.pedidos)
    if not res["n"]:
        print("Não há pedidos classificados pelas duas pessoas.")
        return

    def linha(nome, x):
        if not x or x["kappa"] is None:
            return f"  {nome}: sem dados"
        intervalo = f" (95%: {num(x['ic'][0], 2)} a {num(x['ic'][1], 2)})" if x["ic"] else ""
        return (f"  {nome}: kappa {num(x['kappa'], 2)}{intervalo}, {x['leitura']}; "
                f"ponderado {num(x['kappa_ponderado'], 2)}; acordo bruto {num((x['acordo'] or 0) * 100)}%")

    print(f"{res['n']} pedidos classificados pelas duas pessoas.")
    print(linha("Pessoa A vs pessoa B", res["pessoas"]))
    print(linha("A vs regra atual", res["a_vs_regra_atual"]))
    print(linha("B vs regra atual", res["b_vs_regra_atual"]))
    print(linha("A vs regra sugerida", res["a_vs_regra_sugerida"]))
    print(linha("B vs regra sugerida", res["b_vs_regra_sugerida"]))
    print("Matriz (linhas A, colunas B):")
    print("        P1   P2   P3")
    for i in ("P1", "P2", "P3"):
        print(f"  {i}  " + "".join(f"{res['matriz'][f'{i}/{j}']:>5}" for j in ("P1", "P2", "P3")))
    destino = pasta / "saida" / "desacordos.csv"
    with open(destino, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["id", "pessoa_a", "pessoa_b", "mensagem"])
        for d in res["desacordos"]:
            w.writerow([d["id"], d["a"], d["b"], " ".join(d["mensagem"].split())])
    print(f"Desacordos para discutir: {destino}")
    if res["pessoas"]["kappa"] is not None and res["pessoas"]["kappa"] < 0.7:
        print("O kappa entre as duas pessoas está abaixo de 0,7: discutam os desacordos, tornem as regras mais claras "
              "e repitam com uma amostra nova (python -m funil amostra --semente 2).")


def _sombra(pasta: Path) -> None:
    from .motor import executar
    from .relatorio import num, pct
    from .relatorio_sombra import escrever_sombra
    from .sombra import CLASSES, executar_sombra
    r = executar(pasta)
    s = executar_sombra(r)
    ficheiros = escrever_sombra(s, pasta / "saida")
    print("Prazos (P1 / P2 / P3):")
    for est in s.estados:
        vals = " / ".join("–" if s.prazos[(est.chave, c)] is None else num(s.prazos[(est.chave, c)], 1) for c in CLASSES)
        origem = " (da configuração)" if any(s.origem[(est.chave, c)] == "configuração" for c in CLASSES) else ""
        print(f"  {est.nome}: {vals} {est.unidade}{origem}")
    rp = s.replay
    if rp["perdidos"]:
        print(f"Perdidos que teriam ficado vermelhos a tempo: {rp['perdidos_vermelhos']} de {rp['perdidos']} "
              f"({pct(rp['perdidos_vermelhos'] / rp['perdidos'])}).")
    if rp["perda_se_vermelho"] is not None and rp["perda_se_verde"] is not None:
        print(f"Perde-se {pct(rp['perda_se_vermelho'])} dos vermelhos e {pct(rp['perda_se_verde'])} dos verdes.")
    print(f"Pedidos com cobranças do cliente: {rp['cobrados']} (vermelho antes da primeira: {rp['cobrados_com_aviso']}).")
    m = s.manha.get("regra") or {}
    if m.get("vermelhos") is not None:
        print(f"Vermelhos por manhã: {num(m['vermelhos'], 1)} (dos quais {num(m['nunca_fecharam'], 1)} nunca fecharam), "
              f"sem a regra dos 30 dias {num(s.manha['painel']['vermelhos'], 1)}.")
    if s.quota:
        print(f"Regras de entrada: {pct(s.quota['p1'])} em P1 e {pct(s.quota['p1p2'])} em P1 ou P2 "
              f"(quota {pct(s.quota['quota_p1'])} e {pct(s.quota['quota_p1p2'])}).")
    if s.envios_por_confirmar:
        print(f"Orçamentos sem prova de envio (contam a partir da data do ORC): {s.envios_por_confirmar}.")
    print(f"Página para validar: {ficheiros[0]}")
    print(f"Prazos para copiar para o config.toml depois de validar: {ficheiros[1]}")


def principal(argv=None) -> int:
    ajuda_pasta = "pasta do projeto, com dados/, config.toml e revisao/ (por defeito, a atual)"
    ap = argparse.ArgumentParser(prog="python -m funil", description="Funil de pedidos MDM, do contacto à fatura.")
    ap.add_argument("--pasta", default=".", help=ajuda_pasta)
    # --pasta também funciona depois do comando (python -m funil analisar --pasta X).
    comum = argparse.ArgumentParser(add_help=False)
    comum.add_argument("--pasta", default=argparse.SUPPRESS, help=ajuda_pasta)
    sub = ap.add_subparsers(dest="comando", required=True)
    sub.add_parser("analisar", parents=[comum], help="lê os dados, reconstrói os pedidos e escreve o relatório em saida/")
    sub.add_parser("remetentes", parents=[comum], help="lista os domínios que mais enviam email, para escolher o que ignorar")
    a = sub.add_parser("amostra", parents=[comum], help="cria dois ficheiros para duas pessoas classificarem P1/P2/P3 às cegas")
    a.add_argument("--n", type=int, default=40, help="número de pedidos na amostra (por defeito, 40)")
    a.add_argument("--semente", type=int, default=11, help="muda o número para tirar uma amostra diferente")
    c = sub.add_parser("concordancia", parents=[comum], help="compara as classificações das duas pessoas (kappa de Cohen)")
    c.add_argument("ficheiro_a")
    c.add_argument("ficheiro_b")
    sub.add_parser("sombra", parents=[comum],
                   help="aplica os estados e os prazos ao histórico (modo sombra) e escreve saida/sombra.html")
    e = sub.add_parser("exemplo", parents=[comum], help="gera dados inventados com respostas conhecidas e corre a análise")
    e.add_argument("destino", nargs="?", default="exemplo")
    e.add_argument("--semente", type=int, default=7)
    args = ap.parse_args(argv)
    pasta = Path(args.pasta).resolve()

    if args.comando == "analisar":
        if not (pasta / "dados").exists():
            print(f"Não encontrei a pasta {pasta / 'dados'}. Cria-a e põe lá os ficheiros (vê o README).")
            return 1
        _analisar(pasta)
    elif args.comando == "remetentes":
        _remetentes(pasta)
    elif args.comando == "sombra":
        if not (pasta / "dados").exists():
            print(f"Não encontrei a pasta {pasta / 'dados'}. Cria-a e põe lá os ficheiros (vê o README).")
            return 1
        _sombra(pasta)
    elif args.comando == "amostra":
        _amostra(pasta, args.n, args.semente)
    elif args.comando == "concordancia":
        _concordancia(pasta, args.ficheiro_a, args.ficheiro_b)
    elif args.comando == "exemplo":
        from .exemplo import gerar
        destino = Path(args.destino)
        destino = destino if destino.is_absolute() else pasta / destino
        gerar(destino, semente=args.semente)
        print(f"Dados de exemplo em {destino}")
        _analisar(destino)
    return 0


if __name__ == "__main__":
    sys.exit(principal())
