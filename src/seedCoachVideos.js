// ─── VIDÉOS DU COACH (playlist YouTube « Vidéo app », non répertoriée) ─────────
// 1. Vidéos associées à des exercices déjà dans la bibliothèque (par id).
// 2. Nouveaux exercices créés avec leur vidéo.
// 3. Un exercice créé par le coach dont le nom correspond à un titre (alias) reçoit aussi la vidéo.
// La vidéo est posée UNE seule fois (marqueur coachVideo sur l'exercice) : si le coach la change
// ensuite dans l'app, son choix est conservé.
const yt = id => `https://www.youtube.com/embed/${id}`;

// [id de l'exercice existant, id YouTube, alias]
const LINKS = [
  [1, "-BPNM6RW4fg", ["back squat"]],
  [117, "JYzW889MCpo", ["back squat pause", "back squat pause bottom", "squat pause en bas"]],
  [4, "5PfVwP1FSGQ", ["deadlift"]],
  [2, "I0uVlI3-VEU", ["bench press"]],
  [24, "XEXCedglDjY", ["dumbbell bench", "dumbbell bench press", "developpe couche haltere"]],
  [26, "lkbSbOF-8JA", ["incline dumbbell bench press", "developpe incline haltere"]],
  [45, "5EUnXuD-uXo", ["double dumbbell seated strict press", "developpe militaire assis", "developpe militaire halteres assis"]],
  [131, "e8cHPs7Mqnw", ["dumbbell push press", "double dumbbell push press", "developpe militaire haltere debout"]],
  [6, "gsc_RC9GRlI", ["dumbbell curl", "curl biceps haltere", "curl biceps halteres"]],
  [49, "1QyWfw1ahnA", ["dumbbell hammer curl", "hammer curl", "curl haltere prise marteau", "curl biceps haltere prise marteau"]],
  [48, "F3lCE0e3ICY", ["incline dumbbell curl", "alternate incline dumbbell curl", "curl haltere sur banc incline"]],
  [52, "i_qyfHWleYc", ["curl biceps barre ez prise supination", "curl barre ez supination", "ez bar curl"]],
  [60, "bjbK77_Z0BA", ["crunch abdos"]],
  [125, "PhOwBxswyLM", ["arch", "arch hold", "superman"]],
];

