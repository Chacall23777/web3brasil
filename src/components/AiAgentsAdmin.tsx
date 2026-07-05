import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Copy, Loader2, KeyRound, Ban, CheckCircle2, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createAiAgent,
  listAiAgents,
  setAiAgentSuspended,
  rotateAiAgentKey,
  updateAiAgentLimit,
  deleteAiAgent,
} from "@/lib/ai-agents.functions";

export function AiAgentsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listAiAgents);
  const create = useServerFn(createAiAgent);
  const suspend = useServerFn(setAiAgentSuspended);
  const rotate = useServerFn(rotateAiAgentKey);
  const setLimit = useServerFn(updateAiAgentLimit);
  const remove = useServerFn(deleteAiAgent);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: () => list(),
  });

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [contact, setContact] = useState("");
  const [rate, setRate] = useState(20);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);

  const createMut = useMutation({
    mutationFn: async () =>
      create({
        data: {
          name: name.trim(),
          description: desc.trim() || null,
          operator_contact: contact.trim(),
          rate_limit_per_hour: rate,
        },
      }),
    onSuccess: (r) => {
      setNewKey({ key: r.api_key, name });
      setName(""); setDesc(""); setContact(""); setRate(20);
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar agente"),
  });

  const doSuspend = useMutation({
    mutationFn: (v: { id: string; suspended: boolean }) => suspend({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
  const doRotate = useMutation({
    mutationFn: (id: string) => rotate({ data: { id } }),
    onSuccess: (r, id) => {
      const ag = data?.agents.find((a: any) => a.id === id);
      setNewKey({ key: r.api_key, name: ag?.name ?? "" });
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
    },
  });
  const doLimit = useMutation({
    mutationFn: (v: { id: string; rate_limit_per_hour: number }) => setLimit({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });
  const doDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-agents"] }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4 space-y-3 bg-card">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-fuchsia-500" /> Registrar novo agente de IA
        </h3>
        <Input placeholder="Nome do agente (ex: Solana News Bot)" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
        <Input placeholder="Contato do operador responsável (email, telegram, etc.)" value={contact} onChange={(e) => setContact(e.target.value)} />
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Rate limit / hora:</label>
          <Input type="number" min={1} max={1000} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-24" />
        </div>
        <Button
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending || !name.trim() || !contact.trim()}
        >
          {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Gerar API key
        </Button>
      </div>

      {newKey && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
          <p className="text-sm font-semibold">
            API key gerada para <strong>{newKey.name}</strong> — copie agora, não será exibida novamente:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-background px-3 py-2 rounded border break-all">{newKey.key}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(newKey.key);
                toast.success("Copiado");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <button className="text-xs text-muted-foreground underline" onClick={() => setNewKey(null)}>
            Fechar
          </button>
        </div>
      )}

      <div>
        <h3 className="font-semibold mb-3">Agentes registrados</h3>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        ) : !data?.agents?.length ? (
          <div className="text-sm text-muted-foreground">Nenhum agente cadastrado.</div>
        ) : (
          <ul className="space-y-3">
            {data.agents.map((a: any) => (
              <li key={a.id} className="rounded-lg border p-3 bg-card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold flex items-center gap-2">
                      <Bot className="h-4 w-4 text-fuchsia-500" />
                      {a.name}
                      {a.is_suspended && (
                        <span className="text-[10px] rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                          SUSPENSO
                        </span>
                      )}
                    </div>
                    {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">Operador:</span> {a.operator_contact}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {a.api_key_prefix}••••••
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">/h:</span>
                      <Input
                        type="number"
                        min={1}
                        max={1000}
                        defaultValue={a.rate_limit_per_hour}
                        className="w-16 h-7 text-xs"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== a.rate_limit_per_hour && v >= 1 && v <= 1000) {
                            doLimit.mutate({ id: a.id, rate_limit_per_hour: v });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={a.is_suspended ? "default" : "outline"}
                    onClick={() => doSuspend.mutate({ id: a.id, suspended: !a.is_suspended })}
                  >
                    {a.is_suspended ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Reativar</>
                    ) : (
                      <><Ban className="h-3.5 w-3.5" /> Suspender</>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => doRotate.mutate(a.id)}>
                    <RefreshCw className="h-3.5 w-3.5" /> Rotacionar key
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Remover ${a.name}? A conta e a API key serão apagadas.`)) {
                        doDelete.mutate(a.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
