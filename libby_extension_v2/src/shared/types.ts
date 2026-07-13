export type Mode = "click" | "passive";

export interface CaptureEntry {
  url: string;
  chapterKey: string;
  filename: string;
  downloaded: boolean;
  timestamp: number;
}

export interface ExtensionState {
  bookTitle: string;
  mode: Mode;
  downloadsEnabled: boolean;
  isActive: boolean; // is content.ts currently clicking/listening right now
  captures: CaptureEntry[];
  lastCaptureLabel: string | null; // e.g. "Captured new snippet: Part 4"
  titleChangeWarning: string | null;
}
