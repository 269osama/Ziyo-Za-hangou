import { GoogleGenAI, Type } from "@google/genai";
import { Novel } from "../types";

// Lazy initialization to prevent top-level crashes on module load
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("API_KEY is missing from environment variables");
      // Prevent crash by using a dummy key if missing, 
      // though API calls will fail gracefully later
      ai = new GoogleGenAI({ apiKey: 'MISSING_API_KEY' }); 
    } else {
      ai = new GoogleGenAI({ apiKey });
    }
  }
  return ai;
};

/**
 * Searches for light novels based on a query using Gemini's knowledge base.
 */
export const searchNovels = async (query: string): Promise<Novel[]> => {
  try {
    const client = getAiClient();
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are a light novel database assistant.
      User is searching for: "${query}".
      Return a list of 5 popular or relevant light novels (Japanese, Korean, or Chinese web novels) that match this query.
      If the query is empty, return 5 currently trending light novels.
      
      Generate a valid JSON response.
      Use https://picsum.photos/300/450?random=[random_number] for the coverUrl.
    `;

    const response = await client.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              description: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              status: { type: Type.STRING, enum: ["Ongoing", "Completed"] },
            },
            required: ["id", "title", "author", "description", "tags", "status"],
          },
        },
      },
    });

    const data = JSON.parse(response.text || "[]");
    
    // Enrich with random cover URLs since the model can't browse for real images reliably without grounding tools
    return data.map((item: any, index: number) => ({
      ...item,
      coverUrl: `https://picsum.photos/300/450?random=${Math.floor(Math.random() * 1000)}`,
      lastUpdated: new Date().toISOString()
    }));

  } catch (error) {
    console.error("Gemini Search Error:", error);
    return [];
  }
};

/**
 * Generates the content of a chapter.
 */
export const downloadChapterContent = async (novelTitle: string, chapterNumber: number): Promise<string> => {
  try {
    const client = getAiClient();
    const model = 'gemini-2.5-flash';
    const prompt = `
      Write the full content for Chapter ${chapterNumber} of the light novel "${novelTitle}".
      
      Style guide:
      - Write in the style of a professional light novel translation.
      - 1500-2000 words.
      - Use dialogue heavily.
      - Include a chapter title at the top in Markdown H1 format (# Title).
      - Use standard Markdown for formatting.
      - If you don't know the exact real content, write a highly plausible creative continuation or opening consistent with the genre and title.
    `;

    const response = await client.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Failed to download chapter content.";
  } catch (error) {
    console.error("Gemini Download Error:", error);
    return "# Error\n\nFailed to download content. Please check your internet connection.";
  }
};