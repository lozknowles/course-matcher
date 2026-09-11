#!/usr/bin/env bash
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-cottageserver}"
DEPLOY_PORT="${DEPLOY_PORT:-2222}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/var/www/lozknowles.com/public_html/dist}"
DEPLOY_DIR="${DEPLOY_DIR:-$DEPLOY_ROOT/lincoln-course-match}"
PUBLIC_URL="${PUBLIC_URL:-https://lozknowles.com/lincoln-course-match/}"
PUBLIC_URL="${PUBLIC_URL%/}"
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
if [ -n "${OFFICIAL_LINK_EVIDENCE:-}" ]; then
  node scripts/verify-link-evidence.mjs "$OFFICIAL_LINK_EVIDENCE" "$(git rev-parse HEAD)"
else
  npm run test:links
fi
npm run vendor

PUBLIC_FILES=(
  .htaccess
  index.html
  automated-change-request.html
  automated-change-request.js
  data-quality.html
  data-quality.css
  data-quality.js
  data-quality-core.js
  styles.css
  app.js
  document-core.js
  matcher-core.js
  retention-core.js
  courses.js
  lincoln-theme.css
  student-hub/adapter.js
  student-hub/app.js
  student-hub/bridge.js
  student-hub/career-core.js
  student-hub/careers.css
  student-hub/careers.html
  student-hub/careers.js
  student-hub/core.js
  student-hub/data.js
  student-hub/icon.svg
  student-hub/index.html
  student-hub/logo.jpg
  student-hub/manifest.webmanifest
  student-hub/skills-england-logo.svg
  student-hub/skills-england-reference.json
  student-hub/styles.css
  student-hub/sw.js
)

for f in "${PUBLIC_FILES[@]}"; do
  test -s "$f"
done
for f in vendor/tesseract/tesseract.min.js vendor/tesseract/worker.min.js vendor/pdfjs/pdf.mjs vendor/pdfjs/pdf.worker.mjs; do
  test -s "$f"
done

if [ "${DEPLOY_LOCAL:-0}" = "1" ]; then
  rm -rf "$REMOTE_STAGE"
  mkdir -p "$REMOTE_STAGE" "$REMOTE_BACKUP_DIR"
  rsync -av --delete-after \
    --relative "${PUBLIC_FILES[@]}" vendor \
    "$REMOTE_STAGE/"
  if sudo test -d "$DEPLOY_DIR"; then
    sudo tar -C "$DEPLOY_ROOT" -czf - lincoln-course-match > "$REMOTE_BACKUP_DIR/lincoln-course-match-$STAMP.tgz"
  fi
  sudo mkdir -p "$DEPLOY_DIR"
  sudo rsync -a --delete "$REMOTE_STAGE/" "$DEPLOY_DIR/"
  sudo chmod -R a+rX "$DEPLOY_DIR"
  rm -rf "$REMOTE_STAGE"
  echo 'Production files installed locally.'
else
  ssh -p "$DEPLOY_PORT" "$DEPLOY_HOST" "rm -rf '$REMOTE_STAGE'; mkdir -p '$REMOTE_STAGE' '$REMOTE_BACKUP_DIR'"
  rsync -av --delete-after \
    -e "ssh -p $DEPLOY_PORT" \
    --relative "${PUBLIC_FILES[@]}" vendor \
    "$DEPLOY_HOST:$REMOTE_STAGE/"

  ssh -tt -p "$DEPLOY_PORT" "$DEPLOY_HOST" "set -e; \
    if sudo test -d '$DEPLOY_DIR'; then \
      sudo tar -C '$DEPLOY_ROOT' -czf - lincoln-course-match > '$REMOTE_BACKUP_DIR/lincoln-course-match-$STAMP.tgz'; \
    fi; \
    sudo mkdir -p '$DEPLOY_DIR'; \
    sudo rsync -a --delete '$REMOTE_STAGE/' '$DEPLOY_DIR/'; \
    sudo chmod -R a+rX '$DEPLOY_DIR'; \
    rm -rf '$REMOTE_STAGE'; \
    echo 'Production files installed.'"
fi

assert_public_contains() {
  # Do not use grep -q here: under pipefail it can close a large successful
  # curl response early and turn the verification into a false curl(23).
  curl -fsS "$1" | grep -F "$2" >/dev/null
}

assert_public_contains "$PUBLIC_URL/" 'Turn your results into useful course conversations'
assert_public_contains "$PUBLIC_URL/" 'What are you interested in?'
assert_public_contains "$PUBLIC_URL/" 'Take photo'
assert_public_contains "$PUBLIC_URL/" 'prepared for discussion with Lincoln College'
assert_public_contains "$PUBLIC_URL/" 'Lincoln College, Lincoln and Newark'
assert_public_contains "$PUBLIC_URL/" 'Show courses I could apply for'
assert_public_contains "$PUBLIC_URL/matcher-core.js" 'quickMatchCourses'
assert_public_contains "$PUBLIC_URL/retention-core.js" 'buildTransferHandoff'
assert_public_contains "$PUBLIC_URL/" '42-Day Student Fit &amp; Retention'
assert_public_contains "$PUBLIC_URL/" 'Why is this learner at risk of disengaging?'
assert_public_contains "$PUBLIC_URL/" 'Five student-success journeys'
assert_public_contains "$PUBLIC_URL/" 'href="automated-change-request.html"'
curl -fsS "$PUBLIC_URL/vendor/pdfjs/pdf.mjs" >/dev/null
curl -fsS "$PUBLIC_URL/vendor/tesseract/tesseract.min.js" >/dev/null
assert_public_contains "$PUBLIC_URL/document-core.js" 'readAllPdfPages'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'Automated Change Request'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'agent-cursor'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'no real student data'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'Save & Close'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'ProSolution (26.1) - TEST SYSTEM'
assert_public_contains "$PUBLIC_URL/automated-change-request.html" 'Lincoln and Newark'
assert_public_contains "$PUBLIC_URL/automated-change-request.js" 'requests=requests.slice(1)'

assert_public_contains "$PUBLIC_URL/data-quality.html" 'AutoEmail'
assert_public_contains "$PUBLIC_URL/data-quality.js" 'makeStudents'
assert_public_contains "$PUBLIC_URL/data-quality-core.js" 'cleanMobile'
assert_public_contains "$PUBLIC_URL/data-quality.css" '#autoemail'

assert_public_contains "$PUBLIC_URL/lincoln-theme.css" 'lincoln'
assert_public_contains "$PUBLIC_URL/student-hub/index.html" 'Student Hub'
assert_public_contains "$PUBLIC_URL/student-hub/careers.html" 'Skills England occupation explorer'
curl -fsS "$PUBLIC_URL/student-hub/sw.js" >/dev/null
curl -fsS "$PUBLIC_URL/student-hub/skills-england-reference.json" | node -e '
let body = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { body += chunk; });
process.stdin.on("end", () => {
  const data = JSON.parse(body);
  if (data.provider !== "Skills England" || data.routes.length !== 15 || data.occupations.length !== 1287 || data.edges.length !== 75) {
    process.exit(1);
  }
});
'
echo "Lincoln College demonstration suite deployed and verified at $PUBLIC_URL"
