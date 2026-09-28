# What Next?

A small, personal study-session app for deciding a sequence of tasks and keeping your place. Built with plain HTML, CSS, and JavaScript. No framework, backend, accounts, external APIs, third-party fonts, or paid services.

## Run locally

Python 3 is already installed on this computer. In a terminal, run:

```sh
cd /Users/wanhao/Downloads/what-next
python3 -m http.server 8000 --bind localhost
```

Open **http://localhost:8000/** in the browser you intend to use for studying. Leave the terminal running; press `Ctrl+C` to stop the server. If this server is already running, just open the URL. If port 8000 is busy, stop the previous server using its terminal instead of changing ports or stopping an unknown process.

Always use that exact origin: `http://localhost:8000`. `127.0.0.1`, a different port, another browser/profile, and the Codex in-app browser each have separate storage. Do not open `index.html` directly with `file://`: the JavaScript modules need an HTTP server. This server binds only to the local machine; it does not publish the app or make it accessible from your phone.

## Use it

- **Plan:** add a required title, an optional module, and an optional concrete first action. Whitespace-only titles are rejected. Edit details, reorder pending tasks with arrows, or delete with Undo.
- **Focus:** start the session to see one current task, its first action, any saved note, and a small next-task preview. The full pending queue is collapsed by default. Expand it to edit your plan.
- **Done & next:** complete the current task and advance immediately. Undo returns to that task and its pending position. The final task leads to a calm completion screen.
- **End session:** save an optional “where I left off” note and return to the plan without completing the task. Resume returns to that same unfinished task, even if you reordered the pending plan. It is marked “Resume here.” Other tasks then follow the plan order.
- **Completed tasks:** remain in a collapsed section on the plan screen. They are not automatically reset.
- **Examples:** two explicitly labeled examples can be loaded only by clicking the example button when there are no tasks, including completed tasks. They never reload automatically.
- **Study timer:** starting/resuming a session starts timing. **Pause for a break** freezes the total and retains the last stretch. **Resume studying** starts a new uninterrupted stretch while keeping the total. Completing a task keeps a running stretch going; completing the queue, ending the session, or returning to the plan pauses it. Completing while paused does not restart it. Undo does not rewind or invent elapsed time.
- **Reset time:** clears the total and stretch after confirmation and leaves timing paused. Tasks, progress, notes, thoughts, and task Undo are unaffected. Totals otherwise stay across sessions; there is no daily reset, score, streak, or session-history chart.
- **For later:** capture a thought from the plan, focus, or completion screen. The saved list is collapsed initially. Expand it to mark a thought reviewed (or uncheck it), or delete it with Undo. Capturing/reviewing a thought does not complete a task or replace task Undo. Thoughts are plain text; the app does not automatically search or open links.

Undo covers **one most recent task completion, task deletion, or thought deletion**, has no expiry, and is saved across reloads. A later deletion or completion replaces that Undo action. Edits, reordering, timer resets, and form drafts have no Undo history. Submitted tasks, notes, and thoughts persist; text still being typed into a form is a draft.

## Storage and limitations

State is stored under `what-next.state.v1` in `localStorage`. The key stays the same for compatibility, but the saved schema is now version 2. Valid version 1 saves are upgraded in memory, keeping task IDs, order, notes, progress, screen, and Undo. They receive an empty thought list and a zeroed, paused timer; no past study time is inferred. The upgraded copy is written only on a subsequent save. Unreadable data is still preserved.

Every committed change attempts a save. Refreshing or reopening in the **same browser/profile and origin** restores tasks, completion status, the selected task, the screen, notes, thoughts, and Undo. The timer restores its last saved total and stretch **paused**, so time with the app closed is not counted. Press **Resume studying** to continue.

The display updates every second; a running timer attempts a checkpoint every five seconds and on each action. Leaving/reloading the page also attempts a final pause and save. If the browser crashes or suppresses that final event, time since the last successful checkpoint is lost (normally up to five seconds; longer if background callbacks were throttled or saving failed). There is no automatic detection of whether you are studying: switching tabs or putting the computer to sleep while the page remains loaded can still count elapsed time. Pause before breaks or sleep. Timer calculations use the computer clock, so manual clock changes can affect them.

Storage is local to the browser. It does not sync across devices, and clearing site/browser data may remove it. Private browsing may discard it when closed. A local Git checkpoint saves application files, **not your browser's study data**.

- **Unreadable data:** malformed JSON, unknown schema versions, and invalid state are left untouched. The app shows a warning and runs in memory. Download the unreadable copy before choosing the explicit replacement action if you want to keep it. Replacement requires a confirmation in the app.
- **Unavailable storage:** the app remains usable in the tab and clearly says changes are not saved. Allow storage and reload to try reading again; in-memory changes will be lost on reload.
- **Failed writes:** the last successfully saved copy is retained. Current changes stay in memory. Fix storage availability/capacity and use **Retry saving** before closing the tab.
- **Multiple tabs:** a changed saved copy stops this tab from saving rather than silently overwriting the detected change. Use one tab for studying. `localStorage` has no transactional compare-and-swap, so simultaneous writes are not guaranteed safe; there is no cross-tab merge.

Use a recent browser with JavaScript modules, `structuredClone`, `crypto.randomUUID`, and native `<dialog>` support. The responsive phone layout can be previewed in desktop browser developer tools; a real phone runs in its own browser/origin and does not share desktop tasks. There is no installable/offline service worker, long-term backup/import system, scheduling, parked tasks, or full Undo history.

## Tests

Node is already installed. No `npm install` is necessary:

```sh
cd /Users/wanhao/Downloads/what-next
npm test
```

