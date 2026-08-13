# Asset pipeline

The intended flow is:

```text
image generation → pixel-grid fixing → background removal → categorization → tileset selection → level authoring
```

## Asset requirements

- PNG is preferred.
- Use a fixed native frame/tile size.
- Keep hard pixel edges, limited colors, and no text or gradients.
- For sprite sheets, keep frames aligned to the same grid.

## Processing tools

- **Fix pixel grid** sends the selected source file to the local pixel-art fixer.
- Asset uploads are sent to the local Python bridge, which uses `rembg` to
  remove the background and imports the transparent PNG result. If processing
  fails, the original file is imported instead. `./run.sh` creates a virtual
  environment and installs the direct dependency version recorded in
  `requirements.txt`; no
  API key is required.
- **Remove background** repeats that local processing for the most recently
  uploaded source image.
- The catalog stores the processed file and its category in IndexedDB.
- Existing files without category metadata receive a filename-based fallback category.

The automatic upload flow imports the processed PNG under the source filename. Use the fallback original only when the API cannot process it.
