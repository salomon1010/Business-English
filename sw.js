/* Service worker: network-first for the app shell, cache fallback for offline */
const CACHE = "be12-v292";
/* Every engine the app boots with belongs here. Only two of them used to, so on a
   poor connection — or on the first launch after a version bump, which wipes the
   old cache — the Passport, coach, roadmap, Career Center, simulations and answer
   analysis were all simply absent, and the guards made that fail silently rather
   than visibly. */
const SHELL = ["./", "index.html", "manifest.json", "logo.svg", "icon-192.png", "icon-512.png", "linkedin.png", "workshop-team.jpg", "workshop-team-card.jpg",
  "jurisdictions.js?v=78", "trades.js?v=78", "curriculum-provider.js?v=78", "professional-tracks.js?v=78", "competency-engine.js?v=78", "learning-coach.js?v=78",
  "professional-simulation-engine.js?v=78", "conversation-orchestrator.js?v=78", "adaptive-learning-engine.js?v=78",
  "career-center.js?v=78", "professional-skills-passport.js?v=78", "answer-evaluator.js?v=78", "shadow-lines.js?v=78",
  "tracks/general/weeks.json", "tracks/general/shadow.json", "tracks/general/phrases.json", "tracks/general/vocabulary.json", "tracks/general/practice.json", "tracks/general/progress.json",
  "tracks/welding/weeks.json", "tracks/welding/shadow.json", "tracks/welding/phrases.json", "tracks/welding/vocabulary.json", "tracks/welding/practice.json", "tracks/welding/progress.json"];

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
/* Network-first, but only for as long as the network is actually answering.

   The old handler awaited fetch() with no timeout and fell back to cache only in
   .catch(). A stalled mobile connection does not reject — it hangs — so a phone
   with the whole app already cached still sat on a blank screen. On Orange/MTN
   Cameroon (3G, no CDN closer than Europe, TCP over a congested CAMTEL link)
   that is the difference between "opens instantly" and "app is broken".

   So: if we hold a cached copy, the network gets NET_TIMEOUT ms to beat it and
   is otherwise overtaken — while still revalidating in the background, which
   keeps the push-to-deploy behaviour on any half-decent connection. With no
   cached copy there is nothing to fall back to, so we wait. */
const NET_TIMEOUT = 3000;

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  e.respondWith((async () => {
    const cached = await caches.match(req);

    const net = fetch(req).then(r => {
      /* Don't poison the cache with 404s / 5xx — a bad response now would be
         served forever offline. */
      if (r && r.ok) {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
      }
      return r;
    });

    if (!cached) {
      try { return await net } catch (err) { return (await caches.match("index.html")) || Response.error() }
    }

    /* Keep the worker alive long enough to finish revalidating even if we
       already answered from cache. Guarded: waitUntil throws if the event is no
       longer active, and that must not take the response down with it. */
    try { e.waitUntil(net.catch(() => {})) } catch (err) { net.catch(() => {}) }

    try {
      return await Promise.race([
        net,
        new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), NET_TIMEOUT)),
      ]) || cached;
    } catch (err) {
      return cached;   // offline, or slower than NET_TIMEOUT
    }
  })());
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
