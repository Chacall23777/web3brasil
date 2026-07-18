import { createClient } from '@supabase/supabase-js'

console.log('🔍 Variáveis disponíveis:', {
  MY_SUPABASE_URL: !!import.meta.env.MY_SUPABASE_URL,
  MY_SUPABASE_ANON_KEY: !!import.meta.env.MY_SUPABASE_ANON_KEY,
  allKeys: Object.keys(import.meta.env)
})

const supabaseUrl = import.meta.env.MY_SUPABASE_URL
const supabaseAnonKey = import.meta.env.MY_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Variáveis faltando!')
  throw new Error('MY_SUPABASE_URL ou MY_SUPABASE_ANON_KEY não encontradas no Lovable')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log('✅ Supabase conectado com sucesso!')
