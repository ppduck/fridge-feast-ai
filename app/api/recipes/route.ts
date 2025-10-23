import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Recipe, Filters } from "@/lib/schemas";
import { computeMatchScore } from "@/lib/scoring";
import { getOpenAI, isMockMode } from "@/lib/openai";

const Body = z.object({
  ingredients: z.array(z.object({ name: z.string() })),
  filters: Filters.default({}),
  excludeIds: z.array(z.string().uuid()).default([]),
  count: z.number().int().min(1).max(10).default(5)
});

function uuid() {
  return (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}

export async function POST(req: NextRequest) {
  const { ingredients, filters, excludeIds, count } = Body.parse(await req.json());
  const detectedSet = new Set(ingredients.map(i => i.name.toLowerCase()));

  if (isMockMode()) {
    const baseNames = ["Quick Veggie Scramble","Cheesy Spinach Quesadilla","Pepper-Tomato Pasta","Tomato Spinach Salad","Sheet-Pan Veggie Bake","Stuffed Bell Peppers","Spinach Omelette","Tomato Rice Bowl"];
    const recipes = baseNames.slice(0, count + 2).map((name, idx) => {
      const ing = ["bell pepper","cherry tomato","spinach","eggs","cheddar cheese","olive oil","salt","pepper"].slice(0, 5 + (idx % 2));
      return {
        id: uuid(),
        name,
        description: "A simple, tasty dish using your fresh produce.",
        prep_time_minutes: 10 + (idx % 3) * 5,
        ingredients: ing,
        steps: ["Prep ingredients","Cook/assemble","Season and serve"],
        tags: ["Quick","Vegetarian"],
        health_score: 6 + (idx % 4),
        match_score: 5
      };
    }).filter(r => !excludeIds.includes(r.id));
    const final = recipes.map(r => ({ ...r, match_score: computeMatchScore(detectedSet, r.ingredients) }));
    return NextResponse.json({ recipes: final.slice(0, count) });
  }

  const openai = getOpenAI();
  const names = ingredients.map(i => i.name).join(", ");
  const constraints: string[] = [];
  if (filters.quick) constraints.push("Each recipe total time <= 30 minutes.");
  if (filters.vegetarian) constraints.push("Strictly vegetarian (no meat/fish/gelatin).");
  if (filters.vegan) constraints.push("Strictly vegan (no animal products).");
  if (filters.glutenFree) constraints.push("Gluten-free.");
  if (filters.dairyFree) constraints.push("Dairy-free.");
  if (filters.nutFree) constraints.push("Peanut & tree-nut free.");
  if (filters.shellfishFree) constraints.push("Shellfish-free.");
  if (filters.eggFree) constraints.push("Egg-free.");
  if (filters.soyFree) constraints.push("Soy-free.");
  if (filters.highProtein) constraints.push("Higher protein focus.");
  if (filters.lowCarb) constraints.push("Lower carbohydrate focus.");

  const sys = `You are a concise creative chef who outputs strict JSON only.
Create ${count} distinct recipes as an array of objects with fields:
id (uuid v4), name, description (1–2 sentences), prep_time_minutes (int),
ingredients (array of strings), steps (array of strings), tags (array of strings),
health_score (1..10), match_score (int placeholder).
Avoid duplicate IDs and near-identical names. Exclude IDs: ${excludeIds.join(", ") || "none"}.
Constraints:
${constraints.join("\n")}
Return ONLY JSON array of ${count} recipes.`;

  const usr = `Use these available ingredients where possible: ${names}.
Prefer variety across cuisines and proteins. Keep steps clear and realistic.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.9,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  });

  let content: unknown;
  try { content = JSON.parse(resp.choices[0]?.message?.content || "[]"); }
  catch { return NextResponse.json({ error: "Recipe JSON parse failed" }, { status: 502 }); }

  const base = z.array(Recipe.omit({ match_score: true, image_url: true })).safeParse(content);
  if (!base.success) return NextResponse.json({ error: "Invalid recipe schema" }, { status: 502 });

  const recipes = base.data.map(r => ({
    ...r,
    match_score: computeMatchScore(detectedSet, r.ingredients)
  }));

  return NextResponse.json({ recipes });
}
