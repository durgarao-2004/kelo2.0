import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export type Subject = Database["public"]["Tables"]["subjects"]["Row"];

export interface DbResult<T> {
  data: T;
  error: string | null;
}

export async function listSubjects(userId: string): Promise<DbResult<Subject[]>> {
  const { data, error } = await getSupabaseAdmin()
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  return { data: data ?? [], error: error?.message ?? null };
}

export async function getSubject(
  userId: string,
  id: string,
): Promise<DbResult<Subject | null>> {
  const { data, error } = await getSupabaseAdmin()
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function createSubject(
  userId: string,
  input: {
    name: string;
    color?: string;
    target_attendance?: number;
    year?: number | null;
    semester?: string | null;
  },
): Promise<DbResult<Subject | null>> {
  const name = input.name.trim();
  if (!name) return { data: null, error: "Subject name is required." };
  const { data, error } = await getSupabaseAdmin()
    .from("subjects")
    .insert({
      user_id: userId,
      name,
      color: input.color,
      target_attendance: input.target_attendance,
      year: input.year ?? null,
      semester: input.semester ?? null,
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    return { data: null, error: "You already have a subject with that name." };
  }
  return { data: data ?? null, error: error?.message ?? null };
}

export async function updateSubject(
  userId: string,
  id: string,
  patch: Partial<
    Pick<Subject, "name" | "color" | "target_attendance" | "year" | "semester">
  >,
): Promise<DbResult<Subject | null>> {
  const { data, error } = await getSupabaseAdmin()
    .from("subjects")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  return { data: data ?? null, error: error?.message ?? null };
}

export async function deleteSubject(
  userId: string,
  id: string,
): Promise<{ error: string | null }> {
  const { error } = await getSupabaseAdmin()
    .from("subjects")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return { error: error?.message ?? null };
}
