import { createClient } from '@supabase/supabase-js';

// Buscando as variáveis de ambiente do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Inicialização segura
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!supabase) {
  console.error("ERRO: Chaves do Supabase não encontradas. Certifique-se de que VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão configuradas.");
}