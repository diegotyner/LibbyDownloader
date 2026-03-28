function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clickElement(el) {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

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
        chrome.runtime.sendMessage({ type: "EXPORT_URLS_COMPLETE" });
      } else {
        // Button exists but label doesn't match — retry
        scheduleNextClick(min, max);
      }
    },
    randomDelay(min, max),
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "START_CLICKING") {
    if (clickInterval) {
      console.log("Already active.");
      sendResponse({ status: "already_active" });
      return true;
    }

    const min = request.min || 2500;
    const max = request.max || 5000;
    console.log(`Starting clicks with delay ${min}-${max}ms`);
    scheduleNextClick(min, max);
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
