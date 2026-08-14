import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import {
	BoxSelect,
	ClipboardPaste,
	Copy,
	Eraser,
	MousePointer2,
	Plus,
	Save,
	FilePlus2,
	Download,
	ZoomIn,
	ZoomOut,
	RotateCcw,
	RotateCw,
	Trash2,
	Box,
	FileJson,
	Eye,
	EyeOff,
	Lock,
	Unlock,
	Menu,
	MoreHorizontal,
	Shield,
} from "lucide-react";
import "./styles.css";
import { AssetLibrary } from "./components/AssetLibrary";
import { LevelCanvas } from "./components/LevelCanvas";
import {
	DEFAULT_LAYERS,
	layersForDocument,
	layersFor,
	putTile,
	removeTile,
	tilesFor,
} from "./lib/tileLayers";
import {
	clearLevelContent,
	hydrateSketch,
	normalizeLevel,
	serializeSketch,
} from "./lib/levelDocument";
import { createPhaserTilemap } from "./lib/phaserTilemap";
import {
	createAsset,
	nextAssetName,
	openAssetStore,
	persistAsset,
	readStoredAssets,
	removePersistedAsset,
} from "./lib/assetLibrary";
import {
	copyTiles,
	deleteTiles,
	moveTiles,
	pasteTiles,
	tilesInRegion,
} from "./lib/canvasEditor";

type GridStyle = CSSProperties & { "--grid-size": string };

