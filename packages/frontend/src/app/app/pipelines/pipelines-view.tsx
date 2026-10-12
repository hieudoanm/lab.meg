'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchPipelines, toErrorMessage } from '@/lib/api';
import type { Pipeline, PipelineVersionStatus } from '@/lib/api/types';
import { formatRelativeTime } from '@/lib/format';
import { pipelineVersionStatusLabel, pipelineVersionStatusTone } from '@/lib/status';

type StatusFilter = 'all' | PipelineVersionStatus;
type SortOrder = 'updated' | 'created' | 'name';

const StatTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => {
  return (
    <div className='border-border bg-surface rounded-lg border p-4'>
      <p className='text-text-muted text-[12px] font-medium tracking-wide uppercase'>{label}</p>
      <p className='text-text-primary mt-2 text-2xl font-semibold'>{value}</p>
      {hint ? <p className='text-text-secondary mt-1 text-[12px]'>{hint}</p> : null}
    </div>
  );
};

export const PipelinesView = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOrder>('updated');

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', { limit: 50 }],
    queryFn: () => fetchPipelines({ limit: 50 }),
  });

  const items = useMemo(() => pipelinesQuery.data?.items ?? [], [pipelinesQuery.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((pipeline) => {
      const matchesTerm =
        term.length === 0 ||
        pipeline.name.toLowerCase().includes(term) ||
        (pipeline.description?.toLowerCase().includes(term) ?? false);
      const matchesStatus = status === 'all' || pipeline.latest_version?.status === status;
      return matchesTerm && matchesStatus;
    });
  }, [items, search, status]);

  const sorted = useMemo(() => {
    const base = [...filtered];
    base.sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'created') {
        return b.created_at.localeCompare(a.created_at);
      }
      return b.updated_at.localeCompare(a.updated_at);
    });
    return base;
  }, [filtered, sortBy]);

  const totalVersions = items.reduce((sum, pipeline) => sum + pipeline.version_count, 0);
  const totalRuns = items.reduce((sum, pipeline) => sum + pipeline.run_count, 0);
  const publishedCount = items.filter(
    (pipeline) => pipeline.latest_version?.status === 'published',
  ).length;

  if (pipelinesQuery.isLoading) {
    return <LoadingState label='Loading pipelines…' />;
  }
  if (pipelinesQuery.isError) {
    return <ErrorState message={toErrorMessage(pipelinesQuery.error)} />;
  }

  const columns: DataTableColumn<Pipeline>[] = [
    {
      key: 'pipeline',
      header: 'Pipeline',
      render: (pipeline) => (
        <div className='flex flex-col gap-0.5'>
          <div className='flex items-center gap-2'>
            <Link
              href={`/app/pipelines/${pipeline.id}`}
              className='text-text-primary hover:text-accent font-medium'>
              {pipeline.name}
            </Link>
            <span className='bg-accent-muted text-accent rounded px-1.5 text-[11px] font-medium'>
              {pipeline.kind}
            </span>
          </div>
          {pipeline.description ? (
            <span className='text-text-muted line-clamp-1 text-[12px]'>{pipeline.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      render: (pipeline) =>
        pipeline.latest_version ? (
          <div className='flex items-center gap-2'>
            <span className='font-mono text-[13px]'>{pipeline.latest_version.version}</span>
            <StatusBadge
              tone={pipelineVersionStatusTone(pipeline.latest_version.status)}
              label={pipelineVersionStatusLabel(pipeline.latest_version.status)}
            />
          </div>
        ) : (
          <span className='text-text-muted text-[13px]'>—</span>
        ),
    },
    {
      key: 'versions',
      header: 'Versions',
      className: 'text-right',
      render: (pipeline) => <span className='font-mono text-[13px]'>{pipeline.version_count}</span>,
    },
    {
      key: 'runs',
      header: 'Runs',
      className: 'text-right',
      render: (pipeline) => <span className='font-mono text-[13px]'>{pipeline.run_count}</span>,
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (pipeline) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(pipeline.updated_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (pipeline) => (
        <div className='flex items-center justify-end gap-2'>
          <Link href={`/app/pipelines/${pipeline.id}`} className='btn btn-ghost btn-sm'>
            View
          </Link>
          <Link href={`/app/runs/new?pipeline=${pipeline.id}`} className='btn btn-outline btn-sm'>
            Run now
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Project pipelines'
        description='Manage reusable preprocessing and analysis templates built with MNE-Python. Published versions are immutable and can be used to submit runs.'
        actions={
          <button
            type='button'
            disabled
            title='Creating pipelines is not available yet'
            className='btn btn-outline btn-sm'>
            New pipeline
          </button>
        }
      />

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile label='Pipelines' value={String(items.length)} />
        <StatTile label='Versions' value={String(totalVersions)} />
        <StatTile label='Runs' value={String(totalRuns)} />
        <StatTile label='Published' value={String(publishedCount)} hint='latest versions' />
      </div>

      <section className='border-border bg-surface rounded-lg border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search pipelines by name or description…'
            aria-label='Search pipelines'
            className='input input-bordered bg-surface-muted h-9 min-w-[260px] flex-1 text-[13px]'
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            aria-label='Filter by status'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            <option value='all'>Status: all</option>
            <option value='published'>Published</option>
            <option value='draft'>Draft</option>
            <option value='deprecated'>Deprecated</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOrder)}
            aria-label='Sort pipelines'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            <option value='updated'>Sort: updated (desc)</option>
            <option value='created'>Created (desc)</option>
            <option value='name'>Name (A-Z)</option>
          </select>
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState
          title='No pipelines yet'
          description='Create a pipeline to define reusable MNE-Python preprocessing and analysis templates.'
        />
      ) : sorted.length === 0 ? (
        <NoResultsState description='No pipelines match the current filters.' />
      ) : (
        <DataTable columns={columns} rows={sorted} getRowKey={(pipeline) => pipeline.id} />
      )}
    </div>
  );
};
