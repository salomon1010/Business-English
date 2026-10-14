# BE Mastery Welding — brand artwork

`logo-master.png` is the approved Welding logo (owner, 13 Oct 2026), 1254×1254.
It is the **only** source: every icon the app ships on either store is derived
from it by `scripts/branding/make-welding-icons.py`, so there is one place to
change and nothing to keep in step by hand.

```
python3 scripts/branding/make-welding-icons.py    # regenerate everything
python3 scripts/branding/verify-welding-icons.py  # check it against the stores' rules
```

Generated and committed here:

| file | used by |
| --- | --- |
| `icon-1024.png` | the reference the verifier compares every other asset against |
| `icon-512.png` | copied over the Welding web bundle's `icon-512.png` by `sync-web.mjs` |
| `icon-192.png` | the same, and with it the certificate logo, the share card and every notification icon and badge inside the Welding app |

Generated elsewhere in the tree: the Android `welding` flavour's `mipmap-*` and
`drawable*/splash.png`, the iOS `AppIconWelding` and `SplashWelding` asset sets,
and `playstore/welding/play-icon-512.png`.

**General English is not touched by any of this.** The repository's own
`icon-192.png` / `icon-512.png` at the root, `src/main`'s launcher icon and the
project's `AppIcon` stay as they are, which is why the swap happens in the
bundle rather than in the repository. See `docs/APP_SPLIT.md` § Branding.

This folder is in `sync-web.mjs`'s skip list, so the artwork itself never ships
inside an app bundle.
