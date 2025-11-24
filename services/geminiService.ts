import { GoogleGenAI, Type } from "@google/genai";
import { Novel } from "../types";

// Lazy initialization to prevent top-level crashes on module load
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    // process.env.API_KEY is replaced by Vite at build time via define
    // We casts it to string to satisfy TS, though define handles the replacement
    const apiKey = process.env.API_KEY as string;
    
    if (!apiKey || apiKey === 'MISSING_API_KEY' || apiKey === '') {
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

/**
 * Searches for light novels based on a query using Gemini's knowledge base.
 */
export const searchNovels = async (query: string): Promise<Novel[]> => {
  try {
    const client = getAiClient();
    if (!client) {
        throw new Error("API_KEY_MISSING");
    }

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

    let jsonStr = response.text || "[]";
    
    // Robust cleanup: remove markdown and find the array
    jsonStr = jsonStr.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    
    // Extract strictly the JSON array part if there's surrounding text
    const firstBracket = jsonStr.indexOf('[');
    const lastBracket = jsonStr.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
        jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }

    const data = JSON.parse(jsonStr);
    
    // Enrich with random cover URLs since the model can't browse for real images reliably without grounding tools
    return data.map((item: any, index: number) => ({
      ...item,
      coverUrl: `https://picsum.photos/300/450?random=${Math.floor(Math.random() * 1000) + index}`,
      lastUpdated: new Date().toISOString()
    }));

  } catch (error: any) {
    console.error("Gemini Search Error:", error);
    if (error.message === "API_KEY_MISSING") {
        throw new Error("API_KEY_MISSING");
    }
    // Handle JSON parse errors gracefully
    if (error instanceof SyntaxError) {
        console.error("Failed to parse JSON:", error);
        throw new Error("AI response was malformed. Please try again.");
    }
    throw new Error("Failed to fetch novels. The AI service might be busy.");
  }
};

/**
 * Generates the content of a chapter.
 */
export const downloadChapterContent = async (novelTitle: string, chapterNumber: number): Promise<string> => {
  try {
    const client = getAiClient();
    if (!client) throw new Error("API_KEY_MISSING");

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

    let text = response.text || "Failed to download chapter content.";
    
    // Remove markdown code blocks if the model accidentally wrapped the whole text
    text = text.replace(/^```(markdown|md)?\s*/i, "").replace(/\s*```$/, "");

    return text;
  } catch (error: any) {
    console.error("Gemini Download Error:", error);
    if (error.message === "API_KEY_MISSING") {
        throw new Error("API Key is missing.");
    }
    throw new Error("Failed to download content. Please check your connection or API limit.");
  }
};