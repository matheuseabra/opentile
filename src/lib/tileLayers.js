export const TILE_LAYERS = ["terrain", "decoration", "foreground"];

export const layersFor = (cell) => {
  if (!cell) return {};
  return cell.asset || cell.image ? { terrain: cell } : cell;
};

export const tilesFor = (cell) =>
  TILE_LAYERS.map((layer) => layersFor(cell)[layer]).filter(Boolean);

export const putTile = (cell, layer, tile) => ({
  ...layersFor(cell),
  [layer]: tile,
});

export const removeTile = (cell, layer) => {
  const layers = { ...layersFor(cell) };
  delete layers[layer];
  return Object.keys(layers).length ? layers : null;
};
