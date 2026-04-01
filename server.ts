import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/generate-moment", async (req, res) => {
    const { input } = req.body;
    if (!input) return res.status(400).json({ error: "Input is required" });

    try {
      const ai = getAiClient();
      const model = "gemini-3-flash-preview";
      
      // 1. Generate text
      const textResponse = await ai.models.generateContent({
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
      });

      const data = JSON.parse(textResponse.text || "{}");

      // 2. Generate image
      const imageResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: data.imagePrompt,
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      let base64Image = "";
      for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }

      res.json({
        ...data,
        image: base64Image ? `data:image/png;base64,${base64Image}` : ""
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Generation failed" });
    }
  });

  app.post("/api/generate-mbti", async (req, res) => {
    const { mbti } = req.body;
    if (!mbti) return res.status(400).json({ error: "MBTI is required" });

    try {
      const ai = getAiClient();
      const model = "gemini-3-flash-preview";
      const response = await ai.models.generateContent({
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
      });

      res.json(JSON.parse(response.text || "{}"));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Generation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
