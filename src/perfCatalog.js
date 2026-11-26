// Performances de l'athlète (partagé entre l'app client et l'espace coach).
// Stockage sur la fiche client :
//   perfLog : [{ id, test, variant, value, date:"AAAA-MM-JJ", note, rx }]
//   perfSex : "M" | "F" | ""   (pour le score DOTS)
// value est toujours un nombre : kg, reps, secondes, mètres, calories, ou reps totales pour un AMRAP.

// ─── Types de mesure ──────────────────────────────────────────────────────────
// better : "high" (plus c'est haut, mieux c'est) ou "low" (temps)
export const KINDS = {
  load:  { unit: "kg",   better: "high", placeholder: "kg" },
  reps:  { unit: "reps", better: "high", placeholder: "reps" },
  time:  { unit: "",     better: "low",  placeholder: "mm:ss" },
  hold:  { unit: "s",    better: "high", placeholder: "secondes" },
  dist:  { unit: "m",    better: "high", placeholder: "mètres" },
  cal:   { unit: "cal",  better: "high", placeholder: "calories" },
  amrap: { unit: "",     better: "high", placeholder: "tours+reps (ex. 18+7)" },
  bw:    { unit: "kg",   better: "none", placeholder: "kg" },
};

// ─── Catalogue ────────────────────────────────────────────────────────────────
export const RM_REPS = [1, 2, 3, 5, 8, 10, 12];
const RM = RM_REPS.map(r => ({ key: `${r}rm`, label: `${r}RM`, kind: "load", reps: r }));
const lift = (id, name, extra = {}) => ({ id, name, variants: RM, primary: ["1rm", "3rm"], ...extra });

const GYM = [{ key: "ub", label: "Max unbroken", kind: "reps" }, { key: "3min", label: "Max en 3 min", kind: "reps" }];
const gym = (id, name, extra = {}) => ({ id, name, variants: GYM, primary: ["ub", "3min"], ...extra });
const single = (id, name, kind, extra = {}) => ({ id, name, variants: [{ key: "max", label: "Record", kind }], primary: ["max"], ...extra });

// Distances (secondes) et durées (mètres / calories) pour les ergomètres et la course
const tm = (key, label, meters) => ({ key, label, kind: "time", meters });
const ds = (key, label, seconds) => ({ key, label, kind: "dist", seconds });
const cl = (key, label, seconds) => ({ key, label, kind: "cal", seconds });

const wod = (id, name, desc, kind = "time", extra = {}) =>
  ({ id, name, desc, wod: true, variants: [{ key: "score", label: kind === "time" ? "Temps" : kind === "amrap" ? "Score" : "Reps", kind }], primary: ["score"], ...extra });

