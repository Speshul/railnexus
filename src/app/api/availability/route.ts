import { getSegment } from "@/lib/rail";
import { availabilityCalendar, loadSales } from "@/lib/availability";
import { adultFare } from "@/lib/fare";
import { CLASSES, QUOTAS, type ClassCode, type Quota } from "@/lib/constants";
import { addDays, isValidDate } from "@/lib/dates";

// GET /api/availability?train=12951&from=BCT&to=NDLS&date=2026-10-20&cls=3A&quota=GN&days=6
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const train = sp.get("train") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const date = sp.get("date") ?? "";
  const cls = (sp.get("cls") ?? "") as ClassCode;
  const quota = (sp.get("quota") ?? "GN") as Quota;
  const days = Math.min(Math.max(Number(sp.get("days") ?? 6), 1), 14);
  if (!isValidDate(date) || !(cls in CLASSES) || !(quota in QUOTAS)) {
    return Response.json({ error: "invalid parameters" }, { status: 400 });
  }
  const seg = getSegment(train, from, to, date);
  // If the train doesn't run on `date`, still build the calendar from the first running day.
  const probe = seg ?? Array.from({ length: 7 }, (_, i) => getSegment(train, from, to, addDays(date, i))).find(Boolean);
  if (!probe) return Response.json({ error: "train does not serve this route" }, { status: 404 });

  await loadSales();
  const calendar = availabilityCalendar({ ...probe, date }, cls, quota, days, (d) => getSegment(train, from, to, d));
  const fare = adultFare({ cls, km: probe.distance, trainType: probe.train.type, quota });
  return Response.json({ train, from, to, cls, quota, fare, calendar });
}
