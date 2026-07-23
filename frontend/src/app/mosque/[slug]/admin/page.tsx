'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Announcement {
  id: number;
  title: string;
  content: string;
  category: 'General' | 'Event' | 'Prayer' | 'Urgent';
  posted_at: string;
}

export default function AdminDashboard() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : 'al-noor';

  // State Management
  const [activeTab, setActiveTab] = useState<'announcements' | 'settings'>('announcements');

  // Mosque Settings State
  const [name, setName] = useState('Al-Noor Central Masjid');
  const [address, setAddress] = useState('123 Islamic Center Ave, Cityville');
  const [phone, setPhone] = useState('+2348031234567');
  const [email, setEmail] = useState('contact@alnoormasjid.org');
  const [settingsStatus, setSettingsStatus] = useState('');

  // Announcements State
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: 1,
      title: 'Summer Quran Program Registration Open',
      content: 'Classes start next month. Register under the programs tab.',
      category: 'Event',
      posted_at: '2026-07-16'
    },
    {
      id: 2,
      title: 'Friday Khutbah Time Adjustment',
      content: 'The first Jumuah sermon will commence at 1:15 PM.',
      category: 'Urgent',
      posted_at: '2026-07-15'
    }
  ]);

  // Form State for New Announcement
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<'General' | 'Event' | 'Prayer' | 'Urgent'>('General');
  const [announcementStatus, setAnnouncementStatus] = useState('');

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus('Mosque profile details updated successfully!');
    setTimeout(() => setSettingsStatus(''), 3000);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newContent) return;

    const created: Announcement = {
      id: Date.now(),
      title: newTitle,
      content: newContent,
      category: newCategory,
      posted_at: new Date().toISOString().split('T')[0]
    };

    setAnnouncements([created, ...announcements]);
    setNewTitle('');
    setNewContent('');
    setNewCategory('General');
    setAnnouncementStatus('Announcement posted successfully!');
    setTimeout(() => setAnnouncementStatus(''), 3000);
  };

  const handleDeleteAnnouncement = (id: number) => {
    setAnnouncements(announcements.filter((ann) => ann.id !== id));
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="masjid-gradient-bg text-white py-4 px-6 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Admin Control Panel</h1>
          <p className="text-xs text-emerald-200">Tenant: /mosque/{slug}</p>
        </div>
        <Link href={`/mosque/${slug}`} className="btn-secondary text-xs border-emerald-400 text-emerald-100 hover:bg-emerald-800">
          Exit to Public Portal
        </Link>
      </header>

      {/* Admin Dashboard Area */}
      <div className="max-w-6xl mx-auto px-6 py-8 flex-grow w-full grid md:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <aside className="md:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'announcements'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            📢 Announcements
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-4 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            ⚙️ Mosque Settings
          </button>
        </aside>

        {/* Dynamic Workspace Container */}
        <section className="md:col-span-3">
          
          {/* TAB 1: ANNOUNCEMENTS MANAGEMENT */}
          {activeTab === 'announcements' && (
            <div className="space-y-8 animate-fade-in">
              {/* Creator Form */}
              <div className="card-premium">
                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Publish Announcement</h3>
                {announcementStatus && <p className="mb-4 text-sm font-semibold text-green-500">{announcementStatus}</p>}
                
                <form onSubmit={handleCreateAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Title</label>
                    <input
                      type="text"
                      placeholder="Announcement Title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="input-field"
                    >
                      <option value="General">General</option>
                      <option value="Event">Event</option>
                      <option value="Prayer">Prayer</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Content</label>
                    <textarea
                      placeholder="Write your announcement details here..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      className="input-field min-h-24"
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    Post Announcement
                  </button>
                </form>
              </div>

              {/* Announcement List & Delete Controls */}
              <div className="card-premium">
                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Active Announcements ({announcements.length})</h3>
                <div className="space-y-4">
                  {announcements.map((ann) => (
                    <div key={ann.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded">
                            {ann.category}
                          </span>
                          <span className="text-xs text-slate-400">{ann.posted_at}</span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white">{ann.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{ann.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold px-3 py-1 border border-red-200 hover:border-red-400 rounded transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SETTINGS MANAGEMENT */}
          {activeTab === 'settings' && (
            <div className="card-premium animate-fade-in">
              <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Edit Mosque Details</h3>
              {settingsStatus && <p className="mb-4 text-sm font-semibold text-green-500">{settingsStatus}</p>}

              <form onSubmit={handleUpdateSettings} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Mosque Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Physical Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Contact Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                  />
                </div>

                <button type="submit" className="btn-primary mt-2">
                  Save Changes
                </button>
              </form>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center text-xs text-slate-500">
        <p>&copy; {new Date().getFullYear()} MasjidHub Admin Console.</p>
      </footer>
    </main>
  );
}
