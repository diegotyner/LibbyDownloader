// allUrls: ordered array of { url, chapterKey, filename, downloaded }
// downloadedKeys: Set of chapterKeys for fast skip-check lookups
let allUrls = [];
let downloadedKeys = new Set();
let downloadsEnabled = false;
let lastDownloadTime = 0;
let bookTitle = "libby"; // default fallback

const urls_to_listen = [
  "*://*.libbyapp.com/*",
  "*://*.listen.overdrive.com/*",
  "*://*.cdn.overdrive.com/*",
];

// On startup, restore history from storage
chrome.storage.local.get(["allUrls"], (result) => {
  if (result.allUrls) {
    allUrls = result.allUrls;
    downloadedKeys = new Set(
      allUrls.filter((e) => e.downloaded).map((e) => e.chapterKey),
    );
    console.log(
      `Restored ${allUrls.length} chapters (${downloadedKeys.size} already downloaded).`,
    );
  }
});

function persistHistory() {
  chrome.storage.local.set({ allUrls });
}

// Extract stable chapter identity from the referrer (from) URL
// e.g. "...Fmt425-Part03.mp3?..." → "Part03"
function getChapterKey(url) {
  const match = url.match(/Part\d+/i);
  return match ? match[0] : url;
}

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const chapterKey = getChapterKey(details.url); // stable, from referrer
    const redirectUrl = details.redirectUrl; // signed CDN url, changes each time

    const alreadyKnown = allUrls.some((e) => e.chapterKey === chapterKey);

    if (alreadyKnown) {
      if (downloadedKeys.has(chapterKey)) {
        console.log(`Already downloaded, skipping: ${chapterKey}`);
        return;
      }
      // Seen before but not downloaded (was paused) — refresh url and fall through
      console.log(
        `Previously sniffed but not downloaded, retrying: ${chapterKey}`,
      );
      const entry = allUrls.find((e) => e.chapterKey === chapterKey);
      entry.url = redirectUrl; // refresh signed url in case old one expired
    } else {
      // Brand new chapter
      const filename = `${bookTitle}_${chapterKey.toString().padStart(3, "0")}.mp3`;
      allUrls.push({
        url: redirectUrl,
        chapterKey,
        filename,
        downloaded: false,
      });
      persistHistory();
      console.log(`New chapter sniffed: ${chapterKey} → ${filename}`);
    }

    if (!downloadsEnabled) {
      console.log("Downloads paused, chapter saved but not downloaded.");
      return;
    }

    const entry = allUrls.find((e) => e.chapterKey === chapterKey);
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

function initiateDownload(entry) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: entry.url, filename: entry.filename, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Download failed for ${entry.filename}:`,
            chrome.runtime.lastError.message,
          );
          reject(chrome.runtime.lastError.message);
        } else if (downloadId === undefined) {
          console.error(`Download failed: undefined ID (${entry.url})`);
          reject("Download ID undefined");
        } else {
          console.log(
            `Download started: ${entry.filename} (ID: ${downloadId})`,
          );
          entry.downloaded = true;
          downloadedKeys.add(entry.chapterKey);
          persistHistory();
          resolve();
        }
      },
    );
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ENABLE_DOWNLOADS") {
    downloadsEnabled = true;
    console.log("Downloads enabled.");
    sendResponse({
      status: "downloads_enabled",
      urlsCaptured: allUrls.length,
      urlsDownloaded: downloadedKeys.size,
    });
  } else if (
    request.type === "DISABLE_DOWNLOADS" ||
    request.type === "EXPORT_URLS_COMPLETE"
  ) {
    downloadsEnabled = false;
    console.log(request.type);
    sendResponse({ status: "downloads_disabled" });
  } else if (request.type === "GET_STATE") {
    sendResponse({
      downloadsEnabled,
      urlsCaptured: allUrls.length,
      urlsDownloaded: downloadedKeys.size,
    });
  } else if (request.type === "CLEAR_HISTORY") {
    allUrls = [];
    downloadedKeys = new Set();
    chrome.storage.local.remove("allUrls");
    console.log("Session history cleared.");
    sendResponse({ status: "cleared" });
  } else if (request.type === "DOWNLOAD_FIRST_PART") {
    bookTitle = request.bookTitle;
    console.log(`Starting book: ${bookTitle}`);

    // always fix filenames for any entries sniffed before title was known
    allUrls.forEach((e) => {
      if (e.filename.startsWith("libby_")) {
        e.filename = `${bookTitle}_${e.chapterKey}.mp3`;
      }
    });
    persistHistory();

    const isOnlyOneCapture = allUrls.length === 1;
    const firstEntry = allUrls[0];
    const isUndownloaded = firstEntry && !firstEntry.downloaded;

    if (isOnlyOneCapture && isUndownloaded) {
      console.log(`Recovering first chapter: ${firstEntry.chapterKey}`);
      initiateDownload(firstEntry);
    } else if (!isOnlyOneCapture) {
      console.log(
        `Skipping recovery: ${allUrls.length} chapters already captured, not a clean start.`,
      );
    } else {
      console.log("No recovery needed: first chapter already downloaded.");
    }
    sendResponse({ status: "ok" });
  }

  return true;
});
