document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const clearButton = document.getElementById("clearButton");
  const statusDiv = document.getElementById("status");
  const capturedCount = document.getElementById("capturedCount");
  const downloadedCount = document.getElementById("downloadedCount");
  const minDelayInput = document.getElementById("minDelay");
  const maxDelayInput = document.getElementById("maxDelay");

  function updateUI(isActive, urlsCaptured = 0, urlsDownloaded = 0) {
    startButton.disabled = isActive;
    stopButton.disabled = !isActive;
    statusDiv.textContent = isActive ? "Status: Active" : "Status: Idle";
    capturedCount.textContent = urlsCaptured;
    downloadedCount.textContent = urlsDownloaded;
  }

  // Sync state on popup open
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (response)
      updateUI(
        response.downloadsEnabled,
        response.urlsCaptured,
        response.urlsDownloaded,
      );
  });

  startButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      statusDiv.textContent = "Status: No active tab.";
      return;
    }

    const min = parseInt(minDelayInput.value) || 2500;
    const max = parseInt(maxDelayInput.value) || 5000;

    // 1. Enable downloads in background
    const bgResponse = await chrome.runtime.sendMessage({
      type: "ENABLE_DOWNLOADS",
    });
    if (!bgResponse || bgResponse.status !== "downloads_enabled") {
      statusDiv.textContent = "Status: Failed to enable background.";
      return;
    }

    // 2. Start clicking in content script with user-defined delays
    try {
      const csResponse = await chrome.tabs.sendMessage(tab.id, {
        type: "START_CLICKING",
        min,
        max,
      });

      if (
        csResponse?.status === "started" ||
        csResponse?.status === "already_active"
      ) {
        updateUI(true, bgResponse.urlsCaptured, bgResponse.urlsDownloaded);
      } else {
        statusDiv.textContent = "Status: Failed (Is this a Libby page?)";
        chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });
      }
    } catch {
      statusDiv.textContent = "Status: Error (refresh the Libby tab).";
      chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });
    }
  });

  stopButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });

    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: "STOP_CLICKING" });
    }

    updateUI(false);
  });

  clearButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CLEAR_HISTORY" }, () => {
      capturedCount.textContent = 0;
      statusDiv.textContent = "Status: History cleared.";
    });
  });

  // Listen for book-end signal from content script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "EXPORT_URLS_COMPLETE") {
      statusDiv.textContent = "Status: Book complete.";
      updateUI(false);
      chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });
    }
  });
});
