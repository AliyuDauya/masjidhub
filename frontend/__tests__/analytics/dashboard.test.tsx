import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminAnalytics from '../../src/app/mosque/[slug]/admin/analytics/page.js';

// Mock routing hooks
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('AdminAnalytics Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render aggregated donation amounts and programs capacity metrics accurately', () => {
    render(<AdminAnalytics />);

    expect(screen.getByText('Admin Analytics Dashboard')).toBeDefined();
    
    // Aggregated numbers assertions
    expect(screen.getByText('$4,850')).toBeDefined();
    expect(screen.getByText('25')).toBeDefined();
    
    // Program fill rates listing assertions
    expect(screen.getByText('Summer Tajweed Intensive')).toBeDefined();
    expect(screen.getByText('28/30 seats (93.3%)')).toBeDefined();
  });
});
