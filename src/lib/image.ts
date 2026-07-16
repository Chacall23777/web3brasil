export async function fileToResizedDataUrl(file: File, max = 480, quality = 0.82): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // willReadFrequently forces the canvas off the GPU-compositing path, avoiding a known
  // browser bug where pixel readback (toBlob/toDataURL) from a GPU-backed canvas comes
  // back corrupted (color noise / static / striping).
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function fileToResizedBlob(file: File, max = 480, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // Same fix as above: avoid GPU-backed canvas readback corruption.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))), "image/png"),
  );
}

