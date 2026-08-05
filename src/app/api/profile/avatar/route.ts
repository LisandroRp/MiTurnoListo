import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse, getSafeErrorMessage } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

type ProfileAvatarPayload = {
  avatarUrl?: string;
  businessId?: string;
};

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json() as ProfileAvatarPayload;
    const businessId = payload.businessId?.trim();

    if (!businessId) {
      return NextResponse.json({ error: "Missing business id." }, { status: 400 });
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

    const nextAvatarUrl = payload.avatarUrl?.trim() || null;
    const { data, error } = await supabase
      .from("user_profiles")
      .update({ avatar_url: nextAvatarUrl })
      .eq("id", user.id)
      .select("avatar_url")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    return NextResponse.json({ avatarUrl: data.avatar_url ?? "" });
  } catch (error) {
    return createApiErrorResponse(getSafeErrorMessage(error, "Unable to save profile image."), {
      code: "PROFILE_AVATAR_SAVE_FAILED",
      fallbackMessage: "Unable to save profile image.",
      status: 500
    });
  }
}
