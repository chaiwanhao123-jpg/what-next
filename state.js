// Pure state logic: no HTML, browser storage, or side effects.
import { initialTimer, timerAt, resumeTimer, pauseTimer, validTimer } from "./timer.js";

export function initialState() {
  return { version: 2, tasks: [], currentTaskId: null, view: "plan", undo: null, timer: initialTimer(), thoughts: [] };
}

export function restoreState(saved) {
  const state = structuredClone(saved);
  if (state.version === 1) {
    state.version = 2;
    state.timer = initialTimer();
    state.thoughts = [];
  }
  // Keep only time actually checkpointed; don't count time with the app closed.
  state.timer = pauseTimer(state.timer);
  return state;
}

export const pendingTasks = state => state.tasks.filter(task => !task.completed);
export const currentTask = state => state.tasks.find(task => task.id === state.currentTaskId && !task.completed) ?? null;
export function focusQueue(state) {
  const current = currentTask(state);
  return current ? [current, ...pendingTasks(state).filter(task => task.id !== current.id)] : pendingTasks(state);
}

function details(fields) {
  const title = String(fields.title ?? "").trim();
  if (!title) throw new Error("Give the task a title before saving.");
  return { title, module: String(fields.module ?? "").trim(), firstAction: String(fields.firstAction ?? "").trim() };
}

