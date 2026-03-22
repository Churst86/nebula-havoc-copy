/**
 * Removes white/near-white backgrounds from images by making those pixels transparent.
 * Uses a flood-fill from all edges + multiple expansion passes for thick borders.
 * Returns a canvas with the background removed, or null on failure.
 */
export function removeWhiteBackground(img, threshold = 240) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const W = canvas.width, H = canvas.height;
  if (W === 0 || H === 0) return null;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  let imageData;
  try {
    imageData = ctx.getImageData(0, 0, W, H);
  } catch (e) {
    return null;
  }

  const data = imageData.data;
  const removed = new Uint8Array(W * H);

  function isNearWhite(idx, t) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
    if (a < 10) return true; // already transparent
    return r > t && g > t && b > t;
  }

  // --- Pass 1: Flood-fill from all edges ---
  const queue = [];
  function seed(pos) {
    if (!removed[pos] && isNearWhite(pos * 4, threshold)) {
      removed[pos] = 1;
      queue.push(pos);
    }
  }

  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }

  let qi = 0;
  while (qi < queue.length) {
    const pos = queue[qi++];
    const x = pos % W, y = Math.floor(pos / W);
    if (x > 0)     { const nb = pos - 1; if (!removed[nb] && isNearWhite(nb * 4, threshold)) { removed[nb] = 1; queue.push(nb); } }
    if (x < W - 1) { const nb = pos + 1; if (!removed[nb] && isNearWhite(nb * 4, threshold)) { removed[nb] = 1; queue.push(nb); } }
    if (y > 0)     { const nb = pos - W; if (!removed[nb] && isNearWhite(nb * 4, threshold)) { removed[nb] = 1; queue.push(nb); } }
    if (y < H - 1) { const nb = pos + W; if (!removed[nb] && isNearWhite(nb * 4, threshold)) { removed[nb] = 1; queue.push(nb); } }
  }

  // Apply pass 1
  for (let i = 0; i < W * H; i++) {
    if (removed[i]) data[i * 4 + 3] = 0;
  }

  // --- Pass 2–4: Expand removal to catch thick borders / fringe artifacts ---
  for (let pass = 0; pass < 3; pass++) {
    const toRemove = new Uint8Array(W * H);
    const passThreshold = 210 - pass * 10; // get progressively more aggressive
    for (let i = 0; i < W * H; i++) {
      if (removed[i]) continue;
      if (data[i * 4 + 3] === 0) { removed[i] = 1; continue; }
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > passThreshold && g > passThreshold && b > passThreshold) {
        const x = i % W, y = Math.floor(i / W);
        const hasRemovedNeighbor =
          (x > 0 && removed[i - 1]) ||
          (x < W - 1 && removed[i + 1]) ||
          (y > 0 && removed[i - W]) ||
          (y < H - 1 && removed[i + W]);
        if (hasRemovedNeighbor) toRemove[i] = 1;
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (toRemove[i]) { data[i * 4 + 3] = 0; removed[i] = 1; }
    }
  }

  // --- Pass 5: Soften anti-aliased fringe ---
  for (let i = 0; i < W * H; i++) {
    if (!removed[i] && data[i * 4 + 3] > 0) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > 180 && g > 180 && b > 180) {
        const brightness = (r + g + b) / 3;
        const factor = Math.max(0, (brightness - 180) / 75);
        data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - factor));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}