#!/usr/bin/env python3
"""Local bridge for the bundled Pixel Art Fixer and remove.bg."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import json
import os
import subprocess
import tempfile
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).parent
FIXER = ROOT / "vendor/pixel-art-fixer/rust/target/release/pixelfixer"


def remove_bg_api_key():
    if "REMOVE_BG_API_KEY" in os.environ:
        return os.environ["REMOVE_BG_API_KEY"]
    env_file = ROOT / ".env"
    if not env_file.exists():
        return ""
    for line in env_file.read_text().splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "REMOVE_BG_API_KEY":
            return value.strip().strip('"\'')
    return ""


def remove_background(image_data):
    api_key = remove_bg_api_key()
    if not api_key:
        raise RuntimeError("Set REMOVE_BG_API_KEY in .env and restart ./run.sh.")
    boundary = f"----pixel-pipeline-{uuid.uuid4().hex}"
    body = b"\r\n".join([
        f"--{boundary}".encode(), b'Content-Disposition: form-data; name="size"', b"", b"auto",
        f"--{boundary}".encode(), b'Content-Disposition: form-data; name="image_file"; filename="input.png"',
        b"Content-Type: application/octet-stream", b"", image_data, f"--{boundary}--".encode(), b"",
    ])
    request = urllib.request.Request(
        "https://api.remove.bg/v1.0/removebg", data=body,
        headers={"X-Api-Key": api_key, "Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read(), response.headers.get_content_type()


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


class App(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urlparse(path).path
        if path == "/":
            path = "/app/index.html"
        return str(ROOT / path.lstrip("/"))

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
            except urllib.error.HTTPError as error:
                self.send_error(error.code, f"remove.bg could not remove this background (HTTP {error.code}).")
                return
            except (urllib.error.URLError, TimeoutError):
                self.send_error(502, "Could not reach remove.bg.")
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
