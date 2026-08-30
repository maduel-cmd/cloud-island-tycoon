import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const out = '/opt/cursor/artifacts/qa-sky-park-memory-20260829';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:5175/', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

// dismiss welcome overlay
for (const name of ['התחל לבנות', 'יאללה בונים', 'סגור', 'המשך', 'בואו נתחיל', 'הבנתי']) {
  const b = page.getByRole('button', { name });
  if (await b.count()) {
    await b.first().click({ force: true }).catch(()=>{});
    await page.waitForTimeout(200);
  }
}
// click any button inside z-60 overlay
const overlayBtn = page.locator('div.z-\\[60\\] button, [class*="z-[60]"] button').first();
if (await overlayBtn.count()) {
  await overlayBtn.click({ force: true }).catch(async () => {
    await page.locator('.absolute.inset-0.z-\\[60\\] button').first().click({ force: true }).catch(()=>{});
  });
}
await page.waitForTimeout(300);
// nuke overlay if still present
await page.evaluate(() => {
  document.querySelectorAll('[class*="z-[60]"]').forEach((el) => el.remove());
});

await page.getByRole('button', { name: 'בנייה' }).first().click();
await page.waitForTimeout(200);
await page.locator('[data-testid="build-cat-path"]:visible').click();
await page.waitForTimeout(150);
const canvas = page.locator('canvas');
const box = await canvas.boundingBox();
async function clickFrac(fx, fy) {
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(100);
}
for (const p of [[0.42,0.52],[0.45,0.50],[0.48,0.48],[0.50,0.46],[0.52,0.44],[0.54,0.42],[0.56,0.40]]) {
  await clickFrac(...p);
}

await page.locator('[data-testid="build-cat-stall"]:visible').click();
await page.waitForTimeout(200);
const balloon = page.locator('[data-testid="stall-card-balloon_vendor"]:visible');
console.log('balloon', await balloon.isVisible(), await balloon.innerText().catch(()=>''));
await balloon.click();
await page.waitForTimeout(200);
for (const p of [[0.55,0.42],[0.56,0.44],[0.53,0.45],[0.58,0.40],[0.50,0.48]]) {
  await clickFrac(...p);
}
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, 'C-balloon-placed.png') });
const text = await page.locator('body').innerText();
fs.writeFileSync(path.join(out, 'C-place-notes.txt'), text.slice(0, 1200));
console.log('cash line', text.match(/₪[\d,]+/g)?.slice(0,5));
await browser.close();
