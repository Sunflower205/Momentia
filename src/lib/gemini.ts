import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function callGeminiWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a 503 or 429 error
      const isRetryable = error?.status === "UNAVAILABLE" || error?.code === 503 || error?.code === 429 || error?.message?.includes("503") || error?.message?.includes("429");
      
      if (isRetryable && i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.warn(`Gemini API error (503/429), retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function generateMoment(input: string) {
  const model = "gemini-3-flash-preview";
  
  // 1. Generate text
  const textResponse = await callGeminiWithRetry(() => ai.models.generateContent({
    model,
    contents: `基于输入“${input}”，生成一段温柔、克制、文艺的原创短句（100%原创，不摘抄，不引用）。同时分析其中的心情和天气。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "主文案，温柔文艺" },
          subtext: { type: Type.STRING, description: "底部的感悟或描述，一段话" },
          mood: { type: Type.STRING },
          weather: { type: Type.STRING },
          imagePrompt: { type: Type.STRING, description: "用于生成图片的英文提示词，风格为低饱和、文艺、安静、暗调" }
        },
        required: ["text", "subtext", "mood", "weather", "imagePrompt"]
      }
    }
  }));

  const data = JSON.parse(textResponse.text || "{}");

  // 2. Generate image
  const imageResponse = await callGeminiWithRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: data.imagePrompt,
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  }));

  let base64Image = "";
  for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      base64Image = part.inlineData.data;
      break;
    }
  }

  return {
    ...data,
    image: base64Image ? `data:image/png;base64,${base64Image}` : ""
  };
}

export async function generateMBTIQuote(mbti: string) {
  const model = "gemini-3-flash-preview";
  const response = await callGeminiWithRetry(() => ai.models.generateContent({
    model,
    contents: `为MBTI人格类型“${mbti}”推荐一句来自书籍或文艺向影视的摘抄。要求：100%原文，严格校对。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          source: { type: Type.STRING },
          author: { type: Type.STRING },
          details: {
            type: Type.OBJECT,
            properties: {
              intro: { type: Type.STRING },
              doubanRating: { type: Type.STRING },
              buyLink: { type: Type.STRING },
              watchPlatform: { type: Type.STRING }
            }
          }
        },
        required: ["content", "source", "author"]
      }
    }
  }));

  return JSON.parse(response.text || "{}");
}
