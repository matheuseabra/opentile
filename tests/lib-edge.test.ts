import { describe, expect, it, vi } from "vitest";
import {
	categoryForName,
	createAsset,
	hydrateStoredAsset,
	hydrateStoredAssets,
	normalizeAssetCategory,
	nextAssetName,
	openAssetStore,
	persistAsset,
	readStoredAssets,
	releaseAsset,
	removePersistedAsset,
} from "../src/lib/assetLibrary";
import { hydrateLevelSketch } from "../src/lib/editorSession";
import { hydrateSketch, normalizeLevel, serializeSketch } from "../src/lib/levelDocument";
import { createPhaserTilemap } from "../src/lib/phaserTilemap";
import {
	layersFor,
	layersForDocument,
	removeTile,
	tilesFor,
} from "../src/lib/tileLayers";

const imageAdapters = (
	behavior: "load" | "decode-throw" | "no-decode" | "error" | "double",
) => {
	const revoked: string[] = [];
	return {
		revoked,
		adapters: {
			createObjectUrl: () => "blob:edge",
			revokeObjectUrl: (url: string) => revoked.push(url),
			createImage: () => {
				const image: any = {
					onload: null,
					onerror: null,
				};
				if (behavior !== "no-decode" && behavior !== "double")
					image.decode =
						behavior === "decode-throw"
							? () => {
									throw new Error("decode failed");
								}
							: () => Promise.resolve();
				Object.defineProperty(image, "src", {
					set() {
						queueMicrotask(() => {
							if (behavior === "error") image.onerror?.(new Error("load failed"));
							else {
								const lateError = image.onerror;
								image.onload?.();
								if (behavior === "double") lateError?.(new Error("late error"));
							}
						});
					},
				});
				return image;
			},
		},
	};
};

describe("asset library edge cases", () => {
	it("normalizes every filename category and handles extensionless names", () => {
		expect(categoryForName("wood-wall.png")).toBe("trees");
		expect(categoryForName("run-cycle.png")).toBe("animated");
		expect(categoryForName("stone-floor.png")).toBe("ground");
		expect(categoryForName("item-prop.png")).toBe("objects");
		expect(categoryForName("plain.png")).toBe("terrain");
		expect(normalizeAssetCategory("objects", "plain.png")).toBe("objects");
		expect(nextAssetName([{ name: "tile" }], "tile")).toBe("tile-1");
	});

	it("uses browser defaults when no adapters are provided", async () => {
		const originalImage = globalThis.Image;
		const urlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
		const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
		const revoked: string[] = [];
		class BrowserImage {
			onload: (() => void) | null = null;
			onerror: (() => void) | null = null;
			decode() {
				return Promise.resolve();
			}
			set src(_value: string) {
				queueMicrotask(() => this.onload?.());
			}
		}
		Object.defineProperty(globalThis, "Image", {
			configurable: true,
			value: BrowserImage,
		});
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: () => "blob:browser",
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: (url: string) => revoked.push(url),
		});
		try {
			const asset = await createAsset(new Blob(["browser"]), "browser.png", "trees");
			expect(asset.url).toBe("blob:browser");
			releaseAsset(asset);
			expect(revoked).toEqual(["blob:browser"]);
		} finally {
			if (urlDescriptor)
				Object.defineProperty(URL, "createObjectURL", urlDescriptor);
			else delete (URL as any).createObjectURL;
			if (revokeDescriptor)
				Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
			else delete (URL as any).revokeObjectURL;
			Object.defineProperty(globalThis, "Image", {
				configurable: true,
				value: originalImage,
			});
		}
	});

	it("releases assets across decode success and failure paths", async () => {
		const noDecode = imageAdapters("no-decode");
		const loaded = await createAsset(new Blob(["ok"]), "loaded.png", "", noDecode.adapters);
		releaseAsset(loaded, noDecode.adapters);
		releaseAsset({}, noDecode.adapters);
		releaseAsset({ url: "blob:no-image" }, noDecode.adapters);
		expect(loaded.category).toBe("terrain");
		expect(noDecode.revoked).toEqual(["blob:edge", "blob:no-image"]);

		const decodeThrow = imageAdapters("decode-throw");
		await expect(
			createAsset(new Blob(["bad"]), "decode.png", "terrain", decodeThrow.adapters),
		).rejects.toThrow("Could not load decode.png");
		expect(decodeThrow.revoked).toEqual(["blob:edge"]);

		const double = imageAdapters("double");
		await expect(
			createAsset(new Blob(["double"]), "double.png", "terrain", double.adapters),
		).resolves.toMatchObject({ name: "double.png" });
		expect(double.revoked).toEqual([]);

		const failure = imageAdapters("error");
		const failedHydration = await hydrateStoredAssets(
			[{ blob: new Blob(["missing-name"]) }],
			failure.adapters,
		);
		expect(failedHydration.failures[0].name).toBe("(unknown asset)");

		const hydrated = imageAdapters("load");
		const asset = await hydrateStoredAsset(
			{ name: "stored.png", blob: new Blob(["stored"]), category: "ground" },
			hydrated.adapters,
		);
		expect(asset.category).toBe("ground");
		releaseAsset(asset, hydrated.adapters);
	});

	it("supports the IndexedDB adapter boundary", async () => {
		const records: any[] = [];
		const store = {
			getAll: () => {
				const request: any = { result: records.slice(), error: null };
				queueMicrotask(() => request.onsuccess?.());
				return request;
			},
			put: (record: any) => {
				records.push(record);
			},
			delete: (name: string) => {
				const index = records.findIndex((record) => record.name === name);
				if (index >= 0) records.splice(index, 1);
			},
		};
		const db: any = {
			createObjectStore: vi.fn(),
			transaction: vi.fn(() => ({ objectStore: () => store })),
		};
		const previousIndexedDb = globalThis.indexedDB;
		const openRequest: any = { result: db, error: null };
		Object.defineProperty(globalThis, "indexedDB", {
			configurable: true,
			value: {
				open: () => {
					queueMicrotask(() => {
						openRequest.onupgradeneeded?.();
						openRequest.onsuccess?.();
					});
					return openRequest;
				},
			},
		});
		try {
			expect(await openAssetStore()).toBe(db);
			expect(db.createObjectStore).toHaveBeenCalledWith("tiles", { keyPath: "name" });
			persistAsset(db, { name: "tile.png", blob: "blob", category: "terrain" });
			expect(await readStoredAssets(db)).toEqual([
				{ name: "tile.png", blob: "blob", category: "terrain" },
			]);
			removePersistedAsset(db, "tile.png");
			expect(await readStoredAssets(db)).toEqual([]);
			expect(persistAsset(null, {})).toBeUndefined();
			expect(removePersistedAsset(null, "tile.png")).toBeUndefined();
		} finally {
			Object.defineProperty(globalThis, "indexedDB", {
				configurable: true,
				value: previousIndexedDb,
			});
		}
	});
});

