import { test, expect } from '@playwright/test';

test.describe('initial state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/save-the-date/');
  });

  test('enter screen renders with the Step Inside button', async ({ page }) => {
    await expect(page.locator('#enterScreen')).toBeAttached();
    await expect(page.locator('#enterScreen')).not.toHaveClass(/hide/);
    await expect(
      page.getByRole('button', { name: /step inside/i }),
    ).toBeVisible();
  });

  test('header text is present', async ({ page }) => {
    await expect(page.locator('.eover')).toContainText('A Love Story Begins');
  });

  test('reveal card has no .show class before entering', async ({ page }) => {
    await expect(page.locator('#revealScreen')).not.toHaveClass(/show/);
  });

  test('canvas element exists', async ({ page }) => {
    // Confirms useWisteriaTunnel mounted correctly in a real browser —
    // this is the one path that can't be verified under jsdom.
    await expect(page.locator('canvas#c')).toBeAttached();
  });
});

test.describe('full animation flow', () => {
  test('click → hide enter screen → show reveal card → unmount enter screen', async ({
    page,
  }) => {
    await page.goto('/save-the-date/');

    await page.getByRole('button', { name: /step inside/i }).click();

    // EnterScreen gets .hide immediately on click (opacity 0, pointer-events none).
    await expect(page.locator('#enterScreen')).toHaveClass(/hide/);

    // .show is added to #revealScreen at 2600ms — wait up to 6s.
    // Use class presence, not toBeVisible(): both divs always have layout
    // dimensions so opacity-0 elements pass Playwright's visibility check.
    await page.locator('#revealScreen.show').waitFor({ state: 'attached' });
    await expect(page.locator('#revealScreen')).toHaveClass(/show/);

    // EnterScreen unmounts from the DOM at ENTER_UNMOUNT_DELAY = 5900ms.
    await expect(page.locator('#enterScreen')).not.toBeAttached({
      timeout: 8_000,
    });
  });
});

test.describe('reveal card content', () => {
  // Single test: navigate + click + wait once, then assert everything.
  // Splitting into multiple tests would repeat the ~4s animation wait each time.
  test('shows names, date, copy, and RSVP link', async ({ page }) => {
    await page.goto('/save-the-date/');
    await page.getByRole('button', { name: /step inside/i }).click();
    await page.locator('#revealScreen.show').waitFor({ state: 'attached' });

    const card = page.locator('#revealScreen');

    await expect(card).toContainText('Please Save the Date');
    await expect(card.locator('.names')).toContainText('Shelley Shen');
    await expect(card.locator('.names')).toContainText('Patrick Tsui');
    await expect(card).toContainText('Are Getting Married');
    await expect(card.locator('.date')).toContainText('May 29, 2027');
    await expect(card).toContainText('Formal invitation to follow');
  });

  test('RSVP link has correct href, opens new tab with noopener', async ({
    page,
  }) => {
    await page.goto('/save-the-date/');
    await page.getByRole('button', { name: /step inside/i }).click();
    await page.locator('#revealScreen.show').waitFor({ state: 'attached' });

    const rsvp = page.getByRole('link', { name: /rsvp/i });
    await expect(rsvp).toHaveAttribute('href', 'https://forms.gle/onSKUD2gxz59Ybmw5');
    await expect(rsvp).toHaveAttribute('target', '_blank');
    await expect(rsvp).toHaveAttribute('rel', /noopener/);
  });
});

test.describe('reduced motion', () => {
  test('reveal card appears immediately and enter screen unmounts quickly', async ({
    page,
  }) => {
    // Must emulate BEFORE goto so App reads the media query with reduce active
    // on first render.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/save-the-date/');

    await page.getByRole('button', { name: /step inside/i }).click();

    // setShowReveal(true) fires synchronously on click — .show should appear
    // in well under 1s (just a React state flush + re-render).
    await expect(page.locator('#revealScreen')).toHaveClass(/show/, {
      timeout: 2_000,
    });

    // setEnterMounted(false) fires after 1500ms in the reduced-motion path.
    await expect(page.locator('#enterScreen')).not.toBeAttached({
      timeout: 4_000,
    });
  });
});
