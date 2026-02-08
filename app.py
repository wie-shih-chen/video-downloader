from flask import Flask, redirect, url_for
from config import Config
from routes.download_routes import download_bp
import os

app = Flask(__name__)
# minimal config
app.config.from_object(Config)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-key')

# Register Blueprint
app.register_blueprint(download_bp, url_prefix='/download')

@app.route('/')
def index():
    return redirect(url_for('download.index'))

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
