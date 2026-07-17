# 🏆 Aba "Desafios" (Challenges) — Web3Brasil

Nova feature paralela ao módulo `/bounties`, focada em campanhas de **distribuição em massa** de tokens SPL para múltiplos vencedores validados por regras sociais (X/Twitter, comentários, etc).

> Observação sobre stack: o projeto atual **NÃO é Next.js App Router** — usa **TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Supabase**. A implementação abaixo respeita a stack real; o resto do que você pediu (Solana web3.js, wallet-adapter, escrow, etc.) é mantido.

---

## 1. 🎯 User Flow

```text
[Criador]
  1. Conecta wallet Solana (mesmo fluxo do /bounties)
  2. Preenche: token (mint), total de tokens, nº de vencedores
     → app calcula valor por vencedor (total ÷ vencedores)
  3. Upload de capa + descrição rica + regras (template ou custom)
  4. Define início/término + modo de validação (manual / comunitária)
  5. Deposita tokens na wallet-escrow do desafio
     → backend valida saldo on-chain antes de marcar "ativo"
  6. Desafio publicado em /desafios

[Participante]
  7. Vê desafio, clica "Participar"
  8. Executa a regra (ex: posta no X) e cola o link da prova
  9. Fica com status "pending"

[Moderação]
 10. Admin/criador (ou comunidade, se habilitado) marca válido/inválido
 11. Sistema conta submissões válidas

[Encerramento]
 12. Ao chegar `ends_at`, cron dispara distribuição
 13. Sorteio/seleção dos N vencedores entre válidos
 14. Transferência em lote (chunks de ~10 instruções por tx)
 15. Cada transfer vira linha em `challenge_distributions` com status
 16. Botão manual "Reenviar falhas" para o criador
```

---

## 2. 🗄️ Schema (Supabase / Postgres)

```text
challenges
  id uuid pk
  creator_id uuid -> auth.users
  title text, description text, cover_url text
  token_mint text, token_symbol text, token_decimals int
  total_amount numeric        -- em unidades humanas
  winners_count int
  amount_per_winner numeric   -- generated: total/winners
  rules_template text         -- 'follow_x_comment' | 'post_hashtag' | 'answer_question' | 'custom'
  rules_json jsonb            -- {x_handle, hashtag, question, custom_md}
  validation_mode text        -- 'manual' | 'community'
  starts_at timestamptz, ends_at timestamptz
  escrow_wallet text          -- pubkey gerada por desafio
  deposit_tx text             -- assinatura da tx de depósito
  deposit_verified_at timestamptz
  status text                 -- draft|awaiting_deposit|active|closed|distributing|completed|failed
  created_at, updated_at

challenge_participants
  id uuid pk
  challenge_id uuid -> challenges
  user_id uuid -> auth.users
  wallet text
  proof_url text              -- link do post no X
  status text                 -- pending|valid|invalid
  validated_by uuid, validated_at timestamptz
  unique (challenge_id, user_id)

challenge_validations       -- votos da comunidade (modo community)
  id, participant_id, voter_id, vote bool, created_at
  unique (participant_id, voter_id)

challenge_distributions
  id uuid pk
  challenge_id, participant_id, wallet text
  amount numeric
  tx_signature text
  status text                 -- pending|success|failed
  error text
  attempted_at, confirmed_at

challenge_escrow_keys        -- privado, service_role only (idem bounty_vault_keys)
  challenge_id pk, secret_key text, created_at
```

RLS obrigatório (padrão do projeto):
- `challenges`: SELECT público para status != draft; INSERT auth; UPDATE só criador ou admin.
- `challenge_participants`: SELECT público (sem wallet — usar VIEW `challenge_participants_public`); INSERT auth próprio; UPDATE só criador/admin/community.
- `challenge_distributions`: SELECT público; INSERT/UPDATE só service_role.
- `challenge_escrow_keys`: sem grants a anon/authenticated.

Grants seguindo padrão já usado em `bounties`.

---

## 3. 🧩 Componentes / Arquivos

```text
src/routes/desafios.tsx                  # listagem + criação
src/routes/desafios.$id.tsx              # detalhe + participar + admin
src/components/challenges/
  ChallengeCard.tsx
  ChallengeForm.tsx                      # cria (com preview amount/winner)
  ChallengeRulesEditor.tsx               # templates + custom
  ParticipateDialog.tsx                  # cola proof_url
  ParticipantsTable.tsx                  # admin: aprovar/rejeitar
  DistributionPanel.tsx                  # status + reenviar falhas
  DepositStatus.tsx                      # instruções e verificação on-chain
src/lib/challenges.functions.ts          # createServerFn: create, verifyDeposit, submit, validate, distribute, retryFailed
src/lib/challenges.server.ts             # helpers com supabaseAdmin + escrow
src/lib/solana-transfer.ts               # transferChecked em lote
src/routes/api/public/challenges.cron.ts # endpoint chamado por pg_cron ao fechar
```

