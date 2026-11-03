import { actor, workspace, errorResponse } from "@/lib/ee/server";
export async function GET() {
  try {
    await actor();
    return Response.json(await workspace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
