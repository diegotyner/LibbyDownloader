// popup.js

document.addEventListener("DOMContentLoaded", () => {
  const startButton = document.getElementById("startButton");
  const stopButton = document.getElementById("stopButton");
  const statusDiv = document.getElementById("status");

  // Function to update button states
  function updateButtons(isClicking) {
    startButton.disabled = isClicking;
    stopButton.disabled = !isClicking;
    statusDiv.textContent = isClicking ? "Status: Clicking..." : "Status: Idle";
  }

  // Initial state check (optional, but good for robustness)
  // You might need a background script to truly track state across popup opens
  updateButtons(false); // Assume not clicking initially

  startButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        statusDiv.textContent = "Status: No active tab found.";
        return;
      }
      const tabId = tabs[0].id; // Get the ID of the active tab

      // 1. Send message to BACKGROUND.JS to ENABLE DOWNLOADS
      // Use chrome.runtime.sendMessage to communicate with the background script
      chrome.runtime
        .sendMessage({ type: "ENABLE_DOWNLOADS", tabId: tabId }) // Optionally send tabId if background needs to know context
        .then((bgResponse) => {
          if (bgResponse && bgResponse.status === "downloads_enabled") {
            console.log(
              `Background: ${bgResponse.status}. Queue size: ${bgResponse.queue_size}.`,
            );
            // Only if background confirms downloads are enabled, proceed to start clicking in content script
            // 2. Send message to CONTENT.JS to START CLICKING
            chrome.tabs
              .sendMessage(
                tabId, // Send to the specific tab
                { type: "START_CLICKING" },
              )
              .then((csResponse) => {
                if (csResponse && csResponse.status === "started") {
                  updateButtons(true);
                  statusDiv.textContent = `Status: Clicking... (Queue: ${bgResponse.queue_size})`;
                } else if (
                  csResponse &&
                  csResponse.status === "already_active"
                ) {
                  statusDiv.textContent = "Status: Already clicking.";
                  updateButtons(true); // Ensure buttons reflect active state
                } else {
                  statusDiv.textContent =
                    "Status: Failed to start clicking (Is this a Libby page?).";
                  // Potentially disable downloads again if clicking failed to start
                  chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });
                }
              })
              .catch((error) => {
                console.error(
                  "Error sending START_CLICKING to content script:",
                  error,
                );
                statusDiv.textContent =
                  "Status: Error (Content script not ready).";
                // Also disable downloads if content script communication fails
                chrome.runtime.sendMessage({ type: "DISABLE_DOWNLOADS" });
              });
          } else {
            statusDiv.textContent =
              "Status: Failed to enable downloads in background.";
          }
        })
        .catch((error) => {
          console.error(
            "Error sending ENABLE_DOWNLOADS to background script:",
            error,
          );
          statusDiv.textContent =
            "Status: Error (Background script not ready).";
        });
    });
  });

  stopButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "STOP_CLICKING" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error sending stop message:",
                chrome.runtime.lastError.message,
              );
              statusDiv.textContent = "Status: Error stopping.";
              return;
            }
            if (response && response.status === "stopped") {
              updateButtons(false);
            } else if (response && response.status === "not_active") {
              statusDiv.textContent = "Status: Not active.";
              updateButtons(false);
            } else {
              statusDiv.textContent = "Status: Failed to stop.";
            }
          },
        );
      }
    });
  });

  // Listen for messages from content.js (e.g., when it finishes naturally)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "EXPORT_URLS") {
      statusDiv.textContent = "Status: Finished clicking (Exporting URLs).";
      updateButtons(false); // Reset buttons
      chrome.runtime
        .sendMessage({ type: "DISABLE_DOWNLOADS" })
        .then((response) =>
          console.log(
            "Background downloads disabled after process end:",
            response,
          ),
        )
        .catch((error) =>
          console.error("Error disabling background downloads:", error),
        );
    }
  });
});
