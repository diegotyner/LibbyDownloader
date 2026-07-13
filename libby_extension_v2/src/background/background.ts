// allUrls: ordered array of { url, chapterKey, filename, downloaded }
// downloadedKeys: Set of chapterKeys for fast skip-check lookups

import type { CaptureEntry, ExtensionState } from "../shared/types";
import type {
  BgRequest,
  ContentToBgRequest,
  BgResponse,
} from "../shared/messages";

/*
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
}
*/

function returnDefaultState(): ExtensionState {
  return {
    bookTitle: "libby",
    mode: "passive",
    downloadsEnabled: false,
    isActive: false,
    captures: [],
    lastCaptureLabel: null,
    titleChangeWarning: null,
  };
}
let backgroundState: ExtensionState = returnDefaultState();
let downloadedKeys = new Set<string>();
let lastDownloadTime = 0;

const urls_to_listen = [
  "*://*.libbyapp.com/*",
  "*://*.listen.overdrive.com/*",
  "*://*.cdn.overdrive.com/*",
];

// On startup, restore history from storage
chrome.storage.local.get(
  ["backgroundState"],
  (result: { backgroundState: ExtensionState }) => {
    if (result.backgroundState) {
      backgroundState = result.backgroundState;
      let allUrls = backgroundState.captures; // This works as a pointer doesnt it?
      downloadedKeys = new Set(
        allUrls.filter((e) => e.downloaded).map((e) => e.chapterKey),
      );
      console.log(
        `[bg.ts] Restored ${allUrls.length} chapters (${downloadedKeys.size} already downloaded).`,
      );
    }
  },
);

function persistHistory() {
  chrome.storage.local.set({ backgroundState });
}

// Extract stable chapter identity from the referrer (from) URL
// e.g. "...Fmt425-Part03.mp3?..." → "Part03"
function getChapterKey(url: string) {
  const match = url.match(/Part\d+/i);
  return match ? match[0] : url;
}

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const chapterKey = getChapterKey(details.url); // stable, from referrer
    const redirectUrl = details.redirectUrl; // signed CDN url, changes each time

    let allUrls = backgroundState.captures;
    const alreadyKnown = allUrls.some((e) => e.chapterKey === chapterKey);

    if (alreadyKnown) {
      if (downloadedKeys.has(chapterKey)) {
        console.log(`[bg.ts] Already downloaded, skipping: ${chapterKey}`);
        return;
      }
      // Seen before but not downloaded (was paused) — refresh url and fall through
      console.log(
        `[bg.ts] Previously sniffed but not downloaded, retrying: ${chapterKey}`,
      );
      const entry = allUrls.find((e) => e.chapterKey === chapterKey);
      if (entry) {
        entry.url = redirectUrl; // refresh signed url in case old one expired
      }
    } else {
      // Brand new chapter
      const filename = `${backgroundState.bookTitle}_${chapterKey}.mp3`;
      let newCap: CaptureEntry = {
        url: redirectUrl,
        chapterKey: chapterKey,
        filename: filename,
        downloaded: false,
        timestamp: Date.now(),
      };
      allUrls.push(newCap);
      persistHistory();
      console.log(`[bg.ts] New chapter sniffed: ${chapterKey} → ${filename}`);
    }

    if (!backgroundState.downloadsEnabled) {
      console.log(
        "[bg.ts] Downloads paused, chapter saved but not downloaded.",
      );
      return;
    }

    const entry = allUrls.find((e) => e.chapterKey === chapterKey);
    if (!entry) {
      console.error(`[bg.ts] Could not find entry for ${chapterKey}`);
      return;
    }

    const now = Date.now();
    const delayNeeded = 500 - (now - lastDownloadTime);

    if (delayNeeded > 0) {
      setTimeout(() => initiateDownload(entry), delayNeeded);
    } else {
      initiateDownload(entry);
    }
    lastDownloadTime = Date.now();
  },
  { urls: urls_to_listen },
);

