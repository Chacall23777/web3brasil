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
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
