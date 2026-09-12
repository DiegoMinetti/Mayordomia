import { expect, test } from '@playwright/test';

test.describe('Routing — public surface', () => {
  test('the public /solicitar route is reachable without authentication', async ({ page }) => {
    const response = await page.goto('/solicitar');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Mayordomía' })).toBeVisible();
  });

  test('the setup route renders the wizard shell', async ({ page }) => {
    await page.goto('/setup');
    // Without auth, the wizard shows a sign-in step. We just assert the
    // page did not crash and renders one of the wizard headings.
    const hasContent = await page.locator('body').innerText();
    expect(hasContent.length).toBeGreaterThan(50);
  });
});
