'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { DataTable, type DataTableColumn } from '@/components/atoms/data-table';
import { SelectField } from '@/components/atoms/select-field';
import { StatusBadge } from '@/components/atoms/status-badge';
import { ErrorState, LoadingState } from '@/components/atoms/states';
import { TextField } from '@/components/atoms/text-field';
import { useToast } from '@/components/atoms/toast';
import { PageHeader } from '@/components/molecules/page-header';
import { endSession, fetchCurrentUser, fetchQuotas, fetchUsage, toErrorMessage } from '@/lib/api';
import type { CurrentUser, Quota, SignalUnitsPreset, UsageRecord } from '@/lib/api/types';
import { formatBytes, formatDateTime, formatDuration, formatNumber } from '@/lib/format';
import { quotaStateLabel, quotaStateTone } from '@/lib/status';

const UNIT_OPTIONS: { value: SignalUnitsPreset; label: string }[] = [
  { value: 'si', label: 'SI units (T, T/m, V)' },
  { value: 'native', label: 'Native acquisition units' },
  { value: 'display', label: 'Display-friendly units (fT, fT/cm)' },
];

const QUOTA_RESOURCES: Record<
  Quota['resource_type'],
  { label: string; format: (value: number) => string }
> = {
  storage_bytes: { label: 'Storage', format: formatBytes },
  cpu_seconds: { label: 'CPU time', format: formatDuration },
  runs: { label: 'Runs', format: (value) => formatNumber(value) },
};

const USAGE_LABELS: Record<UsageRecord['resource_type'], string> = {
  storage_bytes: 'Storage',
  cpu_seconds: 'CPU time',
  runs: 'Runs',
};

const usageColumns: DataTableColumn<UsageRecord>[] = [
  {
    key: 'resource',
    header: 'Resource',
    render: (record) => USAGE_LABELS[record.resource_type],
  },
  {
    key: 'quantity',
    header: 'Quantity',
    className: 'text-right',
    render: (record) => (
      <span className='font-mono text-[13px]'>
        {QUOTA_RESOURCES[record.resource_type].format(record.quantity)}
      </span>
    ),
  },
  {
    key: 'recorded',
    header: 'Recorded',
    className: 'text-right',
    render: (record) => (
      <span className='text-text-muted font-mono text-[12px]'>
        {formatDateTime(record.created_at)}
      </span>
    ),
  },
];

const QuotaRow = ({ quota }: { quota: Quota }) => {
  const meta = QUOTA_RESOURCES[quota.resource_type];
  const ratio = quota.limit > 0 ? Math.min((quota.used / quota.limit) * 100, 100) : 0;
  return (
    <div>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-text-primary text-[13px] font-medium'>{meta.label}</span>
        <StatusBadge tone={quotaStateTone(quota.state)} label={quotaStateLabel(quota.state)} />
      </div>
      <div className='mt-2 flex items-baseline justify-between text-[13px]'>
        <span className='text-text-primary font-mono'>{meta.format(quota.used)} used</span>
        <span className='text-text-muted'>of {meta.format(quota.limit)}</span>
      </div>
      <progress className='progress progress-primary mt-2 h-1.5 w-full' value={ratio} max={100} />
    </div>
  );
};

const ProfileSection = ({ user }: { user: CurrentUser }) => {
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState(user.display_name ?? '');
  const [institution, setInstitution] = useState(
    'MEG Unit, Department of Neuroscience, University of Example',
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: 'Profile saved',
      description: 'Your display name and institution were updated.',
      tone: 'success',
    });
  };

  return (
    <Card title='Profile' description='Visible to members of the projects you share.'>
      <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-4'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <TextField
            label='Display name'
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <TextField
            label='Institution'
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
          />
        </div>
        <TextField
          label='Email address'
          value={user.email ?? ''}
          readOnly
          hint='Managed by your institution SSO — contact your administrator to change it.'
          className='cursor-not-allowed'
        />
        <div className='flex justify-end gap-2 pt-1'>
          <Button type='submit' variant='primary' size='sm'>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
};

