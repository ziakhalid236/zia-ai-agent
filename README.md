# Zoya AI Agent

An OpenAI-compatible AI service on Cloudflare Workers, with a small control room, an approval-based Termux client, and an optional WhatsApp Agent bridge.

- The main assistant profile is named Zoya. WhatsApp defaults to short, warm, lightly romantic adult-companion chat; ordinary conversation does not trigger research. Research remains available when requested.
- Prompt and model settings can reduce unnecessary refusals, but cannot override the hosted model's safeguards or provider terms. Core protections for secrets, authorization, and command approval remain enabled.

- The model is hosted by Cloudflare Workers AI; this repository does not contain model weights.
- The Worker suggests shell commands but never executes them. The Termux client asks before every command.
- Website chat history stays in the browser session; the Worker does not save it. WhatsApp keeps up to 20 recent text messages per sender in private KV for 24 hours; attachment contents are not added to that history.
- The browser chat supports speech input, spoken replies, direct public-page research with citations, and uploads for images, documents, and audio. Short videos are sampled locally into a few frames; their audio is not analyzed.
- Uploaded file contents, web pages, and WhatsApp attachments are processed by Cloudflare Workers AI. Browser speech providers may process microphone audio. The WhatsApp Agent integration is not end-to-end encrypted; do not send secrets or sensitive data through it.

Urdu instructions: [`README-ur.md`](README-ur.md).

## Components

- `worker-zia.js`: canonical Cloudflare Worker, control room, API, API-key manager, and scheduled WhatsApp bridge.
- `worker-zia-tools.js`: bounded public-page research and media/file helpers imported by the Worker.
- `termux_agent.py`: Python client for Android Termux. It saves the service URL but prompts for the API key each time.
- `zia_whatsapp_agent.py`: optional text-only local WhatsApp poller. Use it only when the Cloudflare Cron poller is disabled.
- `wrangler.example.jsonc`: safe starting point for another Cloudflare account. Copy it to `wrangler.jsonc` and replace the KV namespace ID before deploying.

Old prototypes (`worker.js`, `worker-cyber.js`, and `demo.html`) are not part of the supported deployment.

## Chat tools and uploads

The signed-in website chat automatically reads a directly shared public HTTPS page or searches the public web for research requests. It cites fetched pages and refuses to present search snippets as verified evidence when no readable page is available. Public pages and extracted file text are untrusted reference data, never instructions.

Use **ADD FILES** to attach up to three files. Supported website inputs include common images, PDF, text, HTML/XML, CSV, Office/ODF documents, and common audio formats. Cloudflare Workers AI analyzes JPEG/PNG/WebP images, transcribes audio, and converts supported documents to Markdown. Each upload is limited to 5 MB for images, 8 MiB for audio, and 15 MB for documents. File/frame analysis is limited to 30 requests per hour per IP to control usage. Cloudflare's documented `toMarkdown` formats are listed in its [supported formats](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/supported-formats/) page.

The browser samples videos of at most 60 seconds and 15 MB into five JPEG frames, then sends those frames to Cloudflare's Moondream vision model. Video sampling runs in the browser; the original video is not uploaded, and its audio is not analyzed. The Moondream model page currently lists $0.30 per million input tokens and $1 per million output tokens; Whisper currently lists $0.000513 per audio minute. Pricing and allowances may change, so check Cloudflare's [Moondream](https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/) and [Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) model pages before frequent use.

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
- `HTTP 403 Error 1010`: replace the old client with the current GitHub version using the download command above. The current client identifies itself as `ZiaTermuxClient/1.0`; it does not impersonate a browser.
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

