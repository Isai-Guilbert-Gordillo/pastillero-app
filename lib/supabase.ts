import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ihllcqbfusutkfzrpmkq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlobGxjcWJmdXN1dGtmenJwbWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODUyNzQsImV4cCI6MjA4NzQ2MTI3NH0.J-zKnAAvNDXrCu519_8hGVWXyHItAmu2jZ1wrJnXiHc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
