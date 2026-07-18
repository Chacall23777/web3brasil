import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { verifyDeposit } from '@/lib/verifyDeposit'

export default function ChallengeCard({ challenge, onRefresh }: any) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmitProof = async () => {
    const link = prompt("Cole o link do seu post no X:")
    if (!link) return

    setSubmitting(true)
    const { error } = await supabase
      .from('challenge_submissions')
      .insert({
        challenge_id: challenge.id,
        proof_link: link,
        status: 'pending'
      })

    if (error) alert('Erro ao enviar prova')
    else alert('Prova enviada! Aguarde validação.')
    
    setSubmitting(false)
    onRefresh && onRefresh()
  }

  const isEnded = new Date(challenge.end_date) < new Date()

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 hover:border-orange-500 transition">
      {challenge.image_url && <img src={challenge.image_url} className="w-full h-48 object-cover rounded-2xl mb-4" alt={challenge.title} />}
      
      <h3 className="text-xl font-bold mb-2">{challenge.title}</h3>
      <p className="text-gray-400 text-sm line-clamp-2 mb-4">{challenge.description}</p>

      <div className="flex justify-between text-sm mb-4">
        <div>
          <span className="text-orange-400">Prêmio:</span> {challenge.amount_per_winner} tokens
        </div>
        <div>
          <span className="text-orange-400">Vencedores:</span> {challenge.winners_count}
        </div>
      </div>

      <div className="text-xs text-gray-500 mb-4">
        Termina em: {new Date(challenge.end_date).toLocaleDateString('pt-BR')}
      </div>

      {isEnded ? (
        <button 
          onClick={() => alert('Distribuição em breve')}
          className="w-full py-3 bg-zinc-800 rounded-2xl text-sm"
        >
          Desafio Encerrado
        </button>
      ) : (
        <button 
          onClick={handleSubmitProof}
          disabled={submitting}
          className="w-full py-3 bg-orange-600 hover:bg-orange-700 rounded-2xl font-semibold"
        >
          {submitting ? 'Enviando...' : 'Participar / Enviar Prova'}
        </button>
      )}
    </div>
  )
}
