// Durée estimée des séances (partagé entre l'espace coach et l'app client).
// Durée = effort (répétitions × temps par répétition, ou durée de la série) + récupérations.
// Dans un superset (exercice marqué linkNext), pas de repos entre les exercices liés ;
// le repos du dernier exercice du groupe est compté après chaque tour.

// Temps moyen d'une répétition, estimé d'après le nom, puis le groupe musculaire.
// Le coach peut le remplacer par sa propre valeur (champ secPerRep de l'exercice).
const NAME_RULES = [
  [/pause|tempo|excentrique|n[ée]gati|isom[ée]tri/, 6],
  [/burpee/, 3],
  [/saut|jump|sprint|box|corde [àa] sauter|swing|clean|snatch|arrach[ée]|épaulé|thruster|wall ?ball|slam|mountain/, 2],
  [/pompe|push[- ]?up|dips/, 3],
  [/curl|extension|[ée]l[ée]vation|oiseau|[ée]cart[ée]|fly|kickback|mollet|calf|crunch|relev[ée]|shrug|face ?pull|pull[- ]?over|adducteur|abducteur|pec deck|crossover/, 3],
  [/soulev[ée]|deadlift|squat|d[ée]velopp[ée]|press|rowing|tirage|traction|pull[- ]?up|chin|fente|lunge|hip thrust|presse|good morning|bulgare|step/, 4],
];
const MUSCLE_SEC = { Cardio: 2, Abdominaux: 2.5, "Avant-bras": 2, Biceps: 3, Triceps: 3, "Épaules": 3, Jambes: 4, Dos: 4, Pectoraux: 4 };
export const DEFAULT_SEC_PER_REP = 3;

export function estimateSecPerRep(ex) {
  const name = String(ex?.name || "").toLowerCase();
  for (const [re, sec] of NAME_RULES) if (re.test(name)) return sec;
  return MUSCLE_SEC[ex?.muscle] ?? DEFAULT_SEC_PER_REP;
}
// Valeur saisie par le coach, sinon estimation automatique
export const customSecPerRep = ex => (Number(ex?.secPerRep) > 0 ? Number(ex.secPerRep) : null);
export const secPerRepOf = ex => customSecPerRep(ex) ?? estimateSecPerRep(ex);

const num = s => parseFloat(String(s).replace(",", "."));

// "90s", "2min", "1min30", "1:30", "2'" → secondes
export function parseDuration(v) {
  const s = String(v ?? "").toLowerCase().replace(/\s/g, "");
  if (!s) return 0;
  let m = s.match(/^(\d+(?:[.,]\d+)?)(?:min|mn|')(\d+)?/);
  if (m) return Math.round(num(m[1]) * 60) + (Number(m[2]) || 0);
  m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:[.,]\d+)?)/);
  return m ? Math.round(num(m[1])) : 0;
}

// Ce que représente une série : { sec } (durée ou distance) ou { reps } (nombre de répétitions)
export function parseReps(reps) {
  const s = String(reps ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return { reps: 10 };
  const sides = /\/\s*(c[ôo]t[ée]|jambe|bras|main|pied)/.test(s) ? 2 : 1;
  let m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:s|sec|secondes?)\b/);
  if (m) return { sec: num(m[1]) * sides };
  m = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:min|mn)\b/);
  if (m) return { sec: num(m[1]) * 60 * sides };
  m = s.match(/^(\d+):(\d{2})\b/);
  if (m) return { sec: (Number(m[1]) * 60 + Number(m[2])) * sides };
  m = s.match(/(\d+(?:[.,]\d+)?)\s*km\b/);
  if (m) return { sec: num(m[1]) * 360 }; // ≈ 6 min/km
  m = s.match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  if (m) return { sec: Math.max(5, num(m[1]) * 0.2) }; // sprint / course courte ≈ 5 m/s
  if (/max|[ée]puisement|[ée]chec/.test(s)) return /seconde/.test(s) ? { sec: 45 } : { reps: 12 * sides };
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) || []).map(num);
  if (!nums.length) return { reps: 10 };
  // "8-10" ou "10 / 8 / 5 / 3" (pyramide) : moyenne
  const n = nums.length > 1 && /\d\s*[-/à]\s*\d/.test(s) && sides === 1 ? nums.reduce((a, b) => a + b, 0) / nums.length : nums[0];
  return { reps: n * sides };
}

// Durée d'effort d'une série, en secondes
export function setWorkSeconds(reps, secPerRep) {
  const p = parseReps(reps);
  return p.sec != null ? p.sec : p.reps * secPerRep;
}

// Détail d'une séance : [{work, rest, total}] par exercice + totaux, en secondes
export function sessionBreakdown(day, exercises = []) {
  const list = day?.exercises || [];
  const rows = list.map((pe, i) => {
    const ex = exercises.find(e => e.id === pe.exId);
    const sets = Math.max(1, Number(pe.sets) || 1);
    const work = sets * setWorkSeconds(pe.reps, secPerRepOf(ex));
    const chained = !!pe.linkNext && i < list.length - 1;
    // Pas de récupération après la toute dernière série de la séance
    const restSets = i === list.length - 1 ? sets - 1 : sets;
    const rest = chained ? 0 : restSets * parseDuration(pe.rest);
    return { work, rest, total: work + rest };
  });
  const work = rows.reduce((a, r) => a + r.work, 0);
  const rest = rows.reduce((a, r) => a + r.rest, 0);
  return { rows, work, rest, total: work + rest };
}
export const sessionMinutes = (day, exercises) => Math.round(sessionBreakdown(day, exercises).total / 60);

// 47 → "47 min" · 65 → "1 h 05"
export function fmtMinutes(min) {
  const m = Math.round(min);
  if (m < 1) return min > 0 ? "< 1 min" : "0 min";
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
