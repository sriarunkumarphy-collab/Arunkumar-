export type Role = 'super_admin' | 'pastor' | 'accountant' | 'staff';

export interface User {
  id: number;
  username: string;
  role: Role;
  name: string;
  email?: string;
}

export interface Member {
  id: number;
  member_code: string;
  name: string;
  tamil_name: string;
  phone: string;
  email: string;
  address: string;
  family_details: string;
  membership_type: 'regular' | 'visitor' | 'life';
  joined_date: string;
  status: 'active' | 'inactive';
}

export interface Transaction {
  id: number;
  invoice_no: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  payment_mode: string;
  member_id?: number;
  member_name?: string;
  vendor_name?: string;
  item_details?: string;
  gst_amount?: number;
  bill_url?: string;
  notes?: string;
  sub_start_date?: string;
  sub_end_date?: string;
}

export interface Settings {
  church_name: string;
  church_name_tamil: string;
  address: string;
  currency: string;
  financial_year: string;
}

export interface Subscription {
  id: number;
  member_id: number;
  member_name?: string;
  start_date: string;
  end_date: string;
  amount: number;
  status: 'paid' | 'pending';
  last_reminder_date?: string;
  transaction_id?: number;
}

export interface Note {
  id: number;
  category: 'event' | 'prayer' | 'auction' | 'materials';
  content: string;
  user_name: string;
  mobile: string;
  address: string;
  date: string;
  amount?: number;
  status?: 'pending' | 'paid';
  created_at?: string;
}

export interface TopContributor {
  id: number;
  name: string;
  tamil_name: string;
  member_code: string;
  total_contribution: number;
  transaction_count: number;
}

export type Language = 'en' | 'ta';
