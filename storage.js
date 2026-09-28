import { initialState, isValidState, restoreState } from "./state.js";

// Keep the original key so existing tasks remain accessible after upgrading.
export const STORAGE_KEY = "what-next.state.v1";

// A small adapter makes storage failures testable without a browser.
export function createStorage(getStorage) {
  let baseline = null;
  let blocked = true;
  let issue = "unavailable";
  let raw = null;
  return {
    load() {
      try {
        raw = getStorage().getItem(STORAGE_KEY);
        baseline = raw;
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          if (!isValidState(parsed)) throw new Error("Unrecognized saved state");
          blocked = false;
          issue = null;
          return { state: restoreState(parsed), issue: null };
        }
        blocked = false;
        issue = null;
        return { state: initialState(), issue: null };
      } catch {
        blocked = true;
        issue = raw === null ? "unavailable" : "invalid";
        return { state: initialState(), issue };
      }
    },
    save(state) {
      if (blocked) return { ok: false, issue };
      try {
        // Don't overwrite changes from another tab (or externally changed data).
        if (getStorage().getItem(STORAGE_KEY) !== baseline) {
          blocked = true;
          issue = "conflict";
          return { ok: false, issue };
        }
        const serialized = JSON.stringify(state);
        getStorage().setItem(STORAGE_KEY, serialized);
        baseline = serialized;
        return { ok: true, issue: null };
      } catch {
        return { ok: false, issue: "write" };
      }
    },
    replace(state) {
      // Only the UI's explicit confirmation may call this for unreadable data.
      try {
        if (getStorage().getItem(STORAGE_KEY) !== baseline) return { ok: false, issue: "conflict" };
        const serialized = JSON.stringify(state);
        getStorage().setItem(STORAGE_KEY, serialized);
        baseline = serialized;
        blocked = false;
        issue = null;
        return { ok: true, issue: null };
      } catch {
        return { ok: false, issue: "invalid" };
      }
    },
    unreadableCopy: () => raw,
  };
}
