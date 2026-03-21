/**
 * Removes white/near-white backgrounds from images by making those pixels transparent.
 * Uses a two-pass approach: first flood-fill from corners to find the background,
 * then removes all connected near-white regions.
 * Returns a canvas with the background removed.
 */
export function removeWhiteBackground(img, threshold = 240) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  function isNearWhite(idx) {
    return data[idx] > threshold && data[idx + 1] > threshold && data[idx + 2] > threshold;
  }

  // Flood-fill from all 4 corners to mark background pixels
  const visited = new Uint8Array(W * H);
  const queue = [];

  // Seed from edges
  for (let x = 0; x < W; x++) {
    if (isNearWhite((0 * W + x) * 4)) { queue.push(x); visited[x] = 1; }
    if (isNearWhite(((H - 1) * W + x) * 4)) { const idx = (H - 1) * W + x; queue.push(idx); visited[idx] = 1; }
  }
  for (let y = 0; y < H; y++) {
    if (isNearWhite((y * W + 0) * 4)) { const idx = y * W; queue.push(idx); visited[idx] = 1; }
    if (isNearWhite((y * W + (W - 1)) * 4)) { const idx = y * W + W - 1; queue.push(idx); visited[idx] = 1; }
  }

  // BFS flood fill
  let qi = 0;
  while (qi < queue.length) {
    const pos = queue[qi++];
    const x = pos % W, y = Math.floor(pos / W);
    const neighbors = [
      pos - W, pos + W,
      x > 0 ? pos - 1 : -1,
      x < W - 1 ? pos + 1 : -1,
    ];
    for (const nb of neighbors) {
      if (nb < 0 || nb >= W * H || visited[nb]) continue;
      if (isNearWhite(nb * 4)) {
        visited[nb] = 1;
        queue.push(nb);
      }
    }
  }

  // Make all flood-filled (background) pixels transparent
  for (let i = 0; i < W * H; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Also remove any remaining isolated near-white pixels (fringing)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) {
      // Smooth fade for anti-aliased edges
      const whiteness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const factor = (whiteness - 220) / 35; // 0 at 220, 1 at 255
      if (factor > 0) {
        data[i + 3] = Math.round(data[i + 3] * (1 - factor));
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}