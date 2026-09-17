# Medical Treatment Guide — Supabase + PWA

## Included
- Home page with editable slider and information blocks
- Treatment listing
- Treatment detail page:
  - Disease English name
  - Nepali name
  - C.O / chief complaints
  - Medicine
  - Doctor treatment procedure (point-wise)
  - Detailed disease information
  - Multiple images
  - Notes
- Supabase email/password admin authentication
- Admin CRUD for Home and Treatments
- IndexedDB offline cache
- Automatic online synchronization
- PWA install/download button
- Service worker app-shell caching

## 1. Create Supabase database
Open Supabase SQL Editor and run `supabase_schema.sql`.

## 2. Create admin account
In Supabase Dashboard:
Authentication -> Users -> Add user
Create the email/password account you want to use for the Admin page.

## 3. Add the Supabase public anon key
Open `app.js` and replace:

PASTE_YOUR_SUPABASE_ANON_KEY_HERE

with your project's **anon/public** key.

Do NOT put the Supabase service_role/secret key in this website.

The project URL is already set for:
https://cdqsuqndnqfgcmytostj.supabase.co

## 4. Images
The current admin form accepts image URLs. A simple approach:
1. Create a public Storage bucket called `treatment-images`.
2. Upload an image.
3. Copy its public URL.
4. Paste one URL per line in the treatment Images field.

## 5. Run the PWA
A service worker normally requires HTTPS or localhost.

For local development:
- VS Code + Live Server, or
- `python -m http.server 8000`

Then open:
http://localhost:8000

For production, deploy the folder to an HTTPS host.

## Offline behavior
The first successful online load downloads the published Home and Treatment data into IndexedDB.

When offline:
- Home uses cached content.
- Treatment listing uses cached content.
- Treatment details use cached content.
- The app shell is cached by the service worker.

When the device reconnects:
- The app requests current published Home/Treatment rows from Supabase.
- IndexedDB is replaced with the newest data.
- The UI refreshes automatically.

## Admin security note
The included SQL gives management permission to every authenticated Supabase user.

If this project will have more than one user, create an admin-role/profile table and restrict INSERT/UPDATE/DELETE policies to designated admins. Do not solve this by exposing a service-role key in JavaScript.

## Important medical-content note
This is a content-management/display system, not a clinical decision-support validation system. Treatment/medicine content should be reviewed and maintained by an appropriately qualified professional.
