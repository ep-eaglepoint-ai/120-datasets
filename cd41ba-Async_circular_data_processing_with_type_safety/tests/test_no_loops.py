import ast
import inspect
import pytest
from circular_data_processor import DataProcessor, main_loop

def test_no_explicit_loops():
    """
    Avoid all for and while loops; use map(), filter(), or list comprehensions.
    """
    # Get source code of the class and the main function
    try:
        class_source = inspect.getsource(DataProcessor)
        main_source = inspect.getsource(main_loop)
    except OSError:
        pytest.fail("Could not retrieve source code to check for loops.")

    # Combine sources or check individually
    full_source = class_source + "\n" + main_source
    
    tree = ast.parse(full_source)
    
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.AsyncFor, ast.While)):
            # ast.For, ast.AsyncFor, and ast.While correspond to explicit loop statements.
            
            # Verify strict compliance by failing on any found loop node.
            
            # Failure message
            pytest.fail(f"Found forbidden loop at line {node.lineno}: {type(node).__name__}")
