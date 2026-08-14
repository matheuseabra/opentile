import { nextAssetName } from "../src/lib/assetLibrary";
import {
	copyTiles,
	deleteTiles,
	moveTiles,
	pasteTiles,
	tilesInRegion,
} from "../src/lib/canvasEditor";
import {
	clearLevelContent,
	hydrateSketch,
	serializeSketch,
} from "../src/lib/levelDocument";
import { createPhaserTilemap } from "../src/lib/phaserTilemap";
import { putTile, removeTile, tilesFor } from "../src/lib/tileLayers";
import {
	cloneLevelDocument,
	createLevelDocument,
	hydrateLevelSketch,
	loadLevelDocuments,
	loadStoredLevelDocuments,
	persistLevelDocuments,
	persistLevelSketch,
	saveLevelSketch,
	updateLevelDocument,
} from "../src/lib/editorSession";

const grass = { name: "grass.png", image: { width: 96, height: 96 } };
const rock = { name: "rock.png", image: { width: 32, height: 32 } };
const stack = putTile(
	{
		terrain: {
			asset: grass,
			sx: 0,
			sy: 0,
			attributes: { hazard: true },
			autotile: { x: 0, y: 0 },
		},
	},
	"decoration",
	{ asset: rock, sx: 0, sy: 0 },
);
const saved = serializeSketch(new Map([["2,3", stack]]), new Set(["2,3"]));
const loaded = hydrateSketch(saved, [grass, rock]);
const placed = new Map([["1,1", stack]]);
const collisions = new Set(["1,1"]);
const area = { x: 1, y: 1, w: 1, h: 1 };
const clipboard = copyTiles(placed, area);
pasteTiles(placed, clipboard, { x: 2, y: 2 }, 4, 4);
moveTiles(placed, collisions, area, 1, 0);
deleteTiles(placed, collisions, { x: 2, y: 1, w: 1, h: 1 });
const region = tilesInRegion({ x: 16, y: 32, w: 32, h: 32 }, 16);
const layers = [
	{ id: "terrain", name: "Terrain", visible: true, collision: false },
	{ id: "decoration", name: "Decoration", visible: false, collision: false },
];
const tilemap = createPhaserTilemap({
	placed: new Map([["2,3", stack]]),
	collisions: new Set(["2,3"]),
	levelWidth: 4,
	levelHeight: 4,
	tileSize: 32,
	layers,
});
const document = {
	metadata: { id: "main" },
	platforms: [{}],
	props: [{}],
	pickups: [{}],
	enemies: [{}],
	exits: [{}],
	...saved,
};
const cleared = clearLevelContent(document);
const storage = {
	values: new Map<string, string>(),
	getItem(key: string) {
		return this.values.get(key) || null;
	},
	setItem(key: string, value: string) {
		this.values.set(key, value);
	},
};
const initialDocuments = loadLevelDocuments(null);
const malformedDocuments = loadLevelDocuments("{not-json");
const updatedDocuments = updateLevelDocument(
	initialDocuments,
	"main",
	(doc) => ({ ...doc, metadata: { ...doc.metadata, width: 64 } }),
);
const savedDocuments = persistLevelSketch(
	updatedDocuments,
	"main",
	new Map([["1,2", stack]]),
	new Set(["1,2"]),
);
persistLevelDocuments(storage, savedDocuments);
const reloadedDocuments = loadLevelDocuments(
	storage.getItem("pixel-pipeline-levels"),
);
const sourcePlaced = new Map([["1,2", stack]]);
const levelSketches = saveLevelSketch(
	{},
	"main",
	sourcePlaced,
	new Set(["1,2"]),
);
sourcePlaced.clear();
const hydratedSession = hydrateLevelSketch(
	levelSketches,
	"main",
	savedDocuments.main,
	[grass, rock],
);
const freshDocument = createLevelDocument("fresh", "Fresh Level");
const delayedHydration = hydrateLevelSketch(
	{},
	"main",
	savedDocuments.main,
	[rock],
);
const readyHydration = hydrateLevelSketch(
	delayedHydration.levels,
	"main",
	savedDocuments.main,
	[grass, rock],
);
const clonedDocument = cloneLevelDocument(savedDocuments.main);
clonedDocument.metadata.width = 99;
const throwingStorage = {
	getItem() {
		throw new Error("storage unavailable");
	},
	setItem() {},
};
const fallbackDocuments = loadStoredLevelDocuments(throwingStorage);

if (
	tilesFor(stack, layers).length !== 2 ||
	removeTile(stack, "decoration").terrain.asset !== grass ||
	loaded.placed.get("2,3").terrain.attributes.hazard !== true ||
	loaded.placed.get("2,3").terrain.autotile.x !== 0 ||
	saved.tiles[0].attributes.hazard !== true ||
	nextAssetName([{ name: "grass.png" }], "grass.png") !== "grass-1.png" ||
	placed.size !== 1 ||
	collisions.size ||
	region.length !== 4 ||
	region[3].x !== 1 ||
	region[3].y !== 1 ||
	region[3].sx !== 32 ||
	region[3].sy !== 48 ||
	tilemap.layers.length !== 3 ||
	tilemap.layers[0].data[14] !== 1 ||
	tilemap.layers[1].objects[0].width !== 32 ||
	tilemap.layers[2].objects[0].properties[0].name !== "hazard" ||
	Object.values(cleared).some(
		(value) => Array.isArray(value) && value.length,
	) ||
	cleared.metadata !== document.metadata ||
	initialDocuments.main.metadata.width !== 48 ||
	malformedDocuments.main.metadata.width !== 48 ||
	reloadedDocuments.main.metadata.width !== 64 ||
	reloadedDocuments.main.tiles.length !== 2 ||
	hydratedSession.sketch.placed.get("1,2").terrain.asset !== grass ||
	levelSketches.main.placed.size !== 1 ||
	freshDocument.metadata.name !== "Fresh Level" ||
	savedDocuments.main.metadata.width !== 64 ||
	fallbackDocuments.main.metadata.width !== 48 ||
	clonedDocument.metadata.width !== 99 ||
	Object.keys(delayedHydration.levels).length !== 0 ||
	readyHydration.sketch.placed.size !== 1
) {
	process.exit(1);
}
