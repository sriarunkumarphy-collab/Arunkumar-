/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
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
  RefreshCw,
  Hash,
  Key,
  Edit,
  Calculator,
  ChevronRight,
  IndianRupee,
  Trash2,
  Share2,
  Edit2,
  StickyNote,
  TrendingUp,
  FileSearch,
  Cake,
  Heart,
  Calendar,
  MessageCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './supabase';
import { TRANSLATIONS } from './constants';
import { BIBLE_VERSES } from './bible_verses';
import { User, Language, Settings, Member, Transaction, Subscription, Note, TopContributor, Correction } from './types';

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

const useLanguage = () => useContext(LanguageContext);

const SettingsContext = createContext<Settings | null>(null);

// Helper for robust JSON fetching with retry logic
const safeFetch = async (url: string, options: RequestInit = {}, retries = 3) => {
  const userStr = localStorage.getItem('church_crm_user');
  let churchId = '';
  let userRole = '';
  let userId = '';

  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.church_id !== undefined && user.church_id !== null) {
        churchId = user.church_id.toString();
      }
      if (user.role) userRole = user.role;
      if (user.id) userId = user.id.toString();
    } catch (e) {}
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (churchId) {
    headers['x-church-id'] = churchId;
  }

  if (userRole) {
    headers['x-user-role'] = userRole;
  }

  if (userId) {
    headers['x-user-id'] = userId;
  }

  const executeFetch = async (attempt: number): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = `Server error: ${res.status}`;
        try {
          const data = await res.json();
          errorMsg = data.message || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return res.json();
      }
      return res.text();
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      const isNetworkError = err.name === 'TypeError' && err.message === 'Failed to fetch';
      const isTimeout = err.name === 'AbortError';
      
      if ((isNetworkError || isTimeout) && attempt < retries) {
        console.warn(`Fetch attempt ${attempt + 1} failed for ${url}, retrying...`, err.message);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
        return executeFetch(attempt + 1);
      }
      
      if (isTimeout) {
        throw new Error('Request timed out. Please check your connection.');
      }
      throw err;
    }
  };

  return executeFetch(0);
};

const printThermal = (html: string) => {
  // Create a hidden iframe for robust printing across devices, especially mobile
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.zIndex = '-1';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    // Remove any auto-print/auto-close scripts from the HTML string as we handle it here
    const cleanHtml = html.replace(/<script>.*?window\.print\(\).*?<\/script>/g, '');
    doc.write(cleanHtml);
    doc.close();
    
    // Wait for content to load and then print
    const triggerPrint = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Remove the iframe after some time to allow the print dialog to open
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1000);
      }
    };

    // Increased delay to ensure styles and content are rendered, especially on mobile
    setTimeout(triggerPrint, 500);
  }
};

// Components
const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }: { activeTab: string, setActiveTab: (t: string) => void, isOpen: boolean, onClose: () => void }) => {
  const { t } = useContext(LanguageContext);
  const { user, logout } = useContext(AuthContext);
  const settings = useContext(SettingsContext);
  
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { id: 'members', icon: Users, label: t('members') },
    { id: 'special-days', icon: Calendar, label: t('special_days') },
    { id: 'income', icon: ArrowUpCircle, label: t('income') },
    { id: 'expenses', icon: ArrowDownCircle, label: t('expenses') },
    { id: 'subscriptions', icon: CreditCard, label: t('subscriptions') },
    { id: 'notepad', icon: StickyNote, label: t('notepad') },
    { id: 'income_analysis', icon: TrendingUp, label: t('income_analysis') },
    { id: 'cash_counter', icon: Calculator, label: t('cash_counter') },
    { id: 'reports', icon: FileText, label: t('reports') },
    { id: 'settings', icon: SettingsIcon, label: t('settings') },
  ];

  const superAdminMenuItems = [
    { id: 'super_dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'super_settings', icon: SettingsIcon, label: 'Settings' },
  ];

  const items = user?.role === 'super_admin' ? superAdminMenuItems : menuItems;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <div className={`w-64 bg-slate-950 text-white h-screen fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shadow-2xl`}>
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between bg-slate-950/50 backdrop-blur-md">
          <div>
            <h1 className="text-xl font-serif font-bold text-indigo-400 leading-tight italic">
              {user?.role === 'super_admin' ? 'Super Admin' : (settings?.church_name || user?.church_name || 'CSI CMS')}
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-medium">{user?.name} • {user?.role}</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
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
    </>
  );
};

