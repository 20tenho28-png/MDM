"""Estatística simples, sem dependências: intervalos de Wilson, quantis, kappa de Cohen e gráficos XmR."""

from __future__ import annotations

import math
import random
from collections import Counter


def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    """Intervalo de confiança de 95% para uma proporção k/n (bom para amostras pequenas)."""
    if n <= 0:
        return None
    p = k / n
    den = 1 + z * z / n
    centro = (p + z * z / (2 * n)) / den
    meia = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return max(0.0, centro - meia), min(1.0, centro + meia)


def quantil(valores, q: float) -> float | None:
    xs = sorted(v for v in valores if v is not None)
    if not xs:
        return None
    pos = (len(xs) - 1) * q
    i = math.floor(pos)
    if i + 1 >= len(xs):
        return float(xs[-1])
    return xs[i] + (xs[i + 1] - xs[i]) * (pos - i)


def mediana(valores) -> float | None:
    return quantil(valores, 0.5)


def media(valores) -> float | None:
    xs = [v for v in valores if v is not None]
    return sum(xs) / len(xs) if xs else None


# ---------------------------------------------------------------- álgebra e regressão logística

def sigmoide(z: float) -> float:
    if z >= 0:
        return 1 / (1 + math.exp(-z))
    e = math.exp(z)
    return e / (1 + e)


def logit(p: float) -> float:
    p = min(max(p, 1e-6), 1 - 1e-6)
    return math.log(p / (1 - p))


def _log1pexp(z: float) -> float:
    return z + math.log1p(math.exp(-z)) if z > 0 else math.log1p(math.exp(z))


def resolver_sistema(a: list[list[float]], b: list[float]) -> list[float]:
    """Resolve a·x = b por eliminação de Gauss com pivô parcial."""
    n = len(b)
    m = [list(map(float, linha)) + [float(b[i])] for i, linha in enumerate(a)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(m[r][c]))
        if abs(m[piv][c]) < 1e-12:
            raise ValueError("sistema singular")
        m[c], m[piv] = m[piv], m[c]
        for r in range(c + 1, n):
            f = m[r][c] / m[c][c]
            if f:
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (m[r][n] - sum(m[r][k] * x[k] for k in range(r + 1, n))) / m[r][r]
    return x


def inversa(a: list[list[float]]) -> list[list[float]]:
    n = len(a)
    colunas = [resolver_sistema(a, [1.0 if i == j else 0.0 for i in range(n)]) for j in range(n)]
    return [[colunas[j][i] for j in range(n)] for i in range(n)]


def cholesky(a: list[list[float]]) -> list[list[float]]:
    n = len(a)
    l = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1):
            s = a[i][j] - sum(l[i][k] * l[j][k] for k in range(j))
            if i == j:
                l[i][j] = math.sqrt(max(s, 1e-12))
            else:
                l[i][j] = s / l[j][j]
    return l


def logistica_por_segmento(obs: list[tuple[int, float, int]], n_seg: int, nivel_base: float,
                           desvio_nivel: float = 1.0, desvio_inclinacao: float = 0.5,
                           iteracoes: int = 60) -> tuple[list[float], list[list[float]]]:
    """Regressão logística com um nível e uma inclinação por segmento, puxados para valores comuns.

    logit P(ganhar) = a_s + (b + d_s) * x, com x = dias úteis até à primeira resposta.
    Penalizações (equivalentes a distribuições normais a priori): a_s ~ N(nivel_base, desvio_nivel^2),
    d_s ~ N(0, desvio_inclinacao^2) e b ~ N(0, 10^2). Devolve os parâmetros [a_1..a_S, b, d_1..d_S] e a sua
    matriz de covariância aproximada (inversa da curvatura no ótimo).
    """
    S = n_seg
    P = 2 * S + 1
    lam_a, lam_d, lam_b = 1 / desvio_nivel ** 2, 1 / desvio_inclinacao ** 2, 1 / 100

    def eta(th, s, x):
        return th[s] + (th[S] + th[S + 1 + s]) * x

    def objetivo(th):
        ll = sum(y * eta(th, s, x) - _log1pexp(eta(th, s, x)) for s, x, y in obs)
        ll -= lam_a / 2 * sum((th[s] - nivel_base) ** 2 for s in range(S))
        ll -= lam_d / 2 * sum(th[S + 1 + s] ** 2 for s in range(S))
        return ll - lam_b / 2 * th[S] ** 2

    def gradiente_e_curvatura(th):
        g = [0.0] * P
        h = [[0.0] * P for _ in range(P)]
        for s, x, y in obs:
            p = sigmoide(eta(th, s, x))
            w = p * (1 - p)
            idx, der = (s, S, S + 1 + s), (1.0, x, x)
            for j in range(3):
                g[idx[j]] += (y - p) * der[j]
                for k in range(3):
                    h[idx[j]][idx[k]] -= w * der[j] * der[k]
        for s in range(S):
            g[s] -= lam_a * (th[s] - nivel_base)
            h[s][s] -= lam_a
            g[S + 1 + s] -= lam_d * th[S + 1 + s]
            h[S + 1 + s][S + 1 + s] -= lam_d
        g[S] -= lam_b * th[S]
        h[S][S] -= lam_b
        return g, h

    theta = [nivel_base] * S + [0.0] + [0.0] * S
    atual = objetivo(theta)
    for _ in range(iteracoes):
        g, h = gradiente_e_curvatura(theta)
        passo = resolver_sistema(h, g)
        fator = 1.0
        while True:
            novo = [t - fator * d for t, d in zip(theta, passo)]
            valor = objetivo(novo)
            if valor >= atual - 1e-12 or fator < 1e-6:
                break
            fator /= 2
        mudanca = max(abs(a - b) for a, b in zip(novo, theta))
        theta, atual = novo, valor
        if mudanca < 1e-9:
            break
    _, h = gradiente_e_curvatura(theta)
    return theta, inversa([[-v for v in linha] for linha in h])


