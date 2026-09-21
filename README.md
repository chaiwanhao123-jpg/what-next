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

Undo covers **one most recent deletion or completion**, has no timer, and is saved across reloads. A later deletion or completion replaces that Undo action. Edits, reordering, and form drafts have no Undo history. Only saved task edits and submitted end-session notes persist; text still being typed into a form is a draft.

## Storage and limitations

State is stored under `what-next.state.v1` in `localStorage`. Every committed change attempts a save. Refreshing or reopening in the **same browser/profile and origin** restores tasks, completion status, the selected task, the screen, notes, and Undo.

Storage is local to the browser. It does not sync across devices, and clearing site/browser data may remove it. Private browsing may discard it when closed. A local Git checkpoint saves application files, **not your browser's study data**.

- **Unreadable data:** malformed JSON, unknown schema versions, and invalid state are left untouched. The app shows a warning and runs in memory. Download the unreadable copy before choosing the explicit replacement action if you want to keep it. Replacement requires a confirmation in the app.
- **Unavailable storage:** the app remains usable in the tab and clearly says changes are not saved. Allow storage and reload to try reading again; in-memory changes will be lost on reload.
- **Failed writes:** the last successfully saved copy is retained. Current changes stay in memory. Fix storage availability/capacity and use **Retry saving** before closing the tab.
- **Multiple tabs:** a changed saved copy stops this tab from saving rather than silently overwriting the detected change. Use one tab for studying. `localStorage` has no transactional compare-and-swap, so simultaneous writes are not guaranteed safe; there is no cross-tab merge.

Use a recent browser with JavaScript modules, `structuredClone`, `crypto.randomUUID`, and native `<dialog>` support. The responsive phone layout can be previewed in desktop browser developer tools; a real phone runs in its own browser/origin and does not share desktop tasks. There is no installable/offline service worker, long-term backup/import system, scheduling, parked tasks, Later box, or full Undo history.

## Tests

Node is already installed. No `npm install` is necessary:

```sh
cd /Users/wanhao/Downloads/what-next
npm test
```

This uses Node's built-in `node:test` runner. `tests/state.test.js` covers task transitions and state validation. `tests/storage.test.js` uses a small in-memory storage adapter to exercise persistence, corruption, quota/access failures, explicit recovery, and conflict detection. These tests do not alter your browser's stored tasks.

Verification performed during this build:

- **16 automated tests passed** with `npm test`.
- In the Codex in-app browser at `http://localhost:8000/`: blank-title rejection; adding tasks with and without optional fields; editing; reordering; deletion and Undo; start; immediate completion advancement and Undo; end with a note; refresh and resume of the same task/note; keeping the current task after reordering; full-queue expansion; all-complete state; final-task Undo after refresh; and returning to an empty plan without loading examples.
- Visually inspected the desktop plan and focus screens at a 1280-pixel viewport, plus the plan, focus screen, and note dialog at 375 pixels. DOM measurements showed no horizontal overflow in the narrow plan and focus views.
- Verified an HTML-looking task title displayed literally and created zero image elements. Keyboard activation of a reorder arrow retained focus on the remaining usable arrow. The browser reported no captured console warnings or errors at the end of the flow.
- Browser test tasks were synthetic and were removed through the app's Delete buttons afterward. The test browser's one-step Undo can still restore the last deleted synthetic task. A fresh browser/profile starts empty.

Storage failures and corrupt-data recovery were exercised with automated storage adapters, **not by filling the real browser's disk or changing its privacy settings**. No real phone, screen reader, exhaustive browser compatibility, or long-term browser-data retention test was performed. The examples button was implemented and reviewed but not exercised in the browser flow.

### Your short manual checklist

- [ ] Open the exact URL in the browser/profile you will actually study with. Add two real tasks; try leaving the optional fields empty.
- [ ] Edit and reorder, then start. Complete one task and Undo it. Delete a task from the plan and Undo that too.
- [ ] End partway through with a note. Close and reopen the tab at the same URL; confirm Resume shows the same task and note.
- [ ] Finish the queue, refresh, and confirm it stays complete. Add a new task only when you choose.
- [ ] Try Tab/Shift+Tab/Enter, Escape in the note dialog, and your preferred narrow layout or zoom level. Check the controls remain usable.
- [ ] Record two real study sessions in `OBSERVATIONS.md`. Report any saving warning before relying on persistence.

## Files

```text
index.html          Page shell and native dialogs
styles.css          Layout, colors, responsive styles, keyboard focus
state.js            Task model, pure transitions, saved-data validation
storage.js          Read/write adapter and failure handling
app.js              DOM rendering and event handlers
tests/              Dependency-free Node tests
LEARNING.md         Data model and a walkthrough of Done & next
OBSERVATIONS.md     Blank notes for two real study sessions
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
git add index.html styles.css app.js state.js storage.js package.json README.md LEARNING.md OBSERVATIONS.md tests .gitignore
git diff --cached --stat
git commit -m "Build What Next study-session prototype"
```

Review the staged file list before committing. If Git asks for identity, set your actual name and email with `git config user.name "Your Name"` and `git config user.email "your-email"` inside this app repository, then retry the commit. No remote or `git push` is needed.

## AI assistance

This prototype's code, tests, and documentation were generated and revised with AI coding assistance from Codex in response to the project brief. Automated tests and browser checks are technical verification, not evidence that the app improves studying. No real study observations, user feedback, productivity gains, or business validation have been collected or invented. `OBSERVATIONS.md` is intentionally blank for your own use.
