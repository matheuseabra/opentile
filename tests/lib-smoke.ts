import {
	categoryForName,
	createAsset,
	hydrateStoredAssets,
	nextAssetName,
	releaseAsset,
	releaseAssetNameReservation,
	reserveAssetName,
	reserveExactAssetName,
} from "../src/lib/assetLibrary";
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

const makeImageAdapters = (behaviors: string[]) => {
	const revoked: string[] = [];
	let index = 0;
	return {
		revoked,
		adapters: {
			createObjectUrl: () => `blob:${index + 1}`,
			revokeObjectUrl: (url: string) => revoked.push(url),
			createImage: () => {
				const behavior = behaviors[index++] || "load";
				const image = {
					onload: null,
					onerror: null,
					decode:
						behavior === "decode-fail"
							? () => Promise.reject(new Error("decode failed"))
							: () => Promise.resolve(),
				};
				Object.defineProperty(image, "src", {
					set() {
						queueMicrotask(() => {
							if (behavior === "error") image.onerror?.(new Error("load failed"));
							else image.onload?.();
						});
					},
				});
				return image;
			},
		},
	};
};

const run = async () => {
	const successMocks = makeImageAdapters(["load"]);
	const createdTree = await createAsset(
		new Blob(["tree"]),
		"tree-tiles.png",
		"",
		successMocks.adapters,
	);
	const createdTreeUrl = createdTree.url;
	releaseAsset(createdTree, successMocks.adapters);

	const decodeFailureMocks = makeImageAdapters(["decode-fail"]);
	let decodeFailureMessage = "";
	try {
		await createAsset(
			new Blob(["bad"]),
			"broken.png",
			"terrain",
			decodeFailureMocks.adapters,
		);
	} catch (error) {
		decodeFailureMessage = error instanceof Error ? error.message : String(error);
	}

	const reservedNames = new Set<string>();
	const firstReservedName = reserveAssetName(
		[{ name: "grass.png" }],
		"grass.png",
		reservedNames,
	);
	const secondReservedName = reserveAssetName(
		[{ name: "grass.png" }],
		"grass.png",
		reservedNames,
	);
	releaseAssetNameReservation(reservedNames, firstReservedName);
	const reusedReservedName = reserveAssetName(
		[{ name: "grass.png" }],
		"grass.png",
		reservedNames,
	);
	releaseAssetNameReservation(reservedNames, secondReservedName);
	releaseAssetNameReservation(reservedNames, reusedReservedName);

	const exactReservedNames = new Set<string>();
	const exactReservedName = reserveExactAssetName(
		exactReservedNames,
		"grass.png",
	);
	const exactFollowupName = reserveAssetName(
		[],
		"grass.png",
		exactReservedNames,
	);
	releaseAssetNameReservation(exactReservedNames, exactReservedName);
	releaseAssetNameReservation(exactReservedNames, exactFollowupName);

	const hydrationMocks = makeImageAdapters(["load", "error"]);
	const hydratedAssets = await hydrateStoredAssets(
		[
			{ name: "wood-floor.png", blob: new Blob(["ok"]) },
			{ name: "broken.png", blob: new Blob(["bad"]), category: "objects" },
		],
		hydrationMocks.adapters,
	);
	if (hydratedAssets.assets[0]) releaseAsset(hydratedAssets.assets[0], hydrationMocks.adapters);

	if (
		tilesFor(stack, layers).length !== 2 ||
		removeTile(stack, "decoration").terrain.asset !== grass ||
		loaded.placed.get("2,3").terrain.attributes.hazard !== true ||
		loaded.placed.get("2,3").terrain.autotile.x !== 0 ||
		saved.tiles[0].attributes.hazard !== true ||
		nextAssetName([{ name: "grass.png" }], "grass.png") !== "grass-1.png" ||
		nextAssetName([], "grass.png", ["grass.png", "grass-1.png"]) !==
			"grass-2.png" ||
		categoryForName("tree-tiles.png") !== "trees" ||
		categoryForName("walk-cycle.png") !== "animated" ||
		firstReservedName !== "grass-1.png" ||
		secondReservedName !== "grass-2.png" ||
		reusedReservedName !== "grass-1.png" ||
		reservedNames.size !== 0 ||
		exactReservedName !== "grass.png" ||
		exactFollowupName !== "grass-1.png" ||
		exactReservedNames.size !== 0 ||
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
		readyHydration.sketch.placed.size !== 1 ||
		createdTree.category !== "trees" ||
		successMocks.revoked.length !== 1 ||
		successMocks.revoked[0] !== createdTreeUrl ||
		decodeFailureMessage !== "Could not load broken.png" ||
		decodeFailureMocks.revoked.length !== 1 ||
		decodeFailureMocks.revoked[0] !== "blob:1" ||
		hydratedAssets.assets.length !== 1 ||
		hydratedAssets.assets[0].category !== "trees" ||
		hydratedAssets.failures.length !== 1 ||
		hydratedAssets.failures[0].name !== "broken.png" ||
		!(hydratedAssets.failures[0].error instanceof Error) ||
		hydratedAssets.failures[0].error.message !== "Could not load broken.png" ||
		hydrationMocks.revoked.length !== 2 ||
		hydrationMocks.revoked[0] !== "blob:2" ||
		hydrationMocks.revoked[1] !== hydratedAssets.assets[0].url
	) {
		process.exit(1);
	}
};

await run();