function initiateDownload(entry: CaptureEntry) {
  return new Promise<void>((resolve, reject) => {
    chrome.downloads.download(
      { url: entry.url, filename: entry.filename, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(
            `[bg.ts] Download failed for ${entry.filename}:`,
            chrome.runtime.lastError.message,
          );
          reject(chrome.runtime.lastError.message);
          return;
        } else if (downloadId === undefined) {
          console.error(`[bg.ts] Download failed: undefined ID (${entry.url})`);
          reject("[bg.ts] Download ID undefined");
          return;
        }

        console.log(
          `[bg.ts] Download started: ${entry.filename} (ID: ${downloadId})`,
        );
        entry.downloaded = true;
        downloadedKeys.add(entry.chapterKey);
        persistHistory();
        resolve();
      },
    );
  });
}
function setBookTitle(newTitle: string) {
  const prevTitle = backgroundState.bookTitle;
  const isRealChange =
    prevTitle !== "libby" &&
    newTitle !== "libby" &&
    newTitle !== prevTitle &&
    backgroundState.captures.length > 0;

  if (isRealChange) {
    console.warn(
      `[bg.ts] Title changed mid-session: "${prevTitle}" -> "${newTitle}".`,
    );
    backgroundState.titleChangeWarning = `Detected "${newTitle}" but history exists for "${prevTitle}". Clear history before continuing?`;
  }

  backgroundState.bookTitle = newTitle;

  // fix filenames for any entries sniffed before the title was known
  const allUrls = backgroundState.captures;
  allUrls.forEach((e) => {
    if (e.filename.startsWith("libby_")) {
      e.filename = `${newTitle}_${e.chapterKey}.mp3`;
    }
  });

  persistHistory();
}

chrome.runtime.onMessage.addListener(
  (
    request: BgRequest | ContentToBgRequest,
    _sender,
    sendResponse: (r: BgResponse) => void,
  ) => {
    let allUrls = backgroundState.captures;

    if (request.type === "CONTENT_SCRIPT_LOADED") {
      if (backgroundState.downloadsEnabled) {
        console.log(
          "[bg.ts] Content script reloaded mid-session — disabling downloads.",
        );
        backgroundState.downloadsEnabled = false;
        persistHistory();
      }
      // no sendResponse needed — fire-and-forget, same pattern as SET_BOOK_TITLE
      return true;
    }

    if (request.type === "ENABLE_DOWNLOADS") {
      backgroundState.downloadsEnabled = true;
      console.log("[bg.ts] Downloads enabled.");
      sendResponse({
        status: "downloads_enabled",
        urlsCaptured: allUrls.length,
        urlsDownloaded: downloadedKeys.size,
      });
      persistHistory();
      return true;
    }

    if (
      request.type === "DISABLE_DOWNLOADS" ||
      request.type === "EXPORT_URLS_COMPLETE"
    ) {
      backgroundState.downloadsEnabled = false;
      console.log(`[bg.ts] Received request: ${request.type}`);
      sendResponse({ status: "downloads_disabled" });
      persistHistory();
      return true;
    }

    if (request.type === "SET_MODE") {
      backgroundState.mode = request.mode;
      console.log(`[bg.ts] Mode set to ${request.mode}`);
      sendResponse({ status: "ok" });
      persistHistory();
      return true;
    }

    if (request.type === "GET_STATE") {
      sendResponse({
        status: "ok",
        downloadsEnabled: backgroundState.downloadsEnabled,
        urlsCaptured: allUrls.length,
        urlsDownloaded: downloadedKeys.size,
      });
      return true;
    }

    if (request.type === "CLEAR_HISTORY") {
      downloadedKeys = new Set();
      chrome.storage.local.remove("backgroundState");
      backgroundState = returnDefaultState();
      console.log("[bg.ts] Session history cleared.");
      sendResponse({ status: "cleared" });
      return true;
    }

    if (request.type === "SET_BOOK_TITLE") {
      setBookTitle(request.bookTitle);
      console.log(
        `[bg.ts] Title set (pre-Start): ${backgroundState.bookTitle}`,
      );
      return true;
    }

    if (request.type === "DOWNLOAD_FIRST_PART") {
      setBookTitle(request.bookTitle);
      console.log(`[bg.ts] Starting book: ${backgroundState.bookTitle}`);

      const firstEntry = allUrls[0];
      if (!firstEntry) {
        console.log("[bg.ts] No chapters captured yet.");
        sendResponse({ status: "ok" });
        return true;
      }

      if (allUrls.length === 1 && !firstEntry.downloaded) {
        console.log(`Recovering first chapter: ${firstEntry.chapterKey}`);
        initiateDownload(firstEntry);
      } else if (allUrls.length != 1) {
        // ensure its a clean start
        console.log(
          `[bg.ts] Skipping recovery: ${allUrls.length} chapters already captured, not a clean start.`,
        );
      } else {
        console.log(
          "[bg.ts] No recovery needed: first chapter already downloaded.",
        );
      }

      sendResponse({ status: "ok" });
      return true;
    }

    if (request.type === "SAVE_COVER") {
      const filename = `${backgroundState.bookTitle}_cover.jpg`;
      chrome.downloads.download(
        { url: request.url, filename, saveAs: false },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Cover download failed:",
              chrome.runtime.lastError.message,
            );
          } else {
            console.log(
              `[bg.ts] Cover downloaded: ${filename} (ID: ${downloadId})`,
            );
          }
        },
      );
      sendResponse({ status: "ok" });
      return true;
    }

    return true;
  },
);
