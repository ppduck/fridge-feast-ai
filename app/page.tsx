"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RecipeT } from "@/lib/schemas";
import {
  getProfile, setProfile, getLastFilters, setLastFilters,
  getSaved, setSaved, getCooked, setCooked, getFeedback, setFeedback
} from "@/lib/storage";

function cx(...xs: (string | false | null | undefined)[]) { return xs.filter(Boolean).join(" "); }

export default function Home() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<{ name: string; confidence: number; category?: string }[] | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [recipes, setRecipes] = useState<RecipeT[]>([]);
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set());
  const [loadingStage, setLoadingStage] = useState<"idle"|"vision"|"recipes">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"match"|"health"|"time">("match");

  useEffect(() => {
    setFilters(prev => ({ ...prev, ...getLastFilters() }));
    const profile = getProfile();
    if (profile.defaultSort) setSortBy(profile.defaultSort);
  }, []);
  useEffect(() => { setLastFilters(filters); }, [filters]);

  useEffect(() => {
    if (!imageFile) { setImagePreview(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const onAnalyze = async () => {
    if (!imageFile) return;
    setError(null); setLoadingStage("vision");
    const b64 = await fileToDataURL(imageFile);
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: b64 })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to analyze image"); setLoadingStage("idle"); return; }
    setIngredients(data.ingredients);
    setLoadingStage("idle");
  };

  const onGenerate = async (count = 5) => {
    if (!ingredients?.length) return;
    setError(null); setLoadingStage("recipes");
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients: ingredients.map(i => ({ name: i.name })),
        filters,
        excludeIds: Array.from(excludeIds),
        excludeNames: recipes.map(r => r.name), // add this line
        count
      })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to generate recipes"); setLoadingStage("idle"); return; }
    const existingNames = new Set(recipes.map(r => r.name.toLowerCase()));
    const newOnes: RecipeT[] = data.recipes.filter((r: RecipeT) => !existingNames.has(r.name.toLowerCase()));
    setRecipes(cur => [...cur, ...newOnes]);
    setExcludeIds(cur => new Set([...Array.from(cur), ...newOnes.map(r => r.id)]));
    setLoadingStage("idle");
  };

  const onLoadMore = () => onGenerate(5);

  const sortedRecipes = useMemo(() => {
    const arr = [...recipes];
    if (sortBy === "health") arr.sort((a,b) => b.health_score - a.health_score);
    if (sortBy === "match") arr.sort((a,b) => b.match_score - a.match_score);
    if (sortBy === "time") arr.sort((a,b) => a.prep_time_minutes - b.prep_time_minutes);
    return arr;
  }, [recipes, sortBy]);

  const [saved, setSavedState] = useState(getSaved());
  const [cooked, setCookedState] = useState(getCooked());
  const [feedback, setFeedbackState] = useState(getFeedback());

  const toggleSave = (r: RecipeT) => {
    const exists = saved.find(s => s.id === r.id);
    const next = exists ? saved.filter(s => s.id !== r.id) : [...saved, { id: r.id, name: r.name, at: Date.now() }];
    setSaved(next); setSavedState(next);
  };
  const markCooked = (r: RecipeT) => {
    const next = [...cooked, { id: r.id, name: r.name, at: Date.now() }];
    setCooked(next); setCookedState(next);
  };
  const setSentiment = (r: RecipeT, s: "like"|"dislike") => {
    const next = { ...feedback, [r.id]: s };
    setFeedback(next); setFeedbackState(next);
  };

  return (
    <main className="max-w-6xl mx-auto p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Fridge Feast AI</h1>
        <p className="text-gray-700">Turn what you have into dinner ideas.</p>
      </header>

      <section className="bg-white border rounded p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/2">
            <label htmlFor="uploader" className="block font-medium">Upload fridge/pantry photo</label>
            <input
              id="uploader"
              aria-label="Upload fridge or pantry image"
              type="file"
              accept="image/*"
              className="mt-2"
              onChange={e => setImageFile(e.target.files?.[0] || null)}
            />
            {imagePreview && <img src={imagePreview} alt="Selected kitchen photo preview" className="mt-2 rounded max-h-64 object-contain" />}
            <button
              className="mt-3 px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
              onClick={onAnalyze}
              disabled={!imageFile || loadingStage!=="idle"}
            >
              {loadingStage==="vision" ? "Analyzing..." : "Analyze Ingredients"}
            </button>
          </div>

          <div className="w-full md:w-1/2">
            <fieldset>
              <legend className="font-medium">Dietary & preference filters</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  ["vegetarian","Vegetarian"],
                  ["vegan","Vegan"],
                  ["glutenFree","Gluten-free"],
                  ["dairyFree","Dairy-free"],
                  ["nutFree","Nut-free"],
                  ["shellfishFree","Shellfish-free"],
                  ["eggFree","Egg-free"],
                  ["soyFree","Soy-free"],
                  ["quick","Quick (≤30m)"],
                  ["highProtein","High-protein"],
                  ["lowCarb","Low-carb"]
                ].map(([key,label]) => (
                  <label key={key} className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(filters as any)[key] || false}
                      onChange={e => setFilters(f => ({ ...f, [key]: e.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-3">
              <label className="block font-medium" htmlFor="sort">Sort by</label>
              <select
                id="sort"
                aria-label="Sort recipes"
                className="mt-1 border rounded px-2 py-1"
                value={sortBy}
                onChange={e => {
                  const v = e.target.value as "match"|"health"|"time";
                  setSortBy(v);
                  const p = getProfile();
                  setProfile({ ...p, defaultSort: v });
                }}
              >
                <option value="match">Best use of ingredients</option>
                <option value="health">Healthiest first</option>
                <option value="time">Fastest first</option>
              </select>
            </div>

            <div className="mt-4">
              <button
                className="px-3 py-2 rounded bg-green-600 text-white disabled:opacity-50"
                onClick={() => onGenerate(5)}
                disabled={!ingredients?.length || loadingStage!=="idle"}
              >
                {loadingStage==="recipes" ? "Generating recipes..." : "Generate 5 Recipes"}
              </button>
            </div>
          </div>
        </div>

        {ingredients && (
          <div className="mt-4">
            <p className="font-medium">Detected ingredients (click to remove):</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ingredients.map((ing, idx) => (
                <button
                  key={idx}
                  onClick={() => setIngredients(prev => prev?.filter((_,i)=>i!==idx) || null)}
                  className="px-2 py-1 rounded border bg-gray-50 hover:bg-red-50"
                  aria-label={`Remove ${ing.name}`}
                >
                  {ing.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {error && <div role="alert" className="mb-4 text-red-700">{error}</div>}

      <section aria-live="polite" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedRecipes.map(r => (
          <RecipeCard key={r.id} r={r}
            saved={!!saved.find(s => s.id===r.id)}
            feedback={feedback[r.id]}
            onSave={()=>toggleSave(r)}
            onCooked={()=>markCooked(r)}
            onFeedback={(s)=>setSentiment(r,s)}
          />
        ))}
      </section>

      {recipes.length > 0 && (
        <div className="mt-4 flex justify-center">
          <button
            className="px-4 py-2 rounded border bg-white hover:bg-gray-50"
            onClick={onLoadMore}
            aria-label="Load 5 more recipes"
          >
            Load 5 more
          </button>
        </div>
      )}

      {recipes.length === 0 && (
        <div className="text-center text-gray-700 mt-12">
          <p>Upload a photo, set your preferences, and let’s cook!</p>
        </div>
      )}
    </main>
  );
}

function RecipeCard({ r, saved, feedback, onSave, onCooked, onFeedback }:{
  r: any; saved: boolean; feedback?: "like"|"dislike";
  onSave: ()=>void; onCooked: ()=>void; onFeedback: (s:"like"|"dislike")=>void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!expanded || loadedRef.current) return;
    loadedRef.current = true;
    fetch("/api/image", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: r.name, ingredients: r.ingredients })
    })
      .then(res => res.json())
      .then(data => { if (data.imageUrl) setImgUrl(data.imageUrl); })
      .catch(()=>{ /* keep placeholder */ });
  }, [expanded, r.name, r.ingredients]);

  return (
    <article className="border rounded p-3 bg-white">
      <div className="aspect-[3/2] bg-gray-100 rounded mb-2 overflow-hidden flex items-center justify-center">
        {imgUrl
          ? <img src={imgUrl} alt={`Photorealistic image of ${r.name}`} className="w-full h-full object-cover" />
          : <span aria-hidden className="text-gray-400">Dish image</span>}
      </div>
      <h3 className="font-semibold">{r.name}</h3>
      <p className="text-sm text-gray-700">{r.description}</p>
      <div className="text-xs mt-1 text-gray-600">
        Time: {r.prep_time_minutes} min • Health: {r.health_score}/10 • Match: {r.match_score}/10
      </div>

      <details className="mt-2" open={expanded} onToggle={e=>setExpanded((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer select-none">View details</summary>
        <div className="mt-2">
          <p className="font-medium">Ingredients</p>
          <ul className="list-disc ml-5">
            {r.ingredients.map((i:string, idx:number)=><li key={idx}>{i}</li>)}
          </ul>
          <p className="font-medium mt-2">Steps</p>
          <ol className="list-decimal ml-5">
            {r.steps.map((s:string, idx:number)=><li key={idx}>{s}</li>)}
          </ol>
        </div>
      </details>

      <div className="mt-3 flex gap-2">
        <button
          className={cx("px-2 py-1 rounded border", feedback==="like" && "bg-green-100 border-green-300")}
          aria-label="Like recipe"
          onClick={()=>onFeedback("like")}
        >👍 Like</button>
        <button
          className={cx("px-2 py-1 rounded border", feedback==="dislike" && "bg-red-100 border-red-300")}
          aria-label="Dislike recipe"
          onClick={()=>onFeedback("dislike")}
        >👎 Dislike</button>
        <button
          className={cx("px-2 py-1 rounded border", saved && "bg-blue-100 border-blue-300")}
          aria-label={saved ? "Unsave recipe" : "Save recipe"}
          onClick={onSave}
        >💾 {saved ? "Saved" : "Save"}</button>
        <button
          className="px-2 py-1 rounded border"
          aria-label="Mark as cooked"
          onClick={onCooked}
        >🍳 Cooked</button>
      </div>
    </article>
  );
}

async function fileToDataURL(file: File): Promise<string> {
  return await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
