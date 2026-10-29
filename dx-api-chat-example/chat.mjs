import { pathToFileURL } from "node:url";

export class DemoError extends Error {}

function required(env, name) {
  const value = env[name]?.trim();
  if (!value) throw new DemoError(`Set ${name} from your console before running.`);
  return value;
}

export function readConfig(env = process.env) {
  const base = required(env, "DX_API_BASE_URL");
  const apiKey = required(env, "DX_API_KEY");
  const model = required(env, "DX_API_MODEL");
  let endpoint;
  try {
    endpoint = new URL(base);
  } catch {
    throw new DemoError("DX_API_BASE_URL must be an absolute API base URL.");
  }
  const loopback = ["127.0.0.1", "[::1]", "localhost"].includes(endpoint.hostname);
  if (endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" && loopback)) {
    throw new DemoError("Use HTTPS; HTTP is allowed only for a local loopback mock.");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new DemoError("The API base URL must not contain credentials, a query, or a fragment.");
  }
  const basePath = endpoint.pathname.replace(/\/+$/, "");
  if (basePath.endsWith("/chat/completions")) {
    throw new DemoError("Set the API base URL, without the /chat/completions suffix.");
  }
  endpoint.pathname = `${basePath}/chat/completions`;
  const timeoutMs = Number(env.DX_API_TIMEOUT_MS ?? "60000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) {
    throw new DemoError("DX_API_TIMEOUT_MS must be an integer from 1 to 600000.");
  }
  return { endpoint, apiKey, model, timeoutMs };
}

function httpHint(status) {
  if (status === 401 || status === 403) return "Check the key, group, and model permissions.";
  if (status === 404) return "Check the console API base URL and Chat Completions support.";
  if (status === 429) return "Check rate limits, balance, and group quota before retrying.";
  if (status === 400 || status === 422) return "Check the model and this channel's request format.";
  if (status >= 500) return "The gateway or upstream failed; check service status.";
  return "Check the console and this channel's documentation.";
}

export async function chat(config, prompt) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new DemoError('Provide one message: node chat.mjs "Your question"');
  }
  const signal = AbortSignal.timeout(config.timeoutMs);
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      redirect: "error",
      signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new DemoError(`HTTP ${response.status}. ${httpHint(response.status)}`);
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (signal.aborted) throw error;
      throw new DemoError("The server returned a non-JSON response; check the API base URL.");
    }
    const message = data?.choices?.[0]?.message;
    const text = message?.content;
    const refusal = message?.refusal;
    if (typeof text !== "string" && typeof refusal !== "string") {
      throw new DemoError("No text answer was returned. This example supports text chat only.");
    }
    return {
      model: typeof data.model === "string" ? data.model : config.model,
      text: text ?? refusal,
      usage: data.usage ?? null,
    };
  } catch (error) {
    if (error instanceof DemoError) throw error;
    if (signal.aborted) {
      throw new DemoError(`Timed out after ${config.timeoutMs} ms. No automatic retry was made.`);
    }
    throw new DemoError("Network request failed or a redirect was blocked. Check the API URL and network.");
  }
}

function tokenCount(value) {
  return Number.isInteger(value) && value >= 0 ? String(value) : "not returned";
}

export function formatResult(result) {
  return [
    `Model: ${result.model}`,
    "",
    result.text,
    "",
    `Input tokens: ${tokenCount(result.usage?.prompt_tokens)}`,
    `Output tokens: ${tokenCount(result.usage?.completion_tokens)}`,
    `Total tokens: ${tokenCount(result.usage?.total_tokens)}`,
    "Usage is reported by the server; billing is determined by the console.",
  ].join("\n");
}

async function main() {
  try {
    const prompt = process.argv.slice(2).join(" ");
    if (!prompt.trim()) throw new DemoError('Usage: node chat.mjs "Your question"');
    const result = await chat(readConfig(), prompt);
    console.log(formatResult(result));
  } catch (error) {
    console.error(`Error: ${error instanceof DemoError ? error.message : "Unexpected local error."}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
