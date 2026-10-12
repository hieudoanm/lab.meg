'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { ErrorState, LoadingState } from '@/components/atoms/states';
import { TextField } from '@/components/atoms/text-field';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import { createPipeline, createPipelineVersion, fetchProjects, toErrorMessage } from '@/lib/api';

const DEFAULT_DIGEST = `sha256:${'0'.repeat(64)}`;

export const NewPipelineView = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const projects = useQuery({
    queryKey: ['projects', { limit: 50 }],
    queryFn: () => fetchProjects({ limit: 50 }),
  });
  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [imageDigest, setImageDigest] = useState(DEFAULT_DIGEST);
  const [nodeType, setNodeType] = useState('psd');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !name.trim()) throw new Error('Project and pipeline name are required.');
      const pipeline = await createPipeline({
        project_id: projectId,
        name: name.trim(),
        description: description.trim() || null,
      });
      await createPipelineVersion(pipeline.id, {
        version: version.trim(),
        image_digest: imageDigest.trim(),
        definition: { nodes: [{ type: nodeType, params: {} }] },
        parameters_schema: { type: 'object', properties: {} },
        status: 'published',
      });
      return pipeline;
    },
    onSuccess: (pipeline) => {
      showToast({
        title: 'Pipeline published',
        description: `${pipeline.name} is ready to run.`,
        tone: 'success',
      });
      router.push(`/app/pipelines/${pipeline.id}`);
    },
    onError: (cause) => setError(toErrorMessage(cause)),
  });

  if (projects.isLoading) return <LoadingState label='Loading projects…' />;
  if (projects.isError) return <ErrorState message={toErrorMessage(projects.error)} />;

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='New pipeline'
        description='Publish a versioned MNE-Python pipeline that can be submitted to the worker.'
        breadcrumbs={[{ label: 'Pipelines', href: '/app/pipelines' }, { label: 'New pipeline' }]}
      />
      <form
        className='max-w-2xl space-y-6'
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          mutation.mutate();
        }}>
        <Card title='Pipeline metadata'>
          <div className='space-y-4'>
            <label className='flex flex-col gap-1 text-[13px]'>
              <span className='text-text-muted font-semibold tracking-wider uppercase'>
                Project
              </span>
              <select
                className='select select-bordered bg-surface-muted'
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}>
                <option value=''>Select a project…</option>
                {(projects.data?.items ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label='Name'
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder='Auditory preprocessing'
            />
            <TextField
              label='Description'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </Card>
        <Card title='Initial published version'>
          <div className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <TextField
                label='Version'
                required
                value={version}
                onChange={(event) => setVersion(event.target.value)}
              />
              <TextField
                label='Worker image digest'
                required
                value={imageDigest}
                onChange={(event) => setImageDigest(event.target.value)}
              />
            </div>
            <label className='flex flex-col gap-1 text-[13px]'>
              <span className='text-text-muted font-semibold tracking-wider uppercase'>
                First operation
              </span>
              <select
                className='select select-bordered bg-surface-muted'
                value={nodeType}
                onChange={(event) => setNodeType(event.target.value)}>
                <option value='psd'>Power spectral density</option>
                <option value='filter'>Band-pass filter</option>
                <option value='epoch'>Epoch</option>
                <option value='evoked'>Evoked average</option>
              </select>
            </label>
          </div>
        </Card>
        {error ? (
          <p role='alert' className='text-danger text-[13px]'>
            {error}
          </p>
        ) : null}
        <div className='flex justify-end gap-3'>
          <button
            type='button'
            className='btn btn-outline btn-sm'
            onClick={() => router.push('/app/pipelines')}>
            Cancel
          </button>
          <Button type='submit' variant='primary' size='sm' disabled={mutation.isPending}>
            {mutation.isPending ? 'Publishing…' : 'Publish pipeline'}
          </Button>
        </div>
      </form>
    </div>
  );
};
