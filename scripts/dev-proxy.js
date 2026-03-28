const fs = require("fs");
const path = require("path");
const dns = require("dns").promises;
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const projectRoot = path.join(__dirname, "..");
const tomlPath = path.join(projectRoot, "shopify.app.toml");

function normalizeProxyUrl(rawUrl) {
  if (!rawUrl) return "";
  let value = String(rawUrl).trim();
  if (!value) return "";
  if (!/^https:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);
    const hasExplicitPortInInput = /:\d+(?:\/|$)/.test(value);
    const port = parsed.port || (hasExplicitPortInInput ? "443" : "443");
    return `${parsed.protocol}//${parsed.hostname}:${port}`;
  } catch (_error) {
    return "";
  }
}

function updateTomlProxy(urlWithPort) {
  if (!fs.existsSync(tomlPath)) {
    throw new Error("shopify.app.toml not found");
  }
  const redirectUrl = `${urlWithPort}/auth/callback`;
  let content = fs.readFileSync(tomlPath, "utf8");

  content = content.replace(/^application_url\s*=\s*".*"$/m, `application_url = "${urlWithPort}"`);
  content = content.replace(
    /\[auth\][\s\S]*?redirect_urls\s*=\s*\[[\s\S]*?\]/m,
    `[auth]\nredirect_urls = [\n  "${redirectUrl}"\n]`
  );

  fs.writeFileSync(tomlPath, content, "utf8");
}

function runShopifyDev(urlWithPort) {
  const args = ["app", "dev", "--config", "shopify.app.toml", "--verbose"];
  if (urlWithPort) {
    args.push("--tunnel-url", urlWithPort);
  }
  const shopifyCommand = process.platform === "win32" ? "shopify.cmd" : "shopify";
  const child = spawn(shopifyCommand, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

async function isDnsResolvable(urlWithPort) {
  try {
    const hostname = new URL(urlWithPort).hostname;
    await dns.lookup(hostname);
    return true;
  } catch (_error) {
    return false;
  }
}

async function main() {
  const normalized = normalizeProxyUrl(process.env.SHOPIFY_PROXY_URL || "");
  if (!normalized) {
    console.error("dev-proxy: no fixed proxy configured, falling back to Shopify-managed tunnel");
    runShopifyDev("");
    return;
  }

  const resolvable = await isDnsResolvable(normalized);
  if (!resolvable) {
    console.error(`dev-proxy: proxy DNS is not resolvable (${normalized})`);
    console.error("dev-proxy: falling back to Shopify-managed tunnel for this run");
    runShopifyDev("");
    return;
  }

  try {
    updateTomlProxy(normalized);
    console.error(`dev-proxy: using fixed proxy ${normalized}`);
    runShopifyDev(normalized);
  } catch (error) {
    console.error(`dev-proxy: failed to update toml (${error.message})`);
    process.exit(1);
  }
}

main();
