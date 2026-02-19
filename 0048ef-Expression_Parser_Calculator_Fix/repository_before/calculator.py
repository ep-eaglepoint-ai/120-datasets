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
            
            return self._calculate(expr)
        except Exception as e:
            return f"Error: {str(e)}"
    
    def _calculate(self, expr: str) -> float:
        """Parse and evaluate expression"""
        tokens = self._tokenize(expr)
        
        if not tokens:
            raise ValueError("Invalid expression")
        
        if len(tokens) == 1:
            return float(tokens[0])
        
        result = float(tokens[0])
        i = 1
        while i < len(tokens):
            if i >= len(tokens):
                break
            operator = tokens[i]
            if i + 1 >= len(tokens):
                raise ValueError("Invalid expression")
            operand = float(tokens[i + 1])
            result = self._apply_operator(result, operator, operand)
            i += 2
        
        return result
    
    def _tokenize(self, expr: str) -> list:
        """Split expression into number and operator tokens"""
        tokens = []
        current_number = ""
        
        for char in expr:
            if char.isdigit() or char == '.':
                current_number += char
            elif char in self.operators:
                if current_number:
                    tokens.append(current_number)
                    current_number = ""
                tokens.append(char)
            elif char in '()':
                if current_number:
                    tokens.append(current_number)
                    current_number = ""
            else:
                raise ValueError(f"Invalid character: {char}")
        
        if current_number:
            tokens.append(current_number)
        
        return tokens
    
    def _apply_operator(self, a: float, op: str, b: float) -> float:
        """Apply an operator to two operands"""
        if op == '+':
            return a + b
        elif op == '-':
            return a - b
        elif op == '*':
            return a * b
        elif op == '/':
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
