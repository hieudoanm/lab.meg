'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';

import { Card } from '@/components/atoms/card';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchPipelines, fetchRuns, toErrorMessage } from '@/lib/api';
import type { ExperimentRun, Pipeline } from '@/lib/api/types';
import { formatIdentifier, formatRelativeTime } from '@/lib/format';
import { runStatusLabel, runStatusTone } from '@/lib/status';

const PipelineNotebookCard = ({ pipeline }: { pipeline: Pipeline }) => {
  const version = pipeline.latest_version;
  return (
    <Link
      href={`/app/pipelines/${pipeline.id}`}
      className='card border-border bg-surface hover:border-border-strong flex flex-col rounded-lg border p-4 transition'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span
            aria-hidden='true'
            className='bg-accent-muted text-accent flex h-9 w-9 items-center justify-center rounded-md text-[12px] font-semibold'>
            nb
          </span>
          <div>
            <h2 className='text-text-primary text-[15px] font-semibold'>{pipeline.name}</h2>
            <p className='text-text-muted font-mono text-[12px]'>
              {version ? `v${version.version}` : 'no version'}
            </p>
          </div>
        </div>
        <span className='bg-surface-muted text-text-secondary rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
          {pipeline.kind}
        </span>
      </div>
      <p className='text-text-secondary mt-3 line-clamp-2 text-[13px]'>
        {pipeline.description ?? 'No description.'}
      </p>
      <div className='text-text-muted mt-3 flex items-center gap-3 text-[12px]'>
        <span>{version ? `${version.parameters.length} parameters` : '—'}</span>
        <span>{version ? `${version.steps.length} steps` : '—'}</span>
        <span className='ml-auto'>{pipeline.run_count} runs</span>
      </div>
    </Link>
  );
};

const runColumns: DataTableColumn<ExperimentRun>[] = [
  {
    key: 'run',
    header: 'Run',
    render: (run) => (
      <Link
        href={`/app/runs/${run.id}`}
        className='text-text-secondary hover:text-accent font-mono text-[12px]'>
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
      <span className='text-text-secondary text-[13px]'>
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
    key: 'submitted',
    header: 'Submitted',
    className: 'text-right',
    render: (run) => (
      <span className='text-text-muted font-mono text-[12px]'>
        {formatRelativeTime(run.requested_at)}
      </span>
    ),
  },
];

export const NotebooksView = () => {
  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', { limit: 50 }],
    queryFn: () => fetchPipelines({ limit: 50 }),
  });
  const runsQuery = useQuery({
    queryKey: ['runs', { limit: 50 }],
    queryFn: () => fetchRuns({ limit: 50 }),
  });

  const pipelines = useMemo(() => pipelinesQuery.data?.items ?? [], [pipelinesQuery.data]);
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);

  const recentRuns = useMemo(() => runs.slice(0, 8), [runs]);

  const isLoading = pipelinesQuery.isLoading || runsQuery.isLoading;
  const isError = pipelinesQuery.isError || runsQuery.isError;
  const error = pipelinesQuery.error ?? runsQuery.error;

  if (isLoading) {
    return <LoadingState label='Loading notebooks…' />;
  }
  if (isError) {
    return <ErrorState message={toErrorMessage(error)} />;
  }

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Notebooks'
        description='Reproducible analysis notebooks. Each pipeline version records the parameters, steps, and runs that produced a result.'
        actions={
          <Link href='/app/pipelines' className='btn btn-outline btn-sm'>
            Browse pipelines
          </Link>
        }
      />

      <Card
        title='Interactive notebooks'
        description='Not available yet — reproducible analyses run through published pipelines.'>
        <p className='text-text-secondary text-[13px]'>
          Interactive, executable notebooks are not available in this prototype. Until they are, use
          published pipelines and their recorded runs to reproduce an analysis end to end.
        </p>
        <div className='mt-4 flex flex-wrap gap-2'>
          <Link href='/app/pipelines' className='btn btn-primary btn-sm'>
            Go to Pipelines
          </Link>
          <Link href='/app/experiments' className='btn btn-outline btn-sm'>
            Experiment runs
          </Link>
        </div>
      </Card>

      {pipelines.length === 0 ? (
        <EmptyState
          title='No notebooks yet'
          description='Publish a pipeline to turn it into a reproducible analysis you can re-run against your recordings.'
          action={
            <Link href='/app/pipelines' className='btn btn-primary btn-sm'>
              Browse pipelines
            </Link>
          }
        />
      ) : (
        <section className='flex flex-col gap-4'>
          <div>
            <h2 className='text-text-primary text-[15px] font-semibold'>Reproducible analyses</h2>
            <p className='text-text-muted text-[12px]'>
              Published pipelines available to run against your recordings.
            </p>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
            {pipelines.map((pipeline) => (
              <PipelineNotebookCard key={pipeline.id} pipeline={pipeline} />
            ))}
          </div>
        </section>
      )}

      {recentRuns.length > 0 ? (
        <section className='flex flex-col gap-4'>
          <div className='flex items-end justify-between'>
            <div>
              <h2 className='text-text-primary text-[15px] font-semibold'>Recent executions</h2>
              <p className='text-text-muted text-[12px]'>
                Runs you can reopen and re-execute against the same inputs.
              </p>
            </div>
            <Link
              href='/app/experiments'
              className='text-accent hover:text-accent-hover text-[13px] font-medium'>
              View all
            </Link>
          </div>
          <DataTable columns={runColumns} rows={recentRuns} getRowKey={(run) => run.id} />
        </section>
      ) : null}
    </div>
  );
};