This uses Node's built-in `node:test` runner. `tests/state.test.js` covers task transitions and state validation. `tests/storage.test.js` uses a small in-memory storage adapter to exercise persistence, corruption, quota/access failures, explicit recovery, and conflict detection. These tests do not alter your browser's stored tasks.

Verification of the original version:

- **16 automated tests passed** with `npm test`.
- In the Codex in-app browser at `http://localhost:8000/`: blank-title rejection; adding tasks with and without optional fields; editing; reordering; deletion and Undo; start; immediate completion advancement and Undo; end with a note; refresh and resume of the same task/note; keeping the current task after reordering; full-queue expansion; all-complete state; final-task Undo after refresh; and returning to an empty plan without loading examples.
- Visually inspected the desktop plan and focus screens at a 1280-pixel viewport, plus the plan, focus screen, and note dialog at 375 pixels. DOM measurements showed no horizontal overflow in the narrow plan and focus views.
- Verified an HTML-looking task title displayed literally and created zero image elements. Keyboard activation of a reorder arrow retained focus on the remaining usable arrow. The browser reported no captured console warnings or errors at the end of the flow.
- Browser test tasks were synthetic and were removed through the app's Delete buttons afterward. The test browser's one-step Undo can still restore the last deleted synthetic task. A fresh browser/profile starts empty.

Storage failures and corrupt-data recovery were exercised with automated storage adapters, **not by filling the real browser's disk or changing its privacy settings**. No real phone, screen reader, exhaustive browser compatibility, or long-term browser-data retention test was performed. The examples button was implemented and reviewed but not exercised in the browser flow.

Verification of the timer and For later update (28 September 2026):

- **31 automated tests passed**, including the original transitions, break exclusion, repeated checkpoints, continuous timing across tasks, final-task pause/Undo, clock rollback, reset isolation, thought validation/review/deletion/Undo, version 1 migration, reopening paused, malformed version 2 data, and a failed save after migration.
- Browser checks used a temporary copy of the app with an isolated storage key, keeping the existing real study queue untouched. Checked start/pause/resume, unchanged time during a break, uninterrupted typing across timer updates, refresh restoring the same time paused, end/resume with a note, completion and Undo, and cancelling/confirming reset while retaining tasks and thoughts.
- Checked blank-thought rejection, review state, deletion/Undo, thought persistence after refresh, and HTML-looking thought text rendering without creating an image. Inspected desktop and 375-pixel focus layouts; narrow plan/focus DOM measurements showed no horizontal overflow. No console warnings or errors were captured during the test flow.
- Temporary browser test files were removed after verification. Your original observations were not rewritten as test outcomes. Real-phone, Safari-specific, sleep/wake, crash, and screen-reader checks remain manual.

### Your short manual checklist

- [ ] Open the exact URL in the browser/profile you will actually study with. Add two real tasks; try leaving the optional fields empty.
- [ ] Edit and reorder, then start. Complete one task and Undo it. Delete a task from the plan and Undo that too.
- [ ] End partway through with a note. Close and reopen the tab at the same URL; confirm Resume shows the same task and note.
- [ ] Finish the queue, refresh, and confirm it stays complete. Add a new task only when you choose.
- [ ] Try Tab/Shift+Tab/Enter, Escape in the note dialog, and your preferred narrow layout or zoom level. Check the controls remain usable.
- [ ] Time a short study stretch, pause for a break, and resume. Confirm the total excludes the pause and the new stretch starts from zero.
- [ ] Refresh while timing. Confirm the timer returns paused with the saved time. Try Reset time and check that your tasks remain.
- [ ] Capture a thought, reload, mark it reviewed, delete it, and Undo. Check it never changes your current task.
- [ ] Record two real study sessions in `OBSERVATIONS.md`. Report any saving warning before relying on persistence.

## Files

```text
index.html          Page shell and native dialogs
styles.css          Layout, colors, responsive styles, keyboard focus
state.js            Task model, pure transitions, saved-data validation
storage.js          Read/write adapter and failure handling
timer.js            Pure elapsed-time calculations and duration formatting
app.js              DOM rendering and event handlers
tests/              Dependency-free Node tests
LEARNING.md         Data model and a walkthrough of Done & next
OBSERVATIONS.md     Your Session 1 feedback and blank Session 2 notes
package.json        ES module setting and test command
```

Read `LEARNING.md`, then `state.js`, then `app.js` to follow the main behavior. Inspect `storage.js` next when you want to understand persistence failures.

## Save a local Git checkpoint

Inspection found that this folder currently inherits a Git repository at `/Users/wanhao`. Do not run `git add .` from your home directory. No Git repository, commit, or push was created during this build.

To make this app its own repository, run these commands from this exact folder. `git init` creates a separate local `.git` inside the app; it does not modify the parent repository's history. If you deliberately want the home-level repository to own this app, skip these instructions and choose that workflow yourself.

```sh
cd /Users/wanhao/Downloads/what-next
git init
git rev-parse --show-toplevel
```

Confirm the last command prints `/Users/wanhao/Downloads/what-next`, then:

```sh
git add index.html styles.css app.js state.js storage.js timer.js package.json README.md LEARNING.md OBSERVATIONS.md tests .gitignore
git diff --cached --stat
git commit -m "Build What Next study-session prototype"
```

Review the staged file list before committing. If Git asks for identity, set your actual name and email with `git config user.name "Your Name"` and `git config user.email "your-email"` inside this app repository, then retry the commit. No remote or `git push` is needed.

## AI assistance

This prototype's code, tests, and documentation were generated and revised with AI coding assistance from Codex in response to the project brief and your Session 1 feedback. `OBSERVATIONS.md` records observations you supplied; Session 2 remains blank. Automated tests and browser checks are technical verification, not evidence that the app improves studying. No productivity gains or business validation have been measured or invented.
