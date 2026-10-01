# Zia AI / Control Room

Zia is a general-purpose, OpenAI-compatible AI service with an editable control room. The hosted Worker is the core; `termux_agent.py` and `zia_whatsapp_agent.py` are independent clients. Connect other server-side projects to the same API without making Termux part of the model.

## What you control

- Assistant name, persistent instructions, selected cloud model, response length, web search, and shell-command suggestions are saved in Cloudflare KV and editable in the control room.
- The Worker never executes shell commands. The Termux client asks for approval before every command, including a second confirmation for recognized high-risk patterns.
- These settings steer the model; they do not train or change its weights. The AI model is hosted by Cloudflare, so its internal behavior, provider availability, and outputs are not under 100% operator control.
- Web search is optional and can be disabled. Search queries are sent to DuckDuckGo.
- In the website chat, use **MIC / UR** to speak a message; it submits automatically. **Speak replies** reads Zia's answer aloud using the browser/device speech services. Allow microphone access and choose Urdu or English in **VOICE**. Browser speech support and available voices vary by device; microphone audio may be processed by the browser's speech provider.

## Deploy the Worker

`wrangler.jsonc` uses `worker-zia.js`, the `AI` Workers AI binding, and the `CONFIG` KV namespace. Keep the `SITE_PASSWORD` and `API_TOKEN` values in Cloudflare Worker secrets, never in source files. The API token must be at least 40 characters and separate from the website passphrase.

For an existing Cloudflare account, deploy this project's Worker source and retain the existing bindings/secrets. With Wrangler installed and authenticated:

```sh
npx wrangler deploy --config wrangler.jsonc
```

For a new account, create a Workers AI binding named `AI`, a KV namespace bound as `CONFIG`, add both secrets, and update the KV namespace ID in `wrangler.jsonc` before deploying.

## Control room

Sign in at your Worker URL with the website passphrase. Open **Mindset & Permissions** to edit Zia's name and behavior, choose a model, set response size, and switch web search or shell suggestions on/off. Disabling shell suggestions also strips shell code blocks at the API; when enabled, Termux still requires your approval for every command. The fixed safety rules cannot be removed through the editable instructions.

The saved profile persists in KV. Chat history is not stored by the Worker. Browser and WhatsApp clients may keep recent messages in their own memory while running.

## Project API keys

In the control room, open **API** and create a named project key. The full key is shown once; copy it before leaving the page. Cloudflare KV stores only its SHA-256 hash. Revoke a key from the same panel to stop its access. Project keys are limited to chat, search, and health checks; they cannot edit the control-room profile or manage keys. Keep keys on a backend or in a secret store, never in public browser code. KV revocation may take up to about one minute to propagate globally.

## Connect another project

Use the service from a backend, command-line tool, or server. Keep `API_TOKEN` on that server; do not put it in public browser JavaScript. Browser apps should call their own backend to avoid exposing the token. The model is selected centrally in the control room. An optional `model` field from a client is accepted for compatibility but does not override that setting. Streaming is not enabled.

```sh
curl -s https://YOUR-WORKER.workers.dev/v1/chat/completions \
  -H 'Authorization: Bearer YOUR_PRIVATE_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"model":"managed","messages":[{"role":"user","content":"اردو میں اپنا تعارف کرو"}]}'
```

