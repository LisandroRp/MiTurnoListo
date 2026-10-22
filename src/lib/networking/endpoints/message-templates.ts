"use client";

import { isValidMessageTemplate, type MessageTemplate } from "@/features/scheduling/message-templates";
import { getSupabaseBrowserClient } from "@/lib/networking/clients/supabase-browser";

export async function getMessageTemplates(businessId: string): Promise<MessageTemplate[]> {
  const { data, error } = await getSupabaseBrowserClient().from("message_templates")
    .select("id, title, body").eq("business_id", businessId).order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load message templates.");
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body }));
}

export async function saveMessageTemplate(businessId: string, template: MessageTemplate) {
  if (!isValidMessageTemplate(template.title, template.body)) throw new Error("Invalid message template.");
  const { error } = await getSupabaseBrowserClient().from("message_templates").upsert({
    id: template.id, business_id: businessId, title: template.title.trim(), body: template.body.trim()
  });
  if (error) throw new Error("Unable to save message template.");
}

export async function deleteMessageTemplate(businessId: string, id: string) {
  const { error } = await getSupabaseBrowserClient().from("message_templates").delete().eq("business_id", businessId).eq("id", id);
  if (error) throw new Error("Unable to delete message template.");
}
