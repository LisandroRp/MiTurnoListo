import { NextRequest, NextResponse } from "next/server";

import { createApiErrorResponse, getSafeErrorMessage } from "@/lib/networking/api-errors";
import { getSupabaseAdminClient } from "@/lib/networking/clients/supabase-admin";

const businessAssetsBucket = "business-assets";
const allowedContentTypes = ["image/webp"];
const maxUploadedImageSize = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const businessId = String(formData.get("businessId") ?? "").trim();
    const path = String(formData.get("path") ?? "").trim();
    const file = formData.get("file");

    if (!businessId || !path || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing upload data." }, { status: 400 });
    }

    if (!isAllowedStoragePath(path, businessId)) {
      return NextResponse.json({ error: "Invalid upload path." }, { status: 400 });
    }

    if (!allowedContentTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid image format." }, { status: 400 });
    }

    if (file.size > maxUploadedImageSize) {
      return NextResponse.json({ error: "Image is too large." }, { status: 400 });
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

    const { error: uploadError } = await supabase.storage
      .from(businessAssetsBucket)
      .upload(path, file, {
        cacheControl: "3600",
        contentType: "image/webp",
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(businessAssetsBucket)
      .getPublicUrl(path);

    return NextResponse.json({ publicUrl: `${data.publicUrl}?v=${Date.now()}` });
  } catch (error) {
    return createApiErrorResponse(getSafeErrorMessage(error, "Unable to upload image."), {
      code: "ASSET_UPLOAD_FAILED",
      fallbackMessage: "Unable to upload image.",
      status: 500
    });
  }
}

function isAllowedStoragePath(path: string, businessId: string) {
  if (!path.startsWith(`${businessId}/`) || path.includes("..") || path.includes("//")) {
    return false;
  }

  return /^[-\w]+\/(?:logo|profile\/avatar|services\/[-\w]+|employees\/[-\w]+)\.webp$/.test(path);
}
