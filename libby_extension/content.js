// declaring random delay
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "START_CLICKING") {
    if (clickInterval) {
      console.log("Clicking already active. Ignoring start request.");
      sendResponse({ status: "already_active" });
      return true; // Indicate that a response will be sent asynchronously
    }

    console.log("Starting click interval...");
    clickInterval = setInterval(
      () => {
        const ffBtn = document.querySelector(
          'button.chapter-bar-next-button[aria-label^="Next Chapter"]',
        );
        if (ffBtn) {
          clickElement(ffBtn);
          console.log("Clicked Next Chapter button."); // Added for debugging
        } else {
          const endBtn = document.querySelector(
            'button.chapter-bar-next-button[aria-label^="End Of Audiobook"]',
          );
          if (endBtn) {
            console.log("End found, exiting interval");
            clickElement(endBtn);
            clearInterval(clickInterval);
            clickInterval = null; // Reset interval ID
            chrome.runtime.sendMessage({ type: "EXPORT_URLS" });
          } else {
            console.log("Button not found. Stopping clicks.");
            clearInterval(clickInterval); // Ensure interval is cleared if button disappears
            clickInterval = null; // Reset interval ID
          }
        }
      },
      randomDelay(5000, 10000),
    );
    sendResponse({ status: "started" });
  } else if (request.type === "STOP_CLICKING") {
    if (clickInterval) {
      clearInterval(clickInterval);
      clickInterval = null;
      console.log("Click interval stopped manually.");
      sendResponse({ status: "stopped" });
    } else {
      console.log("No active clicking interval to stop.");
      sendResponse({ status: "not_active" });
    }
  }
  return true; // Keep the message channel open for sendResponse
});
