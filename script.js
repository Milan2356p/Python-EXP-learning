const STORAGE_KEY = "tasks";
const TOPIC_KEY = "ntfyTopic";
const DEFAULT_TOPIC = "todo-milan-7k3q9x"; // same as NTFY_TOPIC in the Python file

let tasks = loadTasks();
let filter = "all";

const form = document.getElementById("task-form");
const idInput = document.getElementById("task-id");
const titleInput = document.getElementById("title");
const priorityInput = document.getElementById("priority");
const dueInput = document.getElementById("due-date");
const limitInput = document.getElementById("time-limit");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const list = document.getElementById("task-list");
const empty = document.getElementById("empty");
const topicInput = document.getElementById("topic");
const toast = document.getElementById("toast");
const alarmBox = document.getElementById("alarm");
const alarmText = document.getElementById("alarm-text");

/* ---------- storage ---------- */
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

function getTopic() {
  return localStorage.getItem(TOPIC_KEY) || DEFAULT_TOPIC;
}

/* ---------- helpers ---------- */
// YYYY-MM-DD -> DD-MM-YYYY
function formatDate(d) {
  if (!d) return "No due date";
  const [y, m, day] = d.split("-");
  return `${day}-${m}-${y}`;
}

function timerText(t) {
  if (t.completed) return { text: "Done", over: false };
  if (!t.deadline) return { text: "No time limit", over: false };
  const remaining = Math.floor((t.deadline - Date.now()) / 1000);
  if (remaining <= 0) return { text: "TIME UP (overdue)", over: true };
  const h = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  return { text: `${h}:${m}:${s} left`, over: false };
}

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => (toast.hidden = true), 3500);
}

/* ---------- phone alert (ntfy.sh) ---------- */
function sendAlert(title, message) {
  const params = new URLSearchParams({
    title,
    message,
    priority: "5",
    tags: "alarm_clock"
  });
  const url = `https://ntfy.sh/${encodeURIComponent(getTopic())}/publish?${params}`;
  // no-cors: we only need to fire the request, we don't read the reply
  return fetch(url, { mode: "no-cors" })
    .then(() => showToast("Alert sent to phone ✅"))
    .catch(() => showToast("Could not send alert (check internet) ❌"));
}

/* ---------- laptop alarm sound (Web Audio) ---------- */
let audioCtx = null;
let alarmInterval = null;

function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
document.addEventListener("click", unlockAudio);

function beep() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.value = 0.15;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.25);
}

function startAlarm(task) {
  alarmText.textContent = `Task: ${task.title}`;
  alarmBox.hidden = false;
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  clearInterval(alarmInterval);
  beep();
  alarmInterval = setInterval(beep, 600);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Time is up!", { body: task.title });
  }
}

function stopAlarm() {
  clearInterval(alarmInterval);
  alarmBox.hidden = true;
}
document.getElementById("stop-alarm").addEventListener("click", stopAlarm);

/* ---------- rendering ---------- */
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

    const timer = document.createElement("div");
    timer.className = "meta";
    timer.append("⏳ Timer: ");
    const span = document.createElement("span");
    span.className = "timer";
    span.id = "timer-" + t.id;
    timer.appendChild(span);

    const actions = document.createElement("div");
    actions.className = "actions";

    if (!t.completed) {
      actions.appendChild(makeBtn("✔ Complete", "done-btn", () => complete(t.id)));
      actions.appendChild(makeBtn("🔔 Alert phone", "alert-btn", () => alertPhone(t)));
    }
    actions.appendChild(makeBtn("✎ Edit", "edit-btn", () => startEdit(t.id)));
    actions.appendChild(makeBtn("🗑 Delete", "del-btn", () => remove(t.id)));

    li.append(title, meta, timer, actions);
    list.appendChild(li);
  });

  updateTimers();
}

function makeBtn(text, cls, handler) {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.addEventListener("click", handler);
  return b;
}

/* ---------- timer tick (runs every second) ---------- */
function updateTimers() {
  tasks.forEach(t => {
    const span = document.getElementById("timer-" + t.id);
    if (span) {
      const { text, over } = timerText(t);
      span.textContent = text;
      span.classList.toggle("over", over);
    }
  });
}

function checkDeadlines() {
  let changed = false;
  tasks.forEach(t => {
    if (t.deadline && !t.completed && !t.alerted && Date.now() >= t.deadline) {
      t.alerted = true;
      changed = true;
      startAlarm(t);
      sendAlert("Time is up!", `Task: ${t.title} (Priority: ${t.priority}). Do it now!`);
    }
  });
  if (changed) saveTasks();
}

setInterval(() => {
  checkDeadlines();
  updateTimers();
}, 1000);

/* ---------- actions ---------- */
function alertPhone(t) {
  sendAlert("Task Reminder", `Do this task now: ${t.title} (Priority: ${t.priority})`);
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  const minutes = parseFloat(limitInput.value);
  const hasLimit = !isNaN(minutes) && minutes > 0;

  if (hasLimit && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if (idInput.value) {
    const t = tasks.find(x => x.id === Number(idInput.value));
    if (t) {
      t.title = title;
      t.priority = priorityInput.value;
      t.due_date = dueInput.value;
      if (hasLimit && minutes !== t.time_limit) {
        t.time_limit = minutes;
        t.deadline = Date.now() + minutes * 60000; // restart timer
        t.alerted = false;
      } else if (!hasLimit) {
        t.time_limit = null;
        t.deadline = null;
      }
    }
  } else {
    const newId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    tasks.push({
      id: newId,
      title,
      priority: priorityInput.value,
      due_date: dueInput.value,
      completed: false,
      time_limit: hasLimit ? minutes : null,
      deadline: hasLimit ? Date.now() + minutes * 60000 : null,
      alerted: false
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
  limitInput.value = t.time_limit || "";
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

/* ---------- settings ---------- */
topicInput.value = getTopic();

document.getElementById("save-topic").addEventListener("click", () => {
  const v = topicInput.value.trim();
  if (!v) return;
  localStorage.setItem(TOPIC_KEY, v);
  showToast("Topic saved ✅");
});

document.getElementById("test-alert").addEventListener("click", () => {
  sendAlert("Test Alert", "Your phone alert is working!");
});

render();
