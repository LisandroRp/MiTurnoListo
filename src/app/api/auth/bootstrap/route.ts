import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

type BootstrapPayload = {
  timeZone?: string;
};

const defaultLocale = "es";
const defaultTheme = "coral";
const defaultSubscriptionTier = "free";
const fallbackTimeZone = "UTC";

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({})) as BootstrapPayload;
  const timeZone = payload.timeZone?.trim() || fallbackTimeZone;
  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user?.id || !user.email) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const seed = buildDefaultSeed(user.email);
  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id, role, locale, theme")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return createApiErrorResponse(membershipError, {
      code: "BOOTSTRAP_MEMBERSHIP_INSPECT_FAILED",
      fallbackMessage: "Unable to inspect the workspace membership.",
      status: 500
    });
  }

  const businessId = membership?.business_id ?? crypto.randomUUID();
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (profileError) {
    return createApiErrorResponse(profileError, {
      code: "BOOTSTRAP_PROFILE_INSPECT_FAILED",
      fallbackMessage: "Unable to inspect the user profile.",
      status: 500
    });
  }

  if (!profile) {
    const { error: insertProfileError } = await supabase
      .from("user_profiles")
      .insert({
        id: user.id,
        first_name: seed.profileName,
        last_name: "",
        avatar_url: null
      });

    if (insertProfileError) {
      return createApiErrorResponse(insertProfileError, {
        code: "BOOTSTRAP_PROFILE_CREATE_FAILED",
        fallbackMessage: "Unable to create the user profile.",
        status: 500
      });
    }
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", businessId)
    .limit(1)
    .maybeSingle();

  if (businessError) {
    return createApiErrorResponse(businessError, {
      code: "BOOTSTRAP_BUSINESS_INSPECT_FAILED",
      fallbackMessage: "Unable to inspect the business.",
      status: 500
    });
  }

  if (!business) {
    const { error: insertBusinessError } = await supabase
      .from("businesses")
      .insert({
        id: businessId,
        slug: buildBusinessSlug(seed.businessName, businessId),
        name: seed.businessName,
        address: null,
        subscription_tier: defaultSubscriptionTier,
        timezone: timeZone
      });

    if (insertBusinessError) {
      return createApiErrorResponse(insertBusinessError, {
        code: "BOOTSTRAP_BUSINESS_CREATE_FAILED",
        fallbackMessage: "Unable to create the business.",
        status: 500
      });
    }
  }

  if (!membership) {
    const { error: insertMembershipError } = await supabase
      .from("business_memberships")
      .insert({
        business_id: businessId,
        user_id: user.id,
        role: "owner",
        locale: defaultLocale,
        theme: defaultTheme
      });

    if (insertMembershipError) {
      return createApiErrorResponse(insertMembershipError, {
        code: "BOOTSTRAP_MEMBERSHIP_CREATE_FAILED",
        fallbackMessage: "Unable to create the workspace membership.",
        status: 500
      });
    }
  } else if (!membership.locale || !membership.theme) {
    const { error: updateMembershipError } = await supabase
      .from("business_memberships")
      .update({
        locale: membership.locale ?? defaultLocale,
        theme: membership.theme ?? defaultTheme
      })
      .eq("business_id", businessId)
      .eq("user_id", user.id);

    if (updateMembershipError) {
      return createApiErrorResponse(updateMembershipError, {
        code: "BOOTSTRAP_MEMBERSHIP_UPDATE_FAILED",
        fallbackMessage: "Unable to complete the workspace membership.",
        status: 500
      });
    }
  }

  return NextResponse.json({
    businessId,
    role: membership?.role ?? "owner"
  });
}

function buildDefaultSeed(email: string) {
  const localPart = email.split("@")[0]?.trim() || "nuevo-negocio";
  const normalizedLabel = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const profileName = normalizedLabel ? toTitleCase(normalizedLabel) : "Nuevo Negocio";

  return {
    businessName: profileName,
    profileName
  };
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function buildBusinessSlug(name: string, businessId: string) {
  const normalizedName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = businessId.replace(/-/g, "").slice(0, 8);

  return `${normalizedName || "negocio"}-${suffix}`;
}
