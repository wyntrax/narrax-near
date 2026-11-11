import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('../../docs/screenshots');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4010/agent-risk', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Use example' }).click();
  await page.getByText('PASS', { exact: true }).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: resolve(out, 'agent-risk-pass.png'), fullPage: true });

  const input = page.locator('#agent-risk-mint');
  await input.fill('unknown-token.near');
  await page.getByRole('button', { name: 'Check token' }).click();
  await page.getByText('UNKNOWN', { exact: true }).waitFor({ timeout: 30_000 });
  await page.screenshot({ path: resolve(out, 'agent-risk-unknown.png'), fullPage: true });

  const landing = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await landing.goto('http://localhost:4010/', { waitUntil: 'networkidle' });
  await landing.screenshot({ path: resolve(out, 'landing.png'), fullPage: false });
} finally {
  await browser.close();
}
