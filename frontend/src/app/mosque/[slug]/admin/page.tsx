'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, clearToken } from '@/lib/api';
import NotificationCenter from '@/components/NotificationCenter';

export type Tab = 'overview' | 'announcements' | 'programs' | 'donations' | 'members' | 'audit' | 'settings';
export type TenantRole = 'tenant_admin' | 'finance_officer' | 'programme_officer' | 'communications_officer' | 'member';

interface Mosque {
  name: string;
  slug: string;
  address?: string;
  phone?: string;
  email?: string;
  timezone: string;
  brand_color: string;
  fajr_time?: string;
  dhuhr_time?: string;
  asr_time?: string;
  maghrib_time?: string;
  isha_time?: string;
  jumua_time?: string;
}

interface Announcement {
  announcement_id: number;
  title: string;
  content: string;
  category: string;
  audience: string;
  status: string;
  posted_at: string;
}

interface Membership {
  membership_id: number;
  role: string;
  status: string;
  user: { user_id: number; name: string; email: string };
}

interface Donation {
  donation_id: number;
  receipt_number: string;
  amount: number;
  currency: string;
  category: string;
  method: string;
  status: string;
  reconciliation_status: string;
  date: string;
  external_reference?: string;
  donor_email?: string;
  verified_by?: number | null;
}

interface Program {
  program_id: number;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  location: string;
  max_capacity: number;
  visibility: 'Public' | 'Members';
  status: 'Draft' | 'Published' | 'Cancelled' | 'Completed';
  _count?: { registrations: number };
}

interface Attendee {
  reg_id: number;
  user_id: number;
  reg_date: string;
  status: 'Registered' | 'Attended' | 'Cancelled';
  attended_at: string | null;
  user: { user_id: number; name: string; email: string; phone?: string | null };
}

interface AuditEvent {
  audit_id: number;
  mosque_id?: number;
  actor_id?: number;
  action: string;
  target_type: string;
  target_id?: string | number | null;
  summary: string;
  request_id?: string | null;
  ip_address?: string | null;
  created_at: string;
  actor?: { name: string; email: string } | null;
}

interface UserMe {
  user_id: number;
  name: string;
  email: string;
  platform_role?: string;
  memberships: Array<{
    membership_id: number;
    role: TenantRole;
    status: string;
    mosque: { mosque_id: number; slug: string; name: string };
  }>;
}

const ROLE_TABS: Record<TenantRole, Array<{ id: Tab; label: string }>> = {
  tenant_admin: [
    { id: 'overview', label: 'Overview' },
    { id: 'programs', label: 'Programmes & Roster' },
    { id: 'donations', label: 'Donations & Treasury' },
    { id: 'announcements', label: 'Noticeboard' },
    { id: 'members', label: 'People & Roles' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'settings', label: 'Settings' }
  ],
  finance_officer: [
    { id: 'overview', label: 'Overview' },
    { id: 'donations', label: 'Donations & Treasury' }
  ],
  programme_officer: [
    { id: 'overview', label: 'Overview' },
    { id: 'programs', label: 'Programmes & Roster' }
  ],
  communications_officer: [
    { id: 'overview', label: 'Overview' },
    { id: 'announcements', label: 'Noticeboard' }
  ],
  member: [{ id: 'overview', label: 'Overview' }]
};

