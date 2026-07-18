import { createClient } from '@supabase/supabase-js'

// Fallback direto (para teste)
const supabaseUrl = import.meta.env.MY_SUPABASE_URL || 'https://qfintfjkctrwkflifahc.supabase.co'
const supabaseAnonKey = import.meta.env.MY_SUPABASE_ANON_KEY || 'sb_publishable_jjmtH...' // cole sua chave aqui temporariamente

console.log('URL:', supabaseUrl ? 'OK' : 'Faltando')
console.log('Key:', supabaseAnonKey ? 'OK' : 'Faltando')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log('✅ Supabase carregado!')
