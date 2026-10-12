const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const NUMBER = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });

/** Format an ISO 8601 timestamp for display, always in UTC. */
export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return `${DATE_TIME.format(parsed)} UTC`;
};

/** Format a duration in seconds using a compact, human-readable form. */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—';
  }
  if (seconds < 60) {
    return `${NUMBER.format(seconds)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes} min ${remainder} s`;
};

/** Format the elapsed time between two ISO timestamps. */
export const formatElapsed = (start: string | null, end: string | null): string => {
  if (!start) {
    return '—';
  }
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return '—';
  }
  return formatDuration((endMs - startMs) / 1000);
};

/** Format an ISO timestamp as a compact relative time, e.g. `2 min ago`. */
export const formatRelativeTime = (
  value: string | null | undefined,
  now: number = Date.now(),
): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value).getTime();
  if (Number.isNaN(parsed)) {
    return '—';
  }
  const deltaSeconds = Math.round((now - parsed) / 1000);
  if (deltaSeconds < 45) {
    return deltaSeconds <= 1 ? 'just now' : `${deltaSeconds} s ago`;
  }
  const minutes = Math.round(deltaSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? '1 h ago' : `${hours} h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return DATE_TIME.format(new Date(parsed));
};

/** Format a finite number without discarding meaningful precision. */
export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return NUMBER.format(value);
};

/** Format a byte count using binary units. */
export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return '—';
  }
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${NUMBER.format(value)} ${units[unitIndex]}`;
};

/** Format a sampling frequency, e.g. `1000 Hz` or `1 kHz`. */
export const formatFrequency = (hz: number | null | undefined): string => {
  if (hz === null || hz === undefined || !Number.isFinite(hz)) {
    return '—';
  }
  if (hz >= 1000 && hz % 1000 === 0) {
    return `${NUMBER.format(hz / 1000)} kHz`;
  }
  return `${NUMBER.format(hz)} Hz`;
};

/** Shorten a SHA-256 digest (with or without the `sha256:` prefix) for display. */
export const formatChecksum = (checksum: string | null | undefined): string => {
  if (!checksum) {
    return '—';
  }
  const digest = checksum.startsWith('sha256:') ? checksum.slice('sha256:'.length) : checksum;
  return digest.length <= 16 ? digest : `${digest.slice(0, 12)}…`;
};

/** Shorten an opaque identifier (UUID or run id) for compact display. */
export const formatIdentifier = (value: string | null | undefined): string => {
  if (!value) {
    return '—';
  }
  return value.length <= 12 ? value : `${value.slice(0, 8)}…`;
};

/** Convert a coordinate frame to a display label. */
export const formatCoordinateFrame = (frame: string | null | undefined): string => {
  if (!frame) {
    return '—';
  }
  const labels: Record<string, string> = {
    head: 'Head',
    device: 'Device',
    mri: 'MRI',
    unknown: 'Unknown',
  };
  return labels[frame] ?? frame;
};
