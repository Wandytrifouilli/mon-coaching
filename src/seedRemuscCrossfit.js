// ─── REMUSCULATION & RETOUR CROSSFIT — 9 SEMAINES, 4 SÉANCES/SEM ──────────────
// 2 cycles de 4 semaines + 1 semaine de deload. Lundi, mardi, jeudi, samedi.
// Charges en % du 1RM ACTUEL estimé (pas des anciens records) ; plafonds indicatifs.
// Cycle 1 : RIR 3–4, tempo 3 s en excentrique. Cycle 2 : RIR 1–3, passage à 6–8 reps
// sur les mouvements principaux. Deload : séries ÷ 2, charges réduites, pas de finisher.
// Ajouté à la base du coach au premier chargement (sans _v : ses modifications ne sont jamais écrasées).

// Exercices manquants dans la bibliothèque (ajoutés s'ils n'existent pas encore)
export const REMUSC_CF_EXERCISES = [
  {id:127,name:"Rowing Poitrine Appuyée",muscle:"Dos",equipment:"Haltères",videoUrl:"",notes:"Buste appuyé sur un banc incliné, tirer les coudes vers les hanches, pause 1 s en haut."},
  {id:128,name:"Tractions Assistées",muscle:"Dos",equipment:"Élastique",videoUrl:"",notes:"Élastique ou machine. Départ bras tendus, menton au-dessus de la barre, descente contrôlée."},
  {id:129,name:"Ring Rows",muscle:"Dos",equipment:"Poids du corps",videoUrl:"",notes:"Aux anneaux, corps gainé, poitrine vers les anneaux, omoplates serrées en fin de mouvement."},
  {id:130,name:"Scapular Pull-ups",muscle:"Dos",equipment:"Barre fixe",videoUrl:"",notes:"Suspendu bras tendus : abaisser et rapprocher les omoplates sans plier les coudes, tenir 1 s."},
  {id:131,name:"Push Press Haltères",muscle:"Épaules",equipment:"Haltères",videoUrl:"",notes:"Petite flexion des genoux, impulsion des jambes, verrouillage bras tendus au-dessus de la tête. Descente contrôlée aux épaules."},
  {id:132,name:"Pike Push-ups",muscle:"Épaules",equipment:"Poids du corps",videoUrl:"",notes:"Hanches hautes, tête vers l'avant des mains (triangle), coudes à 45°. Préparation aux HSPU."},
  {id:133,name:"Dips Assistés",muscle:"Triceps",equipment:"Élastique",videoUrl:"",notes:"Élastique ou machine. Épaules basses, buste légèrement penché, descente jusqu'à 90° aux coudes."},
  {id:134,name:"Fentes Arrière",muscle:"Jambes",equipment:"Haltères",videoUrl:"",notes:"Grand pas en arrière, genou arrière proche du sol, pousser sur le talon avant pour remonter."},
];

const ex=(exId,sets,reps,rest,targetLoad="",note="",loadRef="none")=>({exId,sets,reps,rest,targetLoad,loadRef,note});
const ss=e=>({...e,linkNext:true,rest:""}); // superset : enchaîné sans repos avec l'exercice suivant

// sq = % squat / développé couché · alt = % RDL / push press · fs = % front squat (sur 1RM back squat)
const WEEKS=[
  {sq:"60",  alt:"55–60",fs:"50",  c:1},
  {sq:"62.5",alt:"60",   fs:"50",  c:1},
  {sq:"65",  alt:"62.5", fs:"52.5",c:1},
  {sq:"67.5",alt:"65",   fs:"52.5",c:1},
  {sq:"70",  alt:"67.5", fs:"55",  c:2},
  {sq:"72.5",alt:"70",   fs:"55",  c:2},
  {sq:"75",  alt:"72.5", fs:"57.5",c:2},
  {sq:"77.5",alt:"75",   fs:"57.5",c:2},
  {sq:"57.5",alt:"50–55",fs:"45",  c:0},
];