OpenAI Python clients can use the same endpoint:

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://YOUR-WORKER.workers.dev/v1",
    api_key=os.environ["ZIA_API_TOKEN"],
)
reply = client.chat.completions.create(
    model="managed",
    messages=[{"role": "user", "content": "Hello from my project"}],
)
print(reply.choices[0].message.content)
```

Health check: `GET /api/health`. Web search: authenticated `GET /api/search?q=...`, when enabled in the control room. The Worker rejects cross-origin browser calls; this keeps the API token out of browser code. Server-to-server integrations do not need browser CORS.

## Termux client

`termux_agent.py` is a separate client for an approval-based Android shell workflow. It does not change the general-purpose API and is not required for other projects.

### آسان انسٹال (GitHub سے)

یہ طریقہ فائل سیدھی Termux کے اپنے home folder میں لیتا ہے؛ `termux-setup-storage` کی ضرورت نہیں:

```sh
pkg update -y
pkg install -y python curl
mkdir -p ~/zia-ai-agent
cd ~/zia-ai-agent
curl -fL "https://raw.githubusercontent.com/ziakhalid236/zia-ai-agent/main/termux_agent.py" -o termux_agent.py
python termux_agent.py
```

پہلی بار یہ Worker URL اور API key پوچھے گا۔ URL اپنی live Worker سائٹ سے لیں؛ API key ویب سائٹ کے **API → Generate Key** سے بنائیں۔ Site passphrase یا WhatsApp key یہاں نہ دیں۔ API key ٹائپ کرتے وقت چھپی رہتی ہے اور Termux client اسے محفوظ نہیں کرتا؛ URL محفوظ ہوتا ہے۔ `Connected` آنے پر رابطہ درست ہے۔

`termux-setup-storage` صرف تب درکار ہے جب فائل Android کے Downloads فولڈر سے کھولنی ہو۔ اسے اکیلا چلائیں، `Do you want to continue? (y/n)` پر `y` لکھ کر Enter دبائیں اور Android کی اجازت دیں۔ اسے دوسری کمانڈز کے ساتھ ایک ساتھ paste نہ کریں؛ `y/n` prompt اگلی کمانڈ کو جواب سمجھ سکتا ہے۔ GitHub والا طریقہ storage permission سے بچاتا ہے۔

اگر پرانی client پر Cloudflare کا `HTTP 403 Error 1010` آئے تو تازہ client download کرکے دوبارہ چلائیں؛ نئی client واضح `ZiaTermuxClient/1.0` شناخت بھیجتی ہے:

```sh
cd ~/zia-ai-agent
curl -fL "https://raw.githubusercontent.com/ziakhalid236/zia-ai-agent/main/termux_agent.py" -o termux_agent.py
python termux_agent.py
```

ہر تجویز کردہ shell command غور سے دیکھیں۔ منظور کی گئی کمانڈ Termux کی ایپ اجازتوں کے ساتھ چلتی ہے، اس لیے یہ مکمل sandbox نہیں۔ چیٹ کی عارضی history ایجنٹ بند ہونے پر ختم ہوتی ہے۔

کمانڈز: `/help`, `/search الفاظ`, `/clear`, `/speak`, `/exit`۔ `/speak` Termux:API کے ذریعے صرف جواب بلند آواز سے پڑھتا ہے؛ بول کر input ویب control room میں دستیاب ہے۔

### پلیٹ فارم اور اکاؤنٹ کی ملکیت

- **GitHub:** public source اور آئندہ contributors کے لیے؛ repository owner آپ کا اپنا GitHub account ہونا چاہیے۔
- **Cloudflare:** Worker، Workers AI، KV اور secrets اسی Cloudflare account میں رہتے ہیں جس پر live service deploy ہے۔ دوسری Cloudflare account بنانے کی ضرورت نہیں؛ project کی اپنی KV binding ID استعمال کریں۔
- **WhatsApp Agent Platform:** صرف WhatsApp bridge کے لیے؛ Agent اور اس کی key آپ کے WhatsApp account سے آتے ہیں۔ ایک Agent key پر Cloud Cron یا مقامی bridge میں سے صرف ایک poller چلائیں۔
- **DuckDuckGo:** web search کے لیے public HTML search استعمال ہوتی ہے؛ الگ account یا API key درکار نہیں۔
- **Termux:** Android پر client ہے، الگ AI account نہیں۔ Model Cloudflare Workers AI پر چلتا ہے؛ ان تنظیموں میں الگ model account نہیں بنایا جاتا۔

## Connect a personal WhatsApp Agent

WhatsApp's official Agent Platform manual documents an API at `https://api.whatsapp.com/agent/v1`. In WhatsApp, open **Settings → Agents → Create an agent**, then open the Agent chat and select **Chat info → API key**. Availability can depend on account/region rollout.

The production Worker can poll WhatsApp without an always-on phone. Add a Cloudflare Worker secret named `WHATSAPP_AGENT_API_KEY` under **Workers & Pages → blacksite-field-ops → Settings → Variables and Secrets**. Never paste the key into the Zia web page, source code, or chat. Then enable the Worker Cron trigger `*/1 * * * *` under **Settings → Triggers → Cron Triggers**. `wrangler.jsonc` includes the same trigger for command-line deployments. The first poll starts at cursor `0` and uses the documented 15-second long-poll so messages sent between scheduled runs are not skipped. The control room's **Connections** panel shows poll errors, messages received, replies, and queued messages.

The cloud bridge handles text messages and voice notes. For voice notes it fetches the audio by WhatsApp media ID, limits audio to 8 MiB, transcribes it with Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`), and sends Zia's reply as text. It unwraps WhatsApp's documented `entry[].changes[].value.messages[]` response, queues inbound messages, and sends no more than two replies per scheduled run. It keeps the latest 20 WhatsApp messages per sender in the private `CONFIG` KV namespace for 24 hours to maintain conversation context; polling offsets and recent message IDs are also stored there. WhatsApp replaces concurrent polls, so use exactly one receiver per Agent key: do not run `zia_whatsapp_agent.py` while the cloud Cron bridge is enabled. The optional local Python script is text-only and is for users who disable the cloud Cron and want a separate local bridge.

Voice transcription consumes Workers AI audio-minute usage; check the [current model pricing](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) and account allowance.

WhatsApp Agent conversations are **not end-to-end encrypted** under WhatsApp's Third-Party Agent terms. The Agent provider receives message content and voice-note audio; Zia sends text and transcripts to Cloudflare Workers AI for a reply. Do not send passwords, API keys, or sensitive private information through this bridge. The personal WhatsApp Agent API is different from the WhatsApp Business Cloud API and Meta Business Agent.

- [Official WhatsApp Agent Platform developer manual](https://www.whatsapp.com/developer/WhatsApp-Agent-Platform-Developer-Manual.pdf)
- [WhatsApp Third-Party Agent terms](https://www.whatsapp.com/legal/third-party-agents-terms)
- [Meta Business Agent overview](https://developers.facebook.com/documentation/meta-business-agent/overview)

## Service limits

The model runs on Cloudflare Workers AI, not on the phone. The Cloudflare free allowance is limited and can change; check the account's current usage before relying on it. Inference and search send data to their providers. Prompt settings are not model training, and the model can still make mistakes.
