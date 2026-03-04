/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Settings as SettingsIcon, 
  LogOut, 
  Menu, 
  X,
  FileText,
  CreditCard,
  Languages,
  Printer,
  Download,
  Search,
  Plus,
  Calculator,
  ChevronRight,
  IndianRupee,
  Trash2,
  Share2,
  Edit2,
  StickyNote,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './supabase';
import { TRANSLATIONS } from './constants';
import { BIBLE_VERSES } from './bible_verses';
import { User, Language, Settings, Member, Transaction, Subscription, Note, TopContributor } from './types';

// Contexts
const AuthContext = createContext<{
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
}>({ user: null, login: () => {}, logout: () => {} });

const LanguageContext = createContext<{
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
}>({ lang: 'en', setLang: () => {}, t: (k) => k });

const SettingsContext = createContext<Settings | null>(null);

// Helper for robust JSON fetching
const safeFetch = async (url: string, options?: RequestInit) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorMsg = `Server error: ${res.status}`;
    try {
      const data = await res.json();
      errorMsg = data.message || errorMsg;
    } catch (e) {
      // Not JSON, use status text
    }
    throw new Error(errorMsg);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  console.error(`Non-JSON response from ${url}:`, text.slice(0, 200));
  throw new Error(`Expected JSON from ${url} but received ${contentType}`);
};

// Components
const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { t } = useContext(LanguageContext);
  const { user, logout } = useContext(AuthContext);
  const settings = useContext(SettingsContext);
  
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'members', icon: Users, label: t('members') },
    { id: 'income', icon: ArrowUpCircle, label: t('income') },
    { id: 'expenses', icon: ArrowDownCircle, label: t('expenses') },
    { id: 'subscriptions', icon: CreditCard, label: t('subscriptions') },
    { id: 'notepad', icon: StickyNote, label: t('notepad') },
    { id: 'income_analysis', icon: TrendingUp, label: t('income_analysis') },
    { id: 'cash_counter', icon: Calculator, label: t('cash_counter') },
    { id: 'reports', icon: FileText, label: t('reports') },
    { id: 'settings', icon: SettingsIcon, label: t('settings') },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-lg font-bold text-emerald-400 leading-tight">
          {settings?.church_name || 'CSI CMS'}
        </h1>
        <p className="text-xs text-slate-400 mt-1">{user?.name} ({user?.role})</p>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === item.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={logout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">{t('logout')}</span>
        </button>
      </div>
    </div>
  );
};

const Header = ({ title }: { title: string }) => {
  const { lang, setLang } = useContext(LanguageContext);
  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-64 z-10 flex items-center justify-between px-8">
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium"
        >
          <Languages size={16} />
          <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
        </button>
      </div>
    </header>
  );
};

