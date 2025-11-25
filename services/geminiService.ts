import { GoogleGenAI, Type } from "@google/genai";
import { Novel, ChapterMetadata } from "../types";

// Lazy initialization to prevent top-level crashes on module load
let ai: GoogleGenAI | null = null;

const getAiClient = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.warn("Gemini Service: API Key is missing.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

// Helper to clean JSON strings from Markdown
const cleanJson = (text: string) => {
    let clean = text.replace(/```\w*\n?/g, '').replace(/```/g, '').trim();
    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1) {
        clean = clean.substring(firstBracket, lastBracket + 1);
    }
    return clean;
};

/**
 * Searches for light novels using Google Search grounding to find real covers.
 */
export const searchNovels = async (query: string): Promise<Novel[]> => {
  try {
    const client = getAiClient();
    if (!client) throw new Error("API_KEY_MISSING");

    const model = 'gemini-2.5-flash';
    // Improved prompt to ask for stable image sources
    const prompt = `
      Search for the light novel series: "${query}".
      Find 4 distinct results.
      For each, find:
      1. Precise Title
      2. Author Name
      3. A brief 1-sentence description
      4. Status (Ongoing/Completed)
      5. A direct URL to the Cover Image. PREFER URLs from: Wikimedia, Wikipedia, Amazon, or GoodReads. Avoid URLs that look like temporary session links.
      
      Return the result strictly as a JSON array with these keys:
      id (generate a random string), title, author, description, coverUrl, tags (array of strings), status.
    `;

    const response = await client.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    let jsonStr = response.text || "[]";
    jsonStr = cleanJson(jsonStr);

    const data = JSON.parse(jsonStr);
    
    // Validation and Fallback for broken images
    return data.map((item: any, index: number) => ({
      ...item,
      id: item.id || `novel_${Date.now()}_${index}`,
      tags: item.tags || ['Novel'],
      // Basic check if it looks like a URL
      coverUrl: (item.coverUrl && item.coverUrl.startsWith('http')) 
        ? item.coverUrl 
        : `https://via.placeholder.com/300x450.png?text=${encodeURIComponent(item.title)}`
    }));

  } catch (error: any) {
    console.error("Gemini Search Error:", error);
    if (error.message === "API_KEY_MISSING") throw new Error("API_KEY_MISSING");
    throw new Error("Failed to search. Please try again.");
  }
};

/**
 * Returns a static list of highly rated novels to ensure instant load and valid images.
 * AI fetching is too slow and unreliable for the "Home" screen first impression.
 */
