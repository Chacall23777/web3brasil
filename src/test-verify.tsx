import { verifyDeposit } from './lib/verifyDeposit'

export default function TestVerify() {
  const test = async () => {
    const result = await verifyDeposit(
      "3XChcZaMdcgLJ...", 
      "GKxTYCux86daBywy5RZ..."
    )
    alert(result.success ? "Deu certo!" : "Erro: " + result.error)
  }

  return (
    <button onClick={test} style={{ padding: "20px", fontSize: "18px" }}>
      Testar Verificação de Depósito
    </button>
  )
}
