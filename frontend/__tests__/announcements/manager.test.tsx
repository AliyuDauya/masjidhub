import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDashboard from '../../src/app/mosque/[slug]/admin/page.js';

// Mock routing contexts
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('AdminDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render default announcement dashboard state', () => {
    render(<AdminDashboard />);
    
    expect(screen.getByText('Admin Control Panel')).toBeDefined();
    expect(screen.getByText('Publish Announcement')).toBeDefined();
    expect(screen.getByText('Active Announcements (2)')).toBeDefined();
  });

  it('should display settings inputs when Settings tab is clicked', () => {
    render(<AdminDashboard />);
    
    const settingsTabButton = screen.getByText('⚙️ Mosque Settings');
    fireEvent.click(settingsTabButton);

    expect(screen.getByText('Edit Mosque Details')).toBeDefined();
    expect(screen.getByDisplayValue('Al-Noor Central Masjid')).toBeDefined();
  });

  it('should successfully append a new announcement to list on form submission', async () => {
    render(<AdminDashboard />);

    const titleInput = screen.getByPlaceholderText('Announcement Title');
    const contentInput = screen.getByPlaceholderText('Write your announcement details here...');
    const submitButton = screen.getByRole('button', { name: 'Post Announcement' });

    fireEvent.change(titleInput, { target: { value: 'New Test Event Title' } });
    fireEvent.change(contentInput, { target: { value: 'This is the body content details' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Announcement posted successfully!')).toBeDefined();
      expect(screen.getByText('New Test Event Title')).toBeDefined();
      expect(screen.getByText('Active Announcements (3)')).toBeDefined();
    });
  });

  it('should successfully remove an announcement from list on delete button click', async () => {
    render(<AdminDashboard />);

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    // Click delete on the first announcement
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Active Announcements (1)')).toBeDefined();
    });
  });
});
