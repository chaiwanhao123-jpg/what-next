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
