import { MongoClient } from "mongodb";

// Cached across hot reloads and warm serverless invocations. A failed connect is dropped so the next request retries.
export async function audits() {
  if (!process.env.MONGODB_URI) return null;
  if (!globalThis._ptMongo) {
    globalThis._ptMongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect()
      .catch((e) => { globalThis._ptMongo = null; console.error("MongoDB connect failed:", e.message); throw e; });
  }
  return (await globalThis._ptMongo).db("policytruth").collection("audits");
}
