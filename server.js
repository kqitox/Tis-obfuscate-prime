const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "scripts.json");
const MAX_BYTES = 1_500_000;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, "[]", "utf8");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(PUBLIC_DIR));

function readDB() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeDB(items) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}
function makeId() {
  return crypto.randomBytes(6).toString("hex");
}
function validateLua(value) {
  if (typeof value !== "string") return "Code Lua phải là chuỗi văn bản.";
  if (!value.trim()) return "Code Lua đang trống.";
  if (Buffer.byteLength(value, "utf8") > MAX_BYTES) return "Code quá lớn (giới hạn 1.5 MB).";
  return null;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Lua Encoder VIP" }));

app.post("/api/scripts", (req, res) => {
  const { name, code } = req.body || {};
  const error = validateLua(code);
  if (error) return res.status(400).json({ error });

  const safeName = String(name || "script.lua").replace(/[\\/\0]/g, "_").slice(0, 100);
  const item = {
    id: makeId(),
    name: safeName,
    code,
    bytes: Buffer.byteLength(code, "utf8"),
    createdAt: new Date().toISOString()
  };
  const db = readDB();
  db.unshift(item);
  writeDB(db);
  const base = `${req.protocol}://${req.get("host")}`;
  res.status(201).json({
    id: item.id,
    name: item.name,
    rawUrl: `${base}/raw/${item.id}`,
    loadstring: `loadstring(game:HttpGet("${base}/raw/${item.id}"))()`,
    createdAt: item.createdAt
  });
});

app.get("/raw/:id", (req, res) => {
  const item = readDB().find(x => x.id === req.params.id);
  if (!item) return res.status(404).type("text/plain").send("-- Script not found");
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("X-Content-Type-Options", "nosniff");
  res.send(item.code);
});

app.get("/api/scripts", (_req, res) => {
  const list = readDB().slice(0, 100).map(({ id, name, bytes, createdAt }) => ({
    id, name, bytes, createdAt
  }));
  res.json(list);
});

app.delete("/api/scripts/:id", (req, res) => {
  const db = readDB();
  const next = db.filter(x => x.id !== req.params.id);
  if (next.length === db.length) return res.status(404).json({ error: "Không tìm thấy script." });
  writeDB(next);
  res.json({ ok: true });
});

app.get("*", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

app.listen(PORT, () => {
  console.log(`Lua Encoder VIP running at http://localhost:${PORT}`);
});
