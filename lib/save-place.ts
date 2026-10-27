import { redirect } from "next/navigation";

import { signInPathWithNext } from "@/lib/auth-callback";
import { captureLink, PICK_TYPE_COPY } from "@/lib/capture-link";
import { INVITE_UNKNOWN_ERROR } from "@/lib/invites";
import { TYPE_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { ItemStatus, ItemType } from "@/lib/types";

// Logado e com espaço; senão, login (voltando para `path`) ou tela "Seu nome".
export async function requireSpace(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(signInPathWithNext(path));
  }

  const { data: membership } = await supabase
    .from("space_members")
    .select("space_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/nome");
  }

  return { supabase, spaceId: membership.space_id as string };
}

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export type SavePlaceResult =
  | { ok: true; status: ItemStatus; id: string }
  | { ok: false; error: string };

export async function savePlace(
  formData: FormData,
  path: string,
): Promise<SavePlaceResult> {
  const title = formValue(formData, "title");
  const type = formValue(formData, "type");
  const url = captureLink(formValue(formData, "url"));
  const notes = formValue(formData, "notes");
  const status: ItemStatus =
    formValue(formData, "status") === "done" ? "done" : "want";

  if (!Object.keys(TYPE_LABELS).includes(type)) {
    return { ok: false, error: PICK_TYPE_COPY };
  }

  if (!title || !url) {
    return { ok: false, error: INVITE_UNKNOWN_ERROR };
  }

  const { supabase, spaceId } = await requireSpace(path);
  const { data, error } = await supabase
    .from("items")
    .insert({
      space_id: spaceId,
      type: type as ItemType,
      title,
      url,
      notes: notes || null,
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  return error || !data
    ? { ok: false, error: INVITE_UNKNOWN_ERROR }
    : { ok: true, status, id: data.id as string };
}
