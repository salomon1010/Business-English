  function label(id) { const t = byId(id); if (t) return t.en; const g = gram(id); return g ? g.q : id; }
  /* one answer of a round, as the History tab shows it */
  function itemHTML(x) {
    const ok = !!x.o, mk = (b, sub) => `<li class="wm-hi ${ok ? "ok" : "no"}">${wi(ok ? "check" : "cross")}<div>${b}${sub || ""}</div>${x.k ? `<em>${h(kindName(x.k))}</em>` : ""}</li>`;
    if (x.k === "mis" || x.k === "coach") {
      const sc = scen(x.s), o = sc && x.k === "mis" && sc.options[+x.p];
      return mk(`<b>${h(sc ? sc.asks : x.s)}</b>`, `${o ? `<small lang="en">${h(w("h_chose", { p: "“" + o.en + "”" }))}</small>` : ""}${!ok && sc && x.k === "mis" ? `<small>${h(w("h_ans", { a: (sc.options.find(z => z.ok) || {}).en || "" }))}</small>` : ""}${x.k === "coach" ? `<small>${h(w("co_v_" + (x.p || "almost")))}</small>` : ""}`);
    }
    const g = gram(x.t);
    if (g) return mk(`<b lang="en">${h(g.q)}</b>`, `${x.p != null && g.o[+x.p] != null ? `<small class="${ok ? "" : "bad"}">${h(w("h_chose", { p: g.o[+x.p] }))}</small>` : ""}${ok ? "" : `<small>${h(w("h_ans", { a: g.o[g.a] }))}</small>`}`);
    const t = byId(x.t), name = t ? t.en : x.t;
    let said = "";
    if (x.k === "card") said = w("h_rated", { p: w(["again", "hard", "good", "easy"][x.q] || "good") });
    else if (x.p === "revealed") said = w("h_revealed");
    else if (x.k === "speak" && x.p) said = w("h_said", { p: "“" + x.p + "”" });
    else if (x.p) said = byId(x.p) ? w("h_chose", { p: label(x.p) }) : w("h_typed", { p: x.p });
    return mk(`<button class="wm-hi-w" data-em="word" data-a="${h(x.t)}"><b lang="en">${h(name)}</b></button>`,
      `${said ? `<small class="${ok ? "" : "bad"}">${h(said)}</small>` : ""}${!ok && x.p && x.k !== "card" && x.k !== "speak" && t ? `<small>${h(w("h_ans", { a: x.k === "sent" ? clean(sentenceOf(t)) : name }))}</small>` : ""}${x.h ? `<small class="wm-mut">${h(w("h_hint"))}</small>` : ""}`);
  }
  function kindName(k) {
    const m = { card: "k_card", def: "k_def", ex: "k_ex", use: "k_use", gram: "k_gram", sent: "k_sent", fix: "k_gram", listen: "k_listen", "listen-t": "k_listen_t", "listen-s": "k_listen_s", spell: "k_spell", speak: "k_speak", mis: "k_mis", coach: "k_coach" };
    return k.startsWith("match") ? w("k_match") : w(m[k] || "k_card");
  }
  function roundHTML(r) {