export function transition(state, action) {
  // structuredClone is like Python's copy.deepcopy: don't mutate the old state.
  const next = structuredClone(state);
  const now = action.now ?? next.timer.runningSince ?? 0;
  if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid timer timestamp.");
  next.timer = timerAt(next.timer, now);
  const findTask = id => next.tasks.find(task => task.id === id);
  switch (action.type) {
    case "add":
      if (!action.id || findTask(action.id)) throw new Error("Task ID must be unique.");
      next.tasks.push({ id: action.id, ...details(action.fields), note: "", completed: false });
      break;
    case "edit": {
      const task = findTask(action.id);
      if (task) Object.assign(task, details(action.fields));
      break;
    }
    case "move": {
      const pending = pendingTasks(next);
      const from = pending.findIndex(task => task.id === action.id);
      const to = from + action.direction;
      if (from < 0 || to < 0 || to >= pending.length || ![-1, 1].includes(action.direction)) break;
      const a = next.tasks.findIndex(task => task.id === pending[from].id);
      const b = next.tasks.findIndex(task => task.id === pending[to].id);
      [next.tasks[a], next.tasks[b]] = [next.tasks[b], next.tasks[a]];
      break;
    }
    case "delete": {
      const index = next.tasks.findIndex(task => task.id === action.id);
      if (index < 0) break;
      const [task] = next.tasks.splice(index, 1);
      next.undo = { kind: "delete", task, index, wasCurrent: next.currentTaskId === task.id };
      if (next.currentTaskId === task.id) next.currentTaskId = null;
      break;
    }
    case "start":
      next.currentTaskId = currentTask(next)?.id ?? pendingTasks(next)[0]?.id ?? null;
      next.view = "focus";
      if (currentTask(next)) next.timer = resumeTimer(next.timer, now);
      break;
    case "complete": {
      const task = currentTask(next);
      if (!task) break;
      next.undo = { kind: "complete", taskId: task.id, pendingIndex: pendingTasks(next).findIndex(item => item.id === task.id) };
      task.completed = true;
      next.currentTaskId = pendingTasks(next)[0]?.id ?? null;
      break;
    }
    case "end": {
      const task = currentTask(next);
      if (task) task.note = String(action.note ?? "").trim();
      next.view = "plan";
      break;
    }
    case "plan":
      next.view = "plan";
      break;
    case "undo": {
      const undo = next.undo;
      if (!undo) break;
      if (undo.kind === "thought-delete") {
        next.thoughts.splice(Math.min(undo.index, next.thoughts.length), 0, undo.thought);
      } else if (undo.kind === "delete") {
        next.tasks.splice(Math.min(undo.index, next.tasks.length), 0, undo.task);
        if (undo.wasCurrent) next.currentTaskId = undo.task.id;
      } else {
        const task = findTask(undo.taskId);
        if (task) {
          // Put it back at its original pending position, retaining later edits.
          next.tasks = next.tasks.filter(item => item.id !== task.id);
          const before = pendingTasks(next)[undo.pendingIndex];
          const index = before ? next.tasks.findIndex(item => item.id === before.id) : next.tasks.length;
          task.completed = false;
          next.tasks.splice(index, 0, task);
          next.currentTaskId = task.id;
          next.view = "focus";
        }
      }
      next.undo = null;
      break;
    }
    case "timer-pause":
      next.timer = pauseTimer(next.timer);
      break;
    case "timer-resume":
      if (next.view === "focus" && currentTask(next)) next.timer = resumeTimer(next.timer, now);
      break;
    case "timer-reset":
      next.timer = initialTimer();
      break;
    case "timer-checkpoint":
      break; // timerAt() above has already accumulated the elapsed time.
    case "thought-add": {
      const text = String(action.text ?? "").trim();
      if (!text) throw new Error("Write a thought before adding it.");
      if (!action.id || next.thoughts.some(thought => thought.id === action.id) ||
          (next.undo?.kind === "thought-delete" && next.undo.thought.id === action.id)) {
        throw new Error("Thought ID must be unique.");
      }
      next.thoughts.push({ id: action.id, text, reviewed: false });
      break;
    }
    case "thought-review": {
      const thought = next.thoughts.find(item => item.id === action.id);
      if (thought) thought.reviewed = !thought.reviewed;
      break;
    }
    case "thought-delete": {
      const index = next.thoughts.findIndex(thought => thought.id === action.id);
      if (index < 0) break;
      const [thought] = next.thoughts.splice(index, 1);
      next.undo = { kind: "thought-delete", thought, index };
      break;
    }
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
  if (next.view !== "focus" || !currentTask(next)) next.timer = pauseTimer(next.timer);
  return next;
}

function validTask(task) {
  return task && typeof task === "object" && typeof task.id === "string" && task.id.length > 0 &&
    typeof task.title === "string" && task.title.trim().length > 0 &&
    ["module", "firstAction", "note"].every(key => typeof task[key] === "string") && typeof task.completed === "boolean";
}

// Be conservative: an unknown format must never be silently replaced.
export function isValidState(state) {
  if (!state || ![1, 2].includes(state.version) || !Array.isArray(state.tasks) || !state.tasks.every(validTask)) return false;
  const ids = new Set(state.tasks.map(task => task.id));
  if (ids.size !== state.tasks.length || !["plan", "focus"].includes(state.view)) return false;
  if (state.currentTaskId !== null && !state.tasks.some(task => task.id === state.currentTaskId && !task.completed)) return false;
  if (state.view === "focus" && pendingTasks(state).length > 0 && state.currentTaskId === null) return false;
  if (state.version === 2) {
    if (!validTimer(state.timer) || !Array.isArray(state.thoughts) || !state.thoughts.every(validThought)) return false;
    if (new Set(state.thoughts.map(thought => thought.id)).size !== state.thoughts.length) return false;
    if (state.timer.runningSince !== null && (state.view !== "focus" || !currentTask(state))) return false;
  }
  if (state.undo === null) return true;
  const undo = state.undo;
  if (!undo || typeof undo !== "object") return false;
  if (undo.kind === "thought-delete") return state.version === 2 && validThought(undo.thought) && !state.thoughts.some(thought => thought.id === undo.thought.id) && Number.isInteger(undo.index) && undo.index >= 0;
  if (undo.kind === "delete") return validTask(undo.task) && !ids.has(undo.task.id) && Number.isInteger(undo.index) && undo.index >= 0 && typeof undo.wasCurrent === "boolean" && (!undo.wasCurrent || !undo.task.completed);
  if (undo.kind === "complete") return state.tasks.some(task => task.id === undo.taskId && task.completed) && Number.isInteger(undo.pendingIndex) && undo.pendingIndex >= 0;
  return false;
}

function validThought(thought) {
  return thought && typeof thought.id === "string" && thought.id.length > 0 &&
    typeof thought.text === "string" && thought.text.trim().length > 0 && typeof thought.reviewed === "boolean";
}
