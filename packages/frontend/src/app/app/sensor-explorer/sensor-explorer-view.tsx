'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Card } from '@/components/atoms/card';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { MetadataGrid, type MetadataItem } from '@/components/atoms/metadata-grid';
import { EmptyState, ErrorState, LoadingState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchDatasets, fetchSensorGeometry, toErrorMessage } from '@/lib/api';
import type { Dataset, DatasetDetail, Recording, Sensor, SensorType } from '@/lib/api/types';
import { formatCoordinateFrame } from '@/lib/format';

const TRACE_TEXT = [
  'text-trace-1',
  'text-trace-2',
  'text-trace-3',
  'text-trace-4',
  'text-trace-5',
  'text-trace-6',
];

const SENSOR_TYPE_LABELS: Record<SensorType, string> = {
  neuromag_vectorview: 'Neuromag Vectorview (306 MEG)',
  opm_ucl_fil: 'UCL FIL OPM array',
  ctf: 'CTF-MEG',
  kit: 'KIT-MEG',
};

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 640;
const MAP_CENTER_X = 500;
const MAP_CENTER_Y = 330;
const MAP_SCALE = 2300;
const MAP_Y_SCALE = 0.85;

interface SensorPoint {
  sensor: Sensor;
  x: number;
  y: number;
  r: number;
}

const project = (sensor: Sensor): SensorPoint => {
  let dx = 0;
  let dy = 0;
  if (sensor.type === 'grad') {
    const ox = sensor.orientation[0];
    const oy = sensor.orientation[1];
    const length = Math.hypot(ox, oy) || 1;
    const offset = 11;
    dx = (-oy / length) * offset;
    dy = (ox / length) * offset * MAP_Y_SCALE;
  }
  const radius =
    sensor.type === 'mag' ? 5 : sensor.type === 'grad' ? 3.2 : sensor.type === 'opm' ? 4 : 3;
  return {
    sensor,
    x: MAP_CENTER_X + sensor.position[0] * MAP_SCALE + dx,
    y: MAP_CENTER_Y + sensor.position[1] * MAP_SCALE * MAP_Y_SCALE + dy,
    r: radius,
  };
};

const mm = (value: number): string => `${(value * 1000).toFixed(1)}`;

const vec = (value: number): string => value.toFixed(3);

interface RecordingOption {
  datasetId: string;
  datasetName: string;
  recordingId: string;
  recording: Recording;
}

const StatTile = ({ label, value, hint }: { label: string; value: string; hint?: string }) => {
  return (
    <div className='border-border bg-surface rounded-lg border p-4'>
      <p className='text-text-muted text-[12px] font-medium tracking-wide uppercase'>{label}</p>
      <p className='text-text-primary mt-2 text-2xl font-semibold'>{value}</p>
      {hint ? <p className='text-text-secondary mt-1 text-[12px]'>{hint}</p> : null}
    </div>
  );
};

const recordingOf = (dataset: Dataset): Recording | null =>
  (dataset as DatasetDetail).recording ?? null;

