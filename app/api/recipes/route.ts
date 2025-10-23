import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Recipe, Filters } from "@/lib/schemas";
import { computeMatchScore } from "@/lib/scoring";
import { getOpenAI, isMockMode } from "@/lib/openai";

const Body = z.object({
  ingredients: z.array(z.object({ name: z.string() })),
  filters: Filters.default({}),
  excludeIds: z.array(z.string().uuid()).default([]),
  excludeNames: z.array(z.string()).default([]), // allow client to pass names already shown
  count: z.number().int().min(1).max(10).default(5)
});

function uuid() {
  return (globalThis.crypto && "randomUUID" in globalThis.crypto)
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000";
}

// Helper: robust JSON parse with code-fence stripping fallback
function safeJsonParseObject(s: string): any | null {
  try { return JSON.parse(s); } catch {
    // strip ```json ... ``` or ``` ... ```
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence && fence[1]) {
      try { return JSON.parse(fence[1]); } catch { /* ignore */ }
    }
    // try to extract outermost braces
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sub = s.slice(start, end + 1);
      try { return JSON.parse(sub); } catch { /* ignore */ }
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { ingredients, filters, excludeIds, excludeNames, count } = Body.parse(await req.json());
  const detectedSet = new Set(ingredients.map(i => i.name.toLowerCase()));

  // Mock mode fallback (won’t run with MOCK_MODE=false)
  if (isMockMode()) {
    const baseNames = [
      "Quick Veggie Scramble","Cheesy Spinach Quesadilla","Pepper-Tomato Pasta",
      "Tomato Spinach Salad","Sheet-Pan Veggie Bake","Stuffed Bell Peppers",
      "Spinach Omelette","Tomato Rice Bowl","Creamy Veggie Orzo","Garlic Butter Veg Rice",
      "Spinach & Tomato Frittata","Veggie Fried Rice","One-Pan Pasta Primavera",
      "Spinach Pesto Pasta","Caprese Toasts","Warm Tomato Couscous"
    ];
    const taken = new Set((excludeNames || []).map(n => n.toLowerCase()));
    const pool = baseNames.filter(n => !taken.has(n.toLowerCase())).slice(0, count);
    const recipes = pool.map((name, idx) => {
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
      };
    });
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

  const sys = `You output strictly valid JSON objects only. No prose, no markdown.
Return exactly one JSON object with a "recipes" array field. Each item must contain:
- id (uuid v4)
- name (string)
- description (1–2 sentences)
- prep_time_minutes (int)
- ingredients (array of strings)
- steps (array of strings)
- tags (array of strings)
- health_score (int 1..10)
Do not include any other top-level fields. Ensure there are exactly ${count} items in the "recipes" array.
Avoid duplicate IDs and near-identical names.
Avoid recipe names: ${excludeNames.length ? excludeNames.join(", ") : "none"}.
Exclude IDs: ${excludeIds.length ? excludeIds.join(", ") : "none"}.
Constraints:
${constraints.join("\n")}`;

  const usr = `Available ingredients to prioritize: ${names}.
Prefer variety across cuisines and proteins. Keep steps clear and realistic.`;

  // Force JSON with response_format and use a slightly lower temperature for structural reliability
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ]
  });

  const raw = resp.choices?.[0]?.message?.content || "";
  const obj = safeJsonParseObject(raw);
  if (!obj || !obj.recipes) {
    return NextResponse.json({ error: "Recipe JSON parse failed" }, { status: 502 });
  }

  // Validate and compute match_score
  const BaseRecipe = Recipe.omit({ match_score: true, image_url: true });
  const arrParsed = z.array(BaseRecipe).safeParse(obj.recipes);
  if (!arrParsed.success) {
    return NextResponse.json({ error: "Invalid recipe schema" }, { status: 502 });
  }

  const recipes = arrParsed.data.map(r => ({
    ...r,
    match_score: computeMatchScore(detectedSet, r.ingredients)
  }));

  return NextResponse.json({ recipes });
}