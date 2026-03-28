const http = require("http");
const next = require("next");
const { parse } = require("url");

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeIncomingUrl(raw) {
  if (raw == null || raw === "") return "/";
  let value = String(raw).trim();
  if (value.startsWith("?")) value = `/${value}`;
  if (!value.startsWith("/")) value = `/${value}`;
  return value;
}

function normalizePathname(pathname) {
  let value = pathname || "/";
  if (!value.startsWith("/")) value = `/${value}`;
  return value.replace(/\/{2,}/g, "/") || "/";
}

function isEmbeddedAdminRequest(query) {
  if (!query || typeof query !== "object") return false;
  return (
    String(query.embedded || "") === "1" ||
    Boolean(query.hmac) ||
    Boolean(query.host) ||
    Boolean(query.id_token) ||
    /\.myshopify\.com$/i.test(String(query.shop || ""))
  );
}

function buildAppUrl(pathname, query) {
  const params = new URLSearchParams();
  if (query?.shop) params.set("shop", String(query.shop));
  if (query?.host) params.set("host", String(query.host));
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

app.prepare().then(() => {
  http
    .createServer((req, res) => {
      const requestId = (req.headers["x-request-id"] || makeRequestId()).toString();
      res.setHeader("X-Request-Id", requestId);

      try {
        const requestUrl = normalizeIncomingUrl(req.url || "/");
        const parsedUrl = parse(requestUrl, true);
        const pathname = normalizePathname(parsedUrl.pathname || "/");

        if (pathname === "/api/debug/health") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: true,
              requestId,
              rawUrl: requestUrl,
              pathname,
              time: new Date().toISOString(),
            })
          );
          return;
        }

        if (req.method === "GET" && pathname === "/" && isEmbeddedAdminRequest(parsedUrl.query)) {
          res.statusCode = 302;
          res.setHeader("Location", buildAppUrl("/dashboard", parsedUrl.query));
          res.end();
          return;
        }

        req.url = pathname;
        req.headers["x-request-id"] = requestId;
        return handle(req, res, { pathname, query: parsedUrl.query });
      } catch (error) {
        console.error(error && error.stack ? error.stack : error);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        res.end("Internal Server Error");
      }
    })
    .listen(port, () => {
      console.error(`custom-server: listening on http://localhost:${port}`);
    });
});
