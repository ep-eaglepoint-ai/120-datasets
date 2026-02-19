import json

class GlobalRequest:
    def __init__(self):
        self.data_json = None
        self.headers = {}
    def get_json(self):
        return self.data_json

request = GlobalRequest()

class Response:
    def __init__(self, data_str, status_code=200):
        self.data = data_str.encode('utf-8')
        self.status_code = status_code

def jsonify(data):
    return Response(json.dumps(data))

class Blueprint:
    def __init__(self, name, import_name):
        self.routes = {}
    def route(self, rule, methods=None):
        def decorator(f):
            self.routes[rule] = f
            return f
        return decorator

class Flask:
    def __init__(self, name):
        self.routes = {}
        self.testing = False
    def register_blueprint(self, bp):
        self.routes.update(bp.routes)
    def test_client(self):
        return TestClient(self)

class TestClient:
    def __init__(self, app):
        self.app = app
    def post(self, path, data=None, content_type=None, headers=None):
        request.data_json = json.loads(data) if data else None
        request.headers = headers or {}
        
        handler = self.app.routes.get(path)
        if not handler:
            return Response("Not Found", 404)
        
        try:
            result = handler()
            # Handle (Response, status) tuple
            if isinstance(result, tuple):
                resp, status = result
                resp.status_code = status
                return resp
            return result
        except Exception as e:
            # Minimal error handling to mimic Flask's 500 on unhandled exception
            # Note: The controller catches most exceptions, so this hits only 
            # if controller misses something or compilation error.
             return Response(json.dumps({'error': str(e)}), 500)
