# How What Next works

Start with `state.js`: it describes the behavior without needing to understand HTML. Then read `app.js` to see that behavior connected to buttons and cards.

## The data model

The app keeps one JavaScript object called `state`. An object with named fields is similar to a Python dictionary or a simple Java data class. This is an illustrative state, not automatically loaded example data:

```js
{
  version: 2,
  tasks: [
    {
      id: "a-stable-uuid",
      title: "CS2040 tutorial",
      module: "CS2040",
      firstAction: "Attempt question 3",
      note: "Part (a) is done. Draw the tree for part (b).",
      completed: false
    }
  ],
  currentTaskId: "a-stable-uuid",
  view: "focus",
  undo: null,
  timer: { elapsedMs: 1800000, stretchMs: 600000, runningSince: null },
  thoughts: [{ id: "thought-uuid", text: "Look up tree visualisations", reviewed: false }]
}
```

- `version` identifies the saved format. Unsupported versions are not automatically overwritten.
- `tasks` is an ordered array, like a Python list or Java `ArrayList`. Completed tasks remain stored; the pending queue filters them out.
- `id` is generated once with `crypto.randomUUID()`. Titles and array positions can change; identity does not. IDs let an edit find the correct task after reordering.
- `currentTaskId` points to an unfinished task by its ID, or is `null` (like Python `None`). Ending a session keeps this ID, so resuming stays on the same task.
- `view` is either `"plan"` or `"focus"`. An empty focus queue renders the completion/empty screen.
- `undo` stores the most recent deletion or completion. It is not an entire copy of the previous app state, so later edits can survive Undo.
- `timer` stores total study milliseconds, the current/last stretch in milliseconds, and a timestamp anchor while running. `null` means paused.
- `thoughts` is independent of the task queue. Each thought has a stable ID, text, and a `reviewed` boolean.

For deletion, Undo stores the deleted task, its array position, and whether it was current. For completion, Undo stores the task's ID and original pending position. Undo completion marks it unfinished, restores its pending position, and selects it again. Another deletion or completion replaces this single Undo record.

Thought deletion uses a third Undo kind, `"thought-delete"`, storing the thought and its index. Adding or reviewing thoughts leaves task Undo alone; deleting a thought replaces it. Timer pause/resume and reset never undo task changes, and task Undo does not rewind time.

`pendingTasks(state)` filters out completed tasks. `focusQueue(state)` puts the selected unfinished task first, followed by the other pending tasks in plan order. That is why changing the plan while paused does not unexpectedly switch what you resume.

## From clicking Done to the next screen

1. **The browser receives a click.** In `app.js`, `renderFocus()` makes the button and attaches a callback with `addEventListener`. A callback is just a function handed to another piece of code to run later—similar to passing a function in Python or using a Java listener/lambda.
2. **The event handler dispatches an action.** `dispatch({ type: "complete" })` describes what happened. An action is an ordinary object, not a framework feature.
3. **The state function calculates the result.** `transition(state, action)` in `state.js` starts with `structuredClone(state)`, like `copy.deepcopy` in Python. It accounts for elapsed timer time using the timestamp supplied by `dispatch()`. In the `"complete"` case it records Undo, sets the current task's `completed` field to `true`, and selects the first remaining pending task. If none remain, `currentTaskId` becomes `null` and timing pauses. Otherwise a running stretch continues.
4. **The app adopts the new state.** `state = transition(...)` replaces the in-memory state. The previous object was not modified. This is a *pure transition*: identical state and action inputs give the same result, without touching the screen or disk. IDs are generated outside this function and passed in for the same reason.
5. **The app attempts to save.** `storage.save(state)` first checks that the saved copy has not changed elsewhere. `JSON.stringify(state)` turns the object into a string, like Python `json.dumps`. `localStorage.setItem(...)` stores that string. This API is synchronous: the save attempt completes before the next statement runs.
6. **The interface reports the real outcome.** A successful write shows “Saved in this browser.” A failure shows “Not saved · this tab only” and a warning. The in-memory state is still usable; a failed write never gets a success label.
7. **The screen is rendered again.** `render()` replaces the content inside `<main>`. `renderFocus()` reads the updated current task, builds its card, and shows the next preview. With no remaining task, it builds the completion screen. The Undo banner remains available, including after the final task.

This order is **event → transition → save attempt → render**. The UI advances even if storage fails, while explicitly reporting that progress is only in memory. No page reload or server request is needed for this transition.

## What is the DOM?

The DOM (Document Object Model) is the browser's object tree representing the HTML page. `document.createElement("button")` creates an element; `parent.append(child)` puts it in the tree. `document.getElementById(...)` looks up an existing element by its HTML ID.

The `element()` helper in `app.js` sets `textContent`. If you type `<img src=x onerror=...>`, the browser displays those characters as text. It does not interpret them as markup. Inputs use `.value` for the same reason. User text is never passed to `innerHTML`.

