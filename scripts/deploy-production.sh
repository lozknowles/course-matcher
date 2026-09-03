#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-cottageserver}"
DEPLOY_PORT="${DEPLOY_PORT:-2222}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/lozknowles.com/public_html/dist}"
DEPLOY_DIR="${DEPLOY_DIR:-$DEPLOY_ROOT/lincoln-course-match}"
PUBLIC_URL="${PUBLIC_URL:-https://lozknowles.com/lincoln-course-match/}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/home/loz/deploy-backups/lozknowles.com}"
STAMP="$(date +%Y%m%dT%H%M%S)"
REMOTE_STAGE="/home/loz/course-matcher-deploy-$STAMP"

cd "$(dirname "$0")/.."

if [ "$(git branch --show-current)" != "main" ]; then
  echo "Refusing deploy: course-matcher is not on main" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing deploy: course-matcher worktree is not clean" >&2
  git status --short >&2
  exit 1
fi

npm ci
npm test
npm run test:links
npm run vendor

for f in .htaccess index.html styles.css app.js document-core.js matcher-core.js retention-core.js courses.js; do
  test -s "$f"
done
for f in vendor/tesseract/tesseract.min.js vendor/tesseract/worker.min.js vendor/pdfjs/pdf.mjs vendor/pdfjs/pdf.worker.mjs; do
  test -s "$f"
done

# Upload to a directory owned by the SSH user first. The Apache document root
# is intentionally not made writable by the deployment account.
ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" "rm -rf '$REMOTE_STAGE'; mkdir -p '$REMOTE_STAGE' '$REMOTE_BACKUP_DIR'"
rsync -av --delete-after \
  -e "ssh -p $DEPLOY_PORT" \
  .htaccess index.html styles.css app.js document-core.js matcher-core.js retention-core.js courses.js vendor \
  "$DEPLOY_HOST:$REMOTE_STAGE/"

# Use sudo only for the final web-root operation. -tt permits an interactive
# sudo password prompt when cottageserver is not configured for passwordless sudo.
ssh -tt -p "$DEPLOY_PORT" "$DEPLOY_HOST" "set -e; \
  if sudo test -d '$DEPLOY_DIR'; then \
    sudo tar -C '$DEPLOY_ROOT' -czf - lincoln-course-match > '$REMOTE_BACKUP_DIR/lincoln-course-match-$STAMP.tgz'; \
  fi; \
  sudo mkdir -p '$DEPLOY_DIR'; \
  sudo rsync -a --delete '$REMOTE_STAGE/' '$DEPLOY_DIR/'; \
  sudo chmod -R a+rX '$DEPLOY_DIR'; \
  rm -rf '$REMOTE_STAGE'; \
  echo 'Production files installed.'"

curl -fsS "$PUBLIC_URL" | grep -q 'Turn your results into useful course conversations'
curl -fsS "$PUBLIC_URL" | grep -q 'What are you interested in?'
curl -fsS "$PUBLIC_URL" | grep -q 'Take photo'
curl -fsS "$PUBLIC_URL" | grep -q 'prepared for discussion with Lincoln College'
curl -fsS "$PUBLIC_URL" | grep -q 'Lincoln College, Lincoln and Newark'
curl -fsS "$PUBLIC_URL" | grep -q 'Show courses I could apply for'
curl -fsS "$PUBLIC_URL/matcher-core.js" | grep -q 'quickMatchCourses'
curl -fsS "$PUBLIC_URL/retention-core.js" | grep -q 'buildTransferHandoff'
curl -fsS "$PUBLIC_URL" | grep -q '42-Day Student Fit &amp; Retention'
curl -fsS "$PUBLIC_URL" | grep -q 'Why is this learner at risk of disengaging?'
curl -fsS "$PUBLIC_URL/vendor/pdfjs/pdf.mjs" >/dev/null
curl -fsS "$PUBLIC_URL/vendor/tesseract/tesseract.min.js" >/dev/null
curl -fsS "$PUBLIC_URL/document-core.js" | grep -q 'readAllPdfPages'

echo "Course Match 1.0.0 deployed and verified at $PUBLIC_URL"
