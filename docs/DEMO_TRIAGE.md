# Demo archives and attack triage

The cleanup job archives a demo conversation before deleting its sandbox.
An archive contains ordered messages and audit events, synthetic order data,
refund decisions, token counts, triage flags, and available Opik trace IDs.
The snapshot and deletion share a database transaction: an archive failure
rolls back that batch's changes. Repeating successful cleanup does not create
duplicate archive rows.

## Retention and access

- `DEMO_DATA_TTL_HOURS` controls sandbox lifetime (default: 24 hours).
- `RETENTION_DAYS` controls archive lifetime **after archival** (default: 90
  days). An hourly cleanup schedule means expiry is enforced on the next run,
  rather than at an exact instant.
- The general conversation purge also archives demo conversations it selects,
  including when demo sandbox cleanup is disabled with `--demo-hours 0`.
- Production customer conversations retain their existing deletion behavior;
  this feature does not introduce a production transcript archive.
- Archives have no public HTTP endpoint. The CLI requires database credentials
  and is intended for the project operator. Prefer read-only database access
  for triage and keep exports private until reviewed for personal information.
- This stores transcripts outside Opik, so archive storage grows with traffic.
  Monitor database usage and retain only what is needed. Avoid entering real
  personal data into the public demo.

## Review a disposable database first

Run these commands from `backend/`, with the development requirements installed.
Use a separate SQLite database or disposable PostgreSQL/Redis instances.
Never set `TEST_DATABASE_URL` or `TEST_REDIS_URL` to production: the test
fixtures recreate tables and flush the test Redis database.

```bash
# Bash; use equivalent environment assignment in PowerShell.
export DATABASE_URL=sqlite:///./var/triage-local.db
export LLM_PROVIDER=fake
export AUTH_MODE=demo
alembic upgrade head

python -m app.maintenance.retention --days 90 --demo-hours 24 --dry-run
python -m app.maintenance.attacks list --live --days 7
python -m app.maintenance.attacks list --flagged --live
python -m app.maintenance.attacks show <conversation-id>
python -m app.maintenance.attacks scan --days 2
```

Create test conversations through a **local** backend or run
`pytest -q tests/test_archive.py tests/test_demo.py` to exercise isolated
fixtures. `scan` exits 1 when it finds suspected breaches and 0 when none
are found; query failures exit nonzero too and must be investigated.

`list`, `show`, and `scan` do not write database records. For an operator's
configured demo database, the optional `--demo-db` selector reads
`DEMO_DATABASE_URL` from the environment or the repo-root ignored `.env`:

```bash
python -m app.maintenance.attacks --demo-db list --flagged --live
```

This selector is not needed for normal API or cleanup deployment. Do not
commit its value. No database connection string is printed by the CLI.

## Interpret findings

| Finding | Meaning |
|---|---|
| `forbidden_approval` | An approval conflicts with the fixture order's policy branch |
| `double_refund` | Multiple approved ledger records exist for an order |
| `cross_customer` | A conversation's refund refers to an order it does not own |
| `possible_data_leak` | An assistant reply mentions another sandbox ID; requires review |

`injection`, `output_corrected`, `scripted_fallback`, `budget_exhausted`,
`error`, `unexpected_<decision>`, `unknown_scenario`, `possible_prompt_leak`,
and `no_decision` are triage flags. They are not all confirmed vulnerabilities.
A possible leak may simply quote an ID supplied by the visitor. Unknown order
scenarios need manual inspection. A scan is a bounded check of synthetic demo
fixtures and recorded ledger rows, not a general proof that no data leaked.

Detected breaches log `demo breach detected` at ERROR, with conversation and
customer identifiers and breach categories. An operator can configure an alert
on this event; the code does not create a Cloud Logging alert automatically.

## Turn an attack into an evaluation case

```bash
python -m app.maintenance.attacks export <conversation-id> --case-id demo-review-001
# Review the printed YAML before deliberately writing a local regression case:
python -m app.maintenance.attacks export <conversation-id> --case-id demo-review-001 --write
```

`--write` appends UTF-8 YAML to `backend/evals/cases/found_in_demo.yaml` and
rejects duplicate case IDs. It does not write the database. Own orders map to
`{A}`–`{E}` fixture placeholders and foreign sandbox orders map to `{X}`;
literal braces are escaped for the harness. Other IDs or personal information
may remain in the text and must be reviewed manually. The exported case is
`live_only`, so it needs a configured real provider for meaningful evaluation.

The checked-in backend image contains the maintenance CLI but does not contain
the repository's evaluation directory. Perform `export --write` from a local
repository checkout with the eval files available, not from the Cloud Run
cleanup container.

## Release ordering

Migration `0002` adds a table without changing existing columns. Before an
authorized release, test upgrade, downgrade, upgrade, and Alembic model drift
against disposable databases. A downgrade removes archive data and is not a
normal application rollback strategy.

After preview/staging checks and explicit production approval:

1. Pause the existing cleanup schedule during the release window, using your
   own project and region; do not copy another deployment's identifiers.
2. Run the normal migration job, then deploy the backend and cleanup image.
3. Confirm readiness and the additive `demo.transcript_retention_days` metadata.
4. Inspect cleanup with `--dry-run`, then resume the authorized schedule and
   verify archive rows on a synthetic test sandbox.
5. Publish the frontend and landing page with the matching retention notice.

Keep the additive archive table if rolling application code back. Old cleanup
code deletes without archiving, so keep cleanup paused until a compatible
cleanup image is restored. Previously deleted conversations cannot be recovered.
