#!/bin/bash
# Upload a BE Mastery IPA to App Store Connect.
#
#   bash scripts/upload.sh [general|welding] --dry-run   every check, no upload
#   bash scripts/upload.sh [general|welding] --validate   Apple's own validation
#   bash scripts/upload.sh [general|welding]              validate, then upload
#
# Written 12 October 2026, because nothing in this repository could upload. The
# point of the preflight is that an IPA is easy to get subtly wrong and App
# Store Connect accepts a build it will later reject: this refuses to send one
# whose bundle id, programme, signing authority or extensions are not what the
# chosen app is supposed to be.
#
# CREDENTIALS — never in the repository, never printed, never passed on a
# command line that could reach a log:
#   key   ~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8   (altool finds it
#         itself from --apiKey; it also searches ./private_keys and
#         ~/private_keys). The keys are currently in
#         ~/Documents/GitHub/BE Mastey Keys/ — copy, do not move, the one you
#         want into ~/.appstoreconnect/private_keys/ and chmod 600 it.
#   id    BE_ASC_KEY_ID      the 10 characters in the key's filename
#   issuer BE_ASC_ISSUER_ID  App Store Connect -> Users and Access ->
#         Integrations -> App Store Connect API -> "Issuer ID" above the table.
#         An identifier, not a secret, but it is read from the environment or
#         from ~/.config/be-mastery/secrets/asc-issuer so it need not be typed.
# Required key role: App Manager (or Admin). Developer cannot upload.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

prog=general; mode=upload
for a in "$@"; do case "$a" in
  general|general-english) prog=general ;;
  welding) prog=welding ;;
  --dry-run)  mode=dry ;;
  --validate) mode=validate ;;
  *) echo "usage: $(basename "$0") [general|welding] [--dry-run|--validate]"; exit 2 ;;
esac; done

if [ "$prog" = welding ]; then
  IPA="build/export-welding/App.ipa"; WANT_ID="com.lomonec.bemastery.welding"; WANT_PROG="welding"
else
  IPA="build/export-general/App.ipa"; WANT_ID="com.lomonec.bemastery";         WANT_PROG="general-english"
fi

say() { printf '  %-52s %s\n' "$1" "$2"; }
fail() { echo "REFUSED: $1" >&2; exit 1; }

echo "== preflight: $prog"
[ -f "$IPA" ] || fail "no IPA at $IPA — run scripts/build.sh $prog --archive and export first"

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
unzip -q "$IPA" -d "$work"
app="$work/Payload/App.app"
[ -d "$app" ] || fail "no Payload/App.app inside $IPA"

pl() { /usr/libexec/PlistBuddy -c "Print :$1" "$2" 2>/dev/null || true; }
bid="$(pl CFBundleIdentifier "$app/Info.plist")"
ver="$(pl CFBundleShortVersionString "$app/Info.plist")"
bld="$(pl CFBundleVersion "$app/Info.plist")"
prg="$(pl BEProgramme "$app/Info.plist")"
say "bundle id" "$bid"; say "version (build)" "$ver ($bld)"; say "programme" "$prg"
[ "$bid" = "$WANT_ID" ]   || fail "bundle id is $bid, expected $WANT_ID — wrong app"
[ "$prg" = "$WANT_PROG" ] || fail "programme is $prg, expected $WANT_PROG — the web bundle and the shell are crossed"

# the web bundle inside must name the same programme as the shell
bb="$(cat "$app/public/be-build.js" 2>/dev/null || echo "")"
case "$bb" in *"\"$WANT_PROG\""*) say "bundled web app" "$WANT_PROG" ;;
  *) fail "be-build.js does not name $WANT_PROG: $bb" ;; esac

# distribution signing, on the app AND every extension Apple will inspect
for b in "$app" "$app"/PlugIns/*.appex; do
  [ -e "$b" ] || continue
  auth="$(codesign -dv --verbose=2 "$b" 2>&1 | sed -n 's/^Authority=//p' | head -1)"
  say "signed: $(basename "$b")" "$auth"
  case "$auth" in "Apple Distribution: "*) ;; *) fail "$(basename "$b") is not Apple Distribution signed ($auth)"; esac
  ents="$(codesign -d --entitlements - --xml "$b" 2>/dev/null || true)"
  case "$ents" in *"<key>get-task-allow</key><true/>"*) fail "$(basename "$b") carries get-task-allow — that is a development build";; esac
done

# versions must agree across the app and its extensions or App Store Connect rejects the upload
for ex in "$app"/PlugIns/*.appex; do
  [ -e "$ex" ] || continue
  [ "$(pl CFBundleVersion "$ex/Info.plist")" = "$bld" ] \
    || fail "$(basename "$ex") build number differs from the app ($bld)"
done
say "extension versions" "all $ver ($bld)"

if [ "$mode" = dry ]; then echo; echo "DRY RUN — nothing was sent. Preflight passed."; exit 0; fi

# ---- credentials, resolved without printing anything ----
KEY_ID="${BE_ASC_KEY_ID:-}"
ISSUER="${BE_ASC_ISSUER_ID:-}"
SEC="$HOME/.config/be-mastery/secrets"
[ -z "$ISSUER" ] && [ -f "$SEC/asc-issuer" ] && ISSUER="$(tr -d '[:space:]' < "$SEC/asc-issuer")"
# Which key, by the same route as the issuer, so naming it needs no shell-profile
# edit and no value is ever typed into a terminal that logs. Two keys are
# installed and only one has App Manager rights; this file says which.
[ -z "$KEY_ID" ] && [ -f "$SEC/asc-key-id" ] && KEY_ID="$(tr -d '[:space:]' < "$SEC/asc-key-id")"
if [ -n "$KEY_ID" ] && [ ! -f "$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8" ]; then
  fail "asc-key-id names ${KEY_ID}, but ~/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8 is not there"
fi
if [ -z "$KEY_ID" ]; then
  # Two keys are installed (A88M365B2K and LRT44K2796). Picking one silently
  # would be a guess, and the wrong key fails at Apple with an opaque error —
  # so when there is more than one, say so and stop.
  keys="$(ls "$HOME/.appstoreconnect/private_keys"/AuthKey_*.p8 2>/dev/null | sed -E 's#.*/AuthKey_(.*)\.p8#\1#' || true)"
  n="$(printf '%s\n' "$keys" | grep -c . || true)"
  if [ "$n" = "1" ]; then KEY_ID="$keys"
  elif [ "${n:-0}" -gt 1 ]; then
    fail "more than one API key is installed ($(printf '%s' "$keys" | tr '\n' ' ')) — name the one with App Manager rights in $SEC/asc-key-id (or BE_ASC_KEY_ID), so this does not guess"
  fi
fi
[ -n "$KEY_ID" ] || fail "no API key: put AuthKey_<KEYID>.p8 in ~/.appstoreconnect/private_keys/ or set BE_ASC_KEY_ID"
[ -n "$ISSUER" ] || fail "no issuer id: write it to $SEC/asc-issuer (chmod 600) or set BE_ASC_ISSUER_ID"
say "api key" "AuthKey_${KEY_ID}.p8"
say "issuer" "configured (not printed)"

echo
echo "== Apple validation"
xcrun altool --validate-app -f "$IPA" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
[ "$mode" = validate ] && { echo; echo "VALIDATED — nothing was uploaded."; exit 0; }

echo
echo "== upload"
xcrun altool --upload-app -f "$IPA" -t ios --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
echo
echo "Uploaded. It is NOT in TestFlight until App Store Connect finishes processing;"
echo "check App Store Connect -> the app -> TestFlight -> Builds before claiming anything."
