import { NextResponse } from "next/server";
import { toCSV } from "@/lib/lablens";
import { buildStoredIpynb, buildStoredReportMarkdown } from "@/lib/report";
import { NOT_FOUND_BODY, resolveTracks } from "@/lib/resolve";

// GET /api/report?id=...&format=md|ipynb|csv — real stored analyses only.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id") ?? "";
  const format = searchParams.get("format") ?? "md";
  const r = await resolveTracks(id);
  if (!r) return NextResponse.json(NOT_FOUND_BODY, { status: 404 });

  if (format === "csv") {
    return new NextResponse(toCSV(r.tracks), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${id}-tracks.csv"` } });
  }
  if (format === "ipynb") {
    return new NextResponse(JSON.stringify(buildStoredIpynb(r.analysis), null, 2), {
      headers: { "Content-Type": "application/x-ipynb+json", "Content-Disposition": `attachment; filename="${id}-report.ipynb"` },
    });
  }
  return new NextResponse(buildStoredReportMarkdown(r.analysis), {
    headers: { "Content-Type": "text/markdown", "Content-Disposition": `attachment; filename="${id}-report.md"` },
  });
}
