import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token);

  if (authError || !user?.id) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { data: superAdmin, error: superAdminError } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (superAdminError) {
    return createApiErrorResponse(superAdminError, {
      code: "SUPER_ADMIN_STATUS_CHECK_FAILED",
      fallbackMessage: "Unable to validate super admin permissions.",
      status: 500
    });
  }

  return NextResponse.json({
    isSuperAdmin: Boolean(superAdmin)
  });
}
