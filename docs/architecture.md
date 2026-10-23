# Architecture and transfer design
- Browser -> Nginx static React app -> Express API -> Prisma -> PostgreSQL.
- Prometheus scrapes API metrics; Grafana is provisioned with a starter dashboard.
- Transfer requests use decimal strings on the wire and integer cents internally.
- Source/destination rows are locked in deterministic order; active status, currency and available balance are checked.
- Balance updates, transfer record, and paired debit/credit ledger entries commit atomically.
- Idempotency key is unique and bound to a request fingerprint.
- Demo-only: add auth, account ownership authorization, MFA, TLS, managed secrets, fraud controls, audit retention, backups, private network and security review before any real-world use.
