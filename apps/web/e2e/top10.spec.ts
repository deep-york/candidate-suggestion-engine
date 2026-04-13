import { test, expect } from '@playwright/test';

// This test requires the DB to be pre-seeded with candidates and a job.
// In CI, use docker-compose.test.yml which seeds the DB via init.sql.
const SEEDED_JOB_ID = process.env.TEST_JOB_ID ?? '';

test.describe('Top-10 ranking', () => {
  test.skip(!SEEDED_JOB_ID, 'TEST_JOB_ID not set — skipping seeded match test');

  test('displays exactly 10 ranked candidate cards', async ({ page }) => {
    await page.goto('/jobs');

    // Select the seeded job
    const jobButton = page.locator(`button[data-job-id="${SEEDED_JOB_ID}"]`);
    await jobButton.click();

    await page.getByTestId('run-match').click();
    await expect(page.getByText(/matching in progress/i)).toBeVisible();

    const cards = page.getByTestId('candidate-rank-card');
    await expect(cards).toHaveCount(10, { timeout: 60_000 });

    for (let i = 1; i <= 10; i++) {
      await expect(
        cards.nth(i - 1).getByTestId('rank'),
      ).toHaveText(String(i));
    }
  });
});
