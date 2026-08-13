#!/usr/bin/env python3
"""Local bridge for the bundled Pixel Art Fixer and rembg."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import importlib
import json
import os
import subprocess
import tempfile

ROOT = Path(__file__).parent
FIXER = ROOT / "vendor/pixel-art-fixer/rust/target/release/pixelfixer"
rembg_session = None


def remove_background(image_data):
    global rembg_session
    try:
        rembg = importlib.import_module("rembg")
    except ImportError as error:
        raise RuntimeError(
            "rembg is unavailable. Run ./run.sh to install it."
        ) from error
    if rembg_session is None:
        rembg_session = rembg.new_session()
    return rembg.remove(
        image_data, session=rembg_session, force_return_bytes=True
    ), "image/png"


def uploaded_image(content_type, content_length, stream):
    try:
        length = int(content_length)
    except (TypeError, ValueError):
        raise ValueError("Expected an image up to 8MB") from None
    boundary = next(
        (
            part.split("=", 1)[1].strip().strip('"')
            for part in content_type.split(";")[1:]
            if part.strip().lower().startswith("boundary=")
        ),
        "",
    ).encode()
    if not boundary or length <= 0 or length > 8_000_000:
        raise ValueError("Expected an image up to 8MB")
    body = stream.read(length)
    if len(body) != length:
        raise ValueError("Incomplete image upload")
    for part in body.split(b"--" + boundary):
        headers, separator, data = part.partition(b"\r\n\r\n")
        if separator and b'name="image"' in headers:
            # The multipart delimiter contributes one trailing CRLF. Remove
            # exactly that delimiter so image bytes that end in CRLF survive.
            return data[:-2] if data.endswith(b"\r\n") else data
    raise ValueError("Expected an image field")


class App(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_error(404)

    def do_POST(self):
        if self.path not in ("/api/fix", "/api/remove-background", "/api/assets"):
            self.send_error(404)
            return
        try:
            image_data = uploaded_image(
                self.headers.get("Content-Type", ""),
                self.headers.get("Content-Length"),
                self.rfile,
            )
        except ValueError as error:
            self.send_error(400, str(error))
            return
        if self.path in ("/api/remove-background", "/api/assets"):
            try:
                data, content_type = remove_background(image_data)
            except RuntimeError as error:
                self.send_error(503, str(error))
                return
            except Exception as error:
                self.send_error(422, f"Could not remove this background: {error}")
                return
            self.send_response(200)
            self.send_header("Content-Type", content_type or "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if not FIXER.exists():
            self.send_error(503, "Run ./run.sh once to build Pixel Art Fixer.")
            return
        with tempfile.TemporaryDirectory() as tmp:
            source, output = Path(tmp) / "input.png", Path(tmp) / "fixed.png"
            source.write_bytes(image_data)
            result = subprocess.run(
                [str(FIXER), "process", str(source), str(output)],
                text=True,
                capture_output=True,
                timeout=30,
            )
            if result.returncode or not output.exists():
                self.send_error(
                    422,
                    result.stderr[-500:] or "Pixel fixer could not process this image",
                )
                return
            try:
                meta = json.loads(result.stdout.strip().splitlines()[-1])
            except (IndexError, json.JSONDecodeError):
                self.send_error(422, "Pixel fixer returned invalid metadata")
                return
            data = output.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("X-Pixel-Fixer", json.dumps(meta))
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    requested_port = os.environ.get("PORT")
    try:
        port = int(requested_port or "8000")
    except ValueError:
        raise SystemExit("PORT must be an integer") from None
    while True:
        try:
            httpd = ThreadingHTTPServer(("127.0.0.1", port), App)
            break
        except OSError:
            if requested_port:
                raise
            if port >= 8010:
                raise
            port += 1
    port_file = os.environ.get("PORT_FILE")
    if port_file:
        Path(port_file).write_text(str(port))
    print(f"Pixel pipeline: http://localhost:{port}", flush=True)
    httpd.serve_forever()
