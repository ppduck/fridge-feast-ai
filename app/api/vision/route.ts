import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Ingredient } from "@/lib/schemas";
import { getOpenAI, isMockMode } from "@/lib/openai";

const Body = z.object({
  imageBase64: z.string().min(10) // expects a data URL like "data:image/jpeg;base64,..."
});

export async function POST(req: NextRequest) {
  const { imageBase64 } = Body.parse(await req.json());

  // Mock Mode (should be OFF in full product, but keep as fallback)
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

  try {
    const openai = getOpenAI();

    const system = "You output strictly valid JSON objects. No extra text.";
    const userPrompt = `
Analyze the kitchen photo and return a JSON object:
{
  "ingredients": [
    { "name": string (canonical lowercase), "category"?: string, "confidence": number 0..1, "quantity"?: string }
  ]
}
Rules:
- Canonical lowercase names (e.g., "bell pepper", "chicken breast").
- category if obvious: produce, dairy, protein, grain, condiment, spice, beverage.
- confidence between 0 and 1.
- Exclude utensils, containers, and brand labels.
Return ONLY the JSON object.
`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" }, // force valid JSON object
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          // content supports image_url as a data URL
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageBase64 } }
          ] as any
        }
      ]
    });

    // Expect a JSON object with an "ingredients" array
    let obj: any;
    try {
      obj = JSON.parse(resp.choices[0]?.message?.content || "{}");
    } catch {
      return NextResponse.json({ error: "Vision JSON parse failed" }, { status: 502 });
    }

    const parsed = z.array(Ingredient).safeParse(obj.ingredients);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid ingredient schema" }, { status: 502 });
    }

    return NextResponse.json({ ingredients: parsed.data });
  } catch (e: any) {
    // Show a friendly error; if image is too large or key missing, this helps identify it
    const msg = e?.response?.data?.error?.message || e?.message || "Vision error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}