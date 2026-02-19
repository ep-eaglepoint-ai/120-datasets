def pytest_addoption(parser):
    parser.addoption("--target", action="store", default="after", help="Target version: before or after")

import pytest

@pytest.fixture(scope="session")
def target(request):
    return request.config.getoption("--target")
