/**
 * Removes white/near-white backgrounds from images by making those pixels transparent.
 * Uses a flood-fill from all edges to find connected background regions.
 * Returns a canvas with the background removed, or null on failure.
 */
export function removeWhiteBackground(img, threshold = 220) {
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

  function isNearWhite(idx) {
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    return r > threshold && g > threshold && b > threshold;
  }

  // Flood-fill from all edges
  const visited = new Uint8Array(W * H);
  const queue = [];

  function seed(pos) {
    if (!visited[pos] && isNearWhite(pos * 4)) {
      visited[pos] = 1;
      queue.push(pos);
    }
  }

  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }

  let qi = 0;
  while (qi < queue.length) {
    const pos = queue[qi++];
    const x = pos % W, y = Math.floor(pos / W);
    if (x > 0)     { const nb = pos - 1; if (!visited[nb] && isNearWhite(nb * 4)) { visited[nb] = 1; queue.push(nb); } }
    if (x < W - 1) { const nb = pos + 1; if (!visited[nb] && isNearWhite(nb * 4)) { visited[nb] = 1; queue.push(nb); } }
    if (y > 0)     { const nb = pos - W; if (!visited[nb] && isNearWhite(nb * 4)) { visited[nb] = 1; queue.push(nb); } }
    if (y < H - 1) { const nb = pos + W; if (!visited[nb] && isNearWhite(nb * 4)) { visited[nb] = 1; queue.push(nb); } }
  }

  // Make background pixels transparent
  for (let i = 0; i < W * H; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Soften anti-aliased fringe pixels (high brightness, non-background)
  for (let i = 0; i < W * H; i++) {
    if (!visited[i] && data[i * 4 + 3] > 0) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > 200 && g > 200 && b > 200) {
        const brightness = (r + g + b) / 3;
        const factor = Math.max(0, (brightness - 200) / 55);
        data[i * 4 + 3] = Math.round(data[i * 4 + 3] * (1 - factor));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}