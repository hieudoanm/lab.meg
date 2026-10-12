'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchDatasets, toErrorMessage } from '@/lib/api';
import type { Dataset, DatasetStatus, Recording } from '@/lib/api/types';
import { formatDuration, formatRelativeTime } from '@/lib/format';
import { datasetStatusLabel, datasetStatusTone } from '@/lib/status';

interface DatasetListRow extends Dataset {
  recording?: Recording | null;
}

const STATUS_FILTERS: { value: 'all' | DatasetStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'validating', label: 'Validating' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
];

export const DatasetsView = () => {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | DatasetStatus>('all');

  const query = useQuery({
    queryKey: ['datasets', { limit: 50 }],
    queryFn: () => fetchDatasets({ limit: 50 }),
  });

  const items = useMemo<DatasetListRow[]>(() => query.data?.items ?? [], [query.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((dataset) => {
      const matchesTerm =
        term.length === 0 ||
        dataset.name.toLowerCase().includes(term) ||
        (dataset.description?.toLowerCase().includes(term) ?? false);
      const matchesStatus = status === 'all' || dataset.status === status;
      return matchesTerm && matchesStatus;
    });
  }, [items, search, status]);

  if (query.isLoading) {
    return <LoadingState label='Loading datasets…' />;
  }
  if (query.isError) {
    return <ErrorState message={toErrorMessage(query.error)} />;
  }

  const columns: DataTableColumn<DatasetListRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (dataset) => (
        <div className='flex flex-col gap-0.5'>
          <Link
            href={`/app/datasets/${dataset.id}`}
            className='text-text-primary hover:text-accent font-medium'>
            {dataset.name}
          </Link>
          {dataset.description ? (
            <span className='text-text-muted text-[12px]'>{dataset.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'format',
      header: 'Format',
      render: (dataset) => (
        <span className='font-mono text-[13px]'>
          {dataset.recording?.format ?? dataset.current_dataset_version?.format ?? '—'}
        </span>
      ),
    },
    {
      key: 'channels',
      header: 'Channels',
      className: 'text-right',
      render: (dataset) => (
        <span className='font-mono text-[13px]'>
          {dataset.recording ? `${dataset.recording.n_channels_total} ch` : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      className: 'text-right',
      render: (dataset) => (
        <span className='text-text-secondary font-mono text-[13px]'>
          {formatDuration(dataset.recording?.duration_s)}
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

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Datasets'
        description='Recordings uploaded to your projects, with validation status and acquisition metadata.'
        actions={
          <Link href='/app/datasets/new' className='btn btn-primary btn-sm'>
            Upload recording
          </Link>
        }
      />

      <div className='card border-border bg-surface rounded-lg border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search datasets by name or description…'
            aria-label='Search datasets'
            className='input input-bordered bg-surface-muted h-9 min-w-[240px] flex-1 text-[13px]'
          />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            aria-label='Filter by status'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title='No datasets yet'
          description='Upload a recording to validate acquisition metadata and start analysing.'
          action={
            <Link href='/app/datasets/new' className='btn btn-primary btn-sm'>
              Upload recording
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <NoResultsState description='No datasets match the current filters.' />
      ) : (
        <DataTable columns={columns} rows={filtered} getRowKey={(dataset) => dataset.id} />
      )}
    </div>
  );
};
