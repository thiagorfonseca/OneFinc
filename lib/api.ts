import { supabase } from './supabase';

export const api = {
  // Clinics
  async fetchClinics() {
    const { data, error } = await supabase.from('clinics').select('*, bank_accounts (id), categories (id), clinic_users (id, ativo)').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async updateClinics(ids: string[], ativo: boolean) {
    const { error } = await supabase.from('clinics').update({ ativo }).in('id', ids);
    if (error) throw error;
    return true;
  },

  // Clinic users
  async fetchClinicUsers() {
    const { data, error } = await supabase.from('clinic_users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Categories
  async fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) throw error;
    return data;
  },

  // Card fees
  async fetchCardFees() {
    const { data, error } = await supabase.from('card_fees').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Customers
  async fetchCustomers() {
    const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Procedures
  async fetchProcedures() {
    const { data, error } = await supabase.from('procedures').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Professionals
  async fetchProfessionals() {
    const { data, error } = await supabase.from('professionals').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Suppliers
  async fetchSuppliers() {
    const { data, error } = await supabase.from('suppliers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Bank accounts & transactions
  async fetchBankAccounts() {
    const { data, error } = await supabase.from('bank_accounts').select('*');
    if (error) throw error;
    return data;
  },
  async fetchBankTransactions(accountId: string) {
    const { data, error } = await supabase.from('bank_transactions').select('*').eq('bank_account_id', accountId).order('data', { ascending: false });
    if (error) throw error;
    return data;
  },
};
