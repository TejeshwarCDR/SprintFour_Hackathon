import { createClient } from '@supabase/supabase-js';
import { assertSupabaseEnv, env } from '../config/env.js';

let client;

export const getSupabase = () => {
  if (!client) {
    assertSupabaseEnv();
    client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return client;
};
