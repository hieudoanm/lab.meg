'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@/components/atoms/button';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchPipelines, fetchRuns, toErrorMessage } from '@/lib/api';
import type { ExperimentRun, RunStatus } from '@/lib/api/types';
import { formatDuration, formatIdentifier, formatRelativeTime } from '@/lib/format';
import { runStatusLabel, runStatusTone } from '@/lib/status';

const STATUS_OPTIONS: { value: RunStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Status: All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const StatTile = ({ label, value, tone }: { label: string; value: number; tone: string }) => {
  return (
    <div className='border-border bg-surface rounded-lg border p-4'>
      <p className='text-text-muted text-[12px] font-medium tracking-wide uppercase'>{label}</p>
      <p className={`mt-2 text-[24px] font-semibold ${tone}`}>{value}</p>
    </div>
  );
};

export const ExperimentsView = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const [pipelineId, setPipelineId] = useState('all');

  const runsQuery = useQuery({
    queryKey: ['runs', { limit: 50 }],
    queryFn: () => fetchRuns({ limit: 50 }),
  });
  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', { limit: 50 }],
    queryFn: () => fetchPipelines({ limit: 50 }),
  });

  const runItems = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);
  const pipelineItems = useMemo(() => pipelinesQuery.data?.items ?? [], [pipelinesQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return runItems.filter((run) => {
      const matchesTerm =
        term.length === 0 ||
        run.id.toLowerCase().includes(term) ||
        run.pipeline_name.toLowerCase().includes(term) ||
        run.dataset_name.toLowerCase().includes(term);
      const matchesStatus = status === 'all' || run.status === status;
      const matchesPipeline = pipelineId === 'all' || run.pipeline_id === pipelineId;
      return matchesTerm && matchesStatus && matchesPipeline;
    });
  }, [runItems, search, status, pipelineId]);

  if (runsQuery.isLoading) {
    return <LoadingState label='Loading run history…' />;
  }
  if (runsQuery.isError) {
    return <ErrorState message={toErrorMessage(runsQuery.error)} />;
  }

  const total = runItems.length;
  const succeeded = runItems.filter((run) => run.status === 'succeeded').length;
  const running = runItems.filter((run) => run.status === 'running').length;
  const failed = runItems.filter((run) => run.status === 'failed').length;

  const columns: DataTableColumn<ExperimentRun>[] = [
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

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Run history'
        description='Every run in this workspace, filterable by status and pipeline. Runs are immutable and reproducible from their manifest.'
        breadcrumbs={[{ label: 'Experiments' }]}
        actions={
          <>
            <Button variant='secondary' size='sm'>
              Export CSV
            </Button>
            <Link href='/app/runs/new' className='btn btn-primary btn-sm'>
              New run
            </Link>
          </>
        }
      />

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile label='Total' value={total} tone='text-text-primary' />
        <StatTile label='Succeeded' value={succeeded} tone='text-success' />
        <StatTile label='Running' value={running} tone='text-info' />
        <StatTile label='Failed' value={failed} tone='text-danger' />
      </div>

      <div className='card border-border bg-surface rounded-lg border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search runs by id, pipeline, or dataset…'
            aria-label='Search runs'
            className='input input-bordered bg-surface-muted h-9 min-w-[240px] flex-1 text-[13px]'
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as RunStatus | 'all')}
            aria-label='Filter by status'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={pipelineId}
            onChange={(event) => setPipelineId(event.target.value)}
            aria-label='Filter by pipeline'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            <option value='all'>Pipeline: All</option>
            {pipelineItems.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
          <div className='text-text-secondary ml-auto text-[13px]'>
            <span className='font-mono'>{filtered.length}</span> runs
          </div>
        </div>
      </div>

      {runItems.length === 0 ? (
        <EmptyState
          title='No runs yet'
          description='Submit a run against a dataset and pipeline version to populate the history.'
          action={
            <Link href='/app/runs/new' className='btn btn-primary btn-sm'>
              New run
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResultsState description='No runs match the current filters.' />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(run) => run.id} />
      )}
    </div>
  );
};
