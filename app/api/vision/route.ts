import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ingredient } from "@/lib/schemas";
import { getOpenAI, isMockMode } from "@/lib/openai";

const Body = z.object({
  imageBase64: z.string().min(10)
});

export async function POST(req: NextRequest) {
  const { imageBase64 } = Body.parse(await req.json());

  if (isMockMode()) {
    const mock = [
      { name: "bell pepper", confidence: 0.92, category: "produce" },
      { name: "cherry tomato", confidence: 0.9, category: "produce" },
      { name: "eggs", confidence: 0.88, category: "protein" },
      { name: "spinach", confidence: 0.86, category: "produce" },
      { name: "cheddar cheese", confidence: 0.8, category: "dairy" }
    ];
    return NextResponse.json({ ingredients: mock });
  }

  const openai = getOpenAI();
  const system = "Return strictly valid JSON. Never include commentary.";
  const userPrompt = `
Analyze the kitchen photo and list visible edible ingredients.
- Canonical lowercase names.
- Include category if obvious (produce, dairy, protein, grain, condiment, spice, beverage).
- Include confidence 0..1.
- Exclude utensils/containers/brands.
Output ONLY a JSON array of {name, category?, confidence, quantity?}.
`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageBase64 } }
        ] as any
      }
    ]
  });

  let parsed: unknown;
  try { parsed = JSON.parse(resp.choices[0]?.message?.content || "[]"); }
  catch { return NextResponse.json({ error: "Vision JSON parse failed" }, { status: 502 }); }

  const arr = z.array(Ingredient).safeParse(parsed);
  if (!arr.success) return NextResponse.json({ error: "Invalid ingredient schema" }, { status: 502 });

  return NextResponse.json({ ingredients: arr.data });
}
