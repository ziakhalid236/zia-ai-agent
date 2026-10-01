import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./worker-zia.js", import.meta.url), "utf8");
const { default: worker } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const API_TOKEN = "a".repeat(48);

function makeKV() {
  const values = new Map();
  return {
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
