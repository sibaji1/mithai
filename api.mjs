import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "node:crypto";

const SW = [["Kaju Katli",1200],["Motichoor Ladoo",400],["Besan Ladoo",400],["Soan Papdi",400],["Gulab Jamun",400],["Rasgulla",400]];
const NEXT = { new:["confirmed","rejected"], confirmed:["packing"], packing:["picked"] };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status:s, headers:{ "content-type":"application/json", "cache-control":"no-store" } });
const grams = g => g >= 1000 ? g/1000 + " kg" : g + " g";
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const sign = p => createHmac("sha256", process.env.TOKEN_SECRET || "").update(p).digest("base64url");
const mkToken = () => { const e = Date.now() + 12*36e5; return e + "." + sign(String(e)); };
const valid = t => { if (!process.env.TOKEN_SECRET || typeof t !== "string") return false; const [e, s] = t.split("."); return !!s && Number(e) > Date.now() && eq(sign(e), s); };
const bad = m => J({ error: m }, 400);

async function create(b, store) {
  const name = String(b.name || "").trim().slice(0, 80), note = String(b.note || "").trim().slice(0, 300);
  const phone = String(b.phone || "").replace(/\D/g, ""), date = String(b.date || ""), time = String(b.time || "").slice(0, 30);
  if (!name || !/^\d{10}$/.test(phone) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Please check your name, phone number and pickup date.");
  const items = []; let total = 0;
  for (const [k, g] of Object.entries(b.cart || {})) {
    const i = +k, q = +g;
    if (!SW[i] || !(q > 0) || q > 20000 || q % 250) return bad("Invalid item in your order.");
    const a = Math.round(SW[i][1] * q / 1000); items.push({ t: SW[i][0] + " · " + grams(q), a }); total += a;
  }
  for (const x of (Array.isArray(b.boxes) ? b.boxes : []).slice(0, 20)) {
    const size = +x.size, qty = +x.qty, it = x.items;
    if (![0.5, 1].includes(size) || !Number.isInteger(qty) || qty < 1 || qty > 20 || !Array.isArray(it) || it.length !== 4 || it.some(i => !SW[i])) return bad("Invalid gift box in your order.");
    const a = Math.round(it.reduce((s, i) => s + SW[i][1] * size / 4, 0) * qty);
    items.push({ t: `${qty} × ${size === 1 ? "Grand 1 kg" : "Classic 500 g"} box (${it.map(i => SW[i][0]).join(", ")})`, a }); total += a;
  }
  if (!items.length) return bad("Your order is empty.");
  const d = new Date(Date.now() + 19800000), c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ref = "";
  for (let n = 0; n < 8; n++) {
    let s = ""; for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)];
    const r = "MS-" + String(d.getUTCDate()).padStart(2, "0") + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + s;
    if (!(await store.get(r))) { ref = r; break; }
  }
  if (!ref) return J({ error: "Could not create order. Please try again." }, 500);
  await store.setJSON(ref, { ref, name, phone, date, time, note, items, total, status: "new", at: Date.now() });
  return J({ ref, total });
}

export default async (req) => {
  const store = getStore("orders");
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (path === "/api/orders" && req.method === "POST") {
      const b = await req.json().catch(() => null);
      return b ? create(b, store) : bad("Invalid request.");
    }
    if (path === "/api/login" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (!process.env.OWNER_USER || !process.env.OWNER_PASS || !process.env.TOKEN_SECRET) return J({ error: "Login is not configured on the server." }, 500);
      if (eq(String(b.user || "").trim().toLowerCase(), process.env.OWNER_USER.toLowerCase()) && eq(b.pass || "", process.env.OWNER_PASS)) return J({ token: mkToken() });
      await new Promise(r => setTimeout(r, 700));
      return J({ error: "Wrong username or password." }, 401);
    }
    if (!valid((req.headers.get("authorization") || "").replace(/^Bearer /, ""))) return J({ error: "Unauthorized" }, 401);
    if (path === "/api/orders" && req.method === "GET") {
      const { blobs } = await store.list();
      const all = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
      return J(all.sort((a, b) => b.at - a.at).slice(0, 500));
    }
    if (path === "/api/orders/status" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      const o = await store.get(String(b.ref || ""), { type: "json" });
      if (!o) return J({ error: "Order not found." }, 404);
      if (!(NEXT[o.status] || []).includes(b.status)) return bad("That status change is not allowed.");
      o.status = b.status; await store.setJSON(o.ref, o);
      return J(o);
    }
    return J({ error: "Not found" }, 404);
  } catch (e) { return J({ error: "Server error" }, 500); }
};

export const config = { path: "/api/*" };