export const getFeaturedNovels = async (): Promise<Novel[]> => {
    // Static curated list with stable Wikimedia/high-quality URLs
    const curated: Novel[] = [
        {
            id: 'sl_001',
            title: 'Solo Leveling',
            author: 'Chugong',
            description: 'From the weakest hunter to the strongest.',
            status: 'Completed',
            tags: ['Action', 'Fantasy'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/9/9a/Solo_Leveling_Webtoon_cover.png'
        },
        {
            id: 'mt_001',
            title: 'Mushoku Tensei',
            author: 'Rifujin na Magonote',
            description: 'A jobless man reincarnates in a fantasy world.',
            status: 'Completed',
            tags: ['Isekai', 'Drama'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c4/Mushoku_Tensei_light_novel_volume_1_cover.jpg'
        },
        {
            id: 'overlord_001',
            title: 'Overlord',
            author: 'Kugane Maruyama',
            description: 'A skeletal wizard conquers a new world.',
            status: 'Ongoing',
            tags: ['Dark Fantasy', 'Game'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/5/50/Overlord_volume_1_cover.jpg'
        },
        {
            id: 'slime_001',
            title: 'That Time I Got Reincarnated as a Slime',
            author: 'Fuse',
            description: 'A salaryman dies and wakes up as a slime.',
            status: 'Ongoing',
            tags: ['Isekai', 'Fantasy'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/8/87/Tensei_Shitara_Slime_Datta_Ken_volume_1_cover.jpg'
        },
        {
            id: 'rezero_001',
            title: 'Re:Zero - Starting Life in Another World',
            author: 'Tappei Nagatsuki',
            description: 'Subaru Natsuki can return by death.',
            status: 'Ongoing',
            tags: ['Psychological', 'Thriller'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Re-Zero_kara_Hajimeru_Isekai_Seikatsu_light_novel_volume_1_cover.jpg'
        },
        {
            id: 'cote_001',
            title: 'Classroom of the Elite',
            author: 'Shōgo Kinugasa',
            description: 'Students compete for points in a cutthroat school.',
            status: 'Ongoing',
            tags: ['Psychological', 'School'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/3/36/Classroom_of_the_Elite_volume_1_cover.jpg'
        },
        {
            id: 'sao_001',
            title: 'Sword Art Online',
            author: 'Reki Kawahara',
            description: 'Trapped in a VRMMORPG where death is real.',
            status: 'Ongoing',
            tags: ['Sci-Fi', 'Adventure'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/2/20/Sword_Art_Online_Light_Novel_Volume_01.jpg'
        },
        {
            id: 'ngnl_001',
            title: 'No Game No Life',
            author: 'Yuu Kamiya',
            description: 'Siblings conquer a world ruled by games.',
            status: 'Ongoing',
            tags: ['Fantasy', 'Game'],
            coverUrl: 'https://upload.wikimedia.org/wikipedia/en/3/3d/No_Game_No_Life_vol._1.png'
        }
    ];

    // Wrap in promise to match interface
    return Promise.resolve(curated);
};

/**
 * Generates a list of chapters for a novel.
 */
export const getChapterList = async (novelTitle: string): Promise<ChapterMetadata[]> => {
    const client = getAiClient();
    if (!client) throw new Error("API_KEY_MISSING");

    // We ask the model to generate a plausible list of chapters
    const prompt = `
        Generate a list of the first 20 chapter titles for the light novel "${novelTitle}".
        Return a JSON array of objects with keys: "chapterNumber" (number) and "title" (string).
        Example: [{"chapterNumber": 1, "title": "Prologue"}, ...]
    `;

    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    const data = JSON.parse(cleanJson(response.text || "[]"));
    return data.map((ch: any) => ({
        id: ch.chapterNumber.toString(),
        novelId: novelTitle, // simplistic linking
        title: ch.title,
        chapterNumber: ch.chapterNumber
    }));
};

/**
 * Generates the content of a specific chapter.
 */
export const downloadChapterContent = async (novelTitle: string, chapterNumber: number, chapterTitle: string): Promise<string> => {
  const client = getAiClient();
  if (!client) throw new Error("API_KEY_MISSING");

  const prompt = `
    Write the full content for Chapter ${chapterNumber}: "${chapterTitle}" of the light novel "${novelTitle}".
    
    Style guide:
    - Write in the style of a professional light novel translation.
    - 1500-2500 words.
    - Use dialogue heavily.
    - Use standard Markdown.
    - Do NOT include the chapter title at the beginning, just the story text.
  `;

  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  let text = response.text || "";
  text = text.replace(/^```(markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  
  if (!text || text.length < 100) {
      throw new Error("Generated content too short or empty.");
  }

  return text;
};

/**
 * Generates an image visualizing the chapter summary.
 */
export const generateChapterImage = async (chapterContent: string): Promise<string> => {
    const client = getAiClient();
    if (!client) throw new Error("API_KEY_MISSING");

    // 1. First, summarize the scene to get a clean prompt
    const summaryPrompt = `Describe a single, epic visual scene that represents the climax or summary of this text in 50 words: \n\n${chapterContent.substring(0, 5000)}`;
    
    const summaryResponse = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: summaryPrompt
    });
    const sceneDescription = summaryResponse.text;

    // 2. Generate the image
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [{ text: `Anime style illustration, high quality light novel cover art style, cinematic lighting, 8k resolution: ${sceneDescription}` }]
        }
    });

    // Extract base64
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error("Failed to generate image");
};