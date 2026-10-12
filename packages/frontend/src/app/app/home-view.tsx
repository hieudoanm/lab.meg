'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { StatusBadge } from '@/components/atoms/status-badge';
import { ErrorState, LoadingState } from '@/components/atoms/states';
import { fetchDatasets, fetchProjects, fetchQuotas, fetchRuns, toErrorMessage } from '@/lib/api';
import type { ExperimentRun, ProjectSummary, Quota } from '@/lib/api/types';
import { formatBytes, formatDuration, formatIdentifier, formatRelativeTime } from '@/lib/format';
import { quotaStateLabel, quotaStateTone, runStatusLabel, runStatusTone } from '@/lib/status';

const StatTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => {
  return (
    <div className='border-border bg-surface rounded-lg border p-4'>
      <p className='text-text-muted text-[12px] font-medium tracking-wide uppercase'>{label}</p>
      <p className='text-text-primary mt-2 text-2xl font-semibold'>{value}</p>
      {hint ? <p className='text-text-secondary mt-1 text-[12px]'>{hint}</p> : null}
    </div>
  );
};

const QuickAction = ({ href, label }: { href: string; label: string }) => {
  return (
    <Link
      href={href}
      className='border-border bg-surface-muted hover:bg-surface-raised focus-ring flex items-center gap-3 rounded-md border px-3 py-2.5 text-[13px] font-medium'>
      <span aria-hidden='true' className='bg-accent h-1.5 w-1.5 rounded-full' />
      {label}
    </Link>
  );
};

