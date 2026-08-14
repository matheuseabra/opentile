import {
	DEFAULT_LAYERS,
	layersFor,
	layersForDocument,
	putTile,
} from "./tileLayers";

export const serializeSketch = (
	placed: Map<string, any>,
	collisions: Set<string>,
	layers?: any[],
) => ({
	tiles: [...placed].flatMap(([cellKey, cell]) => {
		const [x, y] = cellKey.split(",").map(Number);
		return (Object.entries(layersFor(cell)) as [string, any][])
			.filter(
				([layer]) =>
					!layers || layers.some((item) => item.id === layer && item.visible),
			)
			.map(([layer, tile]) => ({
				x,
				y,
				layer,
				asset:
					typeof tile.asset === "string"
						? tile.asset
						: tile.asset?.name || tile.name,
				sx: tile.sx ?? 0,
				sy: tile.sy ?? 0,
				attributes: tile.attributes || {},
				autotile: tile.autotile,
			}));
	}),
	collisions: [...collisions],
});

export const normalizeLevel = (doc: any) => {
	const layers = layersForDocument(doc);
	const legacyDefaults =
		layers.map(({ id }) => id).join(",") === "terrain,decoration,foreground";
	const hasExtraPaint = (doc.tiles || []).some(
		(tile) => tile.layer !== "terrain",
	);
	return {
		...doc,
		metadata: {
			...doc.metadata,
			height: Math.max(1, Number(doc.metadata?.height) || 18),
		},
		layers: legacyDefaults && !hasExtraPaint ? DEFAULT_LAYERS : layers,
	};
};

export const clearLevelContent = (doc: any) => ({
	...doc,
	platforms: [],
	props: [],
	pickups: [],
	enemies: [],
	exits: [],
	tiles: [],
	collisions: [],
});

export const hydrateSketch = (doc: any, assets: any[]) => {
	const byName = new Map(assets.map((asset) => [asset.name, asset]));
	const placed = new Map<string, any>();
	for (const tile of doc.tiles || []) {
		const asset = byName.get(tile.asset);
		if (!asset) continue;
		const cellKey = `${tile.x},${tile.y}`;
		placed.set(
			cellKey,
			putTile(placed.get(cellKey), tile.layer, {
				asset,
				sx: tile.sx ?? 0,
				sy: tile.sy ?? 0,
				attributes: tile.attributes || {},
				autotile: tile.autotile,
			}),
		);
	}
	return { placed, collisions: new Set<string>(doc.collisions || []) };
};
