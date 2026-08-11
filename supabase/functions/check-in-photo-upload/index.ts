import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  isCurrentWeek,
  MAX_UPLOAD_BYTES,
  parseSlot,
  validateAndSanitizeImage,
} from "./logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-check-in-slot, x-check-in-week",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "AUTH_REQUIRED"
  | "ACCESS_DENIED"
  | "INVALID_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "STORAGE_LIMITED"
  | "NOT_CONFIGURED"
  | "INTERNAL_ERROR";

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(code: ErrorCode, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

class PayloadTooLargeError extends Error {}

async function readBoundedBody(req: Request): Promise<Uint8Array> {
  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_UPLOAD_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return error("METHOD_NOT_ALLOWED", "Method not allowed", 405);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return error("PAYLOAD_TOO_LARGE", "Photo must be no larger than 8 MB", 413);
  }
  const slot = parseSlot(req.headers.get("x-check-in-slot"));
  const week = req.headers.get("x-check-in-week");
  if (!slot || !isCurrentWeek(week)) {
    return error(
      "INVALID_REQUEST",
      "Provide a current-week front or side check-in photo",
      400,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("Check-in photo upload environment is not configured");
    return error("NOT_CONFIGURED", "Photo upload is not configured", 503);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return error("AUTH_REQUIRED", "Authentication required", 401);
  }
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await callerClient.auth
    .getUser();
  if (authError || !user) {
    return error("AUTH_REQUIRED", "Authentication required", 401);
  }

  try {
    const raw = await readBoundedBody(req);
    const image = validateAndSanitizeImage(
      raw,
      req.headers.get("content-type")?.split(";")[0].trim() ?? null,
    );
    if (!image) {
      return error("INVALID_REQUEST", "Provide a valid JPEG photo", 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("is_blocked")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Unable to verify check-in photo access", {
        userId: user.id,
        error: profileError.message,
      });
      return error("INTERNAL_ERROR", "Unable to verify photo access", 500);
    }
    if (!profile || profile.is_blocked) {
      return error("ACCESS_DENIED", "Check-in access required", 403);
    }

    const objectPath = `${user.id}/checkin_${week}_${slot}.${image.extension}`;
    const { data: reservationRows, error: reservationError } = await adminClient
      .rpc(
        "reserve_check_in_photo_upload",
        {
          p_user_id: user.id,
          p_object_path: objectPath,
          p_bytes: image.bytes.length,
        },
      );
    if (reservationError) {
      console.error("Unable to reserve check-in photo upload", {
        userId: user.id,
        error: reservationError.message,
      });
      return error("INTERNAL_ERROR", "Unable to verify upload limits", 500);
    }
    const reservation = Array.isArray(reservationRows)
      ? reservationRows[0]
      : reservationRows;
    if (!reservation?.reservation_id) {
      const code = reservation?.denial_reason === "storage"
        ? "STORAGE_LIMITED"
        : "RATE_LIMITED";
      return error(
        code,
        code === "STORAGE_LIMITED"
          ? "Photo storage limit reached"
          : "Photo upload limit reached",
        429,
      );
    }

    let succeeded = false;
    try {
      const { error: uploadError } = await adminClient.storage
        .from("check-in-photos")
        .upload(objectPath, image.bytes, {
          upsert: true,
          contentType: image.mimeType,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;
      succeeded = true;

      const alternateExtension = image.extension === "jpg" ? "png" : "jpg";
      const alternatePath =
        `${user.id}/checkin_${week}_${slot}.${alternateExtension}`;
      const { error: cleanupError } = await adminClient.storage.from(
        "check-in-photos",
      ).remove([alternatePath]);
      if (
        cleanupError &&
        !cleanupError.message.toLowerCase().includes("not found")
      ) {
        console.warn("Unable to remove superseded check-in photo", {
          userId: user.id,
        });
      }
      return json({
        path: objectPath,
        mime_type: image.mimeType,
        width: image.width,
        height: image.height,
      });
    } catch (uploadError) {
      console.error("Check-in photo storage failed", {
        userId: user.id,
        error: uploadError instanceof Error
          ? uploadError.message
          : "Unknown error",
      });
      return error("INTERNAL_ERROR", "Unable to store photo", 500);
    } finally {
      const { error: finishError } = await adminClient.rpc(
        "finish_check_in_photo_upload",
        {
          p_reservation_id: reservation.reservation_id,
          p_succeeded: succeeded,
        },
      );
      if (finishError) {
        console.error("Unable to finalize check-in photo reservation", {
          userId: user.id,
        });
      }
    }
  } catch (caught) {
    if (caught instanceof PayloadTooLargeError) {
      return error(
        "PAYLOAD_TOO_LARGE",
        "Photo must be no larger than 8 MB",
        413,
      );
    }
    console.error("check-in-photo-upload failed", {
      error: caught instanceof Error ? caught.message : "Unknown error",
    });
    return error("INTERNAL_ERROR", "Unable to upload photo", 500);
  }
});
