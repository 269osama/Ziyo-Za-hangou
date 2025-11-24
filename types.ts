export interface Novel {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl: string;
  tags: string[];
  status: 'Ongoing' | 'Completed';
  lastUpdated?: string;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  content: string; // Markdown or plain text
  chapterNumber: number;
}

export interface LibraryItem extends Novel {
  downloaded: boolean;
  lastReadChapter: number;
  totalChapters: number; // Simulated count
  savedAt: number;
}

export type ViewState = 'library' | 'search' | 'reader';

export interface ReaderSettings {
  fontSize: number;
  fontFamily: 'serif' | 'sans';
  theme: 'light' | 'sepia' | 'dark';
}