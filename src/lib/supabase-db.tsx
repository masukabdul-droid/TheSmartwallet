// ─── Supabase Database Layer ──────────────────────────────────────────────
// Replaces localStorage with Supabase. Each record stored as { id, user_id, data: JSONB }
// This file is a drop-in replacement for the localStorage portions of database.tsx

import { supabase } from "./supabase";

type Row = { id: string; data: any };

// ─── Generic CRUD helpers ─────────────────────────────────────────────────

export async function sbGetAll<T>(table: string, userId: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, data")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) { console.error(`sbGetAll ${table}:`, error); return []; }
  return (data as Row[]).map(r => ({ ...r.data, id: r.id })) as T[];
}

export async function sbUpsert(table: string, userId: string, id: string, data: any): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ id, user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) console.error(`sbUpsert ${table}:`, error);
}

export async function sbDelete(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`sbDelete ${table}:`, error);
}

// ─── Singleton tables (one row per user) ──────────────────────────────────

export async function sbGetSingleton<T>(table: string, userId: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return fallback;
  return data as T;
}

export async function sbUpsertSingleton(table: string, userId: string, value: any): Promise<void> {
  const { error } = await supabase
    .from(table)
    .upsert({ user_id: userId, ...value, updated_at: new Date().toISOString() });
  if (error) console.error(`sbUpsertSingleton ${table}:`, error);
}

// ─── Trash ────────────────────────────────────────────────────────────────

export async function sbAddToTrash(userId: string, item: any): Promise<void> {
  await supabase.from("trash").insert({ id: item.id, user_id: userId, data: item });
}

export async function sbGetTrash(userId: string): Promise<any[]> {
  const { data } = await supabase
    .from("trash")
    .select("id, data, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data || []).map(r => r.data);
}

export async function sbDeleteFromTrash(id: string): Promise<void> {
  await supabase.from("trash").delete().eq("id", id);
}

export async function sbClearTrash(userId: string): Promise<void> {
  await supabase.from("trash").delete().eq("user_id", userId);
}
