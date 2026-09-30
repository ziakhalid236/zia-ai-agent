# Zia AI Agent

An OpenAI-compatible AI service on Cloudflare Workers, with a small control room, an approval-based Termux client, and an optional WhatsApp Agent bridge.

- The model is hosted by Cloudflare Workers AI; this repository does not contain model weights.
- The Worker suggests shell commands but never executes them. The Termux client asks before every command.
- No conversation history is stored by the Worker. Termux keeps chat only in memory while running.
- The browser chat supports speech input and spoken replies where the browser supports them. Browser speech providers may process microphone audio.
- The optional WhatsApp Agent integration is not end-to-end encrypted. Do not send secrets or sensitive data through it.

Urdu instructions: [`README-ur.md`](README-ur.md).

## Components

- `worker-zia.js`: canonical Cloudflare Worker, control room, API, API-key manager, and scheduled WhatsApp bridge.
- `termux_agent.py`: Python client for Android Termux. It saves the service URL but prompts for the API key each time.
- `zia_whatsapp_agent.py`: optional local WhatsApp poller. Use it only when the Cloudflare Cron poller is disabled.
- `wrangler.example.jsonc`: safe starting point for another Cloudflare account. Copy it to `wrangler.jsonc` and replace the KV namespace ID before deploying.

Old prototypes (`worker.js`, `worker-cyber.js`, and `demo.html`) are not part of the supported deployment.

## Required accounts

- **Cloudflare:** owns the Worker, Workers AI binding, KV namespace, and secrets. The current live deployment already uses a Cloudflare account; do not create a duplicate account for it.
- **GitHub:** owns the public source repository. Publish this project under an account you control.
- **WhatsApp:** only required if you choose the optional personal WhatsApp Agent bridge. The Agent API key is separate from the Zia API key.
- **DuckDuckGo:** public web search endpoint; no account or key is required.
- **Termux:** Android client; it is not an AI model or hosting provider.

## Quick start: Termux

Install a current Termux build from its official distribution source. The commands below download only the Python client into Termux's private home directory; storage permission is not required.

```sh
pkg update -y
pkg install -y python curl
mkdir -p ~/zia-ai-agent
cd ~/zia-ai-agent
curl -fL "https://raw.githubusercontent.com/ziakhalid236/zia-ai-agent/main/termux_agent.py" -o termux_agent.py
python termux_agent.py
```

On first run, enter the deployed Worker URL and a project API key. Create the key in the control room under **API → Generate Key**. The key is shown once; copy it directly into Termux and never put it in GitHub, a screenshot, or chat. When the script prints `Connected`, it has verified the key against `/api/health`. The API key is not saved; the URL is.

If using a file from Android Downloads instead, run `termux-setup-storage` by itself, answer `y` to its prompt, and allow Android storage access. Do not paste the next commands until that prompt has finished. The GitHub download above avoids this extra step.

Termux commands: `/help`, `/search words`, `/clear`, `/speak`, `/exit`. `/speak` provides text-to-speech only when the Termux:API app and package are installed. Voice input is available in the browser control room, not this terminal client.

### Termux troubleshooting

- `No such file or directory`: download from the GitHub URL above first, or check the filename with `ls ~/zia-ai-agent`.
- `HTTP 401`: the API key is missing, mistyped, revoked, or is the website passphrase instead of a project API key. Create a new key in the control room.
- `HTTP 403`: check whether web search is enabled if using `/search`; project keys cannot access control-room settings.
- `Could not reach the Worker`: check the exact HTTPS Worker URL and the phone's internet connection.
- `No mirror selected`: run `termux-change-repo`, select a reachable mirror, then retry `pkg update -y`.

## Deploy your own Worker

Requirements: a Cloudflare account with Workers AI available, Node.js/npm, and a terminal with network access. Keep `wrangler.jsonc` private; it contains your own resource identifiers.

1. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the namespace ID created in your Cloudflare account. Change the Worker `name` if desired.
2. Install Wrangler and authenticate:

```sh
npm install --save-dev wrangler
npx wrangler login
npx wrangler kv namespace create CONFIG
```

3. Copy the KV namespace ID from Wrangler's output into `wrangler.jsonc`. The config already declares the Workers AI binding named `AI` and optional one-minute Cron trigger.
4. Set private secrets. Use a password manager to generate a unique, high-entropy `API_TOKEN` of at least 40 characters. Never commit secrets or paste them into public issues.

```sh
npx wrangler secret put SITE_PASSWORD
npx wrangler secret put API_TOKEN
```

5. Deploy:

```sh
npx wrangler deploy --config wrangler.jsonc
```

6. Open the Worker URL, sign in using `SITE_PASSWORD`, then create a separate named project key in **API** for Termux or server clients. The API key manager stores hashes and only shows a new key once.
7. For WhatsApp replies, create a personal Agent in WhatsApp, set `WHATSAPP_AGENT_API_KEY` as a Worker secret, and enable the Cron trigger. The repository's config requests `*/1 * * * *`. Do not run the local WhatsApp bridge at the same time; concurrent pollers can replace each other's cursor.

The existing live service is managed by its current Cloudflare account. Deploying a new Worker requires your own account's binding IDs and secrets; source code alone cannot transfer account ownership or credentials.

## API

The service exposes a non-streaming OpenAI-compatible endpoint:

```text
POST /v1/chat/completions
Authorization: Bearer <project API key>
Content-Type: application/json
```

```json
{"model":"managed-by-control-room","messages":[{"role":"user","content":"Hello"}]}
```

Health check: `GET /api/health`. Search: `GET /api/search?q=...` when enabled in the control room. Project keys are limited to chat, search, and health; they cannot change settings or create/revoke keys. Streaming is not enabled.

## Tests and contributor notes

```sh
node --check worker-zia.js
python -m py_compile termux_agent.py zia_whatsapp_agent.py
```

See [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`SECURITY.md`](SECURITY.md). Open an issue without including API keys, passphrases, WhatsApp message contents, or private user data.

## License

MIT. See [`LICENSE`](LICENSE).
