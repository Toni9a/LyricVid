
import { GoogleGenAI, Type } from "@google/genai";
import { LyricResult } from "../types";

export class GeminiService {
  private static getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  }

  /**
   * Fetches song data. Strictly text-only metadata.
   */
  public static async fetchLyricsAndVibe(query: string): Promise<LyricResult> {
    const ai = this.getAI();
    
    // Explicitly requesting the most popular song if an album is named, 
    // or identifying the specific track if a lyric/title is provided.
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a precision metadata retrieval engine. Identify the song and artist for: "${query}".
      
      STRICT RULES:
      1. DO NOT imagine or generate images.
      2. Return ONLY the JSON object. 
      3. If the user provides an album title like "Blonde", identify the lead or most popular track from it.
      4. Ensure you provide the ORIGINAL release year.

      Data points to return:
      - lyrics: A substantial portion of the lyrics.
      - songTitle: The exact track name.
      - artist: The artist name.
      - releaseYear: The release year (e.g. "2016").
      - vibeDescription: A short poetic vibe description.
      - palette: 3 HEX colors matching the song's cover/mood.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lyrics: { type: Type.STRING },
            songTitle: { type: Type.STRING },
            artist: { type: Type.STRING },
            releaseYear: { type: Type.STRING },
            vibeDescription: { type: Type.STRING },
            palette: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }
            },
          },
          required: ["lyrics", "songTitle", "artist", "releaseYear", "vibeDescription", "palette"],
        },
      },
    });

    // CRITICAL: response.text is a getter that might return undefined if the model's output is blocked or empty.
    const rawText = response.text;
    if (!rawText) {
      console.error("Gemini returned an empty or blocked response.", response);
      throw new Error("Empty response from AI engine.");
    }

    try {
      // Sometimes models wrap JSON in markdown blocks even with responseMimeType set.
      const cleanJson = rawText.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Gemini JSON Parsing Failed. Raw text:", rawText);
      throw new Error("Could not parse song data.");
    }
  }

  public static async enhancePoem(text: string): Promise<string> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transform this note into a deeply beautiful and concise poetic message (max 35 words): "${text}"`,
    });
    return response.text || text;
  }
}
