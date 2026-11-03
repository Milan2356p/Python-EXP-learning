const STORAGE_KEY = "tasks";
const TOPIC_KEY = "ntfyTopic";
const DEFAULT_TOPIC = "todo-milan-7k3q9x"; // same as NTFY_TOPIC in the Python file
const DEFAULT_REMIND = 30; // minutes before task time

let tasks = loadTasks();
let filter = "all";

const form = document.getElementById("task-form");
const idInput = document.getElementById("task-id");
const titleInput = document.getElementById("title");
const priorityInput = document.getElementById("priority");
const dueInput = document.getElementById("due-date");
const timeInput = document.getElementById("due-time");
const remindInput = document.getElementById("remind-before");
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

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/*
  Calculates task_at and alert_at from due_date + due_time.
  Example: task at 12:00, remind_before 30 -> alert_at = 11:30.
  Returns false if the task time is already in the past.
*/
function schedule(t) {
  if (!t.due_time) {
    t.task_at = null;
    t.alert_at = null;
    return true;
  }
  const date = t.due_date || todayStr();
  const at = new Date(`${date}T${t.due_time}`).getTime();
  if (isNaN(at) || at <= Date.now()) return false;

  t.due_date = date;
  t.task_at = at;
  t.alert_at = at - t.remind_before * 60000;
  t.alerted = false;
  return true;
}

function timerText(t) {
  if (t.completed) return { text: "Done", over: false };
  if (!t.task_at) return { text: "No task time set", over: false };

  const remaining = Math.floor((t.task_at - Date.now()) / 1000);
  if (remaining <= 0) return { text: "TIME PASSED", over: true };

  const h = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");
  const rem = t.alerted ? "reminder sent" : `reminder ${t.remind_before} min before`;
  return { text: `${h}:${m}:${s} left (${rem})`, over: false };
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
  alarmText.textContent = `${task.title} (due at ${task.due_time})`;
  alarmBox.hidden = false;
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  clearInterval(alarmInterval);
  beep();
  alarmInterval = setInterval(beep, 600);

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Task reminder", { body: `${task.title} at ${task.due_time}` });
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

    const due = formatDate(t.due_date) + (t.due_time ? " " + t.due_time : "");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `ID: ${t.id} | Priority: ${t.priority} | Due: ${due} | ${t.completed ? "Completed" : "Pending"}`;

    const timer = document.createElement("div");
    timer.className = "meta";
    timer.append("⏳ Time left: ");
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

function checkReminders() {
  let changed = false;
  tasks.forEach(t => {
    if (t.alert_at && !t.completed && !t.alerted && Date.now() >= t.alert_at) {
      t.alerted = true;
      changed = true;
      const mins = Math.max(0, Math.round((t.task_at - Date.now()) / 60000));
      startAlarm(t);
      sendAlert(
        "Task Reminder",
        `${t.title} is due at ${t.due_time} (in about ${mins} min). Priority: ${t.priority}. Do it now!`
      );
    }
  });
  if (changed) saveTasks();
}

setInterval(() => {
  checkReminders();
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

  let remind = parseFloat(remindInput.value);
  if (isNaN(remind) || remind <= 0) remind = DEFAULT_REMIND;

  const values = {
    title,
    priority: priorityInput.value,
    due_date: dueInput.value,
    due_time: timeInput.value,
    remind_before: remind
  };

  if (values.due_time && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  if (idInput.value) {
    const t = tasks.find(x => x.id === Number(idInput.value));
    if (t) {
      const sameSchedule =
        t.due_date === values.due_date &&
        (t.due_time || "") === values.due_time &&
        t.remind_before === values.remind_before;

      if (sameSchedule) {
        t.title = values.title;
        t.priority = values.priority;
      } else {
        const tmp = { ...t, ...values };
        if (!schedule(tmp)) {
          showToast("Task time has already passed ❌");
          return;
        }
        if (tmp.alert_at === t.alert_at) tmp.alerted = t.alerted;
        Object.assign(t, tmp);
      }
    }
  } else {
    const newId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
    const t = {
      id: newId,
      ...values,
      task_at: null,
      alert_at: null,
      alerted: false,
      completed: false
    };
    if (!schedule(t)) {
      showToast("Task time has already passed ❌");
      return;
    }
    tasks.push(t);
  }
  saveTasks();
  resetForm();
  render();
});

cancelBtn.addEventListener("click", resetForm);

function resetForm() {
  form.reset();
  idInput.value = "";
  remindInput.value = DEFAULT_REMIND;
  submitBtn.textContent = "Add Task";
  cancelBtn.hidden = true;
}

function startEdit(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  idInput.value = t.id;
  titleInput.value = t.title;
  priorityInput.value = t.priority;
  dueInput.value = t.due_date || "";
  timeInput.value = t.due_time || "";
  remindInput.value = t.remind_before || DEFAULT_REMIND;
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
