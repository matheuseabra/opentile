export const copyTiles = (placed, area, collisions = null) => {
	const tiles = [];
	for (let y = area.y; y < area.y + area.h; y++)
		for (let x = area.x; x < area.x + area.w; x++) {
			const cell = `${x},${y}`;
			const value = placed.get(cell);
			const hasCollision = collisions?.has(cell);
			if (value || hasCollision)
				tiles.push({
					x: x - area.x,
					y: y - area.y,
					...(value ? { value } : {}),
					...(hasCollision ? { collision: true } : {}),
				});
		}
	return tiles;
};

export const tilesInRegion = (region, tileSize) => {
	const tiles = [];
	for (let y = 0; y < region.h; y += tileSize)
		for (let x = 0; x < region.w; x += tileSize)
			tiles.push({
				x: x / tileSize,
				y: y / tileSize,
				sx: region.x + x,
				sy: region.y + y,
			});
	return tiles;
};

export const pasteTiles = (
	placed,
	clipboard,
	origin,
	width,
	height,
	collisions = null,
) => {
	for (const item of clipboard) {
		const x = origin.x + item.x;
		const y = origin.y + item.y;
		if (x >= 0 && y >= 0 && x < width && y < height) {
			const cell = `${x},${y}`;
			if (item.value) placed.set(cell, item.value);
			if (item.collision) collisions?.add(cell);
		}
	}
};

export const deleteTiles = (placed, collisions, selection) => {
	for (let y = selection.y; y < selection.y + selection.h; y++)
		for (let x = selection.x; x < selection.x + selection.w; x++) {
			const cell = `${x},${y}`;
			placed.delete(cell);
			collisions.delete(cell);
		}
};

export const cutTiles = (placed, collisions, selection) => {
	const clipboard = copyTiles(placed, selection, collisions);
	deleteTiles(placed, collisions, selection);
	return clipboard;
};

export const moveTiles = (placed, collisions, selection, dx, dy) => {
	const pending = [];
	const inside = (x, y) =>
		x >= selection.x &&
		x < selection.x + selection.w &&
		y >= selection.y &&
		y < selection.y + selection.h;
	for (let y = selection.y; y < selection.y + selection.h; y++)
		for (let x = selection.x; x < selection.x + selection.w; x++) {
			const from = `${x},${y}`;
			const toX = x + dx;
			const toY = y + dy;
			const value = placed.get(from);
			const hadCollision = collisions.has(from);
			pending.push({
				from,
				to: `${toX},${toY}`,
				value,
				hadCollision,
				blocked:
					(value || hadCollision) &&
					(placed.has(`${toX},${toY}`) || collisions.has(`${toX},${toY}`)) &&
					!inside(toX, toY),
			});
		}
	if (pending.some((entry) => entry.blocked))
		return { x: selection.x, y: selection.y };
	for (const entry of pending)
		if (entry.value || entry.hadCollision) {
			placed.delete(entry.from);
			collisions.delete(entry.from);
		}
	for (const entry of pending) {
			if (entry.value) placed.set(entry.to, entry.value);
			if (entry.hadCollision) collisions.add(entry.to);
		}
	return { x: selection.x + dx, y: selection.y + dy };
};
