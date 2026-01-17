// server/src/index.js
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { initDb, run, get, all } from "./db.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

// CORS: allow your GitHub Pages site (set CORS_ORIGINS env var on Render), or allow all if unset.
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl / server-to-server / some browsers
      if (ALLOWED_ORIGINS.includes("*")) return cb(null, true);
      return cb(null, ALLOWED_ORIGINS.includes(origin));
    }
  })
);

// Root route so Render doesn't show "Cannot GET /"
app.get("/", (req, res) => {
  res
    .status(200)
    .type("text")
    .send("Exam Command Centre API is running. Try /health, /api/tasks, /api/state");
});

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

/* ===================== TASKS ===================== */
app.get("/api/tasks", async (req, res) => {
  const tasks = await all(
    "SELECT id, title, done, created_at FROM tasks ORDER BY created_at DESC"
  );
  res.json(tasks.map(t => ({ ...t, done: !!t.done })));
});

app.post("/api/tasks", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "title_required" });

  const task = {
    id: crypto.randomUUID(),
    title,
    done: 0,
    created_at: Date.now()
  };

  await run(
    "INSERT INTO tasks (id, title, done, created_at) VALUES (?, ?, ?, ?)",
    [task.id, task.title, task.done, task.created_at]
  );

  res.status(201).json({ ...task, done: false });
});

app.patch("/api/tasks/:id", async (req, res) => {
  const id = req.params.id;
  const done = req.body?.done;

  if (typeof done !== "boolean") {
    return res.status(400).json({ error: "done_boolean_required" });
  }

  const result = await run("UPDATE tasks SET done=? WHERE id=?", [done ? 1 : 0, id]);
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });

  res.json({ ok: true });
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = req.params.id;
  const result = await run("DELETE FROM tasks WHERE id=?", [id]);
  if (result.changes === 0) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true });
});

/* ===================== NOTES + EXAM (KV) ===================== */
app.get("/api/state", async (req, res) => {
  const notes = await get("SELECT value FROM kv WHERE key='notes'");
  const exam = await get("SELECT value FROM kv WHERE key='exam'");

  res.json({
    notes: notes?.value ? JSON.parse(notes.value) : "",
    exam: exam?.value ? JSON.parse(exam.value) : { label: "", date: "" }
  });
});

app.put("/api/notes", async (req, res) => {
  const notes = typeof req.body?.notes === "string" ? req.body.notes : "";

  await run(
    "INSERT INTO kv (key, value) VALUES ('notes', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [JSON.stringify(notes)]
  );

  res.json({ ok: true });
});

app.put("/api/exam", async (req, res) => {
  const label = String(req.body?.label || "");
  const date = String(req.body?.date || "");
  const exam = { label, date };

  await run(
    "INSERT INTO kv (key, value) VALUES ('exam', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [JSON.stringify(exam)]
  );

  res.json({ ok: true });
});

/* ===================== START ===================== */
const PORT = Number(process.env.PORT || 3000);

await initDb();

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  console.log(`CORS_ORIGINS=${process.env.CORS_ORIGINS || "*"}`);
});
