# Enhancements: technical integration report

## Status

Implemented locally on `feature/enhancements`, based on
`1bd32d6648e7f2415dc439594072584ba223f085`. GitHub's commits endpoint confirmed
that this is still the project repository's `main` head at inspection time.
The initial changes were prepared as local review commit `65dd0df`. The user
subsequently authorized publishing only `feature/enhancements` to run CI.
**No remote PR, production deployment, scheduler change, secret change, or
production data operation is authorized by that branch-publication request.**

CI now runs on pushes to `feature/enhancements` as well as `main`. Container
publishing remains restricted to pushes to `main`, so branch tests cannot
overwrite GHCR `latest` tags. Cloud Run and Pages push triggers remain restricted
to `main`. This report records local validation; subsequent GitHub Actions
results must be checked separately before any release decision.

**Release gate: full builds, runtime tests, migration tests, and rendered-page
QA still need to pass in an environment with the project dependencies.**
The checks completed here are listed precisely below; the branch is not signed
off for production deployment.

## Source review and duplicate avoidance

Project: <https://github.com/yash-rai-93/Agentic-Customer-Support-System>.

Reference: <https://github.com/LikhithV02/Customer-Support-Agent>.

Both complete commit listings returned by GitHub were reviewed. Native git
fetch is blocked by the host's network/approval policy, so source contents,
histories, individual commit diffs, PR file diffs, merge metadata, and the two
updated screenshots were fetched through the connected GitHub reader instead.
The local git checkout remains shallow; upstream commit objects were not
imported into it.

| Date | Source feature commits | Reviewed merge | Integration |
|---|---|---|---|
| Oct 12 | `f7edd5883cae9808ec44089ef62a29f58db749e7` | PR #11: `fce65f6e820799977948076b8d8cd6c580fe62c3` | Landing redesign; matching chat palette, fonts and mark; updated dark screenshots |
| Oct 12 | `cd19531ca45f436bf76f2295b2bb21588ffab3f4` | Same PR #11 merge | Preview-only `previews` block, adapted to the existing Worker config |
| Oct 13 | `bd3d73a6e2f8fc933f4cb961902c2d7e3ea89010` | PR #12: `794ba0a667e6c416e330661b9449682618b91e77` | Eval counts corrected; README improvements adapted to this project's existing evidence and structure |
| Oct 13 | `c0efbccf91a0299cf7d1c19b2e6ef73ce9bffd98` | PR #13: `73499b5732a447b1a36bc688c71620514d462568` | Archive table and migration, breach checking, triage/export CLI, expiry, metadata, privacy copy and operator docs |

For each PR, the merge's per-file patches matched the PR file patches exactly.
Changes were applied once by feature, not by applying both feature and merge
commits. Reviewed patches passed `git apply --check` against the local content
before application. Custom README, author config, HTML metadata and Worker
settings were adapted separately. The initial checkout had no archive model,
new maintenance modules, or preview block, and used the earlier landing layout.

## Features and adaptations

- Landing case study: an illustrative four-scenario trace, system/trust-boundary
  diagrams, policy ladder, evaluation matrix, adversarial results, and load
  charts. Dark palette and Geist fonts match the chat app; chat light mode and
  saved theme choices remain supported.
- Project-specific title, repository links, existing author settings, existing
  app branding, and deployment origins are preserved. General UI does not link
  to the reference owner's project. Existing attribution in the project README
  remains intact.
- Result summaries distinguish 83 defined cases from the 82-case committed
  Gemini baseline. Historical fake-model load figures are not advertised as
  current Cloud Run/Gemini capacity. Promptfoo is described as optional and
  currently skipped. Trace examples are labeled illustrative rather than live.
- Dark screenshots are the reviewed PR #11 assets (blob SHAs
  `9e3f1c46ca577851cab022a165133f1cbc4e6b57` and
  `a62cb6fcf31c874e7dfd320d39c960de9a265c43`), not screenshots from a test of
  this branch or new traffic against production. Historical light screenshots
  are retained and labeled as such. The existing OG card remains in its earlier
  theme.
- Cloudflare gets only `previews: {}`. The existing production config values
  compare equal after removing that one new property. A CI dry-run validation
  step and staging/CORS instructions were added; no automatic deployment was
  run. Non-production builds must use an explicitly configured staging API.
- Archive snapshots and demo deletion share a transaction. The archive stores
  ordered messages/events, synthetic order context, decisions, triage flags,
  breach findings, and available Opik trace references. Archive expiry uses
  `RETENTION_DAYS` measured from archival, with a 90-day default.
- The local CLI offers `list`, `show`, `scan`, and `export`. Database reads do
  not mutate records; `export --write` deliberately writes a local YAML eval
  case. `DEMO_DATABASE_URL` is a new optional CLI selector; existing environment
  variable names and deployment values are unchanged. PyYAML is now an explicit
  runtime dependency rather than relying on a transitive install.
