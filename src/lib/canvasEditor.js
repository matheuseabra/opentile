export const copyTiles = (placed, area) => {
  const tiles = [];
  for (let y = area.y; y < area.y + area.h; y++)
    for (let x = area.x; x < area.x + area.w; x++) {
      const value = placed.get(`${x},${y}`);
      if (value) tiles.push({ x: x - area.x, y: y - area.y, value });
    }
  return tiles;
};

export const pasteTiles = (placed, clipboard, origin, width, height) => {
  for (const item of clipboard) {
    const x = origin.x + item.x;
    const y = origin.y + item.y;
    if (x >= 0 && y >= 0 && x < width && y < height)
      placed.set(`${x},${y}`, item.value);
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

export const moveTiles = (placed, collisions, selection, dx, dy) => {
  const moved = new Map();
  const movedCollisions = new Set();
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
      const to = `${toX},${toY}`;
      const value = placed.get(from);
      const hadCollision = collisions.has(from);
      if (placed.has(to) && !inside(toX, toY)) {
        moved.set(from, value);
        continue;
      }
      if (value) moved.set(to, value);
      placed.delete(from);
      collisions.delete(from);
      if (hadCollision) movedCollisions.add(to);
    }
  for (const [cell, value] of moved) if (value) placed.set(cell, value);
  for (const cell of movedCollisions) collisions.add(cell);
  return { x: selection.x + dx, y: selection.y + dy };
};
