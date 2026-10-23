# Operations runbook
`docker compose ps` — inspect containers.
`docker compose logs --tail=100 api postgres` — inspect application/database logs.
`curl -fsS http://localhost:3000/health` — liveness.
`curl -fsS http://localhost:3000/ready` — DB readiness.
`docker compose exec api npm run db:deploy` — apply migrations.
`docker compose exec api npm run db:seed` — seed fictional accounts.
Never expose PostgreSQL, Prometheus, or Grafana publicly in the AWS security group.
