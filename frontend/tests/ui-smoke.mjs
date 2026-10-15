// CI-only rendering smoke: uses local build artifacts and mocked API metadata.
// All non-local HTTP requests are blocked, including live deployment URLs.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
assert(process.env.UI_PLAYWRIGHT_ROOT, "Set UI_PLAYWRIGHT_ROOT to the isolated CI tooling directory");
const { chromium } = await import(pathToFileURL(path.join(process.env.UI_PLAYWRIGHT_ROOT, "playwright/index.mjs")));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const servers = [];

async function serve(directory, port, base = "") {
  const absolute = path.resolve(root, directory);
  const server = createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length);
      const file = path.resolve(absolute, "." + (pathname === "/" || !pathname ? "/index.html" : pathname));
      assert(file.startsWith(absolute + path.sep), "path outside build directory");
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise(resolve => server.listen(port, "127.0.0.1", resolve));
  servers.push(server);
}

await mkdir(path.join(root, "ui-artifacts"), { recursive: true });
let browser;
try {
  await serve("landing/dist", 4173, "/Agentic-Customer-Support-System");
  await serve("frontend/dist", 4174);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/meta") {
      return route.fulfill({ json: { auth_mode: "demo", model: "gemini", model_name: "test-model", demo: { data_ttl_hours: 24, session_ttl_s: 7200, transcript_retention_days: 90 } } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("http://127.0.0.1:4173/Agentic-Customer-Support-System/", { waitUntil: "networkidle" });
    assert.match(await page.title(), /Agentic Customer Support System/);
    const tabs = page.getByRole("tab");
    assert.equal(await tabs.count(), 4);
    for (let i = 0; i < 4; i++) {
      await tabs.nth(i).click();
      assert.equal(await tabs.nth(i).getAttribute("aria-selected"), "true");
    }
    await tabs.nth(0).click();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
    assert(await page.locator('a[href="https://github.com/yash-rai-93/Agentic-Customer-Support-System"]').count() > 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: path.join(root, `ui-artifacts/landing-${width}.png`), fullPage: true });
  }
  await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle" });
  assert(await page.locator("html").evaluate(el => el.classList.contains("dark")));
  await page.screenshot({ path: path.join(root, "ui-artifacts/welcome-dark.png"), fullPage: true });
  await page.evaluate(() => localStorage.setItem("acme.theme", "light"));
  await page.reload({ waitUntil: "networkidle" });
  assert(!(await page.locator("html").evaluate(el => el.classList.contains("dark"))));
  await page.screenshot({ path: path.join(root, "ui-artifacts/welcome-light.png"), fullPage: true });
  assert.deepEqual(errors, [], "browser runtime errors");
  console.log("PASS: landing desktop/mobile, four trace tabs and keyboard navigation, own repo links, saved chat theme, no runtime errors; external HTTP blocked");
} finally {
  if (browser) await browser.close();
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
}
