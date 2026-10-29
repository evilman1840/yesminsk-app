import { AREA_GROUPS } from '../config/areas';
import { calculateDistance } from './geo';

/**
 * Районы Минска для формы сходки: подпись «Центр» у места и проверка «в описании Уручье, а точка в центре».
 * Берём районы из анкеты (config/areas), без пункта «Другой пригород»
 */

// short — подпись района у точки, part — как район называют в тексте («Центр» у «Немига / Центр»)
type Area = { name: string; short: string; part: string; coords: [number, number]; re: RegExp };

// Падежи: отрезаем конечные гласные и добавляем до трёх букв окончания, но не больше.
// «Уручье» → «уручь(е|ем)», «Каменная Горка» → «каменн(ой) горк(е)»; «Центр» не ловит «центральный», «Восток» не ловит «восторг»
const stem = (w: string) => {
  const base = w.replace(/[аеиоуыэюяйь]{1,2}$/, '');
  return (base.length >= 3 ? base : w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-я]{0,3}(?![а-я])';
};
const areaRegExp = (part: string) =>
  new RegExp('(?<![а-я-])' + part.toLowerCase().replace(/ё/g, 'е').split(/\s+/).map(stem).join('\\s+'), 'i');

const AREAS: Area[] = AREA_GROUPS.flatMap((g) =>
  Object.entries(g.areas)
    .filter(([name]) => name !== 'Другой пригород')
    .flatMap(([name, coords]) => name.split(' / ').map((part) => ({ name, short: name.split(' / ')[0], part, coords, re: areaRegExp(part) })))
);

// Точка по умолчанию (центр), когда своё место человек не указывал — расстояние «от тебя» тогда не показываем
const DEFAULT_POINTS: [number, number][] = [
  [53.9045, 27.552],
  [53.9045, 27.5615]
];
export const isKnownPoint = (c?: [number, number] | null): c is [number, number] =>
  Boolean(c && c.length === 2 && !DEFAULT_POINTS.some((d) => d[0] === c[0] && d[1] === c[1]));

export const distanceMeters = (a: [number, number], b: [number, number]) => calculateDistance(a[0], a[1], b[0], b[1]);

// Ближайший район к точке (дальше 4 км от всех — за городом, без подписи)
export function areaOf(coords?: [number, number] | null): string | null {
  if (!coords) return null;
  let best: Area | null = null;
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = distanceMeters(coords, a.coords);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best && bestD < 4000 ? best.short : null;
}

const FAR = 3000; // упомянутый район дальше этого от точки — переспрашиваем

/**
 * В названии или описании упомянут район, а точка далеко от него: «гуляем в Уручье», а точка на Немиге.
 * Если упомянуто несколько районов и хоть один рядом с точкой — всё в порядке
 */
export function farMentionedArea(text: string, coords: [number, number]): { mentioned: string; distanceKm: number } | null {
  const t = text.toLowerCase().replace(/ё/g, 'е');
  const found = AREAS.filter((a) => a.re.test(t));
  if (!found.length) return null;
  const withD = found.map((a) => ({ a, d: distanceMeters(coords, a.coords) }));
  if (withD.some((x) => x.d < FAR)) return null;
  const nearest = withD.sort((x, y) => x.d - y.d)[0];
  return { mentioned: nearest.a.part, distanceKm: Math.round(nearest.d / 1000) };
}
