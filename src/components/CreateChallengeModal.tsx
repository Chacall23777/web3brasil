import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function CreateChallengeModal({ onClose, onSuccess }: any) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    token_mint: '',
    total_amount: '',
    winners_count: '10',
    start_date: '',
    end_date: '',
  })
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)

    const { error } = await supabase
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
        rules: { follow_x: true, comment_link: true },
        status: 'active'
      })

    if (error) {
      alert('Erro ao criar desafio: ' + error.message)
    } else {
      alert('Desafio criado com sucesso!')
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-3xl p-8 w-full max-w-lg">
        <h2 className="text-3xl font-bold mb-6 text-white">Criar Novo Desafio</h2>

        <input 
          type="text" 
          placeholder="Título do Desafio" 
          className="w-full p-4 bg-zinc-800 rounded-2xl mb-4 text-white"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <textarea 
          placeholder="Descrição do desafio" 
          className="w-full p-4 bg-zinc-800 rounded-2xl mb-4 h-24 text-white"
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <input 
          type="text" 
          placeholder="Token Mint Address (Solana)" 
          className="w-full p-4 bg-zinc-800 rounded-2xl mb-4 text-white"
          onChange={(e) => setForm({ ...form, token_mint: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <input 
            type="number" 
            placeholder="Total de Tokens" 
            className="p-4 bg-zinc-800 rounded-2xl text-white"
            onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
          />
          <input 
            type="number" 
            placeholder="Nº de Vencedores" 
            className="p-4 bg-zinc-800 rounded-2xl text-white"
            onChange={(e) => setForm({ ...form, winners_count: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <input 
            type="datetime-local" 
            className="p-4 bg-zinc-800 rounded-2xl text-white"
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <input 
            type="datetime-local" 
            className="p-4 bg-zinc-800 rounded-2xl text-white"
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
          />
        </div>

        <button 
          onClick={handleCreate}
          disabled={loading}
          className="w-full mt-8 bg-orange-600 hover:bg-orange-700 py-4 rounded-2xl font-bold text-lg disabled:opacity-50"
        >
          {loading ? 'Criando Desafio...' : 'Criar Desafio'}
        </button>

        <button onClick={onClose} className="w-full mt-3 text-gray-400 py-3">
          Cancelar
        </button>
      </div>
    </div>
  )
}

        

    
 
        
