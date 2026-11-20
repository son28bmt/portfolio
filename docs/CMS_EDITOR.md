# CMS editor deployment

## Environment

Server upload processing requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_S3_ENDPOINT`, and `R2_PUBLIC_BASE_URL`. `R2_PUBLIC_BASE_URL` must be the HTTPS public origin for the bucket; when set, CMS cover and OG image URLs must be below its `/cms/` path.

`JWT_SECRET` is required for authenticated admin routes. `ADMIN_USERNAMES` identifies legacy user-admin accounts. Keep `AUTO_SCHEMA_BOOTSTRAP` unset or `false` in staging/production and run the SQL migration manually. It may be set to `true` only for a disposable local development database.

Google member sign-in additionally requires `GOOGLE_CLIENT_ID` on the server and `VITE_GOOGLE_CLIENT_ID` when building the public client. They should normally be the same Web OAuth client ID. Never put a Google client secret in Vite or browser code.

## Manual database rollout

1. Back up the staging database.
2. Run `server/scripts/sql/cms-editor-migration.sql` manually.
3. Check the pre-flight and post-flight statements emitted by that script.
4. Deploy server code, then admin and client bundles.

## New APIs

- `POST /api/admin/cms/upload-image`: editor/owner image upload, magic-byte validation, max 5 MB, WebP conversion.
- `GET /api/admin/cms/:postType/check-slug`, `GET /api/admin/cms/:postType/list`, `GET /api/admin/cms/:postType/:id`.
- `GET|POST /api/blog/:idOrSlug/revisions`, `POST /api/blog/:idOrSlug/restore/:revisionId`, `POST /api/blog/:idOrSlug/autosave`.
- `GET|POST /api/admin/guides/:id/revisions`, `POST /api/admin/guides/:id/restore/:revisionId`, `POST /api/admin/guides/:id/autosave`.
- `POST /api/auth/google`: verifies a Google Identity Services ID token, links by verified email or `google_sub`, and returns the existing member JWT.

Autosave requires the current `cmsVersion` value and returns `409` rather than overwrite a newer save, publish, schedule, or restore.

## Rollback

Revert the CMS code commits and redeploy the previous server/admin/client versions. Leave the new columns, indexes, and `post_revisions` table in place; they are backward-compatible and should not be dropped during rollback. Set `AUTO_SCHEMA_BOOTSTRAP=false`.

## Staging checklist

- Create, edit, preview, publish, archive, schedule, and restore one Blog and one Guide.
- Verify duplicate slug feedback and a direct API duplicate-slug rejection.
- Upload JPEG/PNG/WebP, reject a renamed text file and a file over 5 MB, and verify R2 result is WebP.
- Paste/drop an image, verify alt and caption, tables, lists, links, and approved YouTube embed.
- Verify scripts, event handlers, `javascript:` URLs, and non-YouTube iframes are removed.
- With two browser tabs, save in one then let the other autosave; verify the stale tab receives no overwrite.
- Run two server instances against staging and verify one scheduled post creates one publish revision.
- Configure a Google Web OAuth client, test login with a new member and an existing email, reject a token from another client ID, and verify Google login never grants admin/editor access.

## Phone checklist

- Test Blog and Guide editor at 320 px, 375 px, and 768 px widths.
- Verify toolbar wrapping, cover preview, fixed save controls, preview, navigation warning, image upload, and revision restore.