The form uses native labels and input validation, plus a trimmed-title check to reject a title containing only spaces. Optional module and first-action fields remain empty strings when omitted. Native `<details>` elements provide the collapsed queues; native `<dialog>` elements provide the end-session note and explicit recovery confirmation.

## A few JavaScript translations

| JavaScript | Rough Python / Java comparison |
| --- | --- |
| `const task = ...` | A binding you cannot reassign, like Java `final`; the object's fields can still change. |
| `let state = ...` | A reassignable local variable. |
| `task => !task.completed` | Python `lambda task: not task["completed"]`, or a Java lambda. |
| `tasks.filter(predicate)` | A Python filtered list comprehension or Java stream filter; returns a new array. |
| `tasks.find(predicate)` | Returns the first match, or `undefined` if absent. |
| `===` | Strict equality without converting strings to numbers. |
| `value ?? fallback` | Use the fallback only for `null` or `undefined`, not for `0`, `false`, or `""`. |
| `task?.id` | Read `id` if `task` exists; otherwise return `undefined` instead of throwing. |
| `{ ...draft }` | A shallow object copy, similar to Python `dict(draft)`. |
| `import` / `export` | ES modules share functions between files, similar to Python imports. |

`package.json` sets `"type": "module"` so Node understands the same imports as the browser. There are no package dependencies. `npm test` simply runs Node's built-in test runner.

## Reloading and storage errors

At startup, `storage.load()` tries to read one localStorage key. Missing data creates an empty state; present data is parsed with `JSON.parse` (like Python `json.loads`) and validated by `isValidState`. Validation checks field types, unique IDs, a valid current-task reference, and the Undo record.

Version 2 validation also checks timer values, thought IDs/text/review flags, and thought-deletion Undo. `restoreState()` upgrades valid version 1 data to version 2 without changing its tasks or Undo. It adds default timer/thought fields, then pauses the timer. It never adds the time between the last saved checkpoint and reopening. Loading itself does not overwrite the saved copy, and the original `what-next.state.v1` storage key stays in use.

## Timer example: 30 minutes, a break, then 10 more

`timer.js` contains pure functions. The browser supplies `Date.now()` through actions, like passing a clock reading as a Python function argument. Tests can pass known numbers instead of waiting in real time.

```text
Start:        total = 0,      stretch = 0,      runningSince = start timestamp
30 min later: total = 30 min, stretch = 30 min, runningSince = checkpoint timestamp
Pause:        total = 30 min, stretch = 30 min, runningSince = null
Take a break: no change
Resume:       total = 30 min, stretch = 0,      runningSince = resume timestamp
10 min later: total = 40 min, stretch = 10 min
```

`timerAt(timer, now)` adds `now - runningSince` to both counters and advances the anchor. Moving the anchor prevents counting the same seconds twice. It clamps a backwards clock change at the old anchor rather than subtracting time.

`updateTimerDisplay()` computes the current values without mutating state and only changes the two number elements. It runs each second using `setInterval`, the browser's repeated-callback API. Another interval dispatches a checkpoint to the state function and saves every five seconds while running. The timer calculates elapsed time from timestamps, rather than assuming each callback arrived exactly one second later. Typing a thought is therefore not interrupted by a full rerender on every tick.

Page exit attempts to pause and save. A crash may skip that event, so restoration uses the last successfully saved counters and waits for you to resume. Switching tabs does not automatically pause, since studying may happen in another tab. Pause manually for breaks and sleep; the timer cannot detect attention and is not proof of continuous studying.

## Capturing a thought

`renderThoughts()` creates a small form and a collapsed list. Submission trims and rejects blank input, generates an ID, and dispatches `"thought-add"`. The reducer adds `{ id, text, reviewed: false }` to `thoughts`; the usual save/render flow follows. The checkbox dispatches `"thought-review"`, and Delete dispatches `"thought-delete"`. All thought text uses the same safe `textContent` helper as task titles. Thoughts are not tasks and are never inserted into `pendingTasks()`.

If reading or validation fails, the app does **not** write an empty state over the saved copy. It blocks normal saves and shows a warning. Unreadable data can be downloaded and replaced only through a deliberate confirmation. Failed writes can be retried. Tests supply a fake storage object that throws errors, so failure behavior is repeatable without damaging real browser data.

`localStorage` belongs to a browser profile and an **origin**: protocol + hostname + port. `http://localhost:8000` and `http://localhost:8001` are different origins. Keep the run command and address consistent. Python only serves the source files; it never receives or saves your task data.

## Reading and changing the prototype

The browser must reload to pick up source edits. Saved task changes survive reload when storage works; unsubmitted form drafts do not.

For a behavior change, find the relevant `transition` case and its test first, then inspect the corresponding event handler in `app.js`. For visual changes, edit `styles.css`. Keep the current scope small, and use the blank observation notes to decide what actually needs improving after you try studying with it.
