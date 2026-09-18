# notify — email on new messages

Sends email when a message is inserted: the member on a recipient's message
(plus a metadata-only awareness note to leaders on the first message), and the
recipient on a member's reply. No-ops cleanly until `RESEND_API_KEY` is set, so
the app works before email is configured.

## Setup (when the domain + Resend are ready)

1. **Resend:** verify the `ekkle.org` sending domain, create an API key.
2. **Deploy the function** (Supabase CLI):
   ```bash
   supabase functions deploy notify --no-verify-jwt
   ```
   `--no-verify-jwt` because the database webhook calls it, not a signed-in user.
3. **Set secrets:**
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx \
     NOTIFY_FROM="Ekklē <hello@ekkle.org>" \
     SITE_URL="https://ekkle.org"
   ```
   (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)
4. **Create a Database Webhook** (Dashboard → Database → Webhooks):
   - Table: `public.messages`, Events: `INSERT`
   - Type: Supabase Edge Function → `notify`

That's it — new messages then trigger the right emails. Until step 1–4 are done,
in-app messaging + the unread badge still work; only email is inactive.