const PreferencesSection = () => {
  const { showToast } = useToast();
  const [dark, setDark] = useState(true);
  const [units, setUnits] = useState<SignalUnitsPreset>('si');
  const [channels, setChannels] = useState('MEG*, STI101, EOG001');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    showToast({
      title: 'Preferences saved',
      description: 'Theme, units, and default channel selection were updated.',
      tone: 'success',
    });
  };

  return (
    <Card
      title='Preferences'
      description='How signals, units, and channels are presented across the workspace.'>
      <form onSubmit={handleSubmit} noValidate className='flex flex-col gap-4'>
        <div className='border-border flex items-center justify-between gap-3 border-b pb-4'>
          <div>
            <div className='text-text-primary text-[13px] font-medium'>Dark interface</div>
            <div className='text-text-muted text-[12px]'>
              Use the dark theme for viewing signals and sensor maps.
            </div>
          </div>
          <input
            type='checkbox'
            checked={dark}
            onChange={(event) => setDark(event.target.checked)}
            aria-label='Dark interface'
            className='toggle toggle-sm'
          />
        </div>
        <SelectField
          label='Signal units preset'
          value={units}
          onChange={(event) => setUnits(event.target.value as SignalUnitsPreset)}
          options={UNIT_OPTIONS}
        />
        <TextField
          label='Default channels'
          hint='Comma-separated patterns expanded when opening a recording.'
          value={channels}
          onChange={(event) => setChannels(event.target.value)}
          className='font-mono'
        />
        <div className='flex justify-end pt-1'>
          <Button type='submit' variant='primary' size='sm'>
            Save preferences
          </Button>
        </div>
      </form>
    </Card>
  );
};

export const SettingsView = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const userQuery = useQuery({ queryKey: ['current-user'], queryFn: () => fetchCurrentUser() });
  const quotasQuery = useQuery({ queryKey: ['quotas'], queryFn: () => fetchQuotas() });
  const usageQuery = useQuery({ queryKey: ['usage'], queryFn: () => fetchUsage() });

  const quotas = useMemo(() => quotasQuery.data?.items ?? [], [quotasQuery.data]);
  const usage = useMemo(() => usageQuery.data?.items ?? [], [usageQuery.data]);

  const isLoading = userQuery.isLoading || quotasQuery.isLoading || usageQuery.isLoading;
  const isError = userQuery.isError || quotasQuery.isError || usageQuery.isError;
  const error = userQuery.error ?? quotasQuery.error ?? usageQuery.error;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await endSession();
      showToast({
        title: 'Signed out',
        description: 'Ended the session on this device.',
        tone: 'success',
      });
      router.push('/login');
    } catch (signOutError) {
      showToast({
        title: 'Could not sign out',
        description: toErrorMessage(signOutError),
        tone: 'danger',
      });
      setSigningOut(false);
    }
  };

  if (isLoading) {
    return <LoadingState label='Loading settings…' />;
  }
  if (isError) {
    return <ErrorState message={toErrorMessage(error)} />;
  }

  const user = userQuery.data;

  return (
    <div className='flex flex-col gap-6'>
      <PageHeader
        title='Workspace settings'
        description='Account, preferences, and compute allowances for this workspace.'
      />

      <div className='flex max-w-3xl flex-col gap-6'>
        {user ? <ProfileSection user={user} /> : null}

        <PreferencesSection />

        <Card
          title='Quota & usage'
          description='Storage, compute, and run allowances recorded for this workspace.'>
          <div className='space-y-5'>
            {quotas.map((quota) => (
              <QuotaRow key={quota.resource_type} quota={quota} />
            ))}
          </div>
          <div className='mt-6'>
            <h3 className='text-text-primary text-[13px] font-medium'>Recent usage</h3>
            <div className='mt-3'>
              <DataTable columns={usageColumns} rows={usage} getRowKey={(record) => record.id} />
            </div>
          </div>
        </Card>

        <Card title='Danger zone' description='End the session on this device.'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div>
              <div className='text-text-primary text-[13px] font-medium'>Sign out</div>
              <div className='text-text-muted text-[12px]'>
                You will need to sign in again to access the workspace.
              </div>
            </div>
            <Button variant='danger' size='sm' onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
