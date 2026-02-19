from flask import Flask
from .webhook import webhook_blueprint

app = Flask(__name__)
app.register_blueprint(webhook_blueprint)
