import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON parsing with a large limit for image data
  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/generate-logo", async (req, res) => {
    try {
      const { prompt, size } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: prompt,
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: size || "1K", // 1K, 2K, 4K
          },
        },
      });

      // Extract image
      let base64Image = null;
      let mimeType = "image/png";

      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            base64Image = part.inlineData.data;
            if (part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            break;
          }
        }
      }

      if (!base64Image) {
        return res.status(500).json({ error: "Failed to generate image data" });
      }

      res.json({ imageBase64: base64Image, mimeType });
    } catch (error: any) {
      console.error("Generate logo error:", error);
      res.status(500).json({ error: error.message || "Failed to generate logo" });
    }
  });

  app.post("/api/generate-video", async (req, res) => {
    try {
      const { prompt, imageBytes, mimeType, aspectRatio } = req.body;
      if (!imageBytes || !mimeType) {
        return res.status(400).json({ error: "Image data is required" });
      }

      const operation = await ai.models.generateVideos({
        model: "veo-3.1-fast-generate-preview",
        prompt: prompt || "Animate this logo smoothly and beautifully.",
        image: {
          imageBytes,
          mimeType,
        },
        config: {
          numberOfVideos: 1,
          resolution: "1080p", // Trying 1080p, as requested for fast generate might support it
          aspectRatio: aspectRatio || "16:9",
        },
      });

      res.json({ operationName: operation.name });
    } catch (error: any) {
      console.error("Generate video error:", error);
      res.status(500).json({ error: error.message || "Failed to start video generation" });
    }
  });

  app.post("/api/video-status", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });

      const op = new GenerateVideosOperation();
      op.name = operationName;
      
      const updated = await ai.operations.getVideosOperation({ operation: op });
      res.json({ done: updated.done, error: updated.error });
    } catch (error: any) {
      console.error("Video status error:", error);
      res.status(500).json({ error: error.message || "Failed to check video status" });
    }
  });

  app.post("/api/video-download", async (req, res) => {
    try {
      const { operationName } = req.body;
      if (!operationName) return res.status(400).json({ error: "Operation name required" });

      const op = new GenerateVideosOperation();
      op.name = operationName;

      const updated = await ai.operations.getVideosOperation({ operation: op });
      const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!uri) {
        return res.status(404).json({ error: "Video URI not found" });
      }

      const videoRes = await fetch(uri, {
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY as string },
      });

      res.setHeader("Content-Type", "video/mp4");
      
      // Node 18+ Web Streams to Express Writable interoperability
      if (videoRes.body) {
        const reader = videoRes.body.getReader();
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              res.end();
              break;
            }
            res.write(value);
          }
        };
        await pump();
      } else {
        res.status(500).json({ error: "No video body received" });
      }
    } catch (error: any) {
      console.error("Video download error:", error);
      res.status(500).json({ error: error.message || "Failed to download video" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
