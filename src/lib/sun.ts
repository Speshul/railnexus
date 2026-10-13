// Which side of the train gets the sun. Client-safe, no dependencies.
// Sun position follows the standard low-precision astronomical formulas (as used by SunCalc, accurate to well under
// a degree), which is plenty for "left or right window".

const RAD = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

/** Sun azimuth (degrees clockwise from north) and altitude (degrees above the horizon). */
export function sunPosition(ms: number, lat: number, lng: number) {
  const d = ms / 86400000 - 0.5 + J1970 - J2000;
  const M = RAD * (357.5291 + 0.98560028 * d);
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L));
  const H = RAD * (280.16 + 360.9856235 * d) + RAD * lng - ra;
  const phi = RAD * lat;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const fromSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { azimuth: (fromSouth / RAD + 180 + 360) % 360, altitude: altitude / RAD };
}

/** Initial compass bearing from a to b, degrees clockwise from north. */
export function bearing(aLat: number, aLng: number, bLat: number, bLng: number) {
  const y = Math.sin((bLng - aLng) * RAD) * Math.cos(bLat * RAD);
  const x = Math.cos(aLat * RAD) * Math.sin(bLat * RAD) - Math.sin(aLat * RAD) * Math.cos(bLat * RAD) * Math.cos((bLng - aLng) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** A point on the journey: where the train is and when (epoch ms). `name` is set for stations. */
export type PathPoint = { lat: number; lng: number; t: number; name: string };
/** "ahead" = sun in front, behind or high overhead: it doesn't shine in through either side's windows. */
export type SunState = "night" | "left" | "right" | "ahead";
export type SunBand = { from: number; to: number; state: SunState };
export type SunEvent = { kind: "sunrise" | "sunset"; t: number; near: string; side: "left" | "right" | "ahead" };
export type SunReport = {
  start: number;
  end: number;
  minutes: Record<SunState, number>;
  bands: SunBand[];
  events: SunEvent[];
  /** side to sit on to avoid the sun, if one side clearly gets more of it */
  shade: "left" | "right" | null;
};

const STEP_MS = 5 * 60000;
// The sun is "ahead/behind" (on neither window) when within this many degrees of the direction of travel.
const AHEAD_DEG = 25;
// Above this altitude the sun is overhead and barely reaches through the windows.
const OVERHEAD_DEG = 65;

function sideOf(sunAz: number, heading: number): "left" | "right" | "ahead" {
  const rel = (sunAz - heading + 360) % 360;
  if (rel < AHEAD_DEG || rel > 360 - AHEAD_DEG || Math.abs(rel - 180) < AHEAD_DEG) return "ahead";
  return rel < 180 ? "right" : "left";
}

/** Walk the route in 5-minute steps and work out where the sun is relative to the train. */
export function analyseSun(points: PathPoint[]): SunReport | null {
  const pts = points.filter((p, i) => i === 0 || p.t > points[i - 1].t || p.lat !== points[i - 1].lat);
  if (pts.length < 2) return null;
  const minutes: Record<SunState, number> = { night: 0, left: 0, right: 0, ahead: 0 };
  const bands: SunBand[] = [];
  const events: SunEvent[] = [];
  let prevAlt: number | null = null;
  let lastStation = pts[0].name;
  let heading = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (a.name) lastStation = a.name;
    const span = b.t - a.t;
    if (span <= 0) continue;
    // At a halt (same place, time passes) the train still faces the way it was going.
    if (a.lat !== b.lat || a.lng !== b.lng) heading = bearing(a.lat, a.lng, b.lat, b.lng);
    for (let t = a.t; t < b.t; t += STEP_MS) {
      const dt = Math.min(STEP_MS, b.t - t);
      const f = (t + dt / 2 - a.t) / span;
      const lat = a.lat + (b.lat - a.lat) * f;
      const lng = a.lng + (b.lng - a.lng) * f;
      const sun = sunPosition(t + dt / 2, lat, lng);
      const up = sun.altitude > 0;
      const side = sideOf(sun.azimuth, heading);
      const state: SunState = !up ? "night" : sun.altitude > OVERHEAD_DEG ? "ahead" : side;
      if (prevAlt !== null && (prevAlt <= 0) === up) {
        events.push({ kind: up ? "sunrise" : "sunset", t: t + dt / 2, near: lastStation, side });
      }
      prevAlt = sun.altitude;
      minutes[state] += dt / 60000;
      const last = bands[bands.length - 1];
      if (last && last.state === state) last.to = t + dt;
      else bands.push({ from: t, to: t + dt, state });
    }
  }
  // Glare that lasts less than 20 minutes isn't worth choosing a seat for; otherwise one side must clearly win.
  const { left, right } = minutes;
  const shade = left + right < 20 ? null : left > right * 1.5 ? "right" : right > left * 1.5 ? "left" : null;
  return { start: pts[0].t, end: pts[pts.length - 1].t, minutes, bands, events, shade };
}
