'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/atoms/button';
import { CopyButton } from '@/components/atoms/copy-button';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import {
  archiveProject,
  fetchCurrentUser,
  fetchDataset,
  fetchPipelines,
  fetchProject,
  fetchProjectDatasets,
  fetchProjectMembers,
  fetchQuotas,
  fetchRuns,
  toErrorMessage,
} from '@/lib/api';
import type { Dataset, ExperimentRun, Pipeline, ProjectMember, Recording } from '@/lib/api/types';
import {
  formatBytes,
  formatChecksum,
  formatDuration,
  formatFrequency,
  formatIdentifier,
  formatRelativeTime,
} from '@/lib/format';
import {
  datasetStatusLabel,
  datasetStatusTone,
  pipelineVersionStatusLabel,
  pipelineVersionStatusTone,
  projectStatusLabel,
  projectStatusTone,
  runStatusLabel,
  runStatusTone,
} from '@/lib/status';

type TabKey = 'overview' | 'datasets' | 'pipelines' | 'runs';

const SENSOR_LABELS: Record<string, string> = {
  neuromag_vectorview: 'SQUID-MEG',
  opm_ucl_fil: 'OPM',
  ctf: 'CTF-MEG',
  kit: 'KIT-MEG',
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const StatTile = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) => {
  return (
    <div className='border-border bg-surface rounded-lg border p-4'>
      <p className='text-text-muted text-[12px] font-medium tracking-wide uppercase'>{label}</p>
      <p className='text-text-primary mt-2 text-[24px] font-semibold'>{value}</p>
      {hint ? <p className={`mt-1 text-[12px] ${tone ?? 'text-text-secondary'}`}>{hint}</p> : null}
    </div>
  );
};

const TabButton = ({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) => {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`border-b-2 pb-3 text-[14px] font-medium ${
        active
          ? 'border-accent text-text-primary'
          : 'text-text-secondary hover:text-text-primary border-transparent'
      }`}>
      {label} <span className='text-text-muted ml-1'>{count}</span>
    </button>
  );
};

const DetailRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => {
  return (
    <div className='flex items-start justify-between gap-3 text-[13px]'>
      <dt className='text-text-muted'>{label}</dt>
      <dd className={`text-text-primary text-right ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
};

const acquisitionRows = (recording: Recording): { label: string; value: string }[] => [
  { label: 'Type', value: SENSOR_LABELS[recording.sensor_type] ?? recording.sensor_type },
  {
    label: 'Device',
    value: recording.sensor_type === 'opm_ucl_fil' ? 'UCL FIL OPM array' : 'Neuromag Vectorview',
  },
  { label: 'Format', value: recording.format },
  { label: 'Channels', value: String(recording.n_channels_total) },
  { label: 'MEG channels', value: String(recording.n_meg_channels) },
  { label: 'Sampling rate', value: formatFrequency(recording.sampling_frequency_hz) },
];

const countRecentRuns = (runs: ExperimentRun[], days: number): number => {
  const cutoff = Date.now() - days * 86_400_000;
  return runs.filter((run) => new Date(run.requested_at).getTime() >= cutoff).length;
};

export const ProjectDetailView = ({ projectId }: { projectId: string }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId),
  });
  const datasetsQuery = useQuery({
    queryKey: ['project-datasets', projectId],
    queryFn: () => fetchProjectDatasets(projectId, { limit: 50 }),
  });
  const runsQuery = useQuery({
    queryKey: ['project-runs', projectId],
    queryFn: () => fetchRuns({ projectId, limit: 50 }),
  });
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => fetchProjectMembers(projectId),
  });
  const pipelinesQuery = useQuery({
    queryKey: ['project-pipelines', projectId],
    queryFn: () => fetchPipelines({ projectId, limit: 50 }),
  });
  const quotasQuery = useQuery({ queryKey: ['quotas'], queryFn: () => fetchQuotas() });
  const currentUserQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: () => fetchCurrentUser(),
  });

  const project = projectQuery.data;
  const datasetItems = useMemo(() => datasetsQuery.data?.items ?? [], [datasetsQuery.data]);
  const runItems = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);
  const pipelineItems = useMemo(() => pipelinesQuery.data?.items ?? [], [pipelinesQuery.data]);

  const firstDatasetId = datasetItems[0]?.id ?? '';
  const firstDatasetQuery = useQuery({
    queryKey: ['dataset', firstDatasetId],
    queryFn: () => fetchDataset(firstDatasetId),
    enabled: firstDatasetId.length > 0,
  });

  const memberItems = useMemo<ProjectMember[]>(() => {
    const items = membersQuery.data?.items ?? [];
    if (items.length > 0) {
      return items;
    }
    const me = currentUserQuery.data;
    if (!me || !project) {
      return [];
    }
    return [
      {
        project_id: project.id,
        user_id: me.id,
        role: project.role,
        display_name: me.display_name,
        email: me.email,
        created_at: me.created_at,
      },
    ];
  }, [membersQuery.data, currentUserQuery.data, project]);

  const archiveMutation = useMutation({
    mutationFn: () => archiveProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      showToast({
        title: 'Project archived',
        description: 'The project is now read-only and hidden from active lists.',
        tone: 'success',
      });
    },
    onError: (error) => {
      showToast({
        title: 'Could not archive project',
        description: toErrorMessage(error),
        tone: 'danger',
      });
    },
  });

  if (projectQuery.isLoading) {
    return <LoadingState label='Loading project…' />;
  }
  if (projectQuery.isError) {
    return <ErrorState message={toErrorMessage(projectQuery.error)} />;
  }
  if (!project) {
    return (
      <EmptyState
        title='Project not found'
        description='This project may have been removed or you no longer have access.'
        action={
          <Link href='/app/projects' className='btn btn-outline btn-sm'>
            Back to projects
          </Link>
        }
      />
    );
  }

  const recording = firstDatasetQuery.data?.recording ?? null;
  const readyDatasets = datasetItems.filter((dataset) => dataset.status === 'ready').length;
  const validatingDatasets = datasetItems.filter(
    (dataset) => dataset.status === 'validating',
  ).length;
  const readyVersions = datasetItems.reduce((total, dataset) => total + dataset.version_count, 0);

  const runsLast30 = countRecentRuns(runItems, 30);
  const succeeded = runItems.filter((run) => run.status === 'succeeded').length;
  const failed = runItems.filter((run) => run.status === 'failed').length;

  const storageQuota = quotasQuery.data?.items.find(
    (quota) => quota.resource_type === 'storage_bytes',
  );

  const recentRuns = runItems.slice(0, 4);
  const visibleMembers = memberItems.slice(0, 4);

  const runColumns: DataTableColumn<ExperimentRun>[] = [
    {
      key: 'run',
      header: 'Run',
      render: (run) => (
        <Link
          href={`/app/runs/${run.id}`}
          className='text-accent hover:text-accent-hover font-mono text-[13px]'>
          {formatIdentifier(run.id)}
        </Link>
      ),
    },
    {
      key: 'pipeline',
      header: 'Pipeline',
      render: (run) => (
        <span className='text-[13px]'>
          {run.pipeline_name} <span className='text-text-muted'>v{run.pipeline_version}</span>
        </span>
      ),
    },
    {
      key: 'dataset',
      header: 'Dataset',
      render: (run) => (
        <span className='text-text-secondary font-mono text-[12px]'>
          {run.dataset_name} · {run.dataset_version}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (run) => (
        <StatusBadge tone={runStatusTone(run.status)} label={runStatusLabel(run.status)} />
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      className: 'text-right',
      render: (run) => (
        <span className='font-mono text-[13px]'>
          {run.duration_s !== null ? formatDuration(run.duration_s) : '—'}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (run) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(run.requested_at)}
        </span>
      ),
    },
  ];

  const datasetColumns: DataTableColumn<Dataset>[] = [
    {
      key: 'name',
      header: 'Dataset',
      render: (dataset) => (
        <div className='flex flex-col gap-0.5'>
          <Link
            href={`/app/datasets/${dataset.id}`}
            className='text-text-primary hover:text-accent font-medium'>
            {dataset.name}
          </Link>
          <span className='text-text-muted font-mono text-[12px]'>
            {(dataset.current_dataset_version?.format ?? 'fif').toUpperCase()} ·{' '}
            {formatChecksum(dataset.current_dataset_version?.checksum_sha256)}
          </span>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (dataset) => (
        <span className='font-mono text-[13px]'>
          {dataset.current_dataset_version?.version ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (dataset) => (
        <StatusBadge
          tone={datasetStatusTone(dataset.status)}
          label={datasetStatusLabel(dataset.status)}
        />
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (dataset) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(dataset.updated_at)}
        </span>
      ),
    },
  ];

  const pipelineColumns: DataTableColumn<Pipeline>[] = [
    {
      key: 'name',
      header: 'Pipeline',
      render: (pipeline) => (
        <div className='flex flex-col gap-0.5'>
          <span className='text-text-primary font-medium'>{pipeline.name}</span>
          <span className='text-text-muted text-[12px]'>{pipeline.description ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Latest version',
      render: (pipeline) => (
        <span className='font-mono text-[13px]'>
          {pipeline.latest_version ? `v${pipeline.latest_version.version}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (pipeline) =>
        pipeline.latest_version ? (
          <StatusBadge
            tone={pipelineVersionStatusTone(pipeline.latest_version.status)}
            label={pipelineVersionStatusLabel(pipeline.latest_version.status)}
          />
        ) : (
          <span className='text-text-muted'>—</span>
        ),
    },
    {
      key: 'runs',
      header: 'Runs',
      className: 'text-right',
      render: (pipeline) => <span className='font-mono text-[13px]'>{pipeline.run_count}</span>,
    },
  ];

  const overview = (
    <>
      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile
          label='Datasets'
          value={String(datasetItems.length)}
          hint={`${readyDatasets} ready · ${validatingDatasets} validating`}
        />
        <StatTile label='Ready versions' value={String(readyVersions)} hint='across all datasets' />
        <StatTile
          label='Runs · 30 days'
          value={String(runsLast30)}
          hint={`${succeeded} succeeded · ${failed} failed`}
          tone={failed > 0 ? 'text-danger' : 'text-success'}
        />
        <StatTile
          label='Storage used'
          value={storageQuota ? formatBytes(storageQuota.used) : '—'}
          hint={storageQuota ? `of ${formatBytes(storageQuota.limit)} quota` : 'No quota data'}
        />
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
        <div className='space-y-6 xl:col-span-2'>
          <section className='card border-border bg-surface rounded-lg border'>
            <div className='border-border flex items-center justify-between border-b px-4 py-3'>
              <h2 className='text-[15px] font-semibold'>Recent runs</h2>
              <Link
                href='/app/experiments'
                className='text-accent hover:text-accent-hover text-[13px] font-medium'>
                View all
              </Link>
            </div>
            {recentRuns.length === 0 ? (
              <p className='text-text-secondary p-4 text-[13px]'>No runs recorded yet.</p>
            ) : (
              <div className='overflow-x-auto'>
                <table className='table-sm table w-full'>
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Pipeline</th>
                      <th>Status</th>
                      <th className='text-right'>Duration</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRuns.map((run) => (
                      <tr key={run.id}>
                        <td className='font-mono text-[13px]'>
                          <Link
                            href={`/app/runs/${run.id}`}
                            className='text-accent hover:text-accent-hover'>
                            {formatIdentifier(run.id)}
                          </Link>
                        </td>
                        <td className='text-[13px]'>
                          {run.pipeline_name}{' '}
                          <span className='text-text-muted'>v{run.pipeline_version}</span>
                        </td>
                        <td>
                          <StatusBadge
                            tone={runStatusTone(run.status)}
                            label={runStatusLabel(run.status)}
                          />
                        </td>
                        <td className='text-right font-mono text-[13px]'>
                          {run.duration_s !== null ? formatDuration(run.duration_s) : '—'}
                        </td>
                        <td className='text-text-secondary text-[13px]'>
                          {formatRelativeTime(run.requested_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className='card border-border bg-surface rounded-lg border'>
            <div className='border-border flex items-center justify-between border-b px-4 py-3'>
              <h2 className='text-[15px] font-semibold'>Datasets</h2>
              <Link
                href='/app/datasets/new'
                className='text-accent hover:text-accent-hover text-[13px] font-medium'>
                Upload
              </Link>
            </div>
            {datasetItems.length === 0 ? (
              <p className='text-text-secondary p-4 text-[13px]'>No datasets in this project.</p>
            ) : (
              <div className='divide-border divide-y'>
                {datasetItems.map((dataset) => (
                  <div
                    key={dataset.id}
                    className='flex items-center justify-between gap-4 px-4 py-3'>
                    <div className='min-w-0'>
                      <div className='truncate text-[14px] font-medium'>{dataset.name}</div>
                      <div className='text-text-muted font-mono text-[12px]'>
                        {(dataset.current_dataset_version?.format ?? 'fif').toUpperCase()} ·{' '}
                        {formatChecksum(dataset.current_dataset_version?.checksum_sha256)}
                      </div>
                    </div>
                    <div className='flex items-center gap-3'>
                      <StatusBadge
                        tone={datasetStatusTone(dataset.status)}
                        label={datasetStatusLabel(dataset.status)}
                      />
                      <Link
                        href={`/app/datasets/${dataset.id}`}
                        className='text-accent hover:text-accent-hover text-[13px] font-medium'>
                        Open
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className='space-y-6'>
          <section className='card border-border bg-surface rounded-lg border'>
            <div className='border-border border-b px-4 py-3'>
              <h2 className='text-[15px] font-semibold'>Members</h2>
            </div>
            {memberItems.length === 0 ? (
              <p className='text-text-secondary px-4 py-3 text-[13px]'>No members recorded.</p>
            ) : (
              <div className='divide-border divide-y'>
                {memberItems.map((member) => (
                  <div
                    key={member.user_id}
                    className='flex items-center justify-between gap-3 px-4 py-3'>
                    <div className='flex items-center gap-2'>
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold ${
                          member.role === 'owner'
                            ? 'bg-accent-muted text-accent'
                            : 'bg-surface-raised text-text-secondary'
                        }`}>
                        {initials(member.display_name ?? member.email ?? '?')}
                      </div>
                      <span className='text-[13px]'>
                        {member.display_name ?? member.email ?? 'Unknown member'}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                        member.role === 'owner'
                          ? 'bg-accent-muted text-accent'
                          : 'bg-surface-muted text-text-secondary'
                      }`}>
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className='border-border border-t px-4 py-3'>
              <Button variant='secondary' size='sm'>
                Add member
              </Button>
            </div>
          </section>

          <section className='card border-border bg-surface rounded-lg border p-4'>
            <h2 className='text-[15px] font-semibold'>Acquisition system</h2>
            {recording ? (
              <dl className='mt-3 space-y-2'>
                {acquisitionRows(recording).map((row) => (
                  <DetailRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    mono={row.label !== 'Device'}
                  />
                ))}
              </dl>
            ) : (
              <p className='text-text-secondary mt-3 text-[13px]'>
                No acquisition metadata available for this project.
              </p>
            )}
          </section>

          <section className='card border-border bg-surface rounded-lg border'>
            <div className='border-border border-b px-4 py-3'>
              <h2 className='text-[15px] font-semibold'>Activity</h2>
            </div>
            <div className='space-y-4 px-4 py-4'>
              {recentRuns.length === 0 ? (
                <p className='text-text-secondary text-[13px]'>No recent activity.</p>
              ) : (
                recentRuns.map((run) => (
                  <div key={run.id} className='flex gap-3'>
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
                    <div className='min-w-0'>
                      <p className='text-[13px]'>
                        <span className='font-medium'>{formatIdentifier(run.id)}</span>{' '}
                        {runStatusLabel(run.status).toLowerCase()} —{' '}
                        <span className='text-text-secondary font-mono text-[12px]'>
                          {run.pipeline_name} v{run.pipeline_version}
                        </span>
                      </p>
                      <p className='text-text-muted font-mono text-[11px]'>
                        {formatRelativeTime(run.requested_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        breadcrumbs={[{ label: 'Projects', href: '/app/projects' }, { label: project.name }]}
        actions={
          <>
            <Button variant='secondary' size='sm'>
              Edit
            </Button>
            <Button variant='secondary' size='sm'>
              Share
            </Button>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => archiveMutation.mutate()}
              disabled={project.archived_at !== null || archiveMutation.isPending}>
              {project.archived_at !== null
                ? 'Archived'
                : archiveMutation.isPending
                  ? 'Archiving…'
                  : 'Archive'}
            </Button>
          </>
        }>
        <div className='text-text-secondary flex flex-wrap items-center gap-3 text-[13px]'>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
              project.visibility === 'public'
                ? 'bg-info-muted text-info'
                : 'bg-surface-muted text-text-secondary'
            }`}>
            <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-current' />
            {project.visibility === 'public' ? 'public sample' : 'private'}
          </span>
          <StatusBadge
            tone={projectStatusTone(project.archived_at ? 'archived' : 'active')}
            label={projectStatusLabel(project.archived_at ? 'archived' : 'active')}
          />
          <span className='text-text-muted'>Updated {formatRelativeTime(project.updated_at)}</span>
          <span className='text-text-muted font-mono text-[12px]'>{project.id}</span>
          <CopyButton value={project.id} />
        </div>
      </PageHeader>

      <div className='flex flex-wrap items-center gap-3'>
        {visibleMembers.length > 0 ? (
          <div className='flex -space-x-2'>
            {visibleMembers.map((member) => (
              <div
                key={member.user_id}
                title={`${member.display_name ?? member.email ?? 'Member'} · ${member.role}`}
                className={`border-surface flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                  member.role === 'owner'
                    ? 'bg-accent-muted text-accent'
                    : 'bg-surface-raised text-text-secondary'
                }`}>
                {initials(member.display_name ?? member.email ?? '?')}
              </div>
            ))}
          </div>
        ) : null}
        <span className='text-text-secondary text-[13px]'>
          {memberItems.length} {memberItems.length === 1 ? 'member' : 'members'}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            project.role === 'owner'
              ? 'bg-accent-muted text-accent'
              : 'bg-surface-muted text-text-secondary'
          }`}>
          <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-current' />
          Your role: {project.role}
        </span>
      </div>

      <div className='border-border flex gap-6 border-b pb-px'>
        <TabButton
          active={activeTab === 'overview'}
          label='Overview'
          count={datasetItems.length + runItems.length + pipelineItems.length}
          onClick={() => setActiveTab('overview')}
        />
        <TabButton
          active={activeTab === 'datasets'}
          label='Datasets'
          count={datasetItems.length}
          onClick={() => setActiveTab('datasets')}
        />
        <TabButton
          active={activeTab === 'pipelines'}
          label='Pipelines'
          count={pipelineItems.length}
          onClick={() => setActiveTab('pipelines')}
        />
        <TabButton
          active={activeTab === 'runs'}
          label='Runs'
          count={runItems.length}
          onClick={() => setActiveTab('runs')}
        />
      </div>

      {activeTab === 'overview' ? (
        overview
      ) : activeTab === 'datasets' ? (
        datasetItems.length === 0 ? (
          <EmptyState
            title='No datasets yet'
            description='Upload a recording to make it available for runs in this project.'
            action={
              <Link href='/app/datasets/new' className='btn btn-primary btn-sm'>
                Upload dataset
              </Link>
            }
          />
        ) : (
          <DataTable
            columns={datasetColumns}
            rows={datasetItems}
            getRowKey={(dataset) => dataset.id}
          />
        )
      ) : activeTab === 'pipelines' ? (
        pipelineItems.length === 0 ? (
          <EmptyState
            title='No pipelines yet'
            description='Publish a pipeline version to run reproducible analyses in this project.'
          />
        ) : (
          <DataTable
            columns={pipelineColumns}
            rows={pipelineItems}
            getRowKey={(pipeline) => pipeline.id}
          />
        )
      ) : runItems.length === 0 ? (
        <EmptyState
          title='No runs yet'
          description='Submit a run against a dataset and pipeline version to populate the history.'
          action={
            <Link href='/app/runs/new' className='btn btn-primary btn-sm'>
              New run
            </Link>
          }
        />
      ) : (
        <DataTable columns={runColumns} rows={runItems} getRowKey={(run) => run.id} />
      )}
    </div>
  );
};
