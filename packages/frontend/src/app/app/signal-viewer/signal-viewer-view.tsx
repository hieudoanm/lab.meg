'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { StatusBadge } from '@/components/atoms/status-badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import {
  fetchDatasets,
  fetchRecordingChannels,
  fetchRecordingEventSets,
  fetchRecordingSignals,
  toErrorMessage,
} from '@/lib/api';
import type { Dataset, DatasetDetail, Recording } from '@/lib/api/types';
import { formatDuration, formatFrequency } from '@/lib/format';
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

const TRACE_BY_TYPE: Record<string, { text: string; dot: string }> = {
  mag: { text: 'text-trace-2', dot: 'bg-trace-2' },
  grad: { text: 'text-trace-6', dot: 'bg-trace-6' },
  opm: { text: 'text-trace-1', dot: 'bg-trace-1' },
  eeg: { text: 'text-trace-3', dot: 'bg-trace-3' },
  eeg_aux: { text: 'text-trace-4', dot: 'bg-trace-4' },
  stim: { text: 'text-trace-5', dot: 'bg-trace-5' },
  eog: { text: 'text-trace-1', dot: 'bg-trace-1' },
  ecg: { text: 'text-trace-3', dot: 'bg-trace-3' },
  misc: { text: 'text-trace-5', dot: 'bg-trace-5' },
  resp: { text: 'text-trace-4', dot: 'bg-trace-4' },
  temp: { text: 'text-trace-3', dot: 'bg-trace-3' },
  syst: { text: 'text-trace-5', dot: 'bg-trace-5' },
};

const colorOf = (type: string, fallback: number): { text: string; dot: string } =>
  TRACE_BY_TYPE[type] ?? {
    text: TRACE_TEXT[fallback % TRACE_TEXT.length] ?? 'text-trace-1',
    dot: TRACE_BG[fallback % TRACE_BG.length] ?? 'bg-trace-1',
  };

const WIDTH = 1000;
const LEFT_PAD = 104;
const RIGHT_PAD = 24;
const TOP_PAD = 24;
const BOTTOM_PAD = 32;
const ROW_HEIGHT = 52;
const TICK_COUNT = 5;

interface TraceSeries {
  name: string;
  type: string;
  points: string;
  labelY: number;
  colorClass: string;
  dotClass: string;
}

interface TraceTick {
  x: number;
  label: string;
}

interface TraceMarker {
  x: number;
}

interface TraceChartModel {
  width: number;
  height: number;
  axisBottom: number;
  series: TraceSeries[];
  ticks: TraceTick[];
  markers: TraceMarker[];
}

interface TraceInput {
  times: number[];
  channels: { name: string; type: string; data: number[] }[];
  events?: { time_s: number }[];
  amplitude?: number;
}

const buildTraces = ({
  times,
  channels,
  events = [],
  amplitude = 1,
}: TraceInput): TraceChartModel | null => {
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
    const traceAmplitude = ROW_HEIGHT * 0.36 * amplitude;
    const denominator = Math.max(values.length - 1, 1);
    const points = values
      .map((value, pointIndex) => {
        const x = LEFT_PAD + (pointIndex / denominator) * plotWidth;
        const y = centerY - ((value - mid) / range) * traceAmplitude;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const palette = colorOf(channel.type, index);
    return {
      name: channel.name,
      type: channel.type,
      points,
      labelY: centerY + 4,
      colorClass: palette.text,
      dotClass: palette.dot,
    };
  });

  const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
    const ratio = index / (TICK_COUNT - 1);
    return {
      x: LEFT_PAD + ratio * plotWidth,
      label: `${(t0 + ratio * span).toFixed(2)} s`,
    };
  });

  const markers = events
    .filter((event) => event.time_s >= t0 && event.time_s <= t1)
    .slice(0, 24)
    .map((event) => ({
      x: LEFT_PAD + ((event.time_s - t0) / span) * plotWidth,
    }));

  return { width: WIDTH, height, axisBottom: height - BOTTOM_PAD, series, ticks, markers };
};

interface RecordingOption {
  datasetId: string;
  datasetName: string;
  datasetStatus: Dataset['status'];
  recordingId: string;
  recording: Recording;
}

const recordingOf = (dataset: Dataset): Recording | null =>
  (dataset as DatasetDetail).recording ?? null;

