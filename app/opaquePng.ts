// Store screenshots require a true RGB PNG, without an alpha channel.
const pngChunk = (type: string, data: Uint8Array) => {
  const chunk = new Uint8Array(data.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  let crc = 0xffffffff;
  for (let index = 4; index < chunk.length - 4; index++) {
    crc ^= chunk[index];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
};

export async function encodeRgbPng(width: number, height: number, rgba: Uint8ClampedArray): Promise<Blob> {
  if (width <= 0 || height <= 0 || rgba.length !== width * height * 4) {
    throw new Error("Dimensions PNG invalides.");
  }
  const stride = width * 3 + 1;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    // PNG Sub filter: store each channel relative to the preceding pixel.
    pixels[y * stride] = 1;
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = y * stride + 1 + x * 3;
      for (let channel = 0; channel < 3; channel++) {
        pixels[target + channel] = rgba[source + channel] - (x ? rgba[source - 4 + channel] : 0);
      }
    }
  }
  const compressed = await new Response(
    new Blob([pixels]).stream().pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 2; // PNG color type 2: RGB, no alpha.
  return new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", new Uint8Array(compressed)),
    pngChunk("IEND", new Uint8Array()),
  ], { type: "image/png" });
}

export async function toOpaquePng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("L’export PNG n’est pas disponible.");
    context.fillStyle = "#fffcf7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);
    return await encodeRgbPng(canvas.width, canvas.height,
      context.getImageData(0, 0, canvas.width, canvas.height).data);
  } finally {
    bitmap.close();
  }
}
