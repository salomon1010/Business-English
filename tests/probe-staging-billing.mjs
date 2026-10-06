/* One-off probe: open the LIVE staging site as an Android phone and as an
   iPhone-sized browser, open the Premium sheet, report what the billing layer
   decided and why. Run: cd tests && node probe-staging-billing.mjs */
import { chromium, devices } from "playwright";
const URL = process.env.URL || "https://staging.lomonec.com/index.html";
const b = await chromium.launch();
for (const [name, dev, gds] of [["android-chrome", devices["Pixel 7"], "reject"], ["android-chrome-gds-hang", devices["Pixel 7"], "hang"], ["desktop", { viewport: { width: 420, height: 900 } }, "none"]]) {
  const ctx = await b.newContext({ ...dev, serviceWorkers: "block" });
  await ctx.addInitScript(([g]) => {
    localStorage.setItem("be12_v1", JSON.stringify({ profile: { name: "T", lang: "en", ts: 1 }, professionalTracks: { activeId: "general-english" }, fnd: { "general-english": { placed: "full", finished: true } }, days: {}, dates: [], dayLog: {}, backupAsked: 1, rmSeen: Date.now(), lastSeen: Date.now() }));
    if (g === "reject") window.getDigitalGoodsService = async () => { throw new Error("not a TWA"); };
    if (g === "hang") window.getDigitalGoodsService = () => new Promise(() => {});
  }, [gds]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(4000);
  const r = await p.evaluate(async () => {
    const before = { state: Billing.state, provider: Billing.provider && Billing.provider.id, why: billingWhy(), flagPrev: flag("billing_preview_provider"), billing: flag("billing_enabled"), ent: entApiBase(), beEnv: !!beEnv() };
    let avail = null; try { avail = await Promise.race([BillingProviders.preview.available(), new Promise(r => setTimeout(() => r("TIMEOUT"), 3000))]); } catch (e) { avail = "threw:" + e.message; }
    premiumOpen("probe"); await new Promise(r => setTimeout(r, 1500));
    const o = document.getElementById("premOv");
    return { before, previewAvailable: avail, after: { state: Billing.state, provider: Billing.provider && Billing.provider.id }, sheet: o ? o.innerText.replace(/\s+/g, " ").slice(-220) : null };
  });
  console.log("\n## " + name + "\n" + JSON.stringify(r, null, 1) + (errs.length ? "\nERRORS " + errs.join(" | ") : ""));
  await ctx.close();
}
await b.close();
