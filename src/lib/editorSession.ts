import { hydrateSketch, normalizeLevel, serializeSketch } from "./levelDocument";
import { DEFAULT_LAYERS } from "./tileLayers";

export const LEVELS_STORAGE_KEY = "pixel-pipeline-levels";

export type LevelStorage = Pick<Storage, "getItem" | "setItem">;

export type LevelSketch = {
	placed: Map<string, any>;
	collisions: Set<string>;
};

export type LevelDocuments = Record<string, any>;

export const createLevelDocument = (id: string, name = id) => ({
	metadata: { id, name, width: 48, height: 36, backgroundSet: "default" },
	layers: DEFAULT_LAYERS.map((layer) => ({ ...layer })),
	platforms: [],
	props: [],
	pickups: [],
	enemies: [],
	exits: [],
	tiles: [],
	collisions: [],
});

export const loadLevelDocuments = (
	serialized: string | null,
): LevelDocuments => {
	try {
		const saved = JSON.parse(serialized || "null");
		const { gym, ...docs } = saved || {};
		return Object.fromEntries(
			Object.entries({
				main: createLevelDocument("main", "Main Level"),
				...docs,
			}).map(([id, doc]) => [id, normalizeLevel(doc)]),
		);
	} catch {
		return { main: createLevelDocument("main", "Main Level") };
	}
};

export const loadStoredLevelDocuments = (storage: LevelStorage | null) => {
	try {
		return loadLevelDocuments(storage?.getItem(LEVELS_STORAGE_KEY) || null);
	} catch {
		return loadLevelDocuments(null);
	}
};

export const persistLevelDocuments = (
	storage: LevelStorage | null,
	documents: LevelDocuments,
) => {
	storage?.setItem(LEVELS_STORAGE_KEY, JSON.stringify(documents));
	return documents;
};

export const cloneLevelDocument = (document: any) =>
	JSON.parse(JSON.stringify(document));

export const updateLevelDocument = (
	documents: LevelDocuments,
	levelId: string,
	updater: (document: any) => any,
) => {
	const current = normalizeLevel(
		documents[levelId] || createLevelDocument(levelId),
	);
	return { ...documents, [levelId]: updater(current) };
};

export const persistLevelSketch = (
	documents: LevelDocuments,
	levelId: string,
	placed: Map<string, any>,
	collisions: Set<string>,
	layers?: any[],
) => {
	const current = normalizeLevel(
		documents[levelId] || createLevelDocument(levelId),
	);
	return {
		...documents,
		[levelId]: {
			...current,
			...serializeSketch(placed, collisions, layers),
		},
	};
};

export const saveLevelSketch = (
	levels: Record<string, LevelSketch>,
	levelId: string,
	placed: Map<string, any>,
	collisions: Set<string>,
) => ({
	...levels,
	[levelId]: {
		placed: new Map(placed),
		collisions: new Set(collisions),
	},
});

const emptySketch = (): LevelSketch => ({
	placed: new Map(),
	collisions: new Set(),
});

export const hydrateLevelSketch = (
	levels: Record<string, LevelSketch>,
	levelId: string,
	document: any,
	assets: any[],
) => {
	const existing = levels[levelId];
	if (existing) return { levels, sketch: existing };
	if (!(document?.tiles?.length || document?.collisions?.length)) {
		const next = saveLevelSketch(levels, levelId, new Map(), new Set());
		return { levels: next, sketch: next[levelId] };
	}
	const names = new Set((document.tiles || []).map((tile) => tile.asset));
	if (
		![...names].every((name) => assets.some((asset) => asset.name === name))
	) {
		return { levels, sketch: emptySketch() };
	}
	const sketch = hydrateSketch(document, assets);
	const next = saveLevelSketch(
		levels,
		levelId,
		sketch.placed,
		sketch.collisions,
	);
	return { levels: next, sketch: next[levelId] };
};
