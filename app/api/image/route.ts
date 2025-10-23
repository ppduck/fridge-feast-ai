import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const enabled = process.env.IMAGE_GEN_ENABLED === "true";
  try {
    const { name } = await req.json() as { name: string };
    if (!enabled) {
      return NextResponse.json({
        status: "disabled",
        imageUrl: "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=800&q=80&auto=format&fit=crop"
      });
    }
    // TODO: Integrate an image provider if enabling generation.
    return NextResponse.json({ status: "ok", imageUrl: null });
  } catch (e: any) {
    return NextResponse.json({ status: "failed", imageUrl: null, error: e?.message }, { status: 500 });
  }
}
