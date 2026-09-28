import test from "node:test";
import assert from "node:assert/strict";
import { createStorage, STORAGE_KEY } from "../storage.js";
import { initialState, transition } from "../state.js";

function memoryStorage(raw = null) {
  const data = new Map(raw === null ? [] : [[STORAGE_KEY, raw]]);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
const planned = () => transition(initialState(), { type: "add", id: "a", fields: { title: "Read notes" } });

test("saving and reopening restore the entire state including Undo", () => {
  const memory = memoryStorage();
  const store = createStorage(() => memory);
  assert.deepEqual(store.load().state, initialState());
  const state = transition(transition(planned(), { type: "start" }), { type: "complete" });
  assert.equal(store.save(state).ok, true);
  assert.deepEqual(createStorage(() => memory).load(), { state, issue: null });
});

test("invalid JSON and unsupported data are preserved until explicit replacement", () => {
  for (const raw of ["{bad json", "null", '{"version":100}', '{"version":1,"tasks":[]}']) {
    const memory = memoryStorage(raw);
    const store = createStorage(() => memory);
    assert.equal(store.load().issue, "invalid");
    assert.equal(store.unreadableCopy(), raw);
    assert.equal(store.save(planned()).ok, false);
    assert.equal(memory.getItem(STORAGE_KEY), raw);
    assert.equal(store.replace(planned()).ok, true);
    assert.deepEqual(JSON.parse(memory.getItem(STORAGE_KEY)), planned());
  }
});

test("unavailable storage does not claim success or write before a successful read", () => {
  const store = createStorage(() => { throw new Error("SecurityError"); });
  assert.equal(store.load().issue, "unavailable");
  assert.deepEqual(store.save(planned()), { ok: false, issue: "unavailable" });
});

test("failed writes preserve previous data and allow a later retry", () => {
  const memory = memoryStorage(JSON.stringify(initialState()));
  const store = createStorage(() => memory);
  store.load();
  const setItem = memory.setItem;
  memory.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.deepEqual(store.save(planned()), { ok: false, issue: "write" });
  assert.deepEqual(JSON.parse(memory.getItem(STORAGE_KEY)), initialState());
  memory.setItem = setItem;
  assert.equal(store.save(planned()).ok, true);
});

test("another tab's saved copy is not silently overwritten", () => {
  const memory = memoryStorage();
  const store = createStorage(() => memory);
  store.load();
  memory.setItem(STORAGE_KEY, "another tab's data");
  assert.deepEqual(store.save(planned()), { ok: false, issue: "conflict" });
  assert.equal(memory.getItem(STORAGE_KEY), "another tab's data");
});

test("replacement refuses to overwrite a copy that changed since loading", () => {
  const memory = memoryStorage("broken");
  const store = createStorage(() => memory);
  store.load();
  memory.setItem(STORAGE_KEY, "newer copy");
  assert.deepEqual(store.replace(planned()), { ok: false, issue: "conflict" });
  assert.equal(memory.getItem(STORAGE_KEY), "newer copy");
});

test("version 1 upgrades without changing tasks, notes, order, current task or Undo; loading doesn't write", () => {
  let original = transition(planned(), { type: "start" });
  original = transition(original, { type: "end", note: "Continue here" });
  original = transition(original, { type: "add", id: "b", fields: { title: "Second" } });
  original = transition(original, { type: "delete", id: "b" });
  const { timer, thoughts, ...legacy } = original;
  legacy.version = 1;
  const raw = JSON.stringify(legacy);
  const memory = memoryStorage(raw);
  const store = createStorage(() => memory);
  const loaded = store.load();
  assert.equal(loaded.issue, null);
  assert.deepEqual(loaded.state, { ...legacy, version: 2, timer: initialState().timer, thoughts: [] });
  assert.equal(memory.getItem(STORAGE_KEY), raw);
  assert.equal(store.save(loaded.state).ok, true);
  assert.deepEqual(createStorage(() => memory).load().state, loaded.state);
});

test("reopening pauses at the saved checkpoint and preserves thoughts, review status, and thought Undo", () => {
  const memory = memoryStorage();
  const store = createStorage(() => memory);
  store.load();
  let state = transition(planned(), { type: "start", now: 1000 });
  state = transition(state, { type: "thought-add", id: "idea", text: "Later", now: 11000 });
  state = transition(state, { type: "thought-review", id: "idea", now: 11000 });
  state = transition(state, { type: "thought-delete", id: "idea", now: 21000 });
  store.save(state);
  const reopened = createStorage(() => memory).load().state;
  assert.equal(reopened.timer.elapsedMs, 20000);
  assert.equal(reopened.timer.runningSince, null);
  assert.equal(reopened.currentTaskId, "a");
  assert.equal(transition(reopened, { type: "undo", now: 900000 }).thoughts[0].reviewed, true);
});

test("malformed version 2 time data is preserved without downgrading or resetting the saved copy", () => {
  const raw = JSON.stringify({ ...planned(), timer: { elapsedMs: -1000, stretchMs: 0, runningSince: null } });
  const memory = memoryStorage(raw);
  const store = createStorage(() => memory);
  assert.equal(store.load().issue, "invalid");
  assert.equal(store.save(initialState()).ok, false);
  assert.equal(memory.getItem(STORAGE_KEY), raw);
});

test("a failed first write after migration retains the original version 1 copy", () => {
  const { timer, thoughts, ...legacy } = planned();
  legacy.version = 1;
  const raw = JSON.stringify(legacy);
  const memory = memoryStorage(raw);
  const store = createStorage(() => memory);
  const state = store.load().state;
  memory.setItem = () => { throw new Error("QuotaExceededError"); };
  assert.equal(store.save(state).ok, false);
  assert.equal(memory.getItem(STORAGE_KEY), raw);
});
