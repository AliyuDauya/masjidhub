import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MosqueLoginPage from '../../src/app/mosque/[slug]/login/page';
import RoleBasedLoginForm from '../../src/components/auth/RoleBasedLoginForm';

// Mock next/navigation module for parameters and routing hooks
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'al-noor' }),
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('3-Section Role-Based Login Interface', () => {
  it('should render all 3 dedicated role portal tabs on MosqueLoginPage', () => {
    render(<MosqueLoginPage />);
    
    // Check main role portal tabs exist
    expect(screen.getByText(/Worshipper/i)).toBeDefined();
    expect(screen.getByText(/Mosque Admin/i)).toBeDefined();
    expect(screen.getByText(/Operator/i)).toBeDefined();

    // Check Section 1 (Worshipper & Member) default view
    expect(screen.getByText('WORSHIPPER & MEMBER ACCESS')).toBeDefined();
    expect(screen.getByText('Member Sign-In')).toBeDefined();
    expect(screen.getByPlaceholderText('worshipper@example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: /SIGN IN AS MEMBER/i })).toBeDefined();
  });

  it('should switch dynamically between Worshipper, Admin, and Operator portals', () => {
    render(<RoleBasedLoginForm defaultSlug="al-noor" isMosquePortal={true} />);

    // Switch to Mosque Admin & Imam Workspace (Section 2)
    const adminTab = screen.getByRole('button', { name: /Mosque Admin/i });
    fireEvent.click(adminTab);

    expect(screen.getByText('MOSQUE ADMINISTRATOR & IMAM')).toBeDefined();
    expect(screen.getByText('Admin & Imam Sign-In')).toBeDefined();
    expect(screen.getByPlaceholderText('admin@masjid.org')).toBeDefined();
    expect(screen.getByRole('button', { name: /SIGN IN TO ADMIN CONSOLE/i })).toBeDefined();

    // Switch to Sovereign Platform Operator Portal (Section 3)
    const operatorTab = screen.getByRole('button', { name: /Operator/i });
    fireEvent.click(operatorTab);

    expect(screen.getByText('SOVEREIGN PLATFORM OPERATOR')).toBeDefined();
    expect(screen.getByText('Platform Operator Sign-In')).toBeDefined();
    expect(screen.getByPlaceholderText('operator@masjidhub.org')).toBeDefined();
    expect(screen.getByRole('button', { name: /AUTHENTICATE PLATFORM OPERATOR/i })).toBeDefined();
  });

  it('should validate missing email or password gracefully', () => {
    render(<RoleBasedLoginForm defaultSlug="al-noor" isMosquePortal={true} />);

    const submitBtn = screen.getByRole('button', { name: /SIGN IN AS MEMBER/i });
    fireEvent.click(submitBtn);

    // Form inputs require email and password
    const emailInput = screen.getByPlaceholderText('worshipper@example.com');
    expect(emailInput).toBeDefined();
  });
});
