import type { ExtensionState } from "./types";

const DEFAULT_STATE: ExtensionState = {
  bookTitle: "libby",
  mode: "click",

  downloadsEnabled: false,
  isActive: false,
  captures: [],
  lastCaptureLabel: null,
};

export async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(null);
  return { ...DEFAULT_STATE, ...result } as ExtensionState;
}

export async function setState(
  partial: Partial<ExtensionState>,
): Promise<void> {
  await chrome.storage.local.set(partial);
}

export function onStateChange(
  callback: (changes: Record<string, chrome.storage.StorageChange>) => void,
) {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === "local") callback(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
