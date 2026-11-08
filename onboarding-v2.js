/* ============================================================================
   BE Mastery — Onboarding V2 (General English only, flag onboarding_v2_enabled)
   --------------------------------------------------------------------------
   The initial flow (name → native language → profession → goal → daily situations
   → speaking confidence → review), "Tune your practice" (priorities, vocabulary goals,
   practice methods, schedule) and the Profile "Learning profile" editor.

   Everything is built on ONE reusable selection panel (pick) and a few inline
   controls. The learner profile is written ONLY through lpSet (learner-profile.js:
   the `lp` Firestore field), never into S.profile; the legacy S.profile fields
   (role, goal, selfLevel) are one-way mirrors for older readers, written by lpMirror.

   Stability notes (the Android ghosting investigation): a toggle updates classes in
   place and never re-renders; a step is rendered once; the sheet is sized from
   visualViewport (keyboard-aware) with top/height, never a transform; nothing
   animates on toggle; prefers-reduced-motion removes every transition.
   ============================================================================ */
(function (global) {
  const C = () => global.OnboardingCatalog, LP = () => global.LearnerProfile;
  /* S, LANGS, TRANSLATED and OB are let/const in the main script: visible by bare name from here, but NOT properties of window */
  const gS = () => (typeof S !== "undefined" ? S : null);
  const gLANGS = () => (typeof LANGS !== "undefined" ? LANGS : []);
  const gTR = () => (typeof TRANSLATED !== "undefined" ? TRANSLATED : new Set());
  const gOB = () => (typeof OB !== "undefined" ? OB : null);
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tr = (k, v) => (typeof t === "function" ? t(k, v) : k);
  /* a catalog label as the learner sees it: the translation if there is one, else the English source text */
  function lbl(cat, item) { const k = cat + "." + item.id, v = tr(k); return v === k ? item.label : v; }
  const ICON = n => (typeof ic === "function" ? ic(n) : "");

  /* ------------------------------------------------------------------ CSS (injected once; GE only) */
  function css() {
    if (document.getElementById("obxCss")) return;
    const s = document.createElement("style"); s.id = "obxCss";
    s.textContent = `
.obx-card{max-width:520px;width:100%;margin:auto;text-align:center}
.obx-card h1{margin:6px 0 8px}
.obx-card .sub{margin:0 auto 18px;max-width:420px}
.obx-field{width:100%;max-width:340px;margin:0 auto 14px;display:block;text-align:center;font-size:16px}
.obx-pick{display:flex;align-items:center;gap:12px;width:100%;max-width:380px;margin:0 auto 12px;padding:14px 16px;min-height:56px;border:1px solid var(--line2);border-radius:16px;background:var(--card);color:var(--txt);font:inherit;font-weight:600;text-align:left;cursor:pointer}
.obx-pick small{display:block;color:var(--mut);font-weight:500;font-size:12.5px;margin-top:2px}
.obx-pick .obx-pick-t{flex:1;min-width:0}
.obx-pick .obx-chev{width:18px;height:18px;color:var(--mut);flex:none}
.obx-pick.set{border-color:var(--acc);background:color-mix(in srgb,var(--accent) 10%,var(--card))}
.obx-list{display:flex;flex-direction:column;gap:8px;width:100%;max-width:380px;margin:0 auto 16px;text-align:left}
.obx-grp{margin:14px 2px 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:700}
.obx-row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:12px 14px;border:1px solid var(--line2);border-radius:14px;background:var(--card);color:var(--txt);font:inherit;font-size:15px;font-weight:600;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent}
.obx-row .obx-mark{flex:none;width:24px;height:24px;border-radius:50%;border:1.5px solid var(--line2);display:grid;place-items:center;font-size:12px;font-weight:800;color:transparent}
.obx-row .obx-mark svg{width:14px;height:14px;opacity:0}
.obx-row.on{border-color:var(--acc);background:color-mix(in srgb,var(--accent) 12%,var(--card))}
.obx-row.on .obx-mark{border-color:var(--acc);background:var(--acc);color:#fff}
.obx-row.on .obx-mark svg{opacity:1;color:#fff}
.obx-row .obx-t{flex:1;min-width:0}
.obx-row .obx-tr{flex:none;display:grid;place-items:center;margin-inline-start:10px}
.obx-row .obx-t small{display:block;color:var(--mut);font-weight:500;font-size:12px;margin-top:1px}
.obx-row[aria-disabled="true"]{opacity:.55}
.obx-main{margin:6px auto 14px;max-width:380px;text-align:left}
.obx-main h3{font-size:13px;margin:0 0 6px;color:var(--mut);font-weight:700;letter-spacing:.04em}
.obx-main .obx-row{min-height:46px;font-size:14px}
.obx-note{max-width:380px;margin:0 auto 14px;color:var(--mut);font-size:13px;line-height:1.45}
.obx-bar{position:sticky;bottom:0;z-index:5;margin:14px -20px 0;padding:10px 20px max(12px,calc(env(safe-area-inset-bottom) + 8px));background:var(--bg);border-top:1px solid var(--line2)}
/* A sticky element stops at the scrollport's bottom PADDING edge, so the list kept scrolling
   through the strip underneath the bar and was visible there (owner, 7 Nov 2026). Paint it. */
.obx-bar::after{content:"";position:absolute;left:0;right:0;top:100%;height:calc(max(24px,calc(env(safe-area-inset-bottom) + 16px)) + var(--obx-kb,0px));background:var(--bg);pointer-events:none}
/* The question stays on screen while the learner scrolls its answers, and the group heading
   ("AT WORK") pins just under it and swaps as the list moves past (owner, 7 Nov 2026). */
.obx-top{position:sticky;top:0;z-index:4;background:var(--bg);padding-bottom:2px}
/* the same padding-edge gap as the bar, at the top: cover it, and overhang the card's sides */
.obx-top::before{content:"";position:absolute;left:-24px;right:-24px;bottom:100%;height:max(28px,calc(env(safe-area-inset-top) + 4px));background:var(--bg);pointer-events:none}
.obx-card .obx-list .obx-grp,.obx-card .obx-sum .obx-grp{position:sticky;top:var(--obx-top-h,0px);z-index:3;background:var(--bg);margin:6px 0 0;padding:8px 2px 6px}
.obx-bar-row{display:flex;align-items:center;gap:10px;max-width:420px;margin:0 auto}
.obx-bar .obx-go{flex:1;margin:0;min-height:50px}
.obx-bar .obx-back{flex:none;padding:10px 8px}
.obx-status{max-width:420px;margin:0 auto 8px;font-size:13px;color:var(--mut);text-align:center;min-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.obx-sum{width:100%;max-width:400px;margin:0 auto 14px;text-align:left}
.obx-sum-row{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;border:1px solid var(--line2);border-radius:14px;background:var(--card);color:var(--txt);font:inherit;margin-bottom:8px;cursor:pointer;min-height:52px}
/* The answer is what the learner reads; the field name is only there to say what it answers.
   So the value leads on the left and the label sits quietly on the right — no shouted capitals,
   no letter-spacing, lower contrast: less to fight through on a dark screen (owner, 7 Nov 2026). */
.obx-sum-row .obx-sum-t{flex:1;min-width:0;text-align:start}
.obx-sum-row .k{flex:none;max-width:42%;text-align:end;font-size:11.5px;line-height:1.3;font-weight:600;color:var(--mut2,var(--mut));letter-spacing:0;text-transform:none;opacity:.85}
.obx-sum-row .v{font-weight:600;font-size:15px;overflow-wrap:anywhere}
.obx-sum-row.is-set{border-color:color-mix(in srgb,var(--acc) 45%,var(--line2));background:color-mix(in srgb,var(--acc) 8%,var(--card))}
.obx-sum-row.is-set .v{color:var(--acc2,var(--acc))}
.obx-sum-row.is-empty .v{color:var(--mut);font-weight:500}
.obx-sum-row.is-empty .obx-chev{opacity:.7}
.obx-sum-row .obx-chev{margin-left:auto;width:18px;height:18px;color:var(--mut);flex:none}
.obx-back{background:none;border:0;color:var(--mut);font:inherit;font-size:14px;padding:10px 6px;cursor:pointer;min-height:44px}
.obx-tools{display:flex;justify-content:space-between;align-items:center;max-width:380px;margin:0 auto 4px}
/* the selection panel */
.obx-sheet{position:fixed;left:0;right:0;top:0;height:100vh;z-index:300;background:var(--bg);display:flex;flex-direction:column;opacity:1;overscroll-behavior:contain}
.obx-sheet.obx-in{animation:obxIn .16s ease-out}
@keyframes obxIn{from{opacity:0}to{opacity:1}}
.obx-head{display:flex;align-items:center;gap:6px;padding:max(10px,env(safe-area-inset-top)) 12px 4px}
.obx-head h2{flex:1;margin:0;font-size:18px;font-weight:800;text-align:left;outline:none}
.obx-x{flex:none;width:44px;height:44px;border:0;border-radius:12px;background:none;color:var(--txt);cursor:pointer;display:grid;place-items:center}
.obx-x svg{width:22px;height:22px}
.obx-search{position:relative;margin:4px 14px 6px}
.obx-search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:18px;height:18px;color:var(--mut);pointer-events:none}
.obx-search input{width:100%;box-sizing:border-box;padding:13px 14px 13px 42px;font-size:16px;border-radius:14px}
.obx-gchips{display:flex;gap:8px;overflow-x:auto;padding:4px 14px 8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex:none}
.obx-gchips::-webkit-scrollbar{display:none}
.obx-gchips button{flex:none;min-height:36px;padding:6px 12px;border:1px solid var(--line2);border-radius:999px;background:var(--card);color:var(--txt);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .15s,border-color .15s}
/* which group the list is showing: the chips are jump links, so the lit one is a position, not a choice */
.obx-gchips button.on{border-color:var(--acc);background:color-mix(in srgb,var(--accent) 22%,var(--card));color:var(--txt);font-weight:700}
.obx-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:0 14px 12px}
.obx-body .obx-grp{position:sticky;top:0;z-index:1;margin:0;padding:12px 2px 6px;background:var(--bg)}
.obx-body .obx-row{margin-bottom:8px}
.obx-sub{margin:0 14px 6px;color:var(--mut);font-size:13.5px;line-height:1.4;text-align:left}
.obx-foot{flex:none;display:flex;align-items:center;gap:12px;padding:10px 14px max(12px,calc(env(safe-area-inset-bottom) + 10px));border-top:1px solid var(--line2);background:var(--bg)}
.obx-foot .obx-count{flex:1;min-width:0;font-size:13px;color:var(--mut);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.obx-foot button{min-height:48px;min-width:132px}
.obx-empty{padding:28px 8px;color:var(--mut);text-align:center;font-size:14px;line-height:1.5}
.obx-other-in{margin:0 0 10px;width:100%;box-sizing:border-box;font-size:16px}
.obx-sheet.obx-tight .obx-sub,.obx-sheet.obx-tight .obx-gchips{display:none}
.obx-sheet.obx-tight .obx-head{padding-top:6px;padding-bottom:0}
.obx-sheet.obx-tight .obx-head h2{font-size:16px}
.obx-sheet.obx-tight .obx-search{margin-top:0;margin-bottom:4px}
.obx-sheet.obx-tight .obx-foot{padding-top:6px}
.obx-sheet.obx-tight .obx-row{min-height:46px;padding:9px 12px}
#obWrap:has(.obx-card){padding-bottom:calc(max(24px,calc(env(safe-area-inset-bottom) + 16px)) + var(--obx-kb,0px))}
#obWrap.obx-kb-open .obx-card .ob-logo{display:none}
#obWrap.obx-kb-open .obx-card h1{font-size:clamp(17px,2.6vh,24px)}
.obx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.obx-sheet.obx-in{animation:none}.obx-row,.obx-pick,.obx-sum-row{transition:none}}
`;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ the selection panel */
  /* opts: {title, sub, items, groups, multi, max, ordered, selected, suggested, other:{id,placeholder,value}|null,
            labelOf, cat, search:true|false, groupChips:true|false, confirmLabel, emptyKey, onConfirm(ids, otherText), onCancel}
     items: [{id,label,aliases,group,hidden}] */
  function pick(o) {
    css();
    const cat = o.cat || "x", labelOf = o.labelOf || (it => lbl(cat, it));
    const items = (o.items || []).filter(i => !i.hidden), byId = new Map(items.map(i => [i.id, i]));
    let sel = (o.selected || []).filter(id => byId.has(id) || (o.other && id === o.other.id));
    let otherText = (o.other && o.other.value) || "";
    const max = o.multi ? (o.max || 99) : 1;
    const sheet = document.createElement("div");
    sheet.className = "obx-sheet obx-in"; sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true");
    const hid = "obxH" + Math.floor(Math.random() * 1e6); sheet.setAttribute("aria-labelledby", hid);
    const searchable = o.search !== false && items.length > 12;
    sheet.innerHTML = `
      <div class="obx-head"><button class="obx-x" type="button" aria-label="${esc(tr("ob2.back"))}">${ICON("chevron")}</button><h2 id="${hid}" tabindex="-1">${esc(o.title || "")}</h2></div>
      ${o.sub ? `<p class="obx-sub">${esc(o.sub)}</p>` : ""}
      ${searchable ? `<div class="obx-search">${ICON("search")}<input type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="${esc(o.searchPlaceholder || tr("ob2.search"))}" placeholder="${esc(o.searchPlaceholder || tr("ob2.search"))}"></div>` : ""}
      <div class="obx-gchips" role="group" aria-label="${esc(tr("ob2.groups"))}" ${searchable && o.groupChips !== false && (o.groups || []).length > 1 ? "" : "hidden"}></div>
      <div class="obx-body" role="listbox" ${o.multi ? 'aria-multiselectable="true"' : ""} aria-labelledby="${hid}"></div>
      <div class="obx-sr" aria-live="polite" role="status"></div>
      <div class="obx-foot"><div class="obx-count"></div><button class="btn-primary obx-confirm" type="button">${esc(o.confirmLabel || tr("ob2.confirm"))}</button></div>`;
    document.body.appendChild(sheet);
    const body = $(".obx-body", sheet), chips = $(".obx-gchips", sheet), input = $(".obx-search input", sheet), count = $(".obx-count", sheet), live = $(".obx-sr", sheet), confirm = $(".obx-confirm", sheet);
    const checkSvg = ICON("check");
    const rowHTML = (it, extraGroup) => `<button type="button" class="obx-row${sel.includes(it.id) ? " on" : ""}" role="option" data-id="${esc(it.id)}" aria-selected="${sel.includes(it.id)}"><span class="obx-mark" aria-hidden="true">${o.ordered ? "" : checkSvg}</span><span class="obx-t">${esc(labelOf(it))}${extraGroup && it.group ? `<small>${esc((C().groupLabel[it.group]) || (o.groupLabelOf ? o.groupLabelOf(it.group) : ""))}</small>` : ""}</span>${o.trailing ? `<span class="obx-tr">${o.trailing(it)}</span>` : ""}</button>`;
    const otherHTML = () => o.other ? `<button type="button" class="obx-row${sel.includes(o.other.id) ? " on" : ""}" role="option" data-id="${esc(o.other.id)}" data-other="1" aria-selected="${sel.includes(o.other.id)}"><span class="obx-mark" aria-hidden="true">${o.ordered ? "" : checkSvg}</span><span class="obx-t">${esc(o.other.label || tr("ob2.other_row"))}</span></button>
        <input class="obx-other-in" type="text" maxlength="${(C().LIMITS || {}).roleOther || 60}" autocomplete="off" aria-label="${esc(o.other.placeholder || "")}" placeholder="${esc(o.other.placeholder || "")}" value="${esc(otherText)}" ${sel.includes(o.other.id) ? "" : "hidden"}>` : "";
    function paintRanks() { if (!o.ordered) return; body.querySelectorAll(".obx-row").forEach(r => { const i = sel.indexOf(r.dataset.id); const m = $(".obx-mark", r); m.textContent = i >= 0 ? String(i + 1) : ""; }); }
    function summary() {
      const names = sel.filter(id => !(o.other && id === o.other.id)).map(id => labelOf(byId.get(id))).concat(o.other && sel.includes(o.other.id) ? [otherText || (o.other.label || tr("ob2.other_row"))] : []);
      count.textContent = o.multi ? (sel.length ? names.join(" · ") : tr("ob2.selected_n", { n: 0 })) : (names[0] || "");
      count.title = count.textContent;
      confirm.disabled = !sel.length && !o.allowEmpty;
      if (o.multi) live.textContent = tr("ob2.selected_n", { n: sel.length });
    }
    function render(q) {
      const filtered = C().search(items, q, labelOf);
      let html = "";
      if (q) html = filtered.length ? filtered.map(it => rowHTML(it, true)).join("") : `<div class="obx-empty">${esc(tr("ob2.no_results"))}</div>`;
      else {
        const used = new Set();
        if (o.suggested && o.suggested.length) { const sg = o.suggested.map(id => byId.get(id)).filter(Boolean); if (sg.length) { html += `<div class="obx-grp" data-g="__s">${esc(tr("ob2.suggested"))}</div>` + sg.map(it => rowHTML(it)).join(""); } }
        (o.groups || [{ id: "_", label: "" }]).forEach(g => { const rows = items.filter(i => (g.id === "_" ? true : i.group === g.id)); if (!rows.length) return; html += (g.label ? `<div class="obx-grp" data-g="${esc(g.id)}">${esc(g.label)}</div>` : "") + rows.map(it => rowHTML(it)).join(""); });
      }
      if (o.other && (!q || !filtered.length)) html += (q ? `<div class="obx-grp">${esc(tr("ob2.other_group"))}</div>` : `<div class="obx-grp" data-g="__o">${esc(tr("ob2.other_group"))}</div>`) + otherHTML();
      body.innerHTML = html; paintRanks();
      if (q) live.textContent = tr("ob2.results_n", { n: filtered.length });
    }
    if (!chips.hidden) chips.innerHTML = (o.groups || []).filter(g => items.some(i => i.group === g.id)).map(g => `<button type="button" data-g="${esc(g.id)}" aria-pressed="false">${esc(g.label.split(/[,&]/)[0].trim())}</button>`).join("");
    /* The chips are jump links, so the lit one says WHERE THE LIST IS, not what was chosen:
       it follows the scroll as well as a tap, and goes out while a search is filtering. */
    function chipSync() {
      if (chips.hidden) return;
      const hs = [...body.querySelectorAll(".obx-grp[data-g]")];
      let cur = "";
      if (hs.length) { const y = body.scrollTop + 4; let h = hs[0]; for (const x of hs) if (x.offsetTop - body.offsetTop <= y) h = x; cur = h.dataset.g; }
      chips.querySelectorAll("button").forEach(b => { const on = !!cur && b.dataset.g === cur; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); if (on) b.scrollIntoView({ block: "nearest", inline: "nearest" }); });
    }
    let chipTick = 0;
    body.addEventListener("scroll", () => { if (chipTick) return; chipTick = requestAnimationFrame(() => { chipTick = 0; chipSync(); }); }, { passive: true });
    chips.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; if (input && input.value) { input.value = ""; render(""); } const h = body.querySelector(`.obx-grp[data-g="${b.dataset.g}"]`); if (h) body.scrollTop = h.offsetTop - body.offsetTop; chipSync(); });
    body.addEventListener("click", e => {
      const r = e.target.closest(".obx-row"); if (!r) return;
      const id = r.dataset.id, isOther = r.dataset.other === "1", on = sel.includes(id);
      if (!o.multi) { sel = [id]; body.querySelectorAll(".obx-row").forEach(x => { const s = x.dataset.id === id; x.classList.toggle("on", s); x.setAttribute("aria-selected", s); }); }
      else if (on) { sel = sel.filter(x => x !== id); r.classList.remove("on"); r.setAttribute("aria-selected", "false"); }
      else { if (sel.length >= max) { try { toast(tr("ob2.max_n", { n: max })) } catch (er) {} return; } sel = sel.concat(id); r.classList.add("on"); r.setAttribute("aria-selected", "true"); }
      if (o.other) { const oi = $(".obx-other-in", body); if (oi) { oi.hidden = !sel.includes(o.other.id); if (isOther && !oi.hidden) setTimeout(() => oi.focus(), 30); } }
      paintRanks(); summary();
    });
    body.addEventListener("input", e => { if (e.target.classList.contains("obx-other-in")) { otherText = e.target.value.trim(); summary(); } });
    if (input) { let tm = 0; input.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => render(input.value), 60); }); input.addEventListener("keydown", e => { if (e.key === "Enter") input.blur(); }); }
    /* the keyboard: size to the visual viewport (iOS keeps the layout viewport tall; Android resizes the window) */
    const vv = window.visualViewport;
    function fit() {
      const h = vv ? vv.height : window.innerHeight;
      sheet.style.height = h + "px"; sheet.style.top = (vv ? vv.offsetTop : 0) + "px";
      /* the keyboard can leave very little room on a small phone: drop the sub-title and the group chips so the
         options themselves keep the space, and never let the list collapse to a sliver */
      sheet.classList.toggle("obx-tight", h < 460);
    }
    fit(); if (vv) { vv.addEventListener("resize", fit); vv.addEventListener("scroll", fit); } window.addEventListener("resize", fit);
    function close(cb) { if (vv) { vv.removeEventListener("resize", fit); vv.removeEventListener("scroll", fit); } window.removeEventListener("resize", fit); document.removeEventListener("keydown", onKey); sheet.remove(); if (cb) cb(); }
    function onKey(e) { if (e.key === "Escape") close(o.onCancel); }
    document.addEventListener("keydown", onKey);
    $(".obx-x", sheet).addEventListener("click", () => close(o.onCancel));
    confirm.addEventListener("click", () => { const ot = o.other && sel.includes(o.other.id) ? otherText : ""; close(() => o.onConfirm && o.onConfirm(sel.slice(), ot)); });
    render(""); summary(); chipSync();   /* the first group is lit from the moment the panel opens */
    $("#" + hid, sheet).focus({ preventScroll: true });
    return { close };
  }

  /* ------------------------------------------------------------------ inline multi-select (situations) */
  function chipGroup(host, o) {
    css();
    let sel = (o.selected || []).slice(), primary = o.primary || null;
    const items = o.items, label = it => lbl(o.cat, it);
    host.innerHTML = (o.groups || [{ id: "_", label: "" }]).map(g => { const rows = items.filter(i => g.id === "_" || i.group === g.id); return rows.length ? (g.label ? `<div class="obx-grp">${esc(g.label)}</div>` : "") + rows.map(it => `<button type="button" class="obx-row" role="checkbox" data-id="${esc(it.id)}" aria-checked="false"><span class="obx-mark" aria-hidden="true">${ICON("check")}</span><span class="obx-t">${esc(label(it))}</span></button>`).join("") : ""; }).join("") + `<div class="obx-main" hidden><h3>${esc(tr("ob2.main_focus"))}</h3><div class="obx-main-list" role="radiogroup" aria-label="${esc(tr("ob2.main_focus"))}"></div><p class="obx-note" style="margin:6px 0 0">${esc(tr("ob2.main_help"))}</p></div>`;
    const main = $(".obx-main", host), mlist = $(".obx-main-list", host);
    function paint() {
      host.querySelectorAll(".obx-row[data-id]").forEach(r => { const on = sel.includes(r.dataset.id); r.classList.toggle("on", on); r.setAttribute("aria-checked", on); });
      if (!sel.includes(primary)) primary = sel[0] || null;
      main.hidden = sel.length < 2;
      if (sel.length >= 2) mlist.innerHTML = sel.map(id => { const it = items.find(i => i.id === id); return `<button type="button" class="obx-row${id === primary ? " on" : ""}" role="radio" aria-checked="${id === primary}" data-p="${esc(id)}"><span class="obx-mark" aria-hidden="true">${ICON("check")}</span><span class="obx-t">${esc(label(it))}</span></button>`; }).join("");
      o.onChange && o.onChange(sel.slice(), primary);
    }
    host.addEventListener("click", e => {
      const p = e.target.closest("[data-p]"); if (p) { primary = p.dataset.p; paint(); return; }
      const r = e.target.closest(".obx-row[data-id]"); if (!r) return;
      const id = r.dataset.id;
      if (sel.includes(id)) sel = sel.filter(x => x !== id);
      else { if (sel.length >= o.max) { try { toast(tr("ob2.max_n", { n: o.max })) } catch (er) {} return; } sel = sel.concat(id); }
      paint();
    });
    paint();
    return { get: () => ({ sel: sel.slice(), primary }) };
  }
  /* inline single-select list */
  function listSingle(host, o) {
    css(); let cur = o.selected || null;
    host.innerHTML = o.items.map(it => `<button type="button" class="obx-row${it.id === cur ? " on" : ""}" role="radio" aria-checked="${it.id === cur}" data-id="${esc(it.id)}"><span class="obx-mark" aria-hidden="true">${ICON("check")}</span><span class="obx-t">${esc(lbl(o.cat, it))}</span></button>`).join("");
    host.addEventListener("click", e => { const r = e.target.closest(".obx-row"); if (!r) return; cur = r.dataset.id; host.querySelectorAll(".obx-row").forEach(x => { const s = x.dataset.id === cur; x.classList.toggle("on", s); x.setAttribute("aria-checked", s); }); o.onChange && o.onChange(cur); });
    return { get: () => cur };
  }

  /* ------------------------------------------------------------------ learner profile access */
  const view = () => (LP() && gS() ? LP().view(gS()) : {});
  const resolved = () => C().resolve(gS() && gS().profile, view());
  /* one-way mirror of the legacy S.profile fields (role / goal / selfLevel), for readers that do not know lp */
  function mirror() {
    if (!gS()) return; const v = view(), p = (S.profile = S.profile || {});
    if (v.role || v.roleId) p.role = v.role || C().legacyRoleFor(v.roleId, v.roleCat);
    if (v.goalId) p.goal = v.goal || C().goalLegacy(v.goalId) || ((C().find("goals", v.goalId) || {}).label) || p.goal || "";
    if (v.selfLevel) p.selfLevel = v.selfLevel;
  }
  function write(group, value) { const ok = typeof lpSet === "function" ? lpSet(group, value) : false; if (ok) { mirror(); try { save(); } catch (e) {} } return ok; }

  /* ------------------------------------------------------------------ the initial flow */
  const DRAFT = "be_obx_draft";
  const X = { step: 0, name: "", nativeLang: "", roleId: "", roleCat: "", roleOther: "", goalId: "", situations: [], primary: "", selfLevel: "", track: "" };
  const unpinned = () => !global.BE_APP_TRACK;
  const STEPS = () => (unpinned() ? ["name", "native", "programme", "profession", "goal", "situations", "confidence", "review"] : ["name", "native", "profession", "goal", "situations", "confidence", "review"]);
  function saveDraft() { try { localStorage.setItem(DRAFT, JSON.stringify(X)); } catch (e) {} }
  function loadDraft() { try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d && typeof d === "object") Object.assign(X, d); } catch (e) {} }
  function active() { try { return !!(global.LearnerProfile && global.OnboardingCatalog && flag("onboarding_v2_enabled") && (global.BE_APP_TRACK === "general-english" || (!global.BE_APP_TRACK && isGeneralEnglish()))); } catch (e) { return false; } }

  /* The onboarding wrapper is position:fixed/inset:0, i.e. the LAYOUT viewport. iOS does not shrink that for the
     keyboard, so the sticky action bar would sit underneath it (seen on the iPhone 17 simulator). Size the wrapper
     to the VISUAL viewport instead, exactly as the selection panel does, and keep it scrollable. */
  let wrapFit = null;
  function fitWrap() {
    const el = document.getElementById("obWrap"); if (!el || !el.querySelector(".obx-card")) return;
    const vv = window.visualViewport;
    /* The overlay must keep covering the whole screen (shrinking it shows the app behind — seen on the iPhone 17
       simulator), so the keyboard is handled as EXTRA BOTTOM PADDING on the scroll area. A sticky element stops at
       the scrollport's bottom padding edge, so the action bar rises above the keyboard and the card can scroll. */
    const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
    el.style.setProperty("--obx-kb", kb + "px");
    el.classList.toggle("obx-kb-open", kb > 80);
  }
  function wrapWatch() {
    if (wrapFit) return; wrapFit = fitWrap;
    const vv = window.visualViewport;
    if (vv) { vv.addEventListener("resize", fitWrap); vv.addEventListener("scroll", fitWrap); }
    window.addEventListener("resize", fitWrap);
  }
  function wrapUnwatch() {
    const vv = window.visualViewport;
    if (vv) { vv.removeEventListener("resize", fitWrap); vv.removeEventListener("scroll", fitWrap); }
    window.removeEventListener("resize", fitWrap); wrapFit = null;
  }
  function wrap() {
    css(); let el = document.getElementById("obWrap");
    if (!el) { el = document.createElement("div"); el.id = "obWrap"; el.className = "ob-wrap"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", tr("ob.hero_pre") + " " + tr("ob.hero_em")); document.body.appendChild(el); }
    return el;
  }
  const dots = i => { const n = STEPS().length; return `<div class="ob-dots">${Array.from({ length: n }, (_, k) => `<span class="ob-dot ${k === i ? "on" : ""}"></span>`).join("")}</div>`; };
  const profLabel = () => X.roleId === "other.other" ? (X.roleOther || tr("ob2.other_row")) : X.roleId ? (() => { const p = C().find("professions", X.roleId); return p ? lbl("prof", p) : ""; })() : "";
  const langLabel = code => { const l = gLANGS().find(x => x.code === code); return l ? l.native + (l.native !== l.en ? " · " + l.en : "") : ""; };
  const goalLabel = () => { const g = C().find("goals", X.goalId); return g ? lbl("goal", g) : ""; };
  const sitLabel = () => X.situations.map(id => { const s = C().find("situations", id); return s ? lbl("sit", s) + (id === X.primary && X.situations.length > 1 ? " ★" : "") : ""; }).join(", ");
  const confLabel = () => { const c = C().confidenceFromValue(X.selfLevel); return c ? lbl("conf", c) : ""; };

  function go(step) { X.step = step; saveDraft(); render(); }
  const next = () => go(Math.min(X.step + 1, STEPS().length - 1)), prev = () => go(Math.max(X.step - 1, 0));
  function nav(canNext, last, status) { return `<div class="obx-bar">${status === undefined ? "" : `<div class="obx-status" id="obxStatus" aria-live="polite">${esc(status)}</div>`}<div class="obx-bar-row"><button class="obx-back" type="button" data-act="back" ${X.step === 0 ? "hidden" : ""}>‹ ${esc(tr("ob2.back"))}</button><button class="btn-primary ob-go obx-go" type="button" data-act="next" ${canNext ? "" : "disabled"}>${esc(last || tr("ob2.continue"))}</button></div></div>`; }
  const sitStatus = (sel, primary) => !sel.length ? tr("ob2.sit_none") : tr("ob2.selected_n", { n: sel.length }) + (sel.length > 1 && primary ? " · " + tr("ob2.main_focus") + ": " + ((C().find("situations", primary) || {}).label ? lbl("sit", C().find("situations", primary)) : "") : "");

  /* Freeze the question (logo + title + sub) at the top of the card so it stays readable while the
     learner scrolls its answers, and publish its height so a group heading pins right under it.
     The leading nodes are wrapped here, once, instead of in each step's own markup. */
  function stickTop(card) {
    const kids = [...card.children], head = [];
    for (const n of kids) { if (n.classList.contains("ob-logo") || n.tagName === "H1" || n.classList.contains("sub")) head.push(n); else break; }
    if (head.length < 2) return;                 /* nothing worth freezing (the name step is one field) */
    const top = document.createElement("div"); top.className = "obx-top";
    card.insertBefore(top, head[0]); head.forEach(n => top.appendChild(n));
    const measure = () => { try { card.style.setProperty("--obx-top-h", Math.round(top.getBoundingClientRect().height) + "px"); } catch (e) {} };
    measure(); requestAnimationFrame(measure);
    if (window.ResizeObserver) { try { new ResizeObserver(measure).observe(top); } catch (e) {} }
  }

  function render() {
    const el = wrap(), name = STEPS()[X.step], card = document.createElement("div");
    card.className = "ob-card obx-card"; card.setAttribute("role", "group");
    const nm = esc(X.name || tr("ob2.friend"));
    let inner = "", after = null;
    if (name === "name") {
      inner = `<div class="ob-logo ob-logo-img" style="background:none;padding:0"><img src="logo.svg" alt="" style="width:76px;height:76px;border-radius:22px;display:block"></div><h1>${esc(tr("ob2.name_title"))}</h1><p class="sub">${esc(tr("ob2.name_sub"))}</p><input class="obx-field" id="obxName" maxlength="40" autocomplete="given-name" aria-label="${esc(tr("ob2.name_ph"))}" placeholder="${esc(tr("ob2.name_ph"))}" value="${esc(X.name)}">${nav(!!X.name.trim())}<p class="auth-alt" style="margin-top:14px">${esc(tr("ob.already_account"))} <a onclick="fbOpenModal('in')">${esc(tr("ob.login"))}</a></p>`;
      after = () => { const i = $("#obxName", card); i.addEventListener("input", () => { X.name = i.value.trim(); saveDraft(); $("[data-act=next]", card).disabled = !X.name; }); i.addEventListener("keydown", e => { if (e.key === "Enter" && X.name) next(); }); };
    } else if (name === "native") {
      inner = `<div class="ob-logo">${ICON("globe")}</div><h1>${esc(tr("lang.step_title"))}</h1><p class="sub">${esc(tr("lang.step_sub"))}</p><button type="button" class="obx-pick${X.nativeLang ? " set" : ""}" id="obxLang"><span class="obx-pick-t">${esc(X.nativeLang ? langLabel(X.nativeLang) : tr("ob2.lang_choose"))}</span><span class="obx-chev" aria-hidden="true">${ICON("chevron")}</span></button><p class="obx-note">${esc(tr("ob2.lang_note"))}</p>${nav(true, X.nativeLang ? tr("ob2.continue") : tr("ob.skip_lang"))}`;
      after = () => $("#obxLang", card).addEventListener("click", () => pickLanguage(code => { X.nativeLang = code; saveDraft(); render(); }));
    } else if (name === "programme") {
      inner = `<div class="ob-logo">${ICON("map")}</div><h1>${esc(tr("ob.track_title"))}</h1><p class="sub">${esc(tr("ob.track_sub"))}</p><div class="ob-tracks"><button class="ob-track" type="button" id="obxGE"><span class="ob-track-ic">${ICON("chat")}</span><span class="ob-track-t"><b>${esc(tr("tracks.general"))}</b><small>${esc(tr("ob.track_general_sub"))}</small></span><span class="ob-track-go">→</span></button><button class="ob-track ob-track-weld" type="button" id="obxWD"><span class="ob-track-ic">${ICON("briefcase")}</span><span class="ob-track-t"><b>${esc(tr("tracks.welding"))}</b><small>${esc(tr("ob.track_welding_sub"))}</small></span><span class="ob-track-go">→</span></button></div>`;
      after = () => { $("#obxGE", card).addEventListener("click", () => { global.obTrackPick && (S.professionalTracks = S.professionalTracks || {}, S.professionalTracks.activeId = "general-english"); next(); });
        $("#obxWD", card).addEventListener("click", () => { /* hand over to the unchanged legacy flow: nothing of Onboarding V2 touches Welding */ leaveToLegacy(); }); };
    } else if (name === "profession") {
      inner = `<div class="ob-logo">${ICON("briefcase")}</div><h1>${esc(tr("ob.role_title", { name: X.name || tr("ob2.friend") }))}</h1><p class="sub">${esc(tr("ob.role_sub"))}</p><button type="button" class="obx-pick${X.roleId ? " set" : ""}" id="obxProf"><span class="obx-pick-t">${esc(X.roleId ? profLabel() : tr("ob2.prof_choose"))}${X.roleId && X.roleCat ? `<small>${esc(C().groupLabel[X.roleCat] || "")}</small>` : ""}</span><span class="obx-chev" aria-hidden="true">${ICON("chevron")}</span></button>${nav(!!X.roleId)}`;
      after = () => $("#obxProf", card).addEventListener("click", () => pickProfession(() => { saveDraft(); render(); }));
    } else if (name === "goal") {
      inner = `<div class="ob-logo">${ICON("target")}</div><h1>${esc(tr("ob.goal_title"))}</h1><p class="sub">${esc(tr("ob.goal_sub"))}</p><div class="obx-list" id="obxGoals"></div>${nav(!!X.goalId)}`;
      after = () => listSingle($("#obxGoals", card), { items: C().CAT.goals, cat: "goal", selected: X.goalId, onChange: id => { X.goalId = id; saveDraft(); $("[data-act=next]", card).disabled = false; } });
    } else if (name === "situations") {
      inner = `<div class="ob-logo">${ICON("route")}</div><h1>${esc(tr("ob.situations_title"))}</h1><p class="sub">${esc(tr("ob2.sit_sub", { n: C().LIMITS.situations }))}</p><div class="obx-list" id="obxSits"></div>${nav(true, X.situations.length ? tr("ob2.continue") : tr("ob2.skip"), sitStatus(X.situations, X.primary))}`;
      after = () => chipGroup($("#obxSits", card), { items: C().CAT.situations, cat: "sit", groups: C().sitGroups.map(([id, l]) => ({ id, label: tr("sitg." + id) === "sitg." + id ? l : tr("sitg." + id) })), max: C().LIMITS.situations, selected: X.situations, primary: X.primary, onChange: (sel, primary) => { X.situations = sel; X.primary = primary || ""; saveDraft(); const b = $("[data-act=next]", card); if (b) b.textContent = sel.length ? tr("ob2.continue") : tr("ob2.skip"); const st = $("#obxStatus", card); if (st) st.textContent = sitStatus(sel, primary); } });
    } else if (name === "confidence") {
      inner = `<div class="ob-logo">${ICON("waveform")}</div><h1>${esc(tr("ob.level_title"))}</h1><p class="sub">${esc(tr("ob.level_sub"))}</p><div class="obx-list" id="obxConf"></div>${nav(!!X.selfLevel)}`;
      after = () => listSingle($("#obxConf", card), { items: C().CAT.confidence, cat: "conf", selected: (C().confidenceFromValue(X.selfLevel) || {}).id, onChange: id => { X.selfLevel = C().find("confidence", id).value; saveDraft(); $("[data-act=next]", card).disabled = false; } });
    } else if (name === "review") {
      const row = (k, v, step) => `<button type="button" class="obx-sum-row ${v ? "is-set" : "is-empty"}" data-edit="${step}"><span class="obx-sum-t"><div class="v">${esc(v || tr("ob2.not_set"))}</div></span><span class="k">${esc(k)}</span><span class="obx-chev" aria-hidden="true">${ICON("chevron")}</span></button>`;
      const idx = n => STEPS().indexOf(n);
      inner = `<div class="ob-logo">${ICON("rocket")}</div><h1>${esc(tr("ob2.review_title"))}</h1><p class="sub">${esc(tr("ob2.review_sub"))}</p><div class="obx-sum">${row(tr("ob2.r_native"), X.nativeLang ? langLabel(X.nativeLang) : "", idx("native"))}${row(tr("ob2.r_prof"), profLabel(), idx("profession"))}${row(tr("ob2.r_goal"), goalLabel(), idx("goal"))}${row(tr("ob2.r_sit"), sitLabel(), idx("situations"))}${row(tr("ob2.r_conf"), confLabel(), idx("confidence"))}</div><p class="obx-note">${esc(tr("ob2.review_note"))}</p>${nav(true, tr("ob2.review_start"))}`;
      after = () => card.addEventListener("click", e => { const b = e.target.closest("[data-edit]"); if (b) go(+b.dataset.edit); });
    }
    { const i = inner.indexOf('<div class="obx-bar">'); card.innerHTML = i >= 0 ? inner.slice(0, i) + dots(X.step) + inner.slice(i) : inner + dots(X.step); }
    stickTop(card);
    el.replaceChildren(card);
    card.addEventListener("click", e => { const a = e.target.closest("[data-act]"); if (!a || a.disabled) return; if (a.dataset.act === "back") prev(); else if (a.dataset.act === "next") { if (name === "review") finish(); else if (name === "name") { X.name = ($("#obxName", card).value || "").trim(); if (X.name) next(); } else next(); } });
    if (after) after();
    wrapWatch(); fitWrap();
    const inp = $("#obxName", card); if (inp) { inp.focus({ preventScroll: true }); setTimeout(fitWrap, 350); }   /* the keyboard opens just after the focus */
  }

  function pickLanguage(done) {
    const langs = gLANGS(), tl = gTR();
    const items = langs.map(l => ({ id: l.code, label: l.native, en: l.en, aliases: l.en + " " + l.code, group: tl.has(l.code) ? "app" : "all" }));
    pick({ title: tr("lang.step_title"), sub: tr("ob2.lang_sheet_sub"), cat: "x", items, labelOf: it => it.label + (it.label !== it.en ? "  ·  " + it.en : ""), groups: [{ id: "app", label: tr("ob2.lang_app_group") }, { id: "all", label: tr("ob2.lang_all_group") }], selected: X.nativeLang ? [X.nativeLang] : [], searchPlaceholder: tr("lang.search_placeholder"), groupChips: true,
      /* the app's own flag badge (LANG_FLAG + flagsDrawn), so a device that cannot draw flag
         emoji falls back to the same coloured initials every other language list shows */
      trailing: it => (typeof langBadgeHTML === "function" ? langBadgeHTML({ code: it.id }, true) : ""), onConfirm: async ids => { if (ids[0]) { await applyNative(ids[0]); done(ids[0]); } } });   /* the dictionary must be in before the step is redrawn, or the card stays in English */
  }
  /* the app language follows the native language when the app is translated into it; otherwise the app stays in English */
  async function applyNative(code) { try { if (gTR().has(code) && typeof setLang === "function") await setLang(code); } catch (e) {} }

  function pickProfession(done) {
    const cc = C(), all = cc.CAT.professions;
    const legacy = (gS() && S.profile && S.profile.role) || "", lm = cc.legacyRoleToProfile(legacy);
    const suggested = lm && lm.roleCat ? all.filter(p => p.group === lm.roleCat && !p.hidden).slice(0, 5).map(p => p.id) : [];
    pick({ title: tr("ob2.prof_choose"), cat: "prof", items: all, groups: cc.groups.map(([id, label]) => ({ id, label: tr("pg." + id) === "pg." + id ? label : tr("pg." + id) })), groupLabelOf: g => cc.groupLabel[g], searchPlaceholder: tr("ob2.prof_search"), suggested,
      selected: X.roleId ? [X.roleId] : [], other: { id: "other.other", label: tr("ob2.other_row"), placeholder: tr("ob.role_other_placeholder"), value: X.roleOther },
      onConfirm: (ids, ot) => { const id = ids[0]; if (!id) return; if (id === "other.other") { X.roleId = id; X.roleCat = "career"; X.roleOther = (ot || "").slice(0, cc.LIMITS.roleOther); } else { const p = cc.find("professions", id); X.roleId = id; X.roleCat = p.group; X.roleOther = ""; } done(); } });
  }

  function leaveToLegacy() {
    wrapUnwatch();
    const w = document.getElementById("obWrap"); if (w) { w.style.removeProperty("--obx-kb"); w.classList.remove("obx-kb-open"); }
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    if (gOB()) Object.assign(OB, { name: X.name, lang: OB.lang || "en", step: 2 });
    global.__obV2Off = true; try { global.obRender(); } catch (e) {}
    try { global.obTrackPick("welding"); } catch (e) {}
  }

  function finish() {
    const cc = C();
    const profile = Object.assign({}, S.profile || {}, { name: X.name || "there", slot: "", lang: (gTR().has(X.nativeLang) ? X.nativeLang : (S.profile && S.profile.lang) || "en"), ts: Date.now() });
    S.profile = profile;
    S.professionalTracks = S.professionalTracks || {}; S.professionalTracks.activeId = "general-english";
    const legacyRole = cc.legacyRoleFor(X.roleId, X.roleCat);
    const results = [
      write("role", Object.assign({ roleCat: X.roleCat, roleId: X.roleId, role: legacyRole }, X.roleId === "other.other" && X.roleOther ? { roleOther: X.roleOther } : {})),
      write("goal", X.goalId ? { goalId: X.goalId } : {}),
      X.situations.length ? write("situations", { situations: X.situations, primarySituation: X.primary || X.situations[0] }) : true,
      X.selfLevel ? write("confidence", { selfLevel: X.selfLevel }) : true,
      X.nativeLang ? write("native", { nativeLang: X.nativeLang }) : true];
    if (X.nativeLang && !profile.trLang) profile.trLang = X.nativeLang;
    mirror(); try { save(); } catch (e) {}
    try { localStorage.removeItem(DRAFT); } catch (e) {}
    wrapUnwatch();
    const el = document.getElementById("obWrap"); if (el) el.remove();
    try { global.trackLearning("onboarding_complete", { lang: profile.lang }); } catch (e) {}
    try { _fndCheckShown = true; } catch (e) {}
    if (gOB()) { OB.track = "general-english"; OB.best = 0; }
    try { go2home(); } catch (e) {}
    try { global.obWelcome(); const b = document.querySelector("#wcOv .wc-go"); if (b) b.onclick = () => { global.wcClose(); try { global.go("session", 1, "Mon"); } catch (e) {} }; } catch (e) {}
    return results.every(Boolean);
  }
  function go2home() { global.go(global.homeV2On && homeV2On() ? "home" : "journey"); }

  /* ------------------------------------------------------------------ Tune your practice + Learning profile editing */
  const TUNE = "be_tune";
  const tuneState = () => { try { return JSON.parse(localStorage.getItem(TUNE) || "{}"); } catch (e) { return {}; } };
  const tuneSave = o => { try { localStorage.setItem(TUNE, JSON.stringify(o)); } catch (e) {} };
  function editField(field, done) {
    const cc = C(), r = resolved();
    const finishEdit = () => { try { toast(tr("ob2.saved")); } catch (e) {} done && done(); };
    if (field === "profession") {
      Object.assign(X, { roleId: r.roleId || "", roleCat: r.roleCat || "", roleOther: r.roleOther || "" });
      pickProfession(() => { const legacyRole = cc.legacyRoleFor(X.roleId, X.roleCat); write("role", Object.assign({ roleCat: X.roleCat, roleId: X.roleId, role: legacyRole }, X.roleId === "other.other" && X.roleOther ? { roleOther: X.roleOther } : {})); finishEdit(); });
    } else if (field === "native") {
      X.nativeLang = r.nativeLang || ""; pickLanguage(code => { write("native", { nativeLang: code }); finishEdit(); });   /* pickLanguage awaits the dictionary before calling back */
    } else if (field === "goal") {
      pick({ title: tr("ob.goal_title"), cat: "goal", items: cc.CAT.goals, selected: r.goalId ? [r.goalId] : [], search: false, onConfirm: ids => { if (ids[0]) { write("goal", { goalId: ids[0] }); finishEdit(); } } });
    } else if (field === "situations") {
      pick({ title: tr("ob.situations_title"), sub: tr("ob2.sit_sub", { n: cc.LIMITS.situations }), cat: "sit", items: cc.CAT.situations, groups: cc.sitGroups.map(([id, l]) => ({ id, label: tr("sitg." + id) === "sitg." + id ? l : tr("sitg." + id) })), multi: true, max: cc.LIMITS.situations, ordered: true, selected: r.situations, allowEmpty: true, search: false, groupChips: false,
        onConfirm: ids => { if (!ids.length) lpClear("situations"); else write("situations", { situations: ids, primarySituation: ids.includes(r.primarySituation) ? r.primarySituation : ids[0] }); finishEdit(); } });
    } else if (field === "primary") {
      const list = cc.CAT.situations.filter(s => r.situations.includes(s.id));
      if (list.length < 2) { try { toast(tr("ob2.primary_need")); } catch (e) {} return; }
      pick({ title: tr("ob2.main_focus"), sub: tr("ob2.main_help"), cat: "sit", items: list, selected: [r.primarySituation || list[0].id], search: false, onConfirm: ids => { write("situations", { situations: r.situations, primarySituation: ids[0] }); finishEdit(); } });
    } else if (field === "confidence") {
      pick({ title: tr("ob.level_title"), sub: tr("ob.level_sub"), cat: "conf", items: cc.CAT.confidence, selected: (cc.confidenceFromValue(r.selfLevel) || {}).id ? [cc.confidenceFromValue(r.selfLevel).id] : [], search: false, onConfirm: ids => { if (ids[0]) { write("confidence", { selfLevel: cc.find("confidence", ids[0]).value }); finishEdit(); } } });
    } else if (field === "priorities") {
      pick({ title: tr("ob2.tune_prio"), sub: tr("ob2.tune_prio_sub", { n: cc.LIMITS.priorities }), cat: "prio", items: cc.CAT.priorities, groups: cc.prioGroups.map(([id, l]) => ({ id, label: tr("prg." + id) === "prg." + id ? l : tr("prg." + id) })), multi: true, ordered: true, max: cc.LIMITS.priorities, selected: r.priorities, allowEmpty: true, search: false, groupChips: false, onConfirm: ids => { ids.length ? write("priorities", { priorities: ids }) : lpClear("priorities"); finishEdit(); } });
    } else if (field === "vocab") {
      pick({ title: tr("ob2.tune_vocab"), sub: tr("ob2.tune_vocab_sub", { n: cc.LIMITS.vocabGoals }), cat: "vocab", items: cc.CAT.vocab, multi: true, ordered: true, max: cc.LIMITS.vocabGoals, selected: r.vocabGoals, allowEmpty: true, search: false, onConfirm: ids => { ids.length ? write("vocab", { vocabGoals: ids }) : lpClear("vocab"); finishEdit(); } });
    } else if (field === "methods") {
      pick({ title: tr("ob2.tune_methods"), sub: tr("ob2.tune_methods_sub", { n: cc.LIMITS.methods }), cat: "meth", items: cc.CAT.methods, multi: true, max: cc.LIMITS.methods, selected: r.methods, allowEmpty: true, search: false, onConfirm: ids => { ids.length ? write("methods", { methods: ids }) : lpClear("methods"); finishEdit(); } });
    } else if (field === "minutes") {
      pick({ title: tr("ob2.minutes"), cat: "min", items: cc.CAT.minutes, selected: r.dailyMinutes ? [r.dailyMinutes] : [], search: false, onConfirm: ids => { if (ids[0]) { write("schedule", Object.assign({}, schedNow(), { dailyMinutes: ids[0] })); finishEdit(); } } });
    } else if (field === "days") {
      pick({ title: tr("ob2.days"), cat: "day", items: cc.CAT.days, selected: r.practiceDays ? [r.practiceDays] : [], search: false, onConfirm: ids => { if (ids[0]) { write("schedule", Object.assign({}, schedNow(), { practiceDays: ids[0] })); finishEdit(); } } });
    } else if (field === "timeofday") {
      pick({ title: tr("ob2.tod"), cat: "tod", items: cc.CAT.timeOfDay, selected: r.timeOfDay ? [r.timeOfDay] : [], search: false, onConfirm: ids => { if (ids[0]) { write("schedule", Object.assign({}, schedNow(), { timeOfDay: ids[0] })); finishEdit(); } } });
    }
  }
  const schedNow = () => { const v = view(), o = {}; ["dailyMinutes", "practiceDays", "timeOfDay"].forEach(k => { if (v[k]) o[k] = v[k]; }); return o; };

  /* the guided sequence: priorities → vocabulary → methods → schedule, each skippable; resumes at the first unfinished one */
  function tuneOpen() {
    const order = ["priorities", "vocab", "methods", "minutes", "days", "timeofday"];
    const left = () => C().tuneRemaining(resolved());
    const stage = () => { const l = left(); return l.includes("priorities") ? "priorities" : l.includes("vocab") ? "vocab" : l.includes("methods") ? "methods" : l.includes("schedule") ? (!resolved().dailyMinutes ? "minutes" : !resolved().practiceDays ? "days" : "timeofday") : null; };
    const step = () => { const f = stage(); if (!f) { try { toast(tr("ob2.tune_done")); } catch (e) {} return; } editField(f, () => setTimeout(step, 80)); };
    const st = tuneState(); st.opened = Date.now(); tuneSave(st); step();
  }
  /* Tune your practice is offered once the first lesson is complete, on Home, never inside a lesson */
  function tuneDue() {
    try {
      if (!active() || !lpOn() || !LP().get(S, "role")) return false;
      if (!C().tuneRemaining(resolved()).length) return false;
      const st = tuneState(); if (st.snoozeUntil && Date.now() < st.snoozeUntil) return false; if ((st.asked || 0) >= 3) return false;
      const done = S.dlp ? Object.values(S.dlp).some(e => e && e.completedAt) : false;
      return done || Object.keys(S.days || {}).length > 0;
    } catch (e) { return false; }
  }
  function tunePrompt() {
    if (document.getElementById("obxTune") || document.querySelector(".obx-sheet,#obWrap,#wcOv,.rm-busy")) return;
    css(); const st = tuneState(); st.asked = (st.asked || 0) + 1; tuneSave(st);
    const ov = document.createElement("div"); ov.id = "obxTune"; ov.className = "wc-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "obxTuneT");
    ov.innerHTML = `<div class="wc-card"><div class="wc-emoji">${ICON("sliders") || ICON("target")}</div><h2 id="obxTuneT">${esc(tr("ob2.tune_title"))}</h2><p class="wc-lead">${esc(tr("ob2.tune_sub"))}</p><button class="btn btn-p wc-go" type="button" data-a="go">${esc(tr("ob2.tune_go"))}</button><button class="btn btn-g" type="button" data-a="later" style="margin-top:8px;width:100%">${esc(tr("ob2.not_now"))}</button></div>`;
    document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add("show"));
    ov.addEventListener("click", e => { const a = e.target.closest("[data-a]"); if (!a) { if (e.target === ov) later(); return; } if (a.dataset.a === "go") { ov.remove(); tuneOpen(); } else later(); });
    function later() { const s = tuneState(); s.snoozeUntil = Date.now() + 3 * 86400000; tuneSave(s); ov.remove(); }
    const b = $(".wc-go", ov); if (b) b.focus();
  }
  function afterNav(v) { if (v === "home" && tuneDue()) setTimeout(() => { try { if (tuneDue()) tunePrompt(); } catch (e) {} }, 700); }

  /* Profile → Learning profile: every field, with its current value and a way to change it */
  function learningProfileHTML() {
    const cc = C(), r = resolved(), nm = (cat, id) => { const it = cc.find(cat, id); return it ? lbl({ professions: "prof", goals: "goal", situations: "sit", priorities: "prio", vocab: "vocab", methods: "meth", minutes: "min", days: "day", timeOfDay: "tod", confidence: "conf" }[cat] || cat, it) : ""; };
    const list = (cat, ids) => (ids || []).map(i => nm(cat, i)).filter(Boolean).join(", ");
    const prof = r.roleId === "other.other" ? (r.roleOther || tr("ob2.other_row")) : r.roleId ? nm("professions", r.roleId) : (r.role ? r.role : "");
    const rows = [["profession", tr("ob2.r_prof"), prof], ["native", tr("ob2.r_native"), r.nativeLang ? gLANGS().filter(l => l.code === r.nativeLang).map(l => l.native)[0] || r.nativeLang : ""], ["goal", tr("ob2.r_goal"), r.goalId ? nm("goals", r.goalId) : r.goal],
      ["situations", tr("ob2.r_sit"), list("situations", r.situations)], ["primary", tr("ob2.main_focus"), r.situations.length > 1 ? nm("situations", r.primarySituation) : ""], ["confidence", tr("ob2.r_conf"), r.selfLevel ? ((cc.confidenceFromValue(r.selfLevel) ? nm("confidence", cc.confidenceFromValue(r.selfLevel).id) : r.selfLevel)) : ""],
      ["priorities", tr("ob2.tune_prio"), list("priorities", r.priorities)], ["vocab", tr("ob2.tune_vocab"), list("vocab", r.vocabGoals)], ["methods", tr("ob2.tune_methods"), list("methods", r.methods)],
      ["minutes", tr("ob2.minutes"), nm("minutes", r.dailyMinutes)], ["days", tr("ob2.days"), nm("days", r.practiceDays)], ["timeofday", tr("ob2.tod"), nm("timeOfDay", r.timeOfDay)]];
    return `<div class="obx-sum" id="obxLP">${rows.map(([f, k, v]) => `<button type="button" class="obx-sum-row ${v ? "is-set" : "is-empty"}" data-field="${f}"><span class="obx-sum-t"><div class="v">${esc(v || tr("ob2.not_set"))}</div></span><span class="k">${esc(k)}</span><span class="obx-chev" aria-hidden="true">${ICON("chevron")}</span></button>`).join("")}</div><p class="obx-note" style="margin:0 0 12px">${esc(tr("ob2.review_note"))}</p>`;
  }
  function openLearningProfile() {
    css(); const ov = document.createElement("div"); ov.className = "obx-sheet obx-in"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-labelledby", "obxLPH");
    const vv = window.visualViewport; const fit = () => { ov.style.height = (vv ? vv.height : innerHeight) + "px"; ov.style.top = (vv ? vv.offsetTop : 0) + "px"; };
    const paint = () => { ov.innerHTML = `<div class="obx-head"><button class="obx-x" type="button" aria-label="${esc(tr("ob2.back"))}" data-close>${ICON("chevron")}</button><h2 id="obxLPH" tabindex="-1">${esc(tr("ob2.pf_learning"))}</h2></div><div class="obx-body" style="padding-top:8px">${learningProfileHTML()}<button type="button" class="btn btn-g" data-tune style="width:100%;margin-bottom:14px">${esc(tr("ob2.tune_title"))} · ${C().tuneRemaining(resolved()).length ? tr("ob2.unfinished") : tr("ob2.all_set")}</button></div>`; };
    paint(); fit(); document.body.appendChild(ov); if (vv) vv.addEventListener("resize", fit);
    ov.addEventListener("click", e => { if (e.target.closest("[data-close]")) { if (vv) vv.removeEventListener("resize", fit); ov.remove(); return; } if (e.target.closest("[data-tune]")) { tuneOpen(); return; } const b = e.target.closest("[data-field]"); if (b) editField(b.dataset.field, paint); });
    $("#obxLPH", ov).focus({ preventScroll: true });
    /* keep the list current after edits made in sheets opened on top of it */
    const iv = setInterval(() => { if (!document.body.contains(ov)) { clearInterval(iv); return; } if (!document.querySelector(".obx-sheet:not(:first-of-type)") ) {} }, 1500);
  }

  /* ------------------------------------------------------------------ public */
  function start() { loadDraft(); if (!X.name && gOB() && OB.name) X.name = OB.name; const n = STEPS().length; if (X.step >= n) X.step = 0; render(); }
  global.OnboardingV2 = { active, start, pick, chipGroup, listSingle, editField, tuneOpen, tuneDue, tunePrompt, afterNav, learningProfileHTML, openLearningProfile, resolved, mirror, write, _state: X, _finish: finish, _steps: STEPS };
})(typeof window !== "undefined" ? window : globalThis);
