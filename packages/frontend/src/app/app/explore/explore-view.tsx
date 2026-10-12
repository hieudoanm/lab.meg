'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';
import { PageHeader } from '@/components/molecules/page-header';
import { fetchDatasets, fetchProjects, toErrorMessage } from '@/lib/api';
import type { Dataset, ProjectSummary } from '@/lib/api/types';
import { formatNumber, formatRelativeTime } from '@/lib/format';

type SystemFilter = 'all' | 'OPM' | 'SQUID';

const SYSTEM_FILTERS: { value: SystemFilter; label: string }[] = [
  { value: 'all', label: 'System: all' },
  { value: 'OPM', label: 'OPM-MEG' },
  { value: 'SQUID', label: 'SQUID-MEG' },
];

const WaveformIcon = () => {
  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.7'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-5 w-5'>
      <path d='M3 12h4l3-8 4 16 3-8h4' />
    </svg>
  );
};

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const datasetSystem = (dataset: Dataset): 'OPM' | 'SQUID' => {
  const haystack = `${dataset.name} ${dataset.description ?? ''} ${
    dataset.current_dataset_version?.format ?? ''
  }`.toLowerCase();
  return haystack.includes('opm') ? 'OPM' : 'SQUID';
};

const InfoRow = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className='flex justify-between gap-3'>
      <dt className='text-text-muted'>{label}</dt>
      <dd className='text-text-primary font-mono'>{value}</dd>
    </div>
  );
};

const SampleCard = ({ dataset, projectName }: { dataset: Dataset; projectName: string }) => {
  const system = datasetSystem(dataset);
  const accent = system === 'OPM' ? 'bg-success-muted text-success' : 'bg-accent-muted text-accent';
  return (
    <div className='card border-border bg-surface flex flex-col rounded-lg border p-4'>
      <div className='mb-3 flex items-start justify-between'>
        <div className={`flex h-10 w-10 items-center justify-center rounded-md ${accent}`}>
          <WaveformIcon />
        </div>
        <span className='bg-accent-muted text-accent inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
          <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-current' />
          public sample
        </span>
      </div>
      <h2 className='text-text-primary text-[15px] font-semibold'>{dataset.name}</h2>
      <p className='text-text-secondary mt-1 text-[13px]'>
        {dataset.description ?? `${projectName} sample recording.`}
      </p>
      <dl className='mt-3 space-y-1 text-[12px]'>
        <InfoRow label='Project' value={projectName} />
        <InfoRow
          label='System'
          value={system === 'OPM' ? 'OPM · optically-pumped' : 'SQUID · Vectorview'}
        />
        <InfoRow label='Versions' value={formatNumber(dataset.version_count)} />
        <InfoRow label='Recordings' value={formatNumber(dataset.recording_count)} />
        <InfoRow label='Runs' value={formatNumber(dataset.run_count)} />
      </dl>
      <div className='border-border mt-auto flex items-center justify-between border-t pt-3'>
        <span className='text-text-muted text-[12px]'>
          {formatRelativeTime(dataset.updated_at)}
        </span>
        <Link href={`/app/datasets/${dataset.id}`} className='btn btn-primary btn-sm'>
          Open
        </Link>
      </div>
    </div>
  );
};

const SharedProjectCard = ({ project }: { project: ProjectSummary }) => {
  return (
    <div className='card border-border bg-surface flex flex-col rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span
            aria-hidden='true'
            className='bg-accent-muted text-accent flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold'>
            {initials(project.name)}
          </span>
          <div>
            <h2 className='text-text-primary text-[15px] font-semibold'>{project.name}</h2>
            <p className='text-text-muted text-[12px]'>Shared · {project.role}</p>
          </div>
        </div>
        <span className='bg-info-muted text-info inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium'>
          public sample
        </span>
      </div>
      <p className='text-text-secondary mt-3 text-[13px]'>
        {project.description ?? 'No description.'}
      </p>
      <div className='text-text-muted mt-3 flex items-center gap-3 text-[12px]'>
        <span>{project.dataset_count} datasets</span>
        <span>{project.run_count} runs</span>
        <span className='ml-auto'>{formatRelativeTime(project.updated_at)}</span>
      </div>
      <div className='border-border mt-auto flex justify-end border-t pt-3'>
        <Link href={`/app/projects/${project.id}`} className='btn btn-outline btn-sm'>
          Open
        </Link>
      </div>
    </div>
  );
};

