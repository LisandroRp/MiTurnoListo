import { NextRequest, NextResponse } from "next/server";

import { activateReferralProgramForUser, getReferralSummary } from "@/lib/referrals";
import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const summary = await getReferralSummary({
      origin: request.nextUrl.origin,
      supabase: authResult.supabase,
      userId: authResult.user.id
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return createApiErrorResponse(error, {
      code: "REFERRAL_SUMMARY_FAILED",
      fallbackMessage: "No pudimos cargar tu plan de referidos.",
      status: 500
    });
  }
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  try {
    const summary = await activateReferralProgramForUser({
      origin: request.nextUrl.origin,
      supabase: authResult.supabase,
      user: authResult.user
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return createApiErrorResponse(error, {
      code: "REFERRAL_ACTIVATION_FAILED",
      fallbackMessage: "No pudimos activar tu código de referidos.",
      status: 500
    });
  }
}

async function authenticateRequest(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return {
      response: NextResponse.json({ error: "Missing authorization token." }, { status: 401 })
    };
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Invalid session." }, { status: 401 })
    };
  }

  return { supabase, user };
}
