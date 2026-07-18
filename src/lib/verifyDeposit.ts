import { supabase } from './supabase'

export const verifyDeposit = async (txHash: string, cofreAddress: string) => {
  try {
    const { data, error } = await supabase
      .from('deposits')
      .insert({
        tx_hash: txHash,
        cofre_address: cofreAddress,
        status: 'verified',
        verified_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    console.log('✅ Depósito validado:', data)
    return { success: true, data }
  } catch (error: any) {
    console.error('❌ Erro na validação:', error.message)
    return { success: false, error: error.message }
  }
}
     

 
