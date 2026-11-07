"""Unit: access-code alphabet and generator invariants. No database."""
import inspect

from app.features.rooms.service import ACCESS_CODE_ALPHABET, ACCESS_CODE_LENGTH, generate_access_code


def test_code_is_six_alphabet_characters():
    for _ in range(500):
        code = generate_access_code()
        assert len(code) == ACCESS_CODE_LENGTH == 6
        assert all(ch in ACCESS_CODE_ALPHABET for ch in code)


def test_alphabet_has_32_symbols_without_ambiguous_glyphs():
    assert len(ACCESS_CODE_ALPHABET) == 32
    for ch in "IO01":
        assert ch not in ACCESS_CODE_ALPHABET
    assert ACCESS_CODE_ALPHABET == ACCESS_CODE_ALPHABET.upper()
    assert len(set(ACCESS_CODE_ALPHABET)) == len(ACCESS_CODE_ALPHABET)


def test_generator_uses_secrets():
    src = inspect.getsource(generate_access_code)
    assert "secrets.choice" in src
    assert "random.choice" not in src


def test_code_has_no_separator():
    for _ in range(500):
        code = generate_access_code()
        assert "-" not in code
        assert "_" not in code
        assert not any(ch.isspace() for ch in code)
