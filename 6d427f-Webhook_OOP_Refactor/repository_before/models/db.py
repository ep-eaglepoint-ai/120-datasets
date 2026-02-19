from contextlib import contextmanager

class Transaction:
    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

@contextmanager
def get_session():
    # Dummy session for demonstration and testing purposes
    class Session:
        def add(self, instance):
            pass
        def commit(self):
            pass
    yield Session()

def init_db():
    pass
