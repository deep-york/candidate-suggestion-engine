import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Resume upload', () => {
  test('uploads a PDF and shows processing status', async ({ page }) => {
    await page.goto('/candidates');

    const uploadInput = page.locator('input[type="file"]');
    await uploadInput.setInputFiles(
      path.resolve(__dirname, 'fixtures/sample.pdf'),
    );

    await expect(
      page.getByText(/uploading|processing/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
