# Zoya AI / Control Room

Zoya ایک general-purpose، OpenAI-compatible AI service ہے جس کا control room قابلِ ترمیم ہے۔ Hosted Worker مرکزی حصہ ہے؛ `termux_agent.py` اور `zia_whatsapp_agent.py` الگ clients ہیں۔ دوسرے server-side projects اسی API سے جڑ سکتے ہیں؛ Termux ماڈل کا لازمی حصہ نہیں۔

مرکزی معاون کا نام Zoya ہے۔ WhatsApp پر عام بات چیت مختصر، نرم اور ہلکے رومانوی بالغ-companion انداز میں ہوتی ہے؛ روزمرہ گفتگو خودکار web research نہیں چلاتی۔ صارف کہے تو تحقیق، حالیہ معلومات اور حوالہ جات پھر بھی دستیاب ہیں۔

## What you control

- Assistant name, persistent instructions, selected cloud model, response length, web search, and shell-command suggestions are saved in Cloudflare KV and editable in the control room.
- The Worker never executes shell commands. The Termux client asks for approval before every command, including a second confirmation for recognized high-risk patterns.
- These settings steer the model; they do not train or change its weights. Clearer prompts can reduce unnecessary refusals, but they cannot override the hosted model's own safeguards or provider terms. Secrets, authorization, and command-approval protections remain enabled.
- Web search is optional and can be disabled. Search queries are sent to DuckDuckGo.
- In the website chat, use **MIC / UR** to speak a message; it submits automatically. **Speak replies** reads Zoya's answer aloud using the browser/device speech services. Allow microphone access and choose Urdu or English in **VOICE**. Browser speech support and available voices vary by device; microphone audio may be processed by the browser's speech provider.

## Deploy the Worker

`wrangler.jsonc` uses `worker-zia.js`, the `AI` Workers AI binding, and the `CONFIG` KV namespace. Keep the `SITE_PASSWORD` and `API_TOKEN` values in Cloudflare Worker secrets, never in source files. The API token must be at least 40 characters and separate from the website passphrase.

For an existing Cloudflare account, deploy this project's Worker source and retain the existing bindings/secrets. With Wrangler installed and authenticated:

```sh
npx wrangler deploy --config wrangler.jsonc
```

For a new account, create a Workers AI binding named `AI`, a KV namespace bound as `CONFIG`, add both secrets, and update the KV namespace ID in `wrangler.jsonc` before deploying.

## Control room

Sign in at your Worker URL with the website passphrase. Open **Mindset & Permissions** to edit Zoya's name and behavior, choose a model, set response size, and switch web search or shell suggestions on/off. Clearer instructions can make the assistant less over-cautious on benign topics. Provider safeguards, protection of secrets, and command-approval controls are not removed through the editable prompt.

The saved profile persists in KV. Website chat history stays in the browser session and is not saved by the Worker. WhatsApp text context is kept in private KV for 24 hours; extracted attachment contents are used for the current reply but are not saved in that history.

ویب chat میں public HTTPS link کے بارے میں پوچھنے یا research/current news مانگنے پر Zoya صفحہ کھول کر یا web search کرکے قابلِ مطالعہ ذرائع کے حوالہ جات دے سکتی ہے۔ **ADD FILES** سے ایک message میں زیادہ سے زیادہ تین attachments دیں: JPEG/PNG/WebP تصاویر کا visual analysis، عام audio کی transcription، اور PDF، DOCX، XLSX، CSV، text سمیت معاون document formats کی conversion دستیاب ہے۔ ہر تصویر 5 MB، audio 8 MiB، اور document 15 MB تک ہو سکتا ہے۔ غیر متوقع خرچ سے بچانے کے لیے فی IP فی گھنٹہ file/frame analysis کی حد 30 درخواستیں ہے۔ 60 سیکنڈ اور 15 MB تک video سے browser میں پانچ frames نکال کر Cloudflare AI کو بھیجے جاتے ہیں؛ اصل video upload نہیں ہوتی اور اس کے audio کا تجزیہ نہیں ہوتا۔ Upload کے متن، تصویر یا منتخب video frames Cloudflare Workers AI کو بھیجے جاتے ہیں؛ حساس فائلیں upload نہ کریں۔ Whisper transcription اور Moondream visual analysis پر Cloudflare usage charges لگ سکتے ہیں۔

ویب سائٹ کی چیٹ اور WhatsApp ایک مرکزی پروفائل استعمال کرتے ہیں۔ Project API key سے آنے والی درخواستیں الگ **API AI Profile** استعمال کرتی ہیں، جسے control room کے **API** حصے میں بدلا جا سکتا ہے۔ پہلی API درخواست پر پرانی ترتیبات کی نقل بنائی جاتی ہے تاکہ موجودہ کلائنٹس کا رویہ برقرار رہے؛ اس کے بعد دونوں پروفائل ایک دوسرے سے آزاد ہوتے ہیں۔ دونوں پھر بھی Cloudflare Workers AI کے اسی model catalog سے ماڈل چنتے ہیں، الگ AI provider نہیں۔

