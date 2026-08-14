export const importAssetFiles = async (
	files: Array<{ name: string }>,
	category: string,
	addAsset: (
		file: any,
		name: string,
		save: boolean,
		category: string,
		selectOnAdd: boolean,
	) => Promise<any>,
	onImported?: (asset: any) => void,
) => {
	const imported = await Promise.all(
		files.map(async (file) => {
			try {
				return {
					asset: await addAsset(file, file.name, true, category, false),
					failed: false,
				};
			} catch {
				return { asset: null, failed: true };
			}
		}),
	);
	const assets = imported.flatMap((item) => (item.asset ? [item.asset] : []));
	if (assets.at(-1)) onImported?.(assets.at(-1));
	return {
		assets,
		failed: imported.filter((item) => item.failed).length,
	};
};
