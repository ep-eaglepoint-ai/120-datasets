"""
Expression Parser Calculator

A simple calculator that evaluates mathematical expressions.
Supports basic arithmetic operations: +, -, *, /, ^
"""


class Calculator:
    """Simple expression parser calculator"""
    
    def __init__(self):
        self.operators = {'+', '-', '*', '/', '^'}
    
    def evaluate(self, expression: str) -> float | str:
        """
        Evaluate a mathematical expression string.
        Returns the result or an error message string.
        """
        try:
            expr = expression.replace(" ", "")
            if not expr:
                return "Error: Empty expression"
            result = self._calculate(expr)
            return result
        except ZeroDivisionError:
            return "Error: Division by zero"
        except ValueError as ve:
            return "Error: Invalid expression"
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _calculate(self, expr: str) -> float:
        """Parse and evaluate expression using recursive descent parser (PEMDAS)."""
        tokens = self._tokenize(expr)
        if not tokens:
            raise ValueError("Invalid expression")
        self._tokens = tokens
        self._pos = 0
        result = self._parse_expression()
        if self._pos != len(self._tokens):
            raise ValueError("Invalid expression")
        return result

    def _parse_expression(self):
        # Handles + and -
        result = self._parse_term()
        while self._pos < len(self._tokens) and self._tokens[self._pos] in ('+', '-'):
            op = self._tokens[self._pos]
            self._pos += 1
            right = self._parse_term()
            result = self._apply_operator(result, op, right)
        return result

    def _parse_term(self):
        # Handles * and /
        result = self._parse_factor()
        while self._pos < len(self._tokens) and self._tokens[self._pos] in ('*', '/'):
            op = self._tokens[self._pos]
            self._pos += 1
            right = self._parse_factor()
            result = self._apply_operator(result, op, right)
        return result

    def _parse_factor(self):
        # Handles ^ (right-associative)
        result = self._parse_unary()
        while self._pos < len(self._tokens) and self._tokens[self._pos] == '^':
            op = self._tokens[self._pos]
            self._pos += 1
            right = self._parse_factor()  # right-associative
            result = self._apply_operator(result, op, right)
        return result

    def _parse_unary(self):
        # Handles unary minus (already handled in tokenization, but keep for completeness)
        if self._pos < len(self._tokens):
            token = self._tokens[self._pos]
            if token == '+':
                self._pos += 1
                return self._parse_unary()
            elif token == '-':
                self._pos += 1
                return -self._parse_unary()
        return self._parse_primary()

    def _parse_primary(self):
        if self._pos >= len(self._tokens):
            raise ValueError("Invalid expression")
        token = self._tokens[self._pos]
        if token == '(':  # Parentheses
            self._pos += 1
            result = self._parse_expression()
            if self._pos >= len(self._tokens) or self._tokens[self._pos] != ')':
                raise ValueError("Invalid expression")
            self._pos += 1
            return result
        else:
            # Should be a number
            try:
                value = float(token)
            except Exception:
                raise ValueError("Invalid expression")
            self._pos += 1
            return value
    
    def _tokenize(self, expr: str) -> list:
        """Tokenize the expression into numbers, operators, and parentheses, handling unary minus and decimals. Rejects invalid operator sequences."""
        tokens = []
        i = 0
        n = len(expr)
        last_token_type = None  # 'num', 'op', 'paren_open', 'paren_close'
        while i < n:
            char = expr[i]
            if char.isspace():
                i += 1
                continue
            if char in '+*/^':
                if last_token_type in (None, 'op', 'paren_open'):
                    # e.g., "+2", "(*3", "2 ++ 3"
                    raise ValueError("Invalid expression")
                tokens.append(char)
                last_token_type = 'op'
                i += 1
            elif char == '-':
                if (i == 0 or expr[i-1] in '()+-*/^'):
                    # Parse negative number
                    j = i + 1
                    num = '-'
                    dot_count = 0
                    while j < n and (expr[j].isdigit() or expr[j] == '.'):
                        if expr[j] == '.':
                            dot_count += 1
                            if dot_count > 1:
                                raise ValueError("Invalid number format")
                        num += expr[j]
                        j += 1
                    if len(num) == 1:  # Just '-'
                        raise ValueError("Invalid expression")
                    tokens.append(num)
                    last_token_type = 'num'
                    i = j
                else:
                    if last_token_type in (None, 'op', 'paren_open'):
                        # e.g., "2 + - * 3"
                        raise ValueError("Invalid expression")
                    tokens.append('-')
                    last_token_type = 'op'
                    i += 1
            elif char.isdigit() or char == '.':
                j = i
                dot_count = 0
                while j < n and (expr[j].isdigit() or expr[j] == '.'):
                    if expr[j] == '.':
                        dot_count += 1
                        if dot_count > 1:
                            raise ValueError("Invalid number format")
                    j += 1
                if last_token_type == 'num':
                    # e.g., "2 3"
                    raise ValueError("Invalid expression")
                tokens.append(expr[i:j])
                last_token_type = 'num'
                i = j
            elif char == '(':
                if last_token_type == 'num' or last_token_type == 'paren_close':
                    # e.g., "2(3+4)", ")(" (implicit multiplication not supported)
                    raise ValueError("Invalid expression")
                tokens.append('(')
                last_token_type = 'paren_open'
                i += 1
            elif char == ')':
                if last_token_type in ('op', 'paren_open', None):
                    # e.g., "+)", "()"
                    raise ValueError("Invalid expression")
                tokens.append(')')
                last_token_type = 'paren_close'
                i += 1
            else:
                raise ValueError(f"Invalid character: {char}")
        return tokens
    
    def _apply_operator(self, a: float, op: str, b: float) -> float | str:
        """Apply an operator to two operands, handling division by zero."""
        if op == '+':
            return a + b
        elif op == '-':
            return a - b
        elif op == '*':
            return a * b
        elif op == '/':
            if b == 0:
                raise ZeroDivisionError("Division by zero")
            return a / b
        elif op == '^':
            return a ** b
        else:
            raise ValueError(f"Unknown operator: {op}")


def evaluate(expression: str) -> float | str:
    """Convenience function to evaluate an expression"""
    calculator = Calculator()
    return calculator.evaluate(expression)


if __name__ == "__main__":
    print(f"2 + 3 * 4 = {evaluate('2 + 3 * 4')}")
    print(f"(2 + 3) * 4 = {evaluate('(2 + 3) * 4')}")
    print(f"-5 + 3 = {evaluate('-5 + 3')}")
    print(f"10 / 0 = {evaluate('10 / 0')}")
