import test from "node:test";
import assert from "node:assert/strict";
import { initialState, transition, pendingTasks, currentTask, focusQueue, isValidState } from "../state.js";

const add = (state, id, title = id) => transition(state, { type: "add", id, fields: { title } });
const planned = () => ["a", "b", "c"].reduce((state, id) => add(state, id), initialState());

test("completion advances immediately; undo restores status, current task, and order", () => {
  const before = transition(planned(), { type: "start" });
  const after = transition(before, { type: "complete" });
  assert.equal(currentTask(after).id, "b");
  assert.deepEqual(pendingTasks(after).map(t => t.id), ["b", "c"]);
  assert.equal(before.tasks[0].completed, false, "old state must not be mutated");
  const restored = transition(after, { type: "undo" });
  assert.equal(currentTask(restored).id, "a");
  assert.deepEqual(pendingTasks(restored).map(t => t.id), ["a", "b", "c"]);
  assert.equal(restored.undo, null);
});

test("edit and reorder preserve stable IDs and keep the paused current task", () => {
  let state = transition(planned(), { type: "start" });
  state = transition(state, { type: "end", note: "Start at part b" });
  state = transition(state, { type: "edit", id: "a", fields: { title: "Revised", module: "CS2040", firstAction: "Draw it" } });
  state = transition(state, { type: "move", id: "a", direction: 1 });
  assert.deepEqual(pendingTasks(state).map(t => t.id), ["b", "a", "c"]);
  state = transition(state, { type: "start" });
  assert.equal(currentTask(state).id, "a");
  assert.equal(currentTask(state).note, "Start at part b");
  assert.equal(currentTask(state).title, "Revised");
  assert.deepEqual(focusQueue(state).map(t => t.id), ["a", "b", "c"]);
});

test("end and resume preserve the unfinished task and optional note through serialization", () => {
  let state = transition(planned(), { type: "start" });
  state = transition(state, { type: "complete" });
  state = transition(state, { type: "end", note: "  Read question 4\nDraw a tree  " });
  assert.equal(state.view, "plan");
  state = JSON.parse(JSON.stringify(state));
  assert.ok(isValidState(state));
  state = transition(state, { type: "start" });
  assert.equal(currentTask(state).id, "b");
  assert.equal(currentTask(state).completed, false);
  assert.equal(currentTask(state).note, "Read question 4\nDraw a tree");
});

test("delete and undo restore the task, note, current identity, and queue position", () => {
  let state = transition(planned(), { type: "start" });
  state = transition(state, { type: "end", note: "Remember this" });
  state = transition(state, { type: "delete", id: "a" });
  assert.equal(state.currentTaskId, null);
  assert.ok(isValidState(state));
  state = transition(state, { type: "undo" });
  assert.equal(currentTask(state).id, "a");
  assert.equal(currentTask(state).note, "Remember this");
  assert.deepEqual(state.tasks.map(t => t.id), ["a", "b", "c"]);
});

test("empty and all-complete queues stay empty; last completion can be undone after reload", () => {
  let state = transition(initialState(), { type: "start" });
  assert.equal(currentTask(state), null);
  assert.ok(isValidState(state));
  state = add(initialState(), "only");
  state = transition(state, { type: "start" });
  state = transition(state, { type: "complete" });
  assert.equal(currentTask(state), null);
  assert.equal(pendingTasks(state).length, 0);
  state = JSON.parse(JSON.stringify(state));
  assert.ok(isValidState(state));
  state = transition(state, { type: "undo" });
  assert.equal(currentTask(state).id, "only");
});

test("blank add/edit are rejected and optional fields are not required", () => {
  assert.throws(() => add(initialState(), "a", " \n "), /title/);
  assert.throws(() => transition(planned(), { type: "edit", id: "a", fields: { title: " " } }), /title/);
  assert.equal(add(initialState(), "a").tasks[0].firstAction, "");
  assert.equal(currentTask(transition(add(initialState(), "a"), { type: "start" })).id, "a");
});

test("reordering skips completed tasks and respects boundaries", () => {
  let state = transition(planned(), { type: "start" });
  state = transition(state, { type: "complete" });
  state = transition(state, { type: "move", id: "c", direction: -1 });
  assert.deepEqual(pendingTasks(state).map(t => t.id), ["c", "b"]);
  assert.deepEqual(transition(state, { type: "move", id: "c", direction: -1 }), state);
  state = transition(state, { type: "undo" });
  assert.deepEqual(pendingTasks(state).map(t => t.id), ["a", "c", "b"]);
});

test("undo completion retains later edits", () => {
  let state = transition(transition(planned(), { type: "start" }), { type: "complete" });
  state = transition(state, { type: "edit", id: "a", fields: { title: "Edited after completion" } });
  state = transition(state, { type: "undo" });
  assert.equal(currentTask(state).title, "Edited after completion");
});

test("validator rejects corrupt shapes, duplicate IDs, invalid current references and undo", () => {
  for (const value of [null, {}, [], { ...initialState(), version: 2 }, { ...planned(), currentTaskId: "missing" }, { ...planned(), undo: {} }, { ...initialState(), tasks: [{ title: "a" }] }, { ...planned(), view: "focus" }]) {
    assert.equal(isValidState(value), false);
  }
  const duplicate = planned();
  duplicate.tasks[1].id = duplicate.tasks[0].id;
  assert.equal(isValidState(duplicate), false);
  assert.ok(isValidState(initialState()));
});

test("user text is stored literally, including HTML-looking strings", () => {
  const title = '<img src=x onerror="alert(1)">';
  assert.equal(add(initialState(), "a", title).tasks[0].title, title);
});
