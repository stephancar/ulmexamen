import { devices, expect, test } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('mobiel (Pixel 7)', () => {
  test('dashboard and a learn session work on a phone', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(7);
    await page.screenshot({ path: 'test-results/shots/mobile-dashboard.png' });
    await page.goto('/#/leer/navigatie');
    await page.click('#btn-start-leren');
    await page.click('.option >> nth=2');
    await expect(page.locator('.explain')).toBeVisible();
    await page.screenshot({ path: 'test-results/shots/mobile-leer.png' });
  });

  test('an exam runs comfortably on a phone', async ({ page }) => {
    await page.goto('/#/examen/communicatie');
    await page.click('#btn-start-examen');
    await expect(page.locator('#timer')).toBeVisible();
    await page.click('.option >> nth=0');
    await page.screenshot({ path: 'test-results/shots/mobile-examen.png' });
  });
});
