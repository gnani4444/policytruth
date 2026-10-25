import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const RETRY_MS = 60_000;
const KEEP = 200;
// Vercel functions can only write to /tmp; locally the file sits in the project.
const FILE = process.env.PT_DATA_FILE || (process.env.VERCEL ? "/tmp/policytruth-audits.json" : path.join(process.cwd(), ".data", "audits.json"));
// Read-only snapshot shipped with the app, so history and the same-day cache survive a cold start without Atlas.
const SEED = path.join(process.cwd(), "data", "audits.seed.json");

// Cached across hot reloads and warm serverless invocations. A failed connect is skipped for a minute, then retried.
async function mongo() {
  if (!process.env.MONGODB_URI) return null;
  const g = globalThis;
  if (g._ptMongoDownUntil > Date.now()) return null;
  if (!g._ptMongo) {
    g._ptMongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect()
      .catch((e) => { g._ptMongo = null; g._ptMongoDownUntil = Date.now() + RETRY_MS; console.error("MongoDB connect failed, using JSON storage:", e.message); return null; });
  }
  const client = await g._ptMongo;
  return client ? client.db("policytruth").collection("audits") : null;
}

const revive = (a) => ({ ...a, createdAt: new Date(a.createdAt), ...(a.approvedAt && { approvedAt: new Date(a.approvedAt) }) });
const readJson = (f) => { try { return JSON.parse(readFileSync(f, "utf8")).map(revive); } catch { return []; } };

function jsonRows() {
  if (!globalThis._ptJson) {
    const own = readJson(FILE), ids = new Set(own.map((a) => String(a.auditId)));
    globalThis._ptJson = [...own, ...readJson(SEED).filter((a) => !ids.has(String(a.auditId)))].sort((a, b) => b.createdAt - a.createdAt);
  }
  return globalThis._ptJson;
}

function saveJson() {
  const rows = jsonRows().filter((a) => !a.seed).slice(0, KEEP);
  try { mkdirSync(path.dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(rows)); }
  catch (e) { console.error("JSON storage write failed, keeping audits in memory:", e.message); }
}

const sameMode = (a, mode) => (mode === "agent" ? a.mode === "agent" : a.mode !== "agent");

const json = {
  kind: "json",
  today: async (host, mode, since) => jsonRows().find((a) => a.host === host && sameMode(a, mode) && a.createdAt >= since) || null,
  previous: async (host) => jsonRows().find((a) => a.host === host) || null,
  insert: async (doc) => { const auditId = randomUUID(); jsonRows().unshift({ ...doc, auditId }); saveJson(); return auditId; },
  approve: async (id, set) => { const a = jsonRows().find((x) => String(x.auditId) === String(id)); if (a) { Object.assign(a, set); saveJson(); } },
  recent: async (n) => jsonRows().slice(0, n),
};

/* One storage interface: MongoDB Atlas when reachable, otherwise the JSON file (plus seed) with an in-memory cache.
   Any Atlas call that fails falls back to the same JSON call, and Atlas is skipped for a minute. */
export async function store() {
  const col = await mongo();
  if (!col) return json;
  const run = (name, fn) => (...args) => fn(...args).catch((e) => {
    console.error(`MongoDB ${name} failed, using JSON storage:`, e.message);
    globalThis._ptMongo = null; globalThis._ptMongoDownUntil = Date.now() + RETRY_MS;
    return json[name](...args);
  });
  return {
    kind: "mongodb",
    today: run("today", (host, mode, since) => col.findOne({ host, mode: mode === "agent" ? "agent" : { $ne: "agent" }, createdAt: { $gte: since } }, { sort: { createdAt: -1 } })),
    previous: run("previous", (host) => col.findOne({ host }, { sort: { createdAt: -1 }, projection: { createdAt: 1, "scan.trackers.vendor": 1, score: 1 } })),
    insert: run("insert", async (doc) => (await col.insertOne({ ...doc })).insertedId),
    approve: run("approve", async (id, set) => { if (ObjectId.isValid(id)) await col.updateOne({ _id: new ObjectId(id) }, { $set: set }); }),
    recent: run("recent", (n) => col.find({}, { projection: { host: 1, url: 1, mode: 1, createdAt: 1, score: 1, grade: 1, findings: 1, approvedAt: 1 } }).sort({ createdAt: -1 }).limit(n).toArray()),
  };
}
