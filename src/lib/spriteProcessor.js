/**
 * Removes white/near-white backgrounds from images by making those pixels transparent.
 * Works by drawing to an offscreen canvas and manipulating pixel data.
 * Returns a new ImageBitmap (or canvas) with the background removed.
 */
export function removeWhiteBackground(img, threshold = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // If all channels are near-white, make transparent
    if (r > threshold && g > threshold && b > threshold) {
      // Fade edges smoothly based on how white the pixel is
      const whiteness = Math.min(r, g, b);
      const alpha = 255 - Math.round(((whiteness - threshold) / (255 - threshold)) * 255);
      data[i + 3] = Math.max(0, alpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}