/**
 * Сжимает фото перед сохранением в анкету: уменьшает до 800 px по длинной стороне и сохраняет в JPEG.
 * Фото с телефона весит 3–10 МБ, после сжатия — обычно 60–150 КБ, на глаз качество то же.
 * Поворот фото (EXIF) браузер учитывает сам при отрисовке.
 */
const MAX_BYTES = 300 * 1024; // запас под ограничение сервера

const loadImage = (src: File | string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const done = () => typeof src !== 'string' && URL.revokeObjectURL(url);
    const img = new Image();
    img.onload = () => {
      done();
      resolve(img);
    };
    img.onerror = () => {
      done();
      reject(new Error('Не получилось открыть фото'));
    };
    img.src = url;
  });

const render = (img: HTMLImageElement, maxSide: number, quality: number) => {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  // Белый фон — для PNG с прозрачностью, иначе в JPEG она станет чёрной
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
};

// Размер data:-строки в байтах (base64 → примерно 3/4)
export const dataUrlBytes = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

// Принимает файл с телефона или уже сохранённое фото (data:-строку) — например, тяжёлое старое
export async function compressImage(file: File | string): Promise<string> {
  const img = await loadImage(file);
  // Пробуем всё более сильное сжатие, пока фото не станет достаточно лёгким
  for (const [side, quality] of [[800, 0.82], [800, 0.7], [640, 0.7], [512, 0.65]] as const) {
    const result = render(img, side, quality);
    if (dataUrlBytes(result) <= MAX_BYTES) return result;
  }
  return render(img, 400, 0.6);
}
