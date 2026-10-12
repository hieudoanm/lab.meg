'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import {
  fetchDataset,
  fetchRecordingChannels,
  fetchRecordingSignals,
  toErrorMessage,
} from '@/lib/api';
import { formatFrequency } from '@/lib/format';
import { datasetStatusLabel, datasetStatusTone } from '@/lib/status';

const TRACE_TEXT = [
  'text-trace-1',
  'text-trace-2',
  'text-trace-3',
  'text-trace-4',
  'text-trace-5',
  'text-trace-6',
];

const TRACE_BG = [
  'bg-trace-1',
  'bg-trace-2',
  'bg-trace-3',
  'bg-trace-4',
  'bg-trace-5',
  'bg-trace-6',
];

const WIDTH = 1000;
const LEFT_PAD = 104;
const RIGHT_PAD = 24;
const TOP_PAD = 24;
const BOTTOM_PAD = 32;
const ROW_HEIGHT = 52;
const TICK_COUNT = 5;

interface ChartSeries {
  name: string;
  type: string;
  points: string;
  labelY: number;
  colorClass: string;
  dotClass: string;
}

interface ChartTick {
  x: number;
  label: string;
}

interface ChartModel {
  width: number;
  height: number;
  axisBottom: number;
  series: ChartSeries[];
  ticks: ChartTick[];
}

const buildChart = (
  times: number[],
  channels: { name: string; type: string; data: number[] }[],
): ChartModel | null => {
  if (channels.length === 0 || times.length === 0) {
    return null;
  }
  const plotWidth = WIDTH - LEFT_PAD - RIGHT_PAD;
  const height = TOP_PAD + ROW_HEIGHT * channels.length + BOTTOM_PAD;
  const t0 = times[0] ?? 0;
  const t1 = times[times.length - 1] ?? 1;
  const span = Math.max(t1 - t0, 0.001);

  const series = channels.map((channel, index) => {
    const values = channel.data;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const value of values) {
      if (Number.isFinite(value)) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = -1;
      max = 1;
    }
    const mid = (min + max) / 2;
    const range = Math.max(max - min, 1e-9);
    const centerY = TOP_PAD + ROW_HEIGHT * index + ROW_HEIGHT / 2;
    const amplitude = ROW_HEIGHT * 0.36;
    const denominator = Math.max(values.length - 1, 1);
    const points = values
      .map((value, pointIndex) => {
        const x = LEFT_PAD + (pointIndex / denominator) * plotWidth;
        const y = centerY - ((value - mid) / range) * amplitude;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return {
      name: channel.name,
      type: channel.type,
      points,
      labelY: centerY + 4,
      colorClass: TRACE_TEXT[index % TRACE_TEXT.length] ?? 'text-trace-1',
      dotClass: TRACE_BG[index % TRACE_BG.length] ?? 'bg-trace-1',
    };
  });

  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const ratio = index / (TICK_COUNT - 1);
    return {
      x: LEFT_PAD + ratio * plotWidth,
      label: `${(t0 + ratio * span).toFixed(2)} s`,
    };
  });

  return { width: WIDTH, height, axisBottom: height - BOTTOM_PAD, series, ticks };
};

