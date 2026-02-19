import os
import sys
import pytest
import django
from django.conf import settings

# This allows us to run the same tests against different repository versions
REPO_PATH = os.environ.get('REPO_PATH', 'repository_after')
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TARGET_REPO = os.path.join(PROJECT_ROOT, REPO_PATH)

# Add the target repository to sys.path at the beginning
if TARGET_REPO not in sys.path:
    sys.path.insert(0, TARGET_REPO)

def pytest_configure():
    if not settings.configured:
        settings.configure(
            DEBUG=False,
            DATABASES={
                'default': {
                    'ENGINE': 'django.db.backends.sqlite3',
                    'NAME': ':memory:',
                }
            },
            INSTALLED_APPS=[
                'django.contrib.contenttypes',
                'django.contrib.auth',
                'rest_framework',
                'blog',
            ],
            MIDDLEWARE=[
                'django.middleware.common.CommonMiddleware',
            ],
            ROOT_URLCONF='tests.urls',
            SECRET_KEY='django-insecure-test-key',
            REST_FRAMEWORK={
                'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
                'PAGE_SIZE': 50,
            },
            TIME_ZONE='UTC',
            USE_TZ=True,
        )
        django.setup()

@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    pass
