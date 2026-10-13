import { parseSearchParams, searchConnections, searchJourneys } from "@/lib/search";
import { loadSales } from "@/lib/availability";

// GET /api/search?from=NDLS&to=BCT&date=2026-10-20&quota=GN[&nearby=1][&connections=1]
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const params = parseSearchParams(sp);
  if (!params) return Response.json({ error: "from and to are required" }, { status: 400 });
  await loadSales();
  if (sp.connections === "1") return Response.json({ params, connections: searchConnections(params) });
  return Response.json(searchJourneys(params));
}
