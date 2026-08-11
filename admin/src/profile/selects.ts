// Keep the ordinary profile shape explicit so adding a sensitive column to
// public.profiles never makes it available to athlete/self-facing reads by
// accident. Coach-only notes are loaded from athlete_admin_notes instead.
// This must stay a string literal: supabase-js parses literal projections to
// infer the result shape, while a dynamically joined string loses that type.
export const PROFILE_SELECT = 'id, email, full_name, age, height_cm, weight_kg, gender, goal, activity_level, onboarding_complete, is_admin, is_blocked, access_mode, created_at, updated_at'

export const CHAT_PROFILE_SELECT = 'id, email, full_name'
