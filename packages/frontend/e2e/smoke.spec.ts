import { expect, test } from '@playwright/test';

test('landing page renders the product proposition', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /raw MEG recording to an interpretable/i }),
  ).toBeVisible();
  await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('protected routes redirect to the sign-in page', async ({ page }) => {
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('the application shell renders for a session cookie', async ({ page, context }) => {
  // Use base64 encoding for user cookie (matches encodeSessionUserHint in session.ts)
  const userCookieValue = Buffer.from(
    JSON.stringify({ displayName: 'Researcher', email: 'r@example.com' }),
  ).toString('base64');

  await context.addCookies([
    { name: 'meg-lab_session', value: 'mock-access-token', url: 'http://127.0.0.1:3100' },
    {
      name: 'meg-lab_user',
      value: userCookieValue,
      url: 'http://127.0.0.1:3100',
    },
  ]);

  await page.goto('/app');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: /Welcome back, Researcher/ })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
});

test('project list links to the project detail view', async ({ page, context }) => {
  const userCookieValue = Buffer.from(
    JSON.stringify({ displayName: 'Researcher', email: 'r@example.com' }),
  ).toString('base64');
  await context.addCookies([
    { name: 'meg-lab_session', value: 'mock-access-token', url: 'http://127.0.0.1:3100' },
    { name: 'meg-lab_user', value: userCookieValue, url: 'http://127.0.0.1:3100' },
  ]);

  await page.goto('/app/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('link', { name: 'Auditory Evoked Fields' }).click();
  await expect(page).toHaveURL(/\/app\/projects\/proj_001$/);
  await expect(page.getByRole('heading', { name: 'Auditory Evoked Fields' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
});

test('project detail exposes owner membership controls', async ({ page, context }) => {
  const userCookieValue = Buffer.from(
    JSON.stringify({ displayName: 'Researcher', email: 'r@example.com' }),
  ).toString('base64');
  await context.addCookies([
    { name: 'meg-lab_session', value: 'mock-access-token', url: 'http://127.0.0.1:3100' },
    { name: 'meg-lab_user', value: userCookieValue, url: 'http://127.0.0.1:3100' },
  ]);

  await page.goto('/app/projects/proj_001');
  await expect(page.getByRole('heading', { name: 'Members', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add member', exact: true })).toBeVisible();
});
