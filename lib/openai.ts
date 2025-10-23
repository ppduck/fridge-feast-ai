import OpenAI from "openai";

export function isMockMode() {
  return process.env.MOCK_MODE === "true" || !process.env.OPENAI_API_KEY;
}

export function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}
