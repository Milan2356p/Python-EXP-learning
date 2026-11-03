# Simple To-Do List

This project has two versions of the same To-Do List:

| Version | Files | How to run |
|---|---|---|
| Python (console) | `simple_todo_list1.py` | `python simple_todo_list1.py` |
| Website | `index.html`, `style.css`, `script.js` | Open `index.html` in a browser |

## Features (both versions)
- Add task (name, priority High/Medium/Low, due date)
- View tasks
- Update task
- Mark task as completed
- Delete task

## Python version
Tasks are saved in `tasks.json`.

## Website version
Pure HTML + CSS + JavaScript. No install, no build, no backend.
Tasks are saved in the browser's localStorage.

## Deploy website (GitHub Pages)
1. Push all files to a GitHub repo.
2. Repo -> Settings -> Pages -> Source: "Deploy from a branch" -> `main` / `(root)` -> Save.
3. Site goes live at `https://<username>.github.io/<repo>/`.
