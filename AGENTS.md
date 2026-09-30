# Contributor Notes

- The supported Worker entry point is `worker-zia.js`; do not deploy the old prototypes `worker.js` or `worker-cyber.js`.
- `termux_agent.py` is an optional client to the hosted Worker. The Worker itself never executes local shell commands.
- `zia_whatsapp_agent.py` is an optional local receiver. Never run it concurrently with the Worker's scheduled WhatsApp receiver for the same Agent key.
- Never commit `wrangler.jsonc`, `.dev.vars`, API keys, passphrases, phone numbers, or real WhatsApp message data. Use `wrangler.example.jsonc` for public configuration.
- Keep new dependencies minimal. Explain any provider or privacy changes in both English and Urdu documentation.
- Before changes, run `node --check worker-zia.js` and `python -m py_compile termux_agent.py zia_whatsapp_agent.py`.
- Do not claim successful deployment or a live WhatsApp reply based only on local tests.
