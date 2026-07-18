import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.MY_SUPABASE_URL
const supabaseAnonKey = import.meta.env.MY_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis não encontradas')
  throw new Error('Configure MY_SUPABASE_URL e MY_SUPABASE_ANON_KEY no Lovable')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('✅ Supabase conectado com sucesso!')
