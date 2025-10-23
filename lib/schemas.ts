import { z } from "zod";

export const Ingredient = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1),
  quantity: z.string().optional()
});

export const Filters = z.object({
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  dairyFree: z.boolean().optional(),
  nutFree: z.boolean().optional(),
  shellfishFree: z.boolean().optional(),
  eggFree: z.boolean().optional(),
  soyFree: z.boolean().optional(),
  quick: z.boolean().optional(),
  highProtein: z.boolean().optional(),
  lowCarb: z.boolean().optional()
});

export const Recipe = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().min(1),
  prep_time_minutes: z.number().int().min(1).max(240),
  ingredients: z.array(z.string().min(1)).min(2),
  steps: z.array(z.string().min(1)).min(2),
  tags: z.array(z.string().min(1)).default([]),
  health_score: z.number().int().min(1).max(10),
  match_score: z.number().int().min(1).max(10),
  image_url: z.string().url().optional()
});

export type IngredientT = z.infer<typeof Ingredient>;
export type FiltersT = z.infer<typeof Filters>;
export type RecipeT = z.infer<typeof Recipe>;
