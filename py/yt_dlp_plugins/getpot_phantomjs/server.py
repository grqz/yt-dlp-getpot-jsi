import json
import socket
import threading
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from .utils import BG


class POTHTTPServer:
    _INTERPRETER_CACHE = {}

    def __init__(self, Request, urlopen, log, port=0):
        bg = BG(Request, urlopen)

        class SimpleHandler(BaseHTTPRequestHandler):
            def log_message(self, format, *args):
                log(f'[HTTP Server] {format % args}')

            def do_GET(self):
                parsed_url = urlparse(self.path)
                real_path = parsed_url.path.lower()
                if real_path == '/descrambled':
                    try:
                        descrambled = json.dumps(bg.fetch_challenge()).encode()
                    except Exception as e:
                        traceback.print_exc()
                        self.send_response(500)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'error': str(e),
                        }).encode())
                        return
                    else:
                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(descrambled)
                elif real_path == '/dl_js':
                    try:
                        js_url = parse_qs(parsed_url.query).get('url', [None])[0]
                        if not js_url:
                            raise ValueError('Missing "url" query parameter')
                        cached_ijsbytes = POTHTTPServer._INTERPRETER_CACHE.get(js_url)
                        if cached_ijsbytes is not None:
                            self.send_response(200)
                            self.send_header('Access-Control-Allow-Origin', '*')
                            self.end_headers()
                            self.wfile.write(cached_ijsbytes)
                            return
                        log(f'Cache miss for JS: {js_url}, downloading...')
                        POTHTTPServer._INTERPRETER_CACHE[js_url] = ijsbytes = urlopen(Request(js_url)).read()
                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(ijsbytes)
                    except Exception as e:
                        traceback.print_exc()
                        self.send_response(500)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'error': str(e),
                        }).encode())
                        return
                else:
                    self.send_response(404)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': 'Not found',
                    }).encode())

            def do_POST(self):
                if self.path.lower() == '/genit':
                    content_length = int(self.headers.get('Content-Length', 0))
                    try:
                        bg_resp = json.loads(self.rfile.read(content_length).decode())
                    except Exception as e:
                        self.send_response(400)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'error': str(e),
                        }).encode())
                        return
                    try:
                        itd = json.dumps(bg.generate_integrity_token(bg_resp)).encode()
                    except Exception as e:
                        traceback.print_exc()
                        self.send_response(500)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            'error': str(e),
                        }).encode())
                        return
                    else:
                        self.send_response(200)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        self.wfile.write(itd)
                else:
                    self.send_response(404)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        'error': f'Cannot POST {self.path}',
                    }).encode())
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', port))
        free_port = sock.getsockname()[1]
        sock.listen(5)

        server = HTTPServer(('127.0.0.1', free_port), SimpleHandler, False)
        server.socket = sock
        server.server_close = lambda: sock.close()
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        self.port = free_port
        self._thread = thread
        self._server = server

    def terminate(self):
        self._server.shutdown()
        self._server.server_close()
        self._thread.join()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.terminate()
