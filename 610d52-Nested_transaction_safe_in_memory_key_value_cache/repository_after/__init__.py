class TxCache:
    _DELETED = object()

    def __init__(self):
        self.store = {}
        self.tx_stack = []

    def begin(self):
        self.tx_stack.append({})

    def set(self, k, v):
        if self.tx_stack:
            self.tx_stack[-1][k] = v
        else:
            self.store[k] = v

    def get(self, k):
        for tx in reversed(self.tx_stack):
            if k in tx:
                return None if tx[k] is self._DELETED else tx[k]
        return self.store.get(k)

    def delete(self, k):
        if self.tx_stack:
            self.tx_stack[-1][k] = self._DELETED
        else:
            self.store.pop(k, None)

    def commit(self):
        if not self.tx_stack:
            return False

        top = self.tx_stack.pop()

        if self.tx_stack:
            parent = self.tx_stack[-1]
            for k, v in top.items():
                parent[k] = v
        else:
            for k, v in top.items():
                if v is self._DELETED:
                    self.store.pop(k, None)
                else:
                    self.store[k] = v

        return True

    def rollback(self):
        if not self.tx_stack:
            return False
        self.tx_stack.pop()
        return True
