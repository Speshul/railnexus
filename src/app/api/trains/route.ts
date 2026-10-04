import { lookupTrains } from "@/lib/rail";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const trains = lookupTrains(q, 8).map((t) => ({
    number: t.number,
    name: t.name,
    from: t.from_name,
    to: t.to_name,
    type: t.type_name,
  }));
  return Response.json(trains);
}
