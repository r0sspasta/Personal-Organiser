# Push Worker setup (background reminders)

This is the one piece of the app that isn't "just open the file" — it's a
tiny server that stays awake so it can nudge your phone even when the app
is closed. It runs on Cloudflare's free tier. About 5 minutes, all done in
the browser (no command line needed).

**What you get:** a real notification when something becomes due, even if
Organiser isn't open. **What you don't get (yet):** the notification text
is generic ("Task due — open Organiser") rather than the actual task name —
showing the real text requires encrypting the push payload, which is a
separate, riskier piece of crypto that wasn't worth bundling into v1. Tap
the notification and the app opens to show you what's actually due.

## 1. Create the Worker

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Workers** → **Create Worker** (a free Cloudflare account is enough).
2. Give it a name, e.g. `organiser-push`. Click **Deploy** to create it with the placeholder code — you'll replace that next.
3. Click **Edit code** (opens the online editor). Delete everything and paste in the full contents of [`worker.js`](worker.js) from this folder. Click **Deploy**.

## 2. Add KV storage (where subscriptions and tasks live)

1. In the Worker's page, go to **Settings → Bindings → Add → KV Namespace**.
2. Create a new namespace (any name, e.g. `organiser-push-kv`).
3. Set the **Variable name** (binding) to exactly `PUSH_KV` — the code refers to it by this name. Save.

## 3. Add the VAPID keys (these authenticate your Worker to push services)

A keypair was generated for you when this app was built. In **Settings → Variables**:

1. Add a plain-text variable `VAPID_PUBLIC_KEY` = `BM-9SdWcnzlv-WkodxW52gJuzlqQGhe7mv5h32M36buC1OV_cdzPBmRZX7RU90xQm_kubP7PMBa2GRThDKdKP_M`
   (this must match the constant already baked into `index.html` — don't change one without the other).
2. Add a plain-text variable `VAPID_SUBJECT` = `mailto:you@example.com` (any contact — push services sometimes use this to reach you if something's wrong; it's never shown to users).
3. Add an **encrypted** variable (secret) `VAPID_PRIVATE_JWK` — paste the private key JSON Claude gave you in chat when this was set up. **Never commit this value to the repo or share it** — it's the key that proves push messages came from you. If you don't have it anymore, you'll need a fresh keypair generated (ask Claude), and the public half in `index.html` and `wrangler.toml` needs to change to match.

## 4. Add the Cron Trigger (what makes it check periodically)

**Settings → Triggers → Cron Triggers → Add Cron Trigger**. Use `*/10 * * * *` (every 10 minutes — frequent enough to feel timely, well within the free tier).

## 5. Point the app at it

Copy the Worker's URL (shown at the top of its dashboard page, looks like
`https://organiser-push.<your-subdomain>.workers.dev`). In the app: **⚙️
Settings → Background reminders (push)**, paste it into **Push Worker
URL**, then flip the switch on. Your browser will ask for notification
permission — allow it.

## Testing it

Add a task with a due time a couple of minutes in the future, then close
the app entirely (or at least the tab) and wait. You should get a
notification within one Cron Trigger cycle (up to ~10 minutes) after it
becomes due.

If nothing arrives: check **Workers & Pages → organiser-push → Logs** for
errors, and double check the KV binding name is exactly `PUSH_KV` and the
three variables above are all set correctly.

## Advanced: deploying with Wrangler instead

If you'd rather use the CLI, `wrangler.toml` is included. Fill in your KV
namespace id, then:

```
npm install -g wrangler
wrangler kv namespace create organiser-push-kv   # copy the id into wrangler.toml
wrangler secret put VAPID_PRIVATE_JWK             # paste the private key when prompted
wrangler deploy
```

## Privacy note

The Worker only ever sees: your device's push subscription (an opaque
endpoint URL + keys, meaningless without your VAPID private key), and the
minimal fields needed to know what's due (task text, category, due date —
completed tasks and subtasks aren't sent). It's your own Cloudflare
account; nothing is shared with anyone else.
