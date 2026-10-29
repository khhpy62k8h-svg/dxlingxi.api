import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chat, formatResult, readConfig } from "../chat.mjs";

const fakeKey = "mock-only-not-a-real-key";
let server;
let origin;
const requests = [];

before(async () => {
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    requests.push({ url: req.url, method: req.method, headers: req.headers, raw });
    res.setHeader("Content-Type", "application/json");
    const reply = (body) => res.end(JSON.stringify(body));
    if (req.url === "/limited/chat/completions") {
      res.writeHead(429);
      return reply({ error: { message: `Echoed credential: ${fakeKey}` } });
    }
    if (req.url === "/invalid-json/chat/completions") return res.end("<html>not an API</html>");
    if (req.url === "/tool-only/chat/completions") {
      return reply({ choices: [{ message: { content: null, tool_calls: [] } }] });
    }
    if (req.url === "/slow/chat/completions") {
      const timer = setTimeout(() => reply({ choices: [] }), 300);
      res.on("close", () => clearTimeout(timer));
      return;
    }
    if (req.url === "/redirect/chat/completions") {
      res.writeHead(307, { Location: `${origin}/tenant/v1/chat/completions` });
      return res.end();
    }
    reply({
      model: "mock-chat",
      choices: [{ message: { role: "assistant", content: "Local mock answer." } }],
      ...(req.url === "/no-usage/chat/completions" ? {} : {
        usage: { prompt_tokens: 7, completion_tokens: 5, total_tokens: 12 },
      }),
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function config(path = "/tenant/v1/", extra = {}) {
  return readConfig({
    DX_API_BASE_URL: `${origin}${path}`,
    DX_API_KEY: fakeKey,
    DX_API_MODEL: "mock-chat",
    ...extra,
  });
}

test("real local HTTP request preserves the API base and non-streaming chat contract", async () => {
  const result = await chat(config(), "Hello local mock");
  const request = requests.at(-1);
  assert.equal(request.url, "/tenant/v1/chat/completions");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.authorization, `Bearer ${fakeKey}`);
  assert.equal(request.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(request.raw), {
    model: "mock-chat",
    messages: [{ role: "user", content: "Hello local mock" }],
    stream: false,
  });
  assert.equal(result.text, "Local mock answer.");
  assert.match(formatResult(result), /Input tokens: 7\nOutput tokens: 5\nTotal tokens: 12/);
});

test("CLI exits nonzero on HTTP 429 and never echoes a server error body containing the key", async () => {
  const output = await new Promise((resolve) => {
    execFile(process.execPath, [fileURLToPath(new URL("../chat.mjs", import.meta.url)), "mock"], {
      env: {
        ...process.env,
        DX_API_BASE_URL: `${origin}/limited`,
        DX_API_KEY: fakeKey,
        DX_API_MODEL: "mock-chat",
        DX_API_TIMEOUT_MS: "5000",
      },
    }, (error, stdout, stderr) => resolve({ error, stdout, stderr }));
  });
  assert.equal(output.error?.code, 1);
  assert.match(output.stderr, /HTTP 429/);
  assert.equal(output.stdout, "");
  assert.ok(!output.stderr.includes(fakeKey));
});

test("a timeout fails promptly without an automatic second request", async () => {
  const count = requests.length;
  await assert.rejects(chat(config("/slow", { DX_API_TIMEOUT_MS: "30" }), "mock"), /Timed out/);
  assert.equal(requests.length, count + 1);
});

test("a non-JSON success response is rejected", async () => {
  await assert.rejects(chat(config("/invalid-json"), "mock"), /non-JSON/);
});

test("a tool-only response is not printed as a text answer", async () => {
  await assert.rejects(chat(config("/tool-only"), "mock"), /text answer/);
});

test("missing usage stays unknown instead of inventing token totals", async () => {
  const result = await chat(config("/no-usage"), "mock");
  assert.equal(result.usage, null);
  assert.match(formatResult(result), /Total tokens: not returned/);
});

test("redirects are blocked without forwarding a second authenticated request", async () => {
  const count = requests.length;
  await assert.rejects(chat(config("/redirect"), "mock"), /redirect was blocked/);
  assert.equal(requests.length, count + 1);
});

test("missing required settings, unsafe URLs, and invalid timeouts fail before any request", () => {
  const count = requests.length;
  for (const name of ["DX_API_BASE_URL", "DX_API_KEY", "DX_API_MODEL"]) {
    assert.throws(() => config("/", { [name]: "" }), new RegExp(name));
  }
  assert.throws(() => config("/", { DX_API_BASE_URL: "http://example.test/v1" }), /HTTPS/);
  assert.throws(() => config("/", { DX_API_BASE_URL: "https://example.test/v1?key=bad" }), /query/);
  assert.throws(() => config("/", { DX_API_TIMEOUT_MS: "NaN" }), /integer/);
  assert.throws(() => config("/v1/chat/completions"), /suffix/);
  assert.equal(requests.length, count);
});
