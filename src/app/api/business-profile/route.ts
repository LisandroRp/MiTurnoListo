import { NextRequest, NextResponse } from "next/server";

import { BusinessProfile } from "@/features/scheduling/types";
import { createApiErrorResponse, getSafeErrorMessage } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { getSafePublicSlug } from "@/lib/slugs";

type BusinessProfilePayload = {
  businessId?: string;
  profile?: Partial<BusinessProfile>;
};

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json() as BusinessProfilePayload;
    const businessId = payload.businessId?.trim();

    if (!businessId || !payload.profile) {
      return NextResponse.json({ error: "Missing business profile data." }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("business_memberships")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
    }

    const nextProfile = normalizeBusinessProfile(payload.profile);
    const publicSlug = await resolveUniqueBusinessSlug(supabase, nextProfile.name, businessId);
    const { data, error } = await supabase
      .from("businesses")
      .update({
        name: nextProfile.name,
        public_slug: publicSlug,
        address: nextProfile.address || null,
        public_description: nextProfile.publicDescription || null,
        public_logo_url: nextProfile.publicLogoUrl || null,
        public_opening_hours: nextProfile.publicOpeningHours || null
      })
      .eq("id", businessId)
      .select("name, public_slug, address, public_description, public_logo_url, public_opening_hours")
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      profile: {
        name: data.name,
        publicSlug: data.public_slug ?? "",
        address: data.address ?? "",
        publicDescription: data.public_description ?? "",
        publicLogoUrl: data.public_logo_url ?? "",
        publicOpeningHours: data.public_opening_hours ?? ""
      } satisfies BusinessProfile
    });
  } catch (error) {
    if (isPostgresUniqueViolation(error)) {
      return createApiErrorResponse("Ya existe un negocio con ese nombre.", {
        code: "BUSINESS_NAME_ALREADY_EXISTS",
        fallbackMessage: "Ya existe un negocio con ese nombre.",
        status: 409
      });
    }

    return createApiErrorResponse(getSafeErrorMessage(error, "Unable to save business profile."), {
      code: "BUSINESS_PROFILE_SAVE_FAILED",
      fallbackMessage: "Unable to save business profile.",
      status: 500
    });
  }
}

function normalizeBusinessProfile(profile: Partial<BusinessProfile>) {
  return {
    name: profile.name?.trim() || "MiTurnoListo",
    publicSlug: profile.publicSlug?.trim() ?? "",
    address: profile.address?.trim() ?? "",
    publicDescription: profile.publicDescription?.trim() ?? "",
    publicLogoUrl: profile.publicLogoUrl?.trim() ?? "",
    publicOpeningHours: profile.publicOpeningHours?.trim() ?? ""
  } satisfies BusinessProfile;
}

async function resolveUniqueBusinessSlug(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  name: string,
  businessId: string
) {
  const baseSlug = getSafePublicSlug(name, "negocio");

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index}`;
    const { data, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("public_slug", candidate)
      .neq("id", businessId)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return candidate;
    }
  }

  return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
}

function isPostgresUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
