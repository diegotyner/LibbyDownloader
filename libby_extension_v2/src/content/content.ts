import type {
  ContentRequest,
  ContentToBgRequest,
  ContentResponse,
} from "../shared/messages";

chrome.runtime.sendMessage<ContentToBgRequest>({
  type: "CONTENT_SCRIPT_LOADED",
});
const scrapedTitle = scrapeBookTitle();
if (scrapedTitle) {
  chrome.runtime.sendMessage<ContentToBgRequest>({
    type: "SET_BOOK_TITLE",
    bookTitle: scrapedTitle,
  });
}

function randomDelay(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clickElement(el: Element) {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let clickInterval: ReturnType<typeof setTimeout> | null = null;

function scheduleNextClick(min: number, max: number) {
  clickInterval = setTimeout(
    () => {
      const nextBtn = document.querySelector("button.chapter-bar-next-button");

      if (!nextBtn) {
        console.log("[ctnt.ts]Next button not found, stopping.");
        clickInterval = null;
        return;
      }

      const label = nextBtn.getAttribute("aria-label") || "";

      if (label.includes("Next Chapter")) {
        clickElement(nextBtn);
        console.log("[ctnt.ts]Clicked: Next Chapter");
        scheduleNextClick(min, max); // reschedule after each click
      } else if (label.includes("End Of Audiobook")) {
        console.log("[ctnt.ts]End found, exiting...");
        clickElement(nextBtn);
        clickInterval = null;
        setTimeout(() => {
          chrome.runtime.sendMessage<ContentToBgRequest>({
            type: "EXPORT_URLS_COMPLETE",
          });
        }, 3000);
      } else {
        // Button exists but label doesn't match — retry
        scheduleNextClick(min, max);
      }
    },
    randomDelay(min, max),
  );
}

function scrapeBookTitle(): string | null {
  if (!document.title) {
    // || !document.title.startsWith("Libby - Open:")) {
    return null; // not on a book page at all
  }

  return document.title
    .replace("Libby - Open: ", "")
    .trim()
    .replace(/ /g, "_")
    .replace(/[<>:"/\\|?*]/g, "");
}

async function startChapterSkipping(min: number, max: number) {
  await sleep(200); // let dom settle
  const prevBtn = document.querySelector("button.chapter-bar-prev-button");
  const nextBtn = document.querySelector("button.chapter-bar-next-button");

  // This rejects the worker in the incorret frame
  if (!(prevBtn || nextBtn)) {
    console.log("[ctnt.ts] Buttons not found, likely wrong frame. Exiting.");
    return;
  }

  scheduleNextClick(min, max);
}

async function requestDownloadFirstPart(bookTitle: string) {
  await new Promise((r) =>
    chrome.runtime.sendMessage<ContentToBgRequest>(
      {
        type: "DOWNLOAD_FIRST_PART",
        bookTitle,
      },
      r,
    ),
  );
}

chrome.runtime.onMessage.addListener(
  (
    request: ContentRequest,
    _sender,
    sendResponse: (r: ContentResponse) => void,
  ) => {
    if (request.type === "START_CLICKING") {
      if (clickInterval) {
        console.log("[ctnt.ts] Already active.");
        sendResponse({ status: "already_active" });
        return true;
      }

      if (request.mode === "click") {
        const min = request.min || 5;
        const max = request.max || 10;
        const min_ms = min * 1000;
        const max_ms = max * 1000;
        console.log("[ctnt.ts] Starting: running init refetch before clicking");
        startChapterSkipping(min_ms, max_ms); // function used to capture first snippet
        console.log(`[ctnt.ts] Starting clicks with delay ${min}-${max}s`);
      } else {
        // else its passive, do nothing
        console.log(
          "[ctnt.ts] Passive mode: downloads enabled, no auto-advance.",
        );
      }

      // scrape title before anything else
      const bookTitle = scrapeBookTitle() || "libby";
      console.log(`[ctnt.ts] Book detected: ${bookTitle}`);
      // attempt to download Part01 if it was captured but not yet downloaded
      requestDownloadFirstPart(bookTitle);

      sendResponse({ status: "started" });
      return true;
    }

    if (request.type === "STOP_CLICKING") {
      if (clickInterval) {
        clearTimeout(clickInterval);
        clickInterval = null;
        console.log("[ctnt.ts] Clicking stopped manually.");
        sendResponse({ status: "stopped" });
      } else {
        sendResponse({ status: "not_active" });
      }
      return true;
    }

    if (request.type === "DOWNLOAD_COVER") {
      const coverImg = document.querySelector("image.cover-painter-image");
      if (!coverImg) {
        // Wrong frame — say nothing, let the frame that actually has the element respond
        return false;
      }

      const rawUrl =
        coverImg.getAttribute("href") || coverImg.getAttribute("xlink:href");
      if (!rawUrl || !rawUrl.toLowerCase().endsWith(".jpg")) {
        console.log("[ctnt.ts] Cover image url not parsed or invalid.");
        return false;
      }
      // Handle relative URLs
      const url = new URL(rawUrl, window.location.href).href;
      sendResponse({ status: "found", url });
      return true;
    }

    if (request.type === "GET_TITLE") {
      const bookTitle = scrapeBookTitle();
      if (!bookTitle) {
        sendResponse({ status: "title_not_found" });
        return true;
      }
      chrome.runtime.sendMessage<ContentToBgRequest>({
        type: "SET_BOOK_TITLE",
        bookTitle,
      });
      sendResponse({ status: "title_found" });
      return true;
    }

    return true;
  },
);