describe("level and tile boundaries", () => {
	it("handles legacy layers, filtered serialization, and missing assets", () => {
		const legacy = normalizeLevel({
			metadata: { height: 0 },
			layers: [
				{ id: "terrain" },
				{ id: "decoration" },
				{ id: "foreground" },
			],
			tiles: [],
		});
		expect(legacy.layers).toHaveLength(1);
		expect(legacy.metadata.height).toBe(18);

		const serialized = serializeSketch(
			new Map([
				[
					"1,2",
					{
						terrain: { asset: "grass.png", sx: 16 },
						decoration: { asset: { name: "tree.png" } },
					},
				],
			]),
			new Set(),
			[{ id: "terrain", visible: true }, { id: "decoration", visible: false }],
		);
		expect(serialized.tiles).toHaveLength(1);
		expect(serialized.tiles[0].asset).toBe("grass.png");
		expect(hydrateSketch({ tiles: [{ x: 0, y: 0, asset: "missing.png" }] }, []).placed.size).toBe(0);

		const emptyHydration = hydrateLevelSketch(
			{},
			"empty",
			{ tiles: [], collisions: [] },
			[],
		);
		expect(emptyHydration.sketch.placed.size).toBe(0);
	});

	it("handles empty cells and layer properties in exports", () => {
		expect(layersForDocument({})).toBeTruthy();
		expect(layersFor(null)).toEqual({});
		expect(removeTile({ terrain: { asset: "grass" } }, "terrain")).toBeNull();
		expect(tilesFor(null)).toEqual([]);

		const tile = { asset: { name: "grass.png", image: { width: 32, height: 32 } } };
		const map = createPhaserTilemap({
			placed: new Map([["0,0", { terrain: tile }]]),
			collisions: new Set(),
			levelWidth: 1,
			levelHeight: 1,
			tileSize: 16,
			layers: [
				{
					id: "terrain",
					name: "Terrain",
					visible: true,
					collision: true,
					properties: { material: "stone" },
				},
			],
		});
		expect(map.layers[0].properties).toContainEqual({
			name: "material",
			type: "string",
			value: "stone",
		});
	});
});