// Nouveaux exercices : [id, nom, muscle, équipement, id YouTube, alias]
const NEW = [
  [143, "Clean (Épaulé)", "Jambes", "Barre", "lK5xP_jNPxs", ["clean", "epaule", "squat clean"]],
  [144, "Clean & Jerk (Épaulé-jeté)", "Jambes", "Barre", "pilkcRb4Qeo", ["clean and jerk", "clean & jerk", "epaule jete"]],
  [145, "Cluster", "Jambes", "Barre", "SkFkPtJWo7Y", ["cluster barre"]],
  [146, "Clean Deadlift", "Dos", "Barre", "LX_UUTm8478", []],
  [147, "Snatch Deadlift", "Dos", "Barre", "WYLh9zpJS5c", []],
  [148, "Clean High Pull", "Dos", "Barre", "8Hj9Uhtdw2c", ["tirage haut d'epaule"]],
  [149, "Clean High Pull Déficit", "Dos", "Barre", "UUvrnlqYw2A", ["clean high pull deficit", "tirage haut d'epaule deficit"]],
  [150, "Clean Pull Déficit Élastique", "Dos", "Barre", "7DWwhx3N2vY", ["banded clean pull deficit"]],
  [151, "Snatch Haltère", "Jambes", "Haltères", "kl8lWgE37Wo", ["dumbbell snatch", "db snatch"]],
  [152, "Clean Haltère", "Jambes", "Haltères", "LW1sML5Wlx4", ["dumbbell clean", "db clean"]],
  [153, "Hang Clean Haltère", "Jambes", "Haltères", "t3SQwfX43aQ", ["dumbbell hang clean"]],
  [154, "Clean & Jerk Haltère", "Jambes", "Haltères", "rkR-A9xoGPE", ["dumbbell clean and jerk", "dumbbell clean & jerk"]],
  [155, "Thruster Un Haltère", "Jambes", "Haltères", "Jns_hJQOUIE", ["one dumbbell thruster", "single dumbbell thruster"]],
  [156, "Thruster Haltères", "Jambes", "Haltères", "EpEl4910vAg", ["double dumbbell thruster", "dumbbell thruster"]],
  [157, "Cluster Un Haltère", "Jambes", "Haltères", "HZHEmEK6L2A", ["dumbbell cluster"]],
  [158, "Cluster Haltères", "Jambes", "Haltères", "CryqxNJmo7A", ["double dumbbell cluster"]],
  [159, "Devil Press", "Épaules", "Haltères", "yLXg7JSgReg", []],
  [160, "Devil Press Double Haltère", "Épaules", "Haltères", "A0CUkYtlsUE", ["double dumbbell devil press"]],
  [161, "Push Press Un Haltère", "Épaules", "Haltères", "0yJMvs_1P1U", ["one dumbbell push press", "single dumbbell push press"]],
  [162, "Développé Militaire Haltères Debout", "Épaules", "Haltères", "PLAq3gmjPmU", ["double dumbbell strict press", "developpe militaire haltere"]],
  [163, "Développé Militaire Un Bras Assis", "Épaules", "Haltères", "jHIGsoUwl_s", ["seated one dumbbell strict press"]],
  [164, "Développé Couché Haltères Prise Neutre", "Pectoraux", "Haltères", "udgvNzzgAZc", ["dumbbell bench neutral grip", "developpe couche haltere prise neutre"]],
  [165, "Soulevé de Terre Haltères", "Jambes", "Haltères", "FGPOkGMLPLs", ["dumbbell deadlift", "deadlift haltere"]],
  [166, "Romanian Deadlift Haltères", "Jambes", "Haltères", "4bJEv3TCuJA", ["dumbbell romanian deadlift", "rdl halteres", "deadlift jambes tendues haltere"]],
  [167, "Curl Haltères Alterné", "Biceps", "Haltères", "sp8h68alQbY", ["dumbbell curl alternate", "alternate dumbbell curl", "biceps curl alterne"]],
  [168, "Curl Incliné Prise Neutre", "Biceps", "Haltères", "-4F-QoIdWfI", ["curl haltere sur banc incline prise neutre"]],
  [169, "Curl Barre EZ Pronation", "Biceps", "Barre", "8XafLRTtgBE", ["curl biceps barre ez prise pronation", "reverse curl"]],
  [170, "Box Squat", "Jambes", "Barre", "WLFpCgQ2Odw", ["box back squat"]],
  [171, "Fentes Avant Barre", "Jambes", "Barre", "VmSbWBvLZPM", ["back rack front lunges", "fentes avant"]],
  [172, "Fentes Arrière Barre", "Jambes", "Barre", "yuy4p38nm4E", ["back rack lunges", "back rack reverse lunges"]],
  [173, "Back Rack Hold", "Abdominaux", "Barre", "7cYqTXzPnLg", []],
  [174, "Pompes Diamant", "Triceps", "Poids du corps", "b9IGoJ-a_Ms", ["diamond push up", "diamond push-up"]],
  [175, "Hollow Dynamique", "Abdominaux", "Poids du corps", "TkP9yl58sys", ["dynamique hollow", "dynamic hollow"]],
  [176, "Arch Dynamique", "Dos", "Poids du corps", "YZlCdlgZnbg", ["dynamique arch", "dynamic arch"]],
  [177, "Arch Rock", "Dos", "Poids du corps", "E81rHYpu1L4", []],
  [178, "Planche Coude-Main", "Abdominaux", "Poids du corps", "zejWv7arLZA", ["elbow to hand plank", "planche alternee"]],
  [179, "Crunch Bicyclette", "Abdominaux", "Poids du corps", "5s9ywBrzMbQ", ["bicycle crunch"]],
  [180, "Flutter Kicks (Ciseaux)", "Abdominaux", "Poids du corps", "Nmrjc6I_-1s", ["flutter kicks", "ciseaux abdos", "les ciseaux abdos"]],
];

export const COACH_VIDEO_MARK = 1;
export const COACH_VIDEO_EXERCISES = NEW.map(([id, name, muscle, equipment, v]) => ({ id, name, muscle, equipment, videoUrl: yt(v), notes: "", coachVideo: COACH_VIDEO_MARK }));
export const COACH_VIDEO_LINKS = LINKS.map(([exId, v]) => ({ exId, url: yt(v) }));

// Nom normalisé : minuscules, sans accents ni ponctuation
export const normName = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

const byId = new Map(LINKS.map(([exId, v]) => [String(exId), yt(v)]));
const byName = new Map();
for (const [, name, , , v, aliases] of NEW) for (const n of [name, ...aliases]) byName.set(normName(n), yt(v));
for (const [, v, aliases] of LINKS) for (const n of aliases) if (!byName.has(normName(n))) byName.set(normName(n), yt(v));

// Vidéo du coach à poser sur un exercice déjà en base, ou null (déjà fait, ou aucune correspondance)
export function coachVideoFor(ex) {
  if (!ex || ex.coachVideo >= COACH_VIDEO_MARK) return null;
  return byId.get(String(ex.id)) || byName.get(normName(ex.name)) || null;
}
