import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://utrvyiaphmzqjmdxkfzr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0cnZ5aWFwaG16cWptZHhrZnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDE1MDEsImV4cCI6MjEwMDIxNzUwMX0.nnXdd07NDYJePY6pMxCN1gCPOc1yaBbMXJj5owuclz8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
