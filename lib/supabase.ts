/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Use variáveis de ambiente; se não existirem, caímos no fallback conhecido para não quebrar a UI.
const FALLBACK_URL = 'https://kevzqjffwbcjxvoebfll.supabase.co';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtldnpxamZmd2Jjanh2b2ViZmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyODk3MDAsImV4cCI6MjA3Mjg2NTcwMH0.ZFY7lNM4iUadRAyR4AyJoQzarPpJZT6diPCctPB-zx0';

const env = (import.meta as any).env || {};
const SUPABASE_URL = (env.VITE_SUPABASE_URL as string) || FALLBACK_URL;
const SUPABASE_KEY = (env.VITE_SUPABASE_ANON_KEY as string) || FALLBACK_KEY;

if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local. Usando fallback temporário.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