def simular_normal(media_: list[float], cov: list[list[float]], n: int, semente: int = 3) -> list[list[float]]:
    """Amostras de uma normal multivariada (para intervalos de incerteza)."""
    l = cholesky(cov)
    rng = random.Random(semente)
    k = len(media_)
    saida = []
    for _ in range(n):
        z = [rng.gauss(0, 1) for _ in range(k)]
        saida.append([media_[i] + sum(l[i][j] * z[j] for j in range(i + 1)) for i in range(k)])
    return saida


# ---------------------------------------------------------------- concordância

def _pares(a, b, categorias):
    return [(x, y) for x, y in zip(a, b) if x in categorias and y in categorias]


def kappa(a, b, categorias=("P1", "P2", "P3")) -> float | None:
    """Kappa de Cohen (concordância além do acaso entre dois classificadores)."""
    pares = _pares(a, b, categorias)
    n = len(pares)
    if n == 0:
        return None
    po = sum(x == y for x, y in pares) / n
    ca, cb = Counter(x for x, _ in pares), Counter(y for _, y in pares)
    pe = sum(ca[c] * cb[c] for c in categorias) / (n * n)
    if pe >= 1:
        return 1.0 if po == 1 else 0.0
    return (po - pe) / (1 - pe)


def kappa_ponderado(a, b, categorias=("P1", "P2", "P3")) -> float | None:
    """Kappa com pesos lineares: discordar P1 vs P2 pesa menos do que P1 vs P3."""
    pares = _pares(a, b, categorias)
    n = len(pares)
    if n == 0 or len(categorias) < 2:
        return None
    idx = {c: i for i, c in enumerate(categorias)}
    k = len(categorias)

    def peso(i, j):
        return 1 - abs(i - j) / (k - 1)

    po = sum(peso(idx[x], idx[y]) for x, y in pares) / n
    ca, cb = Counter(x for x, _ in pares), Counter(y for _, y in pares)
    pe = sum(peso(idx[ci], idx[cj]) * ca[ci] * cb[cj] for ci in categorias for cj in categorias) / (n * n)
    if pe >= 1:
        return 1.0 if po == 1 else 0.0
    return (po - pe) / (1 - pe)


def intervalo_bootstrap(a, b, funcao=kappa, repeticoes: int = 2000, semente: int = 7,
                        categorias=("P1", "P2", "P3")) -> tuple[float, float] | None:
    pares = _pares(a, b, categorias)
    if len(pares) < 5:
        return None
    rng = random.Random(semente)
    valores = []
    for _ in range(repeticoes):
        amostra = [pares[rng.randrange(len(pares))] for _ in pares]
        v = funcao([x for x, _ in amostra], [y for _, y in amostra], categorias)
        if v is not None:
            valores.append(v)
    valores.sort()
    return quantil(valores, 0.025), quantil(valores, 0.975)


def leitura_kappa(k: float | None) -> str:
    if k is None:
        return "sem dados"
    if k < 0:
        return "pior do que o acaso"
    if k < 0.2:
        return "fraca"
    if k < 0.4:
        return "razoável"
    if k < 0.6:
        return "moderada"
    if k < 0.8:
        return "boa"
    return "muito boa"


# ---------------------------------------------------------------- gráfico de comportamento do processo (XmR)

def xmr(valores: list[float | None], n_base: int | None = None) -> dict | None:
    """Limites naturais do processo (Wheeler) e sinais de mudança.

    valores: série semanal (None = semana sem dados). n_base: quantos pontos (com dados) servem de base
    aos limites; os restantes são avaliados contra esses limites.
    """
    pontos = [(i, v) for i, v in enumerate(valores) if v is not None]
    if len(pontos) < 3:
        return None
    base = pontos if not n_base or n_base < 3 else pontos[:n_base]
    xs = [v for _, v in base]
    centro = sum(xs) / len(xs)
    mr = sum(abs(b - a) for a, b in zip(xs, xs[1:])) / (len(xs) - 1)
    sup, inf = centro + 2.66 * mr, centro - 2.66 * mr
    meio_sup, meio_inf = centro + 1.33 * mr, centro - 1.33 * mr
    sinais: dict[int, list[str]] = {}

    def marcar(i, regra):
        sinais.setdefault(i, [])
        if regra not in sinais[i]:
            sinais[i].append(regra)

    indices = [i for i, _ in pontos]
    vs = [v for _, v in pontos]
    for i, v in pontos:
        if v > sup or v < inf:
            marcar(i, "fora dos limites")
    for j in range(len(vs) - 3):
        janela = vs[j:j + 4]
        for lado, teste in (("acima", lambda x: x > meio_sup), ("abaixo", lambda x: x < meio_inf)):
            if sum(teste(x) for x in janela) >= 3:
                for t in range(4):
                    if teste(janela[t]):
                        marcar(indices[j + t], f"3 de 4 perto do limite ({lado})")
    for j in range(len(vs) - 7):
        janela = vs[j:j + 8]
        if all(x > centro for x in janela) or all(x < centro for x in janela):
            for t in range(8):
                marcar(indices[j + t], "8 seguidas do mesmo lado")
    return {"centro": centro, "mr": mr, "sup": sup, "inf": inf, "sup_mr": 3.268 * mr, "sinais": sinais,
            "n_base": len(base), "n": len(pontos)}
