'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { CopyButton } from '@/components/atoms/copy-button';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { MetadataGrid, type MetadataItem } from '@/components/atoms/metadata-grid';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import {
  cancelRun,
  fetchRun,
  fetchRunArtifacts,
  fetchRunLogs,
  rerun,
  toErrorMessage,
} from '@/lib/api';
import type { Artifact, RunLogLine } from '@/lib/api/types';
import {
  formatBytes,
  formatChecksum,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatRelativeTime,
} from '@/lib/format';
import { runStatusLabel, runStatusTone } from '@/lib/status';

const SEVERITY_CLASSES: Record<RunLogLine['severity'], string> = {
  debug: 'text-text-muted',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-danger',
};

const timeOf = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(11, 19);
};

const parameterEntries = (parameters: Record<string, unknown>): { key: string; value: string }[] =>
  Object.entries(parameters).map(([key, value]) => ({
    key,
    value:
      value === null || value === undefined
        ? '—'
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value),
  }));

export const RunDetailView = ({ runId }: { runId: string }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  const runQuery = useQuery({ queryKey: ['run', runId], queryFn: () => fetchRun(runId) });
  const logsQuery = useQuery({ queryKey: ['run-logs', runId], queryFn: () => fetchRunLogs(runId) });
  const artifactsQuery = useQuery({
    queryKey: ['run-artifacts', runId],
    queryFn: () => fetchRunArtifacts(runId),
  });

  const logItems = useMemo(() => logsQuery.data?.items ?? [], [logsQuery.data]);
  const artifactItems = useMemo(() => artifactsQuery.data?.items ?? [], [artifactsQuery.data]);

  const cancelMutation = useMutation({
    mutationFn: () => cancelRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['run', runId] });
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      showToast({ title: 'Run cancelled', tone: 'success' });
    },
    onError: (error) => {
      showToast({
        title: 'Could not cancel run',
        description: toErrorMessage(error),
        tone: 'danger',
      });
    },
  });

  const rerunMutation = useMutation({
    mutationFn: () => rerun(runId),
    onSuccess: (next) => {
      queryClient.invalidateQueries({ queryKey: ['runs'] });
      showToast({
        title: 'Run resubmitted',
        description: `A new run was queued from ${runId}.`,
        tone: 'success',
      });
      router.push(`/app/runs/${next.id}`);
    },
    onError: (error) => {
      showToast({
        title: 'Could not re-run',
        description: toErrorMessage(error),
        tone: 'danger',
      });
    },
  });

  if (runQuery.isLoading) {
    return <LoadingState label='Loading run…' />;
  }
  if (runQuery.isError) {
    return <ErrorState message={toErrorMessage(runQuery.error)} />;
  }

  const run = runQuery.data;
  if (!run) {
    return (
      <EmptyState
        title='Run not found'
        description='This run may have been removed or you no longer have access.'
        action={
          <Link href='/app/experiments' className='btn btn-outline btn-sm'>
            Back to experiments
          </Link>
        }
      />
    );
  }

  const metadataItems: MetadataItem[] = [
    { label: 'Pipeline', value: `${run.pipeline_name} · v${run.pipeline_version}` },
    { label: 'Dataset', value: `${run.dataset_name} · ${run.dataset_version}`, mono: true },
    { label: 'Requested', value: formatDateTime(run.requested_at) },
    {
      label: 'Duration',
      value:
        run.duration_s !== null
          ? formatDuration(run.duration_s)
          : formatElapsed(run.started_at, run.finished_at),
    },
    { label: 'Artifacts', value: String(run.artifacts_count), mono: true },
  ];

  const artifactColumns: DataTableColumn<Artifact>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (artifact) => <span className='font-mono text-[13px]'>{artifact.name}</span>,
    },
    {
      key: 'media_type',
      header: 'Media type',
      render: (artifact) => (
        <span className='text-text-secondary text-[13px]'>{artifact.media_type}</span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      className: 'text-right',
      render: (artifact) => (
        <span className='font-mono text-[13px]'>{formatBytes(artifact.size_bytes)}</span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (artifact) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(artifact.created_at)}
        </span>
      ),
    },
    {
      key: 'checksum',
      header: 'Checksum',
      render: (artifact) => (
        <span className='flex items-center gap-1'>
          <span className='text-text-muted font-mono text-[12px]'>
            {formatChecksum(artifact.checksum)}
          </span>
          <CopyButton value={artifact.checksum} />
        </span>
      ),
    },
  ];

  const timeline = [
    { label: 'Queued', at: run.requested_at, done: true },
    { label: 'Running', at: run.started_at, done: run.started_at !== null },
    { label: runStatusLabel(run.status), at: run.finished_at, done: run.finished_at !== null },
  ];

  const parameterRows = parameterEntries(run.parameters);
  const canCancel = run.status === 'running' || run.status === 'queued';

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={`${run.pipeline_name} · v${run.pipeline_version}`}
        description={`Dataset: ${run.dataset_name} · ${run.dataset_version}`}
        breadcrumbs={[{ label: 'Experiments', href: '/app/experiments' }, { label: run.id }]}
        actions={
          <>
            <Button
              variant='secondary'
              size='sm'
              onClick={() => rerunMutation.mutate()}
              disabled={rerunMutation.isPending}>
              {rerunMutation.isPending ? 'Re-running…' : 'Re-run'}
            </Button>
            {canCancel ? (
              <Button
                variant='secondary'
                size='sm'
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}>
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
              </Button>
            ) : null}
          </>
        }>
        <div className='text-text-secondary flex flex-wrap items-center gap-3 text-[13px]'>
          <span className='text-text-muted text-[12px] font-semibold tracking-wider uppercase'>
            Run
          </span>
          <span className='text-text-muted font-mono text-[12px]'>{run.id}</span>
          <StatusBadge tone={runStatusTone(run.status)} label={runStatusLabel(run.status)} />
          <CopyButton value={run.id} />
        </div>
      </PageHeader>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-6'>
          <Card title='Metadata'>
            <MetadataGrid items={metadataItems} columns={2} />
          </Card>

          <Card title='Status timeline'>
            <ol className='flex flex-wrap items-center gap-3 text-[13px]'>
              {timeline.map((step, index) => (
                <li key={step.label} className='flex items-center gap-2'>
                  {index > 0 ? <span className='text-text-muted'>→</span> : null}
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      step.done ? 'border-success text-success' : 'border-border text-text-muted'
                    }`}>
                    {step.done ? '✓' : '·'}
                  </span>
                  <span className='text-text-primary'>{step.label}</span>
                  <span className='text-text-muted font-mono text-[12px]'>
                    {step.at ? timeOf(step.at) : '—'}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card title='Parameters'>
            {parameterRows.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No parameters recorded.</p>
            ) : (
              <div className='overflow-x-auto'>
                <table className='table-sm table w-full'>
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parameterRows.map((entry) => (
                      <tr key={entry.key}>
                        <td className='font-mono text-[13px]'>{entry.key}</td>
                        <td className='text-text-secondary font-mono text-[12px]'>{entry.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title='Logs'>
            {logsQuery.isLoading ? (
              <LoadingState label='Loading logs…' />
            ) : logItems.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No log lines recorded yet.</p>
            ) : (
              <div className='border-border bg-background max-h-[420px] overflow-auto rounded-lg border'>
                {logItems.map((line, index) => (
                  <div
                    key={`${line.timestamp}-${index}`}
                    className='hover:bg-surface grid grid-cols-[88px_64px_1fr] gap-3 px-3 py-0.5 font-mono text-[12.5px] leading-5'>
                    <span className='text-text-muted'>{timeOf(line.timestamp)}</span>
                    <span className={SEVERITY_CLASSES[line.severity]}>
                      {line.severity.toUpperCase()}
                    </span>
                    <span className='text-text-primary'>
                      [{line.operation}] {line.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className='space-y-4'>
          <Card
            title='Artifacts'
            actions={
              <span className='text-text-muted text-[12px]'>
                {artifactItems.length} {artifactItems.length === 1 ? 'output' : 'outputs'}
              </span>
            }>
            {artifactsQuery.isLoading ? (
              <LoadingState label='Loading artifacts…' />
            ) : artifactItems.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No artifacts produced.</p>
            ) : (
              <DataTable
                columns={artifactColumns}
                rows={artifactItems}
                getRowKey={(artifact) => artifact.id}
              />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
};
