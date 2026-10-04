import { searchStations } from "@/lib/rail";

export function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const stations = searchStations(q, 8).map((s) => ({ code: s.code, name: s.name, state: s.state, trains: s.train_count }));
  return Response.json(stations);
}