## GitHub controls

Control room کے **GitHub** حصے سے اپنے اکاؤنٹ کی repositories دیکھی، private repository بنائی، 96 KiB تک کی text file لوڈ یا commit کی، اور پہلے سے موجود GitHub Actions workflow چلایا جا سکتا ہے۔ ہر write یا deploy سے پہلے browser تصدیق مانگتا ہے۔ یہ website endpoints صرف signed-in control-room session کے لیے ہیں؛ API token اور project keys GitHub استعمال نہیں کر سکتے۔ Cloud WhatsApp bridge میں `/github repos` سے repositories دیکھی جا سکتی ہیں اور `/github create <name>` سے private repository کی درخواست دی جا سکتی ہے۔ Repository صرف اسی WhatsApp chat میں بھیجے گئے ایک بار استعمال ہونے والے confirmation code کے بعد بنتی ہے؛ code دس منٹ میں ختم ہو جاتا ہے۔ `/github cancel` زیرِ التوا درخواست منسوخ کرتا ہے۔ File edits اور workflow runs صرف website panel میں دستیاب ہیں۔ Optional local Python receiver میں GitHub actions شامل نہیں۔ WhatsApp Agent گفتگو end-to-end encrypted نہیں؛ secrets یا حساس معلومات نہ بھیجیں۔ Worker، GitHub token کو browser میں واپس نہیں بھیجتا۔

`GITHUB_TOKEN` کو Cloudflare Worker secret کے طور پر رکھیں۔ Fine-grained personal access token میں repository metadata read، contents read/write، اور Actions/workflow write درکار ہیں۔ Repository بنانے کے لیے GitHub کا `Repository creation` write permission استعمال کریں؛ اگر UI میں یہ دستیاب نہ ہو تو GitHub، `Administration` write کو متبادل بتاتا ہے۔ `Pull requests` write موجودہ controls کے لیے لازمی نہیں۔ صرف مطلوبہ repositories تک اجازت محدود رکھیں؛ موجودہ live token پورے اکاؤنٹ کی repositories تک رسائی رکھتا ہے اور 90 دن بعد ختم ہوگا۔

Deploy control صرف پہلے سے موجود workflow چلاتا ہے۔ شامل manual workflow `.github/workflows/deploy.yml` ہے؛ اسے چلانے سے پہلے GitHub Actions میں `CLOUDFLARE_API_TOKEN`، `CLOUDFLARE_ACCOUNT_ID` اور `CONFIG_KV_NAMESPACE_ID` secrets شامل کریں۔ Cloudflare token کو Worker deployment کی ضرورت تک محدود رکھیں۔ Workflow صرف run کے دوران `wrangler.jsonc` بناتا ہے، اس لیے account identifiers repository میں commit نہیں ہوتے۔ `wrangler.jsonc`، API tokens، WhatsApp key یا دوسرے secrets کو repository میں commit نہ کریں۔

## Project API keys

In the control room, open **API** and create a named project key. The full key is shown once; copy it before leaving the page. Cloudflare KV stores only its SHA-256 hash. Revoke a key from the same panel to stop its access. Project keys are limited to chat, search, and health checks; they cannot edit the control-room profile or manage keys. Keep keys on a backend or in a secret store, never in public browser code. KV revocation may take up to about one minute to propagate globally.

## Connect another project

Use the service from a backend, command-line tool, or server. Keep `API_TOKEN` on that server; do not put it in public browser JavaScript. Browser apps should call their own backend to avoid exposing the token. API-key requests use the separate API profile in the control room; website and WhatsApp settings do not change it. Both profiles use the same Cloudflare Workers AI model catalog. An optional `model` field from a client is accepted for compatibility but does not override the API profile. Streaming is not enabled.

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

Website chat کے اندر signed session والا `/api/chat` route public links پڑھتا اور research requests پر حوالہ جات کے ساتھ نتائج دیتا ہے۔ `/api/files/analyze` بھی صرف signed website session کے لیے ہے؛ Project API keys فائل upload نہیں کر سکتیں۔ یہ routes shell command نہیں چلاتے۔ Termux میں ہر local command پہلے آپ کی واضح منظوری کے بعد ہی چلتی ہے۔

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

