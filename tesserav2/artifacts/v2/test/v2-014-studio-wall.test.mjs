import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright-core";
import { listenStudio } from "../src/studio/wall.mjs";

test("posting a goal puts task cards on the wall", async () => {
  const { server, url } = await listenStudio();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.fill("#goal", "Draw the task wall");
    await page.click("#post-goal");
    await page.waitForSelector(".task-card");
    const titles = await page.locator(".task-card").allTextContents();
    assert.equal(titles.length, 2);
    assert.ok(titles.some((title) => title.includes("Draw the task wall")));
    assert.ok((await page.locator(".desk").count()) >= 2);
    assert.ok((await page.locator(".lamp").count()) >= 2);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
