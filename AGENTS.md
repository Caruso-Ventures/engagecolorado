# engagecolorado — agent rules

Static site. `main` is the production branch: **pushing to `main` deploys to production automatically** via Vercel's Git integration.

## Deploying

Push to `main`. That is the whole procedure.

**Never run `vercel --prod` (or `vercel deploy --prod`) in this repo.** On 2026-08-05 a `vercel --prod` run from a stale checkout deployed an outdated commit over production and pinned the live site to day-old code for ~90 minutes. A CLI deploy publishes whatever is in the working directory, not what is on `main`, so it silently overwrites newer commits.

If production looks behind `main`, do not force it with a CLI deploy or an empty commit. Run the drift check and read what it says:

```bash
./scripts/check-deploy-drift.sh
```

## A green Vercel check is not proof of deployment

Between 2026-08-04 16:36 and 2026-08-05 09:15 MT, Vercel's GitHub App posted `pending` → `success` ("Deployment has completed") on 13 consecutive pushes to `main` while creating no deployment at all — the deployment IDs in those status links return 404 and appear in no deployment listing. Production served stale content the whole time and GitHub showed green.

So: verify against the deployment record, not the commit status. `check-deploy-drift.sh` compares the live production deployment's commit SHA against `origin/main` and is the only trustworthy signal.

## Domains

`engagecolorado.org` (redirects to `www`), `www.engagecolorado.org`, plus `ensuringcolorado.com`, `visionforcolorado.org`, and `thehonestassessment.com` all serve from this one Vercel project. A bad production deploy takes down all five.

## Git

- Remote is `Caruso-Ventures/engagecolorado`. The old `CarusoVentures/...` URL still works by redirect but should be corrected: `git remote set-url origin https://github.com/Caruso-Ventures/engagecolorado.git`
- Never commit `.env*`.
