// Сервер умеет отдавать копию 200 px: аватарки, фото сходок и анкет, фото мест
const SMALL_OK = /\/api\/(users\/\d+\/avatar|photos\/|places\/photo\/)/;

/**
 * Миниатюра фото профиля, сходки или места (200 px) для кружков на карте и в списках: в разы легче полного фото.
 * Только для наших адресов (см. SMALL_OK); чужие ссылки (Telegram) не меняем
 */
export const thumb = (url?: string | null): string => {
  if (!url || !SMALL_OK.test(url)) return url || '';
  return url.includes('w=') ? url : `${url}${url.includes('?') ? '&' : '?'}w=200`;
};