---

## 4. 💰 Validação de Depósito + Escrow (correção do bug atual)

Problema hoje em `/bounties`: confia em `getTransaction` sem checar saldo real. Corrigir com fluxo determinístico:

```text
1. createChallenge() -> gera Keypair escrow, salva pub em challenges.escrow_wallet
                        e secret em challenge_escrow_keys (service_role)
   status = 'awaiting_deposit'

2. UI mostra: "Envie EXATAMENTE {total_amount} {symbol} para {escrow_wallet}"
              (SPL transferChecked, mesmo mint, mesmos decimais)

3. verifyDeposit(challenge_id):
   a. getParsedTokenAccountsByOwner(escrow_wallet, {mint})
   b. somar uiAmount de todas ATAs do mint
   c. se saldo >= total_amount * 10^decimals → status='active',
      deposit_verified_at=now()
   d. senão → retornar { ok:false, current, required }
   Nunca confiar só em signature; sempre reler saldo on-chain via
   múltiplos RPCs (publicnode, ankr, mainnet-beta, drpc) com retry.

4. distribute():
   - só roda se status='active' AND now() >= ends_at
   - seleciona N winners entre participants.status='valid'
     (aleatório com seed = hash(challenge_id))
   - carrega escrow Keypair
   - para cada winner: transferChecked(amount_per_winner)
     em lotes de 8-10 instruções por tx (limite compute)
   - grava challenge_distributions row a cada tentativa
   - status final = 'completed' se todas 'success', senão 'failed'

5. retryFailed(): reexecuta apenas distributions com status='failed'
```

Escrow via **wallet dedicada** (não Anchor program) — mesmo modelo já em uso em bounties, menor superfície de auditoria.

---

## 5. ⚠️ Mensagens de erro / UX

| Situação | Mensagem |
|---|---|
| Wallet não conectada | "Conecte sua wallet Solana para criar um desafio." |
| Mint inválido | "Endereço do token inválido. Verifique o mint." |
| Total ÷ vencedores não inteiro em lamports | "Ajuste o total ou o nº de vencedores — valor por vencedor precisa ser divisível." |
| Depósito insuficiente | "Recebemos {current} {symbol}, faltam {missing}. Envie o restante para o mesmo endereço." |
| RPC indisponível | "Rede Solana instável no momento. Tentaremos novamente automaticamente." |
| Proof duplicada | "Você já participou deste desafio." |
| Fora do período | "Este desafio ainda não começou / já foi encerrado." |
| Distribuição parcial | "{x}/{y} transferências concluídas. Clique em 'Reenviar falhas' para retentar." |

---

## 6. 🔒 Regras de validação de posts no X

- MVP: parse do link (`x.com/{handle}/status/{id}`), armazenar handle+id.
- Validação manual do criador/admin (default).
- Modo `community`: N votos positivos de usuários verificados → auto-valid.
- Fase 2 (não neste PR): integração via X API v2 (connector já existe no projeto) para checar hashtag / follow automaticamente.

---

## 7. 📦 Escopo desta entrega

Neste PR eu entrego:
1. Migração Supabase com as 5 tabelas + RLS + grants + trigger `amount_per_winner`.
2. `challenges.functions.ts` com: `createChallenge`, `verifyDeposit`, `submitParticipation`, `validateParticipation`, `distributeRewards`, `retryFailedDistributions`.
3. Rotas `/desafios` (lista+criar) e `/desafios/$id` (detalhe+admin) com componentes acima.
4. Correção do padrão de verificação de depósito (leitura de saldo on-chain com retry multi-RPC) — mesmo helper reutilizável para `/bounties`.
5. Cron `pg_cron` chamando `/api/public/challenges/close` a cada 5 min para fechar e disparar distribuição.
6. Página `/desafios` linkada no header.

Fora de escopo (fica para depois, confirme se quer):
- Integração automática com X API para checar follow/hashtag.
- Programa Anchor on-chain (mantemos wallet-escrow, mais simples e já testado).
- Sorteio verificável on-chain (VRF) — MVP usa seed determinística off-chain.

Confirma que posso seguir com esse escopo? Se quiser cortar/adicionar algo (ex.: pular modo comunitário, incluir X API já no MVP), me avise antes de eu implementar.
