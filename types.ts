
export enum AppMode {
  DEFAULT = 'DEFAULT',
  HEARTS = 'HEARTS',
  CUSTOM = 'CUSTOM',
  LYRICS = 'LYRICS'
}

export enum Theme {
  BLACK = 'black',
  WHITE = 'white'
}

export interface LyricResult {
  lyrics: string;
  songTitle: string;
  artist: string;
  releaseYear: string;
  vibeDescription: string;
  palette: string[];
}

export interface SearchResult {
  imageUrl: string;
  title: string;
  artist: string;
}
