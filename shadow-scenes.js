/* ============================================================================
   BE Mastery — Shadow Studio scenes (General English only)
   ----------------------------------------------------------------------------
   A scene is a short animated dialogue between fictional characters, played
   INSIDE the existing Shadow Studio. It is not a second studio: ScenePlayer
   stands in for YT.Player with exactly the surface the studio uses (the same
   contract RemoteYT keeps for the iOS shell) — getCurrentTime / playVideo /
   pauseVideo / seekTo / setPlaybackRate / getPlayerState / getDuration /
   getVideoData / destroy, onReady / onStateChange / onError — so Watch,
   Shadow, Challenge, the reports, History and My clips run unchanged on it.

   Data (nothing here is per-scene code):
     scenes/index.json               the list, in order
     scenes/cast.json                the recurring cast, drawn from parameters
     scenes/<slug>/scene.json        title, setting, cast, lines, curriculum
                                     metadata (week, day, topic, skill,
                                     competency), expressions, vocab, retell
     scenes/<slug>/captions.json     {cues:[{t,txt,spk}], words:[{t,w}]} — the
                                     studio's own caption format; word times
                                     were MEASURED from the audio by Whisper
                                     (scripts/build_scene.mjs), not estimated
     scenes/<slug>/audio.mp3         the whole dialogue, AI voices (labelled)

   A scene's id is "scene.<slug>". It can never be mistaken for a YouTube id
   (those are exactly 11 of [A-Za-z0-9_-]; a dot is not one of them), so every
   YouTube-only path (thumbnails, the transcript Worker, the relay) refuses it
   by its own existing checks.

   Motion is small and tied to the speech: the speaking character's mouth
   moves only while a word's measured time is running, the character leans in
   slightly, eyes blink every few seconds. prefers-reduced-motion drops all
   of it; who is speaking is still said in text (the status line and the name
   tag), never by motion alone. One requestAnimationFrame loop, only while the
   audio plays.
   ============================================================================ */
