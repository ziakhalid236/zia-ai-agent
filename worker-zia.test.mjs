import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./worker-zia.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const API_TOKEN = "a".repeat(48);

function makeKV() {
  const values = new Map();
  return {
    values,
    async get(key, type) {
      const value = values.get(key);
      if (value === undefined) return null;
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); },
  };
}

function response(data, status = 200) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: data === null ? {} : { "content-type": "application/json" },
  });
}

function makeEnv() {
  return { API_TOKEN, SITE_PASSWORD: "test-passphrase", GITHUB_TOKEN: "github-token-fixture", CONFIG: makeKV() };
}

async function signedIn(env) {
  const login = await worker.fetch(new Request("https://unit.test/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: env.SITE_PASSWORD }),
  }), env);
  assert.equal(login.status, 200);
  return (await login.json()).token;
}

function request(path, token, method = "GET", body) {
  return new Request("https://unit.test" + path, {
    method,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function runWhatsAppSchedule(env) {
  let scheduled;
  worker.scheduled({}, env, { waitUntil(promise) { scheduled = promise; } });
  await scheduled;
}

function installWhatsAppMock(batches) {
  const githubCalls = installGitHubMock();
  const githubFetch = globalThis.fetch;
  const sentMessages = [];
  let poll = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.origin === "https://api.whatsapp.com" && url.pathname.endsWith("/updates")) {
      const messages = batches[poll] || [];
      poll++;
      return response({ messages, next_offset: String(poll) });
    }
    if (url.origin === "https://api.whatsapp.com" && url.pathname.endsWith("/messages")) {
      sentMessages.push(JSON.parse(options.body));
      return response({ message_id: "reply-" + sentMessages.length });
    }
    return githubFetch(input, options);
  };
  return { githubCalls, sentMessages };
}

function makeWhatsAppEnv() {
  const env = makeEnv();
  env.WHATSAPP_AGENT_API_KEY = "whatsapp-key-fixture";
  env.AI = { async run() { throw new Error("AI should not run for GitHub commands"); } };
  return env;
}

function installGitHubMock() {
  const calls = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ method, pathname: url.pathname, body });
    if (url.pathname === "/user") return response({ login: "zia" });
    if (url.pathname === "/user/repos" && method === "GET") return response([{ name: "agent", full_name: "zia/agent", private: true, default_branch: "main", html_url: "https://github.com/zia/agent", owner: { login: "zia" } }]);
    if (url.pathname === "/user/repos" && method === "POST") return response({ name: body.name, full_name: "zia/" + body.name, private: body.private, default_branch: "main", html_url: "https://github.com/zia/" + body.name });
    if (url.pathname === "/repos/zia/agent" && method === "GET") return response({ default_branch: "main" });
    if (url.pathname === "/repos/zia/agent/contents/README.md" && method === "GET") return response({ type: "file", path: "README.md", sha: "a".repeat(40), content: btoa("hello\n") });
    if (url.pathname === "/repos/zia/agent/contents/README.md" && method === "PUT") return response({ content: { sha: "b".repeat(40), html_url: "https://github.com/zia/agent/blob/main/README.md" } });
    if (url.pathname === "/repos/zia/agent/contents/new.md" && method === "GET") return response({ message: "Not Found" }, 404);
    if (url.pathname === "/repos/zia/agent/contents/new.md" && method === "PUT") return response({ content: { sha: "c".repeat(40), html_url: "https://github.com/zia/agent/blob/main/new.md" } });
    if (url.pathname === "/repos/zia/agent/actions/workflows/deploy.yml/dispatches" && method === "POST") return response(null, 204);
    return response({ message: "Not Found" }, 404);
  };
  return calls;
}

test("GitHub routes are limited to signed control-room sessions", async () => {
  const env = makeEnv();
  installGitHubMock();
  const result = await worker.fetch(request("/api/github/repos", API_TOKEN), env);
  assert.equal(result.status, 403);
});

test("control room renders a separate GitHub panel", async () => {
  const env = makeEnv();
  const response = await worker.fetch(new Request("https://unit.test/"), env);
  const html = await response.text();
  assert.match(html, /data-view="github"/);
  assert.match(html, /id="github" class="panel"/);
  assert.match(html, /Every write requires a confirmation/);
  assert.match(html, /WhatsApp supports repository listing and confirmed private creation/);
});

test("WhatsApp can list owned GitHub repositories", async () => {
  const env = makeWhatsAppEnv();
  const { sentMessages } = installWhatsAppMock([[{ id: "wa-list", from: "user:creator", text: "/github repos" }]]);
  await runWhatsAppSchedule(env);
  assert.match(sentMessages[0].text.body, /Repositories owned by @zia/);
  assert.match(sentMessages[0].text.body, /zia\/agent \(private\)/);
});

