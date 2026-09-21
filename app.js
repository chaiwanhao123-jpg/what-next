import { transition, pendingTasks, currentTask, focusQueue } from "./state.js";
import { createStorage } from "./storage.js";

const $ = id => document.getElementById(id);
const storage = createStorage(() => window.localStorage);
const loaded = storage.load();
let state = loaded.state;
let storageIssue = loaded.issue;
let saveLabel = storageIssue ? "Not saved · this tab only" : state.tasks.length ? "Saved in this browser" : "Browser-local storage";
let editingId = null;
let draft = { title: "", module: "", firstAction: "" };

// textContent treats input as text, never as HTML or executable code.
function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function button(text, className, onClick, label = text) {
  const node = element("button", className, text);
  node.type = "button";
  node.setAttribute("aria-label", label);
  node.addEventListener("click", onClick);
  return node;
}

function heading(title, description) {
  const block = element("div", "page-heading");
  const h1 = element("h1", "", title);
  h1.id = "page-title";
  h1.tabIndex = -1;
  block.append(h1, element("p", "lead", description));
  return block;
}

function updateStorageUI() {
  $("save-status").textContent = saveLabel;
  $("save-status").classList.toggle("unsaved", Boolean(storageIssue));
  $("storage-warning").hidden = !storageIssue;
  const messages = {
    invalid: "The saved data is unreadable or uses an unsupported format. It has been left untouched. You can try the app, but changes stay in this tab until you explicitly replace the saved copy. Download that copy first if you want to keep it.",
    unavailable: "Browser storage could not be read. Existing data has not been overwritten. You can use this tab, but your changes will be lost when it closes or reloads. Allow browser storage, then reload to try reading the saved copy again.",
    write: "Your latest changes could not be saved. They are still in this tab, but may be lost if you close or reload it. Free browser storage or allow storage, then retry saving.",
    conflict: "The saved copy changed in another tab or outside this page. This tab has stopped saving to avoid overwriting it. Your latest changes remain here only. Keep this tab open to review them, then reload to load the saved copy.",
  };
  $("storage-message").textContent = messages[storageIssue] ?? "";
  $("download-saved").hidden = storageIssue !== "invalid";
  $("replace-saved").hidden = storageIssue !== "invalid";
  $("retry-save").hidden = storageIssue !== "write";
}

function recordSave(result) {
  storageIssue = result.issue;
  saveLabel = result.ok ? "Saved in this browser" : "Not saved · this tab only";
  updateStorageUI();
}

function dispatch(action, focusId) {
  state = transition(state, action);
  recordSave(storage.save(state));
  render();
  if (focusId) {
    const target = $(focusId);
    // A move to the boundary disables that arrow; keep keyboard focus nearby.
    if (target?.disabled) target.parentElement.querySelector("button:not(:disabled)")?.focus();
    else target?.focus();
  }
}

function renderFeedback() {
  $("feedback").hidden = !state.undo;
  if (!state.undo) return;
  const undo = state.undo;
  const title = undo.kind === "delete" ? undo.task.title : state.tasks.find(task => task.id === undo.taskId)?.title;
  $("feedback-text").textContent = `${undo.kind === "delete" ? "Deleted" : "Completed"}: ${title}`;
}

function taskMeta(task, parent) {
  if (task.module) parent.append(element("span", "module-label", task.module));
  parent.append(element("h3", "task-title", task.title));
  if (task.firstAction) parent.append(element("p", "task-action", task.firstAction));
}

function renderTaskRow(task, index, total, completed = false) {
  const row = element("li", "task-row");
  row.append(element("span", "task-number", completed ? "✓" : String(index + 1).padStart(2, "0")));
  const content = element("div", "task-content");
  taskMeta(task, content);
  if (task.id === state.currentTaskId) content.append(element("span", "resume-label", "Resume here"));
  if (task.note) content.append(element("p", "saved-note", `Left off: ${task.note}`));
  row.append(content);
  const controls = element("div", "task-controls");
  if (!completed) {
    const move = element("div", "move-buttons");
    for (const [direction, arrow, word] of [[-1, "↑", "up"], [1, "↓", "down"]]) {
      const id = `${word}-${task.id}`;
      const control = button(arrow, "icon-button", () => dispatch({ type: "move", id: task.id, direction }, id), `Move ${task.title} ${word}`);
      control.id = id;
      control.disabled = direction === -1 ? index === 0 : index === total - 1;
      move.append(control);
    }
    controls.append(move);
  }
  controls.append(button("Edit", "text-button", () => {
    editingId = task.id;
    draft = { title: task.title, module: task.module, firstAction: task.firstAction };
    render();
    $("task-title").focus();
  }, `Edit ${task.title}`));
  controls.append(button("Delete", "text-button delete-button", () => {
    if (editingId === task.id) resetDraft();
    dispatch({ type: "delete", id: task.id }, "undo-button");
  }, `Delete ${task.title}`));
  row.append(controls);
  return row;
}

