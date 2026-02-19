import ast
import os
import pytest

REPO_PATH = os.environ.get('REPO_PATH', 'repository_after')
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TARGET_FILE = os.path.join(PROJECT_ROOT, REPO_PATH, 'blog', 'views.py')

def get_ast():
    with open(TARGET_FILE, 'r') as f:
        return ast.parse(f.read())

class CodeAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.uses_select_related = False
        self.uses_prefetch_related = False
        self.uses_annotate = False
        self.uses_count = False
        self.forbidden_python_iteration = False # Checking for manual loops over querysets in get_queryset

    def visit_Call(self, node):
        name = None
        if isinstance(node.func, ast.Attribute):
            name = node.func.attr
        elif isinstance(node.func, ast.Name):
            name = node.func.id
            
        if name == 'select_related':
            self.uses_select_related = True
        elif name == 'prefetch_related':
            self.uses_prefetch_related = True
        elif name == 'annotate':
            self.uses_annotate = True
        elif name == 'Count':
            self.uses_count = True
        self.generic_visit(node)

@pytest.mark.skipif(REPO_PATH == 'repository_before', reason="Structural checks only for optimized version")
def test_requirement_07_structural_aggregation():
    """
    REQ-07: Must maintain database-level aggregations for counts.
    Verifies that 'annotate' and 'Count' are used in the source code.
    """
    analyzer = CodeAnalyzer()
    analyzer.visit(get_ast())
    assert analyzer.uses_annotate, "Source code must use .annotate() for efficiency"
    assert analyzer.uses_count, "Source code must use Count() aggregation"

@pytest.mark.skipif(REPO_PATH == 'repository_before', reason="Structural checks only for optimized version")
def test_requirement_05_structural_eager_loading():
    """
    REQ-05: Must correctly use select_related() and prefetch_related().
    """
    analyzer = CodeAnalyzer()
    analyzer.visit(get_ast())
    assert analyzer.uses_select_related, "Source code must use .select_related()"
    assert analyzer.uses_prefetch_related, "Source code must use .prefetch_related()"

def test_no_forbidden_methods():
    """
    CONSTRAINTS: Cannot use raw SQL, .extra(), or custom managers.
    """
    tree = get_ast()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            assert node.func.attr not in ['raw', 'extra'], f"Forbidden method {node.func.attr} used"
