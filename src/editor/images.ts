/** Reads an image file and returns it as a PNG data: URL no larger than `max` pixels on its long side. */
export async function readImage(file: File, max: number): Promise<{ src: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  return { src: draw(bitmap, width, height), width, height };
}

/** Redraws an image at an exact square size, for the app icon sizes Android wants. */
export async function squareImage(src: string, size: number): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return draw(img, size, size);
}

function draw(source: CanvasImageSource, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

/** Opens the browser's file picker and resolves with the chosen files (none if cancelled). */
export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}

export async function pickFile(accept: string): Promise<File | null> {
  return (await pickFiles(accept, false))[0] ?? null;
}

/** A file's bytes as a data: URL, which is how sounds are kept inside the game. */
export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Draws an image centred on a transparent square with space around it.
 * Android crops the outer part of an adaptive icon into a circle or rounded
 * square, so the picture has to sit inside the middle two thirds.
 */
export async function paddedImage(src: string, size: number, inner = 0.62): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const side = Math.round(size * inner);
  const offset = Math.round((size - side) / 2);
  canvas.getContext('2d')!.drawImage(img, offset, offset, side, side);
  return canvas.toDataURL('image/png');
}
