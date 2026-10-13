import { takenFields } from "@/lib/auth";

// GET /api/username?u=name -> { available: boolean }  (live check on the register form)
export async function GET(req: Request) {
  const u = (new URL(req.url).searchParams.get("u") ?? "").trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(u)) return Response.json({ available: false, invalid: true });
  return Response.json({ available: !(await takenFields(u, "")).username });
}
