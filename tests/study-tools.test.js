import test from "node:test";
import assert from "node:assert/strict";
import { initialState, transition, isValidState, currentTask } from "../state.js";
import { timerAt, formatDuration } from "../timer.js";

const act = (state, type, now, extra = {}) => transition(state, { type, now, ...extra });
function session() {
  let state = initialState();
  for (const id of ["a", "b"]) state = act(state, "add", 0, { id, fields: { title: id } });
  return act(state, "start", 1000);
}

test("pause excludes a long break; resume resets the stretch but preserves total", () => {
  let state = act(session(), "timer-pause", 31000);
  assert.deepEqual(state.timer, { elapsedMs: 30000, stretchMs: 30000, runningSince: null });
  assert.deepEqual(timerAt(state.timer, 900000), state.timer);
  state = act(state, "timer-resume", 900000);
  assert.equal(state.timer.stretchMs, 0);
  state = act(state, "timer-pause", 920000);
  assert.equal(state.timer.elapsedMs, 50000);
  assert.equal(state.timer.stretchMs, 20000);
  assert.equal(currentTask(state).id, "a");
});

test("checkpoint frequency cannot change the elapsed total or break a stretch", () => {
  let state = session();
  for (const now of [6000, 11000, 61000]) state = act(state, "timer-checkpoint", now);
  assert.equal(state.timer.elapsedMs, 60000);
  assert.equal(state.timer.stretchMs, 60000);
  assert.deepEqual(state.timer, act(session(), "timer-checkpoint", 61000).timer);
});

test("Done advances without breaking the stretch; last completion pauses and Undo doesn't invent time", () => {
  let state = act(session(), "complete", 11000);
  assert.equal(currentTask(state).id, "b");
  assert.equal(state.timer.runningSince, 11000);
  assert.equal(state.timer.stretchMs, 10000);
  state = act(state, "complete", 21000);
  assert.equal(state.timer.runningSince, null);
  state = act(state, "undo", 50000);
  assert.equal(currentTask(state).id, "b");
  assert.equal(state.timer.elapsedMs, 20000);
  assert.equal(state.timer.runningSince, null);
  assert.ok(isValidState(state));
});

test("Done while paused does not restart timing", () => {
  let state = act(session(), "timer-pause", 11000);
  state = act(state, "complete", 21000);
  assert.equal(currentTask(state).id, "b");
  assert.equal(state.timer.runningSince, null);
  assert.equal(state.timer.elapsedMs, 10000);
});

test("end and editing the plan pause time; starting again preserves accumulated time and note", () => {
  let state = act(session(), "end", 11000, { note: "Continue part b" });
  assert.equal(state.timer.runningSince, null);
  state = act(state, "start", 90000);
  assert.equal(currentTask(state).note, "Continue part b");
  assert.equal(state.timer.elapsedMs, 10000);
  state = act(state, "plan", 95000);
  assert.equal(state.timer.elapsedMs, 15000);
  assert.equal(state.timer.stretchMs, 5000);
  assert.equal(state.timer.runningSince, null);
});

test("reset clears only the time and pauses; empty plans cannot run a timer", () => {
  const before = act(session(), "thought-add", 11000, { id: "idea", text: "Look up recursion" });
  const after = act(before, "timer-reset", 15000);
  assert.deepEqual(after.tasks, before.tasks);
  assert.deepEqual(after.thoughts, before.thoughts);
  assert.equal(after.currentTaskId, before.currentTaskId);
  assert.deepEqual(after.timer, initialState().timer);
  assert.equal(act(initialState(), "timer-resume", 1000).timer.runningSince, null);
});

test("clock moving backwards doesn't subtract or double-count time", () => {
  const state = act(session(), "timer-checkpoint", 11000);
  const backwards = act(state, "timer-checkpoint", 6000);
  assert.deepEqual(backwards.timer, state.timer);
  assert.equal(act(backwards, "timer-checkpoint", 16000).timer.elapsedMs, 15000);
  assert.throws(() => act(state, "timer-checkpoint", NaN), /timestamp/);
});

test("duration formatting handles seconds, minutes, and hours", () => {
  assert.equal(formatDuration(999), "00:00");
  assert.equal(formatDuration(30000), "00:30");
  assert.equal(formatDuration(1800000), "30:00");
  assert.equal(formatDuration(3661000), "1:01:01");
});

test("thought capture trims text, preserves HTML-looking input literally, and doesn't change task Undo", () => {
  let state = act(session(), "complete", 11000);
  const undo = state.undo;
  state = act(state, "thought-add", 12000, { id: "idea", text: '  <img src=x onerror="alert(1)">  ' });
  assert.equal(state.thoughts[0].text, '<img src=x onerror="alert(1)">');
  assert.deepEqual(state.undo, undo);
  assert.equal(currentTask(state).id, "b");
  assert.throws(() => act(state, "thought-add", 12000, { id: "blank", text: " \n " }), /thought/);
  assert.throws(() => act(state, "thought-add", 12000, { id: "idea", text: "Duplicate" }), /unique/);
});

test("thoughts can be reviewed, unreviewed, deleted and undone at their original position", () => {
  let state = session();
  for (const id of ["one", "two"]) state = act(state, "thought-add", 2000, { id, text: id });
  state = act(state, "thought-review", 3000, { id: "one" });
  assert.equal(state.thoughts[0].reviewed, true);
  state = act(state, "thought-review", 4000, { id: "one" });
  assert.equal(state.thoughts[0].reviewed, false);
  state = act(state, "thought-delete", 5000, { id: "one" });
  assert.ok(isValidState(state));
  state = act(state, "undo", 6000);
  assert.deepEqual(state.thoughts.map(thought => thought.id), ["one", "two"]);
  assert.equal(state.undo, null);
  assert.equal(currentTask(state).id, "a");
  assert.ok(isValidState(state));
});

test("validation rejects malformed timer and thought data", () => {
  const state = initialState();
  for (const timer of [null, { elapsedMs: -1, stretchMs: 0, runningSince: null }, { elapsedMs: 0, stretchMs: 1, runningSince: null }, { elapsedMs: 0, stretchMs: 0, runningSince: 0 }]) {
    assert.equal(isValidState({ ...state, timer }), false);
  }
  for (const thoughts of [null, [{}], [{ id: "x", text: " ", reviewed: false }], [{ id: "x", text: "ok", reviewed: "false" }], [{ id: "x", text: "ok", reviewed: false }, { id: "x", text: "duplicate", reviewed: false }]]) {
    assert.equal(isValidState({ ...state, thoughts }), false);
  }
});
