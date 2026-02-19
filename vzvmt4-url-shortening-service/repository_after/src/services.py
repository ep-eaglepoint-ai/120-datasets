CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
BASE = len(CHARS)

MIN_CODE_LENGTH = 5
MAX_CODE_LENGTH = 8
OFFSET = 62 ** (MIN_CODE_LENGTH - 1)

def encode_base62(num: int) -> str:
    if num == 0:
        return CHARS[0]

    encoded = []
    while num > 0:
        num, rem = divmod(num, BASE)
        encoded.append(CHARS[rem])

    return "".join(reversed(encoded))

def decode_base62(token: str) -> int:
    decoded = 0
    for char in token:
        decoded = decoded * BASE + CHARS.index(char)
    return decoded

def generate_short_code(db_id: int) -> str:
    if db_id < 0:
        raise ValueError("db_id must be non-negative")

    target_id = db_id + OFFSET
    code = encode_base62(target_id)
    if len(code) < MIN_CODE_LENGTH:
        code = CHARS[0] * (MIN_CODE_LENGTH - len(code)) + code
    if len(code) > MAX_CODE_LENGTH:
        raise ValueError("Short code length exceeded maximum")
    return code
