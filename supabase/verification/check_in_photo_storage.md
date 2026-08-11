# Check-in photo Storage verification

Do not run these probes until the Android/web clients are deployed, legacy
direct-upload compatibility has been explicitly accepted, and the iOS host has
an Xcode project with camera/photo-library usage descriptions. First apply
`supabase/rollouts/secure_check_in_photo_storage_after_client_adoption.sql` to
staging. Promote it to a newly timestamped migration only after the staging
probes pass, then use fresh tokens for two ordinary athlete accounts.

Set the project values, the current **Europe/Prague Monday**, and a prepared
JPEG that is at most 5 MiB:

```bash
export SUPABASE_URL='https://PROJECT_REF.supabase.co'
export SUPABASE_PUBLIC_KEY='...'
export ATHLETE_ACCESS_TOKEN='...'
export OTHER_ATHLETE_ACCESS_TOKEN='...'
export ATHLETE_USER_ID='00000000-0000-0000-0000-000000000000'
export OTHER_ATHLETE_USER_ID='00000000-0000-0000-0000-000000000001'
export CHECKIN_WEEK='2026-08-10'
export PREVIOUS_CHECKIN_WEEK='2026-08-03'
export CHECKIN_JPEG='/absolute/path/to/prepared-checkin.jpg'
```

Confirm in SQL first that the bucket is private, limited to 5 MiB, and permits
only `image/jpeg`:

```sql
SELECT public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'check-in-photos';
-- Expected: false, 5242880, {image/jpeg}
```

## Allowed create and upsert

Both requests must return 2xx. The second request exercises the separate
SELECT/UPDATE policies required by `upsert = true`.

```bash
export VALID_PATH="$ATHLETE_USER_ID/checkin_${CHECKIN_WEEK}_front.jpg"

curl --silent --show-error --output /tmp/checkin-upload.json \
  --write-out '%{http_code}\n' \
  --request POST \
  "$SUPABASE_URL/storage/v1/object/check-in-photos/$VALID_PATH" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  -H 'Content-Type: image/jpeg' \
  -H 'x-upsert: true' \
  --data-binary "@$CHECKIN_JPEG"

curl --silent --show-error --output /tmp/checkin-upsert.json \
  --write-out '%{http_code}\n' \
  --request POST \
  "$SUPABASE_URL/storage/v1/object/check-in-photos/$VALID_PATH" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  -H 'Content-Type: image/jpeg' \
  -H 'x-upsert: true' \
  --data-binary "@$CHECKIN_JPEG"
```

## Required rejection probes

Repeat the upload above with each path/header variant. Every request must be
non-2xx, and the valid object must remain readable afterward.

| Probe | Path/header change |
| --- | --- |
| another user's folder | `$OTHER_ATHLETE_USER_ID/checkin_${CHECKIN_WEEK}_front.jpg` |
| nested path | `$ATHLETE_USER_ID/nested/checkin_${CHECKIN_WEEK}_front.jpg` |
| wrong slot | `$ATHLETE_USER_ID/checkin_${CHECKIN_WEEK}_back.jpg` |
| wrong extension | `$ATHLETE_USER_ID/checkin_${CHECKIN_WEEK}_front.png` |
| prior Prague week | `$ATHLETE_USER_ID/checkin_${PREVIOUS_CHECKIN_WEEK}_front.jpg` |
| wrong MIME | valid `.jpg` path with `Content-Type: image/png` |
| oversized body | valid `.jpg` path and `image/jpeg`, body larger than 5 MiB |

Also request `VALID_PATH` with `OTHER_ATHLETE_ACCESS_TOKEN`; the other athlete
must not be able to read it. The owning athlete must be able to read both the
new object and a historical exact-path object:

```bash
curl --fail-with-body \
  "$SUPABASE_URL/storage/v1/object/authenticated/check-in-photos/$VALID_PATH" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $ATHLETE_ACCESS_TOKEN" \
  --output /tmp/checkin-download.jpg

curl --silent --show-error --output /tmp/checkin-other-user.json \
  --write-out '%{http_code}\n' \
  "$SUPABASE_URL/storage/v1/object/authenticated/check-in-photos/$VALID_PATH" \
  -H "apikey: $SUPABASE_PUBLIC_KEY" \
  -H "Authorization: Bearer $OTHER_ATHLETE_ACCESS_TOKEN"
```

Finally, submit a check-in through the deployed web and Android clients. Verify
that abandoning after selection creates no Storage object, successful Submit
creates only the exact front/side paths, and a forced database-save failure
removes a newly created object without deleting a pre-existing referenced one.