export const PERF_GROUPS = [
  { id: "force", label: "Force", tests: [
    lift("back_squat", "Back Squat", { sync: "rm_squat" }),
    lift("front_squat", "Front Squat"),
    lift("deadlift", "Soulevé de terre", { sync: "rm_sdt" }),
    lift("bench", "Développé couché", { sync: "rm_bench" }),
    lift("strict_press", "Strict Press (militaire)"),
    lift("push_press", "Push Press"),
    lift("weighted_pullup", "Traction lestée", { sub: "Charge ajoutée" }),
    lift("weighted_dip", "Dips lestés", { sub: "Charge ajoutée" }),
    lift("hip_thrust", "Hip Thrust"),
  ]},
  { id: "halt", label: "Haltéro", tests: [
    lift("snatch", "Snatch (squat)"),
    lift("power_snatch", "Power Snatch"),
    lift("hang_power_snatch", "Hang Power Snatch"),
    lift("clean_jerk", "Clean & Jerk (squat)"),
    lift("power_clean_jerk", "Power Clean & Jerk"),
    lift("clean", "Squat Clean"),
    lift("power_clean", "Power Clean"),
    lift("hang_power_clean", "Hang Power Clean"),
    lift("push_jerk", "Push Jerk"),
    lift("split_jerk", "Split Jerk"),
    lift("ohs", "Overhead Squat"),
    lift("snatch_balance", "Snatch Balance"),
    lift("thruster", "Thruster"),
  ]},
  { id: "gym", label: "Gym", tests: [
    gym("strict_pullup", "Strict Pull-ups", { sync: "tractions_max" }),
    gym("kipping_pullup", "Kipping Pull-ups"),
    gym("butterfly_pullup", "Butterfly Pull-ups"),
    gym("c2b", "Chest-to-Bar"),
    gym("bmu", "Bar Muscle-ups"),
    gym("rmu", "Ring Muscle-ups"),
    gym("t2b", "Toes-to-Bar"),
    gym("strict_hspu", "Strict HSPU"),
    gym("kipping_hspu", "Kipping HSPU"),
    gym("ring_dips", "Ring Dips"),
    gym("pushups", "Push-ups", { sync: "pompes_max" }),
    gym("pistols", "Pistols (alternés)"),
    gym("du", "Double Unders"),
    gym("wall_balls", "Wall Balls", { sub: "9 / 6 kg" }),
    gym("rope_climb", "Rope Climbs"),
    single("hs_walk", "Handstand Walk", "dist", { sub: "Distance unbroken" }),
    single("hs_hold", "Handstand Hold", "hold"),
    single("lsit", "L-sit", "hold"),
    single("dead_hang", "Dead Hang", "hold"),
    single("plank", "Gainage planche", "hold", { sync: "gainage_max" }),
  ]},
  { id: "ergo", label: "Ergos", tests: [
    { id: "row", name: "Rameur", erg: "c2", primary: ["500", "2000"], variants: [
      tm("500", "500 m", 500), tm("1000", "1 000 m", 1000), tm("2000", "2 000 m", 2000), tm("5000", "5 000 m", 5000),
      ds("20min", "Max 20 min", 1200), cl("1min", "1 min cal", 60)] },
    { id: "ski", name: "SkiErg", erg: "c2", primary: ["500", "2000"], variants: [
      tm("500", "500 m", 500), tm("1000", "1 000 m", 1000), tm("2000", "2 000 m", 2000),
      ds("20min", "Max 20 min", 1200), cl("1min", "1 min cal", 60)] },
    { id: "bikeerg", name: "BikeErg", primary: ["20min", "10km"], variants: [
      ds("20min", "Max 20 min", 1200), tm("10km", "10 km", 10000), tm("4km", "4 km", 4000), cl("1min", "1 min cal", 60)] },
    { id: "airbike", name: "Assault / Echo Bike", primary: ["1min", "50cal"], variants: [
      cl("1min", "1 min cal", 60), cl("10min", "10 min cal", 600),
      { key: "50cal", label: "50 cal", kind: "time" }, { key: "100cal", label: "100 cal", kind: "time" }] },
  ]},
  { id: "run", label: "Course", tests: [
    { id: "run", name: "Course à pied", run: true, primary: ["1km", "5km"], variants: [
      tm("400", "400 m", 400), tm("800", "800 m", 800), tm("1km", "1 km", 1000), tm("mile", "1 mile", 1609),
      tm("5km", "5 km", 5000), tm("10km", "10 km", 10000), tm("semi", "Semi-marathon", 21097),
      ds("cooper", "Cooper 12 min", 720)] },
    { id: "vma", name: "VMA", primary: ["vma"], sync: "vma", variants: [{ key: "vma", label: "VMA", kind: "speed" }] },
  ]},
  { id: "wod", label: "Benchmarks", tests: [
    wod("fran", "Fran", "21-15-9 : Thrusters 43/29 kg, Pull-ups"),
    wod("grace", "Grace", "30 Clean & Jerks 61/43 kg"),
    wod("isabel", "Isabel", "30 Snatches 61/43 kg"),
    wod("diane", "Diane", "21-15-9 : Deadlifts 102/70 kg, HSPU"),
    wod("elizabeth", "Elizabeth", "21-15-9 : Cleans 61/43 kg, Ring Dips"),
    wod("helen", "Helen", "3 tours : 400 m course, 21 KB Swings 24/16 kg, 12 Pull-ups"),
    wod("karen", "Karen", "150 Wall Balls 9/6 kg"),
    wod("annie", "Annie", "50-40-30-20-10 : Double Unders, Sit-ups"),
    wod("jackie", "Jackie", "1 000 m rameur, 50 Thrusters 20/15 kg, 30 Pull-ups"),
    wod("nancy", "Nancy", "5 tours : 400 m course, 15 OHS 43/29 kg"),
    wod("amanda", "Amanda", "9-7-5 : Ring Muscle-ups, Squat Snatches 61/43 kg"),
    wod("dt", "DT", "5 tours : 12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks 70/47 kg"),
    wod("cindy", "Cindy", "AMRAP 20 min : 5 Pull-ups, 10 Push-ups, 15 Air Squats", "amrap", { roundReps: 30 }),
    wod("mary", "Mary", "AMRAP 20 min : 5 HSPU, 10 Pistols, 15 Pull-ups", "amrap", { roundReps: 30 }),
    wod("fgb", "Fight Gone Bad", "3 tours de 5 × 1 min : Wall Balls, SDHP, Box Jumps, Push Press, Row (cal)", "reps"),
    wod("filthy50", "Filthy Fifty", "50 reps de 10 mouvements (Box Jumps, Jumping Pull-ups, KB Swings, Walking Lunges…)"),
    wod("murph", "Murph", "1 mile, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 mile (gilet 9/6 kg)"),
  ]},
];
KINDS.speed = { unit: "km/h", better: "high", placeholder: "km/h" };

