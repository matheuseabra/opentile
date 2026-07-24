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
- Asset uploads automatically send each source image to remove.bg through the local Python bridge, then import the transparent PNG result. If remove.bg is unavailable or rejects an asset, the original file is imported instead. Set `REMOVE_BG_API_KEY` in `.env`; the browser never receives the key.
- **Remove background** repeats that processing for the most recently uploaded source image.
- The catalog stores the processed file and its category in IndexedDB.
- Existing files without category metadata receive a filename-based fallback category.

The automatic upload flow imports the processed PNG under the source filename. Use the fallback original only when the API cannot process it.
