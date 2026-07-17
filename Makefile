TARGET :=
DB_URL :=
DB_ENV_FILE :=
NAME :=
CONFIRM :=
ACCEPT_DATA_LOSS :=
ALLOW_PRODUCTION_RESET :=
ALLOW_PRODUCTION_PUSH :=

export TARGET DB_URL DB_ENV_FILE NAME CONFIRM ACCEPT_DATA_LOSS
export ALLOW_PRODUCTION_RESET ALLOW_PRODUCTION_PUSH

.PHONY: help db-status db-deploy db-migrate db-reset db-push db-pull db-studio db-generate db-validate db-format db-test vercel-link vercel-env-list-prod vercel-env-pull-prod vercel-env-pull-prod-force

help:
	@node scripts/db.mjs --help

db-status:
	@node scripts/db.mjs status

db-deploy:
	@node scripts/db.mjs deploy

db-migrate:
	@node scripts/db.mjs migrate-dev

db-reset:
	@node scripts/db.mjs reset

db-push:
	@node scripts/db.mjs push

db-pull:
	@node scripts/db.mjs pull

db-studio:
	@node scripts/db.mjs studio

db-generate:
	@node scripts/db.mjs generate

db-validate:
	@node scripts/db.mjs validate

db-format:
	@node scripts/db.mjs format

db-test:
	@node --test scripts/db.test.mjs

vercel-link:
	@npx --yes vercel link

vercel-env-list-prod:
	@npx --yes vercel env ls production

vercel-env-pull-prod:
	@npx --yes vercel env pull .env.production --environment=production

vercel-env-pull-prod-force:
	@npx --yes vercel env pull .env.production --environment=production --yes
