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

export interface ChapterMetadata {
  id: string; // usually just the number string
  novelId: string;
  title: string;
  chapterNumber: number;
}

export interface LibraryItem extends Novel {
  downloaded: boolean; // true if the NOVEL metadata is saved
  totalChapters: number; 
  savedAt: number;
  chapters: ChapterMetadata[]; // List of available chapters
  lastReadChapterId?: string;
}

export type ViewState = 'library' | 'search' | 'reader';

export interface ReaderSettings {
  fontSize: number;
  fontFamily: 'serif' | 'sans' | 'mono';
  theme: 'future' | 'light' | 'sepia' | 'dark';
  lineHeight: number;
  autoGenerateImage: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
}