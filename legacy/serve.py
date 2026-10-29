#!/usr/bin/env python3
"""
Dev server.

The project is plain ES modules with no build step, so it has to be served over
HTTP rather than opened from the file system. The only thing this adds over
`python3 -m http.server` is aggressive cache defeat: browsers cache ES module
graphs hard, and a stale module silently running old code is very difficult to
tell apart from a bug in new code.

    python3 serve.py            # http://localhost:8181
    python3 serve.py 3000
"""

import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8181


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Only report failures; a successful asset fetch is not news.
        if args and str(args[1]).startswith(("4", "5")):
            super().log_message(fmt, *args)


socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"current build — http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
