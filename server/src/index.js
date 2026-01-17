import express from "express";
import cors from "cors";
import crypto from "crypto";
import { initDb, run, get, all } from "./db.js";

const app = express();
app.use(express.json());

// Allow GitHub Pages to call this API
app.use(cors({
  origin: "*"
}));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ===== TASKS ===== */
app.get("/api/tasks", async (req, res) => {
  const tasks = await all(
    "SELECT id, title, done FROM tasks ORDER BY created_at DESC"
  );
  res.json(tasks.map(t => ({ ...t, done: !!t.done })));
});

app.post("/api/tasks", async (req, res) => {
  const title = (req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const task = {
    id: crypto.randomUUID(),
    title,
    done: 0,
    created_at: Date.now()
  };

  await run(
    "INSERT INTO tasks VALUES (?, ?, ?, ?)",
    [task.id, task.title, task.done, task.created_at]
  );

  res.status(201).json({ ...task, done: false });
});

app.patch("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const { done } = req.body;

  if (typeof done !== "boolean") {
    return res.status(400).json({ error: "done_boolean_required" });
  }

  await run("UPDATE tasks SET done=? WHERE id=?", [done ? 1 : 0, id]);
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", async (req, res) => {
  await run("DELETE FROM tasks WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

/* ===== NOTES + EXAM ===== */
app.get("/api/state", async (req, res) => {
  const notes = await get("SELECT value FROM kv WHERE key='notes'");
  const exam = await get("SELECT value FROM kv WHERE key='exam'");

  res.json({
    notes: notes ? JSON.parse(notes.value) : "",
    exam: exam ? JSON.parse(exam.value) : { label: "", date: "" }
  });
});

app.put("/api/notes", async (req, res) => {
  const notes = req.body?.notes || "";
  await run(
    "INSERT INTO kv VALUES ('notes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [JSON.stringify(notes)]
  );
  res.json({ ok: true });
});

app.put("/api/exam", async (req, res) => {
  const exam = {
    label: req.body?.label || "",
    date: req.body?.date || ""
  };

  await run(
    "INSERT INTO kv VALUES ('exam', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [JSON.stringify(exam)]
  );
  res.json({ ok: true });
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;

await initDb();
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
