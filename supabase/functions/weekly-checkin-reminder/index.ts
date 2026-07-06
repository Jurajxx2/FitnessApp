import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"
import { mondayOf, usersNeedingReminder } from "./reminder.ts"

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID")
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY")

    const supabase = createClient(supabaseUrl, serviceKey)
    const week = mondayOf(new Date())

    // All active trainees (non-admin, non-blocked).
    const { data: trainees, error: tErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_admin", false)
      .eq("is_blocked", false)
    if (tErr) {
      console.error("profiles query failed:", tErr)
      return new Response("profiles_error", { status: 200 })
    }

    // Who already checked in this week.
    const { data: done, error: cErr } = await supabase
      .from("check_ins")
      .select("user_id")
      .eq("week_of", week)
    if (cErr) {
      console.error("check_ins query failed:", cErr)
      return new Response("checkins_error", { status: 200 })
    }

    const checkedIn = new Set((done ?? []).map((r: { user_id: string }) => r.user_id))
    const targetIds = usersNeedingReminder(trainees ?? [], checkedIn)
    if (targetIds.length === 0) return new Response("nobody_to_remind", { status: 200 })

    if (!fcmProjectId || !fcmServerKey) {
      console.log(`FCM not configured — would remind ${targetIds.length} users`)
      return new Response("fcm_not_configured", { status: 200 })
    }

    const { data: tokens, error: dErr } = await supabase
      .from("device_tokens")
      .select("token")
      .in("user_id", targetIds)
    if (dErr) {
      console.error("device_tokens query failed:", dErr)
      return new Response("tokens_error", { status: 200 })
    }

    const sends = (tokens ?? []).map(({ token }: { token: string }) =>
      fetch(`https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${fcmServerKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: "Weekly check-in",
              body: "How did your week go? Tap to complete your check-in.",
            },
            data: { screen: "check_in" },
          },
        }),
      }),
    )
    const results = await Promise.allSettled(sends)
    const failures = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
    ).length
    if (failures > 0) console.error(`${failures}/${sends.length} FCM sends failed`)
    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error("weekly-checkin-reminder error:", err)
    return new Response("error", { status: 500 })
  }
})
