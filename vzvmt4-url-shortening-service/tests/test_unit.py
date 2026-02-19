import pytest
from src.services import (
    encode_base62,
    decode_base62,
    generate_short_code,
    OFFSET,
    MAX_CODE_LENGTH,
)
from src.models import URLItem
from src.validation import validate_url_format

# REQ-06: Character set: [a-zA-Z0-9]
# REQ-07: Length: 5–8 characters
# REQ-08: Deterministic, no collisions


class TestBijectiveAlgorithm:
    def test_encode_decode_correctness(self):
        """Verify that encoding and decoding are reversible."""
        test_ids = [1, 100, 10000, 15000000, 999999999]
        for num in test_ids:
            code = encode_base62(num)
            decoded = decode_base62(code)
            assert decoded == num, f"Failed for ID {num}"

    def test_character_set(self):
        """Verify that only allowed characters are used."""
        valid_chars = set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        )
        code = encode_base62(123456789012345)
        for char in code:
            assert char in valid_chars, f"Invalid character '{char}' in code '{code}'"

    def test_length_constraint_min(self):
        """Verify minimum length of 5 characters."""
        code = generate_short_code(1)
        assert len(code) >= 5, f"Code '{code}' is too short (ID 1)"

    def test_length_constraint_max(self):
        """Verify max length of 8 characters."""
        large_id = (62**MAX_CODE_LENGTH) - 1 - OFFSET
        code = generate_short_code(large_id)
        assert len(code) <= 8, f"Code '{code}' is too long for ID {large_id}"

    def test_length_constraint_overflow(self):
        """Verify generate_short_code raises when code exceeds max length."""
        overflow_id = (62**MAX_CODE_LENGTH) - OFFSET
        with pytest.raises(ValueError):
            generate_short_code(overflow_id)

    def test_length_constraint_large_db_id(self):
        """Verify generate_short_code produces at most 8 chars for large DB IDs."""
        # Maximum DB ID that still fits in 8 base62 chars: 62**8 - 1 - OFFSET
        max_target = (62**8) - 1
        large_db_id = max_target - OFFSET
        code = generate_short_code(large_db_id)
        assert len(code) <= 8, f"Code '{code}' is too long for db_id {large_db_id}"
        assert len(code) >= 5, f"Code '{code}' should be at least 5 chars"

    def test_deterministic_generation_no_random(self):
        """REQ-08: Same db_id always yields same short code; different ids yield different codes."""
        code_1a = generate_short_code(1)
        code_1b = generate_short_code(1)
        assert code_1a == code_1b, "Same ID must produce identical code (deterministic)"
        code_2 = generate_short_code(2)
        assert code_1a != code_2, "Different IDs must produce different codes"
        seen = {generate_short_code(i) for i in range(1, 101)}
        assert (
            len(seen) == 100
        ), "No collisions: 100 distinct IDs must yield 100 distinct codes"


class TestURLValidation:

    def test_valid_http_url(self):
        url = "http://example.com"
        item = URLItem(target_url=url)
        assert validate_url_format(item.target_url) is None

    def test_valid_https_url_with_path(self):
        url = "https://example.com/path/to/resource?query=1"
        item = URLItem(target_url=url)
        assert validate_url_format(item.target_url) is None

    def test_invalid_scheme(self):
        item = URLItem(target_url="ftp://example.com")
        assert validate_url_format(item.target_url) is not None

    def test_invalid_format(self):
        item = URLItem(target_url="not_a_url")
        assert validate_url_format(item.target_url) is not None
