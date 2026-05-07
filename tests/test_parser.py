from mdm.imap.parser import normalize_subject, parse_rfc822
from tests.conftest import load_fixture


def test_normalize_subject_strips_re_and_fwd():
    assert normalize_subject("Re: Re: Fwd: hi") == "hi"
    assert normalize_subject("hello") == "hello"
    assert normalize_subject("RE:  spaced") == "spaced"


def test_parse_extracts_threading_headers():
    parsed = parse_rfc822(load_fixture("inbound_followup.eml"))
    assert parsed.message_id == "thread-1-msg-3@customer.example"
    assert parsed.in_reply_to == "thread-1-msg-2@company.com"
    assert parsed.references == [
        "thread-1-msg-1@customer.example",
        "thread-1-msg-2@company.com",
    ]
    assert parsed.from_addr == "alice@customer.example"
    assert parsed.from_name == "Alice Customer"
    assert "alice@customer.example" not in parsed.to_addrs
    assert "sales@company.com" in parsed.to_addrs


def test_parse_initial_has_no_in_reply_to():
    parsed = parse_rfc822(load_fixture("inbound_initial.eml"))
    assert parsed.in_reply_to is None
    assert parsed.references == []
    assert parsed.subject == "Question about pricing"
