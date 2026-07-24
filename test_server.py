from io import BytesIO
import unittest

from server import uploaded_image


class UploadParsingTests(unittest.TestCase):
    def upload(self, image, boundary="pixel-boundary"):
        body = b"\r\n".join((
            f"--{boundary}".encode(),
            b'Content-Disposition: form-data; name="image"; filename="sprite.png"',
            b"Content-Type: image/png",
            b"",
            image,
            f"--{boundary}--".encode(),
            b"",
        ))
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


if __name__ == "__main__":
    unittest.main()