const Header = ({ title, onMenuClick }: { title: string, onMenuClick: () => void }) => {
  const { lang, setLang } = useContext(LanguageContext);
  const { user, logout } = useContext(AuthContext);
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <header className={`h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 fixed top-0 right-0 left-0 md:left-64 z-30 flex items-center justify-between px-4 md:px-8`}>
      <div className="flex items-center space-x-4">
        <button onClick={onMenuClick} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
          <Menu size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight uppercase leading-none">{title}</h2>
          {user?.church_name && (
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">{user.church_name}</span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2 md:space-x-4">
        <button 
          onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
          className="flex items-center space-x-2 px-2 md:px-3 py-1.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors text-xs md:text-sm font-medium"
        >
          <Languages size={16} />
          <span className="hidden sm:inline">{lang === 'en' ? 'தமிழ்' : 'English'}</span>
          <span className="sm:hidden">{lang === 'en' ? 'TA' : 'EN'}</span>
        </button>
        {isSuperAdmin && (
          <button 
            onClick={logout}
            className="flex items-center space-x-2 px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full hover:bg-rose-100 transition-colors text-xs font-black uppercase tracking-widest"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>
    </header>
  );
};

// Pages
const RemindersWidget = () => {
  const { t } = useLanguage();
  const [reminders, setReminders] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const data = await safeFetch('/api/reminders');
        setReminders(data);
      } catch (error) {
        console.error('Error fetching reminders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReminders();
  }, []);

  if (loading) return <div className="p-6 bg-white rounded-2xl border border-slate-100 animate-pulse h-48"></div>;
  if (!reminders) return null;

  const hasToday = reminders.today.birthdays.length > 0 || reminders.today.anniversaries.length > 0;

  return (
    <div className="space-y-6">
      {hasToday && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reminders.today.birthdays.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border border-pink-100">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-pink-500 rounded-lg text-white">
                  <Cake size={20} />
                </div>
                <h3 className="font-bold text-slate-800">{t('today_birthdays')}</h3>
              </div>
              <div className="space-y-3">
                {reminders.today.birthdays.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-pink-100">
                    <div>
                      <p className="font-bold text-slate-800">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.phone}</p>
                    </div>
                    <a 
                      href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Happy Birthday ${m.name}! May God bless you abundantly.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
                    >
                      <MessageCircle size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reminders.today.anniversaries.length > 0 && (
            <div className="p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-indigo-500 rounded-lg text-white">
                  <Heart size={20} />
                </div>
                <h3 className="font-bold text-slate-800">{t('today_anniversaries')}</h3>
              </div>
              <div className="space-y-3">
                {reminders.today.anniversaries.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-indigo-100">
                    <div>
                      <p className="font-bold text-slate-800">{m.name} & {m.spouse_name}</p>
                      <p className="text-xs text-slate-500">{m.phone}</p>
                    </div>
                    <a 
                      href={`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Happy Wedding Anniversary ${m.name} & ${m.spouse_name}! May God bless your family.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                    >
                      <MessageCircle size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <Calendar size={18} className="text-indigo-500" />
            <span>{t('upcoming_birthdays')}</span>
          </h3>
          <div className="space-y-2">
            {reminders.upcoming.birthdays.length > 0 ? reminders.upcoming.birthdays.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center font-bold">
                    {m.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{m.name}</p>
                    <p className="text-xs text-slate-500">{new Date(m.dob).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 italic text-center py-4">No upcoming birthdays</p>
            )}
          </div>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <Calendar size={18} className="text-indigo-500" />
            <span>{t('upcoming_anniversaries')}</span>
          </h3>
          <div className="space-y-2">
            {reminders.upcoming.anniversaries.length > 0 ? reminders.upcoming.anniversaries.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    {m.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{m.name} & {m.spouse_name}</p>
                    <p className="text-xs text-slate-500">{new Date(m.anniversary_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-400 italic text-center py-4">No upcoming anniversaries</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SpecialDaysPage = () => {
  const { t } = useLanguage();
  const settings = useContext(SettingsContext);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const months = [
    { id: 1, name: t('january') }, { id: 2, name: t('february') }, { id: 3, name: t('march') },
    { id: 4, name: t('april') }, { id: 5, name: t('may') }, { id: 6, name: t('june') },
    { id: 7, name: t('july') }, { id: 8, name: t('august') }, { id: 9, name: t('september') },
    { id: 10, name: t('october') }, { id: 11, name: t('november') }, { id: 12, name: t('december') }
  ];

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await safeFetch('/api/members');
        setMembers(data);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const monthBirthdays = members
    .filter(m => m.dob && parseInt(m.dob.slice(5, 7)) === selectedMonth)
    .sort((a, b) => parseInt(a.dob!.slice(8, 10)) - parseInt(b.dob!.slice(8, 10)));

  const monthAnniversaries = members
    .filter(m => m.marital_status === 'married' && m.anniversary_date && parseInt(m.anniversary_date.slice(5, 7)) === selectedMonth)
    .sort((a, b) => parseInt(a.anniversary_date!.slice(8, 10)) - parseInt(b.anniversary_date!.slice(8, 10)));

  const handlePrint = () => {
    const birthdayRows = monthBirthdays.map(m => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.dob?.slice(8, 10)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.phone}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">Birthday</td>
      </tr>
    `).join('');

    const anniversaryRows = monthAnniversaries.map(m => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.anniversary_date?.slice(8, 10)}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.name} & ${m.spouse_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.phone}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">Anniversary</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Special Days - ${months.find(m => m.id === selectedMonth)?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #1e293b; }
            .section-header { background-color: #f8fafc; padding: 10px; font-weight: bold; border: 1px solid #ddd; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
            <h2>Special Days Report: ${months.find(m => m.id === selectedMonth)?.name}</h2>
          </div>
          
          <div class="section-header">Birthdays</div>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              ${birthdayRows || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No birthdays this month</td></tr>'}
            </tbody>
          </table>

          <div class="section-header">Anniversaries</div>
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Names</th>
                <th>Phone</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              ${anniversaryRows || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No anniversaries this month</td></tr>'}
            </tbody>
          </table>

          <div style="margin-top: 40px; text-align: center; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{t('special_days')}</h2>
          <button 
            onClick={handlePrint}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 flex items-center space-x-2"
            title="Print Monthly Report"
          >
            <Printer size={20} />
            <span className="text-sm font-bold">Print</span>
          </button>
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {months.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMonth(m.id)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
                selectedMonth === m.id 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-100 text-pink-600 rounded-xl">
              <Cake size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{t('birthdays')}</h3>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            {monthBirthdays.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {monthBirthdays.map(m => (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-pink-50 text-pink-500 rounded-2xl flex items-center justify-center font-black text-lg">
                        {m.dob?.slice(8, 10)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{m.name}</p>
                        <p className="text-sm text-slate-500">{m.phone}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => window.open(`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Happy Birthday ${m.name}! May God bless you abundantly.`)}`, '_blank')}
                      className="p-2 text-pink-500 hover:bg-pink-50 rounded-xl transition-colors"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 italic">No birthdays in this month</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Heart size={24} />
            </div>
            <h3 className="text-xl font-bold text-slate-800">{t('anniversaries')}</h3>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            {monthAnniversaries.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {monthAnniversaries.map(m => (
                  <div key={m.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center font-black text-lg">
                        {m.anniversary_date?.slice(8, 10)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{m.name} & {m.spouse_name}</p>
                        <p className="text-sm text-slate-500">{m.phone}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => window.open(`https://wa.me/${m.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Happy Wedding Anniversary ${m.name} & ${m.spouse_name}! May God bless your family.`)}`, '_blank')}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors"
                    >
                      <MessageCircle size={20} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 italic">No anniversaries in this month</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
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
        const txData = await safeFetch('/api/transactions?limit=5');
        setRecent(txData);
      } catch (err) {
        console.error(err);
      }
    };

    fetchStats();
    fetchRecent();
  }, []);

  const handlePrintSummary = () => {
    const recentRows = recent.map(tx => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.member_name || tx.vendor_name || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: ${tx.type === 'income' ? '#059669' : '#dc2626'}; font-weight: bold;">
          ${tx.type === 'income' ? '+' : '-'} ₹${tx.amount.toLocaleString()}
        </td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Dashboard Summary - ${settings?.church_name || 'CSI CMS'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #1e293b; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px; }
            .stat-box { padding: 15px; border: 1px solid #ddd; border-radius: 8px; text-align: center; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
            <h2>Dashboard Overview</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>

          <div class="stats-grid">
            <div class="stat-box">
              <div style="font-size: 10px; color: #666;">TOTAL INCOME</div>
              <div style="font-size: 18px; font-weight: bold; color: #059669;">₹${stats.income.toLocaleString()}</div>
            </div>
            <div class="stat-box">
              <div style="font-size: 10px; color: #666;">TOTAL EXPENSE</div>
              <div style="font-size: 18px; font-weight: bold; color: #dc2626;">₹${stats.expense.toLocaleString()}</div>
            </div>
            <div class="stat-box">
              <div style="font-size: 10px; color: #666;">CORRECTION</div>
              <div style="font-size: 18px; font-weight: bold; color: #d97706;">₹${stats.correction.toLocaleString()}</div>
            </div>
            <div class="stat-box">
              <div style="font-size: 10px; color: #666;">NET BALANCE</div>
              <div style="font-size: 18px; font-weight: bold; color: #2563eb;">₹${stats.balance.toLocaleString()}</div>
            </div>
          </div>

          <h3 style="margin-top: 30px;">Recent Transactions</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Name / Vendor</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${recentRows}
            </tbody>
          </table>

          <div style="margin-top: 40px; text-align: center; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  if (!stats) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h2>
        <button 
          onClick={handlePrintSummary}
          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 flex items-center space-x-2"
          title="Print Summary"
        >
          <Printer size={20} />
          <span className="text-sm font-bold">Print Summary</span>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard title={t('total_income')} value={stats.income} icon={ArrowUpCircle} color="text-indigo-600" bg="bg-indigo-50" />
        <StatCard title={t('total_expense')} value={stats.expense} icon={ArrowDownCircle} color="text-rose-600" bg="bg-rose-50" />
        <StatCard title={t('correction')} value={stats.correction} icon={AlertCircle} color="text-orange-600" bg="bg-orange-50" />
        <StatCard title={t('balance')} value={stats.balance} icon={IndianRupee} color="text-blue-600" bg="bg-blue-50" />
        <StatCard title={t('active_members')} value={stats.membersCount} icon={Users} color="text-amber-600" bg="bg-amber-50" isCurrency={false} />
      </div>

      <RemindersWidget />

      <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <h3 className="font-serif text-xl font-bold text-slate-800">{t('recent_transactions')}</h3>
          <div className="flex items-center space-x-3">
              <button 
                onClick={() => {
                  printThermal(`
                    <html>
                      <head>
                        <title>Daily Summary - Thermal</title>
                        <style>
                          @page { margin: 0; }
                          body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                          .center { text-align: center; }
                          .bold { font-weight: bold; }
                          .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                          .flex { display: flex; justify-content: space-between; }
                          .mt-1 { margin-top: 1mm; }
                        </style>
                      </head>
                      <body>
                        <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                        <div class="center">DAILY SUMMARY</div>
                        <div class="center" style="font-size: 8px;">${new Date().toLocaleDateString()}</div>
                        
                        <div class="border-top mt-1">
                          <div class="flex"><span>INCOME:</span> <span class="bold">₹${stats.income.toLocaleString()}</span></div>
                          <div class="flex"><span>EXPENSE:</span> <span class="bold">₹${stats.expense.toLocaleString()}</span></div>
                          <div class="flex"><span>CORR:</span> <span class="bold">${stats.correction >= 0 ? '+' : ''}₹${stats.correction.toLocaleString()}</span></div>
                          <div class="flex mt-1"><span>BALANCE:</span> <span class="bold">₹${stats.balance.toLocaleString()}</span></div>
                        </div>

                        <div class="border-top mt-1">
                          <div class="bold center">RECENT TXS</div>
                          ${recent.map(tx => `
                            <div class="flex mt-1" style="font-size: 8px;">
                              <span>${tx.category.substring(0, 10)}</span>
                              <span>₹${tx.amount}</span>
                            </div>
                          `).join('')}
                        </div>

                        <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                          ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                        </div>
                        <div class="center mt-1" style="font-size: 8px;">
                          Generated on ${settings?.church_name || 'CSI CMS'}
                        </div>
                      </body>
                    </html>
                  `);
                }}
                className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-amber-200 hover:shadow-sm"
                title="Thermal Summary"
              >
              <Printer size={18} className="rotate-180" />
            </button>
            <button className="text-indigo-600 text-sm font-bold hover:text-indigo-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50">{t('reports')}</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px] md:min-w-0">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 md:px-6 py-3 font-semibold">{t('date')}</th>
                <th className="px-4 md:px-6 py-3 font-semibold">{t('category')}</th>
                <th className="px-4 md:px-6 py-3 font-semibold">{t('name')} / {t('vendor')}</th>
                <th className="px-4 md:px-6 py-3 font-semibold">{t('amount')}</th>
                <th className="px-4 md:px-6 py-3 font-semibold">{t('payment_mode')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recent.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 md:px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{tx.date}</td>
                  <td className="px-4 md:px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                  <td className="px-4 md:px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{tx.member_name || tx.vendor_name || '-'}</td>
                  <td className={`px-4 md:px-6 py-4 text-sm font-bold whitespace-nowrap ${tx.type === 'income' ? 'text-indigo-600' : 'text-rose-600'}`}>
                    {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg, isCurrency = true }: any) => (
  <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-sm">
    <div className={`${bg} ${color} p-2 md:p-3 rounded-xl`}>
      <Icon size={20} className="md:w-6 md:h-6" />
    </div>
    <div className="min-w-0">
      <p className="text-xs md:text-sm text-slate-500 font-medium truncate">{title}</p>
      <p className={`text-lg md:text-2xl font-bold text-slate-900 truncate`}>
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
    const tableRows = filtered.map(m => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.member_code}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.phone}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.membership_type}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.joined_date}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Member List - ${settings?.church_name || 'CSI CMS'}</title>
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
        </body>
      </html>
    `);
  };

  const handleWhatsAppShareList = () => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const summary = filtered.map(m => `${m.member_code}: ${m.name} (${m.phone})`).join('\n');
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - Member List Summary*\n\nTotal Members: ${filtered.length}\n\n${summary}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrintMember = (m: Member) => {
    printThermal(`
      <html>
        <head>
          <title>Member Details - ${m.member_code}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
            .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px; max-width: 500px; margin: auto; background: #fff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
            .header { text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #059669; margin: 0; font-size: 24px; }
            .header p { color: #64748b; margin: 5px 0 0; font-size: 14px; }
            .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f8fafc; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: 600; color: #64748b; font-size: 13px; text-transform: uppercase; }
            .value { font-weight: 500; color: #1e293b; }
            .footer { text-align: center; margin-top: 30px; font-style: italic; color: #94a3b8; font-size: 13px; }
            .code-badge { background: #f1f5f9; padding: 4px 12px; border-radius: 9999px; font-family: monospace; font-weight: bold; color: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
              <p>${settings?.address || ''}</p>
              <div style="margin-top: 15px; font-weight: bold; color: #059669; letter-spacing: 1px;">MEMBER IDENTIFICATION</div>
            </div>
            
            <div class="info-row">
              <span class="label">Member Code</span>
              <span class="code-badge">${m.member_code}</span>
            </div>
            <div class="info-row">
              <span class="label">Full Name</span>
              <span class="value">${m.name}</span>
            </div>
            ${m.tamil_name ? `
            <div class="info-row">
              <span class="label">Tamil Name</span>
              <span class="value">${m.tamil_name}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">Phone Number</span>
              <span class="value">${m.phone}</span>
            </div>
            <div class="info-row">
              <span class="label">Membership Type</span>
              <span class="value" style="text-transform: capitalize;">${m.membership_type}</span>
            </div>
            <div class="info-row">
              <span class="label">Joined Date</span>
              <span class="value">${m.joined_date}</span>
            </div>
            
            <div class="footer">
              <p>${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
              <p style="margin-top: 15px; font-size: 11px;">Generated on ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const handleWhatsAppShareMember = (m: Member) => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - Member Details*\n\nCode: ${m.member_code}\nName: ${m.name}\nPhone: ${m.phone}\nType: ${m.membership_type}\nJoined: ${m.joined_date}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder={t('search')}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                printThermal(`
                  <html>
                    <head>
                      <title>Member List - Thermal</title>
                      <style>
                        @page { margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                        .flex { display: flex; justify-content: space-between; }
                        .mt-1 { margin-top: 1mm; }
                      </style>
                    </head>
                    <body>
                      <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                      <div class="center">MEMBER LIST</div>
                      <div class="center" style="font-size: 8px;">${new Date().toLocaleDateString()}</div>
                      
                      <div class="border-top mt-1">
                        ${filtered.map(m => `
                          <div class="flex mt-1" style="font-size: 8px;">
                            <span>${m.member_code}</span>
                            <span>${m.name.substring(0, 15)}</span>
                          </div>
                        `).join('')}
                      </div>

                      <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                        ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                      </div>
                      <div class="border-top center mt-1" style="font-size: 8px;">
                        Total: ${filtered.length}
                      </div>
                    </body>
                  </html>
                `);
              }}
              className="flex-1 sm:flex-none p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors border border-orange-200 flex items-center justify-center"
              title="Thermal Print List"
            >
              <Printer size={20} className="rotate-180" />
            </button>
            <button 
              onClick={handlePrintList}
              className="flex-1 sm:flex-none p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-slate-200 flex items-center justify-center"
              title="Print List"
            >
              <Printer size={20} />
              <span className="sm:hidden ml-2 font-medium">Print</span>
            </button>
            <button 
              onClick={handleWhatsAppShareList}
              className="flex-1 sm:flex-none p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-slate-200 flex items-center justify-center"
              title="Share List via WhatsApp"
            >
              <Share2 size={20} />
              <span className="sm:hidden ml-2 font-medium">Share</span>
            </button>
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingMember(null);
            setShowModal(true);
          }}
          className="w-full md:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus size={20} />
          <span>{t('add_member')}</span>
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                    {t(m.membership_type as any)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{m.joined_date}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        printThermal(`
                          <html>
                            <head>
                              <title>Member Slip - ${m.member_code}</title>
                              <style>
                                @page { margin: 0; }
                                body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                                .center { text-align: center; }
                                .bold { font-weight: bold; }
                                .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                                .large { font-size: 14px; }
                                .mt-1 { margin-top: 1mm; }
                              </style>
                            </head>
                            <body>
                              <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                              <div class="center" style="font-size: 8px;">MEMBER SLIP</div>
                              
                              <div class="border-top mt-1 center">
                                <div class="large bold">${m.member_code}</div>
                                <div class="bold">${m.name}</div>
                                <div style="font-size: 8px;">${m.tamil_name || ''}</div>
                              </div>

                              <div class="mt-1" style="font-size: 8px;">
                                <div>Phone: ${m.phone}</div>
                                <div>Type: ${m.membership_type}</div>
                                <div>Joined: ${m.joined_date}</div>
                              </div>

                              <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                                ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                              </div>
                              <div class="border-top center mt-1" style="font-size: 8px;">
                                Generated on ${settings?.church_name || 'CSI CMS'}
                              </div>
                            </body>
                          </html>
                        `);
                      }}
                      className="text-slate-400 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50"
                      title="Thermal Print Slip"
                    >
                      <Printer size={18} className="rotate-180" />
                    </button>
                    <button 
                      onClick={() => handlePrintMember(m)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-indigo-50"
                      title="Print Details"
                    >
                      <Printer size={18} />
                    </button>
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
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md hover:bg-rose-50"
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filtered.map((m) => (
          <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-mono text-slate-400 mb-1">{m.member_code}</div>
                <div className="text-base font-bold text-slate-900">{m.name}</div>
                <div className="text-xs text-slate-500">{m.tamil_name}</div>
              </div>
              <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-blue-50 text-blue-600 uppercase">
                {t(m.membership_type as any)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="text-sm text-slate-600 font-medium">{m.phone}</div>
              <div className="flex items-center space-x-3">
                <button onClick={() => handlePrintMember(m)} className="p-2 text-slate-600 bg-slate-50 rounded-lg">
                  <Printer size={18} />
                </button>
                <button onClick={() => handleWhatsAppShareMember(m)} className="p-2 text-indigo-600 bg-indigo-50 rounded-lg">
                  <Share2 size={18} />
                </button>
                <button onClick={() => { setEditingMember(m); setShowModal(true); }} className="p-2 text-slate-600 bg-slate-50 rounded-lg">
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm(t('confirm_delete_member'))) {
                      try {
                        const res = await safeFetch(`/api/members/${m.id}`, { method: 'DELETE' });
                        if (res.success) fetchMembers();
                      } catch (err) {
                        console.error(err);
                      }
                    }
                  }}
                  className="p-2 text-rose-600 bg-rose-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
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
    joined_date: member?.joined_date || new Date().toISOString().split('T')[0],
    dob: member?.dob || '',
    marital_status: member?.marital_status || 'unmarried',
    anniversary_date: member?.anniversary_date || '',
    spouse_name: member?.spouse_name || ''
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
            <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('tamil_name')}</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.tamil_name} onChange={e => setFormData({...formData, tamil_name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('phone')}</label>
            <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('email')}</label>
            <input type="email" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" rows={2} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="col-span-2 space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('family_details')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" rows={2} value={formData.family_details} onChange={e => setFormData({...formData, family_details: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('membership_type')}</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.membership_type} onChange={e => setFormData({...formData, membership_type: e.target.value})}>
              <option value="regular">{t('regular')}</option>
              <option value="visitor">{t('visitor')}</option>
              <option value="life">{t('life')}</option>
              <option value="pastor_family">{t('pastor_family')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('joined_date')}</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.joined_date} onChange={e => setFormData({...formData, joined_date: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('dob')}</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('marital_status')}</label>
            <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.marital_status} onChange={e => setFormData({...formData, marital_status: e.target.value})}>
              <option value="unmarried">{t('unmarried')}</option>
              <option value="married">{t('married')}</option>
            </select>
          </div>
          {formData.marital_status === 'married' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('anniversary_date')}</label>
                <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.anniversary_date} onChange={e => setFormData({...formData, anniversary_date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('spouse_name')}</label>
                <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.spouse_name} onChange={e => setFormData({...formData, spouse_name: e.target.value})} />
              </div>
            </>
          )}
          <div className="col-span-2 flex justify-end space-x-3 mt-4">
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

const CorrectionModal = ({ 
  isOpen, 
  onClose, 
  transaction, 
  onSuccess,
  nextCorrectionNo
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  transaction: Transaction | null; 
  onSuccess: () => void;
  nextCorrectionNo: string;
}) => {
  const { t } = useLanguage();
  const { user } = useContext(AuthContext);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await safeFetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correction_no: nextCorrectionNo,
          ref_invoice_no: transaction.invoice_no,
          type: transaction.type,
          amount: parseFloat(amount),
          reason,
          created_by: user?.name || user?.username || 'Admin'
        })
      });
      onSuccess();
      onClose();
      setAmount('');
      setReason('');
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Error creating correction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800 flex items-center space-x-2">
                <AlertCircle className="text-orange-500" size={24} />
                <span>{t('correction_entry')}</span>
              </h3>
              <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('ref_invoice_no')}</label>
                <input
                  type="text"
                  value={transaction.invoice_no}
                  disabled
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('correction_amount')} (+/-)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. -500 or 200"
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
                <p className="mt-1 text-xs text-slate-500">Use negative sign (-) for deduction, positive for addition.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('reason')}</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Reason for correction..."
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
                >
                  {loading ? t('saving') : t('save_correction')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const TransactionsPage = ({ type }: { type: 'income' | 'expense' }) => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const { user } = useContext(AuthContext);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [viewingTx, setViewingTx] = useState<Transaction | null>(null);
  const [selectedTxForCorrection, setSelectedTxForCorrection] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const categories = useMemo(() => {
    return Array.from(new Set(txs.map(tx => tx.category)));
  }, [txs]);

  const filteredTxs = useMemo(() => {
    return txs.filter(tx => {
      const matchesSearch = 
        tx.invoice_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.member_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.vendor_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [txs, searchTerm, filterCategory]);

  const totalAmount = useMemo(() => {
    return filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTxs]);

  const handleRenumber = async () => {
    if (!window.confirm("This will re-sequence all invoice numbers for this church starting from 1 based on creation date. This cannot be undone. Are you sure?")) return;
    try {
      const res = await safeFetch('/api/transactions/renumber', { method: 'POST' });
      if (res.success) {
        alert("Invoices renumbered successfully!");
        fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to renumber invoices");
    }
  };

  const nextCorrectionNo = useMemo(() => {
    const lastNo = corrections.reduce((max, curr) => {
      const parts = curr.correction_no.split('-');
      const num = parseInt(parts[parts.length - 1]);
      return isNaN(num) ? max : (num > max ? num : max);
    }, 0);
    return `CORR-${String(lastNo + 1).padStart(2, '0')}`;
  }, [corrections]);

  const fetchData = async () => {
    try {
      const [txData, corrData] = await Promise.all([
        safeFetch('/api/transactions'),
        safeFetch('/api/corrections')
      ]);
      if (Array.isArray(txData)) {
        setTxs(txData.filter((tx: any) => tx.type === type));
      }
      if (Array.isArray(corrData)) {
        setCorrections(corrData.filter((c: any) => c.type === type));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const handlePrintList = () => {
    const tableRows = filteredTxs.map(tx => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.invoice_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.member_name || tx.vendor_name || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">₹${tx.amount.toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.payment_mode}</td>
      </tr>
    `).join('');

    const total = totalAmount;

    printThermal(`
      <html>
        <head>
          <title>${type === 'income' ? 'Income' : 'Expense'} List - ${settings?.church_name || 'CSI CMS'}</title>
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
        </body>
      </html>
    `);
  };

  const handleThermalPrintCorrection = (corr: Correction) => {
    printThermal(`
      <html>
        <head>
          <title>Thermal Correction - ${corr.correction_no}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 48mm; 
              margin: 0; 
              padding: 2mm; 
              font-size: 10px;
              line-height: 1.2;
              color: #000;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
            .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 2mm; padding-bottom: 2mm; }
            .flex { display: flex; justify-content: space-between; }
            .large { font-size: 14px; }
            .mt-1 { margin-top: 1mm; }
            .mb-1 { margin-bottom: 1mm; }
          </style>
        </head>
        <body>
          <div class="center bold large">${settings?.church_name || 'CSI CHURCH'}</div>
          <div class="center mt-1">${settings?.church_name_tamil || ''}</div>
          
          <div class="border-top mb-1">
            <div class="center bold">CORRECTION BILL</div>
            <div class="flex"><span>NO:</span> <span class="bold">${corr.correction_no}</span></div>
            <div class="flex"><span>REF:</span> <span>${corr.ref_invoice_no}</span></div>
            <div class="flex"><span>DATE:</span> <span>${new Date(corr.created_at).toLocaleDateString()}</span></div>
          </div>

          <div class="border-top border-bottom">
            <div class="bold">REASON:</div>
            <div class="mt-1">${corr.reason}</div>
            <div class="flex mt-1"><span>TYPE:</span> <span>${corr.type.toUpperCase()}</span></div>
          </div>

          <div class="flex large bold mt-1">
            <span>CORR AMT:</span>
            <span>${corr.amount >= 0 ? '+' : ''}₹${corr.amount.toLocaleString()}</span>
          </div>

          <div class="border-top center" style="font-size: 8px; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
          
          <div class="center mt-1" style="font-size: 8px;">
            *** THANK YOU ***
          </div>
        </body>
      </html>
    `);
  };

  const handleWhatsAppShareCorrection = (corr: Correction) => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - CORRECTION BILL*\n\nCorrection No: ${corr.correction_no}\nRef Invoice: ${corr.ref_invoice_no}\nDate: ${new Date(corr.created_at).toLocaleString()}\nType: ${corr.type.toUpperCase()}\nCorrection Amount: ${corr.amount >= 0 ? '+' : ''}₹${corr.amount.toLocaleString()}\nReason: ${corr.reason}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrintCorrection = (corr: Correction) => {
    printThermal(`
      <html>
        <head>
          <title>Correction Invoice - ${corr.correction_no}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .details { margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total { font-size: 20px; font-weight: bold; margin-top: 20px; text-align: right; }
            .signature { margin-top: 60px; display: flex; justify-content: flex-end; }
            .sig-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin-bottom: 5px;">${settings?.church_name || 'C.S.I W.J HATCH MEMORIAL CHURCH'}</h1>
            <h2 style="margin-top: 0; font-size: 18px; color: #444;">${settings?.church_name_tamil || ''}</h2>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">${settings?.address || ''}</p>
            <hr style="border: 0; border-top: 2px solid #f59e0b; margin: 20px 0;">
            <p style="font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Correction Invoice</p>
          </div>
          <div class="details">
            <div class="row"><span>Correction No:</span> <span style="font-weight: bold;">${corr.correction_no}</span></div>
            <div class="row"><span>Ref. Invoice No:</span> <span>${corr.ref_invoice_no}</span></div>
            <div class="row"><span>Type:</span> <span>${corr.type.toUpperCase()}</span></div>
            <div class="row"><span>Date & Time:</span> <span>${new Date(corr.created_at).toLocaleString()}</span></div>
            <div class="row"><span>Reason:</span> <span>${corr.reason}</span></div>
          </div>
          <div class="total">Correction Amount: ₹${corr.amount.toLocaleString()}</div>
          
          <div class="signature">
            <div class="sig-box">Authorized Signature</div>
          </div>

          <div style="margin-top: 40px; text-align: center; border-top: 1px dashed #ccc; padding-top: 20px;">
            <p style="font-style: italic; color: #444; font-size: 14px; font-weight: 500;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
        </body>
      </html>
    `);
  };

  const handleWhatsAppShareList = () => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const total = txs.reduce((sum, tx) => sum + tx.amount, 0);
    const summary = txs.map(tx => `${tx.date}: ${tx.invoice_no} - ₹${tx.amount}`).join('\n');
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - ${type === 'income' ? 'Income' : 'Expense'} List Summary*\n\nTotal Count: ${txs.length}\nTotal Amount: ₹${total.toLocaleString()}\n\n${summary}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="p-4 md:p-8 space-y-6 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{type === 'income' ? t('income') : t('expenses')}</h3>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => {
                const total = filteredTxs.reduce((sum, tx) => sum + tx.amount, 0);
                printThermal(`
                  <html>
                    <head>
                      <title>${type.toUpperCase()} List - Thermal</title>
                      <style>
                        @page { margin: 0; }
                        body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                        .center { text-align: center; }
                        .bold { font-weight: bold; }
                        .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                        .flex { display: flex; justify-content: space-between; }
                        .mt-1 { margin-top: 1mm; }
                      </style>
                    </head>
                    <body>
                      <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                      <div class="center">${type.toUpperCase()} LIST</div>
                      <div class="center" style="font-size: 8px;">${new Date().toLocaleDateString()}</div>
                      
                      <div class="border-top mt-1">
                        ${filteredTxs.map(tx => `
                          <div class="flex mt-1" style="font-size: 8px;">
                            <span>${tx.invoice_no}</span>
                            <span>₹${tx.amount}</span>
                          </div>
                        `).join('')}
                      </div>

                      <div class="border-top mt-1">
                        <div class="flex bold"><span>TOTAL:</span> <span>₹${total.toLocaleString()}</span></div>
                      </div>
                      <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                        ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                      </div>
                    </body>
                  </html>
                `);
              }}
              className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors border border-orange-200"
              title="Thermal Print List"
            >
              <Printer size={20} className="rotate-180" />
            </button>
            <button 
              onClick={handlePrintList}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
              title="Print List"
            >
              <Printer size={20} />
            </button>
            <button 
              onClick={handleWhatsAppShareList}
              className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-slate-200"
              title="Share List via WhatsApp"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleRenumber}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
            title="Fix invoice numbering gaps"
          >
            <Hash size={18} />
            <span className="hidden sm:inline">Fix Numbering</span>
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className={`hidden md:flex px-6 py-2.5 rounded-xl font-bold items-center space-x-2 text-white transition-all shadow-lg ${type === 'income' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
          >
            <Plus size={20} />
            <span>{type === 'income' ? t('add_income') : t('add_expense')}</span>
          </button>
        </div>
      </div>

      {/* Summary and Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`md:col-span-1 p-4 rounded-2xl border flex flex-col justify-center ${type === 'income' ? 'bg-indigo-50 border-indigo-100' : 'bg-rose-50 border-rose-100'}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t('total_amount')}</span>
          <span className={`text-2xl font-black ${type === 'income' ? 'text-indigo-600' : 'text-rose-600'}`}>₹{totalAmount.toLocaleString()}</span>
        </div>
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search invoice, name, category..."
            className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="md:col-span-1">
          <select 
            className="w-full p-4 rounded-2xl bg-white border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium appearance-none"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{t(cat as any) || cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">{t('invoice_no')}</th>
              <th className="px-6 py-4">{t('date')}</th>
              <th className="px-6 py-4">{t('category')}</th>
              <th className="px-6 py-4">{type === 'income' ? t('name') : t('vendor')}</th>
              <th className="px-6 py-4">{t('amount')}</th>
              <th className="px-6 py-4">{t('payment_mode')}</th>
              <th className="px-6 py-4">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTxs.map((tx) => (
              <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${tx.correction_count > 0 ? 'bg-orange-50/30' : ''}`}>
                <td className="px-6 py-4 text-sm font-mono text-slate-500">
                  <div className="flex items-center space-x-2">
                    <span>{tx.invoice_no}</span>
                    {tx.correction_count > 0 && (
                      <div className="flex flex-col">
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider w-fit">
                          {t('corrected')}
                        </span>
                        {corrections.filter(c => c.ref_invoice_no === tx.invoice_no).map(c => (
                          <span key={c.id} className="text-[9px] text-orange-600 font-mono mt-0.5">{c.correction_no}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.member_name || tx.vendor_name || '-'}</td>
                <td className={`px-6 py-4 text-sm font-bold ${type === 'income' ? 'text-indigo-600' : 'text-rose-600'}`}>
                  ₹{tx.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setViewingTx(tx)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-indigo-50"
                      title={t('view')}
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
                        const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - ${tx.type === 'income' ? 'Receipt' : 'Expense Voucher'}*\n\nInvoice No: ${tx.invoice_no}\nDate: ${tx.date}\nCategory: ${tx.category.toUpperCase()}\n${tx.type === 'income' ? 'Member' : 'Vendor'}: ${tx.member_name || tx.vendor_name || '-'}\nAmount: ₹${tx.amount.toLocaleString()}\nPayment Mode: ${tx.payment_mode.toUpperCase()}\n\n_${verse}_`);
                        window.open(`https://wa.me/?text=${text}`, '_blank');
                      }}
                      className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-indigo-50"
                      title="Share via WhatsApp"
                    >
                      <Share2 size={18} />
                    </button>
                    {/* Correction Button - Only for Admin */}
                    {['super_admin', 'pastor', 'accountant'].includes(user?.role || '') && (
                      <button 
                        onClick={() => {
                          setSelectedTxForCorrection(tx);
                          setShowCorrectionModal(true);
                        }}
                        className="text-slate-400 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50"
                        title={t('correction')}
                      >
                        <AlertCircle size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        printThermal(`
                          <html>
                            <head>
                              <title>Thermal Receipt - ${tx.invoice_no}</title>
                              <style>
                                @page { margin: 0; }
                                body { 
                                  font-family: 'Courier New', Courier, monospace; 
                                  width: 48mm; 
                                  margin: 0; 
                                  padding: 2mm; 
                                  font-size: 10px;
                                  line-height: 1.2;
                                  color: #000;
                                }
                                .center { text-align: center; }
                                .bold { font-weight: bold; }
                                .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                                .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 2mm; padding-bottom: 2mm; }
                                .flex { display: flex; justify-content: space-between; }
                                .large { font-size: 14px; }
                                .mt-1 { margin-top: 1mm; }
                                .mb-1 { margin-bottom: 1mm; }
                              </style>
                            </head>
                            <body>
                              <div class="center bold large">${settings?.church_name || 'CSI CHURCH'}</div>
                              <div class="center mt-1">${settings?.church_name_tamil || ''}</div>
                              <div class="center" style="font-size: 8px;">${settings?.address || ''}</div>
                              
                              <div class="border-top mb-1">
                                <div class="flex"><span>NO:</span> <span class="bold">${tx.invoice_no}</span></div>
                                <div class="flex"><span>DATE:</span> <span>${tx.date}</span></div>
                              </div>

                              <div class="border-top border-bottom">
                                <div class="bold">${tx.category.toUpperCase()}</div>
                                <div class="mt-1">${tx.member_name || tx.vendor_name || '-'}</div>
                                <div class="flex mt-1"><span>MODE:</span> <span>${tx.payment_mode.toUpperCase()}</span></div>
                              </div>

                              <div class="flex large bold mt-1">
                                <span>TOTAL:</span>
                                <span>₹${tx.amount.toLocaleString()}</span>
                              </div>

                              <div class="border-top center" style="font-size: 8px; font-style: italic;">
                                ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                              </div>
                              
                              <div class="center mt-1" style="font-size: 8px;">
                                *** THANK YOU ***
                              </div>
                            </body>
                          </html>
                        `);
                      }}
                      className="text-slate-400 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50"
                      title="Thermal Print (48mm/58mm)"
                    >
                      <Printer size={18} className="rotate-180" />
                    </button>
                    <button 
                      onClick={() => {
                        printThermal(`
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
                            </body>
                          </html>
                        `);
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {filteredTxs.map((tx) => (
          <div key={tx.id} className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 ${tx.correction_count > 0 ? 'bg-orange-50/30' : ''}`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <div className="text-xs font-mono text-slate-400">{tx.invoice_no}</div>
                  {tx.correction_count > 0 && (
                    <div className="flex flex-col items-start">
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                        {t('corrected')}
                      </span>
                      {corrections.filter(c => c.ref_invoice_no === tx.invoice_no).map(c => (
                        <span key={c.id} className="text-[9px] text-orange-600 font-mono mt-0.5">{c.correction_no}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-base font-bold text-slate-900 capitalize">{t(tx.category as any) || tx.category}</div>
                <div className="text-xs text-slate-500">{tx.member_name || tx.vendor_name || '-'}</div>
              </div>
              <div className={`text-lg font-bold ${type === 'income' ? 'text-indigo-600' : 'text-rose-600'}`}>
                ₹{tx.amount.toLocaleString()}
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
              <div className="text-xs text-slate-500 font-medium">{tx.date} • {tx.payment_mode.toUpperCase()}</div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setViewingTx(tx)}
                  className="p-2 text-indigo-600 bg-indigo-50 rounded-lg"
                >
                  <Eye size={18} />
                </button>
                <button 
                  onClick={() => {
                    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
                    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - ${tx.type === 'income' ? 'Receipt' : 'Expense Voucher'}*\n\nInvoice No: ${tx.invoice_no}\nDate: ${tx.date}\nCategory: ${tx.category.toUpperCase()}\n${tx.type === 'income' ? 'Member' : 'Vendor'}: ${tx.member_name || tx.vendor_name || '-'}\nAmount: ₹${tx.amount.toLocaleString()}\nPayment Mode: ${tx.payment_mode.toUpperCase()}\n\n_${verse}_`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"
                >
                  <Share2 size={18} />
                </button>
                {/* Correction Button - Only for Admin */}
                {['super_admin', 'pastor', 'accountant'].includes(user?.role || '') && (
                  <button 
                    onClick={() => {
                      setSelectedTxForCorrection(tx);
                      setShowCorrectionModal(true);
                    }}
                    className="p-2 text-orange-600 bg-orange-50 rounded-lg"
                  >
                    <AlertCircle size={18} />
                  </button>
                )}
                <button 
                  onClick={() => {
                    printThermal(`
                      <html>
                        <head>
                          <title>Thermal Receipt - ${tx.invoice_no}</title>
                          <style>
                            @page { margin: 0; }
                            body { 
                              font-family: 'Courier New', Courier, monospace; 
                              width: 48mm; 
                              margin: 0; 
                              padding: 2mm; 
                              font-size: 10px;
                              line-height: 1.2;
                              color: #000;
                            }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                            .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 2mm; padding-bottom: 2mm; }
                            .flex { display: flex; justify-content: space-between; }
                            .large { font-size: 14px; }
                            .mt-1 { margin-top: 1mm; }
                            .mb-1 { margin-bottom: 1mm; }
                          </style>
                        </head>
                        <body>
                          <div class="center bold large">${settings?.church_name || 'CSI CHURCH'}</div>
                          <div class="center mt-1">${settings?.church_name_tamil || ''}</div>
                          <div class="center" style="font-size: 8px;">${settings?.address || ''}</div>
                          
                          <div class="border-top mb-1">
                            <div class="flex"><span>NO:</span> <span class="bold">${tx.invoice_no}</span></div>
                            <div class="flex"><span>DATE:</span> <span>${tx.date}</span></div>
                          </div>

                          <div class="border-top border-bottom">
                            <div class="bold">${tx.category.toUpperCase()}</div>
                            <div class="mt-1">${tx.member_name || tx.vendor_name || '-'}</div>
                            <div class="flex mt-1"><span>MODE:</span> <span>${tx.payment_mode.toUpperCase()}</span></div>
                          </div>

                          <div class="flex large bold mt-1">
                            <span>TOTAL:</span>
                            <span>₹${tx.amount.toLocaleString()}</span>
                          </div>

                          <div class="border-top center" style="font-size: 8px; font-style: italic;">
                            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                          </div>
                          
                          <div class="center mt-1" style="font-size: 8px;">
                            *** THANK YOU ***
                          </div>
                        </body>
                      </html>
                    `);
                  }}
                  className="p-2 text-orange-600 bg-orange-50 rounded-lg"
                  title="Thermal Print"
                >
                  <Printer size={18} className="rotate-180" />
                </button>
                <button 
                  onClick={() => {
                    printThermal(`
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
                        </body>
                      </html>
                    `);
                  }}
                  className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"
                >
                  <Printer size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Corrections Table */}
      {corrections.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <AlertCircle className="text-orange-500" size={20} />
            <span>{t('correction_entry')}</span>
          </h3>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-orange-50 text-orange-700 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{t('correction_no')}</th>
                    <th className="px-6 py-3 font-semibold">{t('ref_invoice_no')}</th>
                    <th className="px-6 py-3 font-semibold">{t('date')}</th>
                    <th className="px-6 py-3 font-semibold">{t('amount')}</th>
                    <th className="px-6 py-3 font-semibold">{t('reason')}</th>
                    <th className="px-6 py-3 font-semibold">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {corrections.map((corr) => (
                    <tr key={corr.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-bold text-orange-600">{corr.correction_no}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{corr.ref_invoice_no}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{new Date(corr.created_at).toLocaleString()}</td>
                      <td className={`px-6 py-4 text-sm font-bold ${corr.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {corr.amount >= 0 ? '+' : ''}₹{corr.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{corr.reason}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleWhatsAppShareCorrection(corr)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded-md hover:bg-indigo-50"
                            title="Share via WhatsApp"
                          >
                            <Share2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleThermalPrintCorrection(corr)}
                            className="text-slate-400 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50"
                            title="Thermal Print (48mm/58mm)"
                          >
                            <Printer size={18} className="rotate-180" />
                          </button>
                          <button 
                            onClick={() => handlePrintCorrection(corr)}
                            className="text-slate-400 hover:text-orange-600 transition-colors p-1 rounded-md hover:bg-orange-50"
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
          </div>
        </div>
      )}

      {showModal && <TransactionModal 
        type={type} 
        initialData={editingTx}
        onClose={() => {
          setShowModal(false);
          setEditingTx(null);
        }} 
        onSave={fetchData} 
      />}

      {viewingTx && <TransactionModal 
        type={type} 
        initialData={viewingTx}
        readOnly={true}
        onClose={() => setViewingTx(null)} 
      />}

      <CorrectionModal
        isOpen={showCorrectionModal}
        onClose={() => { setShowCorrectionModal(false); setSelectedTxForCorrection(null); }}
        transaction={selectedTxForCorrection}
        onSuccess={fetchData}
        nextCorrectionNo={nextCorrectionNo}
      />

      {/* Mobile Floating Action Button */}
      <button 
        onClick={() => setShowModal(true)}
        className={`fixed bottom-24 right-6 md:hidden w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl z-40 animate-bounce-slow ${type === 'income' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-rose-600 shadow-rose-200'}`}
      >
        <Plus size={28} />
      </button>
    </div>
  );
};

const TransactionModal = ({ type, onClose, onSave, initialData, readOnly = false }: any) => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
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
    invoice_no: initialData?.invoice_no || '',
    invoice_seq: initialData?.invoice_seq || '',
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
    if (readOnly) return;
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
        if (isSupabaseConfigured) {
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
        }
      } catch (supabaseErr) {
        console.error('Failed to sync to Supabase:', supabaseErr);
      }

      onSave();
      return response;
    } catch (err) {
      console.error(err);
      alert('Failed to save transaction');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    const memberName = members.find(m => m.id === formData.member_id)?.name || formData.vendor_name || '-';
    printThermal(`
      <html>
        <head>
          <title>Transaction Receipt - ${formData.invoice_no}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: #333; }
            .receipt { border: 2px solid #f1f5f9; border-radius: 16px; padding: 40px; max-width: 700px; margin: auto; background: #fff; }
            .header { text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 30px; margin-bottom: 30px; }
            .header h1 { color: #4f46e5; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { color: #64748b; margin: 8px 0 0; font-size: 15px; }
            .receipt-info { display: flex; justify-content: space-between; margin-bottom: 40px; font-size: 14px; color: #64748b; }
            .info-group h4 { margin: 0 0 5px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; color: #94a3b8; }
            .info-group p { margin: 0; font-weight: 600; color: #1e293b; font-size: 16px; }
            .details-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .details-table th { text-align: left; padding: 12px; border-bottom: 2px solid #f1f5f9; color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            .details-table td { padding: 20px 12px; border-bottom: 1px solid #f8fafc; font-size: 15px; }
            .amount-section { display: flex; justify-content: flex-end; }
            .amount-box { background: #f8fafc; padding: 20px 30px; border-radius: 12px; text-align: right; min-width: 200px; }
            .amount-label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
            .amount-value { font-size: 28px; font-weight: 800; color: #1e293b; }
            .footer { text-align: center; margin-top: 50px; padding-top: 30px; border-top: 2px solid #f1f5f9; }
            .verse { font-style: italic; color: #64748b; font-size: 15px; margin-bottom: 15px; }
            .thank-you { font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
              <p>${settings?.address || ''}</p>
              <div style="margin-top: 20px; display: inline-block; padding: 6px 16px; background: #eef2ff; color: #4f46e5; border-radius: 20px; font-weight: 700; font-size: 12px; text-transform: uppercase;">
                ${type === 'income' ? 'Income Receipt' : 'Expense Voucher'}
              </div>
            </div>

            <div class="receipt-info">
              <div class="info-group">
                <h4>Invoice Number</h4>
                <p>${formData.invoice_no}</p>
              </div>
              <div class="info-group" style="text-align: right;">
                <h4>Date</h4>
                <p>${new Date(formData.date).toLocaleDateString()}</p>
              </div>
            </div>

            <table class="details-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Payment Mode</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px; text-transform: capitalize;">${formData.category.replace('_', ' ')}</div>
                    <div style="font-size: 13px; color: #64748b;">${type === 'income' ? 'Received from' : 'Paid to'}: ${memberName}</div>
                    ${formData.notes ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 8px; font-style: italic;">Note: ${formData.notes}</div>` : ''}
                  </td>
                  <td style="text-align: right; font-weight: 600; text-transform: uppercase; font-size: 13px;">${formData.payment_mode}</td>
                </tr>
              </tbody>
            </table>

            <div class="amount-section">
              <div class="amount-box">
                <div class="amount-label">Total Amount</div>
                <div class="amount-value">₹${Number(formData.amount).toLocaleString()}</div>
              </div>
            </div>

            <div class="footer">
              <p class="verse">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
              <p class="thank-you">*** God Bless You ***</p>
              <p style="margin-top: 20px; font-size: 10px; color: #cbd5e1;">Computer generated document. No signature required.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const handleSaveAndPrint = async () => {
    try {
      const tx = await handleSubmit({ preventDefault: () => {} } as any);
      if (tx) {
        printThermal(`
          <html>
            <head>
              <title>Thermal Receipt - ${tx.invoice_no}</title>
              <style>
                @page { margin: 0; }
                body { 
                  font-family: 'Courier New', Courier, monospace; 
                  width: 48mm; 
                  margin: 0; 
                  padding: 2mm; 
                  font-size: 10px;
                  line-height: 1.2;
                  color: #000;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                .border-bottom { border-bottom: 1px dashed #000; margin-bottom: 2mm; padding-bottom: 2mm; }
                .flex { display: flex; justify-content: space-between; }
                .large { font-size: 14px; }
                .mt-1 { margin-top: 1mm; }
                .mb-1 { margin-bottom: 1mm; }
              </style>
            </head>
            <body>
              <div class="center bold large">${settings?.church_name || 'CSI CHURCH'}</div>
              <div class="center mt-1">${settings?.church_name_tamil || ''}</div>
              
              <div class="border-top mb-1">
                <div class="flex"><span>NO:</span> <span class="bold">${tx.invoice_no}</span></div>
                <div class="flex"><span>DATE:</span> <span>${tx.date}</span></div>
              </div>

              <div class="border-top border-bottom">
                <div class="bold">${(formData.category === 'other' ? customCategory : formData.category).toUpperCase()}</div>
                <div class="mt-1">${members.find(m => m.id === formData.member_id)?.name || formData.vendor_name || '-'}</div>
                <div class="flex mt-1"><span>MODE:</span> <span>${formData.payment_mode.toUpperCase()}</span></div>
              </div>

              <div class="flex large bold mt-1">
                <span>TOTAL:</span>
                <span>₹${Number(formData.amount).toLocaleString()}</span>
              </div>

              <div class="border-top center" style="font-size: 8px; font-style: italic;">
                ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
              </div>
              
              <div class="center mt-1" style="font-size: 8px;">
                *** THANK YOU ***
              </div>
            </body>
          </html>
        `);
      }
    } catch (err) {
      // Error already handled in handleSubmit
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl"
      >
        <div className={`p-6 border-b border-slate-200 flex justify-between items-center ${type === 'income' ? 'bg-indigo-50' : 'bg-rose-50'}`}>
          <h3 className="text-lg font-bold text-slate-800">
            {readOnly ? (type === 'income' ? 'View Income' : 'View Expense') : (initialData ? (type === 'income' ? 'Edit Income' : 'Edit Expense') : (type === 'income' ? t('add_income') : t('add_expense')))}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <fieldset disabled={readOnly} className="space-y-4 contents">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Invoice Number</label>
                <div className="flex items-center space-x-2">
                  <input 
                    type="text" 
                    className="bg-transparent font-bold text-indigo-600 outline-none w-24"
                    value={formData.invoice_no} 
                    onChange={e => setFormData({...formData, invoice_no: e.target.value})}
                    placeholder="Auto"
                    readOnly={!initialData && !readOnly}
                  />
                  {!initialData && !readOnly && <span className="text-[10px] text-slate-400 italic">(Auto-generated on save)</span>}
                </div>
              </div>
              <div className="text-right">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</label>
                <div className={`text-xs font-bold px-2 py-1 rounded ${type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {type.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('category')}</label>
                <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
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
                <input required type="number" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
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
                  <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sub. End Date</label>
                  <input required type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
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
                <input required className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('date')}</label>
                <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('payment_mode')}</label>
                <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.payment_mode} onChange={e => setFormData({...formData, payment_mode: e.target.value})}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI / GPay</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">{t('notes')}</label>
                <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" rows={1} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
            </div>
          </fieldset>

          <div className="flex justify-end space-x-3 mt-6">
            {readOnly && (
              <button 
                type="button" 
                onClick={handlePrintReceipt}
                className="flex-1 py-3 rounded-xl font-bold text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center space-x-2"
              >
                <Printer size={20} />
                <span>Print Receipt</span>
              </button>
            )}
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-slate-600 border-2 border-slate-200 hover:bg-slate-50 transition-all"
            >
              {readOnly ? t('close') : t('cancel')}
            </button>
            {!readOnly && (
              <>
                <button 
                  type="button" 
                  onClick={handleSaveAndPrint}
                  disabled={loading}
                  className="flex-1 py-3 rounded-xl font-bold text-orange-600 border-2 border-orange-600 hover:bg-orange-50 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  <Printer size={20} className="rotate-180" />
                  <span>{loading ? '...' : 'Save & Thermal Print'}</span>
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg disabled:opacity-50 ${type === 'income' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'}`}
                >
                  {loading ? t('saving') : t('save')}
                </button>
              </>
            )}
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

  const handlePrintReceipt = (sub: Subscription) => {
    printThermal(`
      <html>
        <head>
          <title>Receipt - ${sub.id}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; }
            .receipt-box { border: 2px solid #eee; padding: 30px; max-width: 600px; margin: auto; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 10px; }
            .footer { text-align: center; margin-top: 30px; font-style: italic; color: #666; }
            .amount { font-size: 24px; font-weight: bold; color: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="receipt-box">
            <div class="header">
              <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
              <p>${settings?.address || ''}</p>
              <h2>SUBSCRIPTION RECEIPT</h2>
            </div>
            <div class="row"><span>Receipt No:</span> <span>#SUB-${sub.id}</span></div>
            <div class="row"><span>Date:</span> <span>${new Date().toLocaleDateString()}</span></div>
            <div class="row"><span>Member Name:</span> <span>${sub.member_name}</span></div>
            <div class="row"><span>Period:</span> <span>${sub.start_date} to ${sub.end_date}</span></div>
            <div class="row"><span>Status:</span> <span style="text-transform: uppercase;">${sub.status}</span></div>
            <div class="row" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
              <span class="amount">Total Amount:</span>
              <span class="amount">₹${sub.amount.toLocaleString()}</span>
            </div>
            <div class="footer">
              <p>${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
              <p style="margin-top: 20px; font-size: 12px;">This is a computer generated receipt.</p>
            </div>
          </div>
        </body>
      </html>
    `);
  };

  const handleThermalPrintReceipt = (sub: Subscription) => {
    printThermal(`
      <html>
        <head>
          <title>Thermal Receipt</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
            .flex { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
          <div class="center">SUBSCRIPTION RECEIPT</div>
          <div class="center" style="font-size: 8px;">${new Date().toLocaleDateString()}</div>
          
          <div class="border-top">
            <div class="flex"><span>Receipt:</span> <span>#${sub.id}</span></div>
            <div class="flex"><span>Member:</span> <span>${sub.member_name}</span></div>
            <div class="flex"><span>From:</span> <span>${sub.start_date}</span></div>
            <div class="flex"><span>To:</span> <span>${sub.end_date}</span></div>
          </div>

          <div class="border-top">
            <div class="flex bold"><span>TOTAL:</span> <span>₹${sub.amount.toLocaleString()}</span></div>
          </div>
          <div class="center mt-1" style="font-size: 8px; font-style: italic; margin-top: 2mm;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  const handleWhatsAppShareReceipt = (sub: Subscription) => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - Subscription Receipt*\n\nMember: ${sub.member_name}\nPeriod: ${sub.start_date} to ${sub.end_date}\nAmount: ₹${sub.amount.toLocaleString()}\nStatus: ${sub.status.toUpperCase()}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrintList = () => {
    const tableRows = subs.map(sub => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.member_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.start_date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${sub.end_date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">₹${sub.amount.toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-transform: uppercase;">${sub.status}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Subscription List - ${settings?.church_name || 'CSI CMS'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #4f46e5; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
            <h2>Subscription List</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
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
              ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 20px;">No subscriptions found</td></tr>'}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-bold text-slate-800">{t('subscriptions')}</h3>
          <button 
            onClick={handlePrintList}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 flex items-center space-x-2"
            title="Print List"
          >
            <Printer size={20} />
            <span className="text-sm font-bold">Print</span>
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

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-left min-w-[800px]">
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
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${sub.status === 'paid' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 flex items-center space-x-1">
                  <button 
                    onClick={() => handleWhatsAppShareReceipt(sub)}
                    className="text-indigo-500 hover:text-indigo-600 p-1"
                    title="Share via WhatsApp"
                  >
                    <Share2 size={16} />
                  </button>
                  <button 
                    onClick={() => handlePrintReceipt(sub)}
                    className="text-slate-400 hover:text-indigo-600 p-1"
                    title="Print Receipt"
                  >
                    <Printer size={16} />
                  </button>
                  <button 
                    onClick={() => handleThermalPrintReceipt(sub)}
                    className="text-orange-400 hover:text-orange-600 p-1"
                    title="Thermal Print"
                  >
                    <Printer size={16} className="rotate-180" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && <SubscriptionModal 
        onClose={() => setShowModal(false)} 
        onSave={() => { 
          fetchSubs(); 
          setShowModal(false); 
        }} 
      />}
    </div>
  );
};

const SubscriptionModal = ({ onClose, onSave }: any) => {
  const { t } = useContext(LanguageContext);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    member_id: '', 
    start_date: new Date().toISOString().split('T')[0], 
    end_date: '', 
    amount: '', 
    status: 'pending'
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
      await safeFetch('/api/subscriptions', {
        method: 'POST',
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
            Add Subscription
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
  const settings = useContext(SettingsContext);
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
    try {
      await safeFetch(`/api/notes/${id}`, { method: 'DELETE' });
      fetchNotes();
    } catch (err: any) {
      console.error('Delete error:', err);
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

  const handlePrintList = () => {
    const tableRows = notes.map(note => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${note.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-transform: uppercase;">${note.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${note.user_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${note.content}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">₹${(note.amount || 0).toLocaleString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-transform: uppercase;">${note.status || 'PENDING'}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Notepad List - ${settings?.church_name || 'CSI CMS'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #4f46e5; }
          </style>
        </head>
        <body>
          <div style="text-align: center; margin-bottom: 30px;">
            <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
            <h2>Notepad / Event List</h2>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>User</th>
                <th>Content</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="6" style="text-align: center; padding: 20px;">No notes found</td></tr>'}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-bold text-slate-800">{t('notepad')}</h3>
          <button 
            onClick={handlePrintList}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 flex items-center space-x-2"
            title="Print List"
          >
            <Printer size={20} />
            <span className="text-sm font-bold">Print</span>
          </button>
        </div>
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
          className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
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
                'bg-indigo-100 text-indigo-700'
              }`}>
                {t(note.category as any)}
              </span>
              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
                    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - Note*\n\nCategory: ${note.category.toUpperCase()}\nContent: ${note.content}\nUser: ${note.user_name}\nAmount: ₹${note.amount?.toLocaleString() || 0}\nStatus: ${note.status?.toUpperCase() || 'PENDING'}\n\n_${verse}_`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="p-1.5 text-slate-400 hover:text-indigo-600"
                >
                  <Share2 size={16} />
                </button>
                <button 
                  onClick={() => {
                    printThermal(`
                      <html>
                        <head>
                          <title>Note - Thermal</title>
                          <style>
                            @page { margin: 0; }
                            body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                            .center { text-align: center; }
                            .bold { font-weight: bold; }
                            .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                            .mt-1 { margin-top: 1mm; }
                          </style>
                        </head>
                        <body>
                          <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                          <div class="center">${note.category.toUpperCase()}</div>
                          <div class="center" style="font-size: 8px;">${note.date}</div>
                          
                          <div class="border-top mt-1">
                            <div class="bold">${note.user_name}</div>
                            <div class="mt-1">${note.content}</div>
                            ${note.amount ? `<div class="flex mt-1 bold"><span>AMOUNT:</span> <span>₹${note.amount.toLocaleString()}</span></div>` : ''}
                            <div class="flex mt-1"><span>STATUS:</span> <span class="bold">${(note.status || 'pending').toUpperCase()}</span></div>
                          </div>

                          <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                          </div>
                        </body>
                      </html>
                    `);
                  }}
                  className="p-1.5 text-slate-400 hover:text-orange-600"
                >
                  <Printer size={16} className="rotate-180" />
                </button>
                <button onClick={() => openEdit(note)} className="p-1.5 text-slate-400 hover:text-blue-600">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(note.id)} className="p-1.5 text-slate-400 hover:text-rose-600">
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
                <div className="flex items-center text-sm font-bold text-indigo-600">
                  <IndianRupee size={14} className="mr-1" />
                  {note.amount?.toLocaleString() || 0}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                  note.status === 'paid' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
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
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={formData.content}
                    onChange={e => setFormData({...formData, content: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('user_name')}</label>
                    <input 
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.user_name}
                      onChange={e => setFormData({...formData, user_name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('mobile')}</label>
                    <input 
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.mobile}
                      onChange={e => setFormData({...formData, mobile: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
                  <input 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.amount === 0 ? '' : formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value === '' ? 0 : parseFloat(e.target.value)})}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">{t('status')}</label>
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
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
  const settings = useContext(SettingsContext);
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

  const handlePrint = () => {
    const rows = filteredContributors.map((c, i) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${i + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.member_code}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.name} (${c.tamil_name})</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${c.transaction_count}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">₹${c.total_contribution.toLocaleString()}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Income Analysis - Top Contributors</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${settings?.church_name || 'CSI CHURCH'}</h1>
            <h2>Income Analysis: Top Contributors Report</h2>
            <p>Date: ${new Date().toLocaleDateString()}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member Code</th>
                <th>Name</th>
                <th style="text-align: right;">Transactions</th>
                <th style="text-align: right;">Total Contribution</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
  };

  const handleWhatsAppShare = () => {
    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const top3 = filteredContributors.slice(0, 3).map((c, i) => `${i + 1}. ${c.name}: ₹${c.total_contribution.toLocaleString()}`).join('\n');
    const total = filteredContributors.reduce((sum, c) => sum + c.total_contribution, 0);
    
    const text = encodeURIComponent(`*${settings?.church_name || 'CSI CMS'} - Income Analysis Summary*\n\n*Top 3 Contributors:*\n${top3}\n\nTotal Analyzed: ₹${total.toLocaleString()}\n\n_${verse}_`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-800">{t('income_analysis')}</h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleWhatsAppShare}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 flex items-center space-x-2"
            title="Share via WhatsApp"
          >
            <Share2 size={20} />
            <span className="text-sm font-bold">Share</span>
          </button>
          <button 
            onClick={handlePrint}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200 flex items-center space-x-2"
            title="Print Full Report"
          >
            <Printer size={20} />
            <span className="text-sm font-bold">Print</span>
          </button>
          <button 
            onClick={() => {
              printThermal(`
                <html>
                  <head>
                    <title>Top Contributors - Thermal</title>
                    <style>
                      @page { margin: 0; }
                      body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                      .center { text-align: center; }
                      .bold { font-weight: bold; }
                      .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                      .flex { display: flex; justify-content: space-between; }
                      .mt-1 { margin-top: 1mm; }
                    </style>
                  </head>
                  <body>
                    <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                    <div class="center">TOP CONTRIBUTORS</div>
                    <div class="center" style="font-size: 8px;">${new Date().toLocaleDateString()}</div>
                    
                    <div class="border-top mt-1">
                      ${filteredContributors.slice(0, 10).map((c, i) => `
                        <div class="flex mt-1" style="font-size: 8px;">
                          <span>${i + 1}. ${c.name.substring(0, 12)}</span>
                          <span>₹${c.total_contribution.toLocaleString()}</span>
                        </div>
                      `).join('')}
                    </div>

                    <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                      ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                    </div>
                  </body>
                </html>
              `);
            }}
            className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors border border-orange-200 flex items-center space-x-2"
            title="Thermal Print Top 10"
          >
            <Printer size={20} className="rotate-180" />
            <span className="text-sm font-bold">Thermal</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h4 className="font-bold text-slate-700">{t('top_contributors')}</h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t('search')}
              className="pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto hidden md:block">
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
                    <span className="text-sm font-bold text-indigo-600">
                      ₹{c.total_contribution.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredContributors.map((c, index) => (
            <div key={c.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-black ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                  index === 1 ? 'bg-slate-200 text-slate-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">{c.name}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.member_code}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-indigo-600 tracking-tighter">₹{c.total_contribution.toLocaleString()}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.transaction_count} TXS</div>
              </div>
            </div>
          ))}
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
    if (!isSupabaseConfigured) {
      alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment variables.');
      return;
    }
    setLoading(true);
    try {
      const txs = await safeFetch('/api/transactions');
      const members = await safeFetch('/api/members');
      
      // Sync Members first (if table exists)
      try {
        if (isSupabaseConfigured) {
          const { error: memberError } = await supabase
            .from('members')
            .upsert(members, { onConflict: 'member_code' });
          if (memberError) console.warn('Supabase Members Sync Error:', memberError);
        }
      } catch (e) {}

      // Sync Transactions
      if (isSupabaseConfigured) {
        const { error: txError } = await supabase
          .from('transactions')
          .upsert(txs, { onConflict: 'invoice_no' });
          
        if (txError) throw txError;
      }
      
      alert('Successfully synced all data to Supabase!');
    } catch (err: any) {
      console.error(err);
      alert('Sync failed: ' + (err.message || 'Unknown error. Make sure "transactions" table exists in Supabase.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-8 pb-20">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">{t('church_profile')}</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Church Name (English)</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.church_name} onChange={e => setFormData({...formData, church_name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">தேவாலய பெயர் (தமிழ்)</label>
            <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.church_name_tamil} onChange={e => setFormData({...formData, church_name_tamil: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">{t('address')}</label>
            <textarea className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" rows={3} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('financial_year')}</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.financial_year} onChange={e => setFormData({...formData, financial_year: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('currency')}</label>
              <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} />
            </div>
          </div>
        </div>
        <div className="pt-4">
          <button onClick={handleSave} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
            {t('save')}
          </button>
        </div>
      </div>

      {user?.role === 'super_admin' && (
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
                <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.smtp_host || ''} onChange={e => setFormData({...formData, smtp_host: e.target.value})} placeholder="e.g. smtp.gmail.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">SMTP Port</label>
                <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.smtp_port || ''} onChange={e => setFormData({...formData, smtp_port: e.target.value})} placeholder="e.g. 587 or 465" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">SMTP User (Email)</label>
                <input className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.smtp_user || ''} onChange={e => setFormData({...formData, smtp_user: e.target.value})} placeholder="your-email@gmail.com" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">SMTP Password / App Password</label>
                <input type="password" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={formData.smtp_pass || ''} onChange={e => setFormData({...formData, smtp_pass: e.target.value})} placeholder="Your App Password" />
              </div>
            </div>
            
            <div className="pt-2">
              <button onClick={handleSave} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-100">
                Save SMTP Settings
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">Account Recovery</h3>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Recovery Email Address</label>
            <input 
              className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
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
              className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
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
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
                value={passwordData.new} 
                onChange={e => setPasswordData({...passwordData, new: e.target.value})} 
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">{t('confirm_password')}</label>
              <input 
                type="password" 
                required
                className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" 
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

      {user?.role === 'super_admin' && (
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
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">{t('language')}</h3>
        <div className="flex space-x-4">
          <button 
            onClick={() => setLang('en')}
            className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${lang === 'en' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
          >
            English
          </button>
          <button 
            onClick={() => setLang('ta')}
            className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${lang === 'ta' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      <div className="pt-8 pb-4 text-center border-t border-slate-100">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-1">Developer Information</p>
        <p className="text-sm text-slate-600 font-semibold">Software Development: Mr. Arunkumar Rajamanickam</p>
        <p className="text-xs text-slate-500 mt-1">Contact: <a href="mailto:sriarunkumarphy@gmail.com" className="text-indigo-600 hover:underline">sriarunkumarphy@gmail.com</a></p>
      </div>
    </div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    setError('');
    setLoading(true);
    console.log("LoginPage: Attempting login...");
    
    try {
      const data = await safeFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      console.log("LoginPage: Login response received", data);
      
      if (data.success) {
        if (data.user && data.user.role) {
          onLogin(data.user);
        } else {
          setError('Invalid user data received from server');
          setLoading(false);
        }
      } else {
        setError(data.message || 'Login failed');
        setLoading(false);
      }
    } catch (err: any) {
      console.error("LoginPage: Login error", err);
      setError(err.message || 'Connection error. Please try again.');
      setLoading(false);
    }
    // Note: setLoading(false) is handled in each branch to ensure it's set before potential page reload
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
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border-8 border-slate-800"
      >
        <div className="bg-indigo-600 p-8 text-white text-center relative">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner">
            <LayoutDashboard size={40} />
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase">C.S.I W.J HATCH</h1>
          <p className="text-indigo-100 text-[10px] font-bold tracking-[0.2em] uppercase mt-1">Memorial Church CMS</p>
        </div>

        <div className="p-8 space-y-8">
          {view === 'login' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <input 
                    type="text" 
                    required
                    className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                    placeholder="Enter username"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                    <button 
                      type="button"
                      onClick={() => setView('forgot')}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input 
                    type="password" 
                    required
                    className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Enter password"
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-2xl font-bold flex items-center space-x-2">
                  <X size={16} />
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}

          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2 text-center">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Recovery</h2>
                <p className="text-xs text-slate-400 font-medium">Enter your email to receive a secure code.</p>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="name@example.com"
                />
              </div>

              {error && <div className="p-4 bg-rose-50 text-rose-600 text-xs rounded-2xl font-bold">{error}</div>}

              <div className="flex flex-col space-y-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                >
                  {loading ? 'Sending Code...' : 'Send OTP'}
                </button>
                <button 
                  type="button"
                  onClick={() => setView('login')}
                  className="w-full py-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

        {view === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-slate-800">Verify OTP</h2>
              <p className="text-sm text-indigo-600 font-medium">{message}</p>
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
                        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                          <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">Development Bypass Code:</p>
                          <p className="text-2xl font-black text-indigo-700 tracking-[0.2em]">
                            {warning.match(/Your code is (\d+)/)?.[1]}
                          </p>
                          <p className="text-[9px] text-indigo-600 mt-1 italic">Use this code to proceed while you fix SMTP settings.</p>
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
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest font-bold text-lg"
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
            {error && <p className="text-rose-500 text-sm font-medium">{error}</p>}
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
                className="flex-[2] py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Reset'}
              </button>
            </div>
          </form>
        )}
        </div>
        
        <div className="text-center pb-8">
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('church_crm_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      localStorage.removeItem('church_crm_user');
      return null;
    }
  });
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('csi_lang');
    return (saved as Language) || 'en';
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('church_crm_user');
      if (saved) {
        const u = JSON.parse(saved);
        return u.role === 'super_admin' ? 'super_dashboard' : 'dashboard';
      }
    } catch (e) {
      localStorage.removeItem('church_crm_user');
    }
    return 'dashboard';
  });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogin = (userData: User | null) => {
    if (userData) {
      localStorage.setItem('church_crm_user', JSON.stringify(userData));
      // Set correct active tab
      setActiveTab(userData.role === 'super_admin' ? 'super_dashboard' : 'dashboard');
    } else {
      localStorage.removeItem('church_crm_user');
      setActiveTab('dashboard');
    }
    setUser(userData);
    // Removed window.location.reload() for a more seamless transition
  };

  useEffect(() => {
    if (user) {
      const isSuper = user.role === 'super_admin';
      if (isSuper && !activeTab.startsWith('super_')) {
        setActiveTab('super_dashboard');
      } else if (!isSuper && activeTab.startsWith('super_')) {
        setActiveTab('dashboard');
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    localStorage.setItem('csi_lang', lang);
  }, [lang]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user || user.role === 'super_admin') return;
      try {
        const data = await safeFetch('/api/settings');
        setSettings(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, [user]);

  const t = (key: keyof typeof TRANSLATIONS['en']) => TRANSLATIONS[lang][key] || key;

  if (!user) return <LoginPage onLogin={handleLogin} />;

  const isSuperAdmin = user.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, login: handleLogin, logout: () => handleLogin(null) }}>
      <LanguageContext.Provider value={{ lang, setLang, t }}>
        <SettingsContext.Provider value={settings}>
          <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setIsSidebarOpen(false); }} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
              <Header 
                title={isSuperAdmin ? (activeTab === 'super_dashboard' ? 'Super Admin Dashboard' : 'Super Admin Settings') : (t(activeTab as any) || activeTab)} 
                onMenuClick={() => setIsSidebarOpen(true)} 
              />
              <main className="flex-1 pt-16 md:ml-64">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isSuperAdmin ? activeTab : activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                  >
                    {isSuperAdmin ? (
                      <>
                        {activeTab === 'super_dashboard' && <SuperAdminDashboard />}
                        {activeTab === 'super_settings' && <SuperAdminSettings />}
                      </>
                    ) : (
                      <>
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'members' && <MembersPage />}
                        {activeTab === 'special-days' && <SpecialDaysPage />}
                        {activeTab === 'income' && <TransactionsPage type="income" />}
                        {activeTab === 'expenses' && <TransactionsPage type="expense" />}
                        {activeTab === 'settings' && <SettingsPage />}
                        {activeTab === 'reports' && <ReportsPage />}
                        {activeTab === 'cash_counter' && <CashCounterPage />}
                        {activeTab === 'subscriptions' && <SubscriptionsPage />}
                        {activeTab === 'notepad' && <Notepad />}
                        {activeTab === 'income_analysis' && <IncomeAnalysis />}
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </main>
              
              {!isSuperAdmin && (
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around h-16 md:hidden z-40">
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <LayoutDashboard size={20} />
                    <span className="text-[10px] font-medium">{t('dashboard')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('members')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'members' ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <Users size={20} />
                    <span className="text-[10px] font-medium">{t('members')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('income')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'income' ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <ArrowUpCircle size={20} />
                    <span className="text-[10px] font-medium">{t('income')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('expenses')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'expenses' ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <ArrowDownCircle size={20} />
                    <span className="text-[10px] font-medium">{t('expenses')}</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className={`flex flex-col items-center space-y-1 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-400'}`}
                  >
                    <SettingsIcon size={20} />
                    <span className="text-[10px] font-medium">{t('settings')}</span>
                  </button>
                </nav>
              )}
            </div>
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
    
    text += `\n*Grand Total: ₹${total.toLocaleString()}*\n\n_${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}_`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handlePrint = () => {
    const rows = denominations.map(d => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">₹${d}</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${counts[d] || 0}</td>
        <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">₹${(d * (counts[d] || 0)).toLocaleString()}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Cash Counter - ${settings?.church_name || 'CSI CMS'}</title>
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
  };

  const handleThermalPrint = () => {
    const rows = denominations.filter(d => counts[d] > 0).map(d => `
      <div class="flex mt-1">
        <span>₹${d} x ${counts[d]}</span>
        <span>₹${(d * counts[d]).toLocaleString()}</span>
      </div>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Cash Counter - Thermal</title>
          <style>
            @page { margin: 0; }
            body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
            .flex { display: flex; justify-content: space-between; }
            .mt-1 { margin-top: 1mm; }
          </style>
        </head>
        <body>
          <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
          <div class="center">CASH COUNTER</div>
          <div class="center" style="font-size: 8px;">${new Date().toLocaleString()}</div>
          
          <div class="border-top mt-1">
            ${rows}
          </div>

          <div class="border-top mt-1">
            <div class="flex bold"><span>TOTAL:</span> <span>₹${total.toLocaleString()}</span></div>
          </div>
          <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
            ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
          </div>
        </body>
      </html>
    `);
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
          <button onClick={handleShare} className="flex items-center space-x-2 px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-100 transition-all">
            <Share2 size={16} />
            <span>WhatsApp</span>
          </button>
          <button onClick={handleThermalPrint} className="flex items-center space-x-2 px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-bold hover:bg-orange-600 shadow-lg shadow-orange-100 transition-all">
            <Printer size={16} className="rotate-180" />
            <span>Thermal</span>
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
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700 font-bold text-xs">
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
                    className="w-20 p-2 text-center text-lg font-bold border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
              <td className="px-4 py-5 text-right font-mono text-2xl font-bold text-indigo-400">
                ₹{total.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({ totalChurches: 0, activeChurches: 0, totalUsers: 0 });
  const [churches, setChurches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingChurch, setEditingChurch] = useState<any>(null);
  const [passwordData, setPasswordData] = useState({ churchId: '', password: '', confirmPassword: '' });
  const [newChurch, setNewChurch] = useState({
    name: '',
    location: '',
    admin_name: '',
    admin_email: '',
    admin_username: '',
    admin_password: '',
    phone: '',
    plan: 'Basic'
  });

  const fetchChurches = async () => {
    console.log("SuperAdminDashboard: Fetching data...");
    setLoading(true);
    setError(null);
    setHealthStatus('checking');
    
    try {
      // Check health first
      try {
        const health = await safeFetch('/api/health');
        if (health.status === 'ok') {
          setHealthStatus('ok');
        } else {
          setHealthStatus('error');
        }
      } catch (e) {
        setHealthStatus('error');
      }

      const [statsData, churchesData] = await Promise.all([
        safeFetch('/api/super/stats'),
        safeFetch('/api/super/churches')
      ]);
      console.log("SuperAdminDashboard: Data received", { statsData, churchesCount: churchesData.length });
      setStats(statsData);
      setChurches(churchesData);
    } catch (err: any) {
      console.error("SuperAdminDashboard: Fetch error", err);
      setError(err.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChurches();
  }, []);

  const handleAddChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await safeFetch('/api/super/churches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newChurch,
          username: newChurch.admin_username,
          password: newChurch.admin_password
        })
      });
      setShowAddModal(false);
      setNewChurch({
        name: '',
        location: '',
        admin_name: '',
        admin_email: '',
        admin_username: '',
        admin_password: '',
        phone: '',
        plan: 'Basic'
      });
      fetchChurches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdateChurch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await safeFetch(`/api/super/churches/${editingChurch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingChurch.name,
          location: editingChurch.location,
          admin_name: editingChurch.admin_name,
          admin_email: editingChurch.admin_email,
          phone: editingChurch.phone,
          status: editingChurch.status,
          plan: editingChurch.subscription_plan,
          expiry_date: editingChurch.expiry_date
        })
      });
      setShowEditModal(false);
      fetchChurches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    try {
      await safeFetch(`/api/super/churches/${passwordData.churchId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordData.password })
      });
      setShowPasswordModal(false);
      setPasswordData({ churchId: '', password: '', confirmPassword: '' });
      alert("Password updated successfully");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleStatus = async (church: any) => {
    try {
      await safeFetch(`/api/super/churches/${church.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: church.name,
          location: church.location,
          admin_name: church.admin_name,
          admin_email: church.admin_email,
          phone: church.phone,
          status: church.status === 'active' ? 'inactive' : 'active',
          plan: church.subscription_plan,
          expiry_date: church.expiry_date
        })
      });
      fetchChurches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintSummary = () => {
    const tableRows = churches.map(c => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.location}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.admin_name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.subscription_plan}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-transform: uppercase;">${c.status}</td>
      </tr>
    `).join('');

    printThermal(`
      <html>
        <head>
          <title>Church List Summary - Super Admin</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #4f46e5; }
            .stats { display: flex; justify-content: space-around; margin-bottom: 20px; background: #f9fafb; padding: 15px; border-radius: 8px; }
            .stat-item { text-align: center; }
            .stat-value { font-size: 20px; font-bold: true; color: #4f46e5; }
          </style>
        </head>
        <body>
          <h1>Super Admin - Church Network Summary</h1>
          <p style="text-align: center;">Generated on: ${new Date().toLocaleString()}</p>
          
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">Total Churches</div>
              <div class="stat-value">${stats.totalChurches}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Active Churches</div>
              <div class="stat-value">${stats.activeChurches}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Total Users</div>
              <div class="stat-value">${stats.totalUsers}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Church Name</th>
                <th>Location</th>
                <th>Admin</th>
                <th>Plan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="5" style="text-align: center; padding: 20px;">No churches found</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);
  };

  if (loading && churches.length === 0) return (
    <div className="p-8 text-center space-y-4">
      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
      <p className="text-slate-500 font-medium">Loading Super Admin Dashboard...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Super Admin Dashboard</h1>
            <button 
              onClick={handlePrintSummary}
              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-200 flex items-center space-x-2"
              title="Print Summary"
            >
              <Printer size={20} />
              <span className="text-sm font-bold">Print</span>
            </button>
            <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter flex items-center gap-1 ${
              healthStatus === 'ok' ? 'bg-emerald-100 text-emerald-700' : 
              healthStatus === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                healthStatus === 'ok' ? 'bg-emerald-500' : 
                healthStatus === 'error' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
              }`}></div>
              {healthStatus === 'ok' ? 'Healthy' : healthStatus === 'error' ? 'Unreachable' : 'Checking'}
            </div>
          </div>
          <p className="text-slate-500 font-medium">Manage all churches and system activity</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchChurches}
            disabled={loading}
            className="bg-slate-100 text-slate-600 px-4 py-3 rounded-2xl font-bold uppercase tracking-widest flex items-center space-x-2 hover:bg-slate-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest flex items-center space-x-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
          >
            <Plus size={20} />
            <span>Add New Church</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-rose-900">Connection Error</h3>
              <p className="text-rose-600 text-sm font-medium">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchChurches}
            className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-rose-700 transition-all"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4">
            <LayoutDashboard size={24} />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Churches</p>
          <p className="text-3xl font-black text-slate-800">{stats.totalChurches}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Active Churches</p>
          <p className="text-3xl font-black text-slate-800">{stats.activeChurches}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mb-4">
            <Users size={24} />
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Total Users</p>
          <p className="text-3xl font-black text-slate-800">{stats.totalUsers}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Registered Churches</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">Church Name</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Admin</th>
                <th className="px-6 py-4">Plan</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {churches.map((church) => (
                <tr key={church.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{church.name}</div>
                    <div className="text-xs text-slate-400">{church.created_at}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{church.location}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">{church.admin_name}</div>
                    <div className="text-xs text-slate-400">{church.admin_username}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {church.subscription_plan}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      church.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {church.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => {
                          setEditingChurch({...church});
                          setShowEditModal(true);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        title="Edit Church"
                      >
                        <Edit size={20} />
                      </button>
                      <button 
                        onClick={() => {
                          setPasswordData({...passwordData, churchId: church.id});
                          setShowPasswordModal(true);
                        }}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-all"
                        title="Change Password"
                      >
                        <Key size={20} />
                      </button>
                      <button 
                        onClick={() => toggleStatus(church)}
                        className={`p-2 rounded-xl transition-all ${
                          church.status === 'active' ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={church.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {church.status === 'active' ? <X size={20} /> : <Plus size={20} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Add New Church</h2>
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Setup a new tenant account</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleAddChurch} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Church Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.name} 
                      onChange={e => setNewChurch({...newChurch, name: e.target.value})} 
                      placeholder="e.g. CSI St. Paul's Church"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.location} 
                      onChange={e => setNewChurch({...newChurch, location: e.target.value})} 
                      placeholder="e.g. Chennai, Tamil Nadu"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.admin_name} 
                      onChange={e => setNewChurch({...newChurch, admin_name: e.target.value})} 
                      placeholder="e.g. Rev. John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.phone} 
                      onChange={e => setNewChurch({...newChurch, phone: e.target.value})} 
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Email</label>
                    <input 
                      type="email" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.admin_email} 
                      onChange={e => setNewChurch({...newChurch, admin_email: e.target.value})} 
                      placeholder="e.g. admin@stpauls.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Username</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.admin_username} 
                      onChange={e => setNewChurch({...newChurch, admin_username: e.target.value})} 
                      placeholder="e.g. stpauls_admin"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.admin_password} 
                      onChange={e => setNewChurch({...newChurch, admin_password: e.target.value})} 
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subscription Plan</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                      value={newChurch.plan}
                      onChange={e => setNewChurch({...newChurch, plan: e.target.value})}
                    >
                      <option value="Basic">Basic</option>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                    <input 
                      type="date" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={newChurch.expiry_date || ''} 
                      onChange={e => setNewChurch({...newChurch, expiry_date: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="flex space-x-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                  >
                    Create Church
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEditModal && editingChurch && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Edit Church</h2>
                  <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Update church and admin details</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleUpdateChurch} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Church Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.name} 
                      onChange={e => setEditingChurch({...editingChurch, name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.location} 
                      onChange={e => setEditingChurch({...editingChurch, location: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Name</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.admin_name} 
                      onChange={e => setEditingChurch({...editingChurch, admin_name: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="text" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.phone} 
                      onChange={e => setEditingChurch({...editingChurch, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admin Email</label>
                    <input 
                      type="email" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.admin_email} 
                      onChange={e => setEditingChurch({...editingChurch, admin_email: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subscription Plan</label>
                    <select 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                      value={editingChurch.subscription_plan}
                      onChange={e => setEditingChurch({...editingChurch, subscription_plan: e.target.value})}
                    >
                      <option value="Basic">Basic</option>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry Date</label>
                    <input 
                      type="date" 
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                      value={editingChurch.expiry_date || ''} 
                      onChange={e => setEditingChurch({...editingChurch, expiry_date: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="flex space-x-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
                  >
                    Update Details
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-orange-600 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Change Password</h2>
                  <p className="text-orange-100 text-xs font-bold uppercase tracking-widest mt-1">Reset church admin password</p>
                </div>
                <button onClick={() => setShowPasswordModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" 
                      value={passwordData.password} 
                      onChange={e => setPasswordData({...passwordData, password: e.target.value})} 
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                    <input 
                      type="password" 
                      required
                      className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" 
                      value={passwordData.confirmPassword} 
                      onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} 
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="flex space-x-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-orange-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-orange-700 transition-all shadow-xl shadow-orange-100"
                  >
                    Update Password
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

const SuperAdminSettings = () => {
  const { logout } = useContext(AuthContext);
  const [profile, setProfile] = useState({ name: '', username: '', email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await safeFetch('/api/super/profile');
        setProfile(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await safeFetch('/api/super/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile.name, email: profile.email })
      });
      setMessage({ text: 'Profile updated successfully', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ text: 'Passwords do not match', type: 'error' });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
      return;
    }
    try {
      await safeFetch('/api/super/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      setMessage({ text: 'Password changed successfully. Logging out...', type: 'success' });
      setTimeout(() => logout(), 2000);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Settings...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">Super Admin Settings</h1>
        <p className="text-slate-500 font-medium">Manage your profile and account security</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-2xl font-bold text-center ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile Information */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Users size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Profile Information</h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                value={profile.name} 
                onChange={e => setProfile({...profile, name: e.target.value})} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username (Read-only)</label>
              <input 
                type="text" 
                readOnly
                className="w-full p-4 rounded-2xl bg-slate-100 border-none outline-none text-slate-500 font-medium cursor-not-allowed" 
                value={profile.username} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" 
                value={profile.email} 
                onChange={e => setProfile({...profile, email: e.target.value})} 
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
              Update Profile
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
              <Key size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Change Password</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
              <input 
                type="password" 
                required
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" 
                value={passwordData.currentPassword} 
                onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
              <input 
                type="password" 
                required
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" 
                value={passwordData.newPassword} 
                onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
              <input 
                type="password" 
                required
                className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-orange-500 transition-all font-medium" 
                value={passwordData.confirmPassword} 
                onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} 
              />
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-100">
              Change Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ReportsPage = () => {
  const { t } = useContext(LanguageContext);
  const settings = useContext(SettingsContext);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [filter, setFilter] = useState({ start: '', end: '', category: 'all' });
  const [summary, setSummary] = useState({ income: 0, expense: 0, correction: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txData, corrData] = await Promise.all([
          safeFetch('/api/transactions'),
          safeFetch('/api/corrections')
        ]);
        
        const safeTxData = Array.isArray(txData) ? txData : [];
        const safeCorrData = Array.isArray(corrData) ? corrData : [];

        setTxs(safeTxData);
        setCorrections(safeCorrData);
        
        const inc = safeTxData.filter((tx: any) => tx.type === 'income').reduce((sum: number, tx: any) => sum + tx.amount, 0);
        const exp = safeTxData.filter((tx: any) => tx.type === 'expense').reduce((sum: number, tx: any) => sum + tx.amount, 0);
        const corr = safeCorrData.reduce((sum: number, c: any) => sum + c.amount, 0);
        
        setSummary({ income: inc, expense: exp, correction: corr });
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const filtered = txs.filter(tx => {
    const dateMatch = (!filter.start || tx.date >= filter.start) && (!filter.end || tx.date <= filter.end);
    const catMatch = filter.category === 'all' || tx.category === filter.category;
    return dateMatch && catMatch;
  });

  const filteredCorrections = corrections.filter(c => {
    const date = new Date(c.created_at).toISOString().split('T')[0];
    const dateMatch = (!filter.start || date >= filter.start) && (!filter.end || date <= filter.end);
    // For category match in corrections, we might need to link back to the original transaction
    // but for now, let's just filter by date or if category is 'all'
    return dateMatch && (filter.category === 'all');
  });

  const handlePrint = () => {
    const tableRows = filtered.map(tx => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.invoice_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.date}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.category}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.member_name || tx.vendor_name || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: ${tx.type === 'income' ? '#059669' : '#dc2626'}; font-weight: bold;">
          ${tx.type === 'income' ? '+' : '-'} ₹${tx.amount.toLocaleString()}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px;">${tx.payment_mode.toUpperCase()}</td>
      </tr>
    `).join('');

    const correctionRows = filteredCorrections.map(c => `
      <tr style="background-color: #fff7ed;">
        <td style="border: 1px solid #ddd; padding: 8px;">${c.correction_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${new Date(c.created_at).toLocaleDateString()}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">CORRECTION</td>
        <td style="border: 1px solid #ddd; padding: 8px;">REF: ${c.ref_invoice_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px; color: ${c.amount >= 0 ? '#059669' : '#dc2626'}; font-weight: bold;">
          ${c.amount >= 0 ? '+' : ''} ₹${c.amount.toLocaleString()}
        </td>
        <td style="border: 1px solid #ddd; padding: 8px;">ADJUSTMENT</td>
      </tr>
    `).join('');

    const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const totalCorrection = filteredCorrections.reduce((sum, c) => sum + c.amount, 0);

    printThermal(`
      <html>
        <head>
          <title>Financial Report - ${settings?.church_name || 'CSI CMS'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #f2f2f2; text-align: left; border: 1px solid #ddd; padding: 8px; }
            h1 { text-align: center; color: #1e293b; }
            .meta { text-align: right; font-size: 12px; color: #666; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-top: 20px; }
            .summary-item { padding: 12px; border-radius: 8px; border: 1px solid #ddd; text-align: center; }
            .income { background-color: #ecfdf5; color: #065f46; }
            .expense { background-color: #fef2f2; color: #991b1b; }
            .correction { background-color: #fff7ed; color: #9a3412; }
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
              <div style="font-size: 10px; text-transform: uppercase;">Total Income</div>
              <div style="font-size: 16px; font-weight: bold;">₹${totalIncome.toLocaleString()}</div>
            </div>
            <div class="summary-item expense">
              <div style="font-size: 10px; text-transform: uppercase;">Total Expense</div>
              <div style="font-size: 16px; font-weight: bold;">₹${totalExpense.toLocaleString()}</div>
            </div>
            <div class="summary-item correction">
              <div style="font-size: 10px; text-transform: uppercase;">Corrections</div>
              <div style="font-size: 16px; font-weight: bold;">${totalCorrection >= 0 ? '+' : ''}₹${totalCorrection.toLocaleString()}</div>
            </div>
            <div class="summary-item balance">
              <div style="font-size: 10px; text-transform: uppercase;">Net Balance</div>
              <div style="font-size: 16px; font-weight: bold;">₹${(totalIncome - totalExpense + totalCorrection).toLocaleString()}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>${t('invoice_no')}</th>
                <th>Date</th>
                <th>Category</th>
                <th>Name / Vendor</th>
                <th>Amount</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              ${correctionRows}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <p style="font-style: italic; color: #666; font-size: 14px;">${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}</p>
          </div>
        </body>
      </html>
    `);
  };

  const handleShare = () => {
    const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const totalCorrection = filteredCorrections.reduce((sum, c) => sum + c.amount, 0);
    const netBalance = totalIncome - totalExpense + totalCorrection;

    const verse = BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)];
    const text = `*${settings?.church_name || 'CSI CMS'} Financial Report*\n` +
                 `Period: ${filter.start || 'Start'} to ${filter.end || 'End'}\n` +
                 `Category: ${filter.category}\n\n` +
                 `Total Income: ₹${totalIncome.toLocaleString()}\n` +
                 `Total Expense: ₹${totalExpense.toLocaleString()}\n` +
                 `Corrections: ${totalCorrection >= 0 ? '+' : ''}₹${totalCorrection.toLocaleString()}\n` +
                 `*Net Balance: ₹${netBalance.toLocaleString()}*\n\n` +
                 `_${verse}_\n\n` +
                 `Generated on: ${new Date().toLocaleString()}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const totalIncome = filtered.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = filtered.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const totalCorrection = filteredCorrections.reduce((sum, c) => sum + c.amount, 0);
  const netBalance = totalIncome - totalExpense + totalCorrection;

  const categories = Array.from(new Set(txs.map(tx => tx.category)));

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('date')} (Start)</label>
          <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={filter.start} onChange={e => setFilter({...filter, start: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('date')} (End)</label>
          <input type="date" className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={filter.end} onChange={e => setFilter({...filter, end: e.target.value})} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase">{t('category')}</label>
          <select className="w-full p-2 rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500" value={filter.category} onChange={e => setFilter({...filter, category: e.target.value})}>
            <option value="all">All Categories</option>
            {categories.map((cat: any) => (
              <option key={cat} value={cat}>{t(cat as any) || (typeof cat === 'string' ? cat.charAt(0).toUpperCase() + cat.slice(1) : cat)}</option>
            ))}
          </select>
        </div>
        <div className="flex space-x-2 ml-auto">
          <button 
            onClick={() => {
              printThermal(`
                <html>
                  <head>
                    <title>Financial Report - Thermal</title>
                    <style>
                      @page { margin: 0; }
                      body { font-family: 'Courier New', Courier, monospace; width: 48mm; margin: 0; padding: 2mm; font-size: 10px; line-height: 1.2; }
                      .center { text-align: center; }
                      .bold { font-weight: bold; }
                      .border-top { border-top: 1px dashed #000; margin-top: 2mm; padding-top: 2mm; }
                      .flex { display: flex; justify-content: space-between; }
                      .mt-1 { margin-top: 1mm; }
                    </style>
                  </head>
                  <body>
                    <div class="center bold">${settings?.church_name || 'CSI CHURCH'}</div>
                    <div class="center">FINANCIAL REPORT</div>
                    <div class="center" style="font-size: 8px;">${filter.start || 'Start'} - ${filter.end || 'End'}</div>
                    
                    <div class="border-top mt-1">
                      <div class="flex"><span>INCOME:</span> <span class="bold">₹${totalIncome.toLocaleString()}</span></div>
                      <div class="flex"><span>EXPENSE:</span> <span class="bold">₹${totalExpense.toLocaleString()}</span></div>
                      <div class="flex"><span>CORR:</span> <span class="bold">${totalCorrection >= 0 ? '+' : ''}₹${totalCorrection.toLocaleString()}</span></div>
                      <div class="flex mt-1"><span>NET BAL:</span> <span class="bold">₹${netBalance.toLocaleString()}</span></div>
                    </div>

                    <div class="border-top center mt-1" style="font-size: 8px; font-style: italic;">
                      ${BIBLE_VERSES[Math.floor(Math.random() * BIBLE_VERSES.length)]}
                    </div>
                  </body>
                </html>
              `);
            }}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-orange-600 transition-colors"
          >
            <Printer size={20} className="rotate-180" />
            <span>Thermal</span>
          </button>
          <button onClick={handleShare} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-indigo-700 transition-colors">
            <Share2 size={20} />
            <span>Share</span>
          </button>
          <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2 rounded-lg font-bold flex items-center space-x-2 hover:bg-slate-900 transition-colors">
            <Printer size={20} />
            <span>{t('print')}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
          <p className="text-indigo-600 text-sm font-bold uppercase">{t('total_income')}</p>
          <p className="text-2xl font-black text-indigo-700">₹{totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100">
          <p className="text-rose-600 text-sm font-bold uppercase">{t('total_expense')}</p>
          <p className="text-2xl font-black text-rose-700">₹{totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
          <p className="text-orange-600 text-sm font-bold uppercase">{t('correction')}</p>
          <p className="text-2xl font-black text-orange-700">{totalCorrection >= 0 ? '+' : ''}₹{totalCorrection.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <p className="text-blue-600 text-sm font-bold uppercase">{t('balance')}</p>
          <p className="text-2xl font-black text-blue-700">₹{netBalance.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm print:shadow-none print:border-none">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3 font-semibold">{t('invoice_no')}</th>
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
                <td className="px-6 py-4 text-sm font-medium text-slate-900">{tx.invoice_no}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800 capitalize">{t(tx.category as any) || tx.category}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{tx.member_name || tx.vendor_name || '-'}</td>
                <td className={`px-6 py-4 text-sm font-bold ${tx.type === 'income' ? 'text-indigo-600' : 'text-rose-600'}`}>
                  {tx.type === 'income' ? '+' : '-'} ₹{tx.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 uppercase">{tx.payment_mode}</td>
              </tr>
            ))}
            {filteredCorrections.map((c) => (
              <tr key={c.id} className="bg-orange-50/30 hover:bg-orange-50/50 transition-colors">
                <td className="px-6 py-4 text-sm font-bold text-orange-600">{c.correction_no}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-4 text-sm font-bold text-orange-600">CORRECTION</td>
                <td className="px-6 py-4 text-sm text-slate-500 italic">REF: {c.ref_invoice_no}</td>
                <td className={`px-6 py-4 text-sm font-bold ${c.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {c.amount >= 0 ? '+' : ''} ₹{c.amount.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-sm text-slate-400 uppercase">ADJUSTMENT</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
