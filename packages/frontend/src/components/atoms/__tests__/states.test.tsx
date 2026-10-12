import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState, ErrorState, LoadingState, NoResultsState } from '@/components/atoms/states';

describe('states', () => {
  it('renders an empty state title and description', () => {
    render(<EmptyState title='No datasets yet' description='Upload a recording to begin.' />);
    expect(screen.getByRole('heading', { name: 'No datasets yet' })).toBeInTheDocument();
    expect(screen.getByText('Upload a recording to begin.')).toBeInTheDocument();
  });

  it('exposes an alert role for errors', () => {
    render(<ErrorState message='Recording not found.' />);
    expect(screen.getByRole('alert')).toHaveTextContent('Recording not found.');
  });

  it('exposes a status role while loading', () => {
    render(<LoadingState label='Loading projects…' />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading projects…');
  });

  it('exposes a status role when no results match', () => {
    render(<NoResultsState />);
    expect(screen.getByRole('status')).toHaveTextContent('No resources match the current filters.');
  });
});
