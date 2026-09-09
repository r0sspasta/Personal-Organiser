/**
 * Personal Organiser — background push reminders.
 *
 * This Worker is the piece that makes reminders fire even when the app
 * (and its browser tab) is completely closed. The app itself can't do
 * that on its own — a static page has no way to wake your phone; only a
 * server that's awake all the time (via a Cron Trigger) can.
 *
 * What it does, every few minutes (on its Cron Trigger):
 *   1. Looks at every device that has enabled background reminders.
 *   2. Reads that device's last-synced task list (pushed here by the app
 *      whenever tasks change — see /sync below).
 *   3. Finds tasks that are now due and haven't been notified about yet.
 *   4. Sends a Web Push message to that device.
 *
 * Deliberate simplification — read this before you deploy:
 * The push message is sent EMPTY (no title/body of the actual task).
 * Putting the real task text in a push message requires encrypting the
 * payload per RFC 8291, which is a meaningful amount of extra crypto that
 * is easy to get subtly wrong and hard for anyone to test without a live
 * deployment. So v1 ships the reliable version: you get a real
 * "Task due — open Organiser" notification, tap it, and the app opens
 * to show you what's actually due. If you want the real task text in the
 * notification later, that's a well-scoped follow-up.
 *
 * Storage: Workers KV (free tier is plenty for personal use). Keys:
 *   sub:<deviceId>      -> JSON push subscription
 *   tasks:<deviceId>    -> JSON array of {id, text, category, dueAt}
 *   notified:<deviceId> -> JSON array of task ids already notified
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({ ok: true, message: "Personal Organiser push endpoint is live." });
    }

    if (request.method === "POST" && url.pathname === "/subscribe") {
      const body = await request.json().catch(() => null);
      if (!body || !body.deviceId || !body.subscription) return json({ ok: false, error: "bad request" }, 400);
      await env.PUSH_KV.put("sub:" + body.deviceId, JSON.stringify(body.subscription));
      return withCors(json({ ok: true }));
    }

    if (request.method === "POST" && url.pathname === "/unsubscribe") {
      const body = await request.json().catch(() => null);
      if (!body || !body.deviceId) return json({ ok: false, error: "bad request" }, 400);
      await Promise.all([
        env.PUSH_KV.delete("sub:" + body.deviceId),
        env.PUSH_KV.delete("tasks:" + body.deviceId),
        env.PUSH_KV.delete("notified:" + body.deviceId),
      ]);
      return withCors(json({ ok: true }));
    }

    if (request.method === "POST" && url.pathname === "/sync") {
      const body = await request.json().catch(() => null);
      if (!body || !body.deviceId || !Array.isArray(body.tasks)) return json({ ok: false, error: "bad request" }, 400);
      await env.PUSH_KV.put("tasks:" + body.deviceId, JSON.stringify(body.tasks));
      return withCors(json({ ok: true, count: body.tasks.length }));
    }

    return json({ ok: false, error: "not found" }, 404);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAllDevices(env));
  },
};

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

async function checkAllDevices(env) {
  const list = await env.PUSH_KV.list({ prefix: "sub:" });
  const now = Date.now();

  for (const key of list.keys) {
    const deviceId = key.name.slice("sub:".length);
    try {
      await checkDevice(env, deviceId, now);
    } catch (err) {
      console.log("device check failed", deviceId, String(err));
    }
  }
}

async function checkDevice(env, deviceId, now) {
  const [subRaw, tasksRaw, notifiedRaw] = await Promise.all([
    env.PUSH_KV.get("sub:" + deviceId),
    env.PUSH_KV.get("tasks:" + deviceId),
    env.PUSH_KV.get("notified:" + deviceId),
  ]);
  if (!subRaw) return;
  const subscription = JSON.parse(subRaw);
  const tasks = tasksRaw ? JSON.parse(tasksRaw) : [];
  let notified = notifiedRaw ? JSON.parse(notifiedRaw) : [];

  const currentIds = new Set(tasks.map((t) => t.id));
  notified = notified.filter((id) => currentIds.has(id)); // prune ids for tasks that no longer exist/are due

  const due = tasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() <= now && !notified.includes(t.id));
  if (!due.length) {
    await env.PUSH_KV.put("notified:" + deviceId, JSON.stringify(notified));
    return;
  }

  try {
    await sendWebPush(subscription, env);
    due.forEach((t) => notified.push(t.id));
    await env.PUSH_KV.put("notified:" + deviceId, JSON.stringify(notified));
  } catch (err) {
    const msg = String(err);
    // 404/410 means the subscription is dead (uninstalled, permission revoked, etc.) — clean it up.
    if (msg.includes("404") || msg.includes("410")) {
      await Promise.all([
        env.PUSH_KV.delete("sub:" + deviceId),
        env.PUSH_KV.delete("tasks:" + deviceId),
        env.PUSH_KV.delete("notified:" + deviceId),
      ]);
    } else {
      throw err;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Web Push — VAPID-authenticated, empty payload (see note at top)     */
/* ------------------------------------------------------------------ */

function b64urlToBuf(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}
function bufToB64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidPrivateKey(env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function buildVapidAuthHeader(subscription, env) {
  const aud = new URL(subscription.endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: env.VAPID_SUBJECT || "mailto:organiser@example.com",
  };
  const signingInput = bufToB64url(new TextEncoder().encode(JSON.stringify(header))) + "." +
                        bufToB64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await importVapidPrivateKey(env);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  const jwt = signingInput + "." + bufToB64url(sig);
  return `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`;
}

async function sendWebPush(subscription, env) {
  const auth = await buildVapidAuthHeader(subscription, env);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: auth,
      TTL: "60",
      "Content-Length": "0",
    },
  });
  if (!res.ok) {
    throw new Error(`push send failed: ${res.status}`);
  }
}
