-- Migration: add external_id, photo_file_name, photo_url to recipes
-- Purpose: support stable import identifiers and recipe photos

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS external_id   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS photo_file_name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url     TEXT;
