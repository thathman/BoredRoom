import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperatorConsole } from '@/components/session/OperatorConsole';

describe('OperatorConsole', () => {
  it('redirects old operator surfaces to the unified house display', () => {
    render(
      <MemoryRouter>
        <OperatorConsole code="ABCDE" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Controls moved to the house display')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open house display' })).toBeInTheDocument();
  });
});
