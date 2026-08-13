import sys
import unittest
from http.client import HTTPConnection
from io import BytesIO
from threading import Thread
from types import SimpleNamespace
from unittest import mock

from server import App, ThreadingHTTPServer, uploaded_image


class UploadParsingTests(unittest.TestCase):
    def upload(self, image, boundary="pixel-boundary"):
        body = b"\r\n".join(
            (
                f"--{boundary}".encode(),
                b'Content-Disposition: form-data; name="image"; filename="sprite.png"',
                b"Content-Type: image/png",
                b"",
                image,
                f"--{boundary}--".encode(),
                b"",
            )
        )
        return uploaded_image(
            f'multipart/form-data; charset=utf-8; boundary="{boundary}"',
            str(len(body)),
            BytesIO(body),
        )

    def test_preserves_image_bytes_ending_in_newlines(self):
        image = b"pixel-data\r\n"
        self.assertEqual(self.upload(image), image)

    def test_rejects_invalid_or_incomplete_uploads(self):
        with self.assertRaises(ValueError):
            uploaded_image("multipart/form-data", "nope", BytesIO())
        with self.assertRaises(ValueError):
            uploaded_image("multipart/form-data; boundary=x", "5", BytesIO(b"x"))
        with self.assertRaises(ValueError):
            uploaded_image(
                "multipart/form-data; boundary=x",
                "9",
                BytesIO(b"--x--\r\n"),
            )


class LocalBridgeTests(unittest.TestCase):
    def test_does_not_serve_repository_files(self):
        httpd = ThreadingHTTPServer(("127.0.0.1", 0), App)
        thread = Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            connection = HTTPConnection("127.0.0.1", httpd.server_port)
            connection.request("GET", "/.env")
            response = connection.getresponse()
            self.assertEqual(response.status, 404)
            response.read()
            connection.close()
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join()


class BackgroundRemovalTests(unittest.TestCase):
    def test_reuses_the_rembg_session(self):
        sessions = []
        fake_rembg = SimpleNamespace(
            new_session=lambda: sessions.append(object()) or sessions[-1],
            remove=lambda data, **kwargs: b"png",
        )
        import server

        server.rembg_session = None
        with mock.patch.dict(sys.modules, {"rembg": fake_rembg}):
            self.assertEqual(server.remove_background(b"a"), (b"png", "image/png"))
            self.assertEqual(server.remove_background(b"b"), (b"png", "image/png"))
        self.assertEqual(len(sessions), 1)
        server.rembg_session = None


if __name__ == "__main__":
    unittest.main()