test("WhatsApp repository creation requires a same-sender confirmation", async () => {
  const env = makeWhatsAppEnv();
  const batches = [
    [{ id: "wa-ask", from: "user:creator", text: "Repository aap banaen" }],
    [{ id: "wa-stage", from: "user:creator", text: "/github create new-private-repo" }],
    [],
    [],
  ];
  const { githubCalls, sentMessages } = installWhatsAppMock(batches);

  await runWhatsAppSchedule(env);
  assert.match(sentMessages[0].text.body, /\/github create <name>/);
  await runWhatsAppSchedule(env);
  const code = /CONFIRM ([A-F0-9]{12})/.exec(sentMessages[1].text.body);
  assert.ok(code);
  const ownerHistory = [...env.CONFIG.values.entries()].find(([key]) => key.startsWith("whatsapp:history:"))[1];
  assert.doesNotMatch(ownerHistory, new RegExp(code[1]));
  assert.equal(githubCalls.some((call) => call.method === "POST" && call.pathname === "/user/repos"), false);

  batches[2] = [{ id: "wa-wrong-sender", from: "user:other", text: "CONFIRM " + code[1] }];
  await runWhatsAppSchedule(env);
  assert.match(sentMessages[2].text.body, /no active GitHub action/i);
  assert.equal(githubCalls.some((call) => call.method === "POST" && call.pathname === "/user/repos"), false);

  batches[3] = [{ id: "wa-confirm", from: "user:creator", text: "CONFIRM " + code[1] }];
  await runWhatsAppSchedule(env);
  assert.match(sentMessages[3].text.body, /Created private repository zia\/new-private-repo/);
  const savedHistory = [...env.CONFIG.values.entries()].filter(([key]) => key.startsWith("whatsapp:history:")).map((entry) => entry[1]).join("\n");
  assert.doesNotMatch(savedHistory, new RegExp(code[1]));
  const create = githubCalls.find((call) => call.method === "POST" && call.pathname === "/user/repos");
  assert.equal(create.body.name, "new-private-repo");
  assert.equal(create.body.private, true);
  assert.equal(create.body.auto_init, true);
});

test("lists owned repositories and creates a private repository", async () => {
  const env = makeEnv();
  const calls = installGitHubMock();
  const token = await signedIn(env);

  const listed = await worker.fetch(request("/api/github/repos", token), env);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).repositories[0].full_name, "zia/agent");

  const created = await worker.fetch(request("/api/github/repos", token, "POST", { name: "new-agent" }), env);
  assert.equal(created.status, 201);
  assert.equal(calls.find((call) => call.method === "POST" && call.pathname === "/user/repos").body.private, true);
  assert.equal(calls.find((call) => call.method === "POST" && call.pathname === "/user/repos").body.auto_init, true);
});

test("reads and commits text files with an explicit version id", async () => {
  const env = makeEnv();
  const calls = installGitHubMock();
  const token = await signedIn(env);

  const loaded = await worker.fetch(request("/api/github/file?repository=zia%2Fagent&path=README.md", token), env);
  assert.equal(loaded.status, 200);
  const file = await loaded.json();
  assert.equal(file.content, "hello\n");
  assert.equal(file.sha, "a".repeat(40));

  const saved = await worker.fetch(request("/api/github/file", token, "PUT", {
    repository: "zia/agent", path: "README.md", branch: "main", sha: file.sha, message: "Improve README", content: "updated\n",
  }), env);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).saved, true);
  const update = calls.find((call) => call.method === "PUT" && call.pathname.endsWith("/README.md"));
  assert.equal(Buffer.from(update.body.content, "base64").toString("utf8"), "updated\n");
});

test("rejects path traversal and oversized files", async () => {
  const env = makeEnv();
  installGitHubMock();
  const token = await signedIn(env);

  const traversal = await worker.fetch(request("/api/github/file", token, "PUT", {
    repository: "zia/agent", path: "../private.txt", message: "no", content: "x",
  }), env);
  assert.equal(traversal.status, 400);

  const oversized = await worker.fetch(request("/api/github/file", token, "PUT", {
    repository: "zia/agent", path: "big.txt", message: "too large", content: "x".repeat(96 * 1024 + 1),
  }), env);
  assert.equal(oversized.status, 400);
});

test("creates new files and dispatches a named deployment workflow", async () => {
  const env = makeEnv();
  const calls = installGitHubMock();
  const token = await signedIn(env);

  const created = await worker.fetch(request("/api/github/file", token, "PUT", {
    repository: "zia/agent", path: "new.md", message: "Add file", content: "new file",
  }), env);
  assert.equal(created.status, 200);

  const dispatched = await worker.fetch(request("/api/github/deploy", token, "POST", {
    repository: "zia/agent", workflow: "deploy.yml", branch: "main",
  }), env);
  assert.equal(dispatched.status, 200);
  assert.equal(calls.some((call) => call.method === "POST" && call.pathname.endsWith("/deploy.yml/dispatches")), true);
});
