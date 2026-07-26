export const DEFAULT_LAYERS = [
  { id: "terrain", name: "Layer 1", visible: true, locked: false, collision: false, type: "tile" },
];

export const layersForDocument = (doc) =>
  doc?.layers?.length ? doc.layers : DEFAULT_LAYERS;

export const layersFor = (cell) => {
  if (!cell) return {};
  return cell.asset || cell.image ? { terrain: cell } : cell;
};

export const tilesFor = (cell, layers = DEFAULT_LAYERS) =>
  layers.map(({ id }) => layersFor(cell)[id]).filter(Boolean);

export const putTile = (cell, layer, tile) => ({
  ...layersFor(cell),
  [layer]: tile,
});

export const removeTile = (cell, layer) => {
  const layers = { ...layersFor(cell) };
  delete layers[layer];
  return Object.keys(layers).length ? layers : null;
};