(function (global) {
  "use strict";
  const RE = /^scene\.([a-z0-9][a-z0-9-]{1,40})$/;
  const cache = { index: null, cast: null, scenes: {} };
  let T = (k, v) => k, ESC = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function is(vid) { return RE.test(String(vid || "")); }
  function slug(vid) { const m = RE.exec(String(vid || "")); return m ? m[1] : null; }
  function dir(vid) { return "scenes/" + slug(vid) + "/"; }
  function capUrl(vid) { return dir(vid) + "captions.json"; }
  async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(u + " " + r.status); return r.json(); }
  function memo(slot, key, make) {
    if (!slot[key]) slot[key] = make().catch(e => { delete slot[key]; throw e; });
    return slot[key];
  }
  function cast() { return memo(cache, "cast", () => getJSON("scenes/cast.json").then(j => j.characters || {})); }
  function load(vid) { if (!is(vid)) return Promise.resolve(null); return memo(cache.scenes, vid, () => getJSON(dir(vid) + "scene.json")); }
  /* every scene, with the cast resolved; a scene that fails to load is left out, not fatal */
  function list() {
    return memo(cache, "index", async () => {
      const ix = await getJSON("scenes/index.json");
      const out = await Promise.all((ix.scenes || []).map(s => load("scene." + s).catch(() => null)));
      return out.filter(Boolean);
    });
  }
  function configure(o) { if (o && o.t) T = o.t; if (o && o.esc) ESC = o.esc; }
  function reduced() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }

  /* ---------- drawing ---------- */
  function shade(hex, f) {
    const n = parseInt(String(hex).replace("#", ""), 16); if (!isFinite(n)) return hex;
    const ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * (1 + f))));
    return "#" + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("");
  }
  const HAIR = {
    short: (c) => `<path d="M61 86C57 44 86 30 104 33c26-2 41 18 37 54-5-17-17-27-39-27-20 0-33 9-41 26z" fill="${c}"/><path d="M62 84c-2 8-1 14 1 19l4-2c-1-6-1-12 1-17z" fill="${c}"/><path d="M138 84c2 8 1 14-1 19l-4-2c1-6 1-12-1-17z" fill="${c}"/>`,
    bob: (c) => `<path d="M100 27c-30 0-48 22-47 56 0 20-3 34-6 46 12 7 25 7 32 1V74c14-9 34-10 46-2v54c7 7 21 7 32 0-4-12-7-27-6-46 1-32-20-53-51-53z" fill="${c}"/><path d="M64 70c10-22 42-30 66-12 5 4 8 9 9 15-16-10-44-14-75-3z" fill="${shade(c, 0.18)}"/>`
  };
  const BACK_HAIR = { bob: (c) => `<path d="M53 86c-1 20-4 34-7 44 14 9 30 8 38-2l-2-56z M147 86c1 20 4 34 7 44-14 9-30 8-38-2l2-56z" fill="${shade(c, -0.15)}"/>` };
  const ACC = {
    glasses: () => `<g fill="rgba(255,255,255,.14)" stroke="#1b2533" stroke-width="2.6"><rect x="74" y="82" width="23" height="17" rx="6"/><rect x="103" y="82" width="23" height="17" rx="6"/></g><path d="M97 89h6" stroke="#1b2533" stroke-width="2.4"/>`,
    earrings: () => `<circle cx="61" cy="112" r="3.4" fill="#e7b64a"/><circle cx="139" cy="112" r="3.4" fill="#e7b64a"/>`
  };
  /* one character, a bust in a 200×240 box; adult proportions, flat shading */
  function charSVG(id, c, opts) {
    const o = opts || {}, skin = c.skin || "#c68a64", sk2 = shade(skin, -0.14), hair = c.hairColor || "#222", top = c.top || "#2d6cb5";
    const head = o.headOnly;
    return `<svg class="scn-cs" viewBox="${head ? "40 20 120 120" : "0 0 200 240"}" aria-hidden="true" focusable="false">
      ${head ? "" : `<path d="M14 240c4-44 22-70 58-80l28 10 28-10c36 10 54 36 58 80z" fill="${top}"/>
      <path d="M72 160l28 26 28-26-10-4-18 14-18-14z" fill="${c.collar || "#eef2f7"}"/>
      <path d="M14 240c4-44 22-70 58-80l-6 16c-24 12-34 34-36 64z" fill="${shade(top, -0.12)}"/>`}
      <rect x="86" y="118" width="28" height="42" rx="12" fill="${sk2}"/>
      ${BACK_HAIR[c.hair] ? BACK_HAIR[c.hair](hair) : ""}
      <ellipse cx="62" cy="96" rx="7" ry="10" fill="${sk2}"/><ellipse cx="138" cy="96" rx="7" ry="10" fill="${sk2}"/>
      <path d="M100 38c-24 0-40 20-40 50 0 30 18 50 40 50s40-20 40-50c0-30-16-50-40-50z" fill="${skin}"/>
      <path d="M128 60c8 10 12 22 12 36 0 22-12 38-28 42 16-10 22-40 16-78z" fill="${sk2}" opacity=".35"/>
      <g class="scn-eyes"><ellipse cx="86" cy="91" rx="6" ry="4.4" fill="#fff"/><ellipse cx="114" cy="91" rx="6" ry="4.4" fill="#fff"/>
      <circle cx="86.6" cy="91.4" r="3.2" fill="#2a1c14"/><circle cx="114.6" cy="91.4" r="3.2" fill="#2a1c14"/>
      <circle cx="87.8" cy="90" r="1" fill="#fff"/><circle cx="115.8" cy="90" r="1" fill="#fff"/></g>
      <path d="M77 81q9-5 17-1M106 80q8-4 17 1" stroke="${shade(hair, 0.05)}" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M100 94q-5 12 1 14" stroke="${sk2}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path class="scn-m0" d="M89 116q11 8 22 0" stroke="#7a3b2e" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <g class="scn-m1"><ellipse cx="100" cy="117" rx="8.5" ry="6" fill="#5a1f1a"/><ellipse cx="100" cy="120.5" rx="5" ry="2.4" fill="#d9716a"/><path d="M92 114.6h16" stroke="#fff" stroke-width="2" opacity=".85"/></g>
      ${HAIR[c.hair] ? HAIR[c.hair](hair) : ""}
      ${ACC[c.accessory] ? ACC[c.accessory]() : ""}
    </svg>`;
  }
  /* the one setting so far; a new setting is one more entry here and a name in scene.json */
  const SETTINGS = {
    office: () => `<defs><linearGradient id="scnWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6edf6"/><stop offset="1" stop-color="#cfdbea"/></linearGradient>
        <linearGradient id="scnSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9d6f2"/><stop offset="1" stop-color="#e3eef9"/></linearGradient></defs>
      <rect width="640" height="360" fill="url(#scnWall)"/>
      <rect x="28" y="36" width="250" height="176" rx="6" fill="url(#scnSky)"/>
      <path d="M28 212V150h26v-26h22v40h18v-58h30v70h20v-36h26v48h24v-80h28v60h22v-30h34v74z" fill="#9db4cf" opacity=".85"/>
      <path d="M28 212V172h40v-20h24v36h30v-28h36v40h26v-54h30v44h32v-24h32v46z" fill="#8aa3c2" opacity=".7"/>
      <path d="M28 36h250v176H28z M153 36v176 M28 124h250" fill="none" stroke="#f7fafd" stroke-width="5"/>
      <rect x="0" y="232" width="640" height="3" fill="#38bdf8" opacity=".55"/>
      <rect x="0" y="276" width="640" height="84" fill="#b9c6d6"/>
      <rect x="396" y="150" width="210" height="10" rx="3" fill="#8b6f58"/>
      <rect x="410" y="160" width="8" height="116" fill="#6f5846"/><rect x="584" y="160" width="8" height="116" fill="#6f5846"/>
      <rect x="452" y="74" width="120" height="72" rx="6" fill="#1d2a3d"/><rect x="507" y="146" width="10" height="6" fill="#1d2a3d"/>
      <g fill="#38bdf8"><rect x="466" y="120" width="12" height="16"/><rect x="484" y="108" width="12" height="28"/><rect x="502" y="114" width="12" height="22"/><rect x="520" y="96" width="12" height="40"/></g>
      <path d="M538 126l10-10 8 6 10-18" stroke="#5eead4" stroke-width="2.4" fill="none"/>
      <rect x="306" y="206" width="34" height="46" rx="5" fill="#d8d2c8"/>
      <g fill="#2f8f6b"><path d="M323 208c-18-18-22-40-8-52 4 18 8 32 8 52z"/><path d="M323 208c14-22 30-30 42-24-12 8-24 16-42 24z"/><path d="M323 208c-8-26 0-46 12-52-2 20-6 34-12 52z" fill="#3aa57c"/></g>`
  };
  function bgSVG(setting) { return `<svg class="scn-bg" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${(SETTINGS[setting] || SETTINGS.office)()}</svg>`; }
  /* the same picture as one standalone SVG file (scenes/<slug>/poster.svg,
     written by scripts/build_scene.mjs): what an <img> shows wherever a clip
     id gets a thumbnail — Home rows, My clips, the clip lists */
  function posterSVG(scene, castMap) {
    const ids = (scene.cast || []).slice(0, 2), w = 211, hh = Math.round(w * 240 / 200), y = 385 - hh;
    const chars = ids.map((id, i) => castMap[id] ? charSVG(id, castMap[id]).replace('<svg class="scn-cs" viewBox="0 0 200 240" aria-hidden="true" focusable="false">', `<svg x="${i ? 640 - 58 - w : 58}" y="${y}" width="${w}" height="${hh}" viewBox="0 0 200 240">`).replace(/<g class="scn-m1">[\s\S]*?<\/g>/, "") : "").join("");   /* no CSS in a file: drop the open mouth */
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">${(SETTINGS[scene.setting] || SETTINGS.office)()}${chars}</svg>`;
  }
  function stageLabel(scene, castMap) {
    const who = (scene.cast || []).map(id => castMap[id] ? castMap[id].name + ", " + castMap[id].role : "").filter(Boolean).join("; ");
    return T("scn.stage_a11y", { title: scene.title, who });
  }

  /* ---------- the timeline, from the captions ---------- */
  function timeline(cap) {
    const cues = (cap && cap.cues || []).filter(c => isFinite(c.t)).slice().sort((a, b) => a.t - b.t);
    const words = (cap && cap.words || []).filter(w => isFinite(w.t)).slice().sort((a, b) => a.t - b.t);
    /* a turn lasts from its first word to a moment after its last one */
    const turns = cues.map((c, i) => {
      const next = i + 1 < cues.length ? cues[i + 1].t : Infinity;
      const ws = words.filter(w => w.t >= c.t - 0.06 && w.t < next);
      const last = ws.length ? ws[ws.length - 1].t : c.t;
      return { spk: c.spk, from: c.t, to: Math.min(next, last + 0.55), words: ws.map((w, k) => ({ t: w.t, end: k + 1 < ws.length ? ws[k + 1].t : last + 0.45 })) };
    });
    return turns;
  }
  function at(turns, t) {
    for (const tn of turns) if (t >= tn.from && t < tn.to) {
      let open = false;
      for (const w of tn.words) if (t >= w.t && t < w.end) { open = (t - w.t) < Math.min(0.26, (w.end - w.t) * 0.62); break; }
      return { spk: tn.spk, open };
    }
    return { spk: null, open: false };
  }

  /* ---------- the player ---------- */
  /* A near-empty WAV, played inside the tap that opened the scene so iOS lets
     the same element play the real file once it has been fetched. */
  /* a REAL silent clip (50 ms). The old primer had an empty data chunk, which an
     iPhone may reject as unplayable — and that late error was read as the scene's
     own sound failing (owner, 6 Oct 2026: "The scene's sound could not load"). */
  const SILENT = "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";
  class ScenePlayer {
    constructor(elId, opts) {
      opts = opts || {};
      const ev = opts.events || {}, pv = opts.playerVars || {};
      this._ev = ev; this._vid = opts.videoId; this._state = -1; this._gone = false; this._title = ""; this._raf = null; this._url = null;
      this._start = Math.max(0, Number(pv.start) || 0);
      const el = document.getElementById(elId); if (!el) throw new Error("ScenePlayer: no element " + elId);
      const root = document.createElement("div");
      root.className = "scn scn-live"; root.setAttribute("role", "img"); root.dataset.state = "load";
      if (reduced()) root.classList.add("still");
      el.appendChild(root); this._root = root;
      const a = new Audio(); a.preload = "auto"; a.setAttribute("playsinline", ""); try { a.preservesPitch = true; } catch (e) {}
      this._a = a;
      try { a.src = SILENT; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
      const set = (s) => { this._state = s; this._draw(); try { if (ev.onStateChange) ev.onStateChange({ data: s, target: this }); } catch (e) {} };
      a.addEventListener("playing", () => { if (this._ready) { set(1); this._loop(); } });
      a.addEventListener("pause", () => { if (this._ready) set(2); });
      a.addEventListener("waiting", () => { if (this._ready) set(3); });
      a.addEventListener("ended", () => { if (this._ready) set(0); });
      /* Only an error on the scene's OWN file counts (not the primer's), and the first
         one is answered by reloading at the same moment — iOS can drop a media element
         when a recording takes the audio over. The learner is told only if that fails. */
      a.addEventListener("error", () => {
        if (!this._ready || this._gone || !this._url || a.src !== this._url && a.src !== this._direct) return;
        if (!this._retried) { this._retried = true; const at = this._lastT || 0;
          try { a.src = this._direct || this._url; a.load(); a.addEventListener("loadedmetadata", () => { try { a.currentTime = at; } catch (e) {} this._state = 2; this._draw(); }, { once: true }); } catch (e) {}
          return; }
        try { if (ev.onError) ev.onError({ data: 5, target: this }); } catch (e) {}
      });
      a.addEventListener("loadedmetadata", () => { if (this._ready) this._retried = false; });
      a.addEventListener("timeupdate", () => { this._lastT = a.currentTime || 0; });
      this._init().catch(() => { if (!this._gone) { root.dataset.state = "err"; try { if (ev.onError) ev.onError({ data: 5, target: this }); } catch (e) {} } });
    }
    async _init() {
      const vid = this._vid;
      const [scene, castMap, cap] = await Promise.all([load(vid), cast(), getJSON(capUrl(vid))]);
      if (this._gone) return;
      this._scene = scene; this._cast = castMap; this._title = scene.title; this._turns = timeline(cap);
      const ids = (scene.cast || []).slice(0, 2);
      this._root.setAttribute("aria-label", stageLabel(scene, castMap));
      this._root.innerHTML = bgSVG(scene.setting) +
        ids.map((id, i) => castMap[id] ? `<span class="scn-c scn-c${i}" data-id="${ESC(id)}">${charSVG(id, castMap[id])}<span class="scn-tag"><b>${ESC(castMap[id].name)}</b><small>${ESC(castMap[id].role)}</small><i class="scn-eq" aria-hidden="true"><em></em><em></em><em></em></i></span></span>` : "").join("") +
        `<span class="scn-status" role="status" aria-live="polite"></span><span class="scn-ai">${ESC(T("scn.ai_voices"))}</span>` +
        `<button type="button" class="scn-go" aria-label="${ESC(T("scn.play"))}"><span>${playIcon()}</span></button>`;
      this._root.querySelector(".scn-go").onclick = () => this.playVideo();
      /* the file is fetched whole (not streamed by the element) so a cached copy
         is a plain 200 the service worker can answer offline, and seeking works */
      const file = dir(vid) + (scene.audio || "audio.mp3");
      const a = this._a; try { a.pause(); } catch (e) {}
      const tryLoad = src => new Promise((res, rej) => { a.onloadedmetadata = res; a.onerror = () => { if (a.src === src) rej(new Error("media " + (a.error && a.error.code))); }; a.src = src; a.load(); setTimeout(() => rej(new Error("media timeout")), 15000); });
      try {
        const r = await fetch(file);
        if (!r.ok) throw new Error("audio " + r.status);
        const blob = await r.blob();
        if (this._gone) return;
        this._url = URL.createObjectURL(blob);
        await tryLoad(this._url);
      } catch (e) {
        /* the in-memory copy failed: let the element read the file itself */
        if (this._gone) return;
        this._direct = new URL(file, location.href).href; if (!this._url) this._url = this._direct;
        await tryLoad(this._direct);
      }
      a.onloadedmetadata = null; a.onerror = null;
      if (this._gone) return;
      if (this._start) try { a.currentTime = this._start; } catch (e) {}
      this._ready = true; this._state = 5; this._draw();
      try { if (this._ev.onReady) this._ev.onReady({ target: this }); } catch (e) {}
    }
    /* ---- the YT.Player surface ---- */
    getCurrentTime() { return this._ready ? (this._a.currentTime || 0) : this._start; }
    getDuration() { return this._ready && isFinite(this._a.duration) ? this._a.duration : 0; }
    getPlayerState() { return this._state; }
    getPlaybackRate() { return this._a.playbackRate || 1; }
    getVideoData() { return { title: this._title, video_id: this._vid }; }
    playVideo() {
      if (!this._ready) return;
      const p = this._a.play();
      if (p && p.catch) p.catch(() => { this._blocked = true; this._state = 2; this._draw(); });
      this._blocked = false;
    }
    pauseVideo() { try { this._a.pause(); } catch (e) {} }
    seekTo(t) { const v = Math.max(0, Number(t) || 0); if (!this._ready) { this._start = v; return; } try { this._a.currentTime = v; } catch (e) {} this._draw(); }
    setPlaybackRate(r) { try { this._a.playbackRate = Number(r) || 1; } catch (e) {} }
    destroy() {
      this._gone = true; cancelAnimationFrame(this._raf); this._raf = null;
      try { this._a.pause(); this._a.removeAttribute("src"); this._a.load(); } catch (e) {}
      if (this._url) try { URL.revokeObjectURL(this._url); } catch (e) {}
      try { if (this._root && this._root.parentNode) this._root.parentNode.removeChild(this._root); } catch (e) {}
      this._root = null;
    }
    /* ---- the scene's own layer ---- */
    speakerAt(t) { return this._turns ? at(this._turns, t).spk : null; }
    castMember(id) { return this._cast && this._cast[id] || null; }
    /* the studio tells the stage what the LEARNER is doing: {kind, text} or null */
    setStatus(s) { this._ext = s || null; this._draw(); }
    _loop() {
      if (this._raf || this._gone) return;
      const step = () => { this._raf = null; if (this._gone || this._state !== 1) { this._draw(); return; } this._draw(); this._raf = requestAnimationFrame(step); };
      this._raf = requestAnimationFrame(step);
    }
    _draw() {
      const root = this._root; if (!root || !this._turns) return;
      const playing = this._state === 1, t = this.getCurrentTime();
      const now = playing ? at(this._turns, t) : { spk: null, open: false };
      const still = root.classList.contains("still");
      const st = playing ? "play" : this._ready ? (this._state === -1 || this._state === 5 || this._blocked ? "idle" : "pause") : "load";
      if (root.dataset.state !== st) root.dataset.state = st;
      const spk = now.spk || "";
      if ((root.dataset.spk || "") !== spk) {
        if (spk) root.dataset.spk = spk; else delete root.dataset.spk;
        root.classList.toggle("talk", !!spk);
        root.querySelectorAll(".scn-c").forEach(e => e.classList.toggle("on", !!spk && e.dataset.id === spk));
      }
      const mouth = !still && now.open ? "1" : "0";
      if (root.dataset.mouth !== mouth) root.dataset.mouth = mouth;
      /* the words for the status line: the learner's state first, else who is speaking */
      const x = this._ext, c = spk && this.castMember(spk);
      const kind = x ? x.kind : c ? "speak" : "";
      const text = x ? x.text : c ? T("scn.speaking", { name: c.name }) : "";
      const el = root.querySelector(".scn-status");
      if (el && (el.dataset.k !== kind || el.textContent !== text)) {
        el.dataset.k = kind; el.hidden = !text;
        el.innerHTML = text ? `<i class="scn-dot" aria-hidden="true"></i>${ESC(text)}` : "";
      }
    }
  }
  function playIcon() { return `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>`; }

  global.ShadowScenes = { is, slug, dir, capUrl, load, cast, list, configure, charSVG, posterSVG, timeline, at, ScenePlayer };
})(typeof window !== "undefined" ? window : globalThis);
