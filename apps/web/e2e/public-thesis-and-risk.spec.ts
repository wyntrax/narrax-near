import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:4010';
const skipPublicLive = !process.env.E2E_PUBLIC_LIVE;

test.describe('public thesis desk and agent risk gate E2E', () => {
  test.skip(skipPublicLive, 'Set E2E_PUBLIC_LIVE=1 with dev:api:public (:4000) and web (:4010) running.');

  for (const width of [1440, 390]) {
    test(`renders /, /thesis, and /agent-risk without overflow or WCAG violations (${width}px)`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 1000 });

      // 1. Landing page snapshot
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('link', { name: 'Thesis desk' }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);

      // 2. Keyless public thesis desk -> links to agent risk gate
      await page.goto(`${baseUrl}/thesis`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Public thesis desk' })).toBeVisible();
      await expect(page.getByText('NEARLY', { exact: true })).toBeVisible();
      await expect(page.getByText('Meets floors')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);

      // 3. Click into /agent-risk?mint=nearly-993927.nearlytrade.near and verify PASS
      const riskLink = page.getByRole('link', { name: 'Run risk gate →' }).first();
      await Promise.all([
        page.waitForURL(/\/agent-risk\?mint=/),
        riskLink.click(),
      ]);
      await expect(page.locator('.agent-risk-verdict')).toHaveAttribute('data-verdict', 'PASS', { timeout: 30_000 });
      await expect(page.locator('.agent-risk-verdict').getByText('Verified', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);

      // 4. Scenario preset BLOCK (non-NEP-141 contract social.near)
      await page.getByRole('button', { name: 'BLOCK · Non-NEP-141 contract' }).click();
      await expect(page.locator('.agent-risk-verdict')).toHaveAttribute('data-verdict', 'BLOCK', { timeout: 30_000 });
      await expect(page.getByText('NOT_NEP141_CONTRACT')).toBeVisible();

      // 5. Scenario preset UNKNOWN (uncatalogued missing token)
      await page.getByRole('button', { name: 'UNKNOWN · Unverified token' }).click();
      await expect(page.locator('.agent-risk-verdict')).toHaveAttribute('data-verdict', 'UNKNOWN', { timeout: 30_000 });
      await expect(page.getByText('TOKEN_NOT_FOUND')).toBeVisible();
    });
  }
});
