import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Só inicializa se as variáveis existirem, caso contrário exporta um mock ou erro controlado
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

if (!supabase) {
  console.warn("Supabase não configurado. As funcionalidades de login não funcionarão até que as variáveis de ambiente sejam adicionadas.");
}