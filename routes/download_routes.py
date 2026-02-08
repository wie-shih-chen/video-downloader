from flask import Blueprint, render_template, request, jsonify
from services.download_service import DownloadManager

download_bp = Blueprint('download', __name__)
manager = DownloadManager()

@download_bp.route('/')
def index():
    return render_template('downloader/index.html')

@download_bp.route('/api/validate', methods=['POST'])
def validate():
    url = request.json.get('url')
    is_valid = manager.validate_url(url)
    return jsonify({'valid': is_valid})

@download_bp.route('/api/info', methods=['POST'])
def get_info():
    url = request.json.get('url')
    info = manager.get_video_info(url)
    if info:
        return jsonify(info)
    return jsonify({'error': 'Could not get video info'}), 400

@download_bp.route('/api/download', methods=['POST'])
def start_download():
    data = request.json
    url = data.get('url')
    options = data.get('options', {})
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
        
    download_id = manager.start_download(url, options)
    return jsonify({'id': download_id, 'status': 'started'})

@download_bp.route('/api/status/<download_id>')
def get_status(download_id):
    status = manager.get_status(download_id)
    if status:
        return jsonify(status)
    return jsonify({'error': 'Download not found'}), 404

@download_bp.route('/api/tasks')
def get_all_tasks():
    return jsonify(manager.get_all_downloads())

@download_bp.route('/api/files')
def list_files():
    return jsonify(manager.list_local_files())

@download_bp.route('/api/files/<filename>', methods=['DELETE'])
def delete_file(filename):
    if manager.delete_file(filename):
        return jsonify({'success': True})
    return jsonify({'error': 'File not found'}), 404

@download_bp.route('/api/files/download/<filename>')
def download_file_to_browser(filename):
    from flask import send_from_directory
    from config import Config
    import os
    
    directory = Config.DOWNLOAD_PATH
    # Ensure file exists
    if os.path.exists(os.path.join(directory, filename)):
        return send_from_directory(directory, filename, as_attachment=True)
    return "File not found", 404

@download_bp.route('/api/open_folder', methods=['POST'])
def open_folder():
    if manager.open_folder():
        return jsonify({'success': True})
    return jsonify({'error': 'Failed to open folder'}), 500

@download_bp.route('/api/cleanup', methods=['POST'])
def cleanup():
    manager.clear_completed()
    return jsonify({'success': True})

@download_bp.route('/api/stream')
def stream_download():
    """
    Stream download directly to client using yt-dlp piped output.
    """
    from flask import Response, stream_with_context
    import subprocess
    import shlex
    import os
    
    url = request.args.get('url')
    format_type = request.args.get('format', 'best')
    
    if not url:
        return "No URL provided", 400
        
    cmd = ['yt-dlp', '--newline', '--force-ipv4', '-o', '-']
    
    if os.environ.get('http_proxy'):
        cmd.extend(['--proxy', os.environ.get('http_proxy')])

    # Add Cookies logic for Stream
    from config import Config
    cookie_file = os.path.join(Config.BASE_DIR, 'cookies.txt')
    if os.path.exists(cookie_file):
        cmd.extend(['--cookies', cookie_file])
    
    
    # Client Spoofing (Smart TV) - often has lower security thresholds
    cmd.extend(['--extractor-args', 'youtube:player_client=tv'])

    if format_type == 'mp3':
        cmd.extend(['-x', '--audio-format', 'mp3'])
        mimetype = 'audio/mpeg'
        ext = 'mp3'
    elif format_type == 'mp4_1080p':
        cmd.extend(['-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]', '--merge-output-format', 'mp4'])
        mimetype = 'video/mp4'
        ext = 'mp4'
    else: 
        cmd.extend(['-f', 'best'])
        mimetype = 'video/mp4'
        ext = 'mp4'
        
    try:
        title_proc = subprocess.run(['yt-dlp', '--get-title', url], capture_output=True, text=True)
        filename = f"{title_proc.stdout.strip()}.{ext}" if title_proc.returncode == 0 else f"video.{ext}"
        filename = "".join([c for c in filename if c.isalpha() or c.isdigit() or c in ' .-_']).strip()
    except:
        filename = f"video.{ext}"

    cmd.append(url)
    
    def generate():
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        while True:
            chunk = process.stdout.read(4096)
            if not chunk:
                break
            yield chunk
        process.stdout.close()
        process.wait()

    response = Response(stream_with_context(generate()), mimetype=mimetype)
    
    # Fix UnicodeEncodeError by using RFC 6266 compliant header
    from urllib.parse import quote
    try:
        filename.encode('latin-1')
        # If it fits in latin-1 (e.g. English), use it directly
        response.headers.set('Content-Disposition', 'attachment', filename=filename)
    except UnicodeEncodeError:
        # If it contains non-latin-1 chars (e.g. Chinese), use filename*
        # Fallback ASCII name
        safe_filename = 'video.' + ext
        # URL encoded utf-8 name
        encoded_filename = quote(filename)
        response.headers.set('Content-Disposition', f'attachment; filename="{safe_filename}"; filename*=UTF-8\'\'{encoded_filename}')
    
    return response
