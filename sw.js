/* Service worker: network-first for the app shell, cache fallback for offline */
const CACHE = "be12-v181";
const SHELL = ["./", "index.html", "manifest.json", "logo.svg", "icon-192.png", "icon-512.png"];

/* Reminder text lives in its own cache, NOT in CACHE, because CACHE is wiped on
   every version bump and the text has to survive one: a push can arrive before
   the user next opens the app to rewrite it. Deliberately excluded from the
   activate sweep below. */
const REM_CACHE = "be-rem";
const REM_KEY = "./__reminder__";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== REM_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      })
      .catch(() => caches.match(e.request).then(m => m || caches.match("index.html")))
  );
});

/* The daily reminder push carries no payload — see backend/push/push-worker.js
   for why. Everything shown here comes from the copy the app left in REM_CACHE,
   already translated into the user's language by t(), so this file needs no
   dictionary of its own.

   userVisibleOnly means we MUST show something for every push we receive. The
   backend is what stays quiet: it skips anyone who already practised today, so
   a push arriving at all means a notification is wanted. The English fallback
   below is for the case where the cache entry is somehow missing — showing the
   wrong language beats Chrome's "this site was updated in the background". */
self.addEventListener("push", e => {
  e.waitUntil(
    caches.open(REM_CACHE)
      .then(c => c.match(REM_KEY))
      .then(r => (r ? r.json() : null))
      .catch(() => null)
      .then(d => {
        const text = d && d.title && d.body ? d : {
          title: "Time to practise",
          body: "25 minutes today keeps the streak alive.",
        };
        return self.registration.showNotification(text.title, {
          body: text.body,
          icon: "icon-192.png",
          badge: "icon-192.png",
          tag: "be-daily",           // a second push replaces, never stacks
          renotify: false,
          lang: (d && d.lang) || "en",
          dir: (d && d.dir) || "auto",   // ar / ur read right-to-left
          data: { url: "./" },
        });
      })
  );
});

/* Tapping a daily-reminder notification should focus the app if it's already
   open, rather than spawning a second window. */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) if ("focus" in c) return c.focus();
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
