import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MosquePrograms from '../../src/app/mosque/[slug]/programs/page.js';

// Mock routing contexts
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('MosquePrograms Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render scheduled programs list correctly', () => {
    render(<MosquePrograms />);
    
    expect(screen.getByText('Al Noor Central Masjid Programs')).toBeDefined();
    expect(screen.getByText('Summer Tajweed Intensive')).toBeDefined();
    expect(screen.getByText('Islamic Finance & Zakat Seminar')).toBeDefined();
  });

  it('should successfully toggle status to registered on registration button click', async () => {
    render(<MosquePrograms />);
    
    // Find all 'Register Seat' buttons
    const registerButtons = screen.getAllByRole('button', { name: 'Register Seat' });
    
    // Click on the first unregistered event (Summer Tajweed Intensive)
    fireEvent.click(registerButtons[0]);

    await waitFor(() => {
      // It should now show "Cancel Seat" button
      expect(screen.getByRole('button', { name: 'Cancel Seat' })).toBeDefined();
    });
  });

  it('should successfully release registration and decrement count on cancel seat click', async () => {
    render(<MosquePrograms />);
    
    // The user is pre-registered to Youth Circle, which has "Cancel Seat" displayed
    const cancelBtn = screen.getByRole('button', { name: 'Cancel Seat' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      // It should revert back to a 'Register Seat' action button
      expect(screen.getAllByRole('button', { name: 'Register Seat' }).length).toBe(3);
    });
  });
});
