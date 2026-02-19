import re
from typing import Any, Type, List, Optional, Union
from repository_after.error_handling_lib.errors.specific_errors import ValidationError

class InputValidator:
    """
    A utility class for validating input values.
    Raises ValidationError if validation fails.
    """

    @staticmethod
    def not_none(value: Any, name: str) -> None:
        if value is None:
            raise ValidationError(f"{name} cannot be None.", details={"name": name, "value": value})

    @staticmethod
    def type_check(value: Any, expected_type: Type, name: str) -> None:
        if not isinstance(value, expected_type):
            raise ValidationError(
                f"{name} must be of type {expected_type.__name__}.",
                details={"name": name, "value": value, "expected_type": expected_type.__name__}
            )

    @staticmethod
    def not_empty(value: Any, name: str) -> None:
        if not value:
            raise ValidationError(f"{name} cannot be empty.", details={"name": name, "value": value})

    @staticmethod
    def positive(value: Union[int, float], name: str) -> None:
        if value <= 0:
            raise ValidationError(f"{name} must be positive.", details={"name": name, "value": value})

    @staticmethod
    def range(value: Union[int, float], min_val: Union[int, float], max_val: Union[int, float], name: str) -> None:
        if not (min_val <= value <= max_val):
            raise ValidationError(
                f"{name} must be between {min_val} and {max_val}.",
                details={"name": name, "value": value, "min": min_val, "max": max_val}
            )

    @staticmethod
    def length(value: Any, min_len: int, max_len: Optional[int], name: str) -> None:
        length = len(value)
        if length < min_len:
            raise ValidationError(
                f"{name} must have at least {min_len} characters.",
                details={"name": name, "value": value, "min_length": min_len, "length": length}
            )
        if max_len is not None and length > max_len:
            raise ValidationError(
                f"{name} must have at most {max_len} characters.",
                details={"name": name, "value": value, "max_length": max_len, "length": length}
            )

    @staticmethod
    def in_choices(value: Any, choices: List[Any], name: str) -> None:
        if value not in choices:
            raise ValidationError(
                f"{name} must be one of {choices}.",
                details={"name": name, "value": value, "choices": choices}
            )

    @staticmethod
    def email(value: str, name: str) -> None:
        # Simple regex for email validation
        email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        if not re.match(email_regex, value):
            raise ValidationError(
                f"{name} must be a valid email address.",
                details={"name": name, "value": value}
            )

    @staticmethod
    def url(value: str, name: str) -> None:
        # Simple regex for URL validation
        url_regex = r"^(http|https)://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$"
        if not re.match(url_regex, value):
            raise ValidationError(
                f"{name} must be a valid URL.",
                details={"name": name, "value": value}
            )

    @staticmethod
    def phone(value: str, name: str) -> None:
        # Simple regex for phone validation (digits, spaces, dashes, plus)
        phone_regex = r"^\+?[0-9\s-]+$"
        if not re.match(phone_regex, value) or len(re.sub(r"\D", "", value)) < 7:
             raise ValidationError(
                f"{name} must be a valid phone number.",
                details={"name": name, "value": value}
            )

    @staticmethod
    def alphanumeric(value: str, name: str) -> None:
        if not value.isalnum():
            raise ValidationError(
                f"{name} must be alphanumeric.",
                details={"name": name, "value": value}
            )