export default function MosqueAdmin() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [tab, setTab] = useState<Tab>('overview');
  const [currentRole, setCurrentRole] = useState<TenantRole>('tenant_admin');
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [invite, setInvite] = useState({ name: '', email: '', role: 'member', temporary_password: '' });

  // Program Management State
  const [programForm, setProgramForm] = useState({
    title: '',
    description: '',
    category: 'Education',
    start_date: '',
    end_date: '',
    location: '',
    max_capacity: 0,
    visibility: 'Public' as 'Public' | 'Members',
    status: 'Published' as 'Draft' | 'Published' | 'Cancelled' | 'Completed'
  });
  const [editingProgramId, setEditingProgramId] = useState<number | null>(null);

  // Program Roster State
  const [selectedRosterProgram, setSelectedRosterProgram] = useState<Program | null>(null);
  const [roster, setRoster] = useState<Attendee[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [isDispatchingReminders, setIsDispatchingReminders] = useState(false);

  // Donations Management State
  const [reconciliationFilter, setReconciliationFilter] = useState<'All' | 'Unreconciled' | 'Reconciled'>('All');
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashForm, setCashForm] = useState({
    amount: '',
    category: 'Sadaqah' as 'Zakat' | 'Sadaqah' | 'Waqf' | 'General',
    currency: 'NGN',
    donor_email: '',
    notes: ''
  });
  const [isSavingCash, setIsSavingCash] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<number | null>(null);

  // Audit Logs State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('All');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function done(text: string) {
    setMessage(text);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  }

  async function load() {
    setError('');
    try {
      let userRole: TenantRole = 'tenant_admin';
      try {
        const me = await api<UserMe>(slug, '/api/auth/me');
        if (me && me.user_id) {
          setCurrentUser({ name: me.name, email: me.email });
          const tenantMembership = me.memberships?.find((m) => m.mosque?.slug === slug && m.status === 'Active');
          if (tenantMembership) {
            userRole = tenantMembership.role;
          }
        }
      } catch {
        // Fallback default
      }

      if (userRole === 'member') {
        router.push(`/mosque/${slug}`);
        return;
      }
      setCurrentRole(userRole);

      const allowed = ROLE_TABS[userRole] || [];
      if (!allowed.some((t) => t.id === tab)) {
        setTab(allowed[0]?.id || 'overview');
      }

      const m = await api<Mosque>(null, `/api/mosques/${slug}`);
      setMosque(m);

      if (userRole === 'tenant_admin' || userRole === 'communications_officer') {
        try {
          const a = await api<Announcement[]>(slug, '/api/announcements');
          setAnnouncements(a || []);
        } catch { /* ignored */ }
      }

      if (userRole === 'tenant_admin' || userRole === 'programme_officer') {
        try {
          const p = await api<Program[]>(slug, '/api/admin/programs');
          setPrograms(p || []);
        } catch {
          try {
            const pub = await api<Program[]>(slug, '/api/programs');
            setPrograms(pub || []);
          } catch { /* ignored */ }
        }
      }

      if (userRole === 'tenant_admin' || userRole === 'finance_officer') {
        try {
          const ds = await api<Donation[]>(slug, '/api/admin/donations');
          setDonations(ds || []);
        } catch { /* ignored */ }
      }

      if (userRole === 'tenant_admin') {
        try {
          const [ms, aud] = await Promise.all([
            api<Membership[]>(slug, '/api/admin/memberships'),
            api<AuditEvent[]>(slug, '/api/admin/audit-events')
          ]);
          setMembers(ms || []);
          setAuditEvents(aud || []);
        } catch { /* ignored */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Workspace could not be loaded.');
    }
  }

  useEffect(() => {
    load();
  }, [slug]);

  async function publishAnnouncement(e: FormEvent) {
    e.preventDefault();
    try {
      await api(slug, '/api/admin/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, content, category, status: 'Published', audience: 'Public' })
      });
      setTitle('');
      setContent('');
      done('Announcement published successfully.');
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not publish announcement.');
    }
  }

  async function inviteMember(e: FormEvent) {
    e.preventDefault();
    try {
      await api(slug, '/api/admin/memberships', {
        method: 'POST',
        body: JSON.stringify(invite)
      });
      setInvite({ name: '', email: '', role: 'member', temporary_password: '' });
      done('Person added and role assigned.');
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not add person.');
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!mosque) return;
    try {
      await api(slug, `/api/admin/mosques/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: mosque.name,
          address: mosque.address,
          email: mosque.email,
          phone: mosque.phone,
          timezone: mosque.timezone,
          brand_color: mosque.brand_color,
          fajr_time: mosque.fajr_time,
          dhuhr_time: mosque.dhuhr_time,
          asr_time: mosque.asr_time,
          maghrib_time: mosque.maghrib_time,
          isha_time: mosque.isha_time,
          jumua_time: mosque.jumua_time,
        })
      });
      done('Mosque settings and prayer times updated successfully.');
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not save settings.');
    }
  }

  async function saveProgram(e: FormEvent) {
    e.preventDefault();
    if (!programForm.title || !programForm.start_date || !programForm.end_date || !programForm.location) {
      setError('Please fill in all required programme fields.');
      return;
    }

    try {
      if (editingProgramId) {
        await api(slug, `/api/admin/programs/${editingProgramId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...programForm,
            start_date: new Date(programForm.start_date).toISOString(),
            end_date: new Date(programForm.end_date).toISOString()
          })
        });
        done('Programme updated successfully.');
      } else {
        await api(slug, '/api/admin/programs', {
          method: 'POST',
          body: JSON.stringify({
            ...programForm,
            start_date: new Date(programForm.start_date).toISOString(),
            end_date: new Date(programForm.end_date).toISOString()
          })
        });
        done('Programme scheduled successfully.');
      }

      setEditingProgramId(null);
      setProgramForm({
        title: '',
        description: '',
        category: 'Education',
        start_date: '',
        end_date: '',
        location: '',
        max_capacity: 0,
        visibility: 'Public',
        status: 'Published'
      });
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not save programme.');
    }
  }

  function editProgram(program: Program) {
    setEditingProgramId(program.program_id);
    const formatLocal = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setProgramForm({
      title: program.title,
      description: program.description,
      category: program.category || 'Education',
      start_date: formatLocal(program.start_date),
      end_date: formatLocal(program.end_date),
      location: program.location,
      max_capacity: program.max_capacity || 0,
      visibility: program.visibility || 'Public',
      status: program.status || 'Published'
    });
  }

  async function deleteProgram(id: number) {
    if (!confirm('Are you sure you want to delete this programme?')) return;
    try {
      await api(slug, `/api/admin/programs/${id}`, { method: 'DELETE' });
      done('Programme deleted.');
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not delete programme.');
    }
  }

  async function openRoster(program: Program) {
    setSelectedRosterProgram(program);
    setLoadingRoster(true);
    try {
      const data = await api<Attendee[]>(slug, `/api/admin/programs/${program.program_id}/registrations`);
      setRoster(data || []);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not load attendee roster.');
    } finally {
      setLoadingRoster(false);
    }
  }

  async function toggleAttendance(regId: number, currentStatus: string) {
    const nextStatus = currentStatus === 'Attended' ? 'Registered' : 'Attended';
    try {
      const updated = await api<Attendee>(slug, `/api/admin/registrations/${regId}/attendance`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      setRoster((prev) =>
        prev.map((r) => (r.reg_id === regId ? { ...r, status: updated.status, attended_at: updated.attended_at } : r))
      );
      done(`Attendance marked as ${nextStatus}.`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not update attendance status.');
    }
  }

  async function dispatchReminders(programId: number) {
    setIsDispatchingReminders(true);
    try {
      const res = await api<{ sent: number }>(slug, `/api/admin/programs/${programId}/reminders`, {
        method: 'POST'
      });
      done(`Automated reminders broadcasted to ${res.sent} registered attendee(s).`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not dispatch reminders.');
    } finally {
      setIsDispatchingReminders(false);
    }
  }

  async function reconcileDonation(id: number) {
    setReconcilingId(id);
    try {
      const updated = await api<Donation>(slug, `/api/admin/donations/${id}/reconcile`, {
        method: 'PATCH'
      });
      setDonations((prev) =>
        prev.map((d) => (d.donation_id === id ? { ...d, reconciliation_status: 'Reconciled' } : d))
      );
      done(`Donation receipt ${updated.receipt_number} reconciled.`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not reconcile donation.');
    } finally {
      setReconcilingId(null);
    }
  }

  async function handleRecordCash(e: FormEvent) {
    e.preventDefault();
    const parsedAmount = parseFloat(cashForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid cash donation amount greater than 0.');
      return;
    }
    setIsSavingCash(true);
    try {
      const payload = {
        amount: parsedAmount,
        category: cashForm.category,
        method: 'Cash',
        currency: cashForm.currency || 'NGN',
        donor_email: cashForm.donor_email.trim() || undefined,
        external_reference: cashForm.notes.trim() || undefined
      };
      const newDonation = await api<Donation>(slug, '/api/admin/donations/manual', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setDonations((prev) => [newDonation, ...prev]);
      setShowCashModal(false);
      setCashForm({ amount: '', category: 'Sadaqah', currency: 'NGN', donor_email: '', notes: '' });
      done(`Manual cash donation recorded (Receipt: ${newDonation.receipt_number}).`);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not record manual donation.');
    } finally {
      setIsSavingCash(false);
    }
  }

  async function exportDonations() {
    setIsExporting(true);
    try {
      const csv = await api<string>(slug, '/api/admin/donations/export.csv');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-donations.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      done('Donation ledger exported as CSV.');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not export donations.');
    } finally {
      setIsExporting(false);
    }
  }

  const filteredDonations = donations.filter((d) => {
    if (reconciliationFilter === 'All') return true;
    return d.reconciliation_status === reconciliationFilter;
  });

  const filteredAuditEvents = auditEvents.filter((ev) => {
    const matchesSearch =
      auditSearch === '' ||
      ev.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      ev.summary.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (ev.actor?.name && ev.actor.name.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (ev.actor?.email && ev.actor.email.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (ev.target_type && ev.target_type.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (ev.request_id && ev.request_id.toLowerCase().includes(auditSearch.toLowerCase())) ||
      (ev.ip_address && ev.ip_address.toLowerCase().includes(auditSearch.toLowerCase()));

    const matchesCategory =
      auditCategoryFilter === 'All' ||
      (auditCategoryFilter === 'Program' && ev.action.startsWith('program.')) ||
      (auditCategoryFilter === 'Donation' && ev.action.startsWith('donation')) ||
      (auditCategoryFilter === 'Membership' && ev.action.startsWith('membership.')) ||
      (auditCategoryFilter === 'Announcement' && ev.action.startsWith('announcement.')) ||
      (auditCategoryFilter === 'Attendance' && ev.action.startsWith('attendance.'));

    return matchesSearch && matchesCategory;
  });

  const navItems = ROLE_TABS[currentRole] || ROLE_TABS.tenant_admin;

  return (
    <div className="relative min-h-screen bg-[#fcfbfa] text-[#1c2421] font-sans selection:bg-[#c89b3c] selection:text-[#0d4734] flex flex-col justify-between">
      {/* 80px Glassmorphism Navigation Header */}
      <header className="nav-glass px-8 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href={`/mosque/${slug}`} className="text-2xl font-black uppercase tracking-tighter text-[#0d4734] flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#c89b3c]" />
            <span>MASJIDHUB</span>
          </Link>
          <span className="text-[#c89b3c]/40">/</span>
          <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
            WORKSPACE ({slug})
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest bg-[#e4efe9] text-[#0d4734] px-2.5 py-0.5 rounded-full border border-[#0d4734]/20 hidden sm:inline">
            {currentRole.replaceAll('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter slug={slug} />
          <Link
            href={`/mosque/${slug}/admin/analytics`}
            className="btn-pill-secondary py-2 px-4 text-[9px] tracking-ultra-wide hidden sm:inline-flex"
          >
            ANALYTICS
          </Link>
          <button
            onClick={() => {
              clearToken(slug);
              router.push(`/mosque/${slug}`);
            }}
            className="text-[9px] font-black uppercase tracking-widest text-red-600 hover:text-red-800 px-3 py-2"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid md:grid-cols-[240px_1fr] gap-8 flex-grow w-full">
        {/* Navigation Sidebar */}
        <nav className="space-y-2">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full text-left px-4 py-3 rounded-[8px] text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between ${
                tab === id
                  ? 'bg-[#0d4734] text-[#c89b3c] border-2 border-[#c89b3c] shadow-md'
                  : 'bg-white text-[#1c2421] hover:bg-[#f6f3eb] border border-[#c89b3c]/20'
              }`}
            >
              <span>{label}</span>
              {id === 'donations' && donations.filter((d) => d.reconciliation_status === 'Unreconciled').length > 0 && (
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                    tab === id ? 'bg-[#c89b3c] text-[#0d4734]' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {donations.filter((d) => d.reconciliation_status === 'Unreconciled').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Workspace Content View */}
        <section className="min-w-0 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase rounded-[6px]">
              {error}
            </div>
          )}
          {message && (
            <div className="p-4 bg-[#e4efe9] border border-[#0d4734] text-[#0d4734] text-xs font-bold uppercase rounded-[6px]">
              {message}
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-[#0d4734] text-white p-8 md:p-10 rounded-[16px] border-2 border-[#c89b3c] shadow-xl relative overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-2">
                  SOVEREIGN MOSQUE OPERATIONS
                </span>
                <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter">
                  Welcome back{currentUser?.name ? `, ${currentUser.name}` : ''}
                </h2>
                <p className="text-[#e4efe9] text-xs sm:text-sm mt-2 max-w-2xl font-normal leading-relaxed">
                  You are authenticated to {mosque?.name || 'the mosque'} as{' '}
                  <strong className="text-[#c89b3c] uppercase underline">{currentRole.replaceAll('_', ' ')}</strong>. Manage
                  timetables, attendees, donations, and dispatches directly from your workspace.
                </p>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    PROGRAMMES
                  </span>
                  <p className="text-3xl font-black text-[#0d4734]">{programs.length}</p>
                  <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Active learning circles</p>
                </div>
                <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    DONATIONS
                  </span>
                  <p className="text-3xl font-black text-[#0d4734]">{donations.length}</p>
                  <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">
                    {donations.filter((d) => d.reconciliation_status === 'Reconciled').length} reconciled
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    NOTICES
                  </span>
                  <p className="text-3xl font-black text-[#0d4734]">{announcements.length}</p>
                  <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Published bulletins</p>
                </div>
                <div className="bg-white p-6 rounded-[12px] border-2 border-[#c89b3c]/20 shadow-xs">
                  <span className="text-[9px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    MEMBERS
                  </span>
                  <p className="text-3xl font-black text-[#0d4734]">{members.length}</p>
                  <p className="text-[10px] font-mono text-[#1c2421]/50 mt-1 uppercase">Congregation worshippers</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ANNOUNCEMENTS */}
          {tab === 'announcements' && (
            <div className="space-y-6">
              <form onSubmit={publishAnnouncement} className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-4">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  COMMUNICATION DISPATCH
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  Publish Notice
                </h2>
                <input
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ANNOUNCEMENT TITLE"
                  required
                />
                <select
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="General">General Notice</option>
                  <option value="Event">Community Event</option>
                  <option value="Prayer">Prayer Timetable Update</option>
                  <option value="Urgent">Urgent Alert</option>
                </select>
                <textarea
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-normal text-[#1c2421] focus:outline-none focus:border-[#0d4734] min-h-[120px]"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What should the community know?"
                  required
                />
                <button type="submit" className="btn-pill-cta py-3 px-6 text-[9px] tracking-ultra-wide">
                  PUBLISH ANNOUNCEMENT →
                </button>
              </form>

              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <h2 className="text-xl font-black uppercase tracking-tight text-[#0d4734] mb-4">
                  Published Noticeboard
                </h2>
                {announcements.length === 0 ? (
                  <p className="text-xs font-mono text-[#1c2421]/50 uppercase py-4">No published announcements yet.</p>
                ) : (
                  <div className="space-y-4 divide-y divide-[#c89b3c]/15">
                    {announcements.map((a) => (
                      <article key={a.announcement_id} className="pt-4 first:pt-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2 py-0.5 rounded">
                            {a.category}
                          </span>
                          <span className="text-[9px] font-mono text-[#1c2421]/50">
                            {new Date(a.posted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-[#0d4734]">{a.title}</h3>
                        <p className="text-xs text-[#1c2421]/70 leading-relaxed font-normal mt-1">{a.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PROGRAMMES & ROSTER */}
          {tab === 'programs' && (
            <div className="space-y-6">
              {/* Program Schedule / Edit Form */}
              <form onSubmit={saveProgram} className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                      LEARNING & CIRCLES
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      {editingProgramId ? 'Edit Programme' : 'Schedule New Programme'}
                    </h2>
                  </div>
                  {editingProgramId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProgramId(null);
                        setProgramForm({
                          title: '',
                          description: '',
                          category: 'Education',
                          start_date: '',
                          end_date: '',
                          location: '',
                          max_capacity: 0,
                          visibility: 'Public',
                          status: 'Published'
                        });
                      }}
                      className="btn-pill-secondary py-1 px-3 text-[9px]"
                    >
                      CANCEL EDIT
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Programme Title *
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      placeholder="E.G. WEEKEND TAJWEED INTENSIVE"
                      value={programForm.title}
                      onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Category *
                    </label>
                    <select
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={programForm.category}
                      onChange={(e) => setProgramForm({ ...programForm, category: e.target.value })}
                    >
                      <option value="Education">Education & Tafseer</option>
                      <option value="Youth">Youth & Leadership</option>
                      <option value="Community">Community Gathering</option>
                      <option value="Sisters">Sisters Circle</option>
                      <option value="Quran">Quran Recitation</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Location / Hall *
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      placeholder="E.G. MAIN PRAYER HALL"
                      value={programForm.location}
                      onChange={(e) => setProgramForm({ ...programForm, location: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Start Date & Time *
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      type="datetime-local"
                      value={programForm.start_date}
                      onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      End Date & Time *
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      type="datetime-local"
                      value={programForm.end_date}
                      onChange={(e) => setProgramForm({ ...programForm, end_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Seat Capacity Limit (0 for open)
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      type="number"
                      min={0}
                      value={programForm.max_capacity}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, max_capacity: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Visibility & Access
                    </label>
                    <select
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={programForm.visibility}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, visibility: e.target.value as 'Public' | 'Members' })
                      }
                    >
                      <option value="Public">Public (Anyone can discover & register)</option>
                      <option value="Members">Members Only</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                    Programme Description *
                  </label>
                  <textarea
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-normal text-[#1c2421] focus:outline-none focus:border-[#0d4734] min-h-[100px]"
                    placeholder="Provide overview, curriculum, teacher details..."
                    value={programForm.description}
                    onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn-pill-cta py-3 px-6 text-[9px] tracking-ultra-wide">
                  {editingProgramId ? 'UPDATE PROGRAMME →' : 'SCHEDULE PROGRAMME →'}
                </button>
              </form>

              {/* Programmes List */}
              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <h2 className="text-xl font-black uppercase tracking-tight text-[#0d4734] mb-4">
                  Active & Scheduled Programmes
                </h2>
                {programs.length === 0 ? (
                  <p className="text-xs font-mono text-[#1c2421]/50 uppercase py-4">No programmes scheduled.</p>
                ) : (
                  <div className="space-y-4">
                    {programs.map((p) => (
                      <div
                        key={p.program_id}
                        className="p-5 border border-[#c89b3c]/20 rounded-[12px] hover:border-[#0d4734] transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#fcfbfa]"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#0d4734] bg-[#e4efe9] px-2 py-0.5 rounded">
                              {p.category}
                            </span>
                            <span className="text-[9px] font-mono text-[#1c2421]/50">
                              {p.visibility}
                            </span>
                            <span className="text-[9px] font-mono text-[#c89b3c]">
                              {p.max_capacity > 0 ? `CAP: ${p.max_capacity}` : 'OPEN CAPACITY'}
                            </span>
                          </div>
                          <h3 className="text-lg font-black uppercase tracking-tight text-[#0d4734]">{p.title}</h3>
                          <p className="text-xs text-[#1c2421]/70">
                            📍 {p.location} • 🗓️ {new Date(p.start_date).toLocaleDateString()} at{' '}
                            {new Date(p.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openRoster(p)}
                            className="btn-pill-cta py-2 px-4 text-[9px] tracking-widest"
                          >
                            ROSTER & CHECK-IN
                          </button>
                          <button
                            onClick={() => editProgram(p)}
                            className="btn-pill-secondary py-2 px-3 text-[9px] tracking-widest"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => deleteProgram(p.program_id)}
                            className="btn-pill-secondary py-2 px-3 text-[9px] tracking-widest text-red-600 hover:text-red-700"
                          >
                            DELETE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendee Roster Modal */}
              {selectedRosterProgram && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-[16px] border-2 border-[#c89b3c]/40 p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-6">
                    <div className="flex justify-between items-start border-b border-[#c89b3c]/20 pb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c]">
                          ROSTER & DOOR CHECK-IN
                        </span>
                        <h3 className="text-2xl font-black uppercase tracking-tight text-[#0d4734] mt-1">
                          {selectedRosterProgram.title}
                        </h3>
                        <p className="text-xs font-mono text-[#1c2421]/60 mt-1">
                          📍 {selectedRosterProgram.location} • {roster.length} registered attendee(s)
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedRosterProgram(null)}
                        className="text-xs font-black uppercase tracking-widest text-[#1c2421]/50 hover:text-[#1c2421]"
                      >
                        [CLOSE ×]
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-[#f6f3eb] p-4 rounded-[8px] border border-[#c89b3c]/20">
                      <div className="text-xs font-bold text-[#0d4734]">
                        Check-In: {roster.filter((r) => r.status === 'Attended').length} / {roster.length} checked in
                      </div>
                      <button
                        onClick={() => dispatchReminders(selectedRosterProgram.program_id)}
                        disabled={isDispatchingReminders}
                        className="btn-pill-gold py-1.5 px-4 text-[9px] tracking-widest"
                      >
                        {isDispatchingReminders ? 'BROADCASTING…' : '📢 BROADCAST REMINDERS'}
                      </button>
                    </div>

                    {loadingRoster ? (
                      <p className="text-center text-xs font-mono uppercase text-[#1c2421]/50 py-8">Loading roster…</p>
                    ) : roster.length === 0 ? (
                      <p className="text-center text-xs font-mono uppercase text-[#1c2421]/50 py-8">No attendees registered yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                              <th className="py-2.5 px-2">Attendee</th>
                              <th className="py-2.5 px-2">Email</th>
                              <th className="py-2.5 px-2">Registered</th>
                              <th className="py-2.5 px-2">Status</th>
                              <th className="py-2.5 px-2 text-right">Door Check-In</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roster.map((r) => (
                              <tr key={r.reg_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/50">
                                <td className="py-2.5 px-2 font-bold text-[#0d4734]">{r.user?.name || 'Member'}</td>
                                <td className="py-2.5 px-2 text-[#1c2421]/60 font-mono text-[10px]">{r.user?.email}</td>
                                <td className="py-2.5 px-2 text-[#1c2421]/60 font-mono text-[10px]">
                                  {new Date(r.reg_date).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                      r.status === 'Attended'
                                        ? 'bg-[#e4efe9] text-[#0d4734]'
                                        : r.status === 'Registered'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {r.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-2 text-right">
                                  <button
                                    onClick={() => toggleAttendance(r.reg_id, r.status)}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest transition-all ${
                                      r.status === 'Attended'
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                        : 'bg-[#0d4734] text-white hover:bg-[#c89b3c]'
                                    }`}
                                  >
                                    {r.status === 'Attended' ? 'UNDO' : '✓ CHECK IN'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: DONATIONS & TREASURY */}
          {tab === 'donations' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-[#c89b3c]/20 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                      TREASURY RECONCILIATION
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      Donation Ledger
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowCashModal(true)}
                      className="btn-pill-cta py-2 px-4 text-[9px] tracking-widest"
                    >
                      + RECORD CASH ENTRY
                    </button>
                    <button
                      onClick={exportDonations}
                      disabled={isExporting}
                      className="btn-pill-secondary py-2 px-4 text-[9px] tracking-widest"
                    >
                      {isExporting ? 'EXPORTING…' : 'EXPORT CSV'}
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 border-b border-[#c89b3c]/15 pb-4 mb-4 text-xs font-bold">
                  {(['All', 'Unreconciled', 'Reconciled'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setReconciliationFilter(f)}
                      className={`px-3 py-1.5 rounded-[6px] transition-colors uppercase tracking-wider ${
                        reconciliationFilter === f
                          ? 'bg-[#0d4734] text-white font-black'
                          : 'bg-[#f6f3eb] text-[#1c2421] hover:bg-[#e4efe9]'
                      }`}
                    >
                      {f} (
                      {f === 'All'
                        ? donations.length
                        : donations.filter((d) => d.reconciliation_status === f).length}
                      )
                    </button>
                  ))}
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                        <th className="py-3 px-2">Receipt</th>
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Category</th>
                        <th className="py-3 px-2">Method</th>
                        <th className="py-3 px-2">Amount</th>
                        <th className="py-3 px-2">Status</th>
                        <th className="py-3 px-2 text-right">Reconciliation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDonations.map((d) => (
                        <tr key={d.donation_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
                          <td className="py-3 px-2 font-mono font-bold text-xs text-[#0d4734]">{d.receipt_number}</td>
                          <td className="py-3 px-2 text-[#1c2421]/60 font-mono text-[10px]">
                            {new Date(d.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded bg-[#f6f3eb] text-[10px] font-black uppercase text-[#0d4734]">
                              {d.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 font-mono text-[10px] uppercase">{d.method}</td>
                          <td className="py-3 px-2 font-black text-[#0d4734]">
                            {d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                d.reconciliation_status === 'Reconciled'
                                  ? 'bg-[#e4efe9] text-[#0d4734]'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {d.reconciliation_status}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            {d.reconciliation_status !== 'Reconciled' ? (
                              <button
                                onClick={() => reconcileDonation(d.donation_id)}
                                disabled={reconcilingId === d.donation_id}
                                className="btn-pill-cta py-1 px-3 text-[8px] tracking-widest"
                              >
                                {reconcilingId === d.donation_id ? 'RECONCILING…' : 'RECONCILE'}
                              </button>
                            ) : (
                              <span className="text-[10px] text-[#0d4734] font-black uppercase">✓ VERIFIED</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredDonations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs font-mono uppercase text-[#1c2421]/50">
                            No donations matching filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Offline Cash Entry Modal */}
              {showCashModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white rounded-[16px] border-2 border-[#c89b3c]/40 p-8 max-w-md w-full shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b border-[#c89b3c]/20 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                          MANUAL CASH DESK
                        </span>
                        <h3 className="text-xl font-black uppercase tracking-tight text-[#0d4734]">
                          Record Cash Donation
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowCashModal(false)}
                        className="text-xs font-black uppercase tracking-widest text-[#1c2421]/50 hover:text-[#1c2421]"
                      >
                        [CLOSE ×]
                      </button>
                    </div>
                    <form onSubmit={handleRecordCash} className="space-y-4">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                          Amount ({cashForm.currency}) *
                        </label>
                        <input
                          className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={cashForm.amount}
                          onChange={(e) => setCashForm({ ...cashForm, amount: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                          Category *
                        </label>
                        <select
                          className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                          value={cashForm.category}
                          onChange={(e) =>
                            setCashForm({
                              ...cashForm,
                              category: e.target.value as 'Zakat' | 'Sadaqah' | 'Waqf' | 'General'
                            })
                          }
                        >
                          <option value="Sadaqah">Sadaqah (Voluntary Charity)</option>
                          <option value="Zakat">Zakat (Alms)</option>
                          <option value="Waqf">Waqf (Endowment)</option>
                          <option value="General">General Operations</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                          Donor Email (Optional)
                        </label>
                        <input
                          className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                          type="email"
                          placeholder="DONOR@EXAMPLE.COM"
                          value={cashForm.donor_email}
                          onChange={(e) => setCashForm({ ...cashForm, donor_email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                          Envelope Notes / Identifier (Optional)
                        </label>
                        <input
                          className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                          placeholder="E.G. FRIDAY JUMUAH ENVELOPE #42"
                          value={cashForm.notes}
                          onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCashModal(false)}
                          className="btn-pill-secondary py-2 px-4 text-[9px]"
                        >
                          CANCEL
                        </button>
                        <button
                          type="submit"
                          disabled={isSavingCash}
                          className="btn-pill-cta py-2 px-5 text-[9px] tracking-widest"
                        >
                          {isSavingCash ? 'RECORDING…' : 'SAVE CASH DONATION'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: PEOPLE & ROLES */}
          {tab === 'members' && (
            <div className="space-y-6">
              <form onSubmit={inviteMember} className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-4">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  ACCESS & ROLES
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  Assign Member Role
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    placeholder="FULL NAME"
                    value={invite.name}
                    onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                    required
                  />
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    type="email"
                    placeholder="EMAIL"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    required
                  />
                  <select
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    value={invite.role}
                    onChange={(e) => setInvite({ ...invite, role: e.target.value })}
                  >
                    <option value="member">Member</option>
                    <option value="finance_officer">Finance Officer</option>
                    <option value="programme_officer">Programme Officer</option>
                    <option value="communications_officer">Communications Officer</option>
                    <option value="tenant_admin">Tenant Administrator</option>
                  </select>
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    type="password"
                    minLength={8}
                    placeholder="TEMPORARY PASSWORD (MIN 8 CHARS)"
                    value={invite.temporary_password}
                    onChange={(e) => setInvite({ ...invite, temporary_password: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-pill-cta py-3 px-6 text-[9px] tracking-ultra-wide">
                  ASSIGN PERMISSIONS →
                </button>
              </form>

              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <h2 className="text-xl font-black uppercase tracking-tight text-[#0d4734] mb-4">
                  Active Mosque Roster
                </h2>
                {members.map((m) => (
                  <div key={m.membership_id} className="flex justify-between items-center py-3.5 border-b border-[#c89b3c]/15 text-xs">
                    <div>
                      <strong className="font-bold text-[#0d4734]">{m.user?.name || 'Member'}</strong>
                      <small className="block font-mono text-[10px] text-[#1c2421]/50">{m.user?.email}</small>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-[#f6f3eb] text-[#0d4734] border border-[#c89b3c]/20">
                      {m.role.replaceAll('_', ' ')} · {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: AUDIT LOGS */}
          {tab === 'audit' && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-[#c89b3c]/20 pb-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                      SECURITY & COMPLIANCE
                    </span>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                      Tenant Audit Trail
                    </h2>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-[#0d4734] bg-[#e4efe9] px-3 py-1 rounded-full">
                    {filteredAuditEvents.length} EVENTS LOGGED
                  </span>
                </div>

                {/* Search & Filter */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="sm:col-span-2">
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      placeholder="SEARCH ACTION, SUMMARY, ACTOR, IP..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={auditCategoryFilter}
                      onChange={(e) => setAuditCategoryFilter(e.target.value)}
                    >
                      <option value="All">All Actions</option>
                      <option value="Program">Programmes</option>
                      <option value="Donation">Donations & Treasury</option>
                      <option value="Attendance">Attendance</option>
                      <option value="Membership">Memberships</option>
                      <option value="Announcement">Announcements</option>
                    </select>
                  </div>
                </div>

                {/* Audit Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#c89b3c]/20 text-[#1c2421]/50 uppercase text-[9px] font-black tracking-widest">
                        <th className="py-2.5 px-2">Timestamp</th>
                        <th className="py-2.5 px-2">Actor</th>
                        <th className="py-2.5 px-2">Action</th>
                        <th className="py-2.5 px-2">Target</th>
                        <th className="py-2.5 px-2">Summary</th>
                        <th className="py-2.5 px-2 font-mono">IP / Request ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditEvents.map((ev) => (
                        <tr key={ev.audit_id} className="border-b border-[#c89b3c]/10 hover:bg-[#f6f3eb]/40">
                          <td className="py-2.5 px-2 text-[#1c2421]/60 font-mono text-[10px] whitespace-nowrap">
                            {new Date(ev.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-[#0d4734]">
                            {ev.actor ? (
                              <span>
                                {ev.actor.name}
                                <span className="block font-mono text-[9px] text-[#1c2421]/50 font-normal">
                                  {ev.actor.email}
                                </span>
                              </span>
                            ) : (
                              <span className="text-[#1c2421]/40">System / Anonymous</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                ev.action.includes('created') || ev.action.includes('recorded')
                                  ? 'bg-[#e4efe9] text-[#0d4734]'
                                  : ev.action.includes('reconciled')
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-blue-100 text-blue-900'
                              }`}
                            >
                              {ev.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-mono text-[10px] text-[#1c2421]/70">
                            {ev.target_type} {ev.target_id ? `#${ev.target_id}` : ''}
                          </td>
                          <td className="py-2.5 px-2 text-[#1c2421]/80 max-w-xs">{ev.summary}</td>
                          <td className="py-2.5 px-2 font-mono text-[9px] text-[#1c2421]/50">
                            <div>{ev.ip_address || '—'}</div>
                            <div className="truncate max-w-[120px]">{ev.request_id || ''}</div>
                          </td>
                        </tr>
                      ))}
                      {filteredAuditEvents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs font-mono uppercase text-[#1c2421]/50">
                            No audit events found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: MOSQUE SETTINGS & PRAYER SCHEDULE */}
          {tab === 'settings' && mosque && (
            <div className="space-y-8">
              {/* Prayer Schedule Manager */}
              <form onSubmit={saveSettings} className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-6">
                <div className="border-b border-[#c89b3c]/20 pb-4">
                  <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block mb-1">
                    PRAYER SCHEDULE & IQAMAH TIMINGS
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                    Daily Prayer & Jumu&apos;ah Timetable
                  </h2>
                  <p className="text-xs text-[#1c2421]/70 mt-1 font-normal">
                    Update congregational (Iqamah) timings displayed on your public portal and attendee passes.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Fajr Iqamah
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.fajr_time || '05:15 AM'}
                      onChange={(e) => setMosque({ ...mosque, fajr_time: e.target.value })}
                      placeholder="05:15 AM"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Dhuhr Iqamah
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.dhuhr_time || '01:00 PM'}
                      onChange={(e) => setMosque({ ...mosque, dhuhr_time: e.target.value })}
                      placeholder="01:00 PM"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Asr Iqamah
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.asr_time || '04:30 PM'}
                      onChange={(e) => setMosque({ ...mosque, asr_time: e.target.value })}
                      placeholder="04:30 PM"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Maghrib
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.maghrib_time || '07:15 PM'}
                      onChange={(e) => setMosque({ ...mosque, maghrib_time: e.target.value })}
                      placeholder="07:15 PM"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Isha Iqamah
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.isha_time || '08:30 PM'}
                      onChange={(e) => setMosque({ ...mosque, isha_time: e.target.value })}
                      placeholder="08:30 PM"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#0d4734] block mb-1">
                      Jumu&apos;ah Salah
                    </label>
                    <input
                      className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                      value={mosque.jumua_time || '01:30 PM'}
                      onChange={(e) => setMosque({ ...mosque, jumua_time: e.target.value })}
                      placeholder="01:30 PM"
                    />
                  </div>
                </div>

                <button type="submit" className="btn-pill-cta py-3 px-8 text-[9px] tracking-ultra-wide">
                  SAVE PRAYER SCHEDULE →
                </button>
              </form>

              {/* General Mosque Settings */}
              <form onSubmit={saveSettings} className="bg-white p-8 rounded-[16px] border-2 border-[#c89b3c]/25 shadow-xs space-y-4">
                <span className="text-[10px] font-black uppercase tracking-ultra-wide text-[#c89b3c] block">
                  CONFIGURATION & BRAND
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-[#0d4734]">
                  Mosque Profile & Contact
                </h2>
                <input
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  value={mosque.name}
                  onChange={(e) => setMosque({ ...mosque, name: e.target.value })}
                  placeholder="MOSQUE NAME"
                  required
                />
                <input
                  className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                  value={mosque.address || ''}
                  onChange={(e) => setMosque({ ...mosque, address: e.target.value })}
                  placeholder="PHYSICAL ADDRESS"
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    value={mosque.email || ''}
                    onChange={(e) => setMosque({ ...mosque, email: e.target.value })}
                    placeholder="CONTACT EMAIL"
                  />
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    value={mosque.phone || ''}
                    onChange={(e) => setMosque({ ...mosque, phone: e.target.value })}
                    placeholder="PHONE"
                  />
                  <input
                    className="w-full bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] py-2.5 px-3 text-xs font-bold uppercase text-[#1c2421] focus:outline-none focus:border-[#0d4734]"
                    value={mosque.timezone}
                    onChange={(e) => setMosque({ ...mosque, timezone: e.target.value })}
                    placeholder="TIMEZONE (E.G. AFRICA/LAGOS)"
                  />
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/60 block mb-1">
                      Brand Color Indicator
                    </label>
                    <input
                      className="w-full h-10 p-1 bg-[#f6f3eb] border border-[#c89b3c]/30 rounded-[6px] cursor-pointer"
                      type="color"
                      value={mosque.brand_color || '#0d4734'}
                      onChange={(e) => setMosque({ ...mosque, brand_color: e.target.value })}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-pill-cta py-3 px-6 text-[9px] tracking-ultra-wide">
                  SAVE MOSQUE PROFILE →
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-[#c89b3c]/20 bg-[#f6f3eb] text-center text-[9px] font-black uppercase tracking-ultra-wide text-[#1c2421]/40">
        &copy; {new Date().getFullYear()} MASJIDHUB PLATFORM. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
