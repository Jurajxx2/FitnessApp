import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4"

serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record

    // Only notify the user when their coach sends a human chat message
    if (record.chat_type !== "human" || record.sender_type !== "coach") {
      return new Response("skipped", { status: 200 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const fcmProjectId = Deno.env.get("FCM_PROJECT_ID")
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY")

    if (!fcmProjectId || !fcmServerKey) {
      console.log("FCM not configured — skipping push notification")
      return new Response("fcm_not_configured", { status: 200 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: tokens, error } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", record.user_id)

    if (error) {
      console.error("Failed to fetch device tokens:", error)
      return new Response("token_fetch_error", { status: 200 })
    }

    if (!tokens || tokens.length === 0) {
      return new Response("no_tokens", { status: 200 })
    }

    const body = record.text_content
      ? record.text_content.substring(0, 100)
      : "New message from your coach"

    const sends = tokens.map(({ token }: { token: string }) =>
      fetch(
        `https://fcm.googleapis.com/v1/projects/${fcmProjectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${fcmServerKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: "Coach", body },
              data: { chat_type: "human", screen: "chat" },
            },
          }),
        }
      )
    )

    const results = await Promise.allSettled(sends)
    const failures = results.filter((r) => r.status === "rejected").length
    if (failures > 0) {
      console.error(`${failures}/${tokens.length} FCM sends failed`)
    }

    return new Response("ok", { status: 200 })
  } catch (err) {
    console.error("notify-chat-message error:", err)
    return new Response("error", { status: 500 })
  }
})
