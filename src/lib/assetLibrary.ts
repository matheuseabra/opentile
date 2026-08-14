export const nextAssetName = (assets: any[], originalName: string) => {
	const dot = originalName.lastIndexOf(".");
	const base = dot < 0 ? originalName : originalName.slice(0, dot);
	const ext = dot < 0 ? "" : originalName.slice(dot);
	let name = originalName;
	let n = 1;
	while (assets.some((asset) => asset.name === name))
		name = `${base}-${n++}${ext}`;
	return name;
};

export const createAsset = (
	blob: Blob,
	name: string,
	category: string,
): Promise<any> =>
	new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const image = new Image();
		image.onload = () => resolve({ name, url, image, blob, category });
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error(`Could not load ${name}`));
		};
		image.src = url;
	});

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
