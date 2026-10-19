#!/bin/bash
# Export a distribution IPA from an archive built by scripts/build.sh.
#
#   bash scripts/export.sh [general|welding]
#
# Written 12 October 2026. The General English IPA was exported by a one-off
# command, so the options that produced a verified artifact lived only in
# build/export-general/ExportOptions.plist. They are reproduced here so the two
# apps export on identical terms and the Welding export is not a fresh guess.
#
# signingStyle=automatic is deliberate and was learned the hard way: with
# `manual`, -exportArchive refused the archive ("Xcode managed, but signing
# settings require a manually managed profile"). Automatic lets Xcode pick the
# Apple Distribution identity and the matching App Store profile for the app
# and for every embedded extension — which is what the shipped General English
# IPA carries, three Store profiles, one per bundle.
#
# It exports; it does not upload. scripts/upload.sh does that, and refuses an
# artifact whose identity is not the chosen app's.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"; cd "$here"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

prog="${1:-general}"
case "$prog" in
  general|general-english) prog=general; archive="build/general-english.xcarchive"; want="com.lomonec.bemastery" ;;
  welding)                 archive="build/welding.xcarchive";                        want="com.lomonec.bemastery.welding" ;;
  *) echo "usage: $(basename "$0") [general|welding]"; exit 2 ;;
esac
out="build/export-$prog"

[ -d "$archive" ] || { echo "no archive at $archive — run: bash scripts/build.sh $prog --archive"; exit 1; }

# the archive must be the app we were asked for: the two differ only by xcconfig,
# so a stale archive is an easy and silent mistake
got="$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleIdentifier' "$archive/Info.plist" 2>/dev/null || echo "?")"
[ "$got" = "$want" ] || { echo "REFUSED: $archive is $got, expected $want"; exit 1; }
echo "archive: $archive  ($got $(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleShortVersionString' "$archive/Info.plist") ($(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$archive/Info.plist")))"

# …and the WEB bundle inside it must be the same programme. build.sh checks this
# before archiving, but an archive made by calling xcodebuild directly skips that
# — which is exactly how a Welding shell carrying the General English web app got
# built on 12 Oct 2026. The shell was right and every signature was valid, so
# nothing else would have noticed until a learner opened it.
wantprog=$([ "$prog" = welding ] && echo welding || echo general-english)
gotprog="$(sed -nE 's/^programme (.+)$/\1/p' "$archive/Products/Applications/App.app/public/BUNDLE_INFO.txt" 2>/dev/null || true)"
[ "$gotprog" = "$wantprog" ] || { echo "REFUSED: the archive's web bundle is '$gotprog', expected '$wantprog' — rebuild with scripts/build.sh $prog --archive"; exit 1; }
echo "web bundle in the archive: $gotprog"

opts="$(mktemp -t be-export).plist"
trap 'rm -f "$opts"' EXIT
cat > "$opts" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>destination</key><string>export</string>
	<key>generateAppStoreInformation</key><false/>
	<key>manageAppVersionAndBuildNumber</key><true/>
	<key>method</key><string>app-store-connect</string>
	<key>signingStyle</key><string>automatic</string>
	<key>stripSwiftSymbols</key><true/>
	<key>teamID</key><string>8TKAAK2MG6</string>
	<key>testFlightInternalTestingOnly</key><false/>
	<key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST

rm -rf "$out"
"$DEVELOPER_DIR/usr/bin/xcodebuild" -exportArchive \
  -archivePath "$archive" -exportPath "$out" -exportOptionsPlist "$opts" \
  -allowProvisioningUpdates | tail -20

echo
echo "exported: $out/App.ipa"
echo "next: bash scripts/upload.sh $prog --dry-run"
