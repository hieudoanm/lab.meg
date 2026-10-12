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
  role: 'owner' | 'editor' | 'viewer';
  email?: string;
  display_name?: string;
}

interface MembershipListResponse {
  items: ProjectMember[];
}

interface InvitationResponse {
  token: string;
}

interface DatasetResponse {
  id: string;
  name: string;
  status: string;
  current_dataset_version?: { id: string; status: string } | null;
  recording?: { id: string };
}

interface PipelineResponse {
  id: string;
  name: string;
  latest_version?: { id: string; version: string; status: string } | null;
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
      ...(init.headers ?? {}),
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
  const runId = Date.now().toString();
  const demoEmail = `demo-${runId}@meg-lab.local`;
  const intruderEmail = `intruder-${runId}@meg-lab.local`;
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
    const identity = await mintDevelopmentToken(demoEmail, 'Demo Researcher');

    // Test direct login via API
    const loginResp = await callApi<{ access_token: string; user: { display_name: string } }>(
      '/auth/login',
      '', // no token needed for login
      {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: 'demopassword123' }),
      },
    );
    console.log('Direct login response:', loginResp.status, loginResp.body);

    // Test frontend session route via browser fetch
    const browserLoginResult = await page.evaluate(async (email) => {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'demopassword123' }),
        credentials: 'include',
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    }, demoEmail);
    console.log('Browser session response:', browserLoginResult);

    // Now login via the login form
    await page.getByLabel('Email address').fill(demoEmail);
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

    // Scene 6 — Project detail
    log('Scene 6: project detail');
    await page.getByRole('link', { name: projectName, exact: true }).click();
    await page.waitForURL(new RegExp(`/app/projects/${projectId}$`));
    await page.getByText(projectName, { exact: true }).first().waitFor();
    await sleep(1000);

    // Scene 7 — Members and roles
    log('Scene 7: members and roles');
    const memberEmail = `viewer-${runId}@meg-lab.local`;
    const memberIdentity = await mintDevelopmentToken(memberEmail, 'Demo Viewer');
    const invitation = await callApi<InvitationResponse>(
      `/projects/${projectId}/invitations`,
      identity.access_token,
      {
        method: 'POST',
        body: JSON.stringify({ email: memberEmail, role: 'viewer' }),
      },
    );
    if (invitation.status !== 201 || !invitation.body.token) {
      throw new Error(
        `Member invitation failed: ${invitation.status} ${JSON.stringify(invitation.body)}`,
      );
    }

    const accepted = await callApi<ProjectMember>(
      `/invitations/${invitation.body.token}/accept`,
      memberIdentity.access_token,
      { method: 'POST' },
    );
    if (accepted.status !== 200 || accepted.body.role !== 'viewer') {
      throw new Error(
        `Member invitation acceptance failed: ${accepted.status} ${JSON.stringify(accepted.body)}`,
      );
    }

    const members = await callApi<MembershipListResponse>(
      `/projects/${projectId}/members`,
      identity.access_token,
    );
    const member = members.body.items?.find((item) => item.user_id === accepted.body.user_id);
    const owner = members.body.items?.find((item) => item.role === 'owner');
    if (members.status !== 200 || !member || !owner) {
      throw new Error(`Member listing failed: ${members.status} ${JSON.stringify(members.body)}`);
    }

    const promoted = await callApi<ProjectMember>(
      `/projects/${projectId}/members/${member.user_id}`,
      identity.access_token,
      { method: 'PATCH', body: JSON.stringify({ role: 'editor' }) },
    );
    if (promoted.status !== 200 || promoted.body.role !== 'editor') {
      throw new Error(
        `Member role update failed: ${promoted.status} ${JSON.stringify(promoted.body)}`,
      );
    }

    const lastOwner = await callApi<ErrorEnvelope>(
      `/projects/${projectId}/members/${owner.user_id}`,
      identity.access_token,
      { method: 'PATCH', body: JSON.stringify({ role: 'viewer' }) },
    );
    expectError(lastOwner, 409, 'last_owner', 'Last-owner protection');

    const removed = await callApi<unknown>(
      `/projects/${projectId}/members/${member.user_id}`,
      identity.access_token,
      { method: 'DELETE' },
    );
    if (removed.status !== 204) {
      throw new Error(`Member removal failed: ${removed.status} ${JSON.stringify(removed.body)}`);
    }
    log('Membership verified: invite, accept, promote, last-owner protection, and remove');

    // Scene 8 — Synthetic dataset, viewer, pipeline, and worker run
    log('Scene 8: synthetic dataset, viewer, pipeline, and worker run');
    const sampleDataset = await callApi<{ dataset: DatasetResponse }>(
      `/projects/${projectId}/datasets`,
      identity.access_token,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `demo-sample-${runId}` },
        body: JSON.stringify({
          name: `Synthetic MEG sample ${demoStamp}`,
          source_type: 'sample',
          recording_format: 'fif',
          acquisition_system: 'squid',
          files: [
            {
              name: 'sample_raw.fif',
              size_bytes: 1,
              media_type: 'application/octet-stream',
              role: 'recording',
            },
          ],
        }),
      },
    );
    if (sampleDataset.status !== 201 || !sampleDataset.body.dataset?.id) {
      throw new Error(
        `Synthetic dataset creation failed: ${sampleDataset.status} ${JSON.stringify(sampleDataset.body)}`,
      );
    }
    const datasetId = sampleDataset.body.dataset.id;
    let dataset: DatasetResponse | null = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = await callApi<DatasetResponse>(
        `/datasets/${datasetId}`,
        identity.access_token,
      );
      if (result.status !== 200) {
        throw new Error(`Synthetic dataset lookup failed: ${result.status}`);
      }
      dataset = result.body;
      if (dataset.status === 'ready' && dataset.current_dataset_version?.status === 'ready') {
        break;
      }
      await sleep(1000);
    }
    if (!dataset) {
      throw new Error('Synthetic dataset lookup returned no dataset.');
    }
    await page.goto(`${baseUrl}/app/datasets`);
    await page.getByText(dataset.name, { exact: true }).waitFor();
    await sleep(1200);

    const pipeline = await callApi<PipelineResponse>('/pipelines', identity.access_token, {
      method: 'POST',
      headers: { 'Idempotency-Key': `demo-pipeline-${runId}` },
      body: JSON.stringify({
        project_id: projectId,
        name: `Synthetic PSD pipeline ${demoStamp}`,
        description: 'Pipeline created by the automated MEG Lab demo.',
      }),
    });
    if (pipeline.status !== 201 || !pipeline.body.id) {
      throw new Error(
        `Pipeline creation failed: ${pipeline.status} ${JSON.stringify(pipeline.body)}`,
      );
    }
    const pipelineVersion = await callApi<PipelineResponse>(
      `/pipelines/${pipeline.body.id}/versions`,
      identity.access_token,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `demo-pipeline-version-${runId}` },
        body: JSON.stringify({
          version: '1.0.0',
          definition: { nodes: [{ id: 'psd', type: 'psd', params: {} }] },
          image_digest: `sha256:${'0'.repeat(64)}`,
          parameters_schema: { type: 'object', properties: {} },
          status: 'published',
        }),
      },
    );
    if (pipelineVersion.status !== 201 || !pipelineVersion.body.id) {
      throw new Error(
        `Pipeline version creation failed: ${pipelineVersion.status} ${JSON.stringify(pipelineVersion.body)}`,
      );
    }
    await page.goto(`${baseUrl}/app`);
    await page.getByRole('heading', { name: 'Welcome back, Demo' }).waitFor();
    await sleep(1800);
    log('Synthetic dataset registration and published pipeline verified');

    // Scene 9 — Settings and sign out
    log('Scene 9: settings and sign out');
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

    // Scene 10 — Project isolation
    log('Scene 10: project isolation');
    const intruder = await mintDevelopmentToken(intruderEmail, 'Intruder');
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
