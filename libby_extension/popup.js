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
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { type: "START_CLICKING" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error sending message:",
                chrome.runtime.lastError.message,
              );
              statusDiv.textContent =
                "Status: Error (Page not ready or content script missing)";
              return;
            }
            if (response && response.status === "started") {
              updateButtons(true);
            } else if (response && response.status === "already_active") {
              statusDiv.textContent = "Status: Already clicking.";
              updateButtons(true); // Ensure buttons reflect active state
            } else {
              statusDiv.textContent =
                "Status: Failed to start (Is this a Libby page?).";
            }
          },
        );
      } else {
        statusDiv.textContent = "Status: No active tab found.";
      }
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
      // Handle the export logic here or pass to background.js
    }
  });
});
