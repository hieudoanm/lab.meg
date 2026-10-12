'use client';

import { useCallback, useEffect, useState } from 'react';

import { cn } from '@/lib/cn';

export interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}

/**
 * Copy a checksum, identifier, or coordinate to the clipboard.
 *
 * Clipboard access is unavailable in some contexts; failures are silent so the
 * copy action never blocks the surrounding workflow.
 */
export const CopyButton = ({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  className,
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [value]);

  return (
    <button
      type='button'
      onClick={handleCopy}
      className={cn('btn btn-ghost btn-xs gap-1 font-mono text-xs', className)}>
      <span aria-hidden='true'>{copied ? '✓' : '⧉'}</span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
};
