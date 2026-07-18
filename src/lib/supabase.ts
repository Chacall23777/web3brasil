 import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.MY_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://qfintfjkctrwkflifahc.supabase.co'
const supabaseAnonKey = import.meta.env.MY_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('🔍 Env vars:', { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey })

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase keys not found. Check Lovable secrets.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
console.log('✅ Supabase OK!')