The cloud Cron bridge handles text and voice notes. It downloads audio by the WhatsApp media ID, limits input to 8 MiB, transcribes it with Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`), then sends Zia's text reply. Incoming JPEG/PNG/WebP images are analyzed with Cloudflare's Moondream model; supported documents such as PDF, DOCX, XLSX, CSV, and text are converted with Workers AI Markdown conversion. Those attachment contents are sent for the current reply but are not stored in the 24-hour conversation history. For research requests, it searches DuckDuckGo, fetches readable public source pages, and includes source links. Urdu requests such as `آج کی نیوز` are recognized and cleaned before search. If current-news pages cannot be read, it falls back to the BBC Urdu and Dawn RSS feeds and cites the linked stories; if neither pages nor feed items can be fetched, it will not present search snippets as verified facts. Page/feed text, the request, and voice transcripts are processed by Cloudflare Workers AI. It can create and attach a source-linked plain-text `.txt` report. Incoming WhatsApp video analysis is not supported yet.

The cloud bridge can also download a directly accessible public HTTPS file and send it as WhatsApp media. Supported formats include JPEG/PNG, MP4/3GP, WhatsApp-supported audio, PDF, plain text, and Office documents. Downloads are capped at 15 MB (5 MB for images), below WhatsApp's documented 16 MB video/audio/document and 5 MB image limits. Reports are plain-text `.txt` files, not PDF or spreadsheet exports. No media is transcoded; WhatsApp requires supported video codecs (H.264 video and AAC audio). The Worker will not bypass sign-in, a paywall, or DRM; only request files you are allowed to copy and share. If a file is discovered by search, it asks you to confirm copying/sharing rights before downloading it. Uploaded media expires from WhatsApp's media API after 30 days. The optional local Python receiver remains text-only.

The cloud WhatsApp bridge can list owned GitHub repositories with `/github repos` and create a private repository with `/github create <name>`. A create request only stages the action; creation happens after the same WhatsApp sender replies with the one-time confirmation code, which expires after 10 minutes. `/github cancel` cancels a pending creation. This is available only in the cloud Worker bridge, not the optional local Python receiver. File edits and workflow runs remain in the signed-in website GitHub panel. WhatsApp Agent conversations are not end-to-end encrypted; do not send secrets or sensitive data through WhatsApp.

The existing live service is managed by its current Cloudflare account. Deploying a new Worker requires your own account's binding IDs and secrets; source code alone cannot transfer account ownership or credentials.

## API

The service exposes a non-streaming OpenAI-compatible endpoint:

Website chat and WhatsApp share the main operator profile. Requests authenticated with project API keys use a separate profile, configurable in the control room under **API → Separate API AI Profile**. On its first API request, the separate profile copies the current main settings to preserve existing behavior; later changes to either profile do not affect the other. Both profiles use the same Cloudflare Workers AI binding and model catalog.

```text
POST /v1/chat/completions
Authorization: Bearer <project API key>
Content-Type: application/json
```

```json
{"model":"managed-by-control-room","messages":[{"role":"user","content":"Hello"}]}
```

Health check: `GET /api/health`. Search: `GET /api/search?q=...` when enabled in the control room. Project keys are limited to chat, search, and health; they cannot change settings or create/revoke keys. Streaming is not enabled.

The website uses the signed-session-only `/api/chat` route to automatically read public links and run source-cited research. Its `/api/files/analyze` route is also signed-session-only; project API keys cannot upload files. Shell commands are never run by either route. The separate Termux client keeps its explicit approval step for every local command.

## GitHub controls

The control room's **GitHub** panel can list repositories owned by the token's account, create private repositories, load or commit text files up to 96 KiB, and dispatch an existing GitHub Actions workflow. Each write or workflow dispatch asks for confirmation in the browser. These website endpoints require a signed control-room session; the master API token and project API keys cannot use GitHub. The cloud WhatsApp bridge has a separate, limited path for repository listing and same-chat-confirmed private repository creation. The Worker never returns the GitHub token to the browser.

Set `GITHUB_TOKEN` as a Cloudflare Worker secret. Use a fine-grained personal access token, not a token committed to a repository. The token needs repository metadata read, contents read/write, and Actions/workflow write permissions. Repository creation requires the GitHub `Repository creation` write permission when offered; otherwise GitHub documents `Administration` write as an alternative. `Pull requests` write is optional for the current controls. Prefer a restricted set of repositories; the token in the current live Worker is account-wide and expires after 90 days.

The Deploy control only starts an existing workflow file (default: `deploy.yml`). The included manual workflow is `.github/workflows/deploy.yml`; before using it, add these GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CONFIG_KV_NAMESPACE_ID`. Use a Cloudflare token scoped to the account's Worker deployment needs. The workflow generates `wrangler.jsonc` only during the run, so account identifiers are not committed. Do not commit `wrangler.jsonc`, API tokens, WhatsApp keys, or other secrets.

## Tests and contributor notes

```sh
node --check worker-zia.js
node --test worker-zia.test.mjs
python -m py_compile termux_agent.py zia_whatsapp_agent.py
```

See [`AGENTS.md`](AGENTS.md), [`CONTRIBUTING.md`](CONTRIBUTING.md), and [`SECURITY.md`](SECURITY.md). Open an issue without including API keys, passphrases, WhatsApp message contents, or private user data.

## License

MIT. See [`LICENSE`](LICENSE).
