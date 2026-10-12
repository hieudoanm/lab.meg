import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatChecksum,
  formatCoordinateFrame,
  formatDateTime,
  formatDuration,
  formatElapsed,
  formatFrequency,
  formatIdentifier,
  formatNumber,
  formatRelativeTime,
} from '@/lib/format';

describe('format', () => {
  it('formats byte counts using binary units', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(null)).toBe('—');
  });

  it('formats durations across the minute boundary', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(125)).toBe('2 min 5 s');
    expect(formatDuration(null)).toBe('—');
  });

  it('formats the elapsed time between two timestamps', () => {
    expect(formatElapsed('2024-01-01T00:00:00Z', '2024-01-01T00:01:30Z')).toBe('1 min 30 s');
    expect(formatElapsed(null, '2024-01-01T00:01:30Z')).toBe('—');
  });

  it('formats timestamps in UTC and tolerates invalid input', () => {
    expect(formatDateTime('2024-06-01T12:30:00Z')).toContain('UTC');
    expect(formatDateTime('not-a-date')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });

  it('formats frequencies with a kilohertz shortcut', () => {
    expect(formatFrequency(1000)).toBe('1 kHz');
    expect(formatFrequency(600.6)).toBe('600.6 Hz');
    expect(formatFrequency(null)).toBe('—');
  });

  it('formats numbers and rejects non-finite values', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('shortens checksums and identifiers', () => {
    expect(formatChecksum('sha256:abcdef0123456789abcd')).toBe('abcdef012345…');
    expect(formatChecksum('abc')).toBe('abc');
    expect(formatIdentifier('12345678-1234')).toBe('12345678…');
    expect(formatIdentifier('run_1')).toBe('run_1');
  });

  it('labels coordinate frames and falls back to the raw value', () => {
    expect(formatCoordinateFrame('head')).toBe('Head');
    expect(formatCoordinateFrame('custom')).toBe('custom');
    expect(formatCoordinateFrame(null)).toBe('—');
  });

  it('renders compact relative times', () => {
    const now = Date.parse('2024-06-01T12:00:00Z');
    expect(formatRelativeTime('2024-06-01T11:58:00Z', now)).toBe('2 min ago');
    expect(formatRelativeTime('2024-06-01T11:00:00Z', now)).toBe('1 h ago');
    expect(formatRelativeTime(null, now)).toBe('—');
  });
});
