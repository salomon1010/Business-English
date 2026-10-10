/* RETIRES THE OLD ROOT SERVICE WORKER (docs/PORTAL.md, "Service workers").
   Until the portal took app.lomonec.com/, BE Mastery registered /sw.js with
   scope "/". Browsers that still hold that registration fetch this file on
   their next update check; it installs, unregisters itself and leaves.
   BE Mastery now registers its own worker at /bemastery/sw.js (scope
   /bemastery/), and its activate step removes the old version caches.
   This worker has NO fetch handler (every request goes to the network) and
   deletes NO cache: `be-rem` holds the reminder wording a pending push reads.
   A web-push subscription made on the old registration ends with it; the app
   subscribes again on the new one the next time the learner opens it. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(self.registration.unregister());
});
