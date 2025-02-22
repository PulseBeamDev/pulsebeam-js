from http.server import SimpleHTTPRequestHandler
from socketserver import TCPServer
import signal
import sys

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET')
        super().end_headers()

# Allow immediate port reuse
class MyTCPServer(TCPServer):
    allow_reuse_address = True

def shutdown_server(signum, frame):
    print("\nShutting down server...")
    server.server_close()
    sys.exit(0)

if __name__ == '__main__':
    server = MyTCPServer(('', 8000), CORSRequestHandler)
    
    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, shutdown_server)
    
    print("Serving at http://localhost:8000")
    print("Press Ctrl+C to stop\n")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()