export const ViewerView = ({ datasetId }: { datasetId: string }) => {
  const datasetQuery = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: () => fetchDataset(datasetId),
  });
  const recording = datasetQuery.data?.recording ?? null;
  const recordingId = recording?.id ?? '';

  const [tmin, setTmin] = useState(0);
  const [tmax, setTmax] = useState(2);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [channelSearch, setChannelSearch] = useState('');

  const channelsQuery = useQuery({
    queryKey: ['recording-channels', recordingId],
    queryFn: () => fetchRecordingChannels(recordingId),
    enabled: recordingId.length > 0,
  });
  const channelItems = useMemo(() => channelsQuery.data?.items ?? [], [channelsQuery.data]);

  const effectiveSelected = useMemo(
    () => selected ?? channelItems.slice(0, 6).map((channel) => channel.name),
    [selected, channelItems],
  );
  const channelParam = useMemo(() => effectiveSelected.join(','), [effectiveSelected]);

  const signalsQuery = useQuery({
    queryKey: ['recording-signals', recordingId, { channels: channelParam, tmin, tmax }],
    queryFn: () => fetchRecordingSignals(recordingId, { channels: channelParam, tmin, tmax }),
    enabled: recordingId.length > 0,
  });

  const filteredChannels = useMemo(() => {
    const term = channelSearch.trim().toLowerCase();
    if (term.length === 0) {
      return channelItems;
    }
    return channelItems.filter((channel) => channel.name.toLowerCase().includes(term));
  }, [channelItems, channelSearch]);

  const chart = useMemo(() => {
    const signalWindow = signalsQuery.data;
    if (!signalWindow) {
      return null;
    }
    return buildChart(signalWindow.times, signalWindow.channels);
  }, [signalsQuery.data]);

  const toggleChannel = (name: string) => {
    const base = effectiveSelected;
    setSelected(base.includes(name) ? base.filter((item) => item !== name) : [...base, name]);
  };

  if (datasetQuery.isLoading) {
    return <LoadingState label='Loading viewer…' />;
  }
  if (datasetQuery.isError) {
    return <ErrorState message={toErrorMessage(datasetQuery.error)} />;
  }
  if (!recording) {
    return (
      <div className='flex flex-col gap-6'>
        <PageHeader
          title={datasetQuery.data?.name ?? 'Signal Viewer'}
          breadcrumbs={[{ label: 'Datasets', href: '/app/datasets' }, { label: 'Viewer' }]}
        />
        <EmptyState
          title='No recording to display'
          description='This dataset has no parsed recording yet. Validation may still be running.'
          action={
            <Link href='/app/datasets' className='btn btn-outline btn-sm'>
              Back to datasets
            </Link>
          }
        />
      </div>
    );
  }

  const delta = Math.max(tmax - tmin, 0);

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={`${datasetQuery.data?.name ?? recording.file_name} · Signal Viewer`}
        description={`${recording.file_name} · ${recording.n_channels_total} channels · ${formatFrequency(recording.sampling_frequency_hz)}`}
        breadcrumbs={[
          { label: 'Datasets', href: '/app/datasets' },
          { label: datasetQuery.data?.name ?? 'Dataset', href: `/app/datasets/${datasetId}` },
          { label: 'Viewer' },
        ]}
        actions={
          <>
            {datasetQuery.data ? (
              <StatusBadge
                tone={datasetStatusTone(datasetQuery.data.status)}
                label={datasetStatusLabel(datasetQuery.data.status)}
              />
            ) : null}
            <Link
              href={`/app/sensor-explorer?recording=${recording.id}`}
              className='btn btn-outline btn-sm'>
              Sensor Explorer
            </Link>
          </>
        }
      />

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]'>
        <section className='border-border bg-surface flex flex-col gap-4 rounded-lg border p-4'>
          <div>
            <h2 className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
              Channel selection
            </h2>
            <input
              type='search'
              value={channelSearch}
              onChange={(event) => setChannelSearch(event.target.value)}
              placeholder='Search channels…'
              aria-label='Search channels'
              className='input input-bordered bg-surface-muted mt-2 h-8 w-full text-[13px]'
            />
            <div className='mt-2 flex items-center justify-between text-[12px]'>
              <button
                type='button'
                onClick={() => setSelected(channelItems.map((channel) => channel.name))}
                className='text-accent hover:text-accent-hover font-medium'>
                Select all
              </button>
              <button
                type='button'
                onClick={() => setSelected([])}
                className='text-text-secondary hover:text-text-primary font-medium'>
                Clear
              </button>
            </div>
          </div>

          <div className='border-border max-h-[320px] space-y-1.5 overflow-y-auto border-t pt-3'>
            {channelsQuery.isLoading ? (
              <LoadingState label='Loading channels…' />
            ) : filteredChannels.length === 0 ? (
              <p className='text-text-muted text-[12px]'>No channels match.</p>
            ) : (
              filteredChannels.slice(0, 100).map((channel) => (
                <label
                  key={channel.name}
                  className='text-text-primary flex items-center gap-2 text-[13px]'>
                  <input
                    type='checkbox'
                    className='checkbox checkbox-xs rounded'
                    checked={effectiveSelected.includes(channel.name)}
                    onChange={() => toggleChannel(channel.name)}
                  />
                  <span className='flex-1 truncate'>{channel.name}</span>
                  {channel.status === 'bad' ? (
                    <span className='bg-danger-muted text-danger rounded px-1.5 font-mono text-[11px]'>
                      bad
                    </span>
                  ) : (
                    <span className='text-text-muted font-mono text-[11px]'>{channel.type}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </section>

        <div className='flex flex-col gap-3'>
          <section className='border-border bg-surface flex flex-wrap items-end gap-3 rounded-lg border p-3'>
            <label className='flex flex-col gap-1'>
              <span className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
                Start (s)
              </span>
              <input
                type='number'
                min={0}
                step={0.1}
                value={tmin}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setTmin(Math.max(value, 0));
                  }
                }}
                className='input input-bordered bg-surface-muted h-8 w-24 text-[13px]'
              />
            </label>
            <label className='flex flex-col gap-1'>
              <span className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
                End (s)
              </span>
              <input
                type='number'
                min={0}
                step={0.1}
                value={tmax}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setTmax(Math.max(value, 0));
                  }
                }}
                className='input input-bordered bg-surface-muted h-8 w-24 text-[13px]'
              />
            </label>
            <button
              type='button'
              onClick={() => {
                setTmin(0);
                setTmax(Math.min(recording.duration_s, 10));
              }}
              className='btn btn-outline btn-sm'>
              Fit
            </button>
            <span className='text-text-secondary ml-auto font-mono text-[12px]'>
              Δt = {delta.toFixed(1)} s ·{' '}
              {signalsQuery.data
                ? formatFrequency(signalsQuery.data.effective_sampling_frequency_hz)
                : '—'}
            </span>
          </section>

          <section className='border-border bg-canvas overflow-hidden rounded-lg border'>
            {signalsQuery.isLoading ? (
              <LoadingState label='Rendering traces…' />
            ) : signalsQuery.isError ? (
              <ErrorState message={toErrorMessage(signalsQuery.error)} />
            ) : !chart ? (
              <p className='text-text-secondary p-6 text-[13px]'>No signal data in this window.</p>
            ) : (
              <svg
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                preserveAspectRatio='xMidYMid meet'
                className='h-auto w-full'
                role='img'
                aria-label='Signal traces for the selected channels'>
                {chart.ticks.map((tick) => (
                  <line
                    key={`grid-${tick.x}`}
                    x1={tick.x}
                    y1={TOP_PAD - 8}
                    x2={tick.x}
                    y2={chart.axisBottom}
                    stroke='#16202c'
                    strokeWidth={1}
                  />
                ))}

                {chart.series.map((item) => (
                  <g key={item.name}>
                    <text
                      x={8}
                      y={item.labelY}
                      fontSize={10}
                      fill='currentColor'
                      className='text-text-muted font-mono'>
                      {item.type}
                    </text>
                    <text
                      x={LEFT_PAD - 10}
                      y={item.labelY}
                      fontSize={11}
                      textAnchor='end'
                      fill='currentColor'
                      className={`${item.colorClass} font-mono`}>
                      {item.name}
                    </text>
                    <polyline
                      points={item.points}
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={1.1}
                      className={item.colorClass}
                    />
                  </g>
                ))}

                <line
                  x1={LEFT_PAD}
                  y1={TOP_PAD - 8}
                  x2={LEFT_PAD}
                  y2={chart.axisBottom}
                  stroke='#263244'
                  strokeWidth={1}
                />
                <line
                  x1={LEFT_PAD}
                  y1={chart.axisBottom}
                  x2={chart.width - RIGHT_PAD}
                  y2={chart.axisBottom}
                  stroke='#263244'
                  strokeWidth={1}
                />
                {chart.ticks.map((tick) => (
                  <text
                    key={`label-${tick.x}`}
                    x={tick.x}
                    y={chart.height - 10}
                    fontSize={11}
                    textAnchor='middle'
                    fill='currentColor'
                    className='text-text-muted font-mono'>
                    {tick.label}
                  </text>
                ))}
              </svg>
            )}
          </section>

          <section className='border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-3 text-[12px]'>
            {chart
              ? chart.series.map((item) => (
                  <span key={item.name} className='inline-flex items-center gap-1.5'>
                    <span aria-hidden='true' className={`h-2 w-2 rounded-full ${item.dotClass}`} />
                    <span className='text-text-secondary font-mono'>{item.name}</span>
                  </span>
                ))
              : null}
            <span className='text-text-muted ml-auto font-mono text-[11px]'>
              {recording.format} · {formatFrequency(recording.sampling_frequency_hz)}
            </span>
          </section>
        </div>
      </div>
    </div>
  );
};
