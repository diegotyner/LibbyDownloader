import { useEffect, useState } from "react";
import type {
	BgRequest,

	BgResponse,
	ContentRequest,
	ContentResponse,
} from "../shared/messages";
import type { ExtensionState, Mode } from "../shared/types";


const DEFAULT_STATE: ExtensionState = {
	bookTitle: "libby",
	mode: "passive",
	downloadsEnabled: false,
	isActive: false,
	captures: [],
	lastCaptureLabel: null,
	titleChangeWarning: null,
};

function sendBg(req: BgRequest): Promise<BgResponse> {
	return chrome.runtime.sendMessage(req);

}

function sendContent(tabId: number, req: ContentRequest): Promise<ContentResponse> {
	return chrome.tabs.sendMessage(tabId, req);
}

export default function App() {

	const [state, setState] = useState<ExtensionState>(DEFAULT_STATE);
	const [notice, setNotice] = useState<string | null>(null);
	const status = state.downloadsEnabled
		? state.mode === "passive"
			? "Active (listening)"
			: "Active (clicking)"
		: "Idle";
	const [minDelay, setMinDelay] = useState(5);
	const [maxDelay, setMaxDelay] = useState(10);

	// Initial load: read whatever background has persisted so far
	useEffect(() => {

		chrome.storage.local.get(["backgroundState"], (result) => {
			if (result.backgroundState) setState(result.backgroundState as ExtensionState);
		});
	}, []);

	// Storage-driven updates — replaces the old 1s poll interval entirely.
	// NOTE: this only works if background.ts calls persistHistory() on every
	// mutation, including ENABLE_DOWNLOADS/DISABLE_DOWNLOADS/SET_MODE — see
	// the flag raised before this file. If those handlers don't persist,
	// this listener will never fire for those actions.

	useEffect(() => {
		function onChanged(changes: { [key: string]: chrome.storage.StorageChange }, area: string) {
			if (area === "local" && changes.backgroundState?.newValue) {
				setState(changes.backgroundState.newValue as ExtensionState);
			}
		}
		chrome.storage.onChanged.addListener(onChanged);
		return () => chrome.storage.onChanged.removeListener(onChanged);
	}, []);

	// Listen for book-complete signal from content script (same broadcast
	// background also catches independently — confirmed real in v1, not the
	// BOOK_COMPLETE idea floated earlier, which doesn't exist).
	useEffect(() => {
		function onMessage(request: unknown) {

			if (
				typeof request === "object" &&
				request !== null &&
				"type" in request &&
				(request as { type: string }).type === "EXPORT_URLS_COMPLETE"
			) {
				setNotice("Book complete.");
			}
		}
		chrome.runtime.onMessage.addListener(onMessage);
		return () => chrome.runtime.onMessage.removeListener(onMessage);
	}, []);

	useEffect(() => {
		if (state.bookTitle !== DEFAULT_STATE.bookTitle) return;

		(async () => {
			const tab = await getActiveTab();
			if (!tab?.id) return;
			try {
				await sendContent(tab.id, { type: "GET_TITLE" });
				// no need to read the response — background will persist the title,
				// and the chrome.storage.onChanged listener above will pick it up
			} catch {
				// content script not injected on this tab (wrong page, or loaded
				// before install/reload) — same as Start's existing guard, just
				// silently skip; title stays default until a real Libby tab is active
			}
		})();
	}, [state.bookTitle]);

	async function getActiveTab() {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		return tab;
	}

	async function handleStart() {
		const tab = await getActiveTab();
		if (!tab?.id) {
			setNotice("No active tab.");
			return;
		}

		const bgResponse = await sendBg({ type: "ENABLE_DOWNLOADS" });
		if (bgResponse.status !== "downloads_enabled") {
			setNotice("Failed to enable background.");

			return;

		}

		try {
			await sendContent(tab.id, { type: "START_CLICKING", mode: state.mode, min: minDelay, max: maxDelay });
		} catch {
			setNotice("Error (refresh the Libby tab).");
			return;
		}

		setNotice(null);
	}


	async function handleModeChange(newMode: Mode) {
		await sendBg({ type: "SET_MODE", mode: newMode });
	}

	async function handleStop() {
		const tab = await getActiveTab();
		await sendBg({ type: "DISABLE_DOWNLOADS" });
		if (tab?.id) await sendContent(tab.id, { type: "STOP_CLICKING" });
		setNotice(null);
	}

	async function handleClear() {
		const tab = await getActiveTab();
		await sendBg({ type: "CLEAR_HISTORY" });
		if (tab?.id) {
			try {
				await sendContent(tab.id, { type: "STOP_CLICKING" });
			} catch {
				// content script not injected on this tab — nothing to stop
			}
		}

		setState(DEFAULT_STATE);
		setNotice("History cleared.");
	}

	async function handleCover() {
		const tab = await getActiveTab();
		if (!tab?.id) return;

		const response = await sendContent(tab.id, { type: "DOWNLOAD_COVER" });
		if (response.status === "found") {
			await sendBg({ type: "SAVE_COVER", url: response.url });
			setNotice("Cover downloaded.");

		} else {
			setNotice("Cover not found.");
		}
	}

	const capturedCount = state.captures.length;
	const downloadedCount = state.captures.filter((c) => c.downloaded).length;

	return (
		<div className="flex flex-col gap-2 p-3 w-64">
			<h2 className="text-lg font-bold">Libby DL</h2>
			<div className="text-sm text-gray-950">Book: {state.bookTitle != "libby" ? state.bookTitle : "Not detected"}</div>
			<div className="text-xs text-gray-600">Captured: {capturedCount}</div>
			<div className="text-xs text-gray-600">Downloaded: {downloadedCount}</div>

			{/* Segmented Mode Display */}
			<div className="flex rounded overflow-hidden border text-xs">
				<button
					onClick={() => handleModeChange("passive")}
					disabled={state.downloadsEnabled}
					className={`flex-1 py-1.5 ${state.mode === "passive"
						? "bg-blue-500 text-white"
						: "bg-gray-100 hover:bg-gray-200"
						} disabled:opacity-50`}
				>
					Passive
				</button>
				<button
					onClick={() => handleModeChange("click")}
					disabled={state.downloadsEnabled}
					className={`flex-1 py-1.5 ${state.mode === "click"
						? "bg-blue-500 text-white"
						: "bg-gray-100 hover:bg-gray-200"
						} disabled:opacity-50`}
				>
					Active
				</button>
			</div>

			{state.mode === "click" && (
				<div className="flex gap-2 text-xs items-center">
					<label>
						Min (s)

						<input

							type="number"
							className="ml-1 w-14 rounded border px-1"
							value={minDelay}
							onChange={(e) => setMinDelay(parseInt(e.target.value) || 5)}
						/>
					</label>
					<label>
						Max (s)
						<input
							type="number"
							className="ml-1 w-14 rounded border px-1"
							value={maxDelay}
							onChange={(e) => setMaxDelay(parseInt(e.target.value) || 10)}
						/>
					</label>
				</div>
			)}

			<button
				onClick={handleStart}
				disabled={state.downloadsEnabled}
				className="w-full rounded bg-blue-500 py-2 text-sm text-white hover:bg-blue-600 disabled:bg-gray-300"
			>
				Start
			</button>
			<button
				onClick={handleStop}
				disabled={!state.downloadsEnabled}
				className="w-full rounded bg-gray-400 py-2 text-sm text-white hover:bg-gray-500 disabled:bg-gray-300"
			>
				Stop
			</button>
			<button
				onClick={handleClear}

				className="w-full rounded bg-gray-200 py-2 text-sm hover:bg-gray-300"
			>
				Clear History
			</button>
			<button
				onClick={handleCover}
				className="w-full rounded bg-gray-200 py-2 text-sm hover:bg-gray-300"
			>
				Download Cover
			</button>

			{/* Status Display */}
			<div className="mt-1 text-sm font-semibold">Status: {status}</div>
			{notice && <div className="text-xs text-gray-500">{notice}</div>}

			{/* Warning about changing title */}
			{state.titleChangeWarning && (
				<div className="text-xs text-amber-700 bg-amber-50 rounded p-2">
					{state.titleChangeWarning}
				</div>
			)}
		</div>
	);

}
