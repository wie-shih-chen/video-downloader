import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    
    # Add project bin to PATH (for ffmpeg on Render)
    BIN_DIR = os.path.join(BASE_DIR, 'bin')
    if os.path.exists(BIN_DIR):
        os.environ['PATH'] = BIN_DIR + os.pathsep + os.environ['PATH']
    
    # Download Path
    DOWNLOAD_PATH = os.path.join(BASE_DIR, 'downloads')
    if not os.path.exists(DOWNLOAD_PATH):
        os.makedirs(DOWNLOAD_PATH, exist_ok=True)
