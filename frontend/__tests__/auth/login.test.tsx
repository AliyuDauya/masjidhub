import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MosqueLogin from '../../src/app/mosque/[slug]/login/page.js';

// Mock next/navigation module for parameters and routing hooks
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('MosqueLogin Component', () => {
  it('should render the login form correctly', () => {
    render(<MosqueLogin />);
    
    // Check main elements
    expect(screen.getByText('Welcome Back')).toBeDefined();
    expect(screen.getByPlaceholderText('name@example.com')).toBeDefined();
    expect(screen.getByPlaceholderText('••••••••')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
  });

  it('should display error if submitted empty', async () => {
    render(<MosqueLogin />);
    
    const signInButton = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(signInButton);
    
    // Form validation check is browser-default required, but state triggers mock checks
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '' } });
    fireEvent.click(signInButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please enter both email and password.')).toBeDefined();
    });
  });

  it('should show success message on valid submission credentials format', async () => {
    render(<MosqueLogin />);
    
    const emailInput = screen.getByPlaceholderText('name@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const signInButton = screen.getByRole('button', { name: 'Sign In' });

    fireEvent.change(emailInput, { target: { value: 'ali@masjid.com' } });
    fireEvent.change(passwordInput, { target: { value: 'securePass123' } });
    fireEvent.click(signInButton);

    await waitFor(() => {
      expect(screen.getByText('Successfully authenticated!')).toBeDefined();
    });
  });
});