function resetDraft() {
  editingId = null;
  draft = { title: "", module: "", firstAction: "" };
}

function renderTaskForm() {
  const panel = element("aside", "form-panel");
  panel.append(element("p", "eyebrow", editingId ? "Make an adjustment" : "One thing at a time"), element("h2", "", editingId ? "Edit your task" : "Add to your plan"));
  const form = element("form", "task-form");
  for (const [key, title, placeholder] of [
    ["title", "Task title", "e.g. CS2040 tutorial"],
    ["module", "Module", "e.g. CS2040"],
    ["firstAction", "First action", "e.g. Attempt question 3"],
  ]) {
    const id = `task-${key === "title" ? "title" : key}`;
    const label = element("label", "", title);
    label.htmlFor = id;
    if (key !== "title") label.append(element("span", "optional", " (optional)"));
    const input = element("input");
    input.id = id;
    input.name = key;
    input.type = "text";
    input.value = draft[key];
    input.placeholder = placeholder;
    input.required = key === "title";
    input.addEventListener("input", () => { draft[key] = input.value; input.setCustomValidity(""); });
    form.append(label, input);
  }
  const hint = element("p", "field-hint", "A small, concrete first action makes it easier to begin.");
  hint.id = "action-hint";
  form.querySelector('[name="firstAction"]').setAttribute("aria-describedby", hint.id);
  form.append(hint);
  const submit = element("button", "primary form-submit", editingId ? "Save changes" : "+ Add task");
  submit.type = "submit";
  form.append(submit);
  if (editingId) form.append(button("Cancel edit", "text-button cancel-edit", () => { resetDraft(); render(); $("task-title").focus(); }));
  form.addEventListener("submit", event => {
    event.preventDefault();
    const title = $("task-title");
    if (!title.value.trim()) {
      title.setCustomValidity("Give the task a title before saving.");
      title.reportValidity();
      return;
    }
    const action = { type: editingId ? "edit" : "add", id: editingId ?? crypto.randomUUID(), fields: { ...draft } };
    resetDraft();
    dispatch(action, "task-title");
  });
  panel.append(form);
  return panel;
}

function renderPlan(main) {
  main.append(heading("Decide now. Settle in.", "Put your tasks in order. When you’re ready, take them one at a time."));
  const layout = element("div", "plan-layout");
  const queue = element("section", "plan-queue");
  const pending = pendingTasks(state);
  const completed = state.tasks.filter(task => task.completed);
  const title = element("div", "section-heading");
  title.append(element("h2", "", "Your study plan"), element("span", "count", `${pending.length} pending`));
  queue.append(title);
  if (pending.length) {
    const list = element("ol", "task-list");
    pending.forEach((task, index) => list.append(renderTaskRow(task, index, pending.length)));
    queue.append(list);
    const start = button(currentTask(state) ? "Resume session →" : "Start session →", "primary start-button", () => dispatch({ type: "start" }, "page-title"));
    start.id = "start-session";
    queue.append(start, element("p", "quiet-note", currentTask(state) ? "Your unfinished task is ready where you left it." : "Just the next task. The rest can wait."));
  } else {
    const empty = element("div", "empty-plan");
    empty.append(element("span", "empty-mark", completed.length ? "✓" : "01"), element("h3", "", completed.length ? "Your plan is complete." : "A clear place to begin."), element("p", "", completed.length ? "Add another task whenever you’re ready." : "Add a task you want to work on. You only need a title to get started."));
    if (!state.tasks.length) empty.append(button("Try two example tasks", "text-button example-button", () => {
      if (state.tasks.length) return;
      state = transition(state, { type: "add", id: crypto.randomUUID(), fields: { title: "CS2040 tutorial", module: "CS2040", firstAction: "Attempt question 3" } });
      dispatch({ type: "add", id: crypto.randomUUID(), fields: { title: "Review lecture notes", module: "", firstAction: "Write down one question to revisit" } }, "start-session");
    }));
    queue.append(empty);
  }
  if (completed.length) {
    const details = element("details", "completed-list");
    details.append(element("summary", "", `Completed (${completed.length})`));
    const list = element("ul", "task-list");
    completed.forEach((task, index) => list.append(renderTaskRow(task, index, completed.length, true)));
    details.append(list);
    queue.append(details);
  }
  layout.append(queue, renderTaskForm());
  main.append(layout);
}

