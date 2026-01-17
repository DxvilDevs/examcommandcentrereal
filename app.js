/* =============== Storage helpers =============== */
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

/* =============== State =============== */
const state = {
  tasks: store.get("ecc_tasks_v1", []),
  notes: store.get("ecc_notes_v1", ""),
  exam: store.get("ecc_exam_v1", { label: "", date: "" }),
  focus: store.get("ecc_focus_v1", false),

  // simple demo data (replace with your real subject model)
  subjects: store.get("ecc_subjects_v1", [
    { name: "Maths", progress: 55 },
    { name: "Science", progress: 42 },
    { name: "English", progress: 68 }
  ])
};

/* =============== DOM =============== */
const el = (id) => document.getElementById(id);

const taskList = el("taskList");
const taskInput = el("taskInput");
const btnAddTask = el("btnAddTask");
const btnSaveTask = el("btnSaveTask");

const notes = el("notes");
const btnSaveNotes = el("btnSaveNotes");

const examLabel = el("examLabel");
const examDate = el("examDate");
const btnSaveExam = el("btnSaveExam");

const btnReset = el("btnReset");
const btnFocus = el("btnFocus");

const kpiToday = el("kpiToday");
const kpiStreak = el("kpiStreak");
const kpiDone = el("kpiDone");
const kpiTotal = el("kpiTotal");
const kpiNext = el("kpiNext");
const todayStamp = el("todayStamp");

const uspGrid = el("uspGrid");

/* =============== Init stamp =============== */
(function setStamp(){
  const d = new Date();
  todayStamp.textContent = d.toLocaleString(undefined, {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit"
  });
})();

/* =============== Tasks =============== */
function renderTasks() {
  taskList.innerHTML = "";
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;

  kpiTotal.textContent = String(total);
  kpiDone.textContent = String(done);

  if (!total) {
    const empty = document.createElement("li");
    empty.className = "text-sm text-slate-400";
    empty.textContent = "No tasks yet. Add one and keep it small.";
    taskList.appendChild(empty);
    return;
  }

  for (const t of state.tasks) {
    const li = document.createElement("li");
    li.className = "task-row";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!t.done;
    cb.addEventListener("change", () => {
      t.done = cb.checked;
      persist();
      renderTasks();
      updateKpis();
    });

    const title = document.createElement("div");
    title.className = "task-title text-sm flex-1 " + (t.done ? "done" : "");
    title.textContent = t.title;

    const del = document.createElement("button");
    del.className = "btn rounded-xl px-2 py-1 text-xs";
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      state.tasks = state.tasks.filter(x => x.id !== t.id);
      persist();
      renderTasks();
      updateKpis();
    });

    li.appendChild(cb);
    li.appendChild(title);
    li.appendChild(del);
    taskList.appendChild(li);
  }
}

function addTask(title) {
  const trimmed = (title || "").trim();
  if (!trimmed) return;

  state.tasks.unshift({ id: crypto.randomUUID(), title: trimmed, done: false });
  persist();
  renderTasks();
  updateKpis();
}

/* =============== Notes =============== */
function loadNotes() {
  notes.value = state.notes || "";
}
function saveNotes() {
  state.notes = notes.value || "";
  persist();
}

/* =============== Exam =============== */
function loadExam() {
  examLabel.value = state.exam.label || "";
  examDate.value = state.exam.date || "";
  updateExamKpi();
}
function saveExam() {
  state.exam = { label: examLabel.value.trim(), date: examDate.value };
  persist();
  updateExamKpi();
}
function updateExamKpi() {
  if (!state.exam.date) {
    kpiNext.textContent = "—";
    return;
  }
  const now = new Date();
  const target = new Date(state.exam.date + "T00:00:00");
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  const label = state.exam.label ? state.exam.label : "Next exam";

  if (diff >= 0) kpiNext.textContent = `${diff}d`;
  else kpiNext.textContent = "Passed";

  // Tooltip-like hint in schedule card
  const hint = document.getElementById("examHint");
  if (hint) hint.textContent = `${label} • ${target.toLocaleDateString()}`;
}

