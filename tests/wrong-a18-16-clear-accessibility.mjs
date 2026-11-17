// A18-16: read-only accessibility observation, never triggers destructive actions.
// Run: npm install --no-save playwright@1.56.1 && node tests/wrong-a18-16-clear-accessibility.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const url = process.env.QA_URL || 'http://127.0.0.1:8765/index.html';
const out = process.env.QA_OUT || 'artifacts/a18-16';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const observation = await page.evaluate(() => {
      const btn = document.querySelector('#clear-all');
      if (!btn) return { found: false };
      const css = getComputedStyle(btn);
      const focusBefore = document.activeElement?.id || document.activeElement?.tagName;
      btn.focus();
      const focusable = document.activeElement === btn;
      const role = btn.getAttribute('role') || (btn.tagName === 'BUTTON' ? 'button' : '');
      const accessibleName = btn.getAttribute('aria-label') || btn.textContent?.trim() || '';
      const ariaDisabled = btn.getAttribute('aria-disabled');
      const disabled = btn.hasAttribute('disabled');
      const warningCandidates = [...document.querySelectorAll('[role="alert"],[role="status"],[aria-live]')]
        .map(el => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live'), text: el.textContent?.trim().slice(0, 160) }));
      return { found: true, tag: btn.tagName, role, accessibleName, focusBefore, focusable,
        disabled, ariaDisabled, display: css.display, visibility: css.visibility,
        warningCandidates, note: 'Read-only snapshot. No clear click or IndexedDB write attempted.' };
    });
    await page.screenshot({ path: path.join(out, `clear-a11y-${width}.png`), fullPage: true });
    results.push({ width, url, observation });
    await context.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, 'observation.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
