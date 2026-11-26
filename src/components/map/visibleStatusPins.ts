type Point = [number, number];
type Box = [left: number, top: number, right: number, bottom: number];
export type StatusSide = 'left' | 'right';
export const STATUS_NOTE_WIDTH = 116;
export const STATUS_NOTE_REACH = 27 + STATUS_NOTE_WIDTH;

const MAX_STATUS_PINS = 4;
const PIN_GAP = 8;

const overlaps = (a: Box, b: Box) =>
  a[0] < b[2] + PIN_GAP && a[2] > b[0] - PIN_GAP &&
  a[1] < b[3] + PIN_GAP && a[3] > b[1] - PIN_GAP;

export function visibleStatusPins(
  candidates: { id: string; point: Point }[],
  width: number,
  height: number,
  topInset: number,
  ownPin: Point | null,
  ownNote: boolean,
): Map<string, StatusSide> {
  const result = new Map<string, StatusSide>();
  // Space for the header, donation, geolocation and the map attribution.
  const viewport: Box = [8, topInset, width - 8, height - 34];
  const occupied: Box[] = [[0, height - 106, 126, height - 54], [width - 66, height - 106, width, height - 54]];
  if (ownPin) {
    const [x, y] = ownPin;
    const side = width - x - 27 >= 168 || x < width / 2 ? 'right' : 'left';
    occupied.push([x - (ownNote && side === 'left' ? 192 : 27), y - 78,
      x + (ownNote && side === 'right' ? 192 : 27), y]);
  }

  for (const { id, point: [x, y] } of candidates) {
    if (result.has(id)) continue;
    const left: Box = [x - STATUS_NOTE_REACH, y - 54, x + 26, y + 4];
    const right: Box = [x - 26, y - 54, x + STATUS_NOTE_REACH, y + 4];
    const sides: StatusSide[] = x < width / 2 ? ['right', 'left'] : ['left', 'right'];
    const side = sides.find(side => {
      const box = side === 'left' ? left : right;
      return box[0] >= viewport[0] && box[1] >= viewport[1] &&
        box[2] <= viewport[2] && box[3] <= viewport[3] &&
        !occupied.some(other => overlaps(box, other));
    });
    if (!side) continue;
    result.set(id, side);
    occupied.push(side === 'left' ? left : right);
    if (result.size === MAX_STATUS_PINS) break;
  }

  return result;
}
