# Security

Report security concerns privately to the repository owner rather than opening a public issue. Until a security contact is added, do not include exploit details, tokens, passwords, WhatsApp keys, or user data in public discussions.

## Keep secrets private

- Store `SITE_PASSWORD`, `API_TOKEN`, `GITHUB_TOKEN`, and `WHATSAPP_AGENT_API_KEY` as Cloudflare Worker secrets.
- Limit the GitHub token to the required repositories and permissions. GitHub controls require a signed control-room session; do not add them to WhatsApp or project API-key access.
- Keep project API keys on a backend or in Termux's private prompt. Do not put them in public browser code or source control.
- The website passphrase, project API key, and WhatsApp Agent key are three different credentials.
- `wrangler.jsonc` is account-specific and ignored by Git. Share only `wrangler.example.jsonc`.
- Revoke a leaked project key immediately in the control room and issue a replacement.

## Data handling

- Cloudflare Workers AI receives prompts sent to the Worker.
- DuckDuckGo receives search queries when web search is used.
- Personal WhatsApp Agent messages are not end-to-end encrypted under WhatsApp's Third-Party Agent terms and are sent to the configured AI provider for replies.
- Browser speech recognition may send microphone audio to the browser's speech service.
