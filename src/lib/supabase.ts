import { createClient } from '@supabase/supabase-js';

// Obtenemos la URL y la clave asegurando limpiar sufijos como /rest/v1/
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://gpdqjihnnjetoxxfsfxh.supabase.co';
const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_ZzcuTOB4mcU1ZMC0lFiMEw_vpCm-ZuX';

// Normalizar la URL eliminando /rest/v1 o barras al final
export const supabaseUrl = (rawUrl || '')
  .trim()
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');

export const supabaseAnonKey = (rawKey || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project')
);

// Cliente oficial de Supabase
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
