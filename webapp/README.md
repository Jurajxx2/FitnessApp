# Coach Foska — User Web App

Mobile-first client web app for the Nutrition MVP, built with React, Vite, Tailwind, and Supabase.

## Local development

```bash
cd webapp
npm install
cp ../admin/.env .env
npm run dev
```

The web app uses the same Supabase project and anonymous key as the admin app.

## Test and build

```bash
npm test
npm run build
```

## Deploy with Netlify

- Set the base directory to `webapp`.
- Use `npm run build` as the build command.
- Publish `dist` (which resolves to `webapp/dist` from the repository root).
- Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as the admin site.
- On the admin site, configure `VITE_ATHLETE_APP_URL` with this deployed web-app URL. The public landing page and non-admin fallback use it to send trainees to the correct portal.
- SPA redirects and security headers are already defined in [`netlify.toml`](./netlify.toml).

## Scope

Nutrition only: meal plan, recipes and favorites, daily macro summary against targets, history, and meal logging. Authentication uses email and password as the primary login method, with email OTP as a fallback. The app reads and writes existing Supabase tables under their current RLS policies; it makes no backend changes.