export const SignalViewerView = () => {
  const [selectedRecordingId, setSelectedRecordingId] = useState('');
  const [tmin, setTmin] = useState(0);
  const [tmax, setTmax] = useState(2);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [channelSearch, setChannelSearch] = useState('');
  const [amplitude, setAmplitude] = useState(1);

  const datasetsQuery = useQuery({
    queryKey: ['datasets', { limit: 50 }],
    queryFn: () => fetchDatasets({ limit: 50 }),
  });
  const datasetItems = useMemo(() => datasetsQuery.data?.items ?? [], [datasetsQuery.data]);

  const recordingOptions = useMemo(() => {
    const options: RecordingOption[] = [];
    for (const dataset of datasetItems) {
      const recording = recordingOf(dataset);
      if (recording) {
        options.push({
          datasetId: dataset.id,
          datasetName: dataset.name,
          datasetStatus: dataset.status,
          recordingId: recording.id,
          recording,
        });
      }
    }
    return options;
  }, [datasetItems]);

  const activeOption = useMemo(
    () =>
      recordingOptions.find((option) => option.recordingId === selectedRecordingId) ??
      recordingOptions[0] ??
      null,
    [recordingOptions, selectedRecordingId],
  );
  const recording = activeOption?.recording ?? null;
  const recordingId = recording?.id ?? '';

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

  const eventsQuery = useQuery({
    queryKey: ['recording-event-sets', recordingId],
    queryFn: () => fetchRecordingEventSets(recordingId),
    enabled: recordingId.length > 0,
  });
  const eventSetItems = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data]);

  const windowEvents = useMemo(() => {
    const events = eventSetItems.flatMap((set) => set.events);
    return events
      .filter((event) => event.time_s >= tmin && event.time_s <= tmax)
      .sort((a, b) => a.time_s - b.time_s)
      .slice(0, 24);
  }, [eventSetItems, tmin, tmax]);

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
    return buildTraces({
      times: signalWindow.times,
      channels: signalWindow.channels,
      events: windowEvents,
      amplitude,
    });
  }, [signalsQuery.data, windowEvents, amplitude]);

  const toggleChannel = (name: string) => {
    const base = effectiveSelected;
    setSelected(base.includes(name) ? base.filter((item) => item !== name) : [...base, name]);
  };

  const zoomWindow = (factor: number) => {
    if (!recording) {
      return;
    }
    const duration = recording.duration_s;
    const center = (tmin + tmax) / 2;
    const span = Math.min(Math.max((tmax - tmin) * factor, 0.5), duration);
    const half = span / 2;
    const nextTmin = Math.min(Math.max(center - half, 0), Math.max(duration - span, 0));
    setTmin(nextTmin);
    setTmax(nextTmin + span);
  };

  if (datasetsQuery.isLoading) {
    return <LoadingState label='Loading recordings…' />;
  }
  if (datasetsQuery.isError) {
    return <ErrorState message={toErrorMessage(datasetsQuery.error)} />;
  }
  if (!recording) {
    return (
      <div className='flex flex-col gap-6'>
        <PageHeader
          title='Signal Viewer'
          description='Inspect raw MEG traces, channels, and stimulus events across your recordings.'
        />
        <EmptyState
          title='No recordings available'
          description='Import a dataset with a parsed recording to inspect its signals.'
          action={
            <Link href='/app/datasets' className='btn btn-outline btn-sm'>
              Go to datasets
            </Link>
          }
        />
      </div>
    );
  }

  const delta = Math.max(tmax - tmin, 0);
  const visibleChannels = filteredChannels.slice(0, 100);

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Signal Viewer'
        description='Inspect raw MEG traces, channels, and stimulus events across your recordings.'
        actions={
          <Link href='/app/sensor-explorer' className='btn btn-outline btn-sm'>
            Sensor Explorer
          </Link>
        }
      />

      <section className='border-border bg-surface flex flex-wrap items-end gap-4 rounded-lg border p-4'>
        <label className='flex flex-col gap-1'>
          <span className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
            Recording
          </span>
          <select
            value={recordingId}
            onChange={(event) => {
              setSelectedRecordingId(event.target.value);
              setSelected(null);
              setChannelSearch('');
            }}
            aria-label='Select recording'
            className='select select-bordered bg-surface-muted mt-1 h-9 min-w-[260px] text-[13px]'>
            {recordingOptions.map((option) => (
              <option key={option.recordingId} value={option.recordingId}>
                {option.datasetName}
              </option>
            ))}
          </select>
        </label>
        <div className='text-text-secondary ml-auto flex flex-wrap items-center gap-3 pb-1 text-[12px]'>
          {selectedRecordingId ? (
            <StatusBadge
              tone={datasetStatusTone(activeOption?.datasetStatus ?? 'ready')}
              label={datasetStatusLabel(activeOption?.datasetStatus ?? 'ready')}
            />
          ) : null}
          <span className='font-mono'>{recording.file_name}</span>
          <span>{recording.n_channels_total} channels</span>
          <span>{formatFrequency(recording.sampling_frequency_hz)}</span>
          <span>{formatDuration(recording.duration_s)}</span>
        </div>
      </section>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]'>
        <aside className='border-border bg-surface flex flex-col gap-5 rounded-lg border p-4'>
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
                onClick={() => setSelected(visibleChannels.map((channel) => channel.name))}
                className='text-accent hover:text-accent-hover font-medium'>
                Select visible
              </button>
              <button
                type='button'
                onClick={() => setSelected([])}
                className='text-text-secondary hover:text-text-primary font-medium'>
                Clear
              </button>
            </div>
          </div>

          <div className='border-border max-h-[300px] space-y-1.5 overflow-y-auto border-t pt-3'>
            {channelsQuery.isLoading ? (
              <LoadingState label='Loading channels…' />
            ) : visibleChannels.length === 0 ? (
              <p className='text-text-muted text-[12px]'>No channels match.</p>
            ) : (
              visibleChannels.map((channel) => (
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

          <div className='border-border border-t pt-4'>
            <div className='text-text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase'>
              Scale
            </div>
            <div className='mb-1.5 flex items-center justify-between text-[12px]'>
              <span className='text-text-secondary'>Amplitude</span>
              <span className='text-text-muted font-mono'>{amplitude.toFixed(1)}×</span>
            </div>
            <input
              type='range'
              min={0.5}
              max={3}
              step={0.1}
              value={amplitude}
              onChange={(event) => setAmplitude(Number(event.target.value))}
              aria-label='Trace amplitude'
              className='w-full'
            />
          </div>

          <div className='border-border border-t pt-4'>
            <div className='text-text-muted mb-2 text-[11px] font-semibold tracking-wider uppercase'>
              Events
            </div>
            {eventsQuery.isLoading ? (
              <LoadingState label='Loading events…' />
            ) : eventSetItems.length === 0 ? (
              <p className='text-text-muted text-[12px]'>No event sets for this recording.</p>
            ) : (
              <ul className='space-y-1.5 text-[12px]'>
                {eventSetItems.map((set) => (
                  <li key={set.id} className='flex items-center gap-2'>
                    <span aria-hidden='true' className='bg-accent h-2 w-2 rounded-full' />
                    <span className='text-text-primary flex-1 truncate font-mono'>{set.name}</span>
                    <span className='text-text-muted font-mono'>{set.events.length} events</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className='flex min-w-0 flex-col gap-3'>
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
            <div className='flex items-center gap-1 pb-1'>
              <button
                type='button'
                onClick={() => zoomWindow(0.5)}
                aria-label='Zoom in'
                className='btn btn-outline btn-sm'>
                −
              </button>
              <button
                type='button'
                onClick={() => zoomWindow(2)}
                aria-label='Zoom out'
                className='btn btn-outline btn-sm'>
                ＋
              </button>
            </div>
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
              Δt = {delta.toFixed(2)} s ·{' '}
              {signalsQuery.data
                ? formatFrequency(signalsQuery.data.effective_sampling_frequency_hz)
                : '—'}
              {signalsQuery.data ? ` · ${signalsQuery.data.channels.length} traces` : ''}
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
                      opacity={0.95}
                      className={item.colorClass}
                    />
                  </g>
                ))}

                {chart.markers.map((marker) => (
                  <line
                    key={`marker-${marker.x}`}
                    x1={marker.x}
                    y1={TOP_PAD - 8}
                    x2={marker.x}
                    y2={chart.axisBottom}
                    stroke='#4C8DFF'
                    strokeWidth={1.2}
                    strokeDasharray='4 4'
                    opacity={0.8}
                  />
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
            {windowEvents.length > 0 ? (
              <span className='inline-flex items-center gap-1.5'>
                <span aria-hidden='true' className='bg-accent inline-block h-0.5 w-3' />
                <span className='text-text-secondary'>events</span>
              </span>
            ) : null}
            <span className='text-text-muted ml-auto hidden font-mono text-[11px] md:inline'>
              {recording.format} · {formatFrequency(recording.sampling_frequency_hz)}
            </span>
          </section>
        </div>
      </div>
    </div>
  );
};