const formatHoursMinutes = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours} h ${minutes} m`;
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const StorageRow = ({ quota }: { quota: Quota }) => {
  const ratio = quota.limit > 0 ? Math.min((quota.used / quota.limit) * 100, 100) : 0;
  return (
    <section className='border-border bg-surface rounded-lg border p-4'>
      <div className='flex items-center justify-between'>
        <h2 className='text-[15px] font-semibold'>Storage quota</h2>
        <StatusBadge tone={quotaStateTone(quota.state)} label={quotaStateLabel(quota.state)} />
      </div>
      <div className='mt-4 flex items-baseline justify-between text-[13px]'>
        <span className='text-text-primary font-mono'>{formatBytes(quota.used)}</span>
        <span className='text-text-muted'>of {formatBytes(quota.limit)} quota</span>
      </div>
      <progress className='progress progress-primary mt-2 h-1.5 w-full' value={ratio} max={100} />
      <p className='text-text-secondary mt-2 text-[12px]'>
        {formatBytes(Math.max(quota.limit - quota.used, 0))} remaining.
      </p>
    </section>
  );
};

export interface HomeViewProps {
  userName: string;
}

export const HomeView = ({ userName }: HomeViewProps) => {
  const projects = useQuery({
    queryKey: ['projects', { limit: 50 }],
    queryFn: () => fetchProjects({ limit: 50 }),
  });
  const datasets = useQuery({
    queryKey: ['datasets', { limit: 50 }],
    queryFn: () => fetchDatasets({ limit: 50 }),
  });
  const runs = useQuery({
    queryKey: ['runs', { limit: 50 }],
    queryFn: () => fetchRuns({ limit: 50 }),
  });
  const quotas = useQuery({ queryKey: ['quotas'], queryFn: () => fetchQuotas() });

  const projectItems = projects.data?.items ?? [];
  const datasetItems = datasets.data?.items ?? [];
  const runItems = runs.data?.items ?? [];
  const quotaItems = quotas.data?.items ?? [];

  const activeProjects = projectItems.filter((project) => project.archived_at === null).length;
  const archivedProjects = projectItems.length - activeProjects;
  const readyDatasets = datasetItems.filter((dataset) => dataset.status === 'ready').length;
  const validatingDatasets = datasetItems.filter(
    (dataset) => dataset.status === 'validating',
  ).length;

  const storageQuota = quotaItems.find((quota) => quota.resource_type === 'storage_bytes');
  const runsQuota = quotaItems.find((quota) => quota.resource_type === 'runs');
  const cpuQuota = quotaItems.find((quota) => quota.resource_type === 'cpu_seconds');

  const succeeded = runItems.filter((run) => run.status === 'succeeded').length;
  const running = runItems.filter((run) => run.status === 'running').length;
  const failed = runItems.filter((run) => run.status === 'failed').length;
  const finished = succeeded + failed;
  const successRate = finished > 0 ? (succeeded / finished) * 100 : 0;
  const durations = runItems
    .map((run) => run.duration_s)
    .filter((value): value is number => value !== null);
  const avgDuration =
    durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const lastRun = runItems[0];
  const activeProjectName =
    projectItems.find((project) => project.archived_at === null)?.name ?? 'None';

  const recentRuns = runItems.slice(0, 6);
  const recentProjects = projectItems.slice(0, 4);

  const isLoading = projects.isLoading || datasets.isLoading || runs.isLoading || quotas.isLoading;
  const isError = projects.isError || datasets.isError || runs.isError || quotas.isError;
  const error = projects.error ?? datasets.error ?? runs.error ?? quotas.error;

  if (isLoading) {
    return <LoadingState label='Loading workspace…' />;
  }
  if (isError) {
    return <ErrorState message={toErrorMessage(error)} />;
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <div className='text-text-muted mb-1 text-[12px] font-semibold tracking-wider uppercase'>
            Workspace overview
          </div>
          <h1 className='text-text-primary text-[28px] leading-9 font-semibold tracking-tight'>
            Welcome back, {userName.split(/\s+/)[0]}
          </h1>
          <p className='text-text-secondary mt-1 max-w-2xl text-[14px]'>
            Activity across your projects. Active project:{' '}
            <span className='text-text-primary'>{activeProjectName}</span>
            {lastRun ? <> · last run {formatRelativeTime(lastRun.requested_at)}.</> : '.'}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link href='/app/datasets/new' className='btn btn-outline btn-sm'>
            Upload recording
          </Link>
          <Link href='/app/projects' className='btn btn-primary btn-sm'>
            New project
          </Link>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile
          label='Projects'
          value={String(projectItems.length)}
          hint={`${activeProjects} active · ${archivedProjects} archived`}
        />
        <StatTile
          label='Recordings'
          value={String(datasetItems.length)}
          hint={`${readyDatasets} ready · ${validatingDatasets} validating`}
        />
        <StatTile
          label='Storage used'
          value={storageQuota ? formatBytes(storageQuota.used) : '—'}
          hint={storageQuota ? `of ${formatBytes(storageQuota.limit)} quota` : undefined}
        />
        <StatTile
          label='Runs this week'
          value={runsQuota ? String(runsQuota.used) : String(runItems.length)}
          hint={`${succeeded} succeeded · ${running} running · ${failed} failed`}
        />
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.7fr_1fr]'>
        <section className='card border-border bg-surface rounded-lg border'>
          <div className='border-border flex items-center justify-between border-b px-4 py-3'>
            <div>
              <h2 className='text-[15px] font-semibold'>Recent runs</h2>
              <p className='text-text-muted text-[12px]'>
                Pipeline executions across your projects
              </p>
            </div>
            <Link
              href='/app/experiments'
              className='text-accent hover:text-accent-hover text-[13px] font-medium'>
              View all
            </Link>
          </div>
          <div className='overflow-x-auto'>
            <table className='table-sm table'>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Pipeline</th>
                  <th>Recording</th>
                  <th>Status</th>
                  <th className='text-right'>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className='text-text-secondary font-mono text-[12px]'>
                      <Link href={`/app/runs/${run.id}`} className='hover:text-accent'>
                        {formatIdentifier(run.id)}
                      </Link>
                    </td>
                    <td className='text-[13px]'>
                      {run.pipeline_name}{' '}
                      <span className='text-text-muted'>v{run.pipeline_version}</span>
                    </td>
                    <td className='text-text-secondary font-mono text-[12px]'>
                      {run.dataset_name} · {run.dataset_version}
                    </td>
                    <td>
                      <StatusBadge
                        tone={runStatusTone(run.status)}
                        label={runStatusLabel(run.status)}
                      />
                    </td>
                    <td className='text-text-muted text-right font-mono text-[12px]'>
                      {formatRelativeTime(run.requested_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className='space-y-6'>
          {storageQuota ? <StorageRow quota={storageQuota} /> : null}
          <section className='card border-border bg-surface rounded-lg border p-4'>
            <h2 className='text-[15px] font-semibold'>Compute this week</h2>
            <div className='mt-4 space-y-3 text-[13px]'>
              <div className='flex items-center justify-between'>
                <span className='text-text-secondary'>CPU time</span>
                <span className='font-mono'>
                  {cpuQuota ? formatHoursMinutes(cpuQuota.used) : '—'}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-text-secondary'>Avg. run duration</span>
                <span className='font-mono'>
                  {avgDuration !== null ? formatDuration(avgDuration) : '—'}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-text-secondary'>Success rate</span>
                <span className={`font-mono ${successRate >= 80 ? 'text-success' : ''}`}>
                  {finished > 0 ? `${successRate.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-text-secondary'>Runs recorded</span>
                <span className='font-mono'>{runItems.length}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className='grid gap-6 xl:grid-cols-[1.7fr_1fr]'>
        <section className='card border-border bg-surface rounded-lg border'>
          <div className='border-border flex items-center justify-between border-b px-4 py-3'>
            <div>
              <h2 className='text-[15px] font-semibold'>Recent projects</h2>
              <p className='text-text-muted text-[12px]'>Recordings, runs, and last activity</p>
            </div>
            <Link
              href='/app/projects'
              className='text-accent hover:text-accent-hover text-[13px] font-medium'>
              All projects
            </Link>
          </div>
          <div className='overflow-x-auto'>
            <table className='table-sm table'>
              <thead>
                <tr>
                  <th>Project</th>
                  <th className='text-right'>Datasets</th>
                  <th className='text-right'>Runs</th>
                  <th>Visibility</th>
                  <th className='text-right'>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((project: ProjectSummary) => (
                  <tr key={project.id}>
                    <td>
                      <div className='flex items-center gap-2'>
                        <span
                          aria-hidden='true'
                          className='bg-accent-muted text-accent flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold'>
                          {initials(project.name)}
                        </span>
                        <Link
                          href={`/app/projects/${project.id}`}
                          className='hover:text-accent text-[13px] font-medium'>
                          {project.name}
                        </Link>
                      </div>
                    </td>
                    <td className='text-right font-mono text-[12px]'>{project.dataset_count}</td>
                    <td className='text-right font-mono text-[12px]'>{project.run_count}</td>
                    <td>
                      <span className='bg-surface-muted text-text-secondary inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
                        {project.visibility === 'public' ? 'public sample' : 'private'}
                      </span>
                    </td>
                    <td className='text-text-muted text-right font-mono text-[12px]'>
                      {formatRelativeTime(project.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className='card border-border bg-surface rounded-lg border p-4'>
          <h2 className='text-[15px] font-semibold'>Quick actions</h2>
          <div className='mt-4 grid gap-2'>
            <QuickAction href='/app/datasets/new' label='Upload a recording' />
            <QuickAction href='/app/signal-viewer' label='Open the Signal Viewer' />
            <QuickAction href='/app/sensor-explorer' label='Inspect sensor geometry' />
            <QuickAction href='/app/runs/new' label='Start a run' />
            <QuickAction href='/app/explore' label='Open the public sample' />
          </div>
        </section>
      </div>

      <section className='card border-border bg-surface rounded-lg border p-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-[15px] font-semibold'>Recent experiment activity</h2>
          <span className='text-text-muted text-[12px]'>Last 7 days</span>
        </div>
        <ol className='mt-4 space-y-4'>
          {recentRuns.slice(0, 3).map((run: ExperimentRun) => (
            <li key={run.id} className='flex gap-3'>
              <span
                aria-hidden='true'
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  run.status === 'succeeded'
                    ? 'bg-success'
                    : run.status === 'failed'
                      ? 'bg-danger'
                      : 'bg-accent'
                }`}
              />
              <div>
                <p className='text-[13px]'>
                  <span className='font-medium'>{formatIdentifier(run.id)}</span>{' '}
                  {runStatusLabel(run.status).toLowerCase()} —{' '}
                  <span className='text-text-secondary font-mono text-[12px]'>
                    {run.pipeline_name} v{run.pipeline_version}
                  </span>{' '}
                  on {run.dataset_name} {run.dataset_version}
                </p>
                <p className='text-text-muted text-[12px]'>
                  {run.error ? `Safe reason: ${run.error.message}. ` : ''}
                  {formatRelativeTime(run.requested_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
