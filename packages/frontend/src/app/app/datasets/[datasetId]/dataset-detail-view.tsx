'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';

import { Card } from '@/components/atoms/card';
import { CopyButton } from '@/components/atoms/copy-button';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { MetadataGrid, type MetadataItem } from '@/components/atoms/metadata-grid';
import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import {
  fetchDataset,
  fetchDatasetRecordings,
  fetchDatasetVersions,
  fetchRecordingEventSets,
  toErrorMessage,
} from '@/lib/api';
import type { DatasetVersion, EventSet, FileAsset, SensorType } from '@/lib/api/types';
import {
  formatBytes,
  formatChecksum,
  formatCoordinateFrame,
  formatDateTime,
  formatDuration,
  formatFrequency,
  formatRelativeTime,
} from '@/lib/format';
import {
  datasetStatusLabel,
  datasetStatusTone,
  datasetVersionStatusLabel,
  datasetVersionStatusTone,
} from '@/lib/status';

const SENSOR_LABELS: Record<SensorType, string> = {
  neuromag_vectorview: 'SQUID-MEG',
  opm_ucl_fil: 'OPM',
  ctf: 'CTF-MEG',
  kit: 'KIT-MEG',
};

const EventSetBlock = ({ eventSet }: { eventSet: EventSet }) => {
  const preview = eventSet.events.slice(0, 6);
  return (
    <div className='border-border rounded-md border'>
      <div className='border-border flex items-center justify-between border-b px-3 py-2'>
        <div className='flex items-center gap-2'>
          <span className='text-text-primary font-mono text-[13px]'>{eventSet.name}</span>
          <span className='bg-surface-muted text-text-secondary rounded px-1.5 text-[11px]'>
            {eventSet.source}
          </span>
        </div>
        <span className='text-text-muted text-[12px]'>{eventSet.events.length} events</span>
      </div>
      <div className='overflow-x-auto'>
        <table className='table-sm table w-full'>
          <thead>
            <tr>
              <th>Event</th>
              <th className='text-right'>Time</th>
              <th className='text-right'>Sample</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((event) => (
              <tr key={event.id}>
                <td className='font-mono text-[12px]'>{event.id}</td>
                <td className='text-text-secondary text-right font-mono text-[12px]'>
                  {event.time_s.toFixed(3)} s
                </td>
                <td className='text-text-muted text-right font-mono text-[12px]'>{event.sample}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProvenanceRow = ({ label, value }: { label: string; value: ReactNode }) => {
  return (
    <div className='flex items-start justify-between gap-3 text-[13px]'>
      <span className='text-text-muted'>{label}</span>
      <span className='text-text-primary text-right'>{value}</span>
    </div>
  );
};

export const DatasetDetailView = ({ datasetId }: { datasetId: string }) => {
  const datasetQuery = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => fetchDataset(datasetId),
  });
  const versionsQuery = useQuery({
    queryKey: ['dataset-versions', datasetId],
    queryFn: () => fetchDatasetVersions(datasetId),
  });
  const recordingsQuery = useQuery({
    queryKey: ['dataset-recordings', datasetId],
    queryFn: () => fetchDatasetRecordings(datasetId),
  });

  const detail = datasetQuery.data;
  const recordingItems = useMemo(() => recordingsQuery.data?.items ?? [], [recordingsQuery.data]);
  const recording = detail?.recording ?? recordingItems[0] ?? null;
  const recordingId = recording?.id ?? '';
  const fileAssets = useMemo(() => detail?.file_assets ?? [], [detail]);
  const versionItems = useMemo(() => versionsQuery.data?.items ?? [], [versionsQuery.data]);

  const eventsQuery = useQuery({
    queryKey: ['recording-event-sets', recordingId],
    queryFn: () => fetchRecordingEventSets(recordingId),
    enabled: recordingId.length > 0,
  });
  const eventSets = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data]);

  if (datasetQuery.isLoading) {
    return <LoadingState label='Loading dataset…' />;
  }
  if (datasetQuery.isError) {
    return <ErrorState message={toErrorMessage(datasetQuery.error)} />;
  }
  if (!detail) {
    return (
      <EmptyState
        title='Dataset not found'
        description='This dataset may have been removed or you no longer have access.'
        action={
          <Link href='/app/datasets' className='btn btn-outline btn-sm'>
            Back to datasets
          </Link>
        }
      />
    );
  }

  const version = detail.current_dataset_version;

  const metadataItems: MetadataItem[] = recording
    ? [
        { label: 'Format', value: recording.format, mono: true },
        {
          label: 'Sampling rate',
          value: formatFrequency(recording.sampling_frequency_hz),
          mono: true,
        },
        { label: 'Channels', value: recording.n_channels_total, mono: true },
        { label: 'MEG channels', value: recording.n_meg_channels, mono: true },
        { label: 'Duration', value: formatDuration(recording.duration_s), mono: true },
        { label: 'Sensor type', value: SENSOR_LABELS[recording.sensor_type], mono: true },
        {
          label: 'Coordinate frame',
          value: formatCoordinateFrame(recording.coordinate_frame),
          mono: true,
        },
      ]
    : [];

  const fileColumns: DataTableColumn<FileAsset>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (asset) => <span className='font-mono text-[13px]'>{asset.name}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (asset) => (
        <span className='text-text-secondary text-[13px]'>{asset.role ?? '—'}</span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      className: 'text-right',
      render: (asset) => (
        <span className='font-mono text-[13px]'>{formatBytes(asset.size_bytes)}</span>
      ),
    },
    {
      key: 'checksum',
      header: 'Checksum',
      render: (asset) => (
        <span className='text-text-muted font-mono text-[12px]'>
          {formatChecksum(asset.checksum)}
        </span>
      ),
    },
  ];

  const versionColumns: DataTableColumn<DatasetVersion>[] = [
    {
      key: 'version',
      header: 'Version',
      render: (item) => <span className='font-mono text-[13px]'>{item.version}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => (
        <StatusBadge
          tone={datasetVersionStatusTone(item.status)}
          label={datasetVersionStatusLabel(item.status)}
        />
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (item) => (
        <span className='text-text-secondary text-[13px]'>
          {formatRelativeTime(item.created_at)}
        </span>
      ),
    },
    {
      key: 'checksum',
      header: 'Checksum',
      render: (item) => (
        <span className='text-text-muted font-mono text-[12px]'>
          {formatChecksum(item.checksum_sha256)}
        </span>
      ),
    },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={detail.name}
        breadcrumbs={[{ label: 'Datasets', href: '/app/datasets' }, { label: detail.name }]}
        actions={
          <>
            {recording ? (
              <Link
                href={`/app/sensor-explorer?recording=${recording.id}`}
                className='btn btn-outline btn-sm'>
                Sensor Explorer
              </Link>
            ) : null}
            {recording ? (
              <Link href={`/app/datasets/${detail.id}/viewer`} className='btn btn-primary btn-sm'>
                Open in Signal Viewer
              </Link>
            ) : null}
          </>
        }>
        <div className='text-text-secondary flex flex-wrap items-center gap-3 text-[13px]'>
          <StatusBadge
            tone={datasetStatusTone(detail.status)}
            label={datasetStatusLabel(detail.status)}
          />
          {recording ? (
            <span className='bg-surface-muted text-text-secondary inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
              {SENSOR_LABELS[recording.sensor_type]}
            </span>
          ) : null}
          <span className='text-text-muted font-mono text-[12px]'>{detail.id}</span>
          <span>Updated {formatRelativeTime(detail.updated_at)}</span>
        </div>
      </PageHeader>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
        <div className='space-y-6 xl:col-span-2'>
          <Card title='Acquisition metadata'>
            {recording ? (
              <MetadataGrid
                columns={2}
                items={[
                  ...metadataItems,
                  {
                    label: 'Checksum · SHA-256',
                    value: (
                      <span className='flex items-center gap-1'>
                        <span className='text-text-secondary font-mono text-[12px]'>
                          {formatChecksum(version?.checksum_sha256)}
                        </span>
                        {version?.checksum_sha256 ? (
                          <CopyButton value={version.checksum_sha256} />
                        ) : null}
                      </span>
                    ),
                  },
                ]}
              />
            ) : (
              <EmptyState
                title='No recording attached'
                description='This dataset does not yet have a parsed recording. Validation may still be running.'
              />
            )}
          </Card>

          <Card
            title='Event sets'
            description={recording ? `Stimulus events for ${recording.file_name}` : undefined}>
            {recordingId.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No recording to inspect.</p>
            ) : eventsQuery.isLoading ? (
              <LoadingState label='Loading event sets…' />
            ) : eventSets.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>
                No event sets available for this recording.
              </p>
            ) : (
              <div className='space-y-4'>
                {eventSets.map((eventSet) => (
                  <EventSetBlock key={eventSet.id} eventSet={eventSet} />
                ))}
              </div>
            )}
          </Card>

          <Card title='File assets'>
            {fileAssets.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No file assets recorded.</p>
            ) : (
              <DataTable columns={fileColumns} rows={fileAssets} getRowKey={(asset) => asset.id} />
            )}
          </Card>

          <Card title='Version history'>
            {versionItems.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No versions recorded.</p>
            ) : (
              <DataTable
                columns={versionColumns}
                rows={versionItems}
                getRowKey={(item) => item.id}
              />
            )}
          </Card>
        </div>

        <div className='space-y-6'>
          <Card title='Quick actions'>
            <div className='grid gap-2'>
              {recording ? (
                <Link
                  href={`/app/datasets/${detail.id}/viewer`}
                  className='btn btn-primary btn-sm justify-start'>
                  Open in Signal Viewer
                </Link>
              ) : null}
              {recording ? (
                <Link
                  href={`/app/sensor-explorer?recording=${recording.id}`}
                  className='btn btn-outline btn-sm justify-start'>
                  Sensor Explorer
                </Link>
              ) : null}
              <Link href='/app/datasets' className='btn btn-ghost btn-sm justify-start'>
                Back to datasets
              </Link>
            </div>
          </Card>

          <Card title='Provenance'>
            <div className='space-y-3'>
              <ProvenanceRow label='Source' value={detail.source_type} />
              <ProvenanceRow label='Versions' value={detail.version_count} />
              <ProvenanceRow label='Recordings' value={detail.recording_count} />
              <ProvenanceRow label='Runs' value={detail.run_count} />
              <ProvenanceRow label='Created' value={formatDateTime(detail.created_at)} />
              <ProvenanceRow label='Updated' value={formatDateTime(detail.updated_at)} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
