import pytest
import importlib.util
import os

@pytest.fixture(scope="session")
def evaluate():
    path = os.path.join(os.path.dirname(__file__), "..", "repository_before", "calculator.py")
    spec = importlib.util.spec_from_file_location("calculator", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.evaluate


@pytest.mark.parametrize("expr,expected", [
    ("2 + 3 * 4", 14),
    ("10 - 2 * 3", 4),
    ("8 / 4 * 2", 4),
])
def test_pemdas(evaluate, expr, expected):
    assert evaluate(expr) == expected

@pytest.mark.parametrize("expr,expected", [
    ("(2 + 3) * 4", 20),
    ("((2 + 3) * 2) + 1", 11),
    ("10 / (5 - 3)", 5),
])
def test_parentheses(evaluate, expr, expected):
    assert evaluate(expr) == expected

@pytest.mark.parametrize("expr,expected", [
    ("2 ^ 3", 8),
    ("2 ^ 3 ^ 2", 512),
])
def test_exponents(evaluate, expr, expected):
    assert evaluate(expr) == expected

@pytest.mark.parametrize("expr,expected", [
    ("-5 + 3", -2),
    ("5 * -3", -15),
    ("(-5) * (-3)", 15),
])
def test_negative_numbers(evaluate, expr, expected):
    assert evaluate(expr) == expected

@pytest.mark.parametrize("expr,expected", [
    ("3.14 * 2", 6.28),
    ("10 / 4", 2.5),
])
def test_decimals(evaluate, expr, expected):
    result = evaluate(expr)
    assert abs(result - expected) < 1e-9

def test_whitespace(evaluate):
    assert evaluate(" 2 + 3 * 4 ") == 14

def test_division_by_zero(evaluate):
    assert evaluate("10 / 0") == "Error: Division by zero"

@pytest.mark.parametrize("expr", ["2 + + 3", "abc"])
def test_invalid_input(evaluate, expr):
    result = evaluate(expr)
    assert isinstance(result, str) and result.startswith("Error")

def test_empty_input(evaluate):
    assert evaluate("") == "Error: Empty expression"
