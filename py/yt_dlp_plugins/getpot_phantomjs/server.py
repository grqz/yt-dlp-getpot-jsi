import time
import json
import socket
import threading
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from .utils import BG


class POTHTTPServer:
    _CHALLENGE_TTL = 30 * 60
    _INTERPRETER_CACHE = {}
    _CHALLENGE_CACHE = None
    _CHALLENGE_CACHE_EXPIRY = 0.0

    def __init__(self, Request, urlopen, log, port=0):
        bg = BG(Request, urlopen)

        class SimpleHandler(BaseHTTPRequestHandler):
            def _write_bytes(self, bytes_):
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(bytes_)

            def _write_error(self, err, status=500):
                self.send_response(status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': err,
                }).encode())

            def log_message(self, format, *args):
                log(f'[HTTP Server] {format % args}')

            def do_GET(self):
                parsed_url = urlparse(self.path)
                real_path = parsed_url.path.lower()
                if real_path == '/descrambled':
                    try:
                        if time.time() < POTHTTPServer._CHALLENGE_CACHE_EXPIRY:
                            return self._write_bytes(POTHTTPServer._CHALLENGE_CACHE)
                        log('Cache miss for descrambled challenge, fetching new challenge...')
                        POTHTTPServer._CHALLENGE_CACHE = descrambled = json.dumps(bg.fetch_challenge()).encode()
                        POTHTTPServer._CHALLENGE_CACHE_EXPIRY = time.time() + POTHTTPServer._CHALLENGE_TTL
                        return self._write_bytes(descrambled)
                    except Exception as e:
                        traceback.print_exc()
                        return self._write_error(str(e))
                elif real_path == '/dl_js':
                    try:
                        js_url = parse_qs(parsed_url.query).get('url', [None])[0]
                        if not js_url:
                            return self._write_error('Missing "url" query parameter', 400)
                        cached_ijsbytes = POTHTTPServer._INTERPRETER_CACHE.get(js_url)
                        if cached_ijsbytes is not None:
                            return self._write_bytes(cached_ijsbytes)
                        log(f'Cache miss for JS: {js_url}, downloading...')
                        POTHTTPServer._INTERPRETER_CACHE[js_url] = ijsbytes = urlopen(Request(js_url)).read()
                        return self._write_bytes(ijsbytes)
                    except Exception as e:
                        traceback.print_exc()
                        return self._write_error(str(e))
                else:
                    return self._write_error(f'Not found: Cannot GET {real_path}', 404)

            def do_POST(self):
                if self.path.lower() == '/genit':
                    content_length = int(self.headers.get('Content-Length', 0))
                    try:
                        bg_resp = json.loads(self.rfile.read(content_length).decode())
                    except Exception as e:
                        traceback.print_exc()
                        return self._write_error(str(e), 400)
                    try:
                        itd = json.dumps(bg.generate_integrity_token(bg_resp)).encode()
                        return self._write_bytes(itd)
                    except Exception as e:
                        traceback.print_exc()
                        return self._write_error(str(e))
                else:
                    return self._write_error(f'Not found: Cannot POST {self.path}', 404)

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