- `/api/meta` adds only `demo.transcript_retention_days`; existing endpoint
  declarations and response fields remain. The frontend field is optional for
  compatibility with an older backend during a coordinated release.

### Safety improvements beyond the source patch

- General retention also archives selected demo conversations, so
  `--demo-hours 0` cannot silently bypass archival.
- Explicitly flush archive writes before live-row deletion; any failure rolls
  back the batch. Repeat cleanup does not duplicate archive rows.
- PostgreSQL cleanup selection uses row locks with `SKIP LOCKED` to avoid two
  cleanup workers choosing the same batch. PostgreSQL behavior still needs a
  runtime integration test.
- Dry runs count the complete backlog rather than just the first 500 rows.
  Nonpositive retention windows are rejected; CLI `--demo-hours 0` still means
  skip sandbox cleanup.
- Single-conversation triage is restricted to demo customers. Empty
  conversations cannot become invalid empty eval cases; unknown fixture suffixes
  are not converted into undefined placeholders. Eval files use explicit UTF-8.
- Unknown fixture scenarios are flagged for manual review. Possible ID/prompt
  leakage remains a heuristic requiring review, not a confirmed security claim.

## Preserved integration contracts

Static comparisons confirmed 21 protected files unchanged: API/config/auth
helpers, model factory and LangGraph runner/tools, Redis/database connection
code, Opik tracing, Cloud Run deployment workflow/templates/script, Pages
workflow/base-path config, author settings, and the production frontend API
origin. The API route declarations also compare equal. Production services
were not contacted for testing, including demo session creation.

## Tests and validation

| Check | Result and limits |
|---|---|
| Python AST syntax | PASS: all 53 backend Python files parse |
| Pure breach-check/export logic | PASS: 6 dependency-free checks execute the actual production function bodies with synthetic objects: eligible/forbidden decisions, duplicates/ownership, possible leak and flags, unknown/safe outcomes, placeholder/brace export, and empty export rejection. Application imports and database code were deliberately excluded; this is not a pytest suite result. |
| Protected integration files | PASS: 21 files compare unchanged |
| API contracts | PASS for unchanged route declarations; additive metadata diff reviewed. Runtime HTTP/CORS/SSE behavior NOT executed. |
| Cloudflare config | JSONC parses; production values unchanged; preview property confirmed in Cloudflare's official `workers-sdk` source at `wrangler@4.149.0`. Actual Wrangler dry run NOT executed. |
| Package/lock consistency | PASS: both apps' direct dependency maps match the lockfile root entries |
| Relative frontend/landing imports | PASS: local targets exist. External modules, TypeScript types and bundle output NOT validated. |
| Archive migration structure | PASS: all 12 model/migration column names agree; archive has no foreign keys to live tables. Database migration execution/drift check NOT run. |
| Screenshots | Reviewed both provided dark images visually. Responsive rendering and behavior of this branch NOT tested in a browser. |
| Diff hygiene | `git diff --check` passed before staging |
| Full backend pytest | BLOCKED: pytest, SQLAlchemy, fakeredis, Alembic and other requirements are absent. Explicit pytest invocation reports no pytest module. |
| Dependency installation | BLOCKED: local venv bootstrap fails; pip cannot obtain requested packages; bundled pnpm fails with a host symlink permission error. No dependency versions were silently substituted. |
| Frontend/landing production builds | NOT RUN: dependency installation is blocked; npm is not on PATH |
| Ruff/runtime imports | NOT RUN: required tooling/dependencies unavailable |
| PostgreSQL/Redis/container tests | NOT RUN: Docker and test services unavailable |
| Dependency vulnerability audit | NOT RUN: package/runtime and registry access unavailable. Changed code was reviewed for unsafe YAML loading, raw SQL interpolation, credential exposure and public archive access; this does not establish a vulnerability-free dependency graph. |

The normal pytest coverage added/imported in `tests/test_archive.py` covers full
snapshots, breach logging, possible leaks, expiry, eval-harness export, metadata,
archive failure rollback, dry runs, general purge, idempotence, backlog counting,
invalid windows, ownership/duplicates, demo-only triage, UTF-8 writes, and scan
exit status. These tests still need to be executed with the real dependencies.

## Compatibility issues and release risks

1. Migration `0002` is required before the new cleanup job runs. It is additive,
   but SQLite and PostgreSQL migration execution and drift checks are pending.
2. Archives contain user-supplied chat text and increase PostgreSQL storage.
   Review access, capacity and retention before production. No new public
   archive API was added.
3. Breach checks cover synthetic fixture branches and recorded ledger data;
   `possible_data_leak` may quote a visitor-supplied ID. They do not prove the
   absence of all data leaks or policy failures.
