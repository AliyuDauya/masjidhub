import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MosqueDonations from '../../src/app/mosque/[slug]/donations/page.js';

// Mock navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('MosqueDonations Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render donation dashboard correctly', () => {
    render(< MosqueDonations />);

    expect(screen.getByText('Al Noor Central Masjid Donation Portal')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g. 50')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDefined();
  });

  it('should display validation error on zero/negative donation submission', async () => {
    render(< MosqueDonations />);

    const amountInput = screen.getByPlaceholderText('e.g. 50');
    const submitBtn = screen.getByRole('button', { name: 'Proceed to Checkout' });

    // Try zero input
    fireEvent.change(amountInput, { target: { value: '0' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid donation amount greater than 0.')).toBeDefined();
    });
  });

  it('should trigger processing state and show receipt upon valid checkout info', async () => {
    render(< MosqueDonations />);

    const amountInput = screen.getByPlaceholderText('e.g. 50');
    const submitBtn = screen.getByRole('button', { name: 'Proceed to Checkout' });

    fireEvent.change(amountInput, { target: { value: '150' } });
    fireEvent.click(submitBtn);

    // Verify it transitions to processing status text
    expect(screen.getByRole('button', { name: 'Processing Transaction...' })).toBeDefined();

    // Wait for the simulated checkout sequence delay (2s in code) to complete
    await waitFor(() => {
      expect(screen.getByText('Donation Completed')).toBeDefined();
      expect(screen.getByText('$150.00')).toBeDefined();
    }, { timeout: 3000 });
  });
});
