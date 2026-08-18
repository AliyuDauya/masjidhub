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
    { id: 'announcements', label: 'Announcements' },
    { id: 'programs', label: 'Programmes & Roster' },
    { id: 'donations', label: 'Donations & Treasury' },
    { id: 'members', label: 'People & Roles' },
    { id: 'audit', label: 'Audit Logs' },
    { id: 'settings', label: 'Mosque Settings' }
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
    { id: 'announcements', label: 'Announcements' }
  ],
  member: []
};

export default function AdminDashboard() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  const [currentRole, setCurrentRole] = useState<TenantRole>('tenant_admin');
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [members, setMembers] = useState<Membership[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Announcement Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');

  // Member Invite State
  const [invite, setInvite] = useState({ name: '', email: '', role: 'member', temporary_password: '' });

  // Program Form & Roster State
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
  const [selectedRosterProgram, setSelectedRosterProgram] = useState<Program | null>(null);
  const [roster, setRoster] = useState<Attendee[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [isDispatchingReminders, setIsDispatchingReminders] = useState(false);

  // Donations State
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

  // Audit Logs Filter State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('All');

  function done(text: string) {
    setMessage(text);
    setError('');
    setTimeout(() => setMessage(''), 4000);
  }

  async function load() {
    setError('');
    try {
      // 1. Resolve current user identity and membership role
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
        // Fallback default role if auth/me not yet initialized
      }

      if (userRole === 'member') {
        router.push(`/mosque/${slug}`);
        return;
      }
      setCurrentRole(userRole);

      // Validate selected tab against allowed tabs
      const allowed = ROLE_TABS[userRole] || [];
      if (!allowed.some((t) => t.id === tab)) {
        setTab(allowed[0]?.id || 'overview');
      }

      // 2. Fetch tenant profile
      const m = await api<Mosque>(null, `/api/mosques/${slug}`);
      setMosque(m);

      // 3. Load role-appropriate collections
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

  // ---------------------------------------------------------------------------
  // Announcements Handlers
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Member Management Handlers
  // ---------------------------------------------------------------------------
  async function inviteMember(e: FormEvent) {
    e.preventDefault();
    try {
      await api(slug, '/api/admin/memberships/invite', {
        method: 'POST',
        body: JSON.stringify(invite)
      });
      setInvite({ name: '', email: '', role: 'member', temporary_password: '' });
      done(`Member ${invite.name} added with role ${invite.role.replaceAll('_', ' ')}.`);
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not add member.');
    }
  }

  // ---------------------------------------------------------------------------
  // Settings Handler
  // ---------------------------------------------------------------------------
  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!mosque) return;
    try {
      const updated = await api<Mosque>(slug, `/api/mosques/${slug}`, {
        method: 'PUT',
        body: JSON.stringify(mosque)
      });
      setMosque(updated);
      done('Mosque settings saved successfully.');
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not save settings.');
    }
  }

  // ---------------------------------------------------------------------------
  // Program Management & Attendance Handlers
  // ---------------------------------------------------------------------------
  async function saveProgram(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        title: programForm.title,
        description: programForm.description,
        category: programForm.category,
        start_date: new Date(programForm.start_date).toISOString(),
        end_date: new Date(programForm.end_date).toISOString(),
        location: programForm.location,
        max_capacity: Number(programForm.max_capacity) || 0,
        visibility: programForm.visibility,
        status: programForm.status
      };

      if (editingProgramId) {
        await api(slug, `/api/admin/programs/${editingProgramId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        done('Programme updated successfully.');
      } else {
        await api(slug, '/api/admin/programs', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        done('Programme scheduled successfully.');
      }

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
      setEditingProgramId(null);
      load();
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not save programme.');
    }
  }

  function editProgram(prog: Program) {
    setEditingProgramId(prog.program_id);
    const startStr = prog.start_date ? new Date(prog.start_date).toISOString().slice(0, 16) : '';
    const endStr = prog.end_date ? new Date(prog.end_date).toISOString().slice(0, 16) : '';
    setProgramForm({
      title: prog.title,
      description: prog.description,
      category: prog.category || 'Education',
      start_date: startStr,
      end_date: endStr,
      location: prog.location,
      max_capacity: prog.max_capacity,
      visibility: prog.visibility,
      status: prog.status
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // ---------------------------------------------------------------------------
  // Donations Handlers
  // ---------------------------------------------------------------------------
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

  // Filtered Donations
  const filteredDonations = donations.filter((d) => {
    if (reconciliationFilter === 'All') return true;
    return d.reconciliation_status === reconciliationFilter;
  });

  // Filtered Audit Events
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
    <main
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{ '--tenant-color': mosque?.brand_color || '#087f5b' } as React.CSSProperties}
    >
      {/* Header Band */}
      <header className="tenant-band px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b bg-white shadow-xs">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="eyebrow uppercase text-xs font-semibold text-emerald-800">
              Workspace / {slug}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold uppercase">
              {currentRole.replaceAll('_', ' ')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {mosque?.name || 'Mosque Administration'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Notification Center */}
          <NotificationCenter slug={slug} />

          <Link href={`/mosque/${slug}/admin/analytics`} className="btn-secondary text-sm">
            Reports & Analytics
          </Link>
          <button
            className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              clearToken(slug);
              router.push(`/mosque/${slug}`);
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="max-w-7xl mx-auto px-6 py-10 grid md:grid-cols-[240px_1fr] gap-8">
        {/* Navigation Sidebar */}
        <nav className="space-y-1.5">
          {navItems.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-between ${
                tab === id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{label}</span>
              {id === 'donations' && donations.filter((d) => d.reconciliation_status === 'Unreconciled').length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    tab === id ? 'bg-white text-emerald-800' : 'bg-amber-100 text-amber-800'
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
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
              {error}
            </div>
          )}
          {message && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
              {message}
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB: OVERVIEW */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="card-premium bg-linear-to-r from-emerald-800 to-teal-900 text-white p-8 rounded-2xl">
                <p className="eyebrow text-emerald-200">Sovereign Mosque Operations</p>
                <h2 className="text-3xl font-bold mt-1">Welcome back{currentUser?.name ? `, ${currentUser.name}` : ''}</h2>
                <p className="text-emerald-100 text-sm mt-2 max-w-2xl">
                  You are logged into {mosque?.name || 'the mosque'} as{' '}
                  <strong className="text-white underline">{currentRole.replaceAll('_', ' ')}</strong>. Manage
                  timetables, attendees, donations, and notifications directly from your workspace.
                </p>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-premium p-6">
                  <p className="text-xs uppercase font-bold text-slate-500">Programmes</p>
                  <p className="text-3xl font-bold mt-2">{programs.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Active scheduled learning</p>
                </div>
                <div className="card-premium p-6">
                  <p className="text-xs uppercase font-bold text-slate-500">Donations</p>
                  <p className="text-3xl font-bold mt-2">{donations.length}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {donations.filter((d) => d.reconciliation_status === 'Reconciled').length} reconciled
                  </p>
                </div>
                <div className="card-premium p-6">
                  <p className="text-xs uppercase font-bold text-slate-500">Notices</p>
                  <p className="text-3xl font-bold mt-2">{announcements.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Published community notices</p>
                </div>
                <div className="card-premium p-6">
                  <p className="text-xs uppercase font-bold text-slate-500">Members</p>
                  <p className="text-3xl font-bold mt-2">{members.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Registered worshippers & staff</p>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB: ANNOUNCEMENTS */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'announcements' && (
            <div className="space-y-6">
              <form onSubmit={publishAnnouncement} className="card-premium space-y-4">
                <p className="eyebrow">Public communication</p>
                <h2 className="text-2xl font-bold">Publish an announcement</h2>
                <input
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement title"
                  required
                />
                <select
                  className="input-field"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="General">General Notice</option>
                  <option value="Event">Community Event</option>
                  <option value="Prayer">Prayer Timetable Update</option>
                  <option value="Urgent">Urgent Alert</option>
                </select>
                <textarea
                  className="input-field min-h-28"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What should the community know?"
                  required
                />
                <button type="submit" className="btn-primary">
                  Publish announcement
                </button>
              </form>

              <div className="card-premium">
                <h2 className="text-xl font-bold mb-4">Published noticeboard</h2>
                {announcements.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4">No published announcements yet.</p>
                ) : (
                  <div className="space-y-4 divide-y divide-slate-100">
                    {announcements.map((a) => (
                      <article key={a.announcement_id} className="pt-4 first:pt-0">
                        <div className="flex items-center space-x-2">
                          <span className="eyebrow text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {a.category}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(a.posted_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold mt-1">{a.title}</h3>
                        <p className="text-slate-600 text-sm mt-1 leading-relaxed">{a.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB: PROGRAMMES & ROSTER */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'programs' && (
            <div className="space-y-6">
              {/* Program Schedule / Edit Form */}
              <form onSubmit={saveProgram} className="card-premium space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="eyebrow">Learning & Community</p>
                    <h2 className="text-2xl font-bold">
                      {editingProgramId ? 'Edit Programme' : 'Schedule a New Programme'}
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
                      className="btn-secondary text-xs"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Programme Title *
                    </label>
                    <input
                      className="input-field"
                      placeholder="e.g. Weekend Tajweed Intensive"
                      value={programForm.title}
                      onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Category *
                    </label>
                    <select
                      className="input-field"
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
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Location / Hall *
                    </label>
                    <input
                      className="input-field"
                      placeholder="e.g. Main Prayer Hall / Classroom 2"
                      value={programForm.location}
                      onChange={(e) => setProgramForm({ ...programForm, location: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Start Date & Time *
                    </label>
                    <input
                      className="input-field"
                      type="datetime-local"
                      value={programForm.start_date}
                      onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      End Date & Time *
                    </label>
                    <input
                      className="input-field"
                      type="datetime-local"
                      value={programForm.end_date}
                      onChange={(e) => setProgramForm({ ...programForm, end_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Seat Capacity limit (0 for unlimited)
                    </label>
                    <input
                      className="input-field"
                      type="number"
                      min={0}
                      value={programForm.max_capacity}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, max_capacity: parseInt(e.target.value, 10) || 0 })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Visibility & Access
                    </label>
                    <select
                      className="input-field"
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
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Programme Description *
                  </label>
                  <textarea
                    className="input-field min-h-24"
                    placeholder="Provide overview, instructor, curriculum, requirements..."
                    value={programForm.description}
                    onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary">
                  {editingProgramId ? 'Update Programme' : 'Schedule Programme'}
                </button>
              </form>

              {/* Programmes List */}
              <div className="card-premium">
                <h2 className="text-xl font-bold mb-4">Active & Scheduled Programmes</h2>
                {programs.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4">No programmes scheduled.</p>
                ) : (
                  <div className="space-y-4">
                    {programs.map((p) => (
                      <div
                        key={p.program_id}
                        className="p-4 border rounded-xl hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                              {p.category}
                            </span>
                            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded">
                              {p.visibility}
                            </span>
                            <span className="text-xs text-slate-500">
                              {p.max_capacity > 0 ? `Cap: ${p.max_capacity} seats` : 'Open / Unlimited capacity'}
                            </span>
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">{p.title}</h3>
                          <p className="text-xs text-slate-600">
                            📍 {p.location} · 🗓️ {new Date(p.start_date).toLocaleDateString()} at{' '}
                            {new Date(p.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => openRoster(p)}
                            className="btn-primary text-xs px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800"
                          >
                            View Roster & Check-In
                          </button>
                          <button
                            onClick={() => editProgram(p)}
                            className="btn-secondary text-xs px-3 py-1.5"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteProgram(p.program_id)}
                            className="btn-secondary text-xs px-3 py-1.5 text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Attendee Roster Modal */}
              {selectedRosterProgram && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl space-y-5">
                    <div className="flex justify-between items-start border-b pb-4">
                      <div>
                        <span className="eyebrow text-emerald-800">Programme Roster & Check-In</span>
                        <h3 className="text-2xl font-bold">{selectedRosterProgram.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          📍 {selectedRosterProgram.location} · {roster.length} registered attendee(s)
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedRosterProgram(null)}
                        className="text-slate-400 hover:text-slate-600 text-lg"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                      <div className="text-xs text-slate-600">
                        <strong>Check-In Progress:</strong> {roster.filter((r) => r.status === 'Attended').length} /{' '}
                        {roster.length} checked in
                      </div>
                      <button
                        onClick={() => dispatchReminders(selectedRosterProgram.program_id)}
                        disabled={isDispatchingReminders}
                        className="btn-secondary text-xs"
                      >
                        {isDispatchingReminders ? 'Broadcasting...' : '📢 Broadcast Reminders'}
                      </button>
                    </div>

                    {loadingRoster ? (
                      <p className="text-center text-xs text-slate-400 py-8">Loading attendee roster...</p>
                    ) : roster.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 py-8">No members registered yet.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b text-slate-500 font-semibold">
                              <th className="py-2.5 px-2">Attendee</th>
                              <th className="py-2.5 px-2">Contact</th>
                              <th className="py-2.5 px-2">Reg Date</th>
                              <th className="py-2.5 px-2">Status</th>
                              <th className="py-2.5 px-2 text-right">Door Check-In</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roster.map((r) => (
                              <tr key={r.reg_id} className="border-b hover:bg-slate-50/50">
                                <td className="py-2.5 px-2 font-bold">{r.user?.name || 'Member'}</td>
                                <td className="py-2.5 px-2 text-slate-500">{r.user?.email}</td>
                                <td className="py-2.5 px-2 text-slate-500">
                                  {new Date(r.reg_date).toLocaleDateString()}
                                </td>
                                <td className="py-2.5 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      r.status === 'Attended'
                                        ? 'bg-emerald-100 text-emerald-800'
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
                                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                      r.status === 'Attended'
                                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                        : 'bg-emerald-700 text-white hover:bg-emerald-800'
                                    }`}
                                  >
                                    {r.status === 'Attended' ? 'Undo Check-In' : '✓ Check In'}
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

          {/* ----------------------------------------------------------------- */}
          {/* TAB: DONATIONS & TREASURY */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'donations' && (
            <div className="space-y-6">
              <div className="card-premium">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <p className="eyebrow">Financial records & treasury</p>
                    <h2 className="text-2xl font-bold">Donation Ledger</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowCashModal(true)} className="btn-primary text-sm">
                      + Record Cash Donation
                    </button>
                    <button
                      onClick={exportDonations}
                      disabled={isExporting}
                      className="btn-secondary text-sm"
                    >
                      {isExporting ? 'Exporting...' : 'Export CSV'}
                    </button>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 border-b pb-4 mb-4 text-sm">
                  {(['All', 'Unreconciled', 'Reconciled'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setReconciliationFilter(f)}
                      className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        reconciliationFilter === f
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-slate-500 font-semibold text-xs uppercase">
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
                        <tr key={d.donation_id} className="border-b hover:bg-slate-50/50">
                          <td className="py-3 px-2 font-mono font-bold text-xs">{d.receipt_number}</td>
                          <td className="py-3 px-2 text-slate-500 text-xs">
                            {new Date(d.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold">
                              {d.category}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-xs">{d.method}</td>
                          <td className="py-3 px-2 font-semibold">
                            {d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                d.reconciliation_status === 'Reconciled'
                                  ? 'bg-emerald-100 text-emerald-800'
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
                                className="btn-secondary text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                              >
                                {reconcilingId === d.donation_id ? 'Reconciling...' : 'Reconcile'}
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-700 font-bold">✓ Verified</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredDonations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 text-sm">
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                    <div className="flex justify-between items-center border-b pb-3">
                      <h3 className="text-xl font-bold">Record Cash Donation</h3>
                      <button
                        onClick={() => setShowCashModal(false)}
                        className="text-slate-400 hover:text-slate-600 text-lg"
                      >
                        ✕
                      </button>
                    </div>
                    <form onSubmit={handleRecordCash} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                          Amount ({cashForm.currency}) *
                        </label>
                        <input
                          className="input-field"
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
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                          Category *
                        </label>
                        <select
                          className="input-field"
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
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                          Donor Email (optional)
                        </label>
                        <input
                          className="input-field"
                          type="email"
                          placeholder="donor@example.com"
                          value={cashForm.donor_email}
                          onChange={(e) => setCashForm({ ...cashForm, donor_email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                          Reference / Envelope Notes (optional)
                        </label>
                        <input
                          className="input-field"
                          placeholder="e.g. Friday Jumuah Envelope #42"
                          value={cashForm.notes}
                          onChange={(e) => setCashForm({ ...cashForm, notes: e.target.value })}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowCashModal(false)}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={isSavingCash} className="btn-primary text-sm">
                          {isSavingCash ? 'Recording...' : 'Save Cash Donation'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB: PEOPLE & ROLES */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'members' && (
            <div className="space-y-6">
              <form onSubmit={inviteMember} className="card-premium space-y-4">
                <p className="eyebrow">Access control</p>
                <h2 className="text-2xl font-bold">Add / Invite a person</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    className="input-field"
                    placeholder="Full name"
                    value={invite.name}
                    onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                    required
                  />
                  <input
                    className="input-field"
                    type="email"
                    placeholder="Email"
                    value={invite.email}
                    onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    required
                  />
                  <select
                    className="input-field"
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
                    className="input-field"
                    type="password"
                    minLength={8}
                    placeholder="Temporary password"
                    value={invite.temporary_password}
                    onChange={(e) => setInvite({ ...invite, temporary_password: e.target.value })}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Add person
                </button>
              </form>

              <div className="card-premium">
                <h2 className="text-xl font-bold mb-4">People with Mosque Access</h2>
                {members.map((m) => (
                  <div key={m.membership_id} className="flex justify-between items-center py-3 border-b text-sm">
                    <span>
                      <strong>{m.user?.name || 'Member'}</strong>
                      <small className="block text-slate-500">{m.user?.email}</small>
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded bg-slate-100 font-semibold">
                      {m.role.replaceAll('_', ' ')} · {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* TAB: AUDIT LOGS (tenant_admin only) */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'audit' && (
            <div className="space-y-6">
              <div className="card-premium">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <p className="eyebrow">Compliance & Security Trail</p>
                    <h2 className="text-2xl font-bold">Tenant Audit Logs</h2>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-semibold">
                    {filteredAuditEvents.length} events logged
                  </span>
                </div>

                {/* Search & Category Filter Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="sm:col-span-2">
                    <input
                      className="input-field text-sm"
                      placeholder="Search action, summary, actor, target, IP, request ID..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                    />
                  </div>
                  <div>
                    <select
                      className="input-field text-sm"
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

                {/* Audit Trail Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-500 font-semibold uppercase">
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
                        <tr key={ev.audit_id} className="border-b hover:bg-slate-50/50">
                          <td className="py-2.5 px-2 text-slate-500 whitespace-nowrap">
                            {new Date(ev.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="py-2.5 px-2 font-semibold">
                            {ev.actor ? (
                              <span>
                                {ev.actor.name}
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  {ev.actor.email}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">System / Anonymous</span>
                            )}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ev.action.includes('created') || ev.action.includes('recorded')
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ev.action.includes('reconciled')
                                  ? 'bg-teal-100 text-teal-800'
                                  : ev.action.includes('deleted') || ev.action.includes('cancelled')
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {ev.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-700">
                            {ev.target_type} {ev.target_id ? `#${ev.target_id}` : ''}
                          </td>
                          <td className="py-2.5 px-2 text-slate-600 max-w-xs">{ev.summary}</td>
                          <td className="py-2.5 px-2 font-mono text-[10px] text-slate-400">
                            <div>{ev.ip_address || '—'}</div>
                            <div className="truncate max-w-[120px]">{ev.request_id || ''}</div>
                          </td>
                        </tr>
                      ))}
                      {filteredAuditEvents.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
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

          {/* ----------------------------------------------------------------- */}
          {/* TAB: MOSQUE SETTINGS */}
          {/* ----------------------------------------------------------------- */}
          {tab === 'settings' && mosque && (
            <form onSubmit={saveSettings} className="card-premium space-y-4">
              <p className="eyebrow">Tenant identity</p>
              <h2 className="text-2xl font-bold">Mosque Settings</h2>
              <input
                className="input-field"
                value={mosque.name}
                onChange={(e) => setMosque({ ...mosque, name: e.target.value })}
                placeholder="Mosque Name"
                required
              />
              <input
                className="input-field"
                value={mosque.address || ''}
                onChange={(e) => setMosque({ ...mosque, address: e.target.value })}
                placeholder="Physical Address"
              />
              <div className="grid sm:grid-cols-2 gap-4">
                <input
                  className="input-field"
                  value={mosque.email || ''}
                  onChange={(e) => setMosque({ ...mosque, email: e.target.value })}
                  placeholder="Contact email"
                />
                <input
                  className="input-field"
                  value={mosque.phone || ''}
                  onChange={(e) => setMosque({ ...mosque, phone: e.target.value })}
                  placeholder="Phone"
                />
                <input
                  className="input-field"
                  value={mosque.timezone}
                  onChange={(e) => setMosque({ ...mosque, timezone: e.target.value })}
                  placeholder="Timezone (e.g. UTC, Africa/Lagos)"
                />
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Brand Color Theme
                  </label>
                  <input
                    className="input-field h-10 p-1"
                    type="color"
                    value={mosque.brand_color || '#087f5b'}
                    onChange={(e) => setMosque({ ...mosque, brand_color: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary">
                Save settings
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
