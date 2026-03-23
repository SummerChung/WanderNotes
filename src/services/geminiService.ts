import { GoogleGenAI } from "@google/genai";

declare const process: {
  env: {
    GEMINI_API_KEY: string;
  };
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getCountryTips(country: string) {
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
