/**
 * Removes white/near-white backgrounds from images by making those pixels transparent.
 * Uses a flood-fill from the corners to detect the background color, then removes it.
 * Falls back to threshold-based removal if flood-fill isn't sufficient.
 */
export function removeWhiteBackground(img, threshold = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  if (W === 0 || H === 0) return canvas;

  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  // --- Step 1: Sample corners to detect background color ---
  function getPixel(x, y) {
    const idx = (y * W + x) * 4;
    return [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];
  }

  const corners = [
    getPixel(0, 0), getPixel(W - 1, 0),
    getPixel(0, H - 1), getPixel(W - 1, H - 1),
  ];
  // Average background color from corners
  const bgR = corners.reduce((s, c) => s + c[0], 0) / 4;
  const bgG = corners.reduce((s, c) => s + c[1], 0) / 4;
  const bgB = corners.reduce((s, c) => s + c[2], 0) / 4;

  // --- Step 2: BFS flood-fill from all edges to find background pixels ---
  const visited = new Uint8Array(W * H);
  const queue = [];

  // Seed from all border pixels
  for (let x = 0; x < W; x++) {
    queue.push(x, 0);
    queue.push(x, H - 1);
    visited[0 * W + x] = 1;
    visited[(H - 1) * W + x] = 1;
  }
  for (let y = 1; y < H - 1; y++) {
    queue.push(0, y);
    queue.push(W - 1, y);
    visited[y * W + 0] = 1;
    visited[y * W + (W - 1)] = 1;
  }

  // Tolerance: how similar a pixel must be to the background color to be included
  const BG_TOLERANCE = 80;

  function isBgColor(r, g, b) {
    return (
      Math.abs(r - bgR) < BG_TOLERANCE &&
      Math.abs(g - bgG) < BG_TOLERANCE &&
      Math.abs(b - bgB) < BG_TOLERANCE
    );
  }

  // BFS
  let qi = 0;
  while (qi < queue.length) {
    const x = queue[qi++];
    const y = queue[qi++];
    const idx = (y * W + x) * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    if (!isBgColor(r, g, b)) continue;

    // Mark transparent
    data[idx + 3] = 0;

    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const ni = ny * W + nx;
      if (visited[ni]) continue;
      visited[ni] = 1;
      queue.push(nx, ny);
    }
  }

  // --- Step 3: Also remove any remaining near-white pixels (interior isolated bg) ---
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue; // already transparent
    if (r > threshold && g > threshold && b > threshold) {
      const whiteness = Math.min(r, g, b);
      const alpha = 255 - Math.round(((whiteness - threshold) / (255 - threshold)) * 255);
      data[i + 3] = Math.max(0, alpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}