'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { SelectField } from '@/components/atoms/select-field';
import { TextField } from '@/components/atoms/text-field';
import { TextareaField } from '@/components/atoms/textarea-field';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import { createProject, toErrorMessage } from '@/lib/api';
import type { ProjectVisibility } from '@/lib/api/types';

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private — only invited members' },
  { value: 'public', label: 'Public sample — read-only exploration' },
];

export const NewProjectView = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ProjectVisibility>('private');
  const [nameError, setNameError] = useState<string>();

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        name: name.trim(),
        description: description.trim().length > 0 ? description.trim() : null,
        visibility,
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast({
        title: 'Project created',
        description: `${project.name} is ready for recordings and runs.`,
        tone: 'success',
      });
      router.push('/app/projects');
    },
    onError: (error) => {
      showToast({
        title: 'Could not create project',
        description: toErrorMessage(error),
        tone: 'danger',
      });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length === 0) {
      setNameError('Enter a project name.');
      return;
    }
    setNameError(undefined);
    mutation.mutate();
  };

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='New project'
        description='Create a shared scope for recordings, pipeline versions, and reproducible analysis runs.'
        breadcrumbs={[{ label: 'Projects', href: '/app/projects' }, { label: 'New' }]}
        actions={
          <Link href='/app/projects' className='btn btn-ghost btn-sm'>
            Cancel
          </Link>
        }
      />

      <div className='max-w-2xl'>
        <Card title='Project details'>
          <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-4'>
            <TextField
              label='Name'
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={nameError}
              placeholder='Resting State Connectivity'
            />
            <TextareaField
              label='Description'
              hint='Optional. A short summary of the study or data this project covers.'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
            <SelectField
              label='Visibility'
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as ProjectVisibility)}
              options={VISIBILITY_OPTIONS}
            />

            <div className='flex items-center justify-end gap-2 pt-2'>
              <Link href='/app/projects' className='btn btn-outline btn-sm'>
                Cancel
              </Link>
              <Button type='submit' variant='primary' size='sm' disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create project'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