export const SensorExplorerView = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedRecordingId, setSelectedRecordingId] = useState(
    searchParams.get('recording') ?? '',
  );
  const [sensorSearch, setSensorSearch] = useState('');
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

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
  const effectiveRecordingId = activeOption?.recordingId ?? '';

  const geometryQuery = useQuery({
    queryKey: ['sensor-geometry', effectiveRecordingId],
    queryFn: () => fetchSensorGeometry(effectiveRecordingId),
    enabled: effectiveRecordingId.length > 0,
  });

  const geometry = geometryQuery.data;
  const sensors = useMemo(
    () => (geometry && geometry.recording_id === effectiveRecordingId ? geometry.sensors : []),
    [geometry, effectiveRecordingId],
  );

  const sensorTypes = useMemo(
    () => Array.from(new Set(sensors.map((sensor) => sensor.type))).sort(),
    [sensors],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const sensor of sensors) {
      counts[sensor.type] = (counts[sensor.type] ?? 0) + 1;
    }
    return counts;
  }, [sensors]);

  const typeClass = useMemo(() => {
    const map: Record<string, string> = {};
    sensorTypes.forEach((type, index) => {
      map[type] = TRACE_TEXT[index % TRACE_TEXT.length] ?? 'text-trace-1';
    });
    return map;
  }, [sensorTypes]);

  const legendItems = useMemo(
    () =>
      sensorTypes.map((type) => ({
        type,
        count: typeCounts[type] ?? 0,
        className: typeClass[type] ?? 'text-trace-1',
      })),
    [sensorTypes, typeCounts, typeClass],
  );

  const sensorPoints = useMemo(() => sensors.map(project), [sensors]);

  const detailSensor = useMemo(
    () => sensors.find((sensor) => sensor.name === (selectedName ?? hoveredName)) ?? null,
    [sensors, selectedName, hoveredName],
  );

  const filteredSensors = useMemo(() => {
    const term = sensorSearch.trim().toLowerCase();
    if (term.length === 0) {
      return sensors;
    }
    return sensors.filter((sensor) => sensor.name.toLowerCase().includes(term));
  }, [sensors, sensorSearch]);

  const changeRecording = (recordingId: string) => {
    setSelectedRecordingId(recordingId);
    setSelectedName(null);
    setHoveredName(null);
    router.replace(
      recordingId ? `/app/sensor-explorer?recording=${recordingId}` : '/app/sensor-explorer',
      { scroll: false },
    );
  };

  if (datasetsQuery.isLoading) {
    return <LoadingState label='Loading recordings…' />;
  }
  if (datasetsQuery.isError) {
    return <ErrorState message={toErrorMessage(datasetsQuery.error)} />;
  }
  if (!activeOption) {
    return (
      <div className='flex flex-col gap-6'>
        <PageHeader
          title='Sensor Explorer'
          description='Visualise the sensor array geometry of your recordings.'
        />
        <EmptyState
          title='No recorded arrays'
          description='Import a dataset with a parsed recording to inspect its sensor geometry.'
          action={
            <Link href='/app/datasets' className='btn btn-outline btn-sm'>
              Go to datasets
            </Link>
          }
        />
      </div>
    );
  }

  const magCount = typeCounts['mag'] ?? 0;
  const gradCount = typeCounts['grad'] ?? 0;
  const otherCount = sensors.length - magCount - gradCount;

  const coordinateItems: MetadataItem[] = geometry
    ? [
        {
          label: 'Sensor type',
          value: SENSOR_TYPE_LABELS[geometry.sensor_type] ?? geometry.sensor_type,
          mono: true,
        },
        {
          label: 'Coordinate frame',
          value: formatCoordinateFrame(geometry.coordinate_frame),
          mono: true,
        },
        { label: 'Units', value: geometry.units, mono: true },
        { label: 'Helmet model', value: geometry.helmet_model ?? '—', mono: true },
        {
          label: 'OPM metadata',
          value: geometry.opm_metadata
            ? `array ${geometry.opm_metadata.array_type} · ${geometry.opm_metadata.n_channels} ch · movement tracking ${
                geometry.opm_metadata.movement_tracking ? 'on' : 'off'
              }`
            : '—',
        },
      ]
    : [];

  const sensorColumns: DataTableColumn<Sensor>[] = [
    {
      key: 'name',
      header: 'Channel',
      render: (sensor) => <span className='font-mono text-[13px]'>{sensor.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (sensor) => <span className='text-text-secondary text-[13px]'>{sensor.type}</span>,
    },
    {
      key: 'x',
      header: 'x mm',
      className: 'text-right',
      render: (sensor) => <span className='font-mono text-[12px]'>{mm(sensor.position[0])}</span>,
    },
    {
      key: 'y',
      header: 'y mm',
      className: 'text-right',
      render: (sensor) => <span className='font-mono text-[12px]'>{mm(sensor.position[1])}</span>,
    },
    {
      key: 'z',
      header: 'z mm',
      className: 'text-right',
      render: (sensor) => <span className='font-mono text-[12px]'>{mm(sensor.position[2])}</span>,
    },
    {
      key: 'orientation',
      header: 'Orientation',
      render: (sensor) => (
        <span className='text-text-muted font-mono text-[12px]'>
          {sensor.orientation.map(vec).join(', ')}
        </span>
      ),
    },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title={activeOption ? `Sensor layout · ${activeOption.datasetName}` : 'Sensor layout'}
        breadcrumbs={[{ label: 'Datasets', href: '/app/datasets' }, { label: 'Sensor Explorer' }]}
        description={
          geometry
            ? `Top-down view of the ${SENSOR_TYPE_LABELS[geometry.sensor_type] ?? geometry.sensor_type} helmet in the ${formatCoordinateFrame(geometry.coordinate_frame)} coordinate frame.`
            : 'Top-down view of the sensor array.'
        }
        actions={
          <Link href='/app/signal-viewer' className='btn btn-outline btn-sm'>
            Open in viewer
          </Link>
        }
      />

      <section className='border-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-3'>
        <label className='flex flex-col gap-1'>
          <span className='text-text-muted text-[11px] font-semibold tracking-wider uppercase'>
            Recording
          </span>
          <select
            value={effectiveRecordingId}
            onChange={(event) => changeRecording(event.target.value)}
            aria-label='Select recording'
            className='select select-bordered bg-surface-muted mt-1 h-9 min-w-[240px] text-[13px]'>
            {recordingOptions.map((option) => (
              <option key={option.recordingId} value={option.recordingId}>
                {option.datasetName}
              </option>
            ))}
          </select>
        </label>
        {geometry ? (
          <span className='text-text-secondary pb-1 text-[12px]'>
            {geometry.sensors.length} sensors · frame{' '}
            {formatCoordinateFrame(geometry.coordinate_frame)}
          </span>
        ) : null}
      </section>

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile label='Sensors' value={String(sensors.length)} />
        <StatTile label='Magnetometers' value={String(magCount)} hint='signal magnetometers' />
        <StatTile label='Gradiometers' value={String(gradCount)} hint='planar gradiometers' />
        <StatTile
          label='Other types'
          value={String(otherCount)}
          hint={sensorTypes.filter((type) => type !== 'mag' && type !== 'grad').join(' · ') || '—'}
        />
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <Card
          title='Helmet · top view (head flips)'
          actions={
            <div className='text-text-secondary flex flex-wrap items-center gap-3 text-[12px]'>
              {legendItems.map((item) => (
                <span key={item.type} className='inline-flex items-center gap-1.5'>
                  <span
                    aria-hidden='true'
                    className={`h-2.5 w-2.5 rounded-full ${item.className}`}
                  />
                  <span className='font-mono'>{item.type}</span>
                  <span className='text-text-muted font-mono'>{item.count}</span>
                </span>
              ))}
              <span className='text-text-muted font-mono'>nasion up</span>
            </div>
          }>
          <div className='bg-canvas relative overflow-hidden rounded-md p-2'>
            {geometryQuery.isLoading ? (
              <LoadingState label='Loading sensor geometry…' />
            ) : geometryQuery.isError ? (
              <ErrorState message={toErrorMessage(geometryQuery.error)} />
            ) : !geometry ? (
              <p className='text-text-secondary p-6 text-[13px]'>
                No sensor geometry available for this recording.
              </p>
            ) : (
              <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                preserveAspectRatio='xMidYMid meet'
                className='block h-auto w-full'
                role='img'
                aria-label='Sensor array top-down projection'>
                <defs>
                  <radialGradient id='helm' cx='50%' cy='45%' r='60%'>
                    <stop offset='0%' stopColor='#1A2230' />
                    <stop offset='78%' stopColor='#121821' />
                    <stop offset='100%' stopColor='#0B0F14' />
                  </radialGradient>
                </defs>
                <circle
                  cx={MAP_CENTER_X}
                  cy={MAP_CENTER_Y}
                  r={252}
                  fill='url(#helm)'
                  opacity={0.9}
                />
                <ellipse
                  cx={MAP_CENTER_X}
                  cy={MAP_CENTER_Y - 45}
                  rx={46}
                  ry={24}
                  fill='none'
                  stroke='#9BA9BC'
                  strokeWidth={1.4}
                />
                <text
                  x={MAP_CENTER_X + 34}
                  y={MAP_CENTER_Y - 52}
                  fontSize={11}
                  fill='#9BA9BC'
                  className='font-mono'>
                  nasion
                </text>
                {sensorPoints.map((point) => {
                  const isDetail = detailSensor?.name === point.sensor.name;
                  const fillClass = typeClass[point.sensor.type] ?? 'text-trace-1';
                  return (
                    <g
                      key={point.sensor.name}
                      onClick={() => setSelectedName(point.sensor.name)}
                      onMouseEnter={() => setHoveredName(point.sensor.name)}
                      className='cursor-pointer'>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={point.r}
                        fill='currentColor'
                        opacity={isDetail ? 1 : 0.85}
                        className={fillClass}
                      />
                      {isDetail ? (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={point.r + 4}
                          fill='none'
                          stroke='currentColor'
                          strokeWidth={1.6}
                          className='text-accent'
                        />
                      ) : null}
                    </g>
                  );
                })}
                {detailSensor ? (
                  <g>
                    <line
                      x1={detailSensor.position[0] * MAP_SCALE + MAP_CENTER_X + 9}
                      y1={MAP_CENTER_Y + detailSensor.position[1] * MAP_SCALE * MAP_Y_SCALE - 2}
                      x2={detailSensor.position[0] * MAP_SCALE + MAP_CENTER_X + 30}
                      y2={MAP_CENTER_Y + detailSensor.position[1] * MAP_SCALE * MAP_Y_SCALE - 26}
                      stroke='#4C8DFF'
                      strokeWidth={1}
                    />
                    <text
                      x={MAP_CENTER_X + detailSensor.position[0] * MAP_SCALE + 28}
                      y={MAP_CENTER_Y + detailSensor.position[1] * MAP_SCALE * MAP_Y_SCALE - 34}
                      fontSize={12}
                      fill='#4C8DFF'
                      className='font-mono'>
                      {detailSensor.name}
                    </text>
                  </g>
                ) : null}
              </svg>
            )}
            {detailSensor ? (
              <div className='text-text-secondary pointer-events-none absolute top-0 left-0 p-3 font-mono text-[11px]'>
                {detailSensor.name} · {detailSensor.type} · ({mm(detailSensor.position[0])},{' '}
                {mm(detailSensor.position[1])}, {mm(detailSensor.position[2])}) mm
              </div>
            ) : null}
          </div>
        </Card>

        <div className='space-y-6'>
          <Card title='Sensor detail'>
            {detailSensor ? (
              <MetadataGrid
                columns={1}
                items={[
                  { label: 'Channel', value: detailSensor.name, mono: true },
                  { label: 'Type', value: detailSensor.type, mono: true },
                  { label: 'Coil', value: detailSensor.coil_type },
                  {
                    label: 'Position',
                    value: `${mm(detailSensor.position[0])}, ${mm(detailSensor.position[1])}, ${mm(detailSensor.position[2])} mm`,
                    mono: true,
                  },
                  {
                    label: 'Orientation',
                    value: detailSensor.orientation.map(vec).join(', '),
                    mono: true,
                  },
                ]}
              />
            ) : (
              <p className='text-text-secondary text-[13px]'>
                Hover or click a sensor to inspect it.
              </p>
            )}
          </Card>

          <Card title='Coordinate system'>
            <MetadataGrid columns={1} items={coordinateItems} />
          </Card>

          <Card
            title='Channel positions'
            actions={
              <input
                type='search'
                value={sensorSearch}
                onChange={(event) => setSensorSearch(event.target.value)}
                placeholder='Search sensors…'
                aria-label='Search sensors'
                className='input input-bordered bg-surface-muted h-8 w-44 text-[13px]'
              />
            }>
            {sensors.length === 0 ? (
              <LoadingState label='Loading sensors…' />
            ) : filteredSensors.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>No sensors match the search.</p>
            ) : (
              <>
                <DataTable
                  columns={sensorColumns}
                  rows={filteredSensors}
                  getRowKey={(sensor) => sensor.name}
                />
                <p className='text-text-muted mt-3 text-[12px]'>
                  Showing {filteredSensors.length} of {sensors.length} sensors
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
