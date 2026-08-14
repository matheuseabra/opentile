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
	return {
		assets: imported.flatMap((item) => (item.asset ? [item.asset] : [])),
		failed: imported.filter((item) => item.failed).length,
	};
};