function renderFocus(main) {
  const queue = focusQueue(state);
  const task = currentTask(state);
  if (!task) {
    const complete = element("section", "completion");
    complete.append(element("span", "completion-mark", state.tasks.length ? "✓" : "·"), element("p", "eyebrow", state.tasks.length ? "Nothing left in the queue" : "A fresh start"), heading(state.tasks.length ? "That’s your plan, done." : "Your queue is empty.", state.tasks.length ? "You can stop here. Add something else whenever you’re ready." : "Add a task to give your next study session a starting point."), button("Add tasks →", "primary", () => { resetDraft(); dispatch({ type: "plan" }, "task-title"); }));
    main.append(complete);
    return;
  }
  const wrap = element("div", "focus-layout");
  wrap.append(heading("One thing in front of you.", "Your place is kept. Give this task your attention."));
  const card = element("section", "focus-card");
  card.setAttribute("aria-label", "Current task");
  const cardTop = element("div", "card-top");
  cardTop.append(element("p", "eyebrow", "Working on now"));
  if (task.module) cardTop.append(element("span", "module-label", task.module));
  card.append(cardTop, element("h2", "focus-title", task.title));
  if (task.firstAction) {
    const action = element("div", "first-action");
    action.append(element("p", "eyebrow", "Start here"), element("p", "", task.firstAction));
    card.append(action);
  }
  if (task.note) {
    const note = element("div", "left-off-note");
    note.append(element("p", "eyebrow", "Where you left off"), element("p", "", task.note));
    card.append(note);
  }
  const actions = element("div", "focus-actions");
  const done = button("Done & next →", "primary done-button", () => dispatch({ type: "complete" }, currentTaskAfterCompletion() ? "done-next" : "page-title"));
  done.id = "done-next";
  actions.append(done, button("End session", "text-button", showEndDialog));
  card.append(actions);
  wrap.append(card);
  const next = element("section", "next-preview");
  next.setAttribute("aria-label", "Next task");
  next.append(element("p", "eyebrow", "Up next"));
  const nextContent = element("div");
  nextContent.append(element("h3", "", queue[1]?.title ?? "This is your last task."));
  if (queue[1]?.firstAction) nextContent.append(element("p", "", queue[1].firstAction));
  next.append(nextContent);
  wrap.append(next);
  const all = element("details", "focus-queue");
  all.append(element("summary", "", `See full queue · ${queue.length} remaining`));
  const list = element("ol", "compact-queue");
  queue.forEach((item, index) => {
    const row = element("li");
    row.append(element("span", "", item.title));
    if (index === 0) row.append(element("span", "resume-label", "Current"));
    list.append(row);
  });
  all.append(list, button("Edit study plan", "text-button", () => dispatch({ type: "plan" }, "page-title")));
  wrap.append(all);
  main.append(wrap);
}

function currentTaskAfterCompletion() {
  return pendingTasks(state).length > 1;
}

function showEndDialog() {
  $("left-off").value = currentTask(state)?.note ?? "";
  $("end-dialog").showModal();
  $("left-off").focus();
}

function render() {
  $("main").replaceChildren();
  $("plan-step").classList.toggle("active-step", state.view === "plan");
  $("focus-step").classList.toggle("active-step", state.view === "focus");
  $("plan-step").setAttribute("aria-current", state.view === "plan" ? "step" : "false");
  $("focus-step").setAttribute("aria-current", state.view === "focus" ? "step" : "false");
  renderFeedback();
  if (state.view === "plan") renderPlan($("main"));
  else renderFocus($("main"));
}

$("undo-button").addEventListener("click", () => dispatch({ type: "undo" }, "page-title"));
$("home-link").addEventListener("click", event => { event.preventDefault(); dispatch({ type: "plan" }, "page-title"); });
$("cancel-end").addEventListener("click", () => $("end-dialog").close());
$("end-form").addEventListener("submit", event => {
  event.preventDefault();
  const note = $("left-off").value;
  $("end-dialog").close();
  dispatch({ type: "end", note }, "page-title");
});
$("retry-save").addEventListener("click", () => recordSave(storage.save(state)));
$("replace-saved").addEventListener("click", () => $("replace-dialog").showModal());
$("cancel-replace").addEventListener("click", () => $("replace-dialog").close());
$("confirm-replace").addEventListener("click", () => {
  $("replace-dialog").close();
  recordSave(storage.replace(state));
});
$("download-saved").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([storage.unreadableCopy()], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "what-next-unreadable-backup.txt";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("storage", event => {
  // Run the same conflict check, without reloading or losing unsaved edits.
  if (event.key === "what-next.state.v1" || event.key === null) recordSave(storage.save(state));
});
updateStorageUI();
render();
