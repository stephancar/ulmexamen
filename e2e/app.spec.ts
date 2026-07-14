import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('dashboard', () => {
  test('shows all seven subjects with stats and actions', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.card')).toHaveCount(7);
    await expect(page.locator('#card-wetgeving')).toContainText('Luchtvaartwetgeving');
    await expect(page.locator('#card-wetgeving .badge')).toHaveText('DGLV-examen');
    await expect(page.locator('#card-aerodynamica .badge')).toHaveText('schooltheorie');
    await expect(page.locator('#btn-examendag')).toBeVisible();
  });
});

test.describe('leermodus', () => {
  test('gives instant feedback with explanation and updates progress', async ({ page }) => {
    await page.goto('/#/leer/meteo');
    await expect(page.locator('h1')).toContainText('Leren — Meteorologie');
    await page.selectOption('#sel-count', '10');
    await page.click('#btn-start-leren');

    await expect(page.locator('#session')).toBeVisible();
    await page.click('.option >> nth=0');
    // feedback: one option marked correct, explanation visible
    await expect(page.locator('.option.correct')).toHaveCount(1);
    await expect(page.locator('.explain')).toBeVisible();
    await page.click('#btn-next');
    await expect(page.locator('.session-head')).toContainText('Vraag 2');

    // progress persisted on the dashboard
    await page.goto('/#/');
    await expect(page.locator('#card-meteo')).toContainText('recent');
  });

  test('flagging a question persists', async ({ page }) => {
    await page.goto('/#/leer/wetgeving');
    await page.click('#btn-start-leren');
    await page.click('#btn-flag');
    await expect(page.locator('#btn-flag')).toHaveClass(/on/);
    await page.reload();
    await expect(page.locator('text=alleen gemarkeerde')).toBeVisible();
  });
});

async function completeExam(page: Page): Promise<void> {
  const count = await page.locator('.dots button').count();
  for (let i = 0; i < count; i++) {
    await page.click('.option >> nth=0');
    if (i < count - 1) await page.click('#btn-next');
  }
  await page.click('#btn-submit');
}

test.describe('examensimulatie', () => {
  test('runs the official format with timer and grades the result', async ({ page }) => {
    await page.goto('/#/examen/mens');
    await expect(page.locator('.result-box')).toContainText('10 vragen');
    await expect(page.locator('.result-box')).toContainText('20 minuten');
    await page.click('#btn-start-examen');

    await expect(page.locator('#timer')).toContainText(':');
    await expect(page.locator('.dots button')).toHaveCount(10);
    // no instant feedback in exam mode
    await page.click('.option >> nth=1');
    await expect(page.locator('.option.correct')).toHaveCount(0);
    await expect(page.locator('.explain')).toHaveCount(0);

    await completeExam(page);

    await expect(page.locator('#result')).toContainText('%');
    await expect(page.locator('#result-verdict')).toContainText(/Geslaagd|Niet geslaagd/);
    await expect(page.locator('.review-item')).toHaveCount(10);

    // sim recorded on the dashboard
    await page.goto('/#/');
    await expect(page.locator('#card-mens .simdot')).toHaveCount(1);
  });

  test('submitting with open questions asks for confirmation', async ({ page }) => {
    await page.goto('/#/examen/communicatie');
    await page.click('#btn-start-examen');
    let confirmed = false;
    page.on('dialog', (d) => {
      confirmed = d.message().includes('onbeantwoorde');
      void d.dismiss();
    });
    await page.click('#btn-submit');
    expect(confirmed).toBe(true);
    // still in the exam
    await expect(page.locator('#timer')).toBeVisible();
  });
});

test.describe('zwakke punten & persistentie', () => {
  test('weak-point session starts across subjects', async ({ page }) => {
    await page.goto('/#/zwak');
    await expect(page.locator('.session-head')).toContainText('Zwakke punten');
    await expect(page.locator('#session')).toBeVisible();
  });

  test('progress survives a reload', async ({ page }) => {
    await page.goto('/#/leer/techniek');
    await page.click('#btn-start-leren');
    await page.click('.option >> nth=0');
    await page.reload();
    await page.goto('/#/');
    await expect(page.locator('#card-techniek')).toContainText('recent');
  });
});

test.describe('eigen vragen', () => {
  test('import via example JSON adds a custom question', async ({ page }) => {
    await page.goto('/#/import');
    await page.click('#btn-voorbeeld');
    await page.click('#btn-import');
    await expect(page.locator('#import-ok')).toContainText('1 vra');
    // learn setup for meteo now counts one extra question
    await page.goto('/#/leer/meteo');
    await expect(page.locator('text=51 vragen beschikbaar')).toBeVisible();
  });

  test('rejects malformed JSON with a readable error', async ({ page }) => {
    await page.goto('/#/import');
    await page.fill('#import-json', '{"nope": true}');
    await page.click('#btn-import');
    await expect(page.locator('.notice.err')).toContainText('lijst van vragen');
  });
});

