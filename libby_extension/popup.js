document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const clearButton = document.getElementById("clearButton");
  const imgDownloadButton = document.getElementById("coverButton");
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

  // refresh the popup so that it stays accurate
  const pollInterval = setInterval(() => {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (response)
        updateUI(
          response.downloadsEnabled,
          response.urlsCaptured,
          response.urlsDownloaded,
        );
    });
  }, 1000);
  window.addEventListener("unload", () => clearInterval(pollInterval));

  startButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      statusDiv.textContent = "Status: No active tab.";
      return;
    }

    const min = parseInt(minDelayInput.value) || 5000;
    const max = parseInt(maxDelayInput.value) || 10000;

    // 1. Enable downloads in background — popup owns this, unconditionally
    const bgResponse = await chrome.runtime.sendMessage({
      type: "ENABLE_DOWNLOADS",
    });
    if (!bgResponse || bgResponse.status !== "downloads_enabled") {
      statusDiv.textContent = "Status: Failed to enable background.";
      return;
    }

    // Start clicking in content script with user-defined delays
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: "START_CLICKING",
        min,
        max,
      });
    } catch {
      // content script not ready — but downloads are already enabled, don't disable
      statusDiv.textContent = "Status: Error (refresh the Libby tab).";
      return;
    }

    updateUI(true, bgResponse.urlsCaptured, bgResponse.urlsDownloaded);
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
      downloadedCount.textContent = 0;
      statusDiv.textContent = "Status: History cleared.";
    });
  });

  imgDownloadButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "DOWNLOAD_COVER",
    });
    if (response?.status === "found") {
      chrome.runtime.sendMessage({ type: "SAVE_COVER", url: response.url });
      statusDiv.textContent = "Status: Cover downloaded.";
    } else {
      statusDiv.textContent = "Status: Cover not found.";
    }
  });

  // Listen for book-end signal from content script
  chrome.runtime.onMessage.addListener((request) => {
    if (request.type === "EXPORT_URLS_COMPLETE") {
      statusDiv.textContent = "Status: Book complete.";
      updateUI(false);
    }
  });
});
