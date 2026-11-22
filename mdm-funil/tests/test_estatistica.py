import math
import random

import pytest

from funil.estatistica import (inversa, kappa, kappa_ponderado, logistica_por_segmento, mediana, quantil,
                               resolver_sistema, sigmoide, wilson, xmr)


def test_wilson_valores_conhecidos():
    lo, hi = wilson(5, 10)
    assert lo == pytest.approx(0.2366, abs=1e-3) and hi == pytest.approx(0.7634, abs=1e-3)
    lo, hi = wilson(0, 10)
    assert lo == 0 and hi == pytest.approx(0.2775, abs=1e-3)
    assert wilson(0, 0) is None


def test_quantis():
    assert mediana([3, 1, 2]) == 2
    assert quantil([1, 2, 3, 4], 0.5) == 2.5
    assert quantil([], 0.5) is None


def test_kappa_exemplo_a_mao():
    a = ["P1", "P1", "P2", "P2", "P3", "P3"]
    b = ["P1", "P2", "P2", "P2", "P3", "P1"]
    # acordo observado 4/6; esperado (2*2 + 2*3 + 2*1)/36 = 1/3; kappa = (2/3 - 1/3)/(2/3) = 0,5
    assert kappa(a, b) == pytest.approx(0.5)
    assert kappa(a, a) == 1.0
    assert kappa(["P1"] * 5, ["P1"] * 5) == 1.0


def test_kappa_ponderado_penaliza_menos_os_vizinhos():
    a = ["P1", "P2", "P3"] * 10
    vizinho = ["P2", "P2", "P3"] * 10
    longe = ["P3", "P2", "P3"] * 10
    assert kappa_ponderado(a, vizinho) > kappa_ponderado(a, longe)


def test_xmr_limites_e_sinais():
    r = xmr([10, 12, 11, 13, 12])
    assert r["centro"] == pytest.approx(11.6)
    assert r["mr"] == pytest.approx(1.5)
    assert r["sup"] == pytest.approx(11.6 + 2.66 * 1.5)
    assert not r["sinais"]
    serie = [10, 11, 10, 12, 11, 10, 11, 12, 30]
    r = xmr(serie, n_base=8)
    assert "fora dos limites" in r["sinais"][8]
    r = xmr([10, 11, 10, 11, 10, 11, 10, 11] + [14] * 8, n_base=8)
    assert any("8 seguidas" in s for v in r["sinais"].values() for s in v)
    assert xmr([None, 1, None]) is None


def test_resolver_e_inversa():
    a = [[4.0, 1.0, 0.0], [1.0, 3.0, 1.0], [0.0, 1.0, 2.0]]
    x = resolver_sistema(a, [1.0, 2.0, 3.0])
    assert [sum(a[i][j] * x[j] for j in range(3)) for i in range(3)] == pytest.approx([1, 2, 3])
    inv = inversa(a)
    ident = [[sum(a[i][k] * inv[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    assert ident == [pytest.approx([1, 0, 0], abs=1e-9), pytest.approx([0, 1, 0], abs=1e-9), pytest.approx([0, 0, 1], abs=1e-9)]


def test_logistica_recupera_parametros_conhecidos():
    rng = random.Random(5)
    verdade = {0: (0.5, -0.9), 1: (-1.0, -0.2)}
    obs = []
    for _ in range(6000):
        s = rng.randint(0, 1)
        x = rng.uniform(0, 4)
        a, b = verdade[s]
        obs.append((s, x, int(rng.random() < sigmoide(a + b * x))))
    th, cov = logistica_por_segmento(obs, 2, 0.0, desvio_nivel=10, desvio_inclinacao=10)
    assert th[0] == pytest.approx(0.5, abs=0.15) and th[1] == pytest.approx(-1.0, abs=0.15)
    assert th[2] + th[3] == pytest.approx(-0.9, abs=0.12) and th[2] + th[4] == pytest.approx(-0.2, abs=0.12)
    assert all(cov[i][i] > 0 for i in range(5))


def test_logistica_puxa_segmentos_pequenos_para_a_media():
    rng = random.Random(9)
    obs = [(0, rng.uniform(0, 3), int(rng.random() < 0.4)) for _ in range(400)]
    obs += [(1, 0.1, 1), (1, 0.2, 1), (1, 0.3, 1)]  # segmento minúsculo com 3 ganhos seguidos
    th, _ = logistica_por_segmento(obs, 2, math.log(0.4 / 0.6))
    assert sigmoide(th[1] + (th[2] + th[4]) * 0.2) < 0.85
