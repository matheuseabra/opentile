export function AssetLibrary({
	assetCategory,
	assets,
	categories,
	deleteAsset,
	onFiles,
	select,
	selected,
	setAssetCategory,
}) {
	return (
		<aside className="asset-sidebar">
			<h2>Assets</h2>
			<details className="sidebar-section" open>
				<summary>Import</summary>
				<select
					value={assetCategory}
					onChange={(event) => setAssetCategory(event.target.value)}
					aria-label="Asset category"
				>
					{categories.map((category) => (
						<option key={category} value={category}>
							{category}
						</option>
					))}
				</select>
				<input
					type="file"
					accept="image/png,image/jpeg"
					multiple
					onChange={onFiles}
				/>
				<small>Uploaded tiles stay in this browser.</small>
			</details>
			<details className="sidebar-section" open>
				<summary>Asset catalog</summary>
				{categories.map((category) => {
					const group = assets.filter(
						(asset) => (asset.category || "terrain") === category,
					);
					return group.length ? (
						<div className="catalog-group" key={category}>
							<div className="catalog-heading">{category}</div>
							<div id="assetList">
								{group.map((asset) => (
									<div
										className={`asset ${selected === asset ? "selected" : ""}`}
										key={asset.name}
										onClick={() => select(asset)}
									>
										<img src={asset.url} alt={asset.name} />
										<span className="asset-name">{asset.name}</span>
										<button
											className="asset-delete"
											title={`Delete ${asset.name}`}
											aria-label={`Delete ${asset.name}`}
											onClick={(event) => {
												event.stopPropagation();
												deleteAsset(asset);
											}}
										>
											×
										</button>
									</div>
								))}
							</div>
						</div>
					) : null;
				})}
			</details>
		</aside>
	);
}
