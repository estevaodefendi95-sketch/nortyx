import { supabase } from "@/integrations/supabase/client";

export const ATTACHMENT_BUCKET = "billing-attachments";
export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
export const MAX_BYTES = 10 * 1024 * 1024;

export type AttachmentKind = "boleto" | "nf";

export function validateAttachment(file: File): string | null {
  const lower = file.name.toLowerCase();
  const okExt = lower.endsWith(".pdf") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png");
  if (!ALLOWED_MIME.includes(file.type) && !okExt) {
    return "Formato inválido. Envie PDF, JPG ou PNG.";
  }
  if (file.size > MAX_BYTES) {
    return "Arquivo muito grande (máx 10MB).";
  }
  return null;
}

function extOf(file: File): string {
  const m = file.name.toLowerCase().match(/\.(pdf|jpg|jpeg|png)$/);
  return m ? m[1] : "bin";
}

export async function uploadChargeAttachment(
  organizationId: string,
  chargeId: string,
  kind: AttachmentKind,
  file: File,
): Promise<string> {
  const ext = extOf(file);
  const path = `${organizationId}/${chargeId}/${kind}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (upErr) throw upErr;

  // Long-lived signed URL (≈ 5 years)
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (error || !data) throw error || new Error("URL não gerada");

  const column = kind === "boleto" ? "boleto_url" : "nf_url";
  const { error: updErr } = await supabase
    .from("billing_charges")
    .update({ [column]: data.signedUrl })
    .eq("id", chargeId);
  if (updErr) throw updErr;

  return data.signedUrl;
}

export async function removeChargeAttachment(
  organizationId: string,
  chargeId: string,
  kind: AttachmentKind,
  currentUrl?: string | null,
): Promise<void> {
  // Try to delete the storage object (best-effort) using folder listing.
  try {
    const folder = `${organizationId}/${chargeId}`;
    const { data: files } = await supabase.storage.from(ATTACHMENT_BUCKET).list(folder);
    if (files && files.length) {
      const targets = files.filter((f) => f.name.startsWith(`${kind}-`)).map((f) => `${folder}/${f.name}`);
      if (targets.length) await supabase.storage.from(ATTACHMENT_BUCKET).remove(targets);
    }
  } catch (e) {
    console.warn("remove attachment storage best-effort failed", e);
  }
  const column = kind === "boleto" ? "boleto_url" : "nf_url";
  const { error } = await supabase.from("billing_charges").update({ [column]: null }).eq("id", chargeId);
  if (error) throw error;
}
