import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KvEntry<T = any> = {
  key: string;
  value: T;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

/** Read one key (public). */
export async function kvGet<T = any>(key: string): Promise<KvEntry<T> | null> {
  const { data, error } = await supabase
    .from("kv_store" as any)
    .select("*")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as KvEntry<T>) ?? null;
}

/** List keys, optionally filtered by prefix (public). */
export async function kvList<T = any>(prefix?: string): Promise<KvEntry<T>[]> {
  let q = supabase.from("kv_store" as any).select("*").order("updated_at", { ascending: false });
  if (prefix) q = q.like("key", `${prefix}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data as KvEntry<T>[]) ?? [];
}

/** Upsert a key. Requires auth; caller becomes the owner. Only the owner may overwrite. */
export async function kvSet<T = any>(key: string, value: T): Promise<KvEntry<T>> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Você precisa estar autenticado para publicar.");
  const { data, error } = await supabase
    .from("kv_store" as any)
    .upsert({ key, value: value as any, owner_id: uid }, { onConflict: "key" })
    .select()
    .single();
  if (error) throw error;
  return data as KvEntry<T>;
}

/** Delete a key (only owner via RLS). */
export async function kvDelete(key: string): Promise<void> {
  const { error } = await supabase.from("kv_store" as any).delete().eq("key", key);
  if (error) throw error;
}

/** Subscribe to realtime changes for a key prefix (or all). Returns unsubscribe fn. */
export function kvSubscribe(
  onChange: (payload: {
    eventType: "INSERT" | "UPDATE" | "DELETE";
    new: KvEntry | null;
    old: KvEntry | null;
  }) => void,
  prefix?: string,
): () => void {
  const channel = supabase
    .channel(`kv_store:${prefix ?? "*"}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "kv_store" },
      (payload: any) => {
        const row = (payload.new ?? payload.old) as KvEntry | undefined;
        if (prefix && row && !row.key.startsWith(prefix)) return;
        onChange({
          eventType: payload.eventType,
          new: (payload.new as KvEntry) ?? null,
          old: (payload.old as KvEntry) ?? null,
        });
      },
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** React hook: live-synced list of entries under an optional key prefix. */
export function useKvList<T = any>(prefix?: string) {
  const [entries, setEntries] = useState<KvEntry<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    kvList<T>(prefix)
      .then((rows) => {
        if (alive) setEntries(rows);
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));

    const unsub = kvSubscribe((evt) => {
      setEntries((prev) => {
        if (evt.eventType === "DELETE" && evt.old) {
          return prev.filter((r) => r.key !== evt.old!.key);
        }
        if (evt.new) {
          const next = prev.filter((r) => r.key !== evt.new!.key);
          next.unshift(evt.new as KvEntry<T>);
          return next;
        }
        return prev;
      });
    }, prefix);

    return () => {
      alive = false;
      unsub();
    };
  }, [prefix]);

  return { entries, loading, error };
}

/** React hook: live-synced single entry by key. */
export function useKvEntry<T = any>(key: string) {
  const [entry, setEntry] = useState<KvEntry<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    kvGet<T>(key)
      .then((row) => alive && setEntry(row))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));

    const unsub = kvSubscribe((evt) => {
      if (evt.eventType === "DELETE" && evt.old?.key === key) setEntry(null);
      else if (evt.new?.key === key) setEntry(evt.new as KvEntry<T>);
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [key]);

  return { entry, loading, error };
}
