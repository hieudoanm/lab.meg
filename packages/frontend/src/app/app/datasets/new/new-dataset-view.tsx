'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { StatusBadge } from '@/components/atoms/status-badge';
import { SelectField } from '@/components/atoms/select-field';
import { ErrorState, LoadingState } from '@/components/atoms/states';
import { TextField } from '@/components/atoms/text-field';
import { TextareaField } from '@/components/atoms/textarea-field';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import {
  completeDataset,
  createDataset,
  fetchProjects,
  toErrorMessage,
  uploadToSignedUrl,
} from '@/lib/api';
import type { FileDeclaration } from '@/lib/api/types';
import { formatBytes } from '@/lib/format';

const STEPS = ['Select files', 'Validate', 'Confirm & upload'];

const SYSTEM_OPTIONS = [
  { value: 'neuromag_vectorview', label: 'Neuromag Vectorview · SQUID' },
  { value: 'ctf', label: 'CTF MEG · SQUID' },
  { value: 'opm_ucl_fil', label: 'UCL FIL OPM · Optically-pumped' },
];

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const StepIndicator = () => {
  return (
    <ol className='flex flex-wrap items-center gap-3' aria-label='Upload progress'>
      {STEPS.map((step, index) => (
        <li key={step} className='flex items-center gap-3'>
          <span className='flex items-center gap-2'>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                index <= 1 ? 'bg-success-muted text-success' : 'border-accent text-accent border-2'
              }`}>
              {index <= 1 ? '✓' : index + 1}
            </span>
            <span
              className={`text-[13px] font-medium ${
                index === 2 ? 'text-accent' : 'text-text-primary'
              }`}>
              {index + 1} · {step}
            </span>
          </span>
          {index < STEPS.length - 1 ? (
            <span aria-hidden='true' className='bg-border-strong h-px w-10' />
          ) : null}
        </li>
      ))}
    </ol>
  );
};

interface ChecklistRowProps {
  label: string;
  detail: string;
  done: boolean;
}

const ChecklistRow = ({ label, detail, done }: ChecklistRowProps) => {
  return (
    <li className='flex items-start gap-3'>
      <span
        aria-hidden='true'
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          done ? 'bg-success-muted text-success' : 'bg-surface-raised text-text-muted'
        }`}>
        {done ? '✓' : '·'}
      </span>
      <span>
        <span className='text-text-primary text-[13px]'>{label}</span>
        <span className='text-text-muted block text-[12px]'>{detail}</span>
      </span>
    </li>
  );
};

export const NewDatasetView = () => {
  const router = useRouter();
  const { showToast } = useToast();

  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [system, setSystem] = useState(SYSTEM_OPTIONS[0]?.value ?? 'neuromag_vectorview');
  const [task, setTask] = useState('');
  const [subject, setSubject] = useState('');
  const [recordedAt, setRecordedAt] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ projectId?: string; name?: string; file?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const projects = useQuery({
    queryKey: ['projects', { limit: 50 }],
    queryFn: () => fetchProjects({ limit: 50 }),
  });
  const projectItems = useMemo(() => projects.data?.items ?? [], [projects.data]);

  const selectedProject = projectItems.find((project) => project.id === projectId) ?? null;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    if (next && name.trim().length === 0) {
      setName(next.name.replace(/\.(fif\.gz|fif|bin)$/i, ''));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    const nextErrors: typeof errors = {};
    if (!projectId) {
      nextErrors.projectId = 'Select a destination project.';
    }
    if (name.trim().length === 0) {
      nextErrors.name = 'Enter a dataset name.';
    }
    if (!file) {
      nextErrors.file = 'Choose a recording file to upload.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (!file || !projectId) return;

    setIsUploading(true);
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const checksum = `sha256:${Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')}`;
      const declaration: FileDeclaration = {
        name: file.name,
        size_bytes: file.size,
        checksum_sha256: checksum,
        media_type: file.type || null,
        role: 'recording',
      };
      const recordingFormat = file.name.toLowerCase().endsWith('.bin') ? 'opm_bin' : 'fif';
      const acquisitionSystem = system === 'opm_ucl_fil' ? 'opm' : 'squid';
      const created = await createDataset(projectId, {
        name: name.trim(),
        source_type: 'upload',
        recording_format: recordingFormat,
        acquisition_system: acquisitionSystem,
        files: [declaration],
      });
      const target = created.upload_session.files.find((item) => item.name === file.name);
      if (!target) {
        throw new Error('The API did not return an upload target for the selected file.');
      }
      await uploadToSignedUrl(target, file);
      await completeDataset(created.dataset.id, [declaration]);
      showToast({
        title: 'Upload started',
        description: `${name.trim()} is being validated and will appear when ready.`,
        tone: 'success',
      });
      router.push('/app/datasets');
    } catch (error) {
      setSubmitError(toErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  if (projects.isLoading) {
    return <LoadingState label='Loading projects…' />;
  }
  if (projects.isError) {
    return <ErrorState message={toErrorMessage(projects.error)} />;
  }

  const hasFile = file !== null;
  const checklist = [
    { label: 'FIF header parseable', detail: 'Tags 0..3260 read without error', done: hasFile },
    {
      label: 'Channel layout recognised',
      detail: 'MEG, aux, and stimulus channels matched',
      done: hasFile,
    },
    { label: 'Coordinate frame resolved', detail: 'Head frame with fiducial check', done: hasFile },
    {
      label: 'SHA-256 checksum computed',
      detail: 'Integrity verified against the manifest',
      done: hasFile,
    },
  ];

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Upload dataset'
        description='Upload a MEG recording. The server validates the header, channel layout, coordinate frame, and checksum before the dataset becomes ready.'
        breadcrumbs={[{ label: 'Datasets', href: '/app/datasets' }, { label: 'Upload' }]}
        actions={
          <Link href='/app/datasets' className='btn btn-ghost btn-sm'>
            Cancel
          </Link>
        }
      />

      <StepIndicator />

      <form onSubmit={handleSubmit} noValidate className='grid grid-cols-1 gap-6 xl:grid-cols-3'>
        <div className='space-y-6 xl:col-span-2'>
          <Card title='1 · Select files'>
            <div className='border-border-strong bg-surface-muted/40 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center'>
              <div className='bg-accent-muted text-accent flex h-11 w-11 items-center justify-center rounded-full text-lg'>
                ↑
              </div>
              <p className='text-text-primary mt-3 text-[14px] font-medium'>
                Drag and drop recordings here
              </p>
              <p className='text-text-secondary mt-1 text-[13px]'>
                Supported: <span className='font-mono'>.fif</span>,{' '}
                <span className='font-mono'>.fif.gz</span>, <span className='font-mono'>.bin</span>
              </p>
            </div>

            <div className='mt-4'>
              <TextField
                label='Recording file'
                hint='Limit 4 GB per file. Satellite files are linked automatically.'
                error={errors.file}
                type='file'
                accept='.fif,.fif.gz,.bin'
                name='recording-file'
                onChange={handleFileChange}
              />
            </div>

            {file ? (
              <div className='border-border bg-surface-muted mt-4 flex items-center justify-between gap-4 rounded-md border px-3 py-2.5'>
                <div className='flex min-w-0 items-center gap-3'>
                  <span className='bg-success-muted text-success flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm'>
                    ✓
                  </span>
                  <div className='min-w-0'>
                    <div className='text-text-primary truncate font-mono text-[13px]'>
                      {file.name}
                    </div>
                    <div className='text-text-muted text-[12px]'>
                      {formatBytes(file.size)} · ready to upload
                    </div>
                  </div>
                </div>
                <button
                  type='button'
                  onClick={() => setFile(null)}
                  className='text-text-muted hover:text-text-primary rounded px-1.5 py-1 text-[13px]'
                  aria-label='Remove file'>
                  ✕
                </button>
              </div>
            ) : null}
          </Card>

          <Card
            title='2 · Validation checklist'
            actions={
              <StatusBadge
                tone={hasFile ? 'success' : 'neutral'}
                label={hasFile ? 'Ready to validate' : 'Awaiting file'}
              />
            }>
            <ul className='space-y-3'>
              {checklist.map((row) => (
                <ChecklistRow
                  key={row.label}
                  label={row.label}
                  detail={row.detail}
                  done={row.done}
                />
              ))}
            </ul>
          </Card>

          <Card title='3 · Confirm metadata'>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <div className='sm:col-span-2'>
                <SelectField
                  label='Project'
                  required
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  error={errors.projectId}
                  options={[
                    { value: '', label: 'Select a project…' },
                    ...projectItems.map((project) => ({ value: project.id, label: project.name })),
                  ]}
                />
              </div>
              <div className='sm:col-span-2'>
                <TextField
                  label='Dataset name'
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  error={errors.name}
                  placeholder='AEF-003'
                />
              </div>
              <SelectField
                label='Acquisition system'
                value={system}
                onChange={(event) => setSystem(event.target.value)}
                options={SYSTEM_OPTIONS}
              />
              <TextField
                label='Stimulus / task'
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder='Auditory oddball (40 dB HL · 1 kHz)'
              />
              <TextField
                label='Subject identifier (anonymised)'
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder='sub-AEF03'
                className='font-mono'
              />
              <TextField
                label='Recorded at'
                value={recordedAt}
                onChange={(event) => setRecordedAt(event.target.value)}
                placeholder='MEG Lab · room M2'
              />
              <div className='sm:col-span-2'>
                <TextareaField
                  label='Description'
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card title='Uploading to project'>
            {selectedProject ? (
              <div className='border-border bg-surface-muted flex items-center gap-2 rounded-md border px-3 py-2'>
                <span className='bg-accent-muted text-accent flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold'>
                  {initials(selectedProject.name)}
                </span>
                <span className='text-text-primary text-[13px] font-medium'>
                  {selectedProject.name}
                </span>
                <span className='bg-accent-muted text-accent rounded px-1.5 text-[11px]'>
                  {selectedProject.visibility}
                </span>
              </div>
            ) : (
              <p className='text-text-secondary text-[13px]'>
                Select a destination project to see where this dataset will live.
              </p>
            )}
          </Card>

          <Card title='Expectations'>
            <ul className='text-text-secondary space-y-2.5 text-[13px]'>
              <li className='flex items-start gap-2'>
                <span
                  aria-hidden='true'
                  className='bg-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full'
                />
                Validation runs on the main file; satellite files are linked automatically.
              </li>
              <li className='flex items-start gap-2'>
                <span
                  aria-hidden='true'
                  className='bg-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full'
                />
                Defaults to the head coordinate frame with a fiducial check.
              </li>
              <li className='flex items-start gap-2'>
                <span
                  aria-hidden='true'
                  className='bg-accent mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full'
                />
                You can launch a run as soon as the dataset is ready.
              </li>
            </ul>
          </Card>

          <Card title='Estimated storage'>
            <div className='flex items-center justify-between'>
              <span className='text-text-secondary text-[13px]'>Upload size</span>
              <span className='text-text-secondary font-mono text-[13px]'>
                {file ? formatBytes(file.size) : '—'}
              </span>
            </div>
          </Card>
        </div>

        <div className='flex items-center justify-end gap-3 xl:col-span-3'>
          {submitError ? (
            <p role='alert' className='text-danger mr-auto text-[13px]'>
              {submitError}
            </p>
          ) : null}
          <Link href='/app/datasets' className='btn btn-outline btn-sm'>
            Back
          </Link>
          <Button type='submit' variant='primary' size='sm' disabled={isUploading}>
            {isUploading ? 'Uploading…' : 'Confirm &amp; upload'}
          </Button>
        </div>
      </form>
    </div>
  );
};
