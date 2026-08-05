#!/usr/bin/env bash
# Compare the live production deployment's commit against origin/main.
#
# Exists because Vercel's GitHub App can report a green "Deployment has
# completed" status for a deployment it never created — see AGENTS.md. Commit
# statuses are therefore not a deploy signal; the deployment record is.
#
# Exit 0 = production matches origin/main. Exit 1 = drift. Exit 2 = check failed.

set -euo pipefail

PROJECT="engagecolorado"
REPO="Caruso-Ventures/engagecolorado"

for cmd in vercel gh python3; do
  command -v "$cmd" >/dev/null || { echo "FAIL: $cmd not on PATH"; exit 2; }
done

head_sha=$(gh api "repos/$REPO/commits/main" --jq .sha) || { echo "FAIL: could not read origin/main"; exit 2; }

prod_json=$(vercel api "/v6/deployments?projectId=$PROJECT&limit=1&target=production&state=READY" 2>/dev/null) \
  || { echo "FAIL: could not query Vercel deployments"; exit 2; }

read -r prod_sha prod_src prod_age <<<"$(printf '%s' "$prod_json" | python3 -c '
import json, sys, time
deployments = json.load(sys.stdin).get("deployments") or []
if not deployments:
    print("none cli 0")
    sys.exit(0)
d = deployments[0]
meta = d.get("meta") or {}
age_min = int((time.time() - d["created"] / 1000) / 60)
print(meta.get("githubCommitSha") or "none", d.get("source") or "unknown", age_min)
')"

if [ "$prod_sha" = "none" ]; then
  echo "DRIFT: no READY production deployment found for $PROJECT"
  exit 1
fi

if [ "$prod_sha" != "$head_sha" ]; then
  cat <<EOF
DRIFT: production is not serving origin/main
  origin/main : ${head_sha:0:7}
  production  : ${prod_sha:0:7}  (source=$prod_src, deployed ${prod_age}m ago)

Commits on main that are NOT in production:
$(git log --oneline "$prod_sha..$head_sha" 2>/dev/null || echo "  (run 'git fetch origin' to list them)")

Do NOT fix this with 'vercel --prod' or an empty commit. Check whether Vercel
created a deployment for the missing commits at all:
  gh api repos/$REPO/commits/${head_sha:0:7}/status --jq '.statuses[].target_url'
If that URL 404s, the Git integration reported a build it never ran — escalate
to Vercel support rather than redeploying by hand.
EOF
  exit 1
fi

if [ "$prod_src" = "cli" ]; then
  echo "WARN: production matches origin/main (${prod_sha:0:7}) but was deployed by CLI, not Git."
  echo "      CLI deploys publish the working directory and can overwrite newer commits. See AGENTS.md."
  exit 0
fi

echo "OK: production serving origin/main (${prod_sha:0:7}), deployed ${prod_age}m ago via $prod_src"
