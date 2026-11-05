import pytest

from funil.caracteristicas import classificar_decisao, extrair
from funil.config import carregar
from funil.texto import (chave_curta, chave_nome, contem_sem_negacao, extrair_telefones, numero, preparado, refs_orc,
                         sem_citacao, telefone_norm)

CFG = carregar()


@pytest.mark.parametrize("entrada,esperado", [
    ("912 345 678", "+351912345678"), ("+351 912345678", "+351912345678"), ("00351912345678", "+351912345678"),
    ("21 999 0000", "+351219990000"), ("219-990-000", "+351219990000"), ("(+351) 96 123 45 67", "+351961234567"),
    ("+44 20 7946 0958", "+442079460958"), ("12345", None), ("800 200 300", None), ("", None),
])
def test_telefone_norm(entrada, esperado):
    assert telefone_norm(entrada) == esperado


def test_extrair_telefones_no_texto():
    t = "Liguem para o 912 345 678 ou para o fixo 21 999 0000. NIF 512345678 e código 1234567890123."
    assert extrair_telefones(t) == {"+351912345678", "+351219990000"}


def test_chave_nome():
    assert chave_nome("Eng. José  Gonçalves") == "jose goncalves"
    assert chave_nome("Ana") is None
    assert chave_nome("Consumidor Final") is None
    assert chave_nome("Silva & Filhos, Lda.") == "silva filhos"
    assert chave_curta("jose manuel goncalves") == "jose goncalves"


def test_refs_orc():
    assert refs_orc("Re: Orçamento ORC0034_2026 Anne Hammick") == {"ORC0034_2026"}
    assert refs_orc("orc 34/2026 e ORC-0070-2026") == {"ORC0034_2026", "ORC0070_2026"}
    assert refs_orc("ORC00342026.pdf") == {"ORC0034_2026"}
    assert refs_orc("sem referência") == set()


def test_sem_citacao_gmail_e_outlook():
    gmail = "Aceito o orçamento.\n\nEm sex., 16/10/2026 às 10:00, MDM <\nmdmassistencia@gmail.com> escreveu:\n> Segue o orçamento"
    assert sem_citacao(gmail) == "Aceito o orçamento."
    gmail2 = "Ok.\nEm 16/10/2026 às 10:00, MDM Climatização <x@y.pt> escreveu:\n> texto"
    assert sem_citacao(gmail2) == "Ok."
    outlook = "Bom dia, avancem.\n\nDe: MDM\nEnviado: sexta-feira\nPara: Ana\nAssunto: Orçamento"
    assert sem_citacao(outlook) == "Bom dia, avancem."
    assert sem_citacao("> só citação") == ""


@pytest.mark.parametrize("entrada,esperado", [
    ("2.345,67 €", 2345.67), ("2345.67", 2345.67), ("1,5", 1.5), ("12.500", 12500.0), ("1,234.50", 1234.5),
    ("-3,20", -3.2), ("", None), ("abc", None), (17, 17.0),
])
def test_numero(entrada, esperado):
    assert numero(entrada) == esperado


def test_negacao():
    t = preparado("Não vamos avançar, obrigado")
    assert not contem_sem_negacao(t, ["vamos avancar"])
    assert contem_sem_negacao(preparado("Ok, vamos avançar"), ["vamos avancar"])


@pytest.mark.parametrize("texto,esperado", [
    ("Bom dia, aceito o orçamento. Quando podem vir?", ("aceite", "")),
    ("Obrigado, mas já adjudicámos a outra empresa.", ("recusa", "foi com outra empresa")),
    ("Ficou um pouco caro para nós.", ("recusa", "preço")),
    ("Por agora vamos desistir.", ("recusa", "desistiu ou adiou")),
    ("Não vamos avançar.", ("recusa", "desistiu ou adiou")),
    ("Aceito, mas está um pouco caro.", ("ambiguo", "preço")),
    ("Caro Sr. Bernardo, aceito a proposta.", ("aceite", "")),
    ("Recebi, obrigado.", None),
    # Frases que não são decisões (falsos positivos encontrados na revisão).
    ("Quando podem enviar o orçamento?", None),
    ("Já pedi outro orçamento para comparar.", None),
    ("Optámos por outra empresa, obrigado.", ("recusa", "foi com outra empresa")),
    ("Não podemos avançar agora.", ("recusa", "desistiu ou adiou")),
    ("Não aceito, ficou caro.", ("recusa", "preço")),
    ("Está caro, mas aceito.", ("ambiguo", "preço")),
    ("O preço está um pouco alto.", ("recusa", "preço")),
    ("Aceito. Quando podem vir instalar?", ("aceite", "")),
])
def test_classificar_decisao(texto, esperado):
    assert classificar_decisao(texto, CFG) == esperado


def test_caracteristicas():
    c = extrair("O ar condicionado da loja deixou de funcionar, é urgente!", "gmail.com", "email", CFG)
    assert c["tipo"] == "avaria" and c["empresa"] and c["urgente"]
    c = extrair("Queria orçamento para instalar 3 aparelhos de ar condicionado até dia 20", "sapo.pt", "email", CFG)
    assert c["tipo"] == "instalacao" and not c["empresa"] and c["unidades"] == 3 and c["data_marcada"]
    c = extrair("Olá", "empresa-exemplo.pt", "email", CFG)
    assert c["tipo"] == "desconhecido" and c["empresa"]
