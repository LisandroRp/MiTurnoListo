import { NextRequest, NextResponse } from "next/server";

import { isFeatureSuggestionStatus, validateFeatureSuggestionInput } from "@/lib/feature-suggestions";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";
import { formatTodayForTimeZone } from "@/lib/networking/utils/date-time";

const defaultTimeZone = "America/Argentina/Buenos_Aires";

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  if (request.nextUrl.searchParams.get("scope") === "all") {
    return loadAllSuggestions(authResult.userId);
  }

  const businessId = request.nextUrl.searchParams.get("businessId")?.trim();

  if (!businessId) {
    return apiError("FEATURE_SUGGESTION_BUSINESS_REQUIRED", "Missing businessId.", 400);
  }

  const contextResult = await loadBusinessContext(businessId, authResult.userId);

  if ("response" in contextResult) {
    return contextResult.response;
  }

  const submissionDate = formatTodayForTimeZone(contextResult.timeZone);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feature_suggestions")
    .select("id, business_id, submitted_by_email, title, description, status, reviewed_at, created_at")
    .eq("user_id", authResult.userId)
    .eq("submission_date", submissionDate)
    .limit(1)
    .maybeSingle();

  if (error) {
    return apiError("FEATURE_SUGGESTION_STATUS_FAILED", "Unable to load suggestion availability.", 500);
  }

  return NextResponse.json({
    canSubmitToday: !data,
    submittedToday: data ? mapSuggestion(data, contextResult.businessName) : null
  });
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  const payload = await request.json().catch(() => null);
  const businessId = isRecord(payload) && typeof payload.businessId === "string" ? payload.businessId.trim() : "";
  const validation = validateFeatureSuggestionInput(payload);

  if (!businessId || !validation.isValid) {
    return apiError("FEATURE_SUGGESTION_INVALID", "Check the suggestion fields and try again.", 400);
  }

  const contextResult = await loadBusinessContext(businessId, authResult.userId);

  if ("response" in contextResult) {
    return contextResult.response;
  }

  const supabase = getSupabaseAdminClient();
  const submissionDate = formatTodayForTimeZone(contextResult.timeZone);
  const { data, error } = await supabase
    .from("feature_suggestions")
    .insert({
      business_id: businessId,
      description: validation.input.description,
      submission_date: submissionDate,
      submitted_by_email: authResult.email,
      title: validation.input.title,
      user_id: authResult.userId
    })
    .select("id, business_id, submitted_by_email, title, description, status, reviewed_at, created_at")
    .single();

  if (error?.code === "23505") {
    return apiError("FEATURE_SUGGESTION_DAILY_LIMIT", "You already submitted a suggestion today.", 429);
  }

  if (error || !data) {
    return apiError("FEATURE_SUGGESTION_CREATE_FAILED", "Unable to submit the suggestion.", 500);
  }

  return NextResponse.json({
    data: mapSuggestion(data, contextResult.businessName)
  }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const authResult = await authenticateRequest(request);

  if ("response" in authResult) {
    return authResult.response;
  }

  const authorizationResult = await authorizeSuperAdmin(authResult.userId);

  if (authorizationResult) {
    return authorizationResult;
  }

  const payload = await request.json().catch(() => null);
  const suggestionId = isRecord(payload) && typeof payload.id === "string" ? payload.id.trim() : "";
  const status = isRecord(payload) ? payload.status : null;

  if (!suggestionId || !isFeatureSuggestionStatus(status)) {
    return apiError("FEATURE_SUGGESTION_STATUS_INVALID", "Invalid suggestion status.", 400);
  }

  const reviewedAt = status === "pending" ? null : new Date().toISOString();
  const reviewedBy = status === "pending" ? null : authResult.userId;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feature_suggestions")
    .update({
      reviewed_at: reviewedAt,
      reviewed_by: reviewedBy,
      status
    })
    .eq("id", suggestionId)
    .select("id, status, reviewed_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    return apiError("FEATURE_SUGGESTION_STATUS_UPDATE_FAILED", "Unable to update the suggestion.", 500);
  }

  if (!data) {
    return apiError("FEATURE_SUGGESTION_NOT_FOUND", "Suggestion not found.", 404);
  }

  return NextResponse.json({
    data: {
      id: data.id,
      reviewedAt: data.reviewed_at,
      status: data.status
    }
  });
}

async function loadAllSuggestions(userId: string) {
  const authorizationResult = await authorizeSuperAdmin(userId);

  if (authorizationResult) {
    return authorizationResult;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("feature_suggestions")
    .select("id, business_id, submitted_by_email, title, description, status, reviewed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return apiError("FEATURE_SUGGESTIONS_LOAD_FAILED", "Unable to load feature suggestions.", 500);
  }

  const rows = (data ?? []) as FeatureSuggestionRow[];
  const businessIds = [...new Set(rows.map((row) => row.business_id))];
  const { data: businesses, error: businessesError } = businessIds.length > 0
    ? await supabase.from("businesses").select("id, name").in("id", businessIds)
    : { data: [], error: null };

  if (businessesError) {
    return apiError("FEATURE_SUGGESTIONS_LOAD_FAILED", "Unable to load feature suggestions.", 500);
  }

  const businessNames = new Map((businesses ?? []).map((business) => [business.id, business.name ?? "Sin nombre"]));

  return NextResponse.json({
    data: rows.map((row) => mapSuggestion(row, businessNames.get(row.business_id) ?? "Sin nombre"))
  });
}

async function authorizeSuperAdmin(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return apiError("SUPER_ADMIN_CHECK_FAILED", "Unable to validate super admin permissions.", 500);
  }

  return data ? null : apiError("SUPER_ADMIN_FORBIDDEN", "Forbidden.", 403);
}

async function authenticateRequest(request: NextRequest): Promise<
  | { email: string; userId: string }
  | { response: NextResponse }
> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return { response: apiError("AUTH_REQUIRED", "Missing authorization token.", 401) };
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error || !user?.id || !user.email) {
    return { response: apiError("AUTH_INVALID", "Invalid session.", 401) };
  }

  return { email: user.email, userId: user.id };
}

async function loadBusinessContext(businessId: string, userId: string): Promise<
  | { businessName: string; timeZone: string }
  | { response: NextResponse }
> {
  const supabase = getSupabaseAdminClient();
  const [membershipResult, businessResult] = await Promise.all([
    supabase
      .from("business_memberships")
      .select("role")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("businesses")
      .select("name, timezone")
      .eq("id", businessId)
      .limit(1)
      .maybeSingle()
  ]);

  if (membershipResult.error || businessResult.error) {
    return { response: apiError("FEATURE_SUGGESTION_CONTEXT_FAILED", "Unable to validate the business.", 500) };
  }

  if (!membershipResult.data || !businessResult.data) {
    return { response: apiError("FEATURE_SUGGESTION_FORBIDDEN", "Business membership not found.", 403) };
  }

  return {
    businessName: businessResult.data.name ?? "Sin nombre",
    timeZone: businessResult.data.timezone ?? defaultTimeZone
  };
}

function mapSuggestion(row: FeatureSuggestionRow, businessName: string) {
  return {
    businessId: row.business_id,
    businessName,
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    reviewedAt: row.reviewed_at,
    status: row.status,
    submittedByEmail: row.submitted_by_email,
    title: row.title
  };
}

function apiError(code: string, error: string, status: number) {
  return NextResponse.json({ code, error }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type FeatureSuggestionRow = {
  business_id: string;
  created_at: string;
  description: string;
  id: string;
  reviewed_at: string | null;
  status: "pending" | "done" | "rejected";
  submitted_by_email: string;
  title: string;
};
