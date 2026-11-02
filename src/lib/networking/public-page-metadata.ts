import "server-only";

import type { Metadata } from "next";

import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { getFreePlanPublicAccess } from "@/lib/networking/free-plan-public-access";
import { isReservedPublicSlug, isUuid } from "@/lib/slugs";

const siteName = "MiTurnoListo";
const socialImage = "/branding/og-image.png";

function buildMetadata(title: string, description: string, path: string, isAvailable: boolean): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: { index: isAvailable, follow: true },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName,
      title,
      description,
      url: path,
      images: [{ url: socialImage, width: 1200, height: 630, alt: siteName }]
    },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] }
  };
}

export async function getPublicPageMetadata(businessKey: string, serviceKey?: string): Promise<Metadata> {
  const path = `/${encodeURIComponent(businessKey)}${serviceKey ? `/${encodeURIComponent(serviceKey)}` : ""}`;
  const fallback = () => buildMetadata(`Reservá tu turno | ${siteName}`, "Elegí un servicio y reservá tu turno online con MiTurnoListo.", path, false);
  if (isReservedPublicSlug(businessKey)) return fallback();

  try {
    const supabase = getSupabaseAdminClient();
    const businessResult = await supabase.from("businesses")
      .select("id, name, public_slug, subscription_tier")
      .eq(isUuid(businessKey) ? "id" : "public_slug", businessKey)
      .limit(1).maybeSingle();
    if (businessResult.error || !businessResult.data) return fallback();
    const business = businessResult.data;
    const businessPath = `/${encodeURIComponent(business.public_slug || businessKey)}`;

    if (!serviceKey) {
      return buildMetadata(`${business.name} — Turnos online | ${siteName}`, `Consultá los servicios de ${business.name}, elegí un profesional y reservá tu turno online.`, businessPath, true);
    }

    const serviceResult = await supabase.from("services")
      .select("id, name, public_slug")
      .eq("business_id", business.id)
      .eq(isUuid(serviceKey) ? "id" : "public_slug", serviceKey)
      .eq("is_public", true).eq("is_active", true)
      .limit(1).maybeSingle();
    if (serviceResult.error || !serviceResult.data) return fallback();
    const service = serviceResult.data;
    const publicAccess = await getFreePlanPublicAccess(supabase, business.id, business.subscription_tier);
    if (publicAccess && !publicAccess.serviceIds.has(service.id)) return fallback();

    return buildMetadata(`${service.name} en ${business.name} | ${siteName}`, `Reservá tu turno para ${service.name} en ${business.name}. Elegí el día y horario que te convengan.`, `${businessPath}/${encodeURIComponent(service.public_slug || serviceKey)}`, true);
  } catch {
    return fallback();
  }
}
