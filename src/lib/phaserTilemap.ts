import { DEFAULT_LAYERS, layersFor, tilesFor } from "./tileLayers";

export const createPhaserTilemap = ({
	placed,
	collisions,
	levelWidth,
	levelHeight,
	layers,
	tileSize,
}) => {
	layers = layers || DEFAULT_LAYERS;
	const used = [];
	const seen = new Set();
	for (const cell of placed.values())
		for (const tile of tilesFor(
			cell,
			layers.filter((layer) => layer.visible),
		)) {
			const asset = tile.asset || tile;
			if (!seen.has(asset)) {
				seen.add(asset);
				used.push(asset);
			}
		}
	const assetIndex = new Map(used.map((asset, index) => [asset, index]));
	let nextGid = 1;
	const tilesets = used.map((asset) => {
		const columns = Math.max(
			1,
			Math.floor((asset.image?.width || tileSize) / tileSize),
		);
		const rows = Math.max(
			1,
			Math.floor((asset.image?.height || tileSize) / tileSize),
		);
		const tileset = {
			firstgid: nextGid,
			columns,
			image: `art/${asset.name}`,
			imageheight: rows * tileSize,
			imagewidth: columns * tileSize,
			name: asset.name,
			tilecount: columns * rows,
			tileheight: tileSize,
			tilewidth: tileSize,
		};
		nextGid += tileset.tilecount;
		return tileset;
	});
	const dataFor = (layer) => {
		const data = Array(levelWidth * levelHeight).fill(0);
		for (const [cellKey, cell] of placed) {
			const [x, y] = cellKey.split(",").map(Number);
			if (x < 0 || y < 0 || x >= levelWidth || y >= levelHeight) continue;
			const tile = layersFor(cell)[layer];
			if (!tile) continue;
			const asset = tile.asset || tile;
			const set = tilesets[assetIndex.get(asset)];
			const columns = set.columns;
			const localId =
				Math.floor((tile.sx ?? 0) / tileSize) +
				Math.floor((tile.sy ?? 0) / tileSize) * columns;
			data[y * levelWidth + x] = set.firstgid + localId;
		}
		return data;
	};
	const attributeObjects = [];
	for (const [cellKey, cell] of placed) {
		const [x, y] = cellKey.split(",").map(Number);
		for (const layer of layers.filter((item) => item.visible)) {
			const tile = layersFor(cell)[layer.id];
			if (!tile?.attributes || !Object.keys(tile.attributes).length) continue;
			attributeObjects.push({
				id: attributeObjects.length + 1,
				name: layer.name,
				type: "tile_attributes",
				x: x * tileSize,
				y: y * tileSize,
				width: tileSize,
				height: tileSize,
				properties: Object.entries(tile.attributes)
					.filter(([, value]) => value !== undefined)
					.map(([name, value]) => ({ name, type: typeof value, value })),
			});
		}
	}
	return {
		version: "1.10",
		tiledversion: "1.10.2",
		orientation: "orthogonal",
		renderorder: "right-down",
		infinite: false,
		width: levelWidth,
		height: levelHeight,
		tilewidth: tileSize,
		tileheight: tileSize,
		layers: [
			...layers
				.filter((layer) => layer.visible)
				.map((layer, id) => ({
					id: id + 1,
					name: layer.name,
					type: "tilelayer",
					x: 0,
					y: 0,
					width: levelWidth,
					height: levelHeight,
					opacity: 1,
					visible: true,
					properties: [
						{ name: "collision", type: "bool", value: !!layer.collision },
						...Object.entries(layer.properties || {}).map(([name, value]) => ({
							name,
							type: typeof value,
							value,
						})),
					],
					data: dataFor(layer.id),
				})),
			{
				id: layers.length + 1,
				name: "collisions",
				type: "objectgroup",
				draworder: "topdown",
				objects: [...collisions].map((cellKey, index) => {
					const [x, y] = cellKey.split(",").map(Number);
					return {
						id: index + 1,
						name: `Collision_${x}_${y}`,
						type: "collision",
						x: x * tileSize,
						y: y * tileSize,
						width: tileSize,
						height: tileSize,
					};
				}),
			},
			...(attributeObjects.length
				? [
						{
							id: layers.length + 2,
							name: "tile_attributes",
							type: "objectgroup",
							draworder: "topdown",
							objects: attributeObjects,
						},
					]
				: []),
		],
		tilesets,
	};
};
