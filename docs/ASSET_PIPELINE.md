# Asset pipeline

The editor keeps the asset flow local to the browser:

```text
image file → direct browser import → IndexedDB asset catalog → tileset selection → level authoring
```

## Asset requirements

- PNG is preferred.
- Use a fixed native frame/tile size.
- Keep hard pixel edges, limited colors, and no text or gradients.
- For sprite sheets, keep frames aligned to the same grid.

## Import behavior

- Choose one or more image files in the editor.
- Files are imported directly without a server or image-processing dependency.
- The selected category is stored with each asset.
- Asset data and object URLs are managed by the browser asset library.
- The catalog stores the original file in IndexedDB.
- Existing files without category metadata receive a filename-based fallback category.

For pixel-grid cleanup or background removal, prepare the image before importing
it. OpenTile focuses on tileset selection, level authoring, and game-ready
exports.
