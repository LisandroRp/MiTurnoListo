import { NextRequest, NextResponse } from "next/server";

import { BusinessProfile } from "@/features/scheduling/types";
import { createApiErrorResponse, getSafeErrorMessage } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

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
    const { data, error } = await supabase
      .from("businesses")
      .update({
        name: nextProfile.name,
        address: nextProfile.address || null,
        public_description: nextProfile.publicDescription || null,
        public_logo_url: nextProfile.publicLogoUrl || null,
        public_opening_hours: nextProfile.publicOpeningHours || null
      })
      .eq("id", businessId)
      .select("name, address, public_description, public_logo_url, public_opening_hours")
      .limit(1)
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      profile: {
        name: data.name,
        address: data.address ?? "",
        publicDescription: data.public_description ?? "",
        publicLogoUrl: data.public_logo_url ?? "",
        publicOpeningHours: data.public_opening_hours ?? ""
      } satisfies BusinessProfile
    });
  } catch (error) {
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
    address: profile.address?.trim() ?? "",
    publicDescription: profile.publicDescription?.trim() ?? "",
    publicLogoUrl: profile.publicLogoUrl?.trim() ?? "",
    publicOpeningHours: profile.publicOpeningHours?.trim() ?? ""
  } satisfies BusinessProfile;
}
