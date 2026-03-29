function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clickElement(el) {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let clickInterval = null;

function scheduleNextClick(min, max) {
  clickInterval = setTimeout(
    () => {
      const nextBtn = document.querySelector("button.chapter-bar-next-button");

      if (!nextBtn) {
        console.log("Next button not found, stopping.");
        clickInterval = null;
        return;
      }

      const label = nextBtn.getAttribute("aria-label") || "";

      if (label.includes("Next Chapter")) {
        clickElement(nextBtn);
        console.log("Clicked: Next Chapter");
        scheduleNextClick(min, max); // reschedule after each click
      } else if (label.includes("End Of Audiobook")) {
        console.log("End found, exiting...");
        clickElement(nextBtn);
        clickInterval = null;
        setTimeout(() => {
          chrome.runtime.sendMessage({ type: "EXPORT_URLS_COMPLETE" });
        }, 3000);
      } else {
        // Button exists but label doesn't match — retry
        scheduleNextClick(min, max);
      }
    },
    randomDelay(min, max),
  );
}
async function init(min, max) {
  await sleep(100); // let dom settle
  const prevBtn = document.querySelector("button.chapter-bar-prev-button");
  const nextBtn = document.querySelector("button.chapter-bar-next-button");

  // This rejects the worker in the incorret frame
  if (!prevBtn || !nextBtn) {
    console.log("Buttons not found, likely wrong frame. Exiting.");
    return;
  }

  // scrape title before anything else
  const bookTitle = document.title
    .replace("Libby - Open: ", "")
    .trim()
    .replace(/ /g, "_")
    .replace(/[<>:"/\\|?*]/g, "");
  console.log(`Book detected: ${bookTitle}`);

  // attempt to download Part01 if it was captured but not yet downloaded
  await new Promise((r) =>
    chrome.runtime.sendMessage(
      {
        type: "DOWNLOAD_FIRST_PART",
        bookTitle,
      },
      r,
    ),
  );

  scheduleNextClick(min, max);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "START_CLICKING") {
    if (clickInterval) {
      console.log("Already active.");
      sendResponse({ status: "already_active" });
      return true;
    }

    const min = request.min || 5000;
    const max = request.max || 10000;
    console.log("Starting: running init refetch before clicking");
    init(min, max); // function used to capture first snippet
    console.log(`Starting clicks with delay ${min}-${max}ms`);
    sendResponse({ status: "started" });
  } else if (request.type === "STOP_CLICKING") {
    if (clickInterval) {
      clearTimeout(clickInterval);
      clickInterval = null;
      console.log("Clicking stopped manually.");
      sendResponse({ status: "stopped" });
    } else {
      sendResponse({ status: "not_active" });
    }
  }

  return true;
});
