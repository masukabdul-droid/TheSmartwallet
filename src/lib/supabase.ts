import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ngcieqpfvjwfmmudiuqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nY2llcXBmdmp3Zm1tdWRpdXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMTM5NzUsImV4cCI6MjA4ODc4OTk3NX0.zcihFVRhaZ3UzeQzdVX-Si0vI6aXmP8Bm8Zwf6W_lag';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];
