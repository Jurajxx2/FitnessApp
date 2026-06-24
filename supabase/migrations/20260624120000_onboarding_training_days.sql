-- Add per-day training selection and notification opt-in to onboarding responses.
ALTER TABLE onboarding_responses
  ADD COLUMN training_days         TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT false;
