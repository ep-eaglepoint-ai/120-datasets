from time import time

class RateLimiter:
    def __init__(self, requests_per_minute):
        self.rate = requests_per_minute
        self.tokens = requests_per_minute
        self.last_refill = time.time()
    
    def allow_request(self, user_id):
        # NOT thread-safe, single-server only; ignores user_id
        self._refill_tokens()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
    
    def _refill_tokens(self):
        now = time.time()
        time_passed = now - self.last_refill
        new_tokens = time_passed * (self.rate / 60)
        self.tokens = min(self.rate, self.tokens + new_tokens)
        self.last_refill = now