4. Frontend previews do not isolate backend data automatically. An explicit
   staging API/CORS setup is required; production API variables are preserved.
5. The cleanup Python function `purge_demo` now returns a tuple of sandbox,
   archive and breach counts. Its local callers/tests were updated; HTTP
   contracts are unchanged.
6. Deploy the backend/cleanup migration before publishing the retention notice.
   Keep cleanup paused if rolling back to old code that deletes without archival.
   Do not drop the archive table as a routine rollback: downgrade destroys data.
7. Already-purged data cannot be recovered. The CLI's file-export workflow is
   intended for a full repository checkout; the backend container does not ship
   the eval case directory.

## Run the remaining checks safely

Use a new local terminal and disposable databases. Do not load production
credentials. The commands below assume Bash; use PowerShell equivalents for
environment assignment/activation on Windows.

```bash
cd frontend
npm ci
npm run build
npm run build:cloudflare
npx wrangler deploy --dry-run --outdir wrangler-dry-run
cd ../landing
npm ci
npm run build

cd ../backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
unset TEST_DATABASE_URL TEST_REDIS_URL
pytest -q
ruff check .

# Disposable migration database only:
mkdir -p var
export DATABASE_URL=sqlite:///./var/enhancements-check.db
alembic upgrade head
alembic check
alembic downgrade 0001
alembic upgrade head
alembic check
```

Repeat the suite/migration checks with explicitly isolated PostgreSQL and Redis
instances as CI does. Test the local demo's session/auth, refund decision and
SSE flow; inspect archives only in that disposable database. Verify the landing
at desktop and phone widths, keyboard navigation of all four trace tabs, chat
light/dark themes, local API integration, and all CTA links. Review the
dependency audits with registry access.

After successful local/staging checks, ask for explicit permission to push the
feature branch for CI/preview review. No remote PR should be created without
permission. Production deployment requires a further explicit authorization;
follow [demo triage release ordering](DEMO_TRIAGE.md#release-ordering), the
existing Cloud Run pipeline, and the preview instructions in [DEPLOY.md](DEPLOY.md).

## Added, modified, and removed files

Generated from the local working diff before the review commit:

| Change | File |
|---|---|
| Modified | `.env.example` |
| Modified | `.github/workflows/ci.yml` |
| Modified | `README.md` |
| Modified | `backend/app/db/models.py` |
| Modified | `backend/app/main.py` |
| Modified | `backend/app/maintenance/retention.py` |
| Modified | `backend/evals/README.md` |
| Modified | `backend/requirements.txt` |
| Modified | `backend/tests/test_demo.py` |
| Modified | `docs/DEPLOY.md` |
| Modified | `frontend/index.html` |
| Modified | `frontend/package-lock.json` |
| Modified | `frontend/package.json` |
| Modified | `frontend/public/favicon.svg` |
| Modified | `frontend/public/theme-init.js` |
| Modified | `frontend/src/components/Logo.tsx` |
| Modified | `frontend/src/components/ui/index.tsx` |
| Modified | `frontend/src/index.css` |
| Modified | `frontend/src/main.tsx` |
| Modified | `frontend/src/pages/Admin.tsx` |
| Modified | `frontend/src/pages/Chat.tsx` |
| Modified | `frontend/src/pages/Welcome.tsx` |
| Modified | `frontend/src/types.ts` |
| Modified | `frontend/tailwind.config.js` |
| Modified | `frontend/wrangler.jsonc` |
| Modified | `landing/index.html` |
| Modified | `landing/package-lock.json` |
| Modified | `landing/package.json` |
| Modified | `landing/public/favicon.svg` |
| Modified | `landing/public/screens/chat-dark.png` |
| Modified | `landing/public/screens/console-dark.png` |
| Removed | `landing/public/theme-init.js` |
| Modified | `landing/src/App.tsx` |
| Modified | `landing/src/Architecture.tsx` |
| Modified | `landing/src/Evaluation.tsx` |
| Removed | `landing/src/LoadCharts.tsx` |
| Modified | `landing/src/RedTeam.tsx` |
| Modified | `landing/src/index.css` |
| Modified | `landing/src/main.tsx` |
| Modified | `landing/tailwind.config.js` |
| Added | `backend/alembic/versions/0002_conversation_archive.py` |
| Added | `backend/app/maintenance/archive.py` |
| Added | `backend/app/maintenance/attacks.py` |
| Added | `backend/tests/test_archive.py` |
| Added | `docs/DEMO_TRIAGE.md` |
| Added | `docs/ENHANCEMENTS_INTEGRATION_REPORT.md` |
| Added | `landing/src/Simulation.tsx` |
| Added | `landing/src/Trace.tsx` |
| Added | `landing/src/ui.tsx` |
