const STORAGE_KEY = "tasks";
let tasks = loadTasks();
let filter = "all";

const form = document.getElementById("task-form");
const idInput = document.getElementById("task-id");
const titleInput = document.getElementById("title");
const priorityInput = document.getElementById("priority");
const dueInput = document.getElementById("due-date");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const list = document.getElementById("task-list");
const empty = document.getElementById("empty");

function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// YYYY-MM-DD -> DD-MM-YYYY
function formatDate(d) {
  if (!d) return "No due date";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function render() {
  list.innerHTML = "";
  const shown = tasks.filter(t =>
    filter === "all" ? true : filter === "completed" ? t.completed : !t.completed
  );
  empty.hidden = shown.length > 0;

  shown.forEach(t => {
    const li = document.createElement("li");
    li.className = t.priority + (t.completed ? " done" : "");

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = t.title; // textContent = safe from HTML injection

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `ID: ${t.id} | Priority: ${t.priority} | Due: ${formatDate(t.due_date)} | ${t.completed ? "Completed" : "Pending"}`;

    const actions = document.createElement("div");
    actions.className = "actions";

    if (!t.completed) actions.appendChild(makeBtn("✔ Complete", "done-btn", () => complete(t.id)));
    actions.appendChild(makeBtn("✎ Edit", "edit-btn", () => startEdit(t.id)));
    actions.appendChild(makeBtn("🗑 Delete", "del-btn", () => remove(t.id)));

    li.append(title, meta, actions);
    list.appendChild(li);
  });
}

function makeBtn(text, cls, handler) {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.addEventListener("click", handler);
  return b;
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  if (idInput.value) {
    const t = tasks.find(x => x.id === Number(idInput.value));
    if (t) {
      t.title = title;
      t.priority = priorityInput.value;
      t.due_date = dueInput.value;
    }
  } else {
    const newId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    tasks.push({
      id: newId,
      title,
      priority: priorityInput.value,
      due_date: dueInput.value,
      completed: false
    });
  }
  saveTasks();
  resetForm();
  render();
});

cancelBtn.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  idInput.value = "";
  submitBtn.textContent = "Add Task";
  cancelBtn.hidden = true;
}

function startEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  idInput.value = t.id;
  titleInput.value = t.title;
  priorityInput.value = t.priority;
  dueInput.value = t.due_date;
  submitBtn.textContent = "Update Task";
  cancelBtn.hidden = false;
  titleInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function complete(id) {
  const t = tasks.find(x => x.id === id);
  if (t) t.completed = true;
  saveTasks();
  render();
}

function remove(id) {
  if (!confirm("Delete this task?")) return;
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filter = btn.dataset.filter;
    render();
  });
});

render();
