#!/usr/bin/env python3
"""Small local bridge for the bundled Pixel Art Fixer binary."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import subprocess
import tempfile

ROOT = Path(__file__).parent
FIXER = ROOT / "vendor/pixel-art-fixer/rust/target/release/pixelfixer"


class App(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urlparse(path).path
        if path == "/":
            path = "/app/index.html"
        return str(ROOT / path.lstrip("/"))

    def do_POST(self):
        if self.path != "/api/fix":
            self.send_error(404)
            return
        if not FIXER.exists():
            self.send_error(503, "Run ./run.sh once to build Pixel Art Fixer.")
            return
        content_type = self.headers.get("Content-Type", "")
        boundary = content_type.partition("boundary=")[2].strip().strip('"').encode()
        length = int(self.headers.get("Content-Length", 0))
        if not boundary or length <= 0 or length > 8_000_000:
            self.send_error(400, "Expected an image up to 8MB")
            return
        image_data = None
        for part in self.rfile.read(length).split(b"--" + boundary):
            headers, separator, data = part.partition(b"\r\n\r\n")
            if separator and b'name="image"' in headers:
                image_data = data.rstrip(b"\r\n")
                break
        if not image_data:
            self.send_error(400, "Expected an image field")
            return
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "input.png", Path(tmp) / "fixed.png"
            source.write_bytes(image_data)
            result = subprocess.run(
                [str(FIXER), "process", str(source), str(output)],
                text=True, capture_output=True, timeout=30,
            )
            if result.returncode or not output.exists():
                self.send_error(422, result.stderr[-500:] or "Pixel fixer could not process this image")
                return
            meta = json.loads(result.stdout.strip().splitlines()[-1])
            data = output.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("X-Pixel-Fixer", json.dumps(meta))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    requested_port = os.environ.get("PORT")
    port = int(requested_port or "8000")
    while True:
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), App)
            break
        except OSError:
            if requested_port or port >= 8010:
                raise
            port += 1
    port_file = os.environ.get("PORT_FILE")
    if port_file:
        Path(port_file).write_text(str(port))
    print(f"Pixel pipeline: http://localhost:{port}", flush=True)
    httpd.serve_forever()
