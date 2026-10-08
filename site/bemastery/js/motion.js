/* ───────────────────────────────────────────────────────────────────────────
   MotionSystem — every recurring animation on this page is owned here.

   There is exactly ONE requestAnimationFrame loop and ONE pulse scheduler.
   Components do not set their own intervals; they register with the system and
   are driven by it, so the page cannot end up with runaway timers.

     MotionSystem
       ├── AmbientBackground   slow light fields (CSS, no JS per frame)
       ├── ParticleField       canvas, 20–46 particles, cursor-aware
       ├── IntelligencePulse   the ~4 s "the system is thinking" event
       ├── FloatingElements    weightless drift, registered not self-timed
       ├── Parallax / Tilt     pointer-driven depth on the hero composition
       └── Reveal              IntersectionObserver, once per section

   It stops itself when: the tab is hidden, the animated area is off-screen,
   the visitor prefers reduced motion, or the device looks low-powered.
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarse  = window.matchMedia("(pointer: coarse)");
  var lowPower = (navigator.hardwareConcurrency || 8) <= 4
              || (navigator.deviceMemory || 8) <= 2;

  var root = document.documentElement;

  var M = {
    running:false, visible:true, inView:true,
    t0:performance.now(), raf:0,
    frames:[],        // per-frame subscribers
    floaters:[],      // registered floating elements
    pulseAt:0, pulseIndex:0, pulse:0
  };

  function motionOff(){ return reduced.matches; }

  /* ── FloatingElements ────────────────────────────────────────────────────
     Each floater gets its own amplitude, period, phase and rotation so no two
     move alike. Driven from the shared loop; transform only, never layout.  */
  function registerFloaters(){
    M.floaters = [].slice.call(document.querySelectorAll("[data-float]")).map(function (el, i) {
      var speed = parseFloat(el.dataset.floatSpeed || 0) || (7 + (i % 4) * 1.8);
      return {
        el:el,
        ampY:parseFloat(el.dataset.floatY || 0) || (7 + (i % 3) * 3),
        ampX:parseFloat(el.dataset.floatX || 0) || (3 + (i % 2) * 2.5),
        rot:parseFloat(el.dataset.floatRot || 0) || (0.7 + (i % 3) * 0.35),
        period:speed, phase:(i * 1.7) % 6.28,
        depth:parseFloat(el.dataset.depth || 0) || (0.4 + (i % 4) * 0.22)
      };
    });
  }

  /* ── Parallax / Tilt ─────────────────────────────────────────────────── */
  var px = 0, py = 0, tx = 0, ty = 0;           // pointer, smoothed
  var stage = null;
  function onPointer(e){
    if (motionOff() || coarse.matches || !stage) return;
    var r = stage.getBoundingClientRect();
    tx = ((e.clientX - (r.left + r.width  / 2)) / (r.width  / 2));
    ty = ((e.clientY - (r.top  + r.height / 2)) / (r.height / 2));
    tx = Math.max(-1, Math.min(1, tx));
    ty = Math.max(-1, Math.min(1, ty));
  }

  /* ── IntelligencePulse ───────────────────────────────────────────────────
     Fires about every 4 s with deterministic variation, so it reads as
     thinking rather than as a loop. One shared 0→1 value (--pulse) that CSS
     and the particle field both read; nothing is duplicated per component.  */
  var PULSE_PERIOD = 4000, PULSE_LEN = 1000, lastPulseWritten = "0";
  function nextPulseDelay(){
    // varied but deterministic: 4.0s, 4.5s, 3.7s, 4.3s, …
    var v = [0, 500, -300, 300, -150, 650][M.pulseIndex % 6];
    return PULSE_PERIOD + v;
  }
  function pulseShape(p){                        // 0→1→0, gather then release
    if (p < .22) return p / .22 * .55;            // particles gather
    if (p < .40) return .55 + (p - .22) / .18 * .45; // energy expands
    return Math.max(0, 1 - (p - .40) / .60);      // settle back
  }
  var litCards = [];
  function startPulse(now){
    M.pulseAt = now;
    M.pulseIndex++;
    if (!litCards.length) litCards = [].slice.call(document.querySelectorAll(".float"));
    if (litCards.length) {                        // one card at a time, in turn
      var el = litCards[M.pulseIndex % litCards.length];
      el.dataset.lit = "true";
      setTimeout(function(){ el.dataset.lit = "false"; }, 620);
    }
  }

  /* ── ParticleField ───────────────────────────────────────────────────────
     20–46 particles. They drift, thread faint lines to close neighbours, lean
     toward the pointer, and are pulled toward the centre during a pulse.     */
  var canvas, ctx, parts = [], cw = 0, ch = 0, dpr = 1;
  function initParticles(){
    canvas = document.getElementById("particles");
    if (!canvas) return;
    ctx = canvas.getContext("2d", { alpha:true });
    sizeCanvas();
    var n = coarse.matches ? 18 : (window.innerWidth < 900 ? 26 : 42);
    if (lowPower) n = Math.min(n, 16);
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x:Math.random() * cw, y:Math.random() * ch,
        vx:(Math.random() - .5) * .12, vy:(Math.random() - .5) * .12,
        r:Math.random() * 1.5 + .7, a:Math.random() * .4 + .18
      });
    }
  }
  function sizeCanvas(){
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawParticles(){
    if (!ctx) return;
    ctx.clearRect(0, 0, cw, ch);
    var pull = M.pulse, mx = cw / 2, my = ch / 2;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx + px * .35 * p.r;
      p.y += p.vy + py * .35 * p.r;
      if (pull > 0.01) {                          // gather toward the centre
        p.x += (mx - p.x) * .012 * pull;
        p.y += (my - p.y) * .012 * pull;
      }
      if (p.x < -20) p.x = cw + 20; if (p.x > cw + 20) p.x = -20;
      if (p.y < -20) p.y = ch + 20; if (p.y > ch + 20) p.y = -20;

      for (var j = i + 1; j < parts.length; j++) {  // faint threads
        var q = parts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 < 6400) {                            /* ~80px: short threads only,
                                                       a long-line web reads as
                                                       a crypto constellation */
          ctx.globalAlpha = (1 - d2 / 6400) * (.07 + pull * .13);
          ctx.strokeStyle = "#818cf8"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = Math.min(.8, p.a * .8 + pull * .4);
      ctx.fillStyle = pull > .35 ? "#a5b4fc" : "#7c85e8";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + pull * .5, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ── the single loop ─────────────────────────────────────────────────── */
  function frame(now){
    M.raf = 0;
    if (!M.running) return;

    /* pulse state */
    if (!M.pulseAt) M.pulseAt = now + 1200;
    var since = now - M.pulseAt;
    if (since >= 0 && since <= PULSE_LEN) M.pulse = pulseShape(since / PULSE_LEN);
    else M.pulse = 0;
    if (since > nextPulseDelay()) startPulse(now);
    /* --pulse is 0 for ~3 of every 4 seconds; only write when it actually
       changes, so the idle stretch costs no style recalculation at all. */
    var pv = M.pulse.toFixed(3);
    if (pv !== lastPulseWritten) { root.style.setProperty("--pulse", pv); lastPulseWritten = pv; }

    /* smoothed pointer */
    px += (tx - px) * .06; py += (ty - py) * .06;
    if (stage) {
      stage.style.setProperty("--tilt-x", (py * -3).toFixed(2) + "deg");
      stage.style.setProperty("--tilt-y", (px *  3).toFixed(2) + "deg");
    }

    /* floaters */
    var t = (now - M.t0) / 1000;
    for (var i = 0; i < M.floaters.length; i++) {
      var f = M.floaters[i];
      var y = Math.sin(t / f.period * 6.2832 + f.phase) * f.ampY;
      var x = Math.cos(t / (f.period * 1.35) * 6.2832 + f.phase) * f.ampX + px * 14 * f.depth;
      var r = Math.sin(t / (f.period * 1.6) * 6.2832 + f.phase) * f.rot;
      f.el.style.transform = "translate3d(" + x.toFixed(2) + "px," +
        (y + py * 10 * f.depth).toFixed(2) + "px,0) rotate(" + r.toFixed(2) + "deg)";
    }

    drawParticles();
    for (var k = 0; k < M.frames.length; k++) M.frames[k](t, M.pulse);
    M.raf = requestAnimationFrame(frame);
  }

  function start(){
    if (M.running || motionOff() || !M.visible || !M.inView) return;
    M.running = true; M.t0 = performance.now(); M.pulseAt = 0;
    M.raf = requestAnimationFrame(frame);
  }
  function stop(){
    M.running = false;
    if (M.raf) cancelAnimationFrame(M.raf);
    M.raf = 0;
    root.style.setProperty("--pulse", "0"); lastPulseWritten = "0";
  }

  /* ── Reveal — once per element, never re-triggered on scroll-up ───────── */
  function initReveal(){
    var els = [].slice.call(document.querySelectorAll("[data-reveal]"));
    if (motionOff() || !("IntersectionObserver" in window)) {
      els.forEach(function (e) { e.dataset.revealed = "true"; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseInt(el.dataset.revealDelay || "0", 10);
        setTimeout(function(){ el.dataset.revealed = "true"; }, d);
        io.unobserve(el);
      });
    }, { threshold:.12, rootMargin:"0px 0px -8% 0px" });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ── lifecycle gates ─────────────────────────────────────────────────── */
  function initGates(){
    document.addEventListener("visibilitychange", function () {
      M.visible = !document.hidden;
      M.visible ? start() : stop();
    });
    var hero = document.getElementById("hero");
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {       // expensive work only near the hero
        M.inView = e[0].isIntersecting;
        M.inView ? start() : stop();
      }, { rootMargin:"120px" }).observe(hero);
    }
    var onChange = function () { motionOff() ? stop() : start(); };
    reduced.addEventListener ? reduced.addEventListener("change", onChange)
                             : reduced.addListener(onChange);
    var rt;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(function(){ sizeCanvas(); initParticles(); }, 180);
    }, { passive:true });
  }

  window.MotionSystem = {
    init:function(){
      stage = document.querySelector("[data-stage]");
      registerFloaters();
      initReveal();
      initGates();
      if (motionOff()) { root.dataset.motion = "reduced"; return; }
      root.dataset.motion = "full";
      initParticles();
      window.addEventListener("pointermove", onPointer, { passive:true });
      start();
    },
    onFrame:function (fn) { M.frames.push(fn); },
    stop:stop, start:start,
    get pulse(){ return M.pulse; }
  };
})();
