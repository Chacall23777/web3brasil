import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { verifyDeposit } from '@/lib/verifyDeposit'

export default function CreateChallengeModal({ onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    token_mint: '',
    total_amount: '',
    winners_count: '',
    start_date: '',
    end_date: '',
    rules: { follow_x: true, comment_link: true }
  })
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    // Aqui você pode adicionar verificação de depósito
    // const result = await verifyDeposit(txHash, cofreAddress)

    const { data, error } = await supabase
      .from('challenges')
      .insert({
        title: form.title,
        description: form.description,
        token_mint: form.token_mint,
        total_amount: Number(form.total_amount),
        winners_count: Number(form.winners_count),
        amount_per_winner: Number(form.total_amount) / Number(form.winners_count),
        start_date: form.start_date,
        end_date: form.end_date,
        rules: form.rules,
        status: 'active'
      })

    if (error) alert('Erro ao criar: ' + error.message)
    else {
      alert('Desafio criado com sucesso!')
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-zinc-900 p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <h2 className="text-3xl font-bold mb-6">Criar Novo Desafio</h2>

        {/* Campos do formulário - adicione mais campos conforme necessário */}
        <input 
          type="text" 
          placeholder="Título do Desafio" 
          className="w-full p-4 bg-zinc-800 rounded-xl mb-4"
          onChange={(e) => setForm({...form, title: e.target.value})}
        />

        <textarea 
          placeholder="Descrição" 
          className="w-full p-4 bg-zinc-800 rounded-xl mb-4 h-32"
          onChange={(e) => setForm({...form, description: e.target.value})}
        />

        <input 
          type="text" 
          placeholder="Token Mint Address (Solana)" 
          className="w-full p-4 bg-zinc-800 rounded-xl mb-4"
          onChange={(e) => setForm({...form, token_mint: e.target.value})}
        />

        <div className="grid grid-cols-2 gap-4">
          <input 
            type="number" 
            placeholder="Quantidade Total de Tokens" 
            className="p-4 bg-zinc-800 rounded-xl"
            onChange={(e) => setForm({...form, total_amount: e.target.value})}
          />
          <input 
            type="number" 
            placeholder="Número de Vencedores" 
            className="p-4 bg-zinc-800 rounded-xl"
            onChange={(e) => setForm({...form, winners_count: e.target.value})}
          />
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading}
          className="w-full mt-6 bg-orange-600 py-4 rounded-2xl font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Criar Desafio e Depositar Tokens'}
        </button>

        <button onClick={onClose} className="w-full mt-3 text-gray-400">Cancelar</button>
      </div>
    </div>
  )
}
