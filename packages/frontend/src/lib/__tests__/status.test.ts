import { describe, expect, it } from 'vitest';

import {
  datasetStatusLabel,
  datasetStatusTone,
  projectStatusLabel,
  projectStatusTone,
  quotaStateLabel,
  quotaStateTone,
  runStatusLabel,
  runStatusTone,
} from '@/lib/status';

describe('status helpers', () => {
  it('maps run statuses to labels and tones', () => {
    expect(runStatusLabel('succeeded')).toBe('Succeeded');
    expect(runStatusTone('succeeded')).toBe('success');
    expect(runStatusTone('failed')).toBe('danger');
    expect(runStatusTone('running')).toBe('info');
    expect(runStatusTone('queued')).toBe('neutral');
  });

  it('maps dataset statuses to labels and tones', () => {
    expect(datasetStatusLabel('ready')).toBe('Ready');
    expect(datasetStatusTone('ready')).toBe('success');
    expect(datasetStatusTone('validating')).toBe('info');
    expect(datasetStatusTone('failed')).toBe('danger');
  });

  it('maps project statuses to labels and tones', () => {
    expect(projectStatusLabel('active')).toBe('Active');
    expect(projectStatusTone('active')).toBe('success');
    expect(projectStatusTone('archived')).toBe('neutral');
  });

  it('maps quota states to labels and tones', () => {
    expect(quotaStateLabel('approaching_limit')).toBe('Approaching limit');
    expect(quotaStateTone('approaching_limit')).toBe('warning');
    expect(quotaStateTone('limit_reached')).toBe('danger');
    expect(quotaStateTone('within_quota')).toBe('neutral');
  });
});
