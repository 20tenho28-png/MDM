"""Datas, dias úteis e horas úteis em Portugal (hora de Lisboa)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

LX = ZoneInfo("Europe/Lisbon")

# Feriados nacionais fixos (MM-DD). Os móveis (Sexta-feira Santa, Páscoa, Corpo de Deus) são calculados.
_FIXOS = ("01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25")


def pascoa(ano: int) -> date:
    """Domingo de Páscoa (algoritmo gregoriano anónimo)."""
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes, dia = divmod(h + l - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)


def local(dt: datetime) -> datetime:
    """Converte para a hora de Lisboa. Datas sem fuso horário são tratadas como hora de Lisboa."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=LX)
    return dt.astimezone(LX)


def fim_do_dia(d: date) -> datetime:
    return datetime.combine(d, time(23, 59, 59), tzinfo=LX)


def segunda(dt: datetime | date) -> date:
    """Segunda-feira da semana (ISO) a que pertence a data."""
    d = local(dt).date() if isinstance(dt, datetime) else dt
    return d - timedelta(days=d.weekday())


def dias_entre(a: datetime, b: datetime) -> float:
    return (local(b) - local(a)).total_seconds() / 86400


class Calendario:
    def __init__(self, hora_inicio: int = 9, hora_fim: int = 18, feriados_extra=(), carnaval: bool = False):
        if not 0 <= hora_inicio < hora_fim <= 24:
            raise ValueError("horário inválido")
        self.ini = time(int(hora_inicio))
        self.fim = time(23, 59, 59, 999999) if hora_fim == 24 else time(int(hora_fim))
        self.horas_dia = float(hora_fim - hora_inicio)
        self.extra = tuple(feriados_extra)
        self.carnaval = bool(carnaval)
        self._cache: dict[int, set[date]] = {}

    @classmethod
    def de_config(cls, cfg: dict) -> "Calendario":
        c = cfg["calendario"]
        return cls(c["hora_inicio"], c["hora_fim"], c.get("feriados_extra", []), c.get("carnaval", False))

    def feriados(self, ano: int) -> set[date]:
        if ano not in self._cache:
            p = pascoa(ano)
            dias = {date(ano, int(md[:2]), int(md[3:5])) for md in _FIXOS + self.extra}
            dias |= {p - timedelta(days=2), p, p + timedelta(days=60)}
            if self.carnaval:
                dias.add(p - timedelta(days=47))
            self._cache[ano] = dias
        return self._cache[ano]

    def e_util(self, d: date) -> bool:
        return d.weekday() < 5 and d not in self.feriados(d.year)

    def _janela(self, d: date) -> tuple[datetime, datetime]:
        return datetime.combine(d, self.ini, tzinfo=LX), datetime.combine(d, self.fim, tzinfo=LX)

    def horas_uteis(self, a: datetime, b: datetime) -> float:
        """Horas dentro do horário de trabalho entre a e b (0 se b não for depois de a)."""
        a, b = local(a), local(b)
        if b <= a:
            return 0.0
        total = 0.0
        d, ultimo = a.date(), b.date()
        while d <= ultimo:
            if self.e_util(d):
                ji, jf = self._janela(d)
                inicio, fim = max(ji, a), min(jf, b)
                if fim > inicio:
                    total += (fim - inicio).total_seconds()
            d += timedelta(days=1)
        return total / 3600

    def dias_uteis(self, a: datetime, b: datetime) -> float:
        return self.horas_uteis(a, b) / self.horas_dia

    def somar_horas_uteis(self, a: datetime, horas: float) -> datetime:
        """Momento em que se completam `horas` horas úteis a partir de a."""
        cur = local(a)
        resta = max(0.0, horas) * 3600
        d = cur.date()
        for _ in range(10000):
            if self.e_util(d):
                ji, jf = self._janela(d)
                inicio = max(ji, cur)
                if inicio < jf:
                    disponivel = (jf - inicio).total_seconds()
                    if resta <= disponivel:
                        return inicio + timedelta(seconds=resta)
                    resta -= disponivel
            d += timedelta(days=1)
            cur = datetime.combine(d, time(0), tzinfo=LX)
        raise ValueError("intervalo demasiado longo")

    def somar_dias_uteis(self, d: date, n: int) -> date:
        contados = 0
        while contados < n:
            d += timedelta(days=1)
            if self.e_util(d):
                contados += 1
        return d


_FORMATOS = (
    "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
    "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%d-%m-%Y",
    "%d.%m.%Y %H:%M", "%d.%m.%Y",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
    "%Y/%m/%d %H:%M:%S", "%Y/%m/%d",
    "%d/%m/%y %H:%M:%S", "%d/%m/%y %H:%M", "%d/%m/%y",
)


def ler_data(valor, hora_padrao: time | None = None) -> datetime | None:
    """Lê datas em formatos comuns em Portugal e ISO. Devolve hora de Lisboa ou None."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        # Células de data do Excel chegam à meia-noite: usa a mesma hora por defeito que as datas em texto.
        if hora_padrao and valor.tzinfo is None and valor.time() == time(0):
            valor = datetime.combine(valor.date(), hora_padrao)
        return local(valor)
    if isinstance(valor, date):
        return datetime.combine(valor, hora_padrao or time(12), tzinfo=LX)
    texto = str(valor).strip()
    if not texto:
        return None
    so_data = len(texto) == 10 and texto[4] == "-"
    try:
        dt = datetime.fromisoformat(texto.replace("Z", "+00:00"))
        if so_data and hora_padrao:
            dt = datetime.combine(dt.date(), hora_padrao)
        return local(dt)
    except ValueError:
        pass
    for formato in _FORMATOS:
        try:
            dt = datetime.strptime(texto, formato)
        except ValueError:
            continue
        if "%H" not in formato and hora_padrao:
            dt = datetime.combine(dt.date(), hora_padrao)
        return dt.replace(tzinfo=LX)
    return None
