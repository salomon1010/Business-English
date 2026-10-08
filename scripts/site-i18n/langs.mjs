/* The languages of lomonec.com — the app's own 16 (English + i18n/*.json).
   flag: inline SVG, not emoji (Windows draws emoji flags as two letters).
   A language is a country's flag by convention only; see site/README.md. */

/* five-pointed star as an SVG polygon */
function star(cx, cy, r, fill, rot = -90) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180, rr = i % 2 ? r * 0.382 : r;
    pts.push((cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2));
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
}
const svg = (vb, body) =>
  `<svg class="flag" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
const h3 = (a, b, c) => svg("0 0 3 3", `<rect width="3" height="1" fill="${a}"/><rect y="1" width="3" height="1" fill="${b}"/><rect y="2" width="3" height="1" fill="${c}"/>`);
const v3 = (a, b, c) => svg("0 0 3 2", `<rect width="1" height="2" fill="${a}"/><rect x="1" width="1" height="2" fill="${b}"/><rect x="2" width="1" height="2" fill="${c}"/>`);

const FLAG = {
  en: svg("0 0 60 30", '<rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/>'),
  fr: v3("#002654", "#fff", "#CE1126"),
  es: svg("0 0 3 2", '<rect width="3" height="2" fill="#AA151B"/><rect y=".5" width="3" height="1" fill="#F1BF00"/>'),
  pt: svg("0 0 30 20", '<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.2 27.6,10 15,17.8 2.4,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/>'),
  it: v3("#009246", "#fff", "#CE2B37"),
  de: h3("#000", "#DD0000", "#FFCE00"),
  ru: h3("#fff", "#0039A6", "#D52B1E"),
  ar: svg("0 0 30 20", '<rect width="30" height="20" fill="#006C35"/><rect x="8" y="6.5" width="14" height="3.4" rx="1.2" fill="#fff"/><rect x="8.5" y="12.6" width="13" height="1.1" rx=".5" fill="#fff"/>'),
  ur: svg("0 0 30 20", '<rect width="30" height="20" fill="#01411C"/><rect width="7.5" height="20" fill="#fff"/><circle cx="18.6" cy="10" r="5.4" fill="#fff"/><circle cx="20.2" cy="8.7" r="4.6" fill="#01411C"/>' + star(22.4, 7.2, 1.7, "#fff", -54)),
  hi: svg("0 0 3 2", '<rect width="3" height=".67" fill="#FF9933"/><rect y=".67" width="3" height=".66" fill="#fff"/><rect y="1.33" width="3" height=".67" fill="#138808"/><circle cx="1.5" cy="1" r=".24" fill="none" stroke="#000080" stroke-width=".06"/>'),
  bn: svg("0 0 30 20", '<rect width="30" height="20" fill="#006A4E"/><circle cx="13.5" cy="10" r="6" fill="#F42A41"/>'),
  id: svg("0 0 3 2", '<rect width="3" height="1" fill="#CE1126"/><rect y="1" width="3" height="1" fill="#fff"/>'),
  vi: svg("0 0 30 20", '<rect width="30" height="20" fill="#DA251D"/>' + star(15, 10, 6, "#FFFF00")),
  zh: svg("0 0 30 20", '<rect width="30" height="20" fill="#DE2910"/>' + star(5, 5, 3, "#FFDE00") + star(10, 2, 1, "#FFDE00") + star(12, 4, 1, "#FFDE00") + star(12, 7, 1, "#FFDE00") + star(10, 9, 1, "#FFDE00")),
  ja: svg("0 0 30 20", '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>'),
  ko: svg("0 0 30 20", '<rect width="30" height="20" fill="#fff"/><g transform="rotate(-33.7 15 10)"><circle cx="15" cy="10" r="5" fill="#0047A0"/><path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#CD2E3A"/></g><g stroke="#000" stroke-width="1.1"><path d="M4.6 5.4l3-2M23.6 3.6l2.8 2M4.6 14.6l3 2M22.4 16.4l3-2"/></g>'),
};

/* order of the drop-down; name = the language's own name */
export const LANGS = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
  { code: "ru", name: "Русский" },
  { code: "ar", name: "العربية", dir: "rtl" },
  { code: "ur", name: "اردو", dir: "rtl" },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
].map((l) => ({ ...l, flag: FLAG[l.code] }));
