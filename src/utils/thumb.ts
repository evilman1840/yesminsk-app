/**
 * Миниатюра фото профиля (200 px) для кружков на карте и в списках: в разы легче полного фото.
 * Только для наших адресов /api/users/:id/avatar; чужие ссылки (Telegram) не меняем
 */
export const thumb = (url?: string | null): string => {
  if (!url || !/\/api\/users\/\d+\/avatar\b/.test(url)) return url || '';
  return url.includes('w=') ? url : `${url}${url.includes('?') ? '&' : '?'}w=200`;
};
