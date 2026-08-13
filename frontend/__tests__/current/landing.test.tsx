import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import GlobalLandingPage from '../../src/app/page';

describe('current mosque onboarding interface', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json' }), json: async () => [] }));
  });

  it('loads the real directory endpoint and opens a complete tenant application', async () => {
    render(<GlobalLandingPage />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/mosques'), expect.any(Object)));
    fireEvent.click(screen.getByRole('button', { name: 'Register Mosque' }));
    expect(screen.getByText('Register Your Mosque')).toBeDefined();
    expect(screen.getByPlaceholderText('Administrator full name')).toBeDefined();
    expect(screen.getByPlaceholderText('Administrator sign-in email')).toBeDefined();
    expect(screen.getByPlaceholderText('Password (at least 8 characters)')).toBeDefined();
  });
});
