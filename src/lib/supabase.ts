import { supabase as officialSupabase } from "@/integrations/supabase/client";

// Exportamos o cliente oficial para manter a compatibilidade com o restante do código
export const supabase = officialSupabase;