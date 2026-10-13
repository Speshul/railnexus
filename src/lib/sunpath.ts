import "server-only";
import { getStops } from "./rail";
import { analyseSun, type PathPoint } from "./sun";

/**
 * Sun report for a train between two stops. `startDate` is the date the train left its origin (stop times are
 * minutes from midnight of that day, IST). Uses every timetabled point, including stations it passes without stopping.
 */
export function sunForJourney(trainNumber: string, fromCode: string, toCode: string, startDate: string) {
  const stops = getStops(trainNumber);
  const i = stops.findIndex((s) => s.code === fromCode);
  const j = stops.findIndex((s, k) => k > i && s.code === toCode);
  if (i < 0 || j < 0) return null;
  const base = Date.parse(`${startDate}T00:00:00+05:30`);
  const points: PathPoint[] = [];
  for (const s of stops.slice(i, j + 1)) {
    if (s.lat === null || s.lng === null) continue;
    const arr = s.code === fromCode ? null : s.arr_min;
    const dep = s.code === toCode ? null : s.dep_min;
    for (const m of [arr, dep]) {
      if (m !== null && (!points.length || base + m * 60000 > points[points.length - 1].t)) {
        points.push({ lat: s.lat, lng: s.lng, t: base + m * 60000, name: s.name });
      }
    }
  }
  return analyseSun(points);
}