/* =============== KPIs (simple demo) =============== */
function updateKpis() {
  // For MVP: compute "today time" from completed tasks count (fake)
  const done = state.tasks.filter(t => t.done).length;
  const minutes = Math.min(240, done * 25); // 25m per completed task (demo)
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  kpiToday.textContent = `${h}h ${String(m).padStart(2, "0")}m`;

  // Demo streak (based on whether notes exist)
  kpiStreak.textContent = state.notes.trim().length ? "1" : "0";
}

/* =============== Focus mode =============== */
function setFocus(on) {
  state.focus = !!on;
  store.set("ecc_focus_v1", state.focus);
  document.body.classList.toggle("focus", state.focus);

  btnFocus.textContent = state.focus ? "Exit Focus" : "Focus Mode";

  // In focus mode: reduce clutter slightly
  const footer = document.querySelector("footer");
  if (footer) footer.style.display = state.focus ? "none" : "";
}

/* =============== USP Cards =============== */
/* Paste your USP items here (from the other conversation) */
function renderUSP() {
  const uspItems = store.get("ecc_usp_v1", [
    { title: "Clarity under pressure", body: "Everything you need, nothing you don’t." },
    { title: "Action > motivation", body: "Small tasks, fast feedback loops." },
    { title: "Review that sticks", body: "Mistake → cause → fix, every time." }
  ]);

  uspGrid.innerHTML = "";
  for (const u of uspItems) {
    const card = document.createElement("div");
    card.className = "rounded-3xl ring-soft p-4 bg-white/5";
    card.innerHTML = `
      <p class="text-sm font-semibold">${escapeHtml(u.title)}</p>
      <p class="text-xs text-slate-300 mt-1">${escapeHtml(u.body)}</p>
    `;
    uspGrid.appendChild(card);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* =============== Charts =============== */
let chartProgress, chartBreakdown, chartTrend;

function initCharts() {
  const labels = state.subjects.map(s => s.name);
  const values = state.subjects.map(s => s.progress);

  chartProgress = new Chart(document.getElementById("chartProgress"), {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Progress %", data: values }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  chartBreakdown = new Chart(document.getElementById("chartBreakdown"), {
    type: "doughnut",
    data: {
      labels: ["Practice", "Review", "Notes"],
      datasets: [{ data: [55, 30, 15] }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

  chartTrend = new Chart(document.getElementById("chartTrend"), {
    type: "line",
    data: {
      labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
      datasets: [{ label: "Focus score", data: [40, 55, 48, 62, 58, 70, 66], tension: 0.35 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

/* =============== Persist =============== */
function persist() {
  store.set("ecc_tasks_v1", state.tasks);
  store.set("ecc_notes_v1", state.notes);
  store.set("ecc_exam_v1", state.exam);
  store.set("ecc_subjects_v1", state.subjects);
}

/* =============== Events =============== */
btnAddTask.addEventListener("click", () => taskInput.focus());
btnSaveTask.addEventListener("click", () => addTask(taskInput.value));
taskInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addTask(taskInput.value);
});

btnSaveNotes.addEventListener("click", saveNotes);

btnSaveExam.addEventListener("click", saveExam);

btnFocus.addEventListener("click", () => setFocus(!state.focus));

btnReset.addEventListener("click", () => {
  localStorage.removeItem("ecc_tasks_v1");
  localStorage.removeItem("ecc_notes_v1");
  localStorage.removeItem("ecc_exam_v1");
  localStorage.removeItem("ecc_subjects_v1");
  localStorage.removeItem("ecc_usp_v1");
  location.reload();
});

/* =============== Boot =============== */
renderTasks();
loadNotes();
loadExam();
updateKpis();
renderUSP();
initCharts();
setFocus(state.focus);
