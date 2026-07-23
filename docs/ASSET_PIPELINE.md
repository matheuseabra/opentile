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
- **Remove corner background** removes corner-connected colors in-browser.
- The catalog stores the original file and its category in IndexedDB.
- Existing files without category metadata receive a filename-based fallback category.

The editor does not silently overwrite source assets; processed outputs are imported as new assets.
