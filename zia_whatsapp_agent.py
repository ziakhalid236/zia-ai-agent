#!/usr/bin/env python3
"""Bridge a personal WhatsApp Agent to the general Zia chat API."""

import getpass
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


WHATSAPP_API = "https://api.whatsapp.com/agent/v1"
DEFAULT_ZIA_URL = os.environ.get("ZIA_BASE_URL", "").strip()
STATE_DIR = Path.home() / ".config" / "zia-ai"
STATE_FILE = STATE_DIR / "whatsapp-agent.json"


class ApiError(RuntimeError):
    def __init__(self, status, message, retry_after=None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


def request_json(url, token, payload=None, timeout=40):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": "Bearer " + token,
        "Accept": "application/json",
        "User-Agent": "ZiaWhatsAppBridge/1.0 (+https://github.com/ziakhalid236/zia-ai-agent)",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method="GET" if body is None else "POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            return None if response.status == 204 or not raw else json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as error:
        details = error.read(2000).decode("utf-8", "replace")
        raise ApiError(error.code, details or "HTTP " + str(error.code), error.headers.get("Retry-After")) from error
    except urllib.error.URLError as error:
        raise RuntimeError("Network request failed: " + str(error.reason)) from error


def load_state():
    try:
        data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            return {"offset": data.get("offset"), "handled": data.get("handled", [])[-500:]}
    except (OSError, json.JSONDecodeError, TypeError):
        pass
    return {"offset": None, "handled": []}


def save_state(state):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        STATE_DIR.chmod(0o700)
    except OSError:
        pass
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(json.dumps(state), encoding="utf-8")
    try:
        temporary.chmod(0o600)
    except OSError:
        pass
    os.replace(temporary, STATE_FILE)


def message_text(message):
    value = message.get("text")
    if isinstance(value, dict):
        value = value.get("body")
    return value if isinstance(value, str) else None


def update_messages(update):
    if not isinstance(update, dict):
        return []
    direct = update.get("messages")
    if isinstance(direct, list):
        return direct
    messages = []
    for entry in update.get("entry", []):
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes", []):
            if not isinstance(change, dict) or change.get("field") != "messages":
                continue
            value = change.get("value")
            if isinstance(value, dict) and isinstance(value.get("messages"), list):
                messages.extend(value["messages"])
    return messages


def zia_reply(base_url, api_token, history):
    result = request_json(base_url + "/v1/chat/completions", api_token, {"messages": history})
    return result["choices"][0]["message"]["content"]


def send_whatsapp(token, recipient, text):
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "text",
        "text": {"body": text[:4096]},
    }
    return request_json(WHATSAPP_API + "/messages", token, payload)


def process_update(update, whatsapp_token, zia_url, zia_token, state, histories, pending_replies):
    messages = update_messages(update)
    handled = state["handled"]
    for message in messages:
        message_id = str(message.get("id", ""))
        if message_id and message_id in handled:
            continue
        recipient = message.get("from") or message.get("sender")
        if not isinstance(recipient, str) or not recipient.startswith("user:"):
            continue

        text = message_text(message)
        answer = pending_replies.get(message_id) if message_id else None
        if answer is None:
            if text is None:
                answer = "This local bridge handles text only. To use voice notes, enable the cloud Worker Cron bridge and stop this receiver."
            else:
                history = histories.setdefault(recipient, [])
                pending = (history + [{"role": "user", "content": text}])[-30:]
                answer = zia_reply(zia_url, zia_token, pending)
                pending.extend([{"role": "assistant", "content": answer}])
                histories[recipient] = pending[-30:]
            if message_id:
                pending_replies[message_id] = answer

        send_whatsapp(whatsapp_token, recipient, answer)
        if message_id:
            handled.append(message_id)
            state["handled"] = handled[-500:]
            pending_replies.pop(message_id, None)
            save_state(state)
        print("Replied to one WhatsApp message.")

    if isinstance(update, dict) and update.get("next_offset") is not None:
        state["offset"] = int(update["next_offset"])
        save_state(state)


def poll_url(offset):
    params = {"offset": 0 if offset is None else int(offset), "limit": 50, "timeout": 25}
    return WHATSAPP_API + "/updates?" + urllib.parse.urlencode(params)


def run():
    prompt = "Zia service URL" + (" [" + DEFAULT_ZIA_URL + "]" if DEFAULT_ZIA_URL else "") + ": "
    zia_url = input(prompt).strip() or DEFAULT_ZIA_URL
    zia_url = zia_url.rstrip("/")
    if not zia_url.startswith("https://"):
        raise ValueError("Use an HTTPS Zia service URL.")
    zia_token = getpass.getpass("Zia API token (hidden): ").strip()
    whatsapp_token = getpass.getpass("WhatsApp Agent API key (hidden): ").strip()
    if not zia_token or not whatsapp_token:
        raise ValueError("Both API credentials are required.")

    health = request_json(zia_url + "/api/health", zia_token)
    print("Connected to Zia model: " + str(health.get("model", "configured")))
    state = load_state()
    histories = {}
    pending_replies = {}
    backoff = 3
    print("Use only one receiver per WhatsApp Agent key. Stop the cloud Worker Cron while this local bridge is running.")
    print("WhatsApp bridge is running. Press Ctrl+C to stop.")

    while True:
        try:
            update = request_json(poll_url(state["offset"]), whatsapp_token, timeout=40)
            if update is not None:
                process_update(update, whatsapp_token, zia_url, zia_token, state, histories, pending_replies)
            backoff = 3
        except ApiError as error:
            if error.status in (400, 401, 403):
                raise RuntimeError("WhatsApp or Zia rejected a credential/request: " + str(error)) from error
            if error.status == 429 or error.status >= 500:
                delay = min(60, max(backoff, int(error.retry_after or 0)))
                print("Service is busy; retrying in " + str(delay) + " seconds.")
                time.sleep(delay)
                backoff = min(backoff * 2, 60)
                continue
            raise
        except (RuntimeError, TimeoutError) as error:
            print(str(error) + "; retrying shortly.")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nWhatsApp bridge stopped.")
    except (ValueError, RuntimeError, ApiError, KeyError, json.JSONDecodeError) as error:
        print("Setup or connection error: " + str(error), file=sys.stderr)
        sys.exit(1)