const key = (x: number, y: number) => `${x},${y}`;
const HIGHLIGHT_COLOR = "#55c957";
const CATEGORIES = ["terrain", "ground", "trees", "objects", "animated"];
const categoryForName = (name) => {
	const n = name.toLowerCase();
	return n.includes("tree") || n.includes("wood")
		? "trees"
		: n.includes("anim") || n.includes("walk") || n.includes("run")
			? "animated"
			: n.includes("ground") || n.includes("floor")
				? "ground"
				: n.includes("object") || n.includes("prop") || n.includes("item")
					? "objects"
					: "terrain";
};
const OBJECT_TYPES = ["platform", "prop", "pickup", "enemy", "exit"];
const AUTOTILE_STATES = ["ignored", "required", "empty"];
const AUTOTILE_OFFSETS = [
	[-1, -1],
	[0, -1],
	[1, -1],
	[-1, 0],
	[0, 0],
	[1, 0],
	[-1, 1],
	[0, 1],
	[1, 1],
];
const newAutotileRule = (index) => ({
	id: `rule-${Date.now()}-${index}`,
	name: `Rule ${index + 1}`,
	pattern: AUTOTILE_OFFSETS.map((_, cell) =>
		cell === 4 ? "required" : "ignored",
	),
	variant: null,
});
const defaultAutotileRule = () => ({
	center: "required",
	cardinal: "required-or-empty",
	corners: "ignored",
	defaultTile: null,
	rules: [newAutotileRule(0)],
});
const newLevelDoc = (id, name = id) => ({
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
const objectBucket = (type) =>
	type === "platform"
		? "platforms"
		: type === "prop"
			? "props"
			: type === "pickup"
				? "pickups"
				: type === "enemy"
					? "enemies"
					: "exits";

function App() {
	const canvasRef = useRef(null),
		stageRef = useRef(null),
		dbRef = useRef(null),
		assetsRef = useRef([]);
	const placedRef = useRef<Map<string, any>>(new Map()),
		collisionsRef = useRef<Set<string>>(new Set()),
		historyRef = useRef([]),
		redoRef = useRef([]),
		levelsRef = useRef({ main: null });
	const paintingRef = useRef(false),
		toolStartRef = useRef(null),
		panRef = useRef(null),
		spaceRef = useRef(false),
		lastPaintRef = useRef(""),
		buttonRef = useRef(0);
	const [assets, setAssets] = useState<any[]>([]),
		[selected, setSelected] = useState(null),
		[selectedRegion, setSelectedRegion] = useState({
			x: 0,
			y: 0,
			w: 16,
			h: 16,
		}),
		[menuOpen, setMenuOpen] = useState(false),
		[levelZoom, setLevelZoom] = useState(1),
		[pickerZoom, setPickerZoom] = useState(1),
		[pickerDragStart, setPickerDragStart] = useState(null),
		[level, setLevel] = useState("main");
	const [sourceFile, setSourceFile] = useState(null),
		[assetCategory, setAssetCategory] = useState("terrain"),
		[status, setStatus] = useState(
			"Upload a tile to add it to your local library.",
		);
	const [levelDocs, setLevelDocs] = useState<any>(() => {
		try {
			const saved = JSON.parse(
				localStorage.getItem("pixel-pipeline-levels") || "null",
			);
			const { gym, ...docs } = saved || {};
			return Object.fromEntries(
				Object.entries({
					main: newLevelDoc("main", "Main Level"),
					...docs,
				}).map(([id, doc]) => [id, normalizeLevel(doc)]),
			);
		} catch {
			return {
				main: newLevelDoc("main", "Main Level"),
			};
		}
	});
	const [objectSelection, setObjectSelection] = useState(null),
		[objectMode, setObjectMode] = useState(false),
		[objectDrag, setObjectDrag] = useState(null);
	const [tileSize, setTileSize] = useState<number | string>(16),
		[grid, setGrid] = useState(true),
		[collision, setCollision] = useState(false),
		[debug, setDebug] = useState(false),
		[layerPanelOpen, setLayerPanelOpen] = useState(true),
		[rulesLayerId, setRulesLayerId] = useState(null);
	const [eraser, setEraser] = useState(false),
		[mode, setMode] = useState("brush"),
		[activeLayer, setActiveLayer] = useState("terrain"),
		[selection, setSelection] = useState(null),
		[selectionStart, setSelectionStart] = useState(null),
		[cursor, setCursor] = useState({ x: 0, y: 0 }),
		[lastTile, setLastTile] = useState({ x: 0, y: 0 }),
		[cursorActive, setCursorActive] = useState(false),
		[version, redraw] = useState(0);
	const [tileAttributes, setTileAttributes] = useState<Record<string, any>>({}),
		[customAttributeKey, setCustomAttributeKey] = useState(""),
		[customAttributeValue, setCustomAttributeValue] = useState("");
	const clipboardRef = useRef<any[]>([]),
		clipboardSizeRef = useRef({ w: 1, h: 1 });
	const t = Math.max(8, Number(tileSize) || 32);
	useEffect(() => {
		setSelectedRegion((region) => ({ ...region, w: t, h: t }));
	}, [t]);
	const currentDoc = normalizeLevel(levelDocs[level] || newLevelDoc(level));
	const levelWidth = Math.max(24, Number(currentDoc.metadata.width) || 24);
	const levelHeight = Math.max(1, Number(currentDoc.metadata.height) || 18);
	const documentLayers = layersForDocument(currentDoc);
	const activeLayerDoc = documentLayers.find(
		(layer) => layer.id === activeLayer,
	);
	const rulesLayer = documentLayers.find((layer) => layer.id === rulesLayerId);
	const rulesDefaultTile = rulesLayer?.rule?.defaultTile;
	const rulesDefaultAsset = rulesDefaultTile
		? assetsRef.current.find((asset) => asset.name === rulesDefaultTile.assetId)
		: null;
	const exportCollisions = new Set<string>(collisionsRef.current);
	for (const [cellKey, cell] of placedRef.current)
		if (
			documentLayers.some(
				(layer) =>
					layer.visible && layer.collision && layersFor(cell)[layer.id],
			)
		)
			exportCollisions.add(cellKey);
	const persistLevels = (docs) => {
		setLevelDocs(docs);
		localStorage.setItem("pixel-pipeline-levels", JSON.stringify(docs));
	};
	const updateCurrentDoc = (updater) =>
		persistLevels({ ...levelDocs, [level]: updater(currentDoc) });
	const persistSketch = () => {
		const sketch = serializeSketch(
			placedRef.current,
			collisionsRef.current,
			documentLayers,
		);
		const docs = { ...levelDocs, [level]: { ...currentDoc, ...sketch } };
		setLevelDocs(docs);
		localStorage.setItem("pixel-pipeline-levels", JSON.stringify(docs));
	};
	const bump = (save = true) => {
		if (save) persistSketch();
		redraw((v) => v + 1);
	};
	const updateLayers = (updater) =>
		updateCurrentDoc((doc) => ({
			...doc,
			layers: updater(layersForDocument(doc)),
		}));
	const updateAutotileRules = (layerId, updater) =>
		updateLayers((layers) =>
			layers.map((layer) =>
				layer.id === layerId
					? {
							...layer,
							rule: updater({
								...defaultAutotileRule(),
								...layer.rule,
								rules: layer.rule?.rules?.length
									? layer.rule.rules
									: [newAutotileRule(0)],
							}),
						}
					: layer,
			),
		);
	const openAutotileRules = (layer) => {
		if (layer.type !== "autotile") return;
		updateAutotileRules(layer.id, (rule) => rule);
		setRulesLayerId(layer.id);
	};
	const setDefaultAutotileTile = (layerId) => {
		if (!selected) return setStatus("Select a tileset tile first.");
		updateAutotileRules(layerId, (rule) => ({
			...rule,
			defaultTile: {
				assetId: selected.name,
				x: selectedRegion.x,
				y: selectedRegion.y,
			},
		}));
		setStatus("Default autotile tile set.");
	};
	const cycleAutotileRuleCell = (layerId, ruleId, cell) => {
		updateAutotileRules(layerId, (rule) => ({
			...rule,
			rules: rule.rules.map((item) =>
				item.id !== ruleId
					? item
					: {
							...item,
							pattern: item.pattern.map((state, index) =>
								index === cell
									? AUTOTILE_STATES[
											(AUTOTILE_STATES.indexOf(state) + 1) %
												AUTOTILE_STATES.length
										]
									: state,
							),
						},
			),
		}));
	};
	const updateAutotileRule = (layerId, ruleId, patch) => {
		updateAutotileRules(layerId, (rule) => ({
			...rule,
			rules: rule.rules.map((item) =>
				item.id === ruleId ? { ...item, ...patch } : item,
			),
		}));
	};
	const addAutotileRule = (layerId) => {
		updateAutotileRules(layerId, (rule) => ({
			...rule,
			rules: [...rule.rules, newAutotileRule(rule.rules.length)],
		}));
	};
	const saveAutotileRules = (layer) => {
		localStorage.setItem(
			`pixel-pipeline-autotile-${layer.id}`,
			JSON.stringify(layer.rule),
		);
		setStatus(`${layer.name} rules saved.`);
	};
	const loadAutotileRules = (layer) => {
		const saved = localStorage.getItem(`pixel-pipeline-autotile-${layer.id}`);
		if (!saved) return setStatus("No saved autotile rules for this layer.");
		try {
			const rule = JSON.parse(saved);
			updateLayers((layers) =>
				layers.map((item) => (item.id === layer.id ? { ...item, rule } : item)),
			);
			setStatus(`${layer.name} rules loaded.`);
		} catch {
			setStatus("Saved autotile rules are invalid.");
		}
	};
	const selectLayer = (id) => {
		setActiveLayer(id);
		setStatus(
			"Active layer: " +
				(documentLayers.find((layer) => layer.id === id)?.name || id),
		);
	};
	const addLayer = (type = "tile") => {
		const name = prompt(
			"Layer name",
			type === "autotile"
				? "Autotile layer"
				: "Layer " + (documentLayers.length + 1),
		);
		if (!name) return;
		const base =
			name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "") || "layer";
		const id = documentLayers.some((layer) => layer.id === base)
			? base + "-" + Date.now()
			: base;
		updateLayers((layers) => [
			...layers,
			{
				id,
				name,
				visible: true,
				locked: false,
				collision: false,
				type,
				rule: type === "autotile" ? defaultAutotileRule() : undefined,
			},
		]);
		selectLayer(id);
	};
	const duplicateLayer = (layer) => {
		const id = layer.id + "-copy-" + Date.now();
		updateLayers((layers) => [
			...layers,
			{
				...layer,
				id,
				name: layer.name + " copy",
				rule:
					layer.type === "autotile"
						? {
								...defaultAutotileRule(),
								...layer.rule,
								rules: layer.rule?.rules?.map((rule) => ({
									...rule,
									id: `rule-${Date.now()}-${rule.id}`,
								})) || [newAutotileRule(0)],
							}
						: undefined,
			},
		]);
		selectLayer(id);
	};
	const deleteLayer = (layer) => {
		if (
			documentLayers.length === 1 ||
			!confirm("Delete " + layer.name + " and its tiles?")
		)
			return;
		commit();
		for (const [cellKey, cell] of placedRef.current) {
			const next = removeTile(cell, layer.id);
			if (next) placedRef.current.set(cellKey, next);
			else placedRef.current.delete(cellKey);
		}
		updateLayers((layers) => layers.filter(({ id }) => id !== layer.id));
		if (activeLayer === layer.id)
			setActiveLayer(documentLayers.find(({ id }) => id !== layer.id).id);
		bump();
	};
	const moveLayer = (index, direction) => {
		const target = index + direction;
		if (target < 0 || target >= documentLayers.length) return;
		updateLayers((layers) => {
			const next = [...layers],
				[layer] = next.splice(index, 1);
			next.splice(target, 0, layer);
			return next;
		});
	};
	const addObject = (type) => {
		const id = "obj-" + Date.now();
		const base =
			type === "platform"
				? {
						assetId: selected?.name || "",
						x: lastTile.x * t,
						y: lastTile.y * t,
						scale: 1,
						collision: collision,
					}
				: type === "prop"
					? {
							frameId: (selected?.name || "") + ":0,0",
							x: lastTile.x * t,
							y: lastTile.y * t,
							depth: 1,
						}
					: type === "pickup"
						? { pickupType: "coin", x: lastTile.x * t, y: lastTile.y * t }
						: type === "enemy"
							? {
									enemyId: "enemy",
									x: lastTile.x * t,
									y: lastTile.y * t,
									facing: "right",
									tuning: {},
								}
							: {
									exitId: "exit",
									x: lastTile.x * t,
									y: lastTile.y * t,
									collision: { w: t, h: t * 2 },
									targetAnimation: "fade",
								};
		updateCurrentDoc((doc) => ({
			...doc,
			[objectBucket(type)]: [...doc[objectBucket(type)], { id, ...base }],
		}));
		setObjectSelection({ type, id });
		setObjectMode(true);
		setStatus("Added " + type + ".");
	};
	const selectedObject = objectSelection
		? (currentDoc[objectBucket(objectSelection.type)] || []).find(
				(item) => item.id === objectSelection.id,
			)
		: null;
	const updateSelectedObject = (patch) => {
		if (!selectedObject) return;
		updateCurrentDoc((doc) => ({
			...doc,
			[objectBucket(objectSelection.type)]: doc[
				objectBucket(objectSelection.type)
			].map((item) =>
				item.id === selectedObject.id ? { ...item, ...patch } : item,
			),
		}));
		bump(false);
	};
	const deleteSelectedObject = () => {
		if (!selectedObject) return;
		updateCurrentDoc((doc) => ({
			...doc,
			[objectBucket(objectSelection.type)]: doc[
				objectBucket(objectSelection.type)
			].filter((item) => item.id !== selectedObject.id),
		}));
		setObjectSelection(null);
		setStatus("Deleted object.");
	};

	const select = (asset) => {
		setSelected(asset);
		setSelectedRegion({ x: 0, y: 0, w: t, h: t });
		setEraser(false);
		setStatus(asset ? `Selected ${asset.name}` : "No tile selected.");
	};
	const snapshot = () => ({
		placed: new Map(placedRef.current),
		collisions: new Set(collisionsRef.current),
		assets: [...assetsRef.current],
		selected,
		document: currentDoc,
	});
	const commit = () => {
		historyRef.current.push(snapshot());
		redoRef.current = [];
		if (historyRef.current.length > 100) historyRef.current.shift();
	};
	const restore = (s) => {
		placedRef.current = new Map(s.placed);
		collisionsRef.current = new Set(s.collisions);
		levelsRef.current[level] = {
			placed: new Map(s.placed),
			collisions: new Set(s.collisions),
		};
		assetsRef.current = [...s.assets];
		setAssets(s.assets);
		select(s.selected);
		persistLevels({
			...levelDocs,
			[level]: {
				...s.document,
				...serializeSketch(s.placed, s.collisions, documentLayers),
			},
		});
		redraw((v) => v + 1);
	};
	const undo = () => {
		const s = historyRef.current.pop();
		if (!s) return;
		redoRef.current.push(snapshot());
		restore(s);
		setStatus("Undid last action.");
	};
	const redo = () => {
		const s = redoRef.current.pop();
		if (!s) return;
		historyRef.current.push(snapshot());
		restore(s);
		setStatus("Redid last action.");
	};
	const clearLevel = () => {
		const hasContent =
			placedRef.current.size ||
			collisionsRef.current.size ||
			["platforms", "props", "pickups", "enemies", "exits"].some(
				(bucket) => currentDoc[bucket]?.length,
			);
		if (!hasContent) return setStatus("Level is already clear.");
		if (!confirm(`Clear everything in ${currentDoc.metadata.name}?`)) return;
		commit();
		placedRef.current.clear();
		collisionsRef.current.clear();
		levelsRef.current[level] = { placed: new Map(), collisions: new Set() };
		persistLevels({ ...levelDocs, [level]: clearLevelContent(currentDoc) });
		setObjectSelection(null);
		setObjectMode(false);
		setObjectDrag(null);
		setSelection(null);
		redraw((v) => v + 1);
		setStatus("Level cleared. Undo restores it.");
	};

	const addAsset = (
		blob,
		originalName = "asset.png",
		save = true,
		category = assetCategory,
	) => {
		const name = nextAssetName(assetsRef.current, originalName);
		createAsset(blob, name, category || categoryForName(name)).then((asset) => {
			assetsRef.current = [...assetsRef.current, asset];
			setAssets(assetsRef.current);
			if (save) persistAsset(dbRef.current, asset);
			select(asset);
		});
	};

	const switchLevel = (next) => {
		// ponytail: history is level-local; use per-level stacks if cross-level undo is needed.
		historyRef.current = [];
		redoRef.current = [];
		levelsRef.current[level] = {
			placed: new Map(placedRef.current),
			collisions: new Set(collisionsRef.current),
		};
		let target = levelsRef.current[next];
		if (!target && levelDocs[next]?.tiles?.length) {
			const names = new Set(levelDocs[next].tiles.map((tile) => tile.asset));
			if (
				[...names].every((name) =>
					assetsRef.current.some((asset) => asset.name === name),
				)
			) {
				target = hydrateSketch(levelDocs[next], assetsRef.current);
				levelsRef.current[next] = target;
			}
		}
		if (!target) {
			target = { placed: new Map(), collisions: new Set() };
			levelsRef.current[next] = target;
		}
		placedRef.current = new Map(target.placed);
		collisionsRef.current = new Set(target.collisions);
		setLevel(next);
		setSelection(null);
		setCursor({ x: 0, y: 0 });
		setLastTile({ x: 0, y: 0 });
		setDebug(false);
		bump(false);
		setStatus((levelDocs[next]?.metadata.name || next) + " loaded.");
	};

	useEffect(() => {
		for (const [id, doc] of Object.entries(levelDocs) as [string, any][]) {
			if (
				levelsRef.current[id] ||
				!(doc.tiles?.length || doc.collisions?.length)
			)
				continue;
			const names = new Set((doc.tiles || []).map((tile) => tile.asset));
			if (
				![...names].every((name) =>
					assetsRef.current.some((asset) => asset.name === name),
				)
			)
				continue;
			const target = hydrateSketch(doc, assetsRef.current);
			if (target.placed.size || target.collisions.size) {
				levelsRef.current[id] = target;
				if (id === level) {
					placedRef.current = new Map(target.placed);
					collisionsRef.current = new Set<string>(target.collisions);
					redraw((v) => v + 1);
				}
			}
		}
	}, [assets, levelDocs, level]);

	useEffect(() => {
		openAssetStore()
			.then((db) => {
				dbRef.current = db;
				return readStoredAssets(db);
			})
			.then((items) =>
				items.forEach((item) =>
					addAsset(
						item.blob,
						item.name,
						false,
						item.category || categoryForName(item.name),
					),
				),
			)
			.catch(() => setStatus("Could not load the local asset library."));
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current,
			ctx = canvas?.getContext("2d");
		if (!ctx) return;
		ctx.imageSmoothingEnabled = false;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (const [k, cell] of placedRef.current) {
			const [x, y] = k.split(",").map(Number);
			for (const placed of tilesFor(
				cell,
				documentLayers.filter((layer) => layer.visible),
			)) {
				const asset = placed.asset || placed,
					sx = placed.sx ?? 0,
					sy = placed.sy ?? 0;
				ctx.drawImage(asset.image, sx, sy, t, t, x * t, y * t, t, t);
			}
		}
		const drawAsset = (assetId, sx, sy, x, y, scale = 1) => {
			const asset = assetsRef.current.find((item) => item.name === assetId);
			if (asset)
				ctx.drawImage(asset.image, sx, sy, t, t, x, y, t * scale, t * scale);
		};
		for (const item of currentDoc.platforms) {
			drawAsset(item.assetId, 0, 0, item.x, item.y, item.scale || 1);
			ctx.fillStyle = "#c6d2d6";
			ctx.font = "10px monospace";
			ctx.fillText(item.assetId || "platform", item.x, item.y - 3);
			if (item.collision) {
				ctx.strokeStyle = "rgba(231,106,77,.85)";
				ctx.strokeRect(
					item.x,
					item.y,
					t * (item.scale || 1),
					t * (item.scale || 1),
				);
			}
		}
		for (const item of currentDoc.props) {
			const [assetId, coords = "0,0"] = (item.frameId || "").split(":");
			const [sx = 0, sy = 0] = coords.split(",").map(Number);
			drawAsset(assetId, sx, sy, item.x, item.y);
			ctx.fillStyle = "#c6d2d6";
			ctx.font = "10px monospace";
			ctx.fillText(assetId || "prop", item.x, item.y - 3);
		}
		for (const item of currentDoc.pickups) {
			ctx.fillStyle = "#efc75e";
			ctx.beginPath();
			ctx.arc(item.x + t / 2, item.y + t / 2, t * 0.22, 0, Math.PI * 2);
			ctx.fill();
		}
		for (const item of currentDoc.enemies) {
			ctx.fillStyle = "#e76a4d";
			ctx.fillRect(item.x + t * 0.2, item.y + t * 0.2, t * 0.6, t * 0.6);
			ctx.fillStyle = "#e8e4d8";
			ctx.font = "10px monospace";
			ctx.fillText(item.enemyId, item.x, item.y - 3);
		}
		for (const item of currentDoc.exits) {
			ctx.strokeStyle = "#8ad1c2";
			ctx.lineWidth = 2;
			ctx.strokeRect(
				item.x,
				item.y,
				item.collision?.w || t,
				item.collision?.h || t * 2,
			);
			ctx.fillStyle = "#8ad1c2";
			ctx.font = "10px monospace";
			ctx.fillText(item.exitId, item.x, item.y - 3);
		}
		if (selectedObject) {
			const x = selectedObject.x,
				y = selectedObject.y;
			ctx.strokeStyle = HIGHLIGHT_COLOR;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(x + t / 2, y + t / 2);
			ctx.lineTo(x + t * 2, y + t / 2);
			ctx.moveTo(x + t / 2, y + t / 2);
			ctx.lineTo(x + t / 2, y - t);
			ctx.stroke();
			ctx.fillStyle = "#efb36c";
			ctx.fillText("X", x + t * 2 + 4, y + t / 2);
			ctx.fillText("Y", x + t / 2 + 4, y - t - 4);
		}
		ctx.fillStyle = "rgba(231,106,77,.4)";
		for (const k of collisionsRef.current as Set<string>) {
			const [x, y] = k.split(",").map(Number);
			ctx.fillRect(x * t, y * t, t, t);
		}
		if (cursorActive) {
			ctx.strokeStyle = HIGHLIGHT_COLOR;
			ctx.lineWidth = 2;
			ctx.strokeRect(cursor.x * t + 1, cursor.y * t + 1, t - 2, t - 2);
		}
		if (selection) {
			ctx.strokeStyle = "#f5c76e";
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.strokeRect(
				selection.x * t + 1,
				selection.y * t + 1,
				selection.w * t - 2,
				selection.h * t - 2,
			);
			ctx.setLineDash([]);
		}
		if (debug) {
			for (const k of placedRef.current.keys()) {
				const [x, y] = k.split(",").map(Number);
				ctx.strokeStyle = "rgba(239,179,108,.35)";
				ctx.strokeRect(x * t + 4, y * t + 4, t - 8, t - 8);
			}
		}
	}, [
		tileSize,
		grid,
		collision,
		eraser,
		cursor,
		cursorActive,
		selection,
		assets,
		selected,
		debug,
		mode,
		version,
		levelDocs,
		objectSelection,
		currentDoc.layers,
	]);

	const cell = (e) => {
		const r = canvasRef.current.getBoundingClientRect();
		return [
			Math.max(
				0,
				Math.min(
					levelWidth - 1,
					Math.floor(
						((e.clientX - r.left) * canvasRef.current.width) / r.width / t,
					),
				),
			),
			Math.max(
				0,
				Math.min(
					levelHeight - 1,
					Math.floor(
						((e.clientY - r.top) * canvasRef.current.height) / r.height / t,
					),
				),
			),
		];
	};
	const canvasPoint = (e) => {
		const r = canvasRef.current.getBoundingClientRect();
		return {
			x: ((e.clientX - r.left) * canvasRef.current.width) / r.width,
			y: ((e.clientY - r.top) * canvasRef.current.height) / r.height,
		};
	};
	const zoomBy = (setter, amount) =>
		setter((value) =>
			Math.max(0.25, Math.min(4, +(value + amount).toFixed(2))),
		);
	const onCanvasWheel = (e) => {
		e.preventDefault();
		zoomBy(setLevelZoom, e.deltaY < 0 ? 0.25 : -0.25);
	};
	const onPickerWheel = (e) => {
		e.preventDefault();
		e.stopPropagation();
		zoomBy(setPickerZoom, e.deltaY < 0 ? 0.25 : -0.25);
	};
	const objectAt = (point) => {
		for (const type of [...OBJECT_TYPES].reverse())
			for (const item of currentDoc[objectBucket(type)] || []) {
				const w = item.collision?.w || t,
					h = item.collision?.h || t;
				if (
					point.x >= item.x &&
					point.x <= item.x + w &&
					point.y >= item.y &&
					point.y <= item.y + h
				)
					return { type, item };
			}
		return null;
	};
	const objectPointerDown = (e) => {
		const point = canvasPoint(e),
			hit = objectAt(point);
		if (!hit) {
			setObjectSelection(null);
			return;
		}
		setObjectSelection({ type: hit.type, id: hit.item.id });
		setObjectDrag({
			type: hit.type,
			id: hit.item.id,
			start: point,
			origin: { x: hit.item.x, y: hit.item.y },
			axis: e.shiftKey ? "x" : e.altKey ? "y" : null,
		});
		e.currentTarget.setPointerCapture(e.pointerId);
	};
	const objectPointerMove = (e) => {
		if (!objectDrag) return;
		const point = canvasPoint(e),
			dx = point.x - objectDrag.start.x,
			dy = point.y - objectDrag.start.y,
			axis = objectDrag.axis || (Math.abs(dx) >= Math.abs(dy) ? "x" : "y");
		updateSelectedObject({
			x: Math.max(
				0,
				Math.round((objectDrag.origin.x + (axis === "x" ? dx : 0)) / t) * t,
			),
			y: Math.max(
				0,
				Math.round((objectDrag.origin.y + (axis === "y" ? dy : 0)) / t) * t,
			),
		});
	};
	const objectPointerUp = (e) => {
		setObjectDrag(null);
		e.currentTarget.releasePointerCapture?.(e.pointerId);
	};
	const removeObjectAt = (point) => {
		const hit = objectAt(point);
		if (!hit) return false;
		updateCurrentDoc((doc) => ({
			...doc,
			[objectBucket(hit.type)]: doc[objectBucket(hit.type)].filter(
				(item) => item.id !== hit.item.id,
			),
		}));
		if (objectSelection?.id === hit.item.id) setObjectSelection(null);
		return true;
	};
	const updateSelection = (e) => {
		const [x, y] = cell(e),
			s = selectionStart || { x, y };
		setSelection({
			x: Math.min(s.x, x),
			y: Math.min(s.y, y),
			w: Math.abs(x - s.x) + 1,
			h: Math.abs(y - s.y) + 1,
		});
	};
	const resizeSelection = (dw, dh) => {
		if (!selection) return;
		setSelection((s) => ({
			...s,
			w: Math.max(1, s.w + dw),
			h: Math.max(1, s.h + dh),
		}));
		setStatus("Level selection resized with Shift + arrows.");
	};
	const copySelection = () => {
		const area = selection || { x: lastTile.x, y: lastTile.y, w: 1, h: 1 },
			value = placedRef.current.get(key(area.x, area.y));
		if (!value && !selection)
			return setStatus("No tile at the keyboard cursor to copy.");
		clipboardSizeRef.current = { w: area.w, h: area.h };
		clipboardRef.current = copyTiles(placedRef.current, area);
		setStatus(`Copied ${area.w}×${area.h} tile area.`);
	};
	const cutSelection = () => {
		const area = selection || { x: lastTile.x, y: lastTile.y, w: 1, h: 1 },
			value = placedRef.current.get(key(area.x, area.y));
		if (!value && !selection)
			return setStatus("No tile at the keyboard cursor to cut.");
		commit();
		clipboardSizeRef.current = { w: area.w, h: area.h };
		clipboardRef.current = [];
		for (let y = area.y; y < area.y + area.h; y++)
			for (let x = area.x; x < area.x + area.w; x++) {
				const k = key(x, y),
					v = placedRef.current.get(k);
				if (v)
					clipboardRef.current.push({ x: x - area.x, y: y - area.y, value: v });
				placedRef.current.delete(k);
				collisionsRef.current.delete(k);
			}
		resolveAutotile();
		bump();
		setStatus(`Cut ${area.w}×${area.h} tile area.`);
	};
	const pasteSelection = () => {
		if (!clipboardRef.current.length) return setStatus("Nothing copied.");
		const { w, h } = clipboardSizeRef.current;
		commit();
		pasteTiles(
			placedRef.current,
			clipboardRef.current,
			lastTile,
			levelWidth,
			levelHeight,
		);
		if (mode === "select") setSelection({ x: lastTile.x, y: lastTile.y, w, h });
		resolveAutotile();
		bump();
		setStatus("Pasted tile selection.");
	};
	const deleteSelection = () => {
		if (!selection) return setStatus("Use Select mode to choose tiles first.");
		commit();
		deleteTiles(placedRef.current, collisionsRef.current, selection);
		resolveAutotile();
		bump();
		setStatus("Deleted selected tiles.");
	};
	const moveSelection = (dx, dy) => {
		if (!selection) return false;
		const x = selection.x + dx,
			y = selection.y + dy;
		if (
			x < 0 ||
			y < 0 ||
			x + selection.w > levelWidth ||
			y + selection.h > levelHeight
		)
			return setStatus("Selection is already at the level edge.");
		commit();
		const moved = moveTiles(
			placedRef.current,
			collisionsRef.current,
			selection,
			dx,
			dy,
		);
		setSelection((s) => ({ ...s, ...moved }));
		setLastTile((p) => ({ x: p.x + dx, y: p.y + dy }));
		resolveAutotile();
		bump();
		return true;
	};
	const dropper = (e) => {
		const [x, y] = cell(e),
			placed = tilesFor(placedRef.current.get(key(x, y))).at(-1),
			asset = placed?.asset || placed;
		if (!asset) return setStatus("No placed tile under the dropper.");
		setSelected(asset);
		setSelectedRegion({ x: placed.sx ?? 0, y: placed.sy ?? 0, w: t, h: t });
		setMode("brush");
		setEraser(false);
		setStatus(
			`Picked ${asset.name} tile (${Math.floor((placed.sx ?? 0) / t)}, ${Math.floor((placed.sy ?? 0) / t)}).`,
		);
	};
	const paint = (e) => {
		if (activeLayerDoc?.locked || activeLayerDoc?.visible === false)
			return setStatus("Unlock and show the active layer before painting.");
		const [x, y] = cell(e),
			k = key(x, y);
		if (k === lastPaintRef.current) return;
		lastPaintRef.current = k;
		if (buttonRef.current === 2 || mode === "eraser" || eraser) {
			deleteTiles(placedRef.current, collisionsRef.current, {
				x,
				y,
				w: 1,
				h: 1,
			});
			resolveAutotileAround(x, y);
		} else if (collision) collisionsRef.current.add(k);
		else stamp(x, y);
		setLastTile({ x, y });
		bump();
	};
	const drawLine = (from, to) => {
		const dx = Math.abs(to.x - from.x),
			dy = Math.abs(to.y - from.y);
		const sx = from.x < to.x ? 1 : -1,
			sy = from.y < to.y ? 1 : -1;
		let x = from.x,
			y = from.y,
			error = dx - dy;
		while (true) {
			stamp(x, y);
			if (x === to.x && y === to.y) break;
			const twice = error * 2;
			if (twice > -dy) {
				error -= dy;
				x += sx;
			}
			if (twice < dx) {
				error += dx;
				y += sy;
			}
		}
	};
	const fill = (origin) => {
		const target = layersFor(placedRef.current.get(key(origin.x, origin.y)))[
			activeLayer
		];
		const same = (tile) =>
			tile &&
			target &&
			(tile.asset || tile) === (target.asset || target) &&
			(target.autotile
				? tile.autotile?.x === target.autotile.x &&
					tile.autotile?.y === target.autotile.y
				: tile.sx === target.sx && tile.sy === target.sy);
		if (!target) {
			const stack = [origin],
				seen = new Set();
			while (stack.length) {
				const point = stack.pop(),
					cellKey = key(point.x, point.y);
				if (
					seen.has(cellKey) ||
					point.x < 0 ||
					point.y < 0 ||
					point.x >= levelWidth ||
					point.y >= levelHeight ||
					layersFor(placedRef.current.get(cellKey))[activeLayer]
				)
					continue;
				seen.add(cellKey);
				stamp(point.x, point.y);
				stack.push(
					{ x: point.x + 1, y: point.y },
					{ x: point.x - 1, y: point.y },
					{ x: point.x, y: point.y + 1 },
					{ x: point.x, y: point.y - 1 },
				);
			}
			return;
		}
		const stack = [origin],
			seen = new Set();
		while (stack.length) {
			const point = stack.pop(),
				cellKey = key(point.x, point.y),
				tile = layersFor(placedRef.current.get(cellKey))[activeLayer];
			if (seen.has(cellKey) || !same(tile)) continue;
			seen.add(cellKey);
			stamp(point.x, point.y);
			stack.push(
				{ x: point.x + 1, y: point.y },
				{ x: point.x - 1, y: point.y },
				{ x: point.x, y: point.y + 1 },
				{ x: point.x, y: point.y - 1 },
			);
		}
	};
	const applyShape = (from, to) => {
		if (mode === "line") drawLine(from, to);
		else
			for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++)
				for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++)
					stamp(x, y);
	};
	const onDown = (e) => {
		if (spaceRef.current && e.button === 0) {
			e.preventDefault();
			const stage = stageRef.current;
			panRef.current = {
				x: e.clientX,
				y: e.clientY,
				left: stage?.scrollLeft || 0,
				top: stage?.scrollTop || 0,
			};
			e.currentTarget.setPointerCapture(e.pointerId);
			e.currentTarget.style.cursor = "grabbing";
			return;
		}
		if (objectMode) return objectPointerDown(e);
		if (![0, 2].includes(e.button) || (mode === "select" && e.button !== 0))
			return;
		e.preventDefault();
		setCursorActive(false);
		if (e.altKey && e.button === 0) {
			dropper(e);
			return;
		}
		buttonRef.current = e.button;
		paintingRef.current = true;
		lastPaintRef.current = "";
		e.currentTarget.setPointerCapture(e.pointerId);
		if (mode === "select") {
			const [x, y] = cell(e);
			setLastTile({ x, y });
			setSelectionStart({ x, y });
			setSelection({ x, y, w: 1, h: 1 });
		} else if (mode === "fill") {
			if (activeLayerDoc?.locked || activeLayerDoc?.visible === false)
				return setStatus("Unlock and show the active layer before painting.");
			commit();
			fill(
				Object.fromEntries([
					["x", cell(e)[0]],
					["y", cell(e)[1]],
				]),
			);
			bump();
		} else if (mode === "line" || mode === "rectangle") {
			toolStartRef.current = Object.fromEntries([
				["x", cell(e)[0]],
				["y", cell(e)[1]],
			]);
		} else if (mode === "eraser" || eraser || e.button === 2) {
			const [x, y] = cell(e);
			commit();
			removeObjectAt(canvasPoint(e));
			deleteTiles(placedRef.current, collisionsRef.current, {
				x,
				y,
				w: 1,
				h: 1,
			});
			resolveAutotileAround(x, y);
			setLastTile({ x, y });
			bump();
		} else {
			commit();
			paint(e);
		}
	};
	const onStageDown = (e) => {
		if (!spaceRef.current || e.target === canvasRef.current || e.button !== 0)
			return;
		e.preventDefault();
		panRef.current = {
			x: e.clientX,
			y: e.clientY,
			left: stageRef.current?.scrollLeft || 0,
			top: stageRef.current?.scrollTop || 0,
		};
		e.currentTarget.setPointerCapture(e.pointerId);
		e.currentTarget.style.cursor = "grabbing";
	};
	const onMove = (e) => {
		if (panRef.current) {
			e.preventDefault();
			const stage = stageRef.current;
			if (stage) {
				stage.scrollLeft = panRef.current.left - (e.clientX - panRef.current.x);
				stage.scrollTop = panRef.current.top - (e.clientY - panRef.current.y);
			}
			return;
		}
		return objectMode
			? objectPointerMove(e)
			: paintingRef.current &&
					(mode === "select" ? updateSelection(e) : paint(e));
	};
	const onUp = (e) => {
		if (panRef.current) {
			panRef.current = null;
			e.currentTarget.style.cursor = "crosshair";
			e.currentTarget.releasePointerCapture?.(e.pointerId);
			return;
		}
		if (
			!objectMode &&
			paintingRef.current &&
			(mode === "line" || mode === "rectangle") &&
			toolStartRef.current
		) {
			const [x, y] = cell(e);
			commit();
			applyShape(toolStartRef.current, { x, y });
			toolStartRef.current = null;
			bump();
		}
		return objectMode
			? objectPointerUp(e)
			: ((paintingRef.current = false),
				setSelectionStart(null),
				e.currentTarget.releasePointerCapture?.(e.pointerId));
	};
	const importAsset = async (file) => {
		const form = new FormData();
		form.append("image", file);
		try {
			const response = await fetch("/api/assets", {
				method: "POST",
				body: form,
			});
			if (!response.ok) throw new Error();
			const blob = await response.blob();
			const name = file.name.replace(/\.[^.]+$/, "") + ".png";
			addAsset(blob, name, true, assetCategory);
			return {
				file: new File([blob], name, { type: "image/png" }),
				removed: true,
			};
		} catch {
			addAsset(file, file.name, true, assetCategory);
			return { file, removed: false };
		}
	};
	const onFiles = async (e) => {
		const files = [...e.target.files];
		e.target.value = "";
		if (!files.length) return;
		setStatus(
			`Removing backgrounds from ${files.length} asset${files.length === 1 ? "" : "s"}…`,
		);
		const imported = await Promise.all(files.map(importAsset));
		setSourceFile(imported.at(-1).file);
		const removed = imported.filter((item) => item.removed).length;
		setStatus(
			`Imported ${files.length} asset${files.length === 1 ? "" : "s"}; removed ${removed} background${removed === 1 ? "" : "s"}.`,
		);
	};
	const pickerCell = (e) => {
		const r = e.currentTarget.getBoundingClientRect();
		return {
			x: Math.max(
				0,
				Math.min(
					Math.floor(selected.image.width / t) - 1,
					Math.floor(
						(((e.clientX - r.left) / r.width) * selected.image.width) / t,
					),
				),
			),
			y: Math.max(
				0,
				Math.min(
					Math.floor(selected.image.height / t) - 1,
					Math.floor(
						(((e.clientY - r.top) / r.height) * selected.image.height) / t,
					),
				),
			),
		};
	};
	const beginPicker = (e) => {
		if (!selected) return;
		e.preventDefault();
		e.currentTarget.setPointerCapture?.(e.pointerId);
		const p = pickerCell(e);
		setPickerDragStart(p);
		setSelectedRegion({ x: p.x * t, y: p.y * t, w: t, h: t });
		setStatus(`Selected tile ${p.x + 1},${p.y + 1}.`);
	};
	const dragPicker = (e) => {
		if (!pickerDragStart) return;
		e.preventDefault();
		const p = pickerCell(e),
			x = Math.min(p.x, pickerDragStart.x),
			y = Math.min(p.y, pickerDragStart.y),
			w = Math.abs(p.x - pickerDragStart.x) + 1,
			h = Math.abs(p.y - pickerDragStart.y) + 1;
		setSelectedRegion({ x: x * t, y: y * t, w: w * t, h: h * t });
		setStatus(`Selected ${w}×${h} tile region.`);
	};
	const endPicker = (e) => {
		e.currentTarget.releasePointerCapture?.(e.pointerId);
		setPickerDragStart(null);
	};
	const stamp = (x, y) => {
		const defaultTile =
			activeLayerDoc?.type === "autotile"
				? activeLayerDoc.rule?.defaultTile
				: null;
		const baseAsset = defaultTile
			? assetsRef.current.find((asset) => asset.name === defaultTile.assetId)
			: selected;
		if (!baseAsset) return;
		const region = defaultTile
			? { x: defaultTile.x, y: defaultTile.y, w: t, h: t }
			: selectedRegion;
		for (const source of tilesInRegion(region, t)) {
			const dx = x + source.x,
				dy = y + source.y;
			if (dx < 0 || dy < 0 || dx >= levelWidth || dy >= levelHeight) continue;
			placedRef.current.set(
				key(dx, dy),
				putTile(placedRef.current.get(key(dx, dy)), activeLayer, {
					asset: baseAsset,
					sx: source.sx,
					sy: source.sy,
					attributes: tileAttributes,
					autotile:
						activeLayerDoc?.type === "autotile"
							? { x: region.x, y: region.y }
							: undefined,
				}),
			);
			resolveAutotileAround(dx, dy);
		}
	};
	const resolveAutotileAt = (x, y) => {
		const cellKey = key(x, y),
			tile = layersFor(placedRef.current.get(cellKey))[activeLayer];
		if (!tile?.autotile) return;
		const base = tile.autotile,
			asset = tile.asset || tile;
		const connected = (nx, ny) => {
			const other = layersFor(placedRef.current.get(key(nx, ny)))[activeLayer];
			return (
				other?.autotile &&
				(other.asset || other) === asset &&
				other.autotile.x === base.x &&
				other.autotile.y === base.y
			);
		};
		const left = connected(x - 1, y),
			right = connected(x + 1, y),
			up = connected(x, y - 1),
			down = connected(x, y + 1);
		const neighbors = AUTOTILE_OFFSETS.map(([dx, dy], index) =>
			index === 4 ? true : connected(x + dx, y + dy),
		);
		const matches = (rule) =>
			rule.pattern?.every(
				(state, index) =>
					state === "ignored" ||
					(state === "required" ? neighbors[index] : !neighbors[index]),
			);
		const explicit = activeLayerDoc?.rule?.rules?.find(
			(rule) => rule.variant && matches(rule),
		);
		const column = explicit
			? explicit.variant.x
			: left && right
				? 1
				: left
					? 2
					: right
						? 0
						: 1;
		const row = explicit
			? explicit.variant.y
			: up && down
				? 1
				: up
					? 2
					: down
						? 0
						: 1;
		const hasThreeByThree =
			base.x + t * 3 <= asset.image.width &&
			base.y + t * 3 <= asset.image.height;
		placedRef.current.set(
			cellKey,
			putTile(placedRef.current.get(cellKey), activeLayer, {
				...tile,
				sx: hasThreeByThree ? base.x + column * t : base.x,
				sy: hasThreeByThree ? base.y + row * t : base.y,
			}),
		);
	};
	const resolveAutotileAround = (x, y) => {
		if (activeLayerDoc?.type !== "autotile") return;
		for (const [dx, dy] of [
			[0, 0],
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		])
			resolveAutotileAt(x + dx, y + dy);
	};
	const resolveAutotile = () => {
		if (activeLayerDoc?.type !== "autotile") return;
		for (const cellKey of placedRef.current.keys()) {
			const [x, y] = cellKey.split(",").map(Number);
			resolveAutotileAt(x, y);
		}
	};
	const fix = async () => {
		if (!sourceFile) return setStatus("Choose an image first.");
		if (!["localhost", "127.0.0.1"].includes(window.location.hostname))
			return setStatus(
				"Pixel fixer is local-only. Run ./run.sh for this tool.",
			);
		setStatus("Fixing grid locally…");
		const fd = new FormData();
		fd.append("image", sourceFile);
		try {
			const response = await fetch("/api/fix", { method: "POST", body: fd });
			if (!response.ok) return setStatus(await response.text());
			const blob = await response.blob();
			setSourceFile(new File([blob], "fixed.png", { type: "image/png" }));
			addAsset(blob, "fixed.png");
			setStatus("Fixed asset imported.");
		} catch {
			setStatus(
				"Could not reach the local pixel fixer. Run ./run.sh and retry.",
			);
		}
	};
	const eraseBackground = async () => {
		if (!sourceFile) return setStatus("Choose an image first.");
		if (!["localhost", "127.0.0.1"].includes(window.location.hostname))
			return setStatus(
				"Background removal is available only through ./run.sh.",
			);
		setStatus("Removing background…");
		try {
			const fd = new FormData();
			fd.append("image", sourceFile);
			const response = await fetch("/api/remove-background", {
				method: "POST",
				body: fd,
			});
			if (!response.ok) return setStatus(await response.text());
			const blob = await response.blob();
			setSourceFile(
				new File([blob], "background-removed.png", { type: "image/png" }),
			);
			addAsset(blob, "background-removed.png");
			setStatus("Background removed and asset imported.");
		} catch {
			setStatus("Could not remove the background.");
		}
	};

	useEffect(() => {
		const keydown = (e) => {
			const editable = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
			if (e.code === "Space" && !editable) {
				e.preventDefault();
				spaceRef.current = true;
				return;
			}
			const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
				k = e.key.toLowerCase(),
				mod = e.metaKey || e.ctrlKey;
			if (e.key === "Control") {
				setCursor(lastTile);
				setCursorActive(true);
				return;
			}
			if (mod && k === "z") {
				e.preventDefault();
				undo();
				return;
			}
			if (mod && k === "y") {
				e.preventDefault();
				redo();
				return;
			}
			if (mod && arrows.includes(e.key)) {
				e.preventDefault();
				if (selection) {
					moveSelection(
						e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
						e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0,
					);
					return;
				}
				const maxX = levelWidth - 1,
					maxY = levelHeight - 1,
					next = { ...cursor };
				if (e.key === "ArrowLeft") next.x = Math.max(0, next.x - 1);
				if (e.key === "ArrowRight") next.x = Math.min(maxX, next.x + 1);
				if (e.key === "ArrowUp") next.y = Math.max(0, next.y - 1);
				if (e.key === "ArrowDown") next.y = Math.min(maxY, next.y + 1);
				setCursor(next);
				setCursorActive(true);
				setStatus("Keyboard paint cursor active.");
				commit();
				const cellKey = key(next.x, next.y);
				if (eraser) {
					deleteTiles(placedRef.current, collisionsRef.current, {
						x: next.x,
						y: next.y,
						w: 1,
						h: 1,
					});
				} else if (collision) collisionsRef.current.add(cellKey);
				else if (selected)
					placedRef.current.set(
						cellKey,
						putTile(placedRef.current.get(cellKey), activeLayer, {
							asset: selected,
							sx: selectedRegion.x,
							sy: selectedRegion.y,
						}),
					);
				setLastTile(next);
				bump();
				return;
			}
			if (k === "f3") {
				e.preventDefault();
				setDebug((v) => !v);
				return;
			}
			if (e.altKey && !mod && e.code === "KeyL" && !editable) {
				e.preventDefault();
				setLayerPanelOpen((v) => !v);
				return;
			}
			if (k === "escape") {
				setMenuOpen(false);
				setPickerDragStart(null);
				setMode("brush");
				setEraser(false);
				setSelection(null);
				return;
			}
			if (mod && k === "x") {
				e.preventDefault();
				cutSelection();
			} else if (mod && k === "c") {
				e.preventDefault();
				copySelection();
			} else if (mod && k === "v") {
				e.preventDefault();
				pasteSelection();
			} else if ((k === "delete" || k === "backspace") && selection) {
				e.preventDefault();
				deleteSelection();
			} else if (e.shiftKey && !mod && selection && arrows.includes(e.key)) {
				e.preventDefault();
				resizeSelection(
					e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0,
					e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0,
				);
			} else if (!mod && k === "b") {
				setMode("brush");
				setEraser(false);
				setStatus("Brush mode.");
			} else if (!mod && k === "e") {
				setMode("eraser");
				setEraser(true);
				setStatus("Eraser mode.");
			} else if (!mod && k === "m") {
				setMode("select");
				setEraser(false);
				setStatus("Select mode: drag a tile rectangle.");
			} else if (!mod && k === "r") {
				setMode("rectangle");
				setEraser(false);
				setStatus("Rectangle mode.");
			} else if (!mod && k === "i") {
				setMode("line");
				setEraser(false);
				setStatus("Line mode.");
			} else if (!mod && k === "f") {
				setMode("fill");
				setEraser(false);
				setStatus("Fill mode.");
			}
		};
		const keyup = (e) => {
			if (e.code === "Space") spaceRef.current = false;
			if (e.key === "Control") setCursorActive(false);
		};
		const blur = () => {
			spaceRef.current = false;
			panRef.current = null;
		};
		document.addEventListener("keydown", keydown);
		document.addEventListener("keyup", keyup);
		window.addEventListener("blur", blur);
		return () => {
			document.removeEventListener("keydown", keydown);
			document.removeEventListener("keyup", keyup);
			window.removeEventListener("blur", blur);
		};
	}, [
		cursor,
		t,
		eraser,
		collision,
		selected,
		selectedRegion,
		activeLayer,
		lastTile,
		selection,
	]);

	const deleteAsset = (asset) => {
		commit();
		for (const [k, cell] of placedRef.current) {
			const layers = Object.fromEntries(
				(Object.entries(layersFor(cell)) as [string, any][]).filter(
					([, tile]) => (tile.asset || tile) !== asset,
				),
			);
			if (Object.keys(layers).length) placedRef.current.set(k, layers);
			else placedRef.current.delete(k);
		}
		assetsRef.current = assetsRef.current.filter((a) => a !== asset);
		setAssets(assetsRef.current);
		removePersistedAsset(dbRef.current, asset.name);
		if (selected === asset) select(null);
		bump();
		setStatus(`Deleted ${asset.name}.`);
	};
	const download = (name, text) => {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
		a.download = name;
		a.click();
	};
	const exportLevelPng = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.toBlob((blob) => {
			if (!blob) return;
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${level}-level.png`;
			link.click();
			setStatus(`Downloaded ${level}-level.png.`);
		}, "image/png");
	};
	const exportLevelJson = () => {
		download(
			currentDoc.metadata.id + ".level.json",
			JSON.stringify(
				{
					...currentDoc,
					...serializeSketch(
						placedRef.current,
						exportCollisions,
						documentLayers,
					),
				},
				null,
				2,
			),
		);
		setStatus("Downloaded structured level data.");
	};
	const exportPhaserTilemap = () => {
		const tilemap = createPhaserTilemap({
			placed: placedRef.current,
			collisions: exportCollisions,
			levelWidth,
			levelHeight,
			layers: documentLayers,
			tileSize: t,
		});
		download(
			currentDoc.metadata.id + ".phaser.tilemap.json",
			JSON.stringify(tilemap, null, 2),
		);
		setStatus("Downloaded Phaser tilemap JSON.");
	};
	const exportScene = (name) => {
		const used = [
				...new Set(
					[...placedRef.current.values()]
						.flatMap((cell) =>
							tilesFor(
								cell,
								documentLayers.filter((layer) => layer.visible),
							),
						)
						.map((v) => v.asset || v),
				),
			],
			ids = new Map(used.map((a, i) => [a, `Texture_${i + 1}`])),
			lines = [`[gd_scene load_steps=${used.length + 2} format=3]`];
		for (const a of used)
			lines.push(
				"",
				`[ext_resource type="Texture2D" path="res://art/${a.name}" id="${ids.get(a)}"]`,
			);
		lines.push(
			"",
			'[sub_resource type="RectangleShape2D" id="RectangleShape2D_1"]',
			`size = Vector2(${t}, ${t})`,
			"",
			'[node name="Level" type="Node2D"]',
			"texture_filter = 1",
		);
		let i = 0;
		for (const [k, cell] of placedRef.current) {
			const [x, y] = k.split(",").map(Number);
			for (const layer of documentLayers.filter((layer) => layer.visible)) {
				const placed = layersFor(cell)[layer.id];
				if (!placed) continue;
				const a = placed.asset || placed,
					sx = placed.sx ?? 0,
					sy = placed.sy ?? 0;
				lines.push(
					`\n[node name="${a.name.replace(/\W/g, "_")}_${i++}" type="Sprite2D" parent="."]`,
					`texture = ExtResource("${ids.get(a)}")`,
					`region_enabled = true`,
					`region_rect = Rect2(${sx}, ${sy}, ${t}, ${t})`,
					`position = Vector2(${x * t + t / 2}, ${y * t + t / 2})`,
				);
				for (const [attribute, value] of Object.entries(
					placed.attributes || {},
				))
					if (value !== undefined)
						lines.push(`metadata/${attribute} = ${JSON.stringify(value)}`);
			}
		}
		for (const k of exportCollisions as Set<string>) {
			const [x, y] = k.split(",").map(Number);
			lines.push(
				`\n[node name="Collision_${x}_${y}" type="StaticBody2D" parent="."]`,
				`position = Vector2(${x * t + t / 2}, ${y * t + t / 2})`,
				`[node name="CollisionShape2D" type="CollisionShape2D" parent="Collision_${x}_${y}"]`,
				'shape = SubResource("RectangleShape2D_1")',
			);
		}
		download(name, lines.join("\n"));
		setStatus(`Downloaded ${name}.`);
	};

	return (
		<>
			<header>
				<h1>OpenTile</h1>
				<button
					className="header-menu"
					aria-haspopup="dialog"
					aria-expanded={menuOpen}
					onClick={() => setMenuOpen(true)}
				>
					<Menu size={16} /> Menu
				</button>
			</header>
			{menuOpen && (
				<div
					className="editor-menu-modal"
					role="dialog"
					aria-modal="true"
					aria-label="Editor menu"
					onPointerDown={(event) => {
						if (event.target === event.currentTarget) setMenuOpen(false);
					}}
				>
					<div className="editor-menu-card">
						<div className="editor-menu-head">
							<strong>Editor menu</strong>
							<button
								onClick={() => setMenuOpen(false)}
								aria-label="Close editor menu"
							>
								×
							</button>
						</div>
						<section>
							<h2>Project</h2>
							<div className="menu-actions">
								<button
									onClick={() => {
										const id = prompt(
											"Level id",
											"level-" + (Object.keys(levelDocs).length + 1),
										);
										if (!id || levelDocs[id]) return;
										const docs = { ...levelDocs, [id]: newLevelDoc(id, id) };
										levelsRef.current[id] = {
											placed: new Map(),
											collisions: new Set(),
										};
										persistLevels(docs);
										switchLevel(id);
										setMenuOpen(false);
									}}
								>
									<Plus size={15} /> New level
								</button>
								<button
									onClick={() => {
										persistSketch();
										setStatus("Saved " + currentDoc.metadata.name + ".");
									}}
								>
									<Save size={15} /> Save
								</button>
								<button
									onClick={() => {
										const id = prompt(
											"Save level as",
											currentDoc.metadata.id + "-copy",
										);
										if (!id || levelDocs[id]) return;
										const sketch = serializeSketch(
											placedRef.current,
											collisionsRef.current,
											documentLayers,
										);
										persistLevels({
											...levelDocs,
											[id]: {
												...currentDoc,
												...sketch,
												metadata: { ...currentDoc.metadata, id, name: id },
											},
										});
										levelsRef.current[id] = {
											placed: new Map(placedRef.current),
											collisions: new Set(collisionsRef.current),
										};
										setLevel(id);
										setStatus("Saved as " + id + ".");
										setMenuOpen(false);
									}}
								>
									<FilePlus2 size={15} /> Save as
								</button>
							</div>
						</section>
						<section>
							<h2>Map</h2>
							<div className="menu-fields">
								<label>
									Width{" "}
									<input
										type="number"
										min="24"
										value={levelWidth}
										onChange={(e) =>
											updateCurrentDoc((doc) => ({
												...doc,
												metadata: {
													...doc.metadata,
													width: Math.max(24, Number(e.target.value) || 24),
												},
											}))
										}
									/>
								</label>
								<label>
									Height{" "}
									<input
										type="number"
										min="1"
										value={levelHeight}
										onChange={(e) =>
											updateCurrentDoc((doc) => ({
												...doc,
												metadata: {
													...doc.metadata,
													height: Math.max(1, Number(e.target.value) || 1),
												},
											}))
										}
									/>
								</label>
							</div>
							<div className="menu-actions menu-resize" aria-label="Resize map">
								<button
									onClick={() =>
										updateCurrentDoc((doc) => ({
											...doc,
											metadata: {
												...doc.metadata,
												width: Math.max(24, levelWidth - 1),
											},
										}))
									}
								>
									− Width
								</button>
								<button
									onClick={() =>
										updateCurrentDoc((doc) => ({
											...doc,
											metadata: { ...doc.metadata, width: levelWidth + 1 },
										}))
									}
								>
									+ Width
								</button>
								<button
									onClick={() =>
										updateCurrentDoc((doc) => ({
											...doc,
											metadata: {
												...doc.metadata,
												height: Math.max(1, levelHeight - 1),
											},
										}))
									}
								>
									− Height
								</button>
								<button
									onClick={() =>
										updateCurrentDoc((doc) => ({
											...doc,
											metadata: { ...doc.metadata, height: levelHeight + 1 },
										}))
									}
								>
									+ Height
								</button>
							</div>
						</section>
						<section>
							<h2>Canvas</h2>
							<label>
								Tile size{" "}
								<input
									type="number"
									value={tileSize}
									min="8"
									step="8"
									onChange={(e) => setTileSize(e.target.value)}
								/>
							</label>
							<label className="menu-check">
								<input
									type="checkbox"
									checked={collision}
									onChange={(e) => setCollision(e.target.checked)}
								/>{" "}
								Paint collision
							</label>
							<label className="menu-check">
								<input
									type="checkbox"
									checked={grid}
									onChange={(e) => setGrid(e.target.checked)}
								/>{" "}
								Grid
							</label>
							<label className="menu-check">
								<input
									type="checkbox"
									checked={debug}
									onChange={(e) => setDebug(e.target.checked)}
								/>{" "}
								Debug
							</label>
						</section>
						<section>
							<h2>Export</h2>
							<div className="menu-actions">
								<button onClick={exportLevelPng}>
									<Download size={15} /> PNG
								</button>
								<button onClick={exportLevelJson}>
									<FileJson size={15} /> Level JSON
								</button>
								<button onClick={exportPhaserTilemap}>
									<FileJson size={15} /> Phaser JSON
								</button>
								<button
									onClick={() =>
										assets.forEach((asset) => {
											const link = document.createElement("a");
											link.href = asset.url;
											link.download = asset.name;
											link.click();
										})
									}
								>
									<Download size={15} /> Assets
								</button>
								<button onClick={() => exportScene("level.tscn")}>
									<Box size={15} /> Godot scene
								</button>
							</div>
						</section>
					</div>
				</div>
			)}
			{rulesLayer && (
				<div
					className="autotile-rules-modal"
					role="dialog"
					aria-modal="true"
					aria-label={`${rulesLayer.name} rules`}
				>
					<div className="autotile-rules-card">
						<div className="autotile-rules-head">
							<strong>{rulesLayer.name} Rules</strong>
							<button
								aria-label="Close autotile rules"
								onClick={() => setRulesLayerId(null)}
							>
								×
							</button>
						</div>
						<section className="autotile-defaults">
							<h2>Default Tiles</h2>
							<p className="autotile-help">
								This section sets the default tile used as the base for this
								autotile layer.
							</p>
							<button
								className="autotile-default-preview"
								aria-label="Set default autotile tile"
								onClick={() => setDefaultAutotileTile(rulesLayer.id)}
							>
								{rulesDefaultAsset ? (
									<span
										className="autotile-tile-preview"
										style={{
											backgroundImage: `url(${rulesDefaultAsset.url})`,
											backgroundPosition: `${-rulesDefaultTile.x}px ${-rulesDefaultTile.y}px`,
											backgroundSize: `${rulesDefaultAsset.image.width}px ${rulesDefaultAsset.image.height}px`,
										}}
									/>
								) : (
									<span className="autotile-placeholder">
										Click a selected tile
									</span>
								)}
								<span className="autotile-default-copy">
									<strong>
										{rulesDefaultAsset
											? rulesDefaultTile.assetId
											: "Empty default tile"}
									</strong>
									<small>
										Click a tile in the editor, then click here to set it as the
										base.
									</small>
								</span>
							</button>
						</section>
						<p className="autotile-help autotile-rule-example">
							<strong>Rule example</strong> A rule checks the tile's 3×3
							surroundings. Cycle each cell to mark tiles that must exist, must
							be empty, or are ignored. When the pattern matches, its variant is
							placed seamlessly.
						</p>
						{(rulesLayer.rule?.rules || [newAutotileRule(0)]).map((rule) => (
							<section className="autotile-rule" key={rule.id}>
								<div className="autotile-rule-head">
									<input
										aria-label={`${rule.name} name`}
										value={rule.name}
										onChange={(event) =>
											updateAutotileRule(rulesLayer.id, rule.id, {
												name: event.target.value,
											})
										}
									/>
									<button
										aria-label={`Remove ${rule.name}`}
										onClick={() =>
											updateAutotileRules(rulesLayer.id, (config) => ({
												...config,
												rules: config.rules.filter(
													(item) => item.id !== rule.id,
												),
											}))
										}
									>
										×
									</button>
								</div>
								<div className="autotile-rule-body">
									<div
										className="autotile-pattern-grid"
										aria-label={`${rule.name} 3 by 3 pattern`}
									>
										{rule.pattern.map((state, cell) => (
											<button
												key={cell}
												className={`pattern-${state}`}
												aria-label={`${rule.name} cell ${cell + 1}: ${state}`}
												onClick={() =>
													cycleAutotileRuleCell(rulesLayer.id, rule.id, cell)
												}
											>
												{cell === 4 ? "•" : ""}
											</button>
										))}
									</div>
									<div className="autotile-variant">
										<small>Variant tile</small>
										<div className="autotile-variant-fields">
											<label>
												X{" "}
												<select
													value={rule.variant?.x ?? 1}
													onChange={(event) =>
														updateAutotileRule(rulesLayer.id, rule.id, {
															variant: {
																x: Number(event.target.value),
																y: rule.variant?.y ?? 1,
															},
														})
													}
												>
													{[0, 1, 2].map((value) => (
														<option key={value}>{value}</option>
													))}
												</select>
											</label>
											<label>
												Y{" "}
												<select
													value={rule.variant?.y ?? 1}
													onChange={(event) =>
														updateAutotileRule(rulesLayer.id, rule.id, {
															variant: {
																x: rule.variant?.x ?? 1,
																y: Number(event.target.value),
															},
														})
													}
												>
													{[0, 1, 2].map((value) => (
														<option key={value}>{value}</option>
													))}
												</select>
											</label>
										</div>
										{rulesDefaultAsset && (
											<span
												className="autotile-rule-preview"
												style={{
													backgroundImage: `url(${rulesDefaultAsset.url})`,
													backgroundPosition: `${-(rulesDefaultTile.x + (rule.variant?.x ?? 1) * t)}px ${-(rulesDefaultTile.y + (rule.variant?.y ?? 1) * t)}px`,
													backgroundSize: `${rulesDefaultAsset.image.width}px ${rulesDefaultAsset.image.height}px`,
												}}
											/>
										)}
									</div>
								</div>
							</section>
						))}
						<button
							className="autotile-add-rule"
							onClick={() => addAutotileRule(rulesLayer.id)}
						>
							<Plus size={14} /> Rule
						</button>
						<div className="autotile-rules-actions">
							<button onClick={() => saveAutotileRules(rulesLayer)}>
								<Save size={14} /> Save
							</button>
							<button onClick={() => loadAutotileRules(rulesLayer)}>
								<Download size={14} /> Load
							</button>
							<button
								title="Click each cell to cycle ignored, required, and empty states."
								aria-label="Autotile rules help"
							>
								?
							</button>
						</div>
					</div>
				</div>
			)}
			<main>
				<AssetLibrary
					assetCategory={assetCategory}
					assets={assets}
					categories={CATEGORIES}
					deleteAsset={deleteAsset}
					onFiles={onFiles}
					select={select}
					selected={selected}
					setAssetCategory={setAssetCategory}
				/>
				<LevelCanvas
					canvasRef={canvasRef}
					onCanvasWheel={onCanvasWheel}
					collisionsCount={collisionsRef.current.size}
					copySelection={copySelection}
					currentDoc={currentDoc}
					debug={debug}
					grid={grid}
					erase={() => {
						setMode("eraser");
						setEraser(true);
					}}
					levelWidth={levelWidth}
					levelHeight={levelHeight}
					mode={mode}
					onDown={onDown}
					onStageDown={onStageDown}
					onMove={onMove}
					onUp={onUp}
					pasteSelection={pasteSelection}
					placedCount={placedRef.current.size}
					setEraser={setEraser}
					setMode={setMode}
					t={t}
					stageRef={stageRef}
					zoom={levelZoom}
				/>
				<aside className="terrain-sidebar">
					<div className="terrain-action-rail" aria-label="Editor actions">
						<span className="rail-label">EDIT</span>
						<button
							className={mode === "brush" ? "active" : ""}
							title="Brush (B)"
							aria-label="Brush (B)"
							onClick={() => {
								setMode("brush");
								setEraser(false);
							}}
						>
							<MousePointer2 size={16} />
						</button>
						<button
							className={mode === "select" ? "active" : ""}
							title="Rectangular select (M)"
							aria-label="Rectangular select (M)"
							onClick={() => {
								setMode("select");
								setEraser(false);
							}}
						>
							<BoxSelect size={16} />
						</button>
						<button
							className={mode === "eraser" ? "active" : ""}
							title="Eraser (E)"
							aria-label="Eraser (E)"
							onClick={() => {
								setMode("eraser");
								setEraser(true);
							}}
						>
							<Eraser size={16} />
						</button>
						<button
							className={mode === "rectangle" ? "active" : ""}
							title="Rectangle (R)"
							aria-label="Rectangle (R)"
							onClick={() => {
								setMode("rectangle");
								setEraser(false);
							}}
						>
							□
						</button>
						<button
							className={mode === "line" ? "active" : ""}
							title="Line (I)"
							aria-label="Line (I)"
							onClick={() => {
								setMode("line");
								setEraser(false);
							}}
						>
							╱
						</button>
						<button
							className={mode === "fill" ? "active" : ""}
							title="Fill (F)"
							aria-label="Fill (F)"
							onClick={() => {
								setMode("fill");
								setEraser(false);
							}}
						>
							▧
						</button>
						<button
							title="Copy selection (Ctrl/⌘ C)"
							aria-label="Copy selection"
							onClick={copySelection}
						>
							<Copy size={16} />
						</button>
						<button
							title="Paste selection (Ctrl/⌘ V)"
							aria-label="Paste selection"
							onClick={pasteSelection}
						>
							<ClipboardPaste size={16} />
						</button>
						<button title="Undo" aria-label="Undo" onClick={undo}>
							<RotateCcw size={16} />
						</button>
						<button title="Redo" aria-label="Redo" onClick={redo}>
							<RotateCw size={16} />
						</button>
						<button
							title="Clear level"
							aria-label="Clear level"
							onClick={clearLevel}
						>
							<Trash2 size={16} />
						</button>
					</div>
					<details className="layer-panel" open={layerPanelOpen}>
						<summary
							onClick={(event) => {
								event.preventDefault();
								setLayerPanelOpen((open) => !open);
							}}
						>
							Layers · hide/show (⌥L)
						</summary>
						{documentLayers.map((layer, index) => (
							<div
								className={
									"layer-row " + (activeLayer === layer.id ? "active" : "")
								}
								key={layer.id}
							>
								{(() => {
									const tile = [...placedRef.current.values()]
										.map((cell) => layersFor(cell)[layer.id])
										.find(Boolean);
									return tile ? (
										<img
											className="layer-thumb"
											src={(tile.asset || tile).url}
											alt=""
										/>
									) : (
										<span className="layer-thumb" />
									);
								})()}
								<button
									className="layer-name"
									onClick={() => selectLayer(layer.id)}
								>
									{layer.name}
								</button>
								<button
									aria-label={layer.visible ? "Hide layer" : "Show layer"}
									title={layer.visible ? "Hide layer" : "Show layer"}
									onClick={() =>
										updateLayers((layers) =>
											layers.map((item) =>
												item.id === layer.id
													? { ...item, visible: !item.visible }
													: item,
											),
										)
									}
								>
									{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
								</button>
								<button
									aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
									title={layer.locked ? "Unlock layer" : "Lock layer"}
									onClick={() =>
										updateLayers((layers) =>
											layers.map((item) =>
												item.id === layer.id
													? { ...item, locked: !item.locked }
													: item,
											),
										)
									}
								>
									{layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
								</button>
								<button
									aria-label="Toggle layer collision"
									className={layer.collision ? "collision-badge" : ""}
									title="Toggle layer collision"
									onClick={() =>
										updateLayers((layers) =>
											layers.map((item) =>
												item.id === layer.id
													? { ...item, collision: !item.collision }
													: item,
											),
										)
									}
								>
									<Shield size={14} />
								</button>
								<details className="layer-more">
									<summary
										aria-label="More layer options"
										title="More layer options"
									>
										<MoreHorizontal size={14} />
									</summary>
									{layer.type === "autotile" && (
										<button onClick={() => openAutotileRules(layer)}>
											Rules
										</button>
									)}
									<button
										onClick={() => {
											const name = prompt("Layer name", layer.name);
											if (name)
												updateLayers((layers) =>
													layers.map((item) =>
														item.id === layer.id ? { ...item, name } : item,
													),
												);
										}}
									>
										Rename
									</button>
									<button onClick={() => duplicateLayer(layer)}>
										Duplicate
									</button>
									<button
										onClick={() =>
											updateLayers((layers) =>
												layers.map((item) =>
													item.id === layer.id
														? {
																...item,
																type:
																	item.type === "autotile"
																		? "tile"
																		: "autotile",
																rule:
																	item.type === "autotile"
																		? undefined
																		: defaultAutotileRule(),
															}
														: item,
												),
											)
										}
									>
										{layer.type === "autotile" ? "Regular tile" : "Autotile"}
									</button>
									<button onClick={() => moveLayer(index, 1)}>Move up</button>
									<button onClick={() => moveLayer(index, -1)}>
										Move down
									</button>
									<button
										onClick={() => {
											const entry = prompt("Property as key=value");
											if (!entry?.includes("=")) return;
											const [name, value] = entry.split(/=(.*)/s);
											updateLayers((layers) =>
												layers.map((item) =>
													item.id === layer.id
														? {
																...item,
																properties: {
																	...item.properties,
																	[name.trim()]: value,
																},
															}
														: item,
												),
											);
										}}
									>
										Property
									</button>
									<button className="danger" onClick={() => deleteLayer(layer)}>
										Delete
									</button>
								</details>
							</div>
						))}
						<div className="layer-add">
							<button onClick={() => addLayer()}>+ Layer</button>
							<button onClick={() => addLayer("autotile")}>
								+ Autotile layer
							</button>
						</div>
						{activeLayerDoc?.type === "autotile" && (
							<small>
								Selected tile is the top-left of a 3×3 autotile block.
							</small>
						)}
					</details>
					<details className="sidebar-section tile-attributes">
						<summary>Tile attributes</summary>
						{[
							["collision", "Collision"],
							["hazard", "Hazard"],
							["ladder", "Ladder"],
							["spawn", "Spawn"],
							["damage", "Damage"],
							["animated", "Animated"],
						].map(([key, label]) => (
							<label className="row" key={key}>
								<input
									type="checkbox"
									checked={!!tileAttributes[key]}
									onChange={(event) =>
										setTileAttributes((value) => ({
											...value,
											[key]: event.target.checked || undefined,
										}))
									}
								/>
								{label}
							</label>
						))}
						<div className="row">
							<input
								aria-label="Custom tile property name"
								placeholder="key"
								value={customAttributeKey}
								onChange={(event) => setCustomAttributeKey(event.target.value)}
							/>
							<input
								aria-label="Custom tile property value"
								placeholder="value"
								value={customAttributeValue}
								onChange={(event) =>
									setCustomAttributeValue(event.target.value)
								}
							/>
						</div>
						<button
							onClick={() => {
								if (!customAttributeKey) return;
								setTileAttributes((value) => ({
									...value,
									[customAttributeKey]: customAttributeValue,
								}));
								setCustomAttributeKey("");
								setCustomAttributeValue("");
							}}
						>
							Add tile property
						</button>
					</details>
					{selectedObject && (
						<details className="sidebar-section object-inspector" open>
							<summary>{objectSelection.type} inspector</summary>
							<label>
								X
								<input
									type="number"
									value={Math.round(selectedObject.x)}
									onChange={(e) =>
										updateSelectedObject({ x: Number(e.target.value) || 0 })
									}
								/>
							</label>
							<label>
								Y
								<input
									type="number"
									value={Math.round(selectedObject.y)}
									onChange={(e) =>
										updateSelectedObject({ y: Number(e.target.value) || 0 })
									}
								/>
							</label>
							{objectSelection.type === "platform" && (
								<>
									<label>
										Asset ID
										<input
											value={selectedObject.assetId}
											onChange={(e) =>
												updateSelectedObject({ assetId: e.target.value })
											}
										/>
									</label>
									<label>
										Scale
										<input
											type="number"
											step="0.1"
											value={selectedObject.scale || 1}
											onChange={(e) =>
												updateSelectedObject({
													scale: Number(e.target.value) || 1,
												})
											}
										/>
									</label>
									<label>
										<input
											type="checkbox"
											checked={!!selectedObject.collision}
											onChange={(e) =>
												updateSelectedObject({ collision: e.target.checked })
											}
										/>{" "}
										collision
									</label>
								</>
							)}
							{objectSelection.type === "prop" && (
								<label>
									Frame ID
									<input
										value={selectedObject.frameId}
										onChange={(e) =>
											updateSelectedObject({ frameId: e.target.value })
										}
									/>
								</label>
							)}
							{objectSelection.type === "pickup" && (
								<label>
									Pickup type
									<input
										value={selectedObject.pickupType}
										onChange={(e) =>
											updateSelectedObject({ pickupType: e.target.value })
										}
									/>
								</label>
							)}
							{objectSelection.type === "enemy" && (
								<>
									<label>
										Enemy ID
										<input
											value={selectedObject.enemyId}
											onChange={(e) =>
												updateSelectedObject({ enemyId: e.target.value })
											}
										/>
									</label>
									<label>
										Facing
										<select
											value={selectedObject.facing}
											onChange={(e) =>
												updateSelectedObject({ facing: e.target.value })
											}
										>
											<option>left</option>
											<option>right</option>
										</select>
									</label>
								</>
							)}
							{objectSelection.type === "exit" && (
								<>
									<label>
										Exit ID
										<input
											value={selectedObject.exitId}
											onChange={(e) =>
												updateSelectedObject({ exitId: e.target.value })
											}
										/>
									</label>
									<label>
										Target animation
										<input
											value={selectedObject.targetAnimation}
											onChange={(e) =>
												updateSelectedObject({
													targetAnimation: e.target.value,
												})
											}
										/>
									</label>
								</>
							)}
							<button className="danger" onClick={deleteSelectedObject}>
								Delete object
							</button>
						</details>
					)}
					<details className="sidebar-section selected-tile-section" open>
						<summary>Selected tile & tileset</summary>
						<div className="eyebrow">Selected tile</div>
						<div className="selection">
							<div className="selection-preview" onWheel={onPickerWheel}>
								{selected && (
									<div
										role="img"
										aria-label={`${selected.name} selected tile`}
										style={{
											width: `${selectedRegion.w * pickerZoom}px`,
											height: `${selectedRegion.h * pickerZoom}px`,
											backgroundImage: `url(${selected.url})`,
											backgroundPosition: `${-selectedRegion.x * pickerZoom}px ${-selectedRegion.y * pickerZoom}px`,
											backgroundSize: `${selected.image.width * pickerZoom}px ${selected.image.height * pickerZoom}px`,
										}}
									/>
								)}
							</div>
							<strong>{selected?.name || "Nothing selected"}</strong>
						</div>
						<div className="eyebrow">Tileset picker</div>
						<small>
							Click for one tile or drag for a rectangular region. Scroll here
							to zoom this tileset only.
						</small>
						{selected && (
							<div
								className="tileset-picker"
								style={{ "--grid-size": `${t * pickerZoom}px` } as GridStyle}
								onWheel={onPickerWheel}
							>
								<div
									className="tileset-plane"
									style={{
										width: `${selected.image.width * pickerZoom}px`,
										height: `${selected.image.height * pickerZoom}px`,
									}}
								>
									<img
										src={selected.url}
										alt={`${selected.name} tileset`}
										onPointerDown={beginPicker}
										onPointerMove={dragPicker}
										onPointerUp={endPicker}
										onPointerCancel={endPicker}
										draggable={false}
										onDragStart={(e) => e.preventDefault()}
									/>
									<div
										className="picker-selection"
										style={{
											left: `${selectedRegion.x * pickerZoom}px`,
											top: `${selectedRegion.y * pickerZoom}px`,
											width: `${selectedRegion.w * pickerZoom}px`,
											height: `${selectedRegion.h * pickerZoom}px`,
										}}
									/>
								</div>
							</div>
						)}
					</details>
				</aside>
			</main>
		</>
	);
}

createRoot(document.getElementById("root")).render(<App />);
