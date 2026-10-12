'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';

import { Card } from '@/components/atoms/card';
import { CopyButton } from '@/components/atoms/copy-button';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { MetadataGrid, type MetadataItem } from '@/components/atoms/metadata-grid';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchPipeline, fetchPipelineVersions, toErrorMessage } from '@/lib/api';
import type { PipelineParameter, PipelineStep, PipelineVersion } from '@/lib/api/types';
import { formatChecksum, formatDateTime, formatRelativeTime } from '@/lib/format';
import { pipelineVersionStatusLabel, pipelineVersionStatusTone } from '@/lib/status';

const formatParamValue = (value: unknown): string => {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatParamValue(item)).join(', ');
  }
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
};

const StepBlock = ({ step }: { step: PipelineStep }) => {
  const entries = Object.entries(step.params);
  return (
    <div className='border-border rounded-md border'>
      <div className='border-border bg-surface-muted flex items-center gap-2 border-b px-3 py-2'>
        <span className='text-text-primary font-mono text-[13px]'>{step.name}</span>
        <span className='bg-surface-raised text-text-secondary rounded px-1.5 text-[11px]'>
          {step.type}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className='text-text-muted px-3 py-2 text-[12px]'>No parameters</p>
      ) : (
        <div className='grid gap-x-6 gap-y-1 px-3 py-2 sm:grid-cols-2'>
          {entries.map(([key, value]) => (
            <div key={key} className='flex items-center justify-between gap-3 text-[12px]'>
              <span className='text-text-muted font-mono'>{key}</span>
              <span className='text-text-secondary truncate font-mono'>
                {formatParamValue(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const VersionCard = ({ version, isLatest }: { version: PipelineVersion; isLatest: boolean }) => {
  const parameterColumns: DataTableColumn<PipelineParameter>[] = [
    {
      key: 'name',
      header: 'Parameter',
      render: (parameter) => <span className='font-mono text-[13px]'>{parameter.name}</span>,
    },
    {
      key: 'label',
      header: 'Label',
      render: (parameter) => (
        <span className='text-text-secondary text-[13px]'>{parameter.label}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (parameter) => (
        <span className='text-text-muted font-mono text-[12px]'>{parameter.type}</span>
      ),
    },
    {
      key: 'default',
      header: 'Default',
      render: (parameter) => (
        <span className='font-mono text-[12px]'>{formatParamValue(parameter.default)}</span>
      ),
    },
    {
      key: 'required',
      header: 'Required',
      render: (parameter) =>
        parameter.required ? (
          <span className='bg-warning-muted text-warning rounded px-1.5 text-[11px]'>required</span>
        ) : (
          <span className='text-text-muted text-[12px]'>no</span>
        ),
    },
    {
      key: 'unit',
      header: 'Unit',
      render: (parameter) => (
        <span className='text-text-muted font-mono text-[12px]'>{parameter.unit ?? '—'}</span>
      ),
    },
    {
      key: 'options',
      header: 'Options',
      render: (parameter) =>
        parameter.options && parameter.options.length > 0 ? (
          <span className='text-text-muted font-mono text-[12px]'>
            {parameter.options.join(' · ')}
          </span>
        ) : (
          <span className='text-text-muted text-[12px]'>—</span>
        ),
    },
  ];

  return (
    <section className='border-border bg-surface rounded-lg border'>
      <div className='border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <h3 className='font-mono text-[14px] font-semibold'>v{version.version}</h3>
          <StatusBadge
            tone={pipelineVersionStatusTone(version.status)}
            label={pipelineVersionStatusLabel(version.status)}
          />
          {isLatest ? (
            <span className='bg-accent-muted text-accent rounded px-1.5 text-[11px] font-medium'>
              latest
            </span>
          ) : null}
        </div>
        <span className='text-text-muted text-[12px]'>
          Created {formatRelativeTime(version.created_at)}
        </span>
      </div>

      <div className='space-y-5 p-4'>
        {version.changelog ? (
          <p className='text-text-secondary text-[13px]'>{version.changelog}</p>
        ) : null}
        <div className='flex items-center gap-2 text-[13px]'>
          <span className='text-text-muted'>Image digest</span>
          <span className='text-text-secondary font-mono text-[12px]'>
            {formatChecksum(version.image_digest)}
          </span>
          <CopyButton value={version.image_digest} />
        </div>
        {isLatest ? (
          <>
            <div>
              <h4 className='text-text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase'>
                Parameters
              </h4>
              {version.parameters.length === 0 ? (
                <p className='text-text-secondary text-[13px]'>
                  This version defines no configurable parameters.
                </p>
              ) : (
                <DataTable
                  columns={parameterColumns}
                  rows={version.parameters}
                  getRowKey={(parameter) => parameter.name}
                />
              )}
            </div>
            <div>
              <h4 className='text-text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase'>
                Steps
              </h4>
              {version.steps.length === 0 ? (
                <p className='text-text-secondary text-[13px]'>This version defines no steps.</p>
              ) : (
                <div className='space-y-3'>
                  {version.steps.map((step) => (
                    <StepBlock key={step.name} step={step} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};

export const PipelineDetailView = ({ pipelineId }: { pipelineId: string }) => {
  const pipelineQuery = useQuery({
    queryKey: ['pipeline', pipelineId],
    queryFn: () => fetchPipeline(pipelineId),
  });
  const versionsQuery = useQuery({
    queryKey: ['pipeline-versions', pipelineId],
    queryFn: () => fetchPipelineVersions(pipelineId),
  });

  const versionItems = useMemo(() => versionsQuery.data?.items ?? [], [versionsQuery.data]);
  const pipeline = pipelineQuery.data;

  const latestVersion = useMemo(() => {
    if (!pipeline) {
      return null;
    }
    const byReference = versionItems.find((item) => item.id === pipeline.latest_version?.id);
    return byReference ?? versionItems[0] ?? pipeline.latest_version ?? null;
  }, [pipeline, versionItems]);

  if (pipelineQuery.isLoading) {
    return <LoadingState label='Loading pipeline…' />;
  }
  if (pipelineQuery.isError) {
    return <ErrorState message={toErrorMessage(pipelineQuery.error)} />;
  }
  if (!pipeline) {
    return (
      <div className='flex flex-col gap-6'>
        <PageHeader
          title='Pipeline'
          breadcrumbs={[{ label: 'Pipelines', href: '/app/pipelines' }, { label: 'Not found' }]}
        />
        <EmptyState
          title='Pipeline not found'
          description='This pipeline may have been removed or you no longer have access.'
          action={
            <Link href='/app/pipelines' className='btn btn-outline btn-sm'>
              Back to pipelines
            </Link>
          }
        />
      </div>
    );
  }

  const provenanceItems: MetadataItem[] = [
    { label: 'Kind', value: pipeline.kind, mono: true },
    { label: 'Versions', value: pipeline.version_count, mono: true },
    { label: 'Runs', value: pipeline.run_count, mono: true },
    { label: 'Created', value: formatDateTime(pipeline.created_at), mono: true },
    { label: 'Updated', value: formatDateTime(pipeline.updated_at), mono: true },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={pipeline.name}
        description={pipeline.description ?? 'No description provided.'}
        breadcrumbs={[{ label: 'Pipelines', href: '/app/pipelines' }, { label: pipeline.name }]}
        actions={
          <Link href={`/app/runs/new?pipeline=${pipeline.id}`} className='btn btn-primary btn-sm'>
            Run pipeline
          </Link>
        }>
        <div className='text-text-secondary flex flex-wrap items-center gap-3 text-[13px]'>
          {latestVersion ? (
            <StatusBadge
              tone={pipelineVersionStatusTone(latestVersion.status)}
              label={pipelineVersionStatusLabel(latestVersion.status)}
            />
          ) : null}
          <span className='text-text-muted font-mono text-[12px]'>{pipeline.id}</span>
          <span>Updated {formatRelativeTime(pipeline.updated_at)}</span>
        </div>
      </PageHeader>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
        <div className='space-y-6 xl:col-span-2'>
          <div className='space-y-4'>
            <h2 className='text-text-primary text-[15px] font-semibold'>Versions</h2>
            {versionsQuery.isLoading ? (
              <LoadingState label='Loading versions…' />
            ) : versionItems.length === 0 ? (
              <EmptyState
                title='No versions published'
                description='This pipeline has not published any versions yet.'
              />
            ) : (
              versionItems.map((version) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  isLatest={latestVersion?.id === version.id}
                />
              ))
            )}
          </div>
        </div>

        <div className='space-y-6'>
          <Card title='Provenance'>
            <MetadataGrid columns={1} items={provenanceItems} />
          </Card>
          <Card title='Tools'>
            <div className='grid gap-2'>
              <Link
                href={`/app/runs/new?pipeline=${pipeline.id}`}
                className='btn btn-primary btn-sm justify-start'>
                Run pipeline
              </Link>
              <Link href='/app/pipelines' className='btn btn-ghost btn-sm justify-start'>
                Back to pipelines
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
