import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

export function setGeminiApiKey(key: string) {
  if (key) {
    ai = new GoogleGenAI({ apiKey: key });
    localStorage.setItem('GEMINI_API_KEY', key);
  }
}

// Initialize from localStorage if available
const savedKey = localStorage.getItem('GEMINI_API_KEY');
if (savedKey) {
  setGeminiApiKey(savedKey);
} else if (typeof process !== 'undefined' && process.env.GEMINI_API_KEY) {
  setGeminiApiKey(process.env.GEMINI_API_KEY);
}

export async function getCountryTips(country: string) {
  if (!ai) {
    throw new Error('API_KEY_MISSING');
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `請針對「${country}」提供簡短的旅遊建議，包含：
1. 最佳旅遊季節
2. 必去景點 (3個)
3. 當地特色美食 (2個)
4. 旅遊小叮嚀 (1個)
請使用繁體中文，格式請簡潔明瞭。`,
  });

  return response.text;
}
