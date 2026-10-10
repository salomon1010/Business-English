  function fullCardHTML(t, withActions, noHead) {
    const s = st(), r = s.t[t.id], fav = E.isFav(s, t.id), hard = r && r.hard;
    let saved = false; try { saved = vocHas(t.en.toLowerCase()); } catch (e) {}
    const sec = (ic, k, o) => o && o.en ? `<div class="wm-f"><b>${wi(ic)} ${h(w(k))}</b><p lang="en">${h(o.en)}</p></div>` : "";
    const sh = compShadow(t.comp);
    return `<div class="wm-full">
      ${noHead ? "" : `<div class="wm-full-h">${catArt(t.cat)}<div><b lang="en">${h(t.en)}</b><small>${h(catName(t.cat))}${t.lvl ? " · " + h(t.lvl) : ""}${t.wk ? " · " + h(lang() === "fr" ? "semaine " + t.wk : "week " + t.wk) : ""}</small></div></div>`}
      <div class="wm-row"><button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.kind === "sentence" ? t.en : clean(t.en))}">${wi("sound")} ${h(w("hear"))}</button>${t.ex && t.ex.en ? `<button class="btn btn-g btn-sm" data-em="say" data-a="${h(t.ex.en)}">${wi("chat")} ${h(w("hear_ex"))}</button>` : ""}</div>
      ${(t.syn || []).length ? `<p class="wm-mut small">${h(w("f_syn"))}: ${h(t.syn.join(" · "))}</p>` : ""}
      ${t.kind === "sentence" ? "" : sec("book", "f_def", t.def)}${t.use && t.use.en && t.use.en !== (t.def && t.def.en || "").replace(/\.$/, "") ? sec("target", "f_use", t.use) : ""}${sec("chat", "f_ex", t.ex)}
      ${glossHTML(t)}
      ${sh && shadowOk() ? `<button class="wm-link" data-em="shadow" data-a="${h(sh.vid)}">${wi("play")} ${h(w("mi_shadow", { t: sh.title }))} →</button>` : ""}
      ${withActions ? `<div class="wm-row wm-full-a">
        <button class="btn btn-g btn-sm wm-star ${fav ? "on" : ""}" data-em="fav" data-a="${h(t.id)}" aria-pressed="${fav}">${wi("star")} ${h(fav ? w("unfav") : w("fav"))}</button>
        ${t.mine ? "" : `<button class="btn btn-g btn-sm ${hard ? "on" : ""}" data-em="hard" data-a="${h(t.id)}" aria-pressed="${!!hard}">${wi("target")} ${h(hard ? w("unmark_hard") : w("mark_hard"))}</button>`}
        ${t.kind === "sentence" ? "" : `<button class="btn btn-g btn-sm" data-em="savelist" data-a="${h(t.id)}" ${saved ? "disabled" : ""}>${wi("book")} ${h(saved ? w("saved_list") : w("save_list"))}</button>`}
      </div>` : ""}
    </div>`;
  }
  /* a competency's Shadow Studio clip (missions.json "shadow"), for its phrases and expressions */
  function compShadow(comp) { if (!comp || !C) return null; const m = C.missions.find(x => x.comp === comp && x.shadow); return m ? m.shadow : null; }
  function shadowOk() { try { return typeof svOn === "function" && svOn() && typeof shLoad === "function"; } catch (e) { return false; } }

  /* ---- the learner's own language ----
     A Foundations sentence carries its translation in the course pack (15
     languages, written for the course). Anything else is translated ON DEMAND
     by the existing chat route and labelled machine translation; the answer is
     cached on this device. The learner's language is the one the app already
     uses for Shadow Studio's Translate (svShLang: their pick, else the app language). */
  let _gl = null; const _glBusy = {};
  function glLang() {
    try { if (typeof svShLang === "function") { const L = svShLang(); return { code: L.code, name: L.name, ok: !!L.ok }; } } catch (e) {}
    const c = (S.profile && S.profile.lang) || "en"; return { code: c, name: c, ok: c !== "en" };
  }
  function glCache() { if (!_gl) { try { _gl = JSON.parse(localStorage.getItem("be_em_gl") || "{}") || {}; } catch (e) { _gl = {}; } } return _gl; }
  function glSave() { const c = glCache(), ks = Object.keys(c); while (ks.length > 800) delete c[ks.shift()]; try { localStorage.setItem("be_em_gl", JSON.stringify(c)); } catch (e) {} }
  function glossOf(t) {
    const L = glLang(); if (!L.ok) return null;
    if (t.gl && t.gl[L.code]) return { text: t.gl[L.code], pack: true };
    const c = glCache()[t.id + ":" + L.code]; return c ? { text: c, pack: false } : null;
  }
  function glossHTML(t) {
    const L = glLang(); if (!L.ok) return "";
    const g = glossOf(t);
    if (g) return `<div class="wm-f em-gl"><b>${wi("globe")} ${h(w("f_gl"))}</b><p lang="${h(L.code)}" dir="auto">${h(g.text)}</p><small class="wm-mut">${h(g.pack ? w("f_gl_pack") : w("gl_ai"))}</small></div>`;
    const busy = _glBusy[t.id + ":" + L.code];
    return `<div class="em-gl-btn"><button class="btn btn-g btn-sm" data-em="gloss" data-a="${h(t.id)}" ${busy || !signedIn() ? "disabled" : ""}>${wi("globe")} ${h(busy ? w("gl_busy") : w("gl_btn"))}</button>${signedIn() ? "" : `<small class="wm-mut">${h(w("gl_none"))}</small>`}</div>`;
  }
  async function glossFetch(id) {
    const t = byId(id), L = glLang(); if (!t || !L.ok) return;
    const key = t.id + ":" + L.code; if (_glBusy[key] || glossOf(t)) return;
    if (!signedIn() || !navigator.onLine) { toast(w("gl_none")); return; }
    _glBusy[key] = 1; regloss();
    const system = `You are a translator for an English course. Translate the English into ${L.name}. Keep the meaning and the register; for a phrase that ends in "…", translate it as an unfinished phrase. Respond with ONLY minified JSON: {"reply":"<translation of the item> — <translation of the example>"}`;
    try {
      const r = await fetch(POLISH_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat: { purpose: "practice", system, messages: [{ role: "user", content: clean(t.en) + (t.ex && t.ex.en ? "\nExample: " + t.ex.en : "") }] } }) });
      const j = await r.json().catch(() => ({}));
      const tx = String((j && j.reply) || "").trim();
      if (!r.ok || !tx) throw new Error("tr");
      glCache()[key] = tx.slice(0, 400); glSave();
    } catch (e) { toast(w("gl_none")); }
    delete _glBusy[key]; regloss();
  }
  function regloss() { const sh = document.getElementById("emSheet"); if (sh && sh.dataset.word) return wordSheet(sh.dataset.word); if (_G) draw(); }

