#!/bin/bash
# One-off tidy after the v628 ship: the commit-message scratch file was swept
# into the commit by `git add -A playstore/android-widget`; take it out, add
# the two helper scripts written since, push.
set -euo pipefail
cd "$(dirname "$0")/../.."
git rm -q --cached playstore/android-widget/.commit-msg.txt 2>/dev/null || true
rm -f playstore/android-widget/.commit-msg.txt
git add playstore/android-widget/dev-status.sh playstore/android-widget/dev-server.sh playstore/android-widget/dev-tidy.sh
git commit -q -m "chore(android-widget): helper scripts for status and the staging server; drop a stray scratch file

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -q origin staging && echo "pushed $(git rev-parse --short HEAD)"
