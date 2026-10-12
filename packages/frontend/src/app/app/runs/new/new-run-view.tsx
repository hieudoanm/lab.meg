'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { SelectField } from '@/components/atoms/select-field';
import { ErrorState, LoadingState } from '@/components/atoms/states';
import { TextField } from '@/components/atoms/text-field';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchDatasets, fetchPipelines, submitRun, toErrorMessage } from '@/lib/api';
import type { PipelineParameter } from '@/lib/api/types';
import { formatChecksum } from '@/lib/format';

const defaultValue = (parameter: PipelineParameter): string | boolean =>
  parameter.type === 'boolean' ? Boolean(parameter.default) : String(parameter.default ?? '');

const buildParameters = (
  parameters: PipelineParameter[],
  values: Record<string, string | boolean>,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const parameter of parameters) {
    const value = values[parameter.name] ?? defaultValue(parameter);
    if (parameter.type === 'boolean') {
      payload[parameter.name] = Boolean(value);
    } else if (parameter.type === 'number' || parameter.type === 'integer') {
      payload[parameter.name] = value === '' ? null : Number(value);
    } else {
      payload[parameter.name] = value;
    }
  }
  return payload;
};

const ParameterField = ({
  parameter,
  value,
  onChange,
}: {
  parameter: PipelineParameter;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) => {
  const hint = [parameter.description, parameter.unit].filter(Boolean).join(' · ') || undefined;

  if (parameter.type === 'boolean') {
    return (
      <label className='flex h-9 items-center gap-2'>
        <input
          type='checkbox'
          className='checkbox checkbox-sm'
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className='text-text-primary text-sm font-medium'>{parameter.label}</span>
      </label>
    );
  }

  if (parameter.type === 'enum') {
    return (
      <SelectField
        label={parameter.label}
        hint={hint}
        required={parameter.required}
        value={String(value)}
        onChange={(event) => onChange(event.target.value)}
        options={(parameter.options ?? []).map((option) => ({ value: option, label: option }))}
      />
    );
  }

  return (
    <TextField
      label={parameter.label}
      hint={hint}
      required={parameter.required}
      type={parameter.type === 'number' || parameter.type === 'integer' ? 'number' : 'text'}
      step={parameter.type === 'integer' ? 1 : 'any'}
      min={parameter.minimum ?? undefined}
      max={parameter.maximum ?? undefined}
      value={String(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export const NewRunView = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const preselected = searchParams.get('pipeline');

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines', { limit: 50 }],
    queryFn: () => fetchPipelines({ limit: 50 }),
  });
  const datasetsQuery = useQuery({
    queryKey: ['datasets', { limit: 50 }],
    queryFn: () => fetchDatasets({ limit: 50 }),
  });

  const pipelineItems = useMemo(() => pipelinesQuery.data?.items ?? [], [pipelinesQuery.data]);
  const datasetItems = useMemo(() => datasetsQuery.data?.items ?? [], [datasetsQuery.data]);

  const [pipelineId, setPipelineId] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [paramValues, setParamValues] = useState<Record<string, string | boolean>>({});

  const selectedPipeline = useMemo(() => {
    if (pipelineId.length > 0) {
      return pipelineItems.find((pipeline) => pipeline.id === pipelineId) ?? null;
    }
    return (
      pipelineItems.find(
        (pipeline) => pipeline.id === preselected || pipeline.latest_version?.id === preselected,
      ) ?? null
    );
  }, [pipelineItems, pipelineId, preselected]);

  const selectedDataset = useMemo(() => {
    if (datasetId.length > 0) {
      return datasetItems.find((dataset) => dataset.id === datasetId) ?? null;
    }
    return (
      datasetItems.find((dataset) => dataset.current_dataset_version?.status === 'ready') ??
      datasetItems[0] ??
      null
    );
  }, [datasetItems, datasetId]);

  const version = selectedPipeline?.latest_version ?? null;
  const datasetVersion = selectedDataset?.current_dataset_version ?? null;
  const parameters = version?.parameters ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      if (!version || !datasetVersion) {
        throw new Error('Select a pipeline version and dataset version.');
      }
      return submitRun(
        {
          pipeline_version_id: version.id,
          dataset_version_id: datasetVersion.id,
          parameters: buildParameters(parameters, paramValues),
        },
        crypto.randomUUID(),
      );
    },
    onSuccess: (run) => {
      showToast({
        title: 'Run submitted',
        description: `${run.pipeline_name} v${run.pipeline_version} is queued.`,
        tone: 'success',
      });
      router.push(`/app/runs/${run.id}`);
    },
    onError: (error) => {
      showToast({
        title: 'Could not submit run',
        description: toErrorMessage(error),
        tone: 'danger',
      });
    },
  });

  const setParameter = (name: string, value: string | boolean) => {
    setParamValues((current) => ({ ...current, [name]: value }));
  };

  if (pipelinesQuery.isLoading || datasetsQuery.isLoading) {
    return <LoadingState label='Loading pipelines and datasets…' />;
  }
  if (pipelinesQuery.isError || datasetsQuery.isError) {
    return <ErrorState message={toErrorMessage(pipelinesQuery.error ?? datasetsQuery.error)} />;
  }

  const pipelineOptions = [
    { value: '', label: 'Select a pipeline version…' },
    ...pipelineItems
      .filter((pipeline) => pipeline.latest_version !== null)
      .map((pipeline) => ({
        value: pipeline.id,
        label: `${pipeline.name} · v${pipeline.latest_version?.version} (${pipeline.latest_version?.status})`,
      })),
  ];

  const datasetOptions = [
    { value: '', label: 'Select a dataset version…' },
    ...datasetItems
      .filter((dataset) => dataset.current_dataset_version !== null)
      .map((dataset) => ({
        value: dataset.id,
        label: `${dataset.name} · ${dataset.current_dataset_version?.version} (${dataset.current_dataset_version?.status})`,
      })),
  ];

  const canSubmit = version !== null && datasetVersion !== null && !mutation.isPending;

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Submit new run'
        description='Configure inputs, pipeline version, and parameters before submission. Runs are idempotent within a short window and recorded in the experiment history.'
        breadcrumbs={[{ label: 'Experiments', href: '/app/experiments' }, { label: 'New run' }]}
        actions={
          <Link href='/app/experiments' className='btn btn-ghost btn-sm'>
            Cancel
          </Link>
        }
      />

      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-6'>
          <Card title='Inputs'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <SelectField
                label='Select dataset version'
                value={selectedDataset?.id ?? ''}
                onChange={(event) => setDatasetId(event.target.value)}
                options={datasetOptions}
              />
              <SelectField
                label='Select pipeline version'
                value={selectedPipeline?.id ?? ''}
                onChange={(event) => setPipelineId(event.target.value)}
                options={pipelineOptions}
              />
            </div>
            {version ? (
              <p className='text-text-muted mt-3 font-mono text-[12px]'>
                image_digest {formatChecksum(version.image_digest)}
              </p>
            ) : null}
          </Card>

          <Card
            title='Parameters'
            description='Values are validated against the pipeline schema. Units are shown where applicable.'>
            {parameters.length === 0 ? (
              <p className='text-text-secondary text-[13px]'>
                Select a pipeline version to configure its parameters.
              </p>
            ) : (
              <div className='grid gap-4 sm:grid-cols-2'>
                {parameters.map((parameter) => (
                  <ParameterField
                    key={parameter.name}
                    parameter={parameter}
                    value={paramValues[parameter.name] ?? defaultValue(parameter)}
                    onChange={(value) => setParameter(parameter.name, value)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className='space-y-4'>
          <Card title='Idempotency'>
            <p className='text-text-secondary text-[13px]'>
              Submitting with identical inputs within 10 minutes returns the existing run instead of
              creating a duplicate. A fresh idempotency key is generated for each submission.
            </p>
          </Card>

          <Card title='Summary'>
            <dl className='space-y-2 text-[13px]'>
              <div className='flex items-start justify-between gap-3'>
                <dt className='text-text-secondary'>Dataset</dt>
                <dd className='text-right'>
                  {selectedDataset
                    ? `${selectedDataset.name} · ${datasetVersion?.version ?? '—'}`
                    : 'Not selected'}
                </dd>
              </div>
              <div className='flex items-start justify-between gap-3'>
                <dt className='text-text-secondary'>Pipeline</dt>
                <dd className='text-right'>
                  {selectedPipeline
                    ? `${selectedPipeline.name} · v${version?.version ?? '—'}`
                    : 'Not selected'}
                </dd>
              </div>
              <div className='flex items-start justify-between gap-3'>
                <dt className='text-text-secondary'>Parameters</dt>
                <dd className='text-right font-mono'>{parameters.length}</dd>
              </div>
            </dl>
            <div className='mt-4 flex flex-col gap-2'>
              <Button
                variant='primary'
                size='sm'
                onClick={() => mutation.mutate()}
                disabled={!canSubmit}>
                {mutation.isPending ? 'Submitting…' : 'Submit run'}
              </Button>
              <Link href='/app/experiments' className='btn btn-outline btn-sm'>
                Cancel
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};
