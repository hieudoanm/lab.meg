import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '@/components/atoms/status-badge';

describe('StatusBadge', () => {
  it('renders the label as text so meaning is not conveyed by colour alone', () => {
    render(<StatusBadge tone='success' label='Succeeded' />);
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
  });

  it('applies the tone-specific badge class', () => {
    render(<StatusBadge tone='danger' label='Failed' />);
    expect(screen.getByText('Failed')).toHaveClass('badge-error');
  });
});