const week=(w,i)=>{
  const n=i+1, c1=w.c===1, dl=w.c===0, late=w.c===2&&n>=7;
  const S=x=>dl?Math.max(2,Math.round(x/2)):x;               // deload : séries ÷ 2
  const mainReps=dl?"6":n<=6?"8":n===7?"6–8":"6";              // cycle 2 : 8 → 6–8 → 6
  const mainRest=c1||dl?"2min":"2min30";
  const rir=c1?"RIR 3–4 (il reste 3 à 4 reps dans le réservoir)":dl?"charge facile, focus technique":"RIR 1–3";
  const tempo=c1?"Tempo : 3 s à la descente, 1 s de pause, remontée dynamique. ":"";
  const acc=c1?"Pas d'échec, amplitude complète. ":dl?"Léger, focus technique. ":"1–2 RIR sur les dernières séries. ";
  const prog="Double progression : monte les reps jusqu'au haut de la fourchette, puis la charge.";
  const hollow=dl?"20s":c1?"30s":late?"40s":"35s";

  const pullups=dl?"Assistance confortable, amplitude complète."
    :c1?"Assistance suffisante pour des reps propres, sans aller à l'échec."
    :late?"Assistance réduite. Si le contrôle est bon : 2 négatifs de 5 s sans assistance à la fin de la dernière série."
    :"Réduis l'assistance uniquement si toutes les reps sont propres.";
  const [pikeReps,pikeNote]=dl?["6–8","Pieds au sol, technique."]
    :c1?["8–12","Pieds au sol. Tête qui touche presque le sol devant les mains, gainage serré."]
    :late?["6–8","Pieds surélevés plus haut (box ~50–60 cm) : on se rapproche de la verticale des HSPU."]
    :["8–10","Pieds surélevés sur un banc (~40 cm)."];
  const dips=dl?"Assistance confortable."
    :c1?"Assistance suffisante, amplitude jusqu'à 90°."
    :"Réduis l'assistance progressivement : objectif dips sans aide pour préparer les HSPU.";

  const label=dl?"S9 — Deload · volume −50 %, technique, sans finisher"
    :`S${n} — Cycle ${w.c} · ${c1?"Réadaptation":"Développement"} · ${w.sq} % · ${c1?"RIR 3–4":"RIR 1–3"}`;

  const lundi={label:"Lundi — Squat, pectoraux & tractions",exercises:[
    ex(1,S(4),mainReps,mainRest,w.sq,`${tempo}Back squat — ${rir}. Si la technique se dégrade, baisse la charge.`,"1rm_squat"),
    ex(2,S(4),mainReps,mainRest,w.sq,`${tempo}Développé couché — omoplates serrées, pieds ancrés, barre touche le bas des pecs. ${rir}.`,"1rm_bench"),
    ex(128,S(4),c1||dl?"6–8":late?"5–6":"6–8","90s","",pullups),
    ex(23,S(3),"10/jambe","90s","",`${c1?"Tempo 3 s à la descente. ":""}${acc}Buste légèrement penché, genou avant stable.`),
    ss(ex(12,S(3),"12–15","","",`${acc}Pause 1 s en contraction. ${prog}`)),
    ex(40,S(3),"15","75s","",`${acc}Coudes légèrement fléchis, monter jusqu'à l'horizontale sans élan.`),
  ]};

  const mardi={label:"Mardi — Dos, bras & contrôle scapulaire",exercises:[
    ex(130,S(3),"8–10","60s","","Activation : omoplates vers le bas et l'arrière, bras tendus, tenir 1 s."),
    ex(127,S(4),late?"8–10":"10","90s","",`${c1?"Tempo 3 s au retour. ":""}${acc}${prog}`),
    ex(32,S(4),"10–12","75s","",`${acc}Lat pulldown — poitrine haute, coudes vers les hanches. ${prog}`),
    ex(129,S(3),"12","60s","",`${acc}Plus le corps est horizontal, plus c'est dur.`),
    ss(ex(6,S(3),"12","","",`${acc}Coudes fixes, supination en haut. ${prog}`)),
    ss(ex(59,S(3),"12–15","","",`${acc}Coudes collés au corps, extension complète, écarter la corde en bas. ${prog}`)),
    ex(126,S(3),hollow,"75s","","Bas du dos plaqué au sol, bras et jambes tendus. Base des mouvements de gym CrossFit."),
  ]};

  const jeudi={label:"Jeudi — Chaîne postérieure & pectoraux",exercises:[
    ex(15,S(4),mainReps,mainRest,`${w.alt}% 1RM`,`${tempo}RDL — % de ton 1RM actuel de RDL. Dos plat, hanches en arrière jusqu'à l'étirement des ischios. ${rir}.`),
    ex(16,S(3),"10","90s","",`${acc}Pause 1 s en haut, menton rentré, bassin en rétroversion.`),
    ex(24,S(4),late?"8–10":"10","90s","",`${c1?"Tempo 3 s à la descente. ":""}${acc}${prog}`),
    ex(134,S(3),"10/jambe","90s","",`${acc}Reverse lunges — haltères en mains, buste droit.`),
    ex(133,S(3),"8–10","90s","",dips),
    ss(ex(13,S(3),"12","","",`${acc}Hanches plaquées, descente contrôlée.`)),
    ex(37,S(3),"15","75s","",`${acc}Tirer la corde vers le front, coudes hauts, rotation externe en fin de mouvement.`),
  ]};

  const samedi={label:"Samedi — Épaules, tractions & prépa CrossFit",exercises:[
    ex(131,S(4),mainReps,mainRest,`${w.alt}% 1RM`,`Push press haltères — choisis des haltères qui laissent ${c1?"3–4 reps":dl?"beaucoup de marge":"1–3 reps"} en réserve. Impulsion des jambes, verrouillage complet en haut.`),
    ex(118,S(3),"8","2min",w.fs,`Front squat — % calculé sur ton 1RM de back squat. Coudes hauts, buste droit. ${c1?"Tempo 3 s à la descente. ":""}`,"1rm_squat"),
    ex(5,S(3),late?"8–10":"10","90s","",`${acc}Gainage fort, pas de cambrure lombaire. ${prog}`),
    ex(128,S(3),"8","90s","",`Tractions assistées, ou tirage vertical poulie si fatigue. ${pullups}`),
    ex(132,S(3),pikeReps,"90s","",pikeNote),
    ss(ex(46,S(3),"15","","",`${acc}Reverse fly — bras presque tendus, omoplates serrées.`)),
    ex(30,S(3),"12","60s","","Pompes tempo — 3 s à la descente, 1 s en bas, remontée dynamique. Corps gainé."),
    ...(dl?[]:[{kind:"text",title:"Finisher facultatif — EMOM",minutes:c1?8:10,
      text:`EMOM ${c1?8:10} min — une tâche au début de chaque minute, en alternant :\n- Minutes impaires : 10 calories vélo\n- Minutes paires : 10 sit-ups\n\nLe reste de la minute sert de récupération. Rythme soutenu mais contrôlé : on retrouve de la densité de travail, sans transformer la séance en WOD épuisant.`}]),
  ]};

  return {label,days:[lundi,mardi,jeudi,samedi]};
};

export const REMUSC_CF_PROG={
  id:"remusc_crossfit_9s",
  name:"Remusculation & retour CrossFit — 9 sem.",
  category:"Hypertrophie",
  level:"Intermédiaire",
  weeks:WEEKS.map(week),
};
