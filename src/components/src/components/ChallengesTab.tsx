import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import CreateChallengeModal from './CreateChallengeModal'  // vamos criar depois
import ChallengeCard from './ChallengeCard'              // vamos criar depois

export default function ChallengesTab() {
  const [challenges, setChallenges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadChallenges = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) console.error(error)
    else setChallenges(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadChallenges()
  }, [])

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold text-white">Desafios Web3Brasil</h1>
          <p className="text-gray-400 mt-2">Ganhe tokens Solana completando desafios</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-600 hover:bg-orange-700 px-8 py-4 rounded-2xl font-bold text-lg transition"
        >
          + Criar Desafio
        </button>
      </div>

      {loading ? (
        <p>Carregando desafios...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {challenges.map(challenge => (
            <ChallengeCard key={challenge.id} challenge={challenge} onRefresh={loadChallenges} />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateChallengeModal 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={loadChallenges} 
        />
      )}
    </div>
  )
}