export const ExploreView = () => {
  const [search, setSearch] = useState('');
  const [system, setSystem] = useState<SystemFilter>('all');

  const projectsQuery = useQuery({
    queryKey: ['projects', { includeArchived: false }],
    queryFn: () => fetchProjects({ includeArchived: false }),
  });
  const datasetsQuery = useQuery({
    queryKey: ['datasets', { limit: 50 }],
    queryFn: () => fetchDatasets({ limit: 50 }),
  });

  const projects = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data]);
  const datasets = useMemo(() => datasetsQuery.data?.items ?? [], [datasetsQuery.data]);

  const projectNames = useMemo(() => {
    const names = new Map<string, string>();
    projects.forEach((project) => names.set(project.id, project.name));
    return names;
  }, [projects]);

  const publicProjects = useMemo(
    () => projects.filter((project) => project.visibility === 'public' || project.role !== 'owner'),
    [projects],
  );

  const publicProjectIds = useMemo(
    () => new Set(publicProjects.map((project) => project.id)),
    [publicProjects],
  );

  const sampleDatasets = useMemo(
    () =>
      datasets.filter(
        (dataset) => dataset.source_type === 'sample' || publicProjectIds.has(dataset.project_id),
      ),
    [datasets, publicProjectIds],
  );

  const filteredDatasets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sampleDatasets.filter((dataset) => {
      const matchesTerm =
        term.length === 0 ||
        dataset.name.toLowerCase().includes(term) ||
        (dataset.description?.toLowerCase().includes(term) ?? false);
      const matchesSystem = system === 'all' || datasetSystem(dataset) === system;
      return matchesTerm && matchesSystem;
    });
  }, [sampleDatasets, search, system]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return publicProjects.filter(
      (project) =>
        term.length === 0 ||
        project.name.toLowerCase().includes(term) ||
        (project.description?.toLowerCase().includes(term) ?? false),
    );
  }, [publicProjects, search]);

  const isLoading = projectsQuery.isLoading || datasetsQuery.isLoading;
  const isError = projectsQuery.isError || datasetsQuery.isError;
  const error = projectsQuery.error ?? datasetsQuery.error;

  if (isLoading) {
    return <LoadingState label='Loading public samples…' />;
  }
  if (isError) {
    return <ErrorState message={toErrorMessage(error)} />;
  }

  const isEmpty = sampleDatasets.length === 0 && publicProjects.length === 0;
  const noMatches = !isEmpty && filteredDatasets.length === 0 && filteredProjects.length === 0;

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Explore'
        description='Copy-on-open public MEG datasets with visible licences and citations. Open them as read-only projects; runs you launch on them are charged to your compute quota.'
      />

      <div className='card border-border bg-surface rounded-lg border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <input
            type='search'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Search samples by name…'
            aria-label='Search public samples'
            className='input input-bordered bg-surface-muted h-9 min-w-[240px] flex-1 text-[13px]'
          />
          <select
            value={system}
            onChange={(event) => setSystem(event.target.value as SystemFilter)}
            aria-label='Filter by system'
            className='select select-bordered bg-surface-muted h-9 text-[13px]'>
            {SYSTEM_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          title='No public samples yet'
          description='Public sample datasets and shared projects will appear here once they are published for read-only exploration.'
        />
      ) : noMatches ? (
        <NoResultsState description='No public samples match the current search and filters.' />
      ) : (
        <>
          {filteredDatasets.length > 0 ? (
            <section className='flex flex-col gap-4'>
              <div>
                <h2 className='text-text-primary text-[15px] font-semibold'>
                  Public sample recordings
                </h2>
                <p className='text-text-muted text-[12px]'>
                  Anonymised recordings you can open without a copy of your own.
                </p>
              </div>
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                {filteredDatasets.map((dataset) => (
                  <SampleCard
                    key={dataset.id}
                    dataset={dataset}
                    projectName={projectNames.get(dataset.project_id) ?? 'Sample project'}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {filteredProjects.length > 0 ? (
            <section className='flex flex-col gap-4'>
              <div>
                <h2 className='text-text-primary text-[15px] font-semibold'>Shared projects</h2>
                <p className='text-text-muted text-[12px]'>
                  Projects shared with you as a read-only viewer.
                </p>
              </div>
              <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                {filteredProjects.map((project) => (
                  <SharedProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          ) : null}

          <p className='text-text-muted text-center text-[13px]'>
            Showing {filteredDatasets.length + filteredProjects.length} of{' '}
            {sampleDatasets.length + publicProjects.length} public samples
          </p>
        </>
      )}
    </div>
  );
};
