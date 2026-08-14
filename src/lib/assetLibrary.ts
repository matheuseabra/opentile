const defaultAssetAdapters: any = {
	createObjectUrl: (blob: Blob) => URL.createObjectURL(blob),
	revokeObjectUrl: (url: string) => URL.revokeObjectURL(url),
	createImage: () => new Image(),
};

export const categoryForName = (name: string) => {
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

export const normalizeAssetCategory = (category: string | null | undefined, name: string) =>
	category || categoryForName(name);

export const nextAssetName = (
	assets: any[],
	originalName: string,
	reservedNames: Iterable<string> = [],
) => {
	const dot = originalName.lastIndexOf(".");
	const base = dot < 0 ? originalName : originalName.slice(0, dot);
	const ext = dot < 0 ? "" : originalName.slice(dot);
	const taken = new Set(assets.map((asset) => asset.name));
	for (const name of reservedNames) taken.add(name);
	let name = originalName;
	let n = 1;
	while (taken.has(name)) name = `${base}-${n++}${ext}`;
	return name;
};

export const reserveAssetName = (
	assets: any[],
	originalName: string,
	reservedNames: Set<string>,
) => {
	const name = nextAssetName(assets, originalName, reservedNames);
	reservedNames.add(name);
	return name;
};

export const reserveExactAssetName = (
	reservedNames: Set<string>,
	name: string,
) => {
	reservedNames.add(name);
	return name;
};

export const releaseAssetNameReservation = (
	reservedNames: Set<string>,
	name: string,
) => {
	reservedNames.delete(name);
};

const assetLoadError = (name: string) => new Error(`Could not load ${name}`);

const hydrationFailure = (record: any, error: unknown) => ({
	name: record?.name || "(unknown asset)",
	error,
	record,
});

export const createAsset = (
	blob: Blob,
	name: string,
	category: string,
	adapters = defaultAssetAdapters,
): Promise<any> =>
	new Promise((resolve, reject) => {
		const url = adapters.createObjectUrl(blob);
		const image = adapters.createImage();
		let settled = false;
		const finish = (callback: () => void) => {
			if (settled) return;
			settled = true;
			image.onload = null;
			image.onerror = null;
			callback();
		};
		const fail = () =>
			finish(() => {
				adapters.revokeObjectUrl(url);
				reject(assetLoadError(name));
			});
		const succeed = () =>
			finish(() =>
				resolve({
					name,
					url,
					image,
					blob,
					category: normalizeAssetCategory(category, name),
				}),
			);
		image.onload = () => {
			try {
				const decoded =
					typeof image.decode === "function" ? image.decode() : null;
				if (decoded && typeof decoded.then === "function") decoded.then(succeed, fail);
				else succeed();
			} catch {
				fail();
			}
		};
		image.onerror = fail;
		image.src = url;
	});

export const releaseAsset = (asset: any, adapters = defaultAssetAdapters) => {
	if (!asset?.url) return;
	if (asset.image) asset.image.onload = asset.image.onerror = null;
	adapters.revokeObjectUrl(asset.url);
};

export const hydrateStoredAsset = (
	record: any,
	adapters = defaultAssetAdapters,
) => createAsset(record.blob, record.name, record.category, adapters);

export const hydrateStoredAssets = async (
	records: any[],
	adapters = defaultAssetAdapters,
	options: { onSettled?: (record: any, index: number) => void } = {},
) => {
	const settled = await Promise.all(
		records.map(async (record, index) => {
			try {
				return {
					asset: await hydrateStoredAsset(record, adapters),
					failure: null,
				};
			} catch (error) {
				return {
					asset: null,
					failure: hydrationFailure(record, error),
				};
			} finally {
				options.onSettled?.(record, index);
			}
		}),
	);
	return {
		assets: settled.flatMap(({ asset }) => (asset ? [asset] : [])),
		failures: settled.flatMap(({ failure }) => (failure ? [failure] : [])),
	};
};

export const openAssetStore = (): Promise<IDBDatabase> =>
	new Promise((resolve, reject) => {
		const request = indexedDB.open("pixel-pipeline-assets", 1);
		request.onupgradeneeded = () =>
			request.result.createObjectStore("tiles", { keyPath: "name" });
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

export const readStoredAssets = (db: IDBDatabase): Promise<any[]> =>
	new Promise((resolve, reject) => {
		const request = db.transaction("tiles").objectStore("tiles").getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});

export const persistAsset = (db: IDBDatabase | null, asset: any) =>
	db
		?.transaction("tiles", "readwrite")
		.objectStore("tiles")
		.put({ name: asset.name, blob: asset.blob, category: asset.category });

export const removePersistedAsset = (db: IDBDatabase | null, name: string) =>
	db?.transaction("tiles", "readwrite").objectStore("tiles").delete(name);
