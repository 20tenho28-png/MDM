import random
from datetime import date, datetime, time, timedelta

import pytest

from funil.datas import LX, Calendario, ler_data, pascoa, segunda


def lx(*args):
    return datetime(*args, tzinfo=LX)


@pytest.mark.parametrize("ano,esperado", [(2024, date(2024, 3, 31)), (2025, date(2025, 4, 20)),
                                          (2026, date(2026, 4, 5)), (2027, date(2027, 3, 28))])
def test_pascoa(ano, esperado):
    assert pascoa(ano) == esperado


def test_feriados_moveis_2026():
    f = Calendario().feriados(2026)
    assert date(2026, 4, 3) in f        # Sexta-feira Santa
    assert date(2026, 6, 4) in f        # Corpo de Deus
    assert date(2026, 10, 5) in f       # Implantação da República
    assert date(2026, 6, 13) not in f   # Santo António só se for pedido
    assert date(2026, 6, 13) in Calendario(feriados_extra=["06-13"]).feriados(2026)


def test_horas_uteis_casos():
    cal = Calendario()
    assert cal.horas_uteis(lx(2026, 10, 14, 10), lx(2026, 10, 14, 12, 30)) == pytest.approx(2.5)
    # sexta 16h -> segunda 10h = 2 + 1
    assert cal.horas_uteis(lx(2026, 10, 16, 16), lx(2026, 10, 19, 10)) == pytest.approx(3)
    # sábado -> segunda 9h = 0
    assert cal.horas_uteis(lx(2026, 10, 17, 11), lx(2026, 10, 19, 9)) == 0
    # sexta 2/10 17h -> terça 6/10 10h, com o feriado de 5/10 = 1 + 1
    assert cal.horas_uteis(lx(2026, 10, 2, 17), lx(2026, 10, 6, 10)) == pytest.approx(2)
    # fora de horas no mesmo dia
    assert cal.horas_uteis(lx(2026, 10, 14, 19), lx(2026, 10, 14, 23)) == 0
    assert cal.horas_uteis(lx(2026, 10, 14, 12), lx(2026, 10, 14, 11)) == 0


def test_somar_e_medir_sao_inversos():
    cal = Calendario(feriados_extra=["06-13"])
    rng = random.Random(1)
    for _ in range(300):
        a = lx(2026, 1, 1) + timedelta(minutes=rng.randint(0, 60 * 24 * 330))
        h = rng.uniform(0, 120)
        b = cal.somar_horas_uteis(a, h)
        assert b >= a
        assert cal.horas_uteis(a, b) == pytest.approx(h, abs=1e-6)


def test_horas_uteis_atravessa_mudanca_de_hora():
    cal = Calendario()
    # 2026-03-29 muda a hora (domingo). Sexta 17h -> segunda 10h = 2 horas úteis.
    assert cal.horas_uteis(lx(2026, 3, 27, 17), lx(2026, 3, 30, 10)) == pytest.approx(2)


def test_ler_data_formatos():
    assert ler_data("16/10/2026 14:23") == lx(2026, 10, 16, 14, 23)
    assert ler_data("2026-10-16", hora_padrao=time(18)) == lx(2026, 10, 16, 18)
    assert ler_data("16-10-2026") == lx(2026, 10, 16)
    assert ler_data("2026-10-16T13:23:00+00:00") == lx(2026, 10, 16, 14, 23)
    assert ler_data("") is None and ler_data("ontem") is None


def test_segunda():
    assert segunda(lx(2026, 10, 18, 22)) == date(2026, 10, 12)
    assert segunda(date(2026, 10, 12)) == date(2026, 10, 12)
