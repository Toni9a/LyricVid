
import { SearchResult } from "../types";

export class MusicService {
  /**
   * Finds the most accurate album art by performing a multi-entity search.
   */
  public static async findAlbumArt(query: string, artist?: string, year?: string): Promise<SearchResult> {
    // We search for both 'album' and 'musicTrack' to ensure we find a cover 
    // regardless of whether the query resolved to a song title or album title.
    const searchTerm = artist ? `${artist} ${query}` : query;
    const encodedQuery = encodeURIComponent(searchTerm);
    
    const trackUrl = `https://itunes.apple.com/search?term=${encodedQuery}&entity=musicTrack&limit=5`;
    const albumUrl = `https://itunes.apple.com/search?term=${encodedQuery}&entity=album&limit=5`;
    
    try {
      // Execute both searches in parallel for speed and reliability
      const [trackRes, albumRes] = await Promise.all([
        fetch(trackUrl).then(r => r.json()),
        fetch(albumUrl).then(r => r.json())
      ]);

      const allResults = [...(trackRes.results || []), ...(albumRes.results || [])];

      if (allResults.length === 0) {
        throw new Error("Artwork not found.");
      }

      // Selection Strategy:
      // 1. Try to find a result that matches the release year if provided.
      // 2. Otherwise, take the first result (usually the most popular).
      let bestMatch = allResults[0];

      if (year) {
        const yearMatch = allResults.find((r: any) => 
          r.releaseDate && r.releaseDate.startsWith(year)
        );
        if (yearMatch) bestMatch = yearMatch;
      }

      return this.formatResult(bestMatch);
    } catch (error) {
      console.error("Music Search Engine Failure:", error);
      throw error;
    }
  }

  private static formatResult(result: any): SearchResult {
    const baseArt = result.artworkUrl100 || '';
    // iTunes API returns 100x100 by default; we force 1000x1000 for high-quality dither backgrounds.
    const highResUrl = baseArt.replace('100x100bb', '1000x1000bb');
    
    return {
      imageUrl: highResUrl,
      title: result.collectionName || result.trackName || "Unknown",
      artist: result.artistName || "Unknown"
    };
  }
}
