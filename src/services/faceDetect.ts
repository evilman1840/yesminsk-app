/**
 * Быстрая проверка прямо в телефоне: есть ли на выбранном фото лицо (MediaPipe, без сервера).
 * Это только подсказка «не видно лица» сразу после выбора фото. Решает проверка на сервере (faceCheck.ts)
 * Библиотека и модель грузятся только когда человек выбрал фото
 */
const VERSION = '1.1.1';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

type Detector = { detect: (img: HTMLImageElement) => { detections: unknown[] } };
let detector: Promise<Detector> | null = null;

const getDetector = () =>
  (detector ||= (async () => {
    const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(WASM);
    return FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.4
    });
  })().catch((err) => {
    detector = null; // в следующий раз попробуем снова
    throw err;
  }));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// true — лицо есть, false — не нашли, null — проверить не получилось (не мешаем человеку)
export async function photoHasFace(src: string): Promise<boolean | null> {
  try {
    const [d, img] = await Promise.all([getDetector(), loadImage(src)]);
    return d.detect(img).detections.length > 0;
  } catch {
    return null;
  }
}
