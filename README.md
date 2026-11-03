# Simple To-Do List (with Timer + Phone Alert)

This project has two versions of the same To-Do List:

| Version | Files | How to run |
|---|---|---|
| Python (console) | `simple_todo_list1.py` | `python simple_todo_list1.py` |
| Website | `index.html`, `style.css`, `script.js` | Open `index.html` in a browser |

## Features (both versions)
- Add task (name, priority High/Medium/Low, due date, time limit in minutes)
- View tasks (with live countdown timer)
- Update task
- Mark task as completed
- Delete task
- Alert: when the timer ends, an alarm plays on the laptop AND a push alert
  (with sound) is sent to the phone
- Manual "Alert phone" button to send a task reminder to the phone instantly

## Phone alert setup (free, no signup)
1. Install the **ntfy** app on your phone (Android / iOS).
2. In the app: "+" -> subscribe to topic `todo-milan-7k3q9x`
   (change the name in `simple_todo_list1.py` -> `NTFY_TOPIC`, and in the website's
   "Phone alert settings", so both use the same unique name).
3. Python: menu option 6. Website: "🔔 Alert phone" button on any task.

For a louder ringtone: ntfy app -> Settings -> set notification sound for
"Max priority" and allow it to override Do Not Disturb.

## Python version
Tasks are saved in `tasks.json`. A background thread (`deadline_watcher`)
checks timers every second. Uses only the standard library (no pip install).

## Website version
Pure HTML + CSS + JavaScript. No install, no build, no backend.
Tasks are saved in the browser's localStorage.
Keep the tab open for automatic timer alerts.

## Deploy website (GitHub Pages)
1. Push all files to a GitHub repo.
2. Repo -> Settings -> Pages -> Source: "Deploy from a branch" -> `main` / `(root)` -> Save.
3. Site goes live at `https://<username>.github.io/<repo>/`.