// Pages
const Dashboard = () => {
  const { t } = useContext(LanguageContext);
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await safeFetch('/api/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchRecent = async () => {
      try {
        const data = await safeFetch('/api/transactions');
        setRecent(data.slice(0, 5));
      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
    fetchRecent();
  }, []);

  if (!stats) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('total_income')} value={stats.income} icon={ArrowUpCircle} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard title={t('total_expense')} value={stats.expense} icon={ArrowDownCircle} color="text-red-600" bg="bg-red-50" />
        <StatCard title={t('balance')} value={stats.balance} icon={IndianRupee} color="text-blue-600" bg="bg-blue-50" />
        <StatCard title={t('active_members')} value={stats.membersCount} icon={Users} color="text-amber-600" bg="bg-amber-50" isCurrency={false} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">{t('recent_transactions')}</h3>
          <button className="text-emerald-600 text-sm font-medium hover:underline">{t('reports')}</button>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('date')}</th>
              <th className="px-6 py-3 font-semibold">{t('category')}</th>
              <th className="px-6 py-3 font-semibold">{t('name')} / {t('vendor')}</th>
              <th className="px-6 py-3 font-semibold">{t('amount')}</th>
              <th className="px-6 py-3 font-semibold">{t('payment_mode')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recent.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.member_name || tx.vendor_name || '-'}</td>
                <td className={`px-6 py-4 text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg, isCurrency = true }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-sm">
    <div className={`${bg} ${color} p-3 rounded-xl`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className={`text-2xl font-bold text-slate-900`}>
        {isCurrency ? `₹${value.toLocaleString()}` : value}
      </p>
    </div>
  </div>
);

const MembersPage = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [members, setMembers] = useState<Member[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [search, setSearch] = useState('');

  const fetchMembers = async () => {
    try {
      const data = await safeFetch('/api/members');
      setMembers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.member_code.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrintList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = filtered.map(m => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.member_code}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.phone}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.membership_type}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.joined_date}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Member List - CSI CMS</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #059669; }
            .meta { text-align: right; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin-bottom: 5px; color: #059669;">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="text-transform: uppercase; letter-spacing: 1px;">Member List</h3>
          </div>
          <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppShareList = () => {
    const summary = filtered.map(m => `${m.member_code}: ${m.name} (${m.phone})`).join('\n');
    const text = encodeURIComponent(`*CSI CMS - Member List Summary*\n\nTotal Members: ${filtered.length}\n\n${summary}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleWhatsAppShareMember = (m: Member) => {
    const text = encodeURIComponent(`*CSI CMS - Member Details*\n\nCode: ${m.member_code}\nName: ${m.name}\nPhone: ${m.phone}\nType: ${m.membership_type}\nJoined: ${m.joined_date}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={t('search')}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={handlePrintList}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
            title="Print List"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleWhatsAppShareList}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
            title="Share List via WhatsApp"
          >
            <Share2 size={20} />
          </button>
        </div>
        <button 
          onClick={() => {
            setEditingMember(null);
            setShowModal(true);
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2 hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          <span>{t('add_member')}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('member_code')}</th>
              <th className="px-6 py-3 font-semibold">{t('name')}</th>
              <th className="px-6 py-3 font-semibold">{t('phone')}</th>
              <th className="px-6 py-3 font-semibold">{t('membership_type')}</th>
              <th className="px-6 py-3 font-semibold">{t('joined_date')}</th>
              <th className="px-6 py-3 font-semibold">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{m.member_code}</td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.tamil_name}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{m.phone}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-600 uppercase">
                    {m.membership_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{m.joined_date}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleWhatsAppShareMember(m)}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      title="Share via WhatsApp"
                    >
                      <Share2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingMember(m);
                        setShowModal(true);
                      }}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      title={t('edit')}
                    >
                      <ChevronRight size={20} />
                    </button>
                    <button 
                      onClick={async () => {
                        if (confirm(t('confirm_delete_member'))) {
                          try {
                            const res = await safeFetch(`/api/members/${m.id}`, { method: 'DELETE' });
                            if (res.success) {
                              fetchMembers();
                            } else {
                              alert('Failed to delete member: ' + (res.message || 'Unknown error'));
                            }
                          } catch (err: any) {
                            console.error(err);
                            alert('Error deleting member: ' + err.message);
                          }
                        }
                      }}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50"
                      title={t('delete')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <MemberModal 
          member={editingMember}
          onClose={() => setShowModal(false)} 
          onSave={() => {
            fetchMembers();
            setShowModal(false);
          }} 
        />
      )}
    </div>
  );
};

const MemberModal = ({ onClose, onSave, member }: any) => {
  const { t } = useContext(LanguageContext);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: member?.name || '', 
    tamil_name: member?.tamil_name || '', 
    phone: member?.phone || '', 
    email: member?.email || '', 
    address: member?.address || '', 
    family_details: member?.family_details || '', 
    membership_type: member?.membership_type || 'regular', 
    joined_date: member?.joined_date || new Date().toISOString().split('T')[0]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = member ? `/api/members/${member.id}` : '/api/members';
      const method = member ? 'PUT' : 'POST';
      
      await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {member ? t('edit_member') : t('add_member')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('name')}</label>
            <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('tamil_name')}</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.tamil_name} onChange={e => setFormData({...formData, tamil_name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('phone')}</label>
            <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('email')}</label>
            <input type="email" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('family_details')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" rows={2} value={formData.family_details} onChange={e => setFormData({...formData, family_details: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('membership_type')}</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.membership_type} onChange={e => setFormData({...formData, membership_type: e.target.value})}>
              <option value="regular">Regular</option>
              <option value="visitor">Visitor</option>
              <option value="life">Life Member</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('joined_date')}</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.joined_date} onChange={e => setFormData({...formData, joined_date: e.target.value})} />
          </div>
          <div className="col-span-2 flex justify-end space-x-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-200 disabled:opacity-50"
            >
              {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const TransactionsPage = ({ type }: { type: 'income' | 'expense' }) => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => {
    const fetchTxs = async () => {
      try {
        const data = await safeFetch('/api/transactions');
        setTxs(data.filter((tx: any) => tx.type === type));
      } catch (err) {
        console.error(err);
      }
    };
    fetchTxs();
  }, [type]);

  const handlePrintList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = txs.map(tx => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.invoice_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.member_name || tx.vendor_name || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">₹${tx.amount.toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.payment_mode}</td>
      </tr>
    `).join('');

    const total = txs.reduce((sum, tx) => sum + tx.amount, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>${type === 'income' ? 'Income' : 'Expense'} List - CSI CMS</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: ${type === 'income' ? '#059669' : '#dc2626'}; }
            .meta { text-align: right; font-size: 12px; color: #666; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin-bottom: 5px; color: ${type === 'income' ? '#059669' : '#dc2626'};">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="text-transform: uppercase; letter-spacing: 1px;">${type === 'income' ? 'Income' : 'Expense'} List</h3>
          </div>
          <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Category</th>
                <th>${type === 'income' ? 'Member' : 'Vendor'}</th>
                <th>Amount</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="total">Total Amount: ₹${total.toLocaleString()}</div>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppShareList = () => {
    const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
    const summary = txs.map(tx => `${tx.date}: ${tx.invoice_no} - ₹${tx.amount}`).join('\n');
    const text = encodeURIComponent(`*CSI CMS - ${type === 'income' ? 'Income' : 'Expense'} List Summary*\n\nTotal Count: ${txs.length}\nTotal Amount: ₹${total.toLocaleString()}\n\n${summary}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-bold text-slate-800">{type === 'income' ? t('income') : t('expenses')}</h3>
          <button 
            onClick={handlePrintList}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
            title="Print List"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleWhatsAppShareList}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
            title="Share List via WhatsApp"
          >
            <Share2 size={20} />
          </button>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className={`px-4 py-2 rounded-lg font-medium flex items-center space-x-2 text-white transition-colors ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
        >
          <Plus size={20} />
          <span>{type === 'income' ? t('add_income') : t('add_expense')}</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('invoice_no')}</th>
              <th className="px-6 py-3 font-semibold">{t('date')}</th>
              <th className="px-6 py-3 font-semibold">{t('category')}</th>
              <th className="px-6 py-3 font-semibold">{type === 'income' ? t('name') : t('vendor')}</th>
              <th className="px-6 py-3 font-semibold">{t('amount')}</th>
              <th className="px-6 py-3 font-semibold">{t('payment_mode')}</th>
              <th className="px-6 py-3 font-semibold">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txs.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono text-slate-500">{tx.invoice_no}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.member_name || tx.vendor_name || '-'}</td>
                <td className={`px-6 py-4 text-sm font-bold ${type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{tx.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        const text = encodeURIComponent(`*CSI CMS - ${tx.type === 'income' ? 'Receipt' : 'Expense Voucher'}*\n\nInvoice No: ${tx.invoice_no}\nDate: ${tx.date}\nCategory: ${tx.category.toUpperCase()}\n${tx.type === 'income' ? 'Member' : 'Vendor'}: ${tx.member_name || tx.vendor_name || '-'}\nAmount: ₹${tx.amount.toLocaleString()}\nPayment Mode: ${tx.payment_mode.toUpperCase()}`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                      }}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      title="Share via WhatsApp"
                    >
                      <Share2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingTx(tx);
                        setShowModal(true);
                      }}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50"
                      title="Edit Transaction"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Receipt - ${tx.invoice_no}</title>
                                <style>
                                  body { font-family: sans-serif; padding: 40px; }
                                  .header { text-align: center; margin-bottom: 30px; }
                                  .details { margin-bottom: 20px; }
                                  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                                  .total { font-size: 20px; font-bold; margin-top: 20px; text-align: right; }
                                </style>
                              </head>
                              <body>
                                <div class="header">
                                  <h1 style="margin-bottom: 5px;">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
                                  <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
                                  <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
                                  <hr style="border: 0; border-top: 2px solid #059669; margin: 20px 0;">
                                  <p style="font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Official Receipt</p>
                                </div>
                                <div class="details">
                                  <div class="row"><span>Invoice No:</span> <span>${tx.invoice_no}</span></div>
                                  <div class="row"><span>Date:</span> <span>${tx.date}</span></div>
                                  <div class="row"><span>Category:</span> <span>${tx.category.toUpperCase()}</span></div>
                                  <div class="row"><span>${tx.type === 'income' ? 'Member' : 'Vendor'}:</span> <span>${tx.member_name || tx.vendor_name || '-'}</span></div>
                                  <div class="row"><span>Payment Mode:</span> <span>${tx.payment_mode.toUpperCase()}</span></div>
                                </div>
                                <div class="total">Amount: ₹${tx.amount.toLocaleString()}</div>
                                <div style="margin-top: 40px; text-align: center; border-top: 1px dashed #ccc; padding-top: 20px;">
                                  <p style="font-style: italic; color: #444; font-size: 14px; font-weight: 500;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
                                </div>
                                <div style="margin-top: 20px; text-align: center; color: #888; font-size: 12px;">
                                  Thank you for your contribution.
                                </div>
                                <script>window.print();</script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }}
                      className="text-slate-400 hover:text-emerald-600 transition-colors p-1 rounded-md hover:bg-emerald-50"
                      title={t('print')}
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <TransactionModal 
        type={type} 
        initialData={editingTx}
        onClose={() => {
          setShowModal(false);
          setEditingTx(null);
        }} 
        onSave={async () => {
          try {
            const data = await safeFetch('/api/transactions');
            setTxs(data.filter((tx: any) => tx.type === type));
            setShowModal(false);
            setEditingTx(null);
          } catch (err) {
            console.error(err);
          }
        }} 
      />}
    </div>
  );
};

const TransactionModal = ({ type, onClose, onSave, initialData }: any) => {
  const { t } = useContext(LanguageContext);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [formData, setFormData] = useState({
    type, 
    category: initialData?.category || (type === 'income' ? 'offering' : 'maintenance'), 
    amount: initialData?.amount || '', 
    date: initialData?.date || new Date().toISOString().split('T')[0], 
    payment_mode: initialData?.payment_mode || 'cash', 
    member_id: initialData?.member_id || '', 
    vendor_name: initialData?.vendor_name || '', 
    item_details: initialData?.item_details || '', 
    gst_amount: initialData?.gst_amount || 0, 
    notes: initialData?.notes || '',
    start_date: initialData?.sub_start_date || initialData?.date || new Date().toISOString().split('T')[0],
    end_date: initialData?.sub_end_date || ''
  });

  useEffect(() => {
    if (initialData && !['offering', 'tithe', 'event', 'book_sale', 'subscriptions', 'maintenance', 'salary', 'utility'].includes(initialData.category)) {
      setFormData(prev => ({ ...prev, category: 'other' }));
      setCustomCategory(initialData.category);
    }
  }, [initialData]);

  useEffect(() => {
    if (formData.category === 'subscriptions' && !formData.end_date && formData.start_date) {
      const d = new Date(formData.start_date);
      d.setFullYear(d.getFullYear() + 1);
      setFormData(prev => ({ ...prev, end_date: d.toISOString().split('T')[0] }));
    }
  }, [formData.category, formData.start_date]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await safeFetch('/api/members');
        setMembers(data);
      } catch (err) {
        console.error(err);
      }
    };
    if (type === 'income') fetchMembers();
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const finalData = {
        ...formData,
        category: formData.category === 'other' ? customCategory : formData.category
      };
      
      const url = initialData ? `/api/transactions/${initialData.id}` : '/api/transactions';
      const method = initialData ? 'PUT' : 'POST';

      const response = await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalData)
      });

      // Send to Supabase
      try {
        const supabaseData = {
          ...finalData,
          invoice_no: response.invoice_no || initialData?.invoice_no || `TX-${Date.now()}`,
          created_at: initialData?.created_at || new Date().toISOString()
        };
        
        const { error } = await supabase
          .from('transactions')
          .upsert([supabaseData], { onConflict: 'invoice_no' });
          
        if (error) {
          console.error('Supabase error:', error);
        } else {
          console.log('Successfully synced to Supabase');
        }
      } catch (supabaseErr) {
        console.error('Failed to sync to Supabase:', supabaseErr);
      }

      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className={`p-6 border-b border-slate-200 flex justify-between items-center ${type === 'income' ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? (type === 'income' ? 'Edit Income' : 'Edit Expense') : (type === 'income' ? t('add_income') : t('add_expense'))}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('category')}</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                {type === 'income' ? (
                  <>
                    <option value="offering">{t('offering')}</option>
                    <option value="tithe">{t('tithe')}</option>
                    <option value="event">{t('event')}</option>
                    <option value="book_sale">{t('book_sale')}</option>
                    <option value="subscriptions">Subscriptions</option>
                    <option value="other">{t('other')}</option>
                  </>
                ) : (
                  <>
                    <option value="maintenance">{t('maintenance')}</option>
                    <option value="salary">{t('salary')}</option>
                    <option value="utility">{t('utility')}</option>
                    <option value="other">{t('other')}</option>
                  </>
                )}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('amount')}</label>
              <input required type="number" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
          </div>

          {formData.category === 'other' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Specify Other Category</label>
              <input 
                required 
                type="text" 
                placeholder="Enter category name"
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                value={customCategory} 
                onChange={e => setCustomCategory(e.target.value)} 
              />
            </div>
          )}

          {formData.category === 'subscriptions' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Sub. Start Date</label>
                <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">Sub. End Date</label>
                <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
              </div>
            </div>
          )}

          {type === 'income' ? (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('members')}</label>
              <select 
                required={formData.category === 'subscriptions'}
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                value={formData.member_id} 
                onChange={e => setFormData({...formData, member_id: e.target.value})}
              >
                <option value="">{formData.category === 'subscriptions' ? 'Select Member (Required)' : 'Select Member (Optional)'}</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.member_code})</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('vendor')}</label>
              <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('date')}</label>
              <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('payment_mode')}</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})}>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="upi">UPI / GPay</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('notes')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
            <button 
              type="submit" 
              disabled={loading}
              className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg transition-all disabled:opacity-50 ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
            >
              {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const SubscriptionsPage = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  const fetchSubs = async () => {
    try {
      const data = await safeFetch('/api/subscriptions');
      setSubs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this subscription?')) return;
    try {
      await safeFetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
      fetchSubs();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrintList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = subs.map(sub => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.member_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.start_date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.end_date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">₹${sub.amount.toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.status.toUpperCase()}</td>
      </tr>
    `).join('');

    const total = subs.reduce((sum, sub) => sum + sub.amount, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Subscription List - CSI CMS</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #4f46e5; }
            .meta { text-align: right; font-size: 12px; color: #666; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin-bottom: 5px; color: #4f46e5;">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="text-transform: uppercase; letter-spacing: 1px;">Subscription List</h3>
          </div>
          <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Member Name</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div class="total">Total Amount: ₹${total.toLocaleString()}</div>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsAppShareList = () => {
    const total = subs.reduce((sum, sub) => sum + sub.amount, 0);
    const summary = subs.map(sub => `${sub.member_name}: ₹${sub.amount} (${sub.status})`).join('\n');
    const text = encodeURIComponent(`*CSI CMS - Subscription List Summary*\n\nTotal Count: ${subs.length}\nTotal Amount: ₹${total.toLocaleString()}\n\n${summary}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-bold text-slate-800">{t('subscriptions')}</h3>
          <button 
            onClick={handlePrintList}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
            title="Print List"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleWhatsAppShareList}
            className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
            title="Share List via WhatsApp"
          >
            <Share2 size={20} />
          </button>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium flex items-center space-x-2 text-white transition-colors"
        >
          <Plus size={20} />
          <span>Add Subscription</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('name')}</th>
              <th className="px-6 py-3 font-semibold">Start Date</th>
              <th className="px-6 py-3 font-semibold">End Date</th>
              <th className="px-6 py-3 font-semibold">{t('amount')}</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">Loading...</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-400">No subscriptions found</td></tr>
            ) : subs.map((sub) => (
              <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{sub.member_name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{sub.start_date}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{sub.end_date}</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-800">₹{sub.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${sub.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex space-x-2">
                  <button 
                    onClick={() => {
                      setEditingSub(sub);
                      setShowModal(true);
                    }}
                    className="text-slate-400 hover:text-blue-600 p-1"
                    title="Edit Subscription"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="text-slate-400 hover:text-red-600 p-1"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <SubscriptionModal 
        initialData={editingSub}
        onClose={() => {
          setShowModal(false);
          setEditingSub(null);
        }} 
        onSave={() => { 
          fetchSubs(); 
          setShowModal(false); 
          setEditingSub(null);
        }} 
      />}
    </div>
  );
};

const SubscriptionModal = ({ onClose, onSave, initialData }: any) => {
  const { t } = useContext(LanguageContext);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    member_id: initialData?.member_id || '', 
    start_date: initialData?.start_date || new Date().toISOString().split('T')[0], 
    end_date: initialData?.end_date || '', 
    amount: initialData?.amount || '', 
    status: initialData?.status || 'pending'
  });

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await safeFetch('/api/members');
        setMembers(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.member_id) return alert('Please select a member');
    setLoading(true);
    try {
      const url = initialData ? `/api/subscriptions/${initialData.id}` : '/api/subscriptions';
      const method = initialData ? 'PUT' : 'POST';

      await safeFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-indigo-50">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'Edit Subscription' : 'Add Subscription'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('members')}</label>
            <select required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.member_id} onChange={e => setFormData({...formData, member_id: e.target.value})}>
              <option value="">Select Member</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.member_code})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
              <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">End Date</label>
              <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('amount')}</label>
              <input required type="number" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
              <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {loading ? t('saving') : t('save')}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Notepad = () => {
  const { t } = useContext(LanguageContext);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    category: 'event',
    content: '',
    user_name: '',
    mobile: '',
    address: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    status: 'pending' as 'pending' | 'paid'
  });

  const fetchNotes = async () => {
    try {
      const data = await safeFetch('/api/notes');
      setNotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingNote) {
        await safeFetch(`/api/notes/${editingNote.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await safeFetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      setEditingNote(null);
      setFormData({
        category: 'event',
        content: '',
        user_name: '',
        mobile: '',
        address: '',
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        status: 'pending'
      });
      fetchNotes();
    } catch (err) {
      console.error(err);
      alert('Error saving note');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('confirm_delete_note'))) return;
    try {
      await safeFetch(`/api/notes/${id}`, { method: 'DELETE' });
      fetchNotes();
    } catch (err: any) {
      console.error('Delete error:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setFormData({
      category: note.category,
      content: note.content,
      user_name: note.user_name,
      mobile: note.mobile,
      address: note.address,
      date: note.date,
      amount: note.amount || 0,
      status: note.status || 'pending'
    });
    setShowModal(true);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">{t('notepad')}</h3>
        <button 
          onClick={() => {
            setEditingNote(null);
            setFormData({
              category: 'event',
              content: '',
              user_name: '',
              mobile: '',
              address: '',
              date: new Date().toISOString().split('T')[0],
              amount: 0,
              status: 'pending'
            });
            setShowModal(true);
          }}
          className="flex items-center space-x-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus size={20} />
          <span>{t('add_note')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {notes.map((note) => (
          <motion.div 
            key={note.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                note.category === 'event' ? 'bg-blue-100 text-blue-700' :
                note.category === 'prayer' ? 'bg-purple-100 text-purple-700' :
                note.category === 'auction' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {t(note.category as any)}
              </span>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(note)} className="p-1.5 text-slate-400 hover:text-blue-600">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(note.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <p className="text-slate-800 font-medium mb-4 whitespace-pre-wrap">{note.content}</p>
            
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex items-center text-xs text-slate-500">
                <Users size={14} className="mr-2" />
                <span className="font-semibold text-slate-700">{note.user_name}</span>
              </div>
              <div className="flex items-center text-xs text-slate-500">
                <Search size={14} className="mr-2" />
                <span>{note.mobile}</span>
              </div>
              <div className="flex items-center text-xs text-slate-500">
                <FileText size={14} className="mr-2" />
                <span className="truncate">{note.address}</span>
              </div>
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-50">
                <div className="flex items-center text-sm font-bold text-emerald-600">
                  <IndianRupee size={14} className="mr-1" />
                  {note.amount?.toLocaleString() || 0}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  note.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {t(note.status as any || 'pending')}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 text-right mt-2">
                {note.date}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingNote ? t('edit_note') : t('add_note')}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('category')}</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.category}
                      onChange={e => setFormData({...formData, category: e.target.value as any})}
                    >
                      <option value="event">{t('event')}</option>
                      <option value="prayer">{t('prayer')}</option>
                      <option value="auction">{t('auction')}</option>
                      <option value="materials">{t('materials')}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('date')}</label>
                    <input 
                      type="date"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.date}
                      onChange={e => setFormData({...formData, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('content')}</label>
                  <textarea 
                    required
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('user_name')}</label>
                    <input 
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.user_name}
                      onChange={e => setFormData({...formData, user_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('mobile')}</label>
                    <input 
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
                  <input 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('amount')}</label>
                    <input 
                      type="number"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.amount === 0 ? '' : formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('status')}</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="pending">{t('pending')}</option>
                      <option value="paid">{t('paid')}</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex space-x-3">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                  >
                    {t('save')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const IncomeAnalysis = () => {
  const { t } = useContext(LanguageContext);
  const [contributors, setContributors] = useState<TopContributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchContributors = async () => {
    try {
      const data = await safeFetch('/api/reports/top-contributors');
      setContributors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContributors();
  }, []);

  const filteredContributors = contributors.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tamil_name.includes(searchTerm) ||
    c.member_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">{t('income_analysis')}</h3>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h4 className="font-bold text-slate-700">{t('top_contributors')}</h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('search')}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('rank')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('member_code')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t('name')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('transaction_count')}</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">{t('total_contribution')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredContributors.map((c, index) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                      index === 1 ? 'bg-slate-200 text-slate-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-600">{c.member_code}</td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.tamil_name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600 text-right">{c.transaction_count}</td>
                  <td className="p-4 text-right">
                    <span className="text-sm font-bold text-emerald-600">
                      ₹{c.total_contribution.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  const { t, lang, setLang } = useContext(LanguageContext);
  const { user, login } = useContext(AuthContext);
  const settings = useContext(SettingsContext);
  const [formData, setFormData] = useState<any>(settings || {});
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [userEmail, setUserEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) setFormData(settings);
  }, [settings]);

  // Only initialize userEmail once when user is loaded
  useEffect(() => {
    if (user?.email) {
      setUserEmail(user.email);
    }
  }, [user?.email]);

  const handleEmailUpdate = async () => {
    if (!userEmail || !userEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      await safeFetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username, email: userEmail })
      });
      if (user) {
        login({ ...user, email: userEmail });
      }
      alert('Recovery email updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await safeFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      alert('Settings saved!');
      window.location.reload(); // Refresh to apply settings globally
    } catch (err) {
      console.error(err);
      alert('Failed to save settings');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      alert('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await safeFetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username,
          currentPassword: passwordData.current,
          newPassword: passwordData.new
        })
      });
      alert(t('password_reset_success'));
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      await safeFetch('/api/settings/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user?.username })
      });
      alert('Password reset to admin123');
    } catch (err: any) {
      alert('Failed to reset password');
    }
  };

  const handleSyncToSupabase = async () => {
    setLoading(true);
    try {
      const txs = await safeFetch('/api/transactions');
      const members = await safeFetch('/api/members');
      
      // Sync Members first (if table exists)
      try {
        const { error: memberError } = await supabase
          .from('members')
          .upsert(members, { onConflict: 'member_code' });
        if (memberError) console.warn('Supabase Members Sync Error:', memberError);
      } catch (e) {}

      // Sync Transactions
      const { error: txError } = await supabase
        .from('transactions')
        .upsert(txs, { onConflict: 'invoice_no' });
        
      if (txError) throw txError;
      
      alert('Successfully synced all data to Supabase!');
    } catch (err: any) {
      console.error(err);
      alert('Sync failed: ' + (err.message || 'Unknown error. Make sure "transactions" table exists in Supabase.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl space-y-8 pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">{t('church_profile')}</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Church Name (English)</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.church_name} onChange={e => setFormData({...formData, church_name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">தேவாலய பெயர் (தமிழ்)</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.church_name_tamil} onChange={e => setFormData({...formData, church_name_tamil: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('financial_year')}</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.financial_year} onChange={e => setFormData({...formData, financial_year: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('currency')}</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} />
            </div>
          </div>
        </div>
        <div className="pt-4">
          <button onClick={handleSave} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
            {t('save')}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">SMTP Configuration</h3>
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start space-x-3 shadow-sm">
            <div className="text-amber-600 mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">Critical SMTP Setup</p>
              <div className="space-y-1.5">
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  To send emails (OTPs, receipts), you must configure your SMTP settings. These will override environment variables.
                </p>
                <ul className="text-[10px] text-amber-700 space-y-1 list-disc list-inside">
                  <li><b>SMTP User</b>: Must be your full email (e.g., <i>name@gmail.com</i>)</li>
                  <li><b>SMTP Password</b>: Must be an <b>App Password</b> (not your login password).</li>
                </ul>
                <div className="mt-2 p-2 bg-white/50 rounded border border-amber-200">
                  <p className="text-[9px] font-bold text-amber-900 uppercase mb-1">How to get a Gmail App Password:</p>
                  <ol className="text-[9px] text-amber-800 space-y-0.5 list-decimal list-inside">
                    <li>Go to your <a href="https://myaccount.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">Google Account</a></li>
                    <li>Enable <b>2-Step Verification</b> in the Security tab</li>
                    <li>Search for <b>"App Passwords"</b> in the search bar</li>
                    <li>Create a new app (e.g., "Church App") and copy the <b>16-character code</b></li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">SMTP Host</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.smtp_host || ''} onChange={e => setFormData({...formData, smtp_host: e.target.value})} placeholder="e.g. smtp.gmail.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">SMTP Port</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.smtp_port || ''} onChange={e => setFormData({...formData, smtp_port: e.target.value})} placeholder="e.g. 587 or 465" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">SMTP User (Email)</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.smtp_user || ''} onChange={e => setFormData({...formData, smtp_user: e.target.value})} placeholder="your-email@gmail.com" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">SMTP Password / App Password</label>
              <input type="password" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={formData.smtp_pass || ''} onChange={e => setFormData({...formData, smtp_pass: e.target.value})} placeholder="Your App Password" />
            </div>
          </div>
          
          <div className="pt-2">
            <button onClick={handleSave} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-100">
              Save SMTP Settings
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">Account Recovery</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Recovery Email Address</label>
            <input 
              className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
              value={userEmail} 
              onChange={e => setUserEmail(e.target.value)} 
              placeholder="Enter email for password recovery"
            />
            <p className="text-[10px] text-slate-400">This email will be used to send OTP for password reset.</p>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleEmailUpdate} 
              disabled={loading}
              className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-100 disabled:opacity-50"
            >
              {loading ? t('saving') : 'Update Recovery Email'}
            </button>
            <button 
              onClick={async () => {
                if (!userEmail) {
                  alert("Please enter a recovery email address first.");
                  return;
                }
                setLoading(true);
                try {
                  const data = await safeFetch('/api/settings/test-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: userEmail })
                  });
                  alert("✅ " + data.message);
                } catch (err: any) {
                  alert("❌ " + (err.message || 'Test failed'));
                } finally {
                  setLoading(false);
                }
              }} 
              disabled={loading}
              className={`px-4 py-3 border-2 font-bold rounded-xl transition-all text-xs flex items-center justify-center space-x-2 ${
                loading 
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'border-slate-100 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  <span>Testing...</span>
                </>
              ) : (
                <span>Test SMTP</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">{t('change_password')}</h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('current_password')}</label>
            <input 
              type="password" 
              required
              className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
              value={passwordData.current} 
              onChange={e => setPasswordData({...passwordData, current: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('new_password')}</label>
              <input 
                type="password" 
                required
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                value={passwordData.new} 
                onChange={e => setPasswordData({...passwordData, new: e.target.value})} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('confirm_password')}</label>
              <input 
                type="password" 
                required
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" 
                value={passwordData.confirm} 
                onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} 
              />
            </div>
          </div>
          <div className="pt-4 flex space-x-3">
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-100 disabled:opacity-50"
            >
              {loading ? t('saving') : t('save')}
            </button>
            <button 
              type="button"
              onClick={handlePasswordReset}
              className="px-6 py-3 border-2 border-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              {t('password_reset_default')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">Supabase Integration</h3>
        <div className="space-y-4">
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-start space-x-3 shadow-sm">
            <div className="text-emerald-600 mt-0.5">
              <TrendingUp size={18} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Live Cloud Sync</p>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Your checkout form is now connected to Supabase. All new transactions are automatically synced to your cloud database.
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Database Migration</p>
            <p className="text-xs text-slate-500">Sync all existing local records to your Supabase project.</p>
            <button 
              onClick={handleSyncToSupabase}
              disabled={loading}
              className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              <Download size={18} />
              <span>{loading ? 'Syncing...' : 'Sync Entire Database to Supabase'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">{t('language')}</h3>
        <div className="flex space-x-4">
          <button 
            onClick={() => setLang('en')}
            className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${lang === 'en' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
          >
            English
          </button>
          <button 
            onClick={() => setLang('ta')}
            className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${lang === 'ta' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      <div className="pt-8 pb-4 text-center border-t border-slate-100">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-1">Developer Information</p>
        <p className="text-sm text-slate-600 font-semibold">Software Development: Mr. Arunkumar Rajamanickam</p>
        <p className="text-xs text-slate-500 mt-1">Contact: <a href="mailto:sriarunkumarphy@gmail.com" className="text-emerald-600 hover:underline">sriarunkumarphy@gmail.com</a></p>
      </div>
    </div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot' | 'verify'>('login');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (data.success) onLogin(data.user);
      else setError(data.message || 'Login failed');
    } catch (err: any) {
      setError(err.message || 'Connection error. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await safeFetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (data.success) {
        setMessage(data.message);
        setWarning('');
        setView('verify');
      } else {
        setError(data.message || 'Failed to send OTP');
        if (data.message && data.message.includes('Email delivery failed')) {
          setWarning(data.message);
          setView('verify'); // Still go to verify so they can use the log OTP
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await safeFetch('/api/reset-password-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      if (data.success) {
        alert('Password reset successful! Please login.');
        setView('login');
        setMessage('');
        setOtp('');
        setNewPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid OTP or error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-emerald-200 mb-4">
            <LayoutDashboard size={32} />
          </div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">C.S.I W.J HATCH MEMORIAL CHURCH</h1>
          <p className="text-slate-500">Church Management Software</p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Username</label>
              <input 
                required
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Password</label>
                <button 
                  type="button"
                  onClick={() => setView('forgot')}
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700"
                >
                  Forgot Password?
                </button>
              </div>
              <input 
                required
                type="password"
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            <button 
              disabled={loading}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800">Reset Password</h2>
              <p className="text-sm text-slate-500">Enter your registered recovery email</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <p className="text-[10px] text-blue-700 leading-relaxed">
                <b>Note:</b> If you haven't set a recovery email in Settings, the default is <b>admin@example.com</b>. 
                You won't receive emails sent to this address.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
              <input 
                required
                type="email"
                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </div>
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            <div className="flex space-x-3">
              <button 
                type="button"
                onClick={() => setView('login')}
                className="flex-1 py-4 border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all"
              >
                Back
              </button>
              <button 
                disabled={loading}
                className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          </form>
        )}

        {view === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800">Verify OTP</h2>
              <p className="text-sm text-emerald-600 font-medium">{message}</p>
              {warning && (
                <div className={`p-4 rounded-xl border ${warning.includes('TIP:') ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start space-x-3">
                    {warning.includes('TIP:') && (
                      <div className="text-amber-600 mt-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className={`text-xs font-bold uppercase ${warning.includes('TIP:') ? 'text-amber-800' : 'text-slate-600'}`}>
                        {warning.includes('TIP:') ? 'SMTP Setup Required' : 'Email Delivery Status'}
                      </p>
                      <p className={`text-[11px] leading-relaxed ${warning.includes('TIP:') ? 'text-amber-700' : 'text-slate-600'}`}>
                        {warning.split('(DEV:')[0]}
                      </p>
                      {warning.includes('(DEV:') && (
                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Development Bypass Code:</p>
                          <p className="text-2xl font-black text-emerald-700 tracking-[0.2em]">
                            {warning.match(/Your code is (\d+)/)?.[1]}
                          </p>
                          <p className="text-[9px] text-emerald-600 mt-1 italic">Use this code to proceed while you fix SMTP settings.</p>
                        </div>
                      )}
                      {warning.includes('535') || warning.includes('Admin') ? (
                        <div className="mt-3 p-3 bg-amber-100/50 border-2 border-amber-200 rounded-xl space-y-2 shadow-sm">
                          <div className="flex items-center space-x-2 text-amber-900 font-bold text-[10px] uppercase tracking-wider">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            <span>Action Required: Fix SMTP Settings</span>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-amber-800 leading-relaxed">
                              Your email settings are misconfigured. You must update your <b>Environment Variables</b> in the platform settings:
                            </p>
                            <div className="grid grid-cols-1 gap-1.5">
                              <div className="flex items-center justify-between bg-white/60 p-1.5 rounded border border-amber-200">
                                <span className="text-[9px] font-bold text-amber-900">SMTP_USER</span>
                                <span className="text-[9px] text-amber-700 font-mono">Your Full Email</span>
                              </div>
                              <div className="flex items-center justify-between bg-white/60 p-1.5 rounded border border-amber-200">
                                <span className="text-[9px] font-bold text-amber-900">SMTP_PASS</span>
                                <span className="text-[9px] text-amber-700 font-mono">App Password</span>
                              </div>
                            </div>
                            <p className="text-[9px] text-amber-600 italic">
                              * Do not use "Admin" as your SMTP username or password.
                            </p>
                          </div>
                        </div>
                      ) : null}
                      {warning.includes('check server logs') && (
                        <div className="pt-2">
                          <p className="text-[10px] text-slate-500 italic">
                            Since you are in development, you can find the 6-digit code in the server logs (terminal) to proceed.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">6-Digit OTP</label>
                <input 
                  required
                  maxLength={6}
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 text-center tracking-widest font-bold text-lg"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="000000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">New Password</label>
                <input 
                  required
                  type="password"
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            <div className="flex space-x-3">
              <button 
                type="button"
                onClick={() => setView('forgot')}
                className="flex-1 py-4 border-2 border-slate-100 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all"
              >
                Back
              </button>
              <button 
                disabled={loading}
                className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Reset'}
              </button>
            </div>
          </form>
        )}
        
        <div className="text-center">
          <p className="text-xs text-slate-400">Default: admin / admin123</p>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('csi_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('csi_lang');
    return (saved as Language) || 'en';
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (user) localStorage.setItem('csi_user', JSON.stringify(user));
    else localStorage.removeItem('csi_user');
  }, [user]);

  useEffect(() => {
    localStorage.setItem('csi_lang', lang);
  }, [lang]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await safeFetch('/api/settings');
        setSettings(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const t = (key: keyof typeof TRANSLATIONS['en']) => TRANSLATIONS[lang][key] || key;

  if (!user) return <LoginPage onLogin={setUser} />;

  return (
    <AuthContext.Provider value={{ user, login: setUser, logout: () => setUser(null) }}>
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        <SettingsContext.Provider value={settings}>
          <div className="min-h-screen bg-slate-50 flex">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 ml-64 pt-16">
              <Header title={t(activeTab as any) || activeTab} />
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'dashboard' && <Dashboard />}
                  {activeTab === 'members' && <MembersPage />}
                  {activeTab === 'income' && <TransactionsPage type="income" />}
                  {activeTab === 'expenses' && <TransactionsPage type="expense" />}
                  {activeTab === 'settings' && <SettingsPage />}
                  {/* Placeholder for other pages */}
                  {activeTab === 'reports' && <ReportsPage />}
                  {activeTab === 'cash_counter' && <CashCounterPage />}
                  {activeTab === 'subscriptions' && <SubscriptionsPage />}
                  {activeTab === 'notepad' && <Notepad />}
                  {activeTab === 'income_analysis' && <IncomeAnalysis />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </SettingsContext.Provider>
      </LanguageContext.Provider>
    </AuthContext.Provider>
  );
}

const CashCounterPage = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const denominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  const [counts, setCounts] = useState<Record<number, number>>(
    Object.fromEntries(denominations.map(d => [d, 0]))
  );

  const total = denominations.reduce((sum, d) => sum + (d * (counts[d] || 0)), 0);

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    const resetCounts = Object.fromEntries(denominations.map(d => [d, 0]));
    setCounts(resetCounts);
  };

  const handleShare = () => {
    const churchName = settings?.church_name || 'Church Management System';
    let text = `*${churchName}*\n*Cash Counter Statement*\nDate: ${new Date().toLocaleString()}\n\n`;
    
    denominations.forEach(d => {
      const count = counts[d] || 0;
      if (count > 0) {
        text += `₹${d} x ${count} = ₹${(d * count).toLocaleString()}\n`;
      }
    });
    
    text += `\n*Grand Total: ₹${total.toLocaleString()}*`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = denominations.map(d => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">₹${d}</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${counts[d] || 0}</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">₹${(d * (counts[d] || 0)).toLocaleString()}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cash Counter - CSI CMS</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: center; border: 1px solid #ddd; padding: 12px; }
            h1 { text-align: center; color: #059669; margin-bottom: 5px; }
            h2 { text-align: center; color: #444; margin-top: 0; font-size: 18px; }
            .total { text-align: right; font-size: 24px; font-weight: bold; margin-top: 30px; border-top: 2px solid #000; padding-top: 10px; }
            .meta { text-align: right; font-size: 12px; color: #666; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1>${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2>${settings?.church_name_tamil || ''}</h2>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="text-transform: uppercase; letter-spacing: 1px;">Cash Counter Statement</h3>
          </div>
          <div class="meta">Generated on: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Denomination</th>
                <th>Count</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div class="total">Grand Total: ₹${total.toLocaleString()}</div>
          <div style="margin-top: 50px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">{t('cash_counter')}</h3>
          <p className="text-slate-500 text-xs">Calculate and share cash denominations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleReset} className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors border border-slate-200">
            {t('reset')}
          </button>
          <button onClick={handleShare} className="flex items-center space-x-2 px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all">
            <Share2 size={16} />
            <span>WhatsApp</span>
          </button>
          <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-1.5 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-slate-900 shadow-lg shadow-slate-100 transition-all">
            <Printer size={16} />
            <span>{t('print')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Denomination</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Count</th>
              <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {denominations.map(d => (
              <tr key={d} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-xs">
                      ₹
                    </div>
                    <span className="text-base font-bold text-slate-700">{d}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <input 
                    type="number" 
                    min="0"
                    value={counts[d] || ''} 
                    onChange={e => setCounts({...counts, [d]: parseInt(e.target.value) || 0})}
                    className="w-20 p-2 text-center text-lg font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="0"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-base font-mono font-bold text-slate-600">
                    ₹{(d * (counts[d] || 0)).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr>
              <td colSpan={2} className="px-4 py-5 text-right font-bold text-sm uppercase tracking-widest">Grand Total</td>
              <td className="px-4 py-5 text-right font-mono text-2xl font-bold text-emerald-400">
                ₹{total.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const ReportsPage = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState({ start: '', end: '', category: 'all' });
  const [summary, setSummary] = useState({ income: 0, expense: 0 });

  useEffect(() => {
    const fetchTxs = async () => {
      try {
        const data = await safeFetch('/api/transactions');
        setTxs(data);
        const inc = data.filter((tx: any) => tx.type === 'income').reduce((sum: number, tx: any) => sum + tx.amount, 0);
        const exp = data.filter((tx: any) => tx.type === 'expense').reduce((sum: number, tx: any) => sum + tx.amount, 0);
        setSummary({ income: inc, expense: exp });
      } catch (err) {
        console.error(err);
      }
    };
    fetchTxs();
  }, []);

  const filtered = txs.filter(tx => {
    const dateMatch = (!filter.start || tx.date >= filter.start) && (!filter.end || tx.date <= filter.end);
    const catMatch = filter.category === 'all' || tx.category === filter.category;
    return dateMatch && catMatch;
  });

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = filtered.map(tx => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.member_name || tx.vendor_name || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: ${tx.type === 'income' ? '#059669' : '#dc2626'}; font-weight: bold;">
          ${tx.type === 'income' ? '+' : '-'} ₹${tx.amount.toLocaleString()}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.payment_mode.toUpperCase()}</td>
      </tr>
    `).join('');

    const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

    printWindow.document.write(`
      <html>
        <head>
          <title>Financial Report - CSI CMS</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #1e293b; }
            .meta { text-align: right; font-size: 12px; color: #666; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 20px; }
            .summary-item { padding: 15px; border-radius: 8px; border: 1px solid #ddd; text-align: center; }
            .income { background-color: #ecfdf5; color: #065f46; }
            .expense { background-color: #fef2f2; color: #991b1b; }
            .balance { background-color: #eff6ff; color: #1e40af; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="margin-bottom: 5px; color: #1e293b;">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <h3 style="text-transform: uppercase; letter-spacing: 1px;">Financial Report</h3>
          </div>
          <div class="meta">
            Period: ${filter.start || 'Start'} to ${filter.end || 'End'}<br>
            Category: ${filter.category}<br>
            Generated on: ${new Date().toLocaleString()}
          </div>
          
          <div class="summary">
            <div class="summary-item income">
              <div>Total Income</div>
              <div style="font-size: 20px; font-weight: bold;">₹${totalIncome.toLocaleString()}</div>
            </div>
            <div class="summary-item expense">
              <div>Total Expense</div>
              <div style="font-size: 20px; font-weight: bold;">₹${totalExpense.toLocaleString()}</div>
            </div>
            <div class="summary-item balance">
              <div>Balance</div>
              <div style="font-size: 20px; font-weight: bold;">₹${(totalIncome - totalExpense).toLocaleString()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Name / Vendor</th>
                <th>Amount</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShare = () => {
    const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const balance = totalIncome - totalExpense;

    const text = `*CSI CMS Financial Report*\n` +
                 `Period: ${filter.start || 'Start'} to ${filter.end || 'End'}\n` +
                 `Category: ${filter.category}\n\n` +
                 `Total Income: ₹${totalIncome.toLocaleString()}\n` +
                 `Total Expense: ₹${totalExpense.toLocaleString()}\n` +
                 `*Balance: ₹${balance.toLocaleString()}*\n\n` +
                 `Generated on: ${new Date().toLocaleString()}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const categories = Array.from(new Set(txs.map(tx => tx.category)));

  return (
    <div className="p-8 space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('date')} (Start)</label>
          <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={filter.start} onChange={e => setFilter({...filter, start: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('date')} (End)</label>
          <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={filter.end} onChange={e => setFilter({...filter, end: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('category')}</label>
          <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" value={filter.category} onChange={e => setFilter({...filter, category: e.target.value})}>
            <option value="all">All Categories</option>
            {categories.map((cat: any) => (
              <option key={cat} value={cat}>{t(cat as any) || (typeof cat === 'string' ? cat.charAt(0).toUpperCase() + cat.slice(1) : cat)}</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-2 ml-auto">
          <button onClick={handleShare} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-emerald-700 transition-colors">
            <Share2 size={20} />
            <span>Share</span>
          </button>
          <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-slate-900 transition-colors">
            <Printer size={20} />
            <span>{t('print')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
          <p className="text-emerald-600 text-sm font-bold uppercase">{t('total_income')}</p>
          <p className="text-3xl font-black text-emerald-700">₹{summary.income.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
          <p className="text-red-600 text-sm font-bold uppercase">{t('total_expense')}</p>
          <p className="text-3xl font-black text-red-700">₹{summary.expense.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <p className="text-blue-600 text-sm font-bold uppercase">{t('balance')}</p>
          <p className="text-3xl font-black text-blue-700">₹{(summary.income - summary.expense).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm print:shadow-none print:border-none">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('date')}</th>
              <th className="px-6 py-3 font-semibold">{t('category')}</th>
              <th className="px-6 py-3 font-semibold">{t('name')} / {t('vendor')}</th>
              <th className="px-6 py-3 font-semibold">{t('amount')}</th>
              <th className="px-6 py-3 font-semibold">{t('payment_mode')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.member_name || tx.vendor_name || '-'}</td>
                <td className={`px-6 py-4 text-sm font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
