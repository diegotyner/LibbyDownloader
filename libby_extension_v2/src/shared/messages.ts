import type { Mode } from "./types";

// ── Popup -> Background ──────────────────────────────────────────
export type BgRequest =
  | { type: "ENABLE_DOWNLOADS" }
  | { type: "DISABLE_DOWNLOADS" }
  | { type: "GET_STATE" }
  | { type: "CLEAR_HISTORY" }
  | { type: "SET_MODE"; mode: Mode } // not yet implemented in background.ts — mode toggle deferred
  | { type: "SAVE_COVER"; url: string };

// ── Background responses to the above (by request type) ─────────
export type BgResponse =
  | {
      status: "downloads_enabled";
      urlsCaptured: number;
      urlsDownloaded: number;
    }
  | { status: "downloads_disabled" }
  | { status: "cleared" }
  | { status: "ok" }
  | {
      status: "ok";
      downloadsEnabled: boolean;
      urlsCaptured: number;
      urlsDownloaded: number;
    };

// ── Content script -> Background ─────────────────────────────────
export type ContentToBgRequest =
  | { type: "DOWNLOAD_FIRST_PART"; bookTitle: string }
  | { type: "EXPORT_URLS_COMPLETE" }
  | { type: "SET_BOOK_TITLE"; bookTitle: string };

// ── Popup -> Content script ──────────────────────────────────────
export type ContentRequest =
  | { type: "START_CLICKING"; min: number; max: number }
  | { type: "STOP_CLICKING" }
  | { type: "DOWNLOAD_COVER" }
  | { type: "GET_TITLE" };

// ── Content script response shapes ────────────────────────────────
export type ContentResponse =
  | { status: "already_active" }
  | { status: "started" }
  | { status: "stopped" }
  | { status: "not_active" }
  | { status: "found"; url: string }
  | { status: "not_found" }
  | { status: "title_found" }
  | { status: "title_not_found" };
