import http.server
import socketserver
import webbrowser
import sys

PORT = 8080
Handler = http.server.SimpleHTTPRequestHandler

class SilentServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Silence standard requests logs to keep terminal clean
        pass

print(f"\n=======================================================")
print(f"   Enterprise FL-IDS Cyber Command Dashboard Server")
print(f"=======================================================")
print(f"[*] Serving locally at http://localhost:{PORT}")
print(f"[*] Opening browser tab automatically...")
print(f"[*] Press CTRL+C to terminate the server.\n")

webbrowser.open(f"http://localhost:{PORT}")

socketserver.TCPServer.allow_reuse_address = True
try:
    with socketserver.TCPServer(("", PORT), SilentServer) as httpd:
        httpd.serve_forever()
except KeyboardInterrupt:
    print("\n[-] Server terminated by user request. Exiting.")
    sys.exit(0)
except Exception as e:
    print(f"\n[!] Failed to start server: {e}")
    sys.exit(1)
