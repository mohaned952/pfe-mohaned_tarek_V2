const { test, expect } = require('@playwright/test');

test('portal home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Access Portal')).toBeVisible();
});
