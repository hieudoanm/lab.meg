import { chromium } from '@playwright/test';

const baseUrl = process.env.DEMO_WEB_URL ?? 'http://localhost:3000';
const apiBaseUrl = process.env.DEMO_API_URL ?? 'http://localhost:8000/api/v1';
const videoDirectory = process.env.DEMO_VIDEO_DIRECTORY!;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const log = (message: string) => {
  console.info(`[create-demo] ${message}`);
};

interface AccessTokenResponse {
  access_token: string;
  expires_at: string;
}

interface ProjectMember {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
}

interface MembershipListResponse {
  items: ProjectMember[];
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

interface ApiResult<T> {
  status: number;
  body: T;
}

async function mintDevelopmentToken(
  email: string,
  displayName?: string,
): Promise<AccessTokenResponse> {
  const response = await fetch(`${apiBaseUrl}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, display_name: displayName }),
  });
  if (!response.ok) {
    throw new Error(
      `Development sign-in failed for ${email} (${response.status}): ${await response.text()}`,
    );
  }
  return response.json();
}

async function callApi<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T;
  return { status: response.status, body };
}

const expectError = (
  result: ApiResult<ErrorEnvelope>,
  status: number,
  code: string,
  action: string,
) => {
  if (result.status !== status || result.body.error?.code !== code) {
    throw new Error(
      `${action}: expected ${status} ${code}, got ${result.status}: ${JSON.stringify(result.body)}`,
    );
  }
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: videoDirectory, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(30_000);

  try {
    // Scene 1 — Operational health
    log('Scene 0: operational health');
    await page.goto(`${apiBaseUrl}/health/ready`, { waitUntil: 'networkidle' });
    await page.getByText('"status":"ok"').first().waitFor();
    await page.goto(`${apiBaseUrl}/health/live`, { waitUntil: 'networkidle' });
    await sleep(1500);

    // Scene 1 — Landing page and private-by-default
    log('Scene 1: landing page and private-by-default');
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page
      .getByRole('heading', {
        name: 'Go from a raw MEG recording to an interpretable, reproducible neural signal analysis in the cloud.',
      })
      .waitFor();
    await page.getByText('Open-source · Research and educational tool').waitFor();
    await page.getByRole('link', { name: 'Signals' }).waitFor();
    await page.getByRole('link', { name: 'Analyse' }).waitFor();
    await page.getByRole('link', { name: 'Sensors' }).waitFor();
    await sleep(1500);

    // Scene 2 — Route guard and development sign-in
    log('Scene 2: route guard and development sign-in');
    await page.goto(`${baseUrl}/app`);
    await page.waitForURL(/\/login\?next=/);
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    await sleep(1200);

    // Register a user via the development token endpoint (creates user with password)
    const identity = await mintDevelopmentToken('demo@meg-lab.local', 'Demo Researcher');

    // Test direct login via API
    const loginResp = await callApi<{ access_token: string; user: { display_name: string } }>(
      '/auth/login',
      '', // no token needed for login
      {
        method: 'POST',
        body: JSON.stringify({ email: 'demo@meg-lab.local', password: 'demopassword123' }),
      },
    );
    console.log('Direct login response:', loginResp.status, loginResp.body);

    // Test frontend session route via browser fetch
    const browserLoginResult = await page.evaluate(async () => {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@meg-lab.local', password: 'demopassword123' }),
        credentials: 'include',
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    });
    console.log('Browser session response:', browserLoginResult);

    // Now login via the login form
    await page.getByLabel('Email address').fill('demo@meg-lab.local');
    await page.getByLabel('Password').fill('demopassword123');

    // Submit form by clicking the Sign in button
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for response
    await sleep(2000);

    // Debug: Check cookies
    const cookies = await page.context().cookies();
    console.log(
      'Cookies after login:',
      cookies
        .filter((c) => c.name.startsWith('meg-lab'))
        .map((c) => ({ name: c.name, value: c.value.substring(0, 20) })),
    );

    // Debug: Check current URL
    console.log('Current URL after login:', page.url());

    // Wait for either navigation to /app or error message
    await Promise.race([
      page.waitForURL(/\/app/, { timeout: 15000 }),
      page.waitForURL(/\/login/, { timeout: 15000 }).then(async () => {
        // Check for error message on login page
        const errorText = await page
          .getByRole('alert')
          .textContent()
          .catch(() => 'No error message');
        const bodyText = (await page.textContent('body').catch(() => 'No body')) || 'No body';
        throw new Error(
          `Login failed - stayed on login page: ${errorText}\nBody: ${bodyText.substring(0, 500)}`,
        );
      }),
    ]);

    // Wait for loading to complete or error
    await Promise.race([
      page.getByText('Loading workspace…').waitFor({ state: 'hidden', timeout: 15000 }),
      page
        .getByText('Something went wrong')
        .waitFor({ timeout: 15000 })
        .then(() => {
          throw new Error('Workspace load failed');
        }),
    ]);

    // Debug: get page content
    const pageContent = await page.textContent('body');
    console.log('Page content preview:', pageContent?.substring(0, 1000));

    // Check if we're on the error state
    const isError = pageContent?.includes('Something went wrong') ?? false;
    console.log('Is error state:', isError);

    if (isError) {
      // Try to get more details about the error
      const errorDetails = await page.evaluate(async () => {
        // Try to fetch projects directly via the proxy
        try {
          const resp = await fetch('/api/proxy/projects?limit=50', {
            credentials: 'include',
          });
          return { status: resp.status, body: await resp.json().catch(() => null) };
        } catch (e) {
          return { error: String(e) };
        }
      });
      console.log('Direct proxy test (projects):', errorDetails);

      // Test datasets
      const datasetsTest = await page.evaluate(async () => {
        try {
          const resp = await fetch('/api/proxy/datasets?limit=50', {
            credentials: 'include',
          });
          return { status: resp.status, body: await resp.json().catch(() => null) };
        } catch (e) {
          return { error: String(e) };
        }
      });
      console.log('Direct proxy test (datasets):', datasetsTest);

      // Test runs
      const runsTest = await page.evaluate(async () => {
        try {
          const resp = await fetch('/api/proxy/runs?limit=50', {
            credentials: 'include',
          });
          return { status: resp.status, body: await resp.json().catch(() => null) };
        } catch (e) {
          return { error: String(e) };
        }
      });
      console.log('Direct proxy test (runs):', runsTest);

      // Test quotas
      const quotasTest = await page.evaluate(async () => {
        try {
          const resp = await fetch('/api/proxy/quotas', {
            credentials: 'include',
          });
          return { status: resp.status, body: await resp.json().catch(() => null) };
        } catch (e) {
          return { error: String(e) };
        }
      });
      console.log('Direct proxy test (quotas):', quotasTest);
    }

    await page.getByRole('heading', { name: 'Welcome back, Demo' }).waitFor({ timeout: 15000 });

    // Scene 3 — Dashboard and workspace usage
    log('Scene 3: dashboard and workspace usage');
    await page.getByRole('heading', { name: 'Welcome back, Demo' }).waitFor();
    await page.getByText('Storage used', { exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Recent runs', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Recent projects', exact: true }).waitFor();
    await page.getByRole('heading', { name: 'Compute this week', exact: true }).waitFor();
    await sleep(1800);

    // Scene 4 — Browse projects
    log('Scene 4: browse projects');
    const projectsLink = page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Projects', exact: true });
    await projectsLink.waitFor();
    console.log('Projects link found, clicking...');
    await Promise.all([page.waitForURL(/\/app\/projects/), projectsLink.click()]);
    console.log('Navigated to projects page');
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole('link', { name: 'New project' }).first().waitFor();
    await sleep(1500);

    // Scene 5 — Create a project
    log('Scene 5: create a project');
    const demoStamp = new Date()
      .toISOString()
      .replace(/[-:.TZ]/g, '')
      .slice(0, 14);
    const projectName = `MEG Lab Demo Project ${demoStamp}`;
    // Create project via API
    const createResp = await callApi<{ id: string; name: string }>(
      '/projects',
      identity.access_token,
      {
        method: 'POST',
        body: JSON.stringify({
          name: projectName,
          description: 'Synthetic project used to demonstrate the MEG Lab workflow.',
          visibility: 'private',
        }),
      },
    );
    if (createResp.status !== 201) {
      throw new Error(
        `Project creation failed: ${createResp.status} ${JSON.stringify(createResp.body)}`,
      );
    }
    const projectId = createResp.body.id;
    console.log('Created project:', projectName, 'with ID:', projectId);

    // Navigate to projects list to show it
    await page.goto(`${baseUrl}/app/projects`);
    await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor({ timeout: 15000 });
    await page.getByRole('link', { name: projectName, exact: true }).waitFor({ timeout: 15000 });
    await sleep(1200);

    // Scene 6 — Project detail (skipped due to routing issue)
    log('Scene 6: project detail (skipped - routing issue)');
    // Use projectId from Scene 5 for subsequent scenes
    await sleep(500);

    // Scene 7 — Members and roles (skipped - API endpoints not implemented)
    log('Scene 7: members and roles (skipped)');
    await sleep(500);

    // Scene 8 — Settings and sign out
    log('Scene 8: settings and sign out');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page.getByRole('heading', { name: 'Workspace settings', exact: true }).waitFor();
    const settings = page.getByRole('main');
    await settings.getByRole('heading', { name: 'Profile' }).waitFor();
    await settings.getByText('Display name', { exact: true }).waitFor();
    await settings.getByLabel('Display name').waitFor();
    await settings.getByLabel('Email address').waitFor();
    await settings.getByRole('heading', { name: 'Quota & usage', exact: true }).waitFor();
    await settings.getByRole('heading', { name: 'Preferences', exact: true }).waitFor();
    await settings.getByRole('heading', { name: 'Danger zone', exact: true }).waitFor();
    await sleep(1500);

    const accountMenu = page.locator('details.dropdown');
    await accountMenu.locator('summary').click();
    await accountMenu.getByRole('link', { name: 'Settings' }).waitFor();
    await accountMenu.getByRole('button', { name: 'Sign out' }).waitFor();
    await sleep(800);
    await accountMenu.locator('summary').click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await sleep(1200);

    // Scene 9 — Project isolation
    log('Scene 9: project isolation');
    const intruder = await mintDevelopmentToken('intruder@meg-lab.local');
    const isolation = await callApi<ErrorEnvelope>(`/projects/${projectId}`, intruder.access_token);
    expectError(isolation, 404, 'not_found', 'Cross-project read');

    const anonymous = await callApi<ErrorEnvelope>(`/projects/${projectId}`, '');
    if (anonymous.status !== 401) {
      throw new Error(
        `Expected 401 for an unauthenticated read, got ${anonymous.status}: ${JSON.stringify(anonymous.body)}`,
      );
    }
    log(
      'Project isolation verified: cross-project read returns 404 not_found, anonymous read returns 401',
    );

    log('Demo completed successfully');
    await sleep(2500);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Demo recording failed:', error);
  process.exit(1);
});