export const BW_TEST = { id: "bw", name: "Poids de corps", variants: [{ key: "kg", label: "Poids", kind: "bw" }], primary: ["kg"] };
const ALL = [...PERF_GROUPS.flatMap(g => g.tests), BW_TEST];
export const testById = id => ALL.find(t => t.id === id);
export const variantOf = (test, key) => test?.variants.find(v => v.key === key);
export const variantByIds = (testId, key) => variantOf(testById(testId), key);

// ─── Saisie / affichage ───────────────────────────────────────────────────────
const num = s => parseFloat(String(s).replace(",", "."));

// "3:45", "1:02:30", "3'45", "3min45", "225" → secondes (accepte les dixièmes : "1:32.5")
export function parseTime(v) {
  const s = String(v ?? "").trim().toLowerCase().replace(/\s/g, "").replace(",", ".");
  if (!s) return NaN;
  let m = s.match(/^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
  m = s.match(/^(\d+)(?::|'|min|mn|m)(\d{1,2}(?:\.\d+)?)?(?:''|"|s)?$/);
  if (m) return +m[1] * 60 + (m[2] ? +m[2] : 0);
  m = s.match(/^(\d+(?:\.\d+)?)s?$/);
  return m ? +m[1] : NaN;
}
export function fmtTime(sec) {
  if (!(sec >= 0)) return "—";
  const t = Math.round(sec * 10) / 10;
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const ss = (Number.isInteger(s) ? String(s) : s.toFixed(1)).padStart(Number.isInteger(s) ? 2 : 4, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
export const fmtNum = (n, d = 1) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: d });

// Texte saisi → nombre stocké (NaN si invalide)
export function parseValue(kind, raw, test) {
  if (kind === "time") return parseTime(raw);
  if (kind === "amrap") {
    const m = String(raw ?? "").replace(/\s/g, "").match(/^(\d+)(?:\+(\d+))?$/);
    if (!m) return NaN;
    return +m[1] * (test?.roundReps || 1) + (m[2] ? +m[2] : 0);
  }
  const n = num(raw);
  return n >= 0 ? n : NaN;
}
// Nombre stocké → texte à éditer
export function rawValue(kind, value, test) {
  if (kind === "time") return fmtTime(value);
  if (kind === "amrap") { const rr = test?.roundReps || 1; return `${Math.floor(value / rr)}+${value % rr}`; }
  return String(value).replace(".", ",");
}
// Nombre stocké → affichage { v, u }
export function display(kind, value, test) {
  if (value == null || Number.isNaN(value)) return { v: "—", u: "" };
  if (kind === "time") return { v: fmtTime(value), u: "" };
  if (kind === "amrap") { const rr = test?.roundReps || 1; const r = value % rr; return { v: `${Math.floor(value / rr)}${r ? `+${r}` : ""}`, u: "tours" }; }
  return { v: fmtNum(value), u: KINDS[kind]?.unit || "" };
}
export const fmtValue = (kind, value, test) => { const d = display(kind, value, test); return d.u ? `${d.v} ${d.u}` : d.v; };

// ─── Statistiques ─────────────────────────────────────────────────────────────
const isBetter = (kind, a, b) => (KINDS[kind]?.better === "low" ? a < b : a > b);
const byDate = (a, b) => (a.date || "").localeCompare(b.date || "") || (a.id || "").localeCompare(b.id || "");

export const entriesOf = (log, testId, key) => (log || []).filter(e => e.test === testId && (key == null || e.variant === key)).sort(byDate);

// Benchmarks : une perf RX passe toujours devant une perf scaled ; rx (facultatif) limite à une seule version
export function bestOf(log, testId, key, rx) {
  const v = variantByIds(testId, key);
  if (!v) return null;
  const wod = testById(testId)?.wod;
  let best = null;
  for (const e of entriesOf(log, testId, key)) {
    if (wod && rx != null && !!e.rx !== rx) continue;
    if (!best || (wod && !!e.rx !== !!best.rx ? e.rx : isBetter(v.kind, e.value, best.value))) best = e;
  }
  return best;
}
export const lastOf = (log, testId, key) => entriesOf(log, testId, key).at(-1) || null;

// Ids des entrées qui étaient un record au moment où elles ont été faites
export function prIds(log) {
  const ids = new Set(), best = {};
  for (const e of [...(log || [])].sort(byDate)) {
    const v = variantByIds(e.test, e.variant);
    if (!v || v.kind === "bw") continue;
    const k = `${e.test}|${e.variant}${testById(e.test)?.wod ? `|${!!e.rx}` : ""}`; // RX et scaled ont chacun leurs records
    if (best[k] == null || isBetter(v.kind, e.value, best[k])) { best[k] = e.value; ids.add(e.id); }
  }
  return ids;
}

// 1RM estimé (formule d'Epley), plafonné à 12 reps : au-delà l'estimation n'est plus fiable
export const est1RM = (load, reps) => (reps <= 1 ? load : load * (1 + Math.min(reps, 12) / 30));

// Meilleur 1RM réel et meilleur 1RM estimé (toutes les séries RM confondues)
export function liftSummary(log, testId) {
  const t = testById(testId);
  if (!t || t.variants !== RM) return null;
  const real = bestOf(log, testId, "1rm");
  let est = null;
  for (const v of RM) {
    const b = bestOf(log, testId, v.key);
    if (b) { const e1 = est1RM(b.value, v.reps); if (!est || e1 > est.value) est = { value: e1, from: v.label, entry: b }; }
  }
  return { real: real?.value ?? null, est: est ? Math.round(est.value * 2) / 2 : null, estFrom: est?.from, ref: real?.value ?? (est ? Math.round(est.value * 2) / 2 : null) };
}

// Allure : /500 m pour les ergos Concept2, /km pour la course ; watts Concept2
export function paceInfo(test, v, value) {
  if (!value) return null;
  const per = test.run ? 1000 : 500;
  let sec, meters;
  if (v.kind === "time" && v.meters) { sec = value; meters = v.meters; }
  else if (v.kind === "dist" && v.seconds) { sec = v.seconds; meters = value; }
  else if (v.kind === "cal" && v.seconds) return { text: `${fmtNum(value / (v.seconds / 60))} cal/min` };
  else return null;
  const pace = sec / meters * per;
  const parts = [`${fmtTime(pace)} /${test.run ? "km" : "500 m"}`];
  if (test.run) parts.push(`${fmtNum(meters / sec * 3.6)} km/h`);
  if (test.erg === "c2") parts.push(`${Math.round(2.8 / Math.pow(sec / meters, 3))} W`);
  return { text: parts.join(" · ") };
}

export const bodyweight = log => lastOf(log, "bw", "kg")?.value || null;

// Score DOTS (powerlifting) : total × 500 / polynôme du poids de corps
const DOTS = {
  M: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  F: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};
export function dots(total, bw, sex) {
  const c = DOTS[sex];
  if (!c || !(total > 0) || !(bw > 0)) return null;
  const w = Math.min(Math.max(bw, 40), sex === "M" ? 210 : 150);
  return total * 500 / (c[0] + c[1] * w + c[2] * w ** 2 + c[3] * w ** 3 + c[4] * w ** 4);
}

// Ratios entre mouvements, avec repères indicatifs couramment utilisés en coaching
export const RATIOS = [
  { a: "front_squat", b: "back_squat", label: "Front squat / Back squat", min: 80, max: 90 },
  { a: "bench", b: "back_squat", label: "Développé couché / Back squat", min: 65, max: 80 },
  { a: "deadlift", b: "back_squat", label: "Soulevé de terre / Back squat", min: 110, max: 125 },
  { a: "strict_press", b: "bench", label: "Strict press / Développé couché", min: 60, max: 70 },
  { a: "push_press", b: "strict_press", label: "Push press / Strict press", min: 125, max: 140 },
  { a: "snatch", b: "clean_jerk", label: "Snatch / Clean & Jerk", min: 78, max: 85 },
  { a: "clean_jerk", b: "front_squat", label: "Clean & Jerk / Front squat", min: 80, max: 90 },
  { a: "snatch", b: "back_squat", label: "Snatch / Back squat", min: 55, max: 65 },
  { a: "power_clean", b: "clean", label: "Power clean / Squat clean", min: 80, max: 90 },
  { a: "power_snatch", b: "snatch", label: "Power snatch / Snatch", min: 80, max: 88 },
  { a: "ohs", b: "snatch", label: "Overhead squat / Snatch", min: 105, max: 125 },
];

// Totaux calculés sur le meilleur 1RM réel (sinon estimé)
export function totals(log, sex) {
  const r = id => liftSummary(log, id)?.ref || 0;
  const sum = ids => (ids.every(id => r(id) > 0) ? ids.reduce((a, id) => a + r(id), 0) : null);
  const bw = bodyweight(log);
  const pl = sum(["back_squat", "bench", "deadlift"]);
  return {
    bw,
    pl,
    dots: pl && bw ? dots(pl, bw, sex) : null,
    cf: sum(["back_squat", "strict_press", "deadlift"]),
    oly: sum(["snatch", "clean_jerk"]),
  };
}

// Valeurs de référence du coach (fiche « tests ») à mettre à jour après une nouvelle perf :
// uniquement si la perf dépasse la valeur actuelle (le coach garde la main pour baisser).
export function syncedTests(log, tests = {}) {
  const out = { ...tests };
  let changed = false;
  for (const t of ALL) {
    if (!t.sync) continue;
    let val = null;
    if (t.variants === RM) val = bestOf(log, t.id, "1rm")?.value ?? null;
    else val = bestOf(log, t.id, t.primary[0])?.value ?? null;
    if (val != null && !(num(out[t.sync]) >= val)) { out[t.sync] = String(val); changed = true; }
  }
  return changed ? out : tests;
}

export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const fmtDate = iso => { const [y, m, d] = String(iso || "").split("-"); return d ? `${d}/${m}/${y.slice(2)}` : "—"; };
export const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