Cloud bridge عام متن اور voice notes سنبھالتا ہے۔ WhatsApp پر Zoya عام گفتگو میں مختصر، نرم، ہلکے رومانوی companion انداز میں جواب دیتی ہے؛ صرف واضح research/current facts/news یا link کی درخواست پر web search کرتی ہے۔ Voice note کا WhatsApp media ID لے کر audio زیادہ سے زیادہ 8 MiB ڈاؤن لوڈ ہوتا ہے، Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`) سے transcript بنتا ہے، پھر Zoya کا جواب متن میں جاتا ہے۔ آنے والی JPEG/PNG/WebP تصاویر Moondream سے دیکھی جا سکتی ہیں؛ PDF، DOCX، XLSX، CSV اور plain-text جیسے معاون documents Workers AI Markdown conversion کے ذریعے پڑھے جا سکتے ہیں۔ Attachment کا نکالا ہوا متن یا visual analysis موجودہ جواب کے لیے Cloudflare کو بھیجا جاتا ہے، مگر 24 گھنٹے والی Zoya history میں محفوظ نہیں ہوتا۔ Internet research کی درخواست پر یہ DuckDuckGo سے تلاش کرکے پڑھنے کے قابل public source pages کھولتا اور حوالہ جات دیتا ہے۔ `آج کی نیوز` جیسے Urdu جملے research request کے طور پر پہچان کر search کے لیے صاف کیے جاتے ہیں۔ اگر آج کی خبریں والے اصل صفحات نہ کھلیں تو BBC Urdu اور Dawn کے RSS feeds سے headlines/descriptions لے کر متعلقہ story links کے ساتھ حوالہ دیتا ہے؛ اگر صفحات اور feed entries دونوں دستیاب نہ ہوں تو search snippets کو تصدیق شدہ حقیقت بنا کر پیش نہیں کرتا۔ درخواست، صفحوں/feed کا متن، اور voice transcripts Cloudflare Workers AI کو بھیجے جاتے ہیں۔ Zoya حوالہ جات والا plain-text `.txt` report بنا کر attach کر سکتی ہے۔ WhatsApp میں آنے والی video کا تجزیہ فی الحال دستیاب نہیں۔

Cloud bridge براہِ راست دستیاب public HTTPS لنک سے فائل ڈاؤن لوڈ کرکے WhatsApp media کے طور پر بھیج سکتا ہے: JPEG/PNG، MP4/3GP، WhatsApp کے supported audio، PDF، plain text اور Office documents۔ Download کی حد 15 MB ہے (تصویر کے لیے 5 MB)؛ WhatsApp کی دستاویزی حد video/audio/document کے لیے 16 MB اور تصویر کے لیے 5 MB ہے۔ Reports صرف plain-text `.txt` فائل ہوتے ہیں، PDF یا spreadsheet نہیں۔ ویڈیو تبدیل (transcode) نہیں ہوتی؛ WhatsApp کے لیے H.264 video اور AAC audio codec درکار ہیں۔ Sign-in، paywall یا DRM کو bypass نہیں کیا جاتا؛ صرف وہ فائل بھیجیں جسے نقل اور share کرنے کی اجازت ہو۔ اگر فائل web search سے ملے تو download سے پہلے ownership یا share کرنے کی اجازت کی تصدیق مانگی جاتی ہے۔ آنے والی WhatsApp ویڈیو کا تجزیہ ابھی دستیاب نہیں۔ WhatsApp کے media API پر upload کردہ media 30 دن بعد ختم ہو جاتا ہے۔ Optional local Python receiver text-only ہے۔ WhatsApp concurrent polls کو replace کرتا ہے، اس لیے ایک Agent key کے لیے ایک ہی receiver چلائیں؛ cloud Cron فعال ہو تو `zia_whatsapp_agent.py` نہ چلائیں۔

Bridge WhatsApp کے documented `entry[].changes[].value.messages[]` response کو پڑھتا، آنے والے messages queue کرتا، اور ہر scheduled run میں زیادہ سے زیادہ دو replies بھیجتا ہے۔ گفتگو کا context رکھنے کے لیے ہر sender کے تازہ 20 متن والے user/assistant messages نجی `CONFIG` KV میں 24 گھنٹے محفوظ رہتے ہیں؛ polling cursor اور حالیہ message IDs بھی وہیں رہتے ہیں۔ Attachment کا اصل متن یا image analysis اس history میں محفوظ نہیں ہوتا۔

Voice transcription consumes Workers AI audio-minute usage; the model page currently lists $0.000513 per audio minute. Image analysis also uses metered Workers AI. Check the [current Whisper](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) and [Moondream](https://developers.cloudflare.com/workers-ai/models/moondream3.1-9B-A2B/) pricing and account allowance before frequent use.

WhatsApp Agent گفتگو WhatsApp کی Third-Party Agent شرائط کے تحت **end-to-end encrypted نہیں**۔ Agent provider کو messages اور media ملتے ہیں؛ research کے صفحوں کا متن، image/document analysis، voice transcripts اور AI کے لیے درخواست Cloudflare Workers AI تک جاتے ہیں۔ Password، API key یا حساس نجی معلومات اس bridge پر نہ بھیجیں۔ یہ personal WhatsApp Agent API ہے، WhatsApp Business Cloud API یا Meta Business Agent نہیں۔

- [Official WhatsApp Agent Platform developer manual](https://www.whatsapp.com/developer/WhatsApp-Agent-Platform-Developer-Manual.pdf)
- [WhatsApp Third-Party Agent terms](https://www.whatsapp.com/legal/third-party-agents-terms)
- [Meta Business Agent overview](https://developers.facebook.com/documentation/meta-business-agent/overview)

## Service limits

The model runs on Cloudflare Workers AI, not on the phone. The Cloudflare free allowance is limited and can change; check the account's current usage before relying on it. Inference and search send data to their providers. Prompt settings are not model training, and the model can still make mistakes.
