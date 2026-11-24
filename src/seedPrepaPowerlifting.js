// ─── PRÉPA GÉNÉRALE AVANT CYCLE POWERLIFTING — 7 SEMAINES, 4 SÉANCES/SEM ──────
// Fait suite aux 2 mois de remusculation (beaucoup de tempo). Objectif : réhabituer le corps
// à la charge sans faire que de la force : volume modéré sur squat / développé couché / soulevé
// de terre, beaucoup de renforcement et de gainage (sandbag, GHD, portés), un peu de muscu simple.
// S1 : deload + découverte des exercices sandbag / GHD.
// Bloc 1 (S2–S4) : accumulation, 65 → 72,5 %, RIR 3, tempo 2 s qui disparaît en S4.
// Bloc 2 (S5–S7) : intensification, 75 → 80 %, RIR 2, single RPE 8 en S7 pour recalibrer le 1RM.
// Ajouté à la base du coach au premier chargement (sans _v : ses modifications ne sont jamais écrasées).

// Exercices manquants dans la bibliothèque (ajoutés s'ils n'existent pas encore)
export const PREPA_PL_EXERCISES = [
  {id:135,name:"Sandbag Bear Hug Carry",muscle:"Dos",equipment:"Sandbag",videoUrl:"",notes:"Sac serré contre la poitrine, bras croisés dessous. Buste droit, gainage maximal, petits pas rapides. Respirer court sans relâcher le ventre."},
  {id:136,name:"Sandbag Bear Hug Squat",muscle:"Jambes",equipment:"Sandbag",videoUrl:"",notes:"Sac tenu en bear hug contre la poitrine. Squat complet, buste le plus vertical possible, coudes serrés."},
  {id:137,name:"Sandbag to Shoulder",muscle:"Dos",equipment:"Sandbag",videoUrl:"",notes:"Sac au sol : le ramasser en le roulant sur les cuisses, extension de hanches explosive, le charger sur une épaule. Alterner les épaules, reposer au sol à chaque rep."},
  {id:138,name:"Extension Lombaire GHD",muscle:"Dos",equipment:"GHD",videoUrl:"",notes:"Hanches calées sur les coussins. Descendre dos plat (ou en enroulant légèrement), remonter jusqu'à l'alignement du corps, sans hyperextension. Lester en tenant un disque contre la poitrine."},
  {id:139,name:"GHD Sit-up",muscle:"Abdominaux",equipment:"GHD",videoUrl:"",notes:"Pieds bloqués, fesses au bord des coussins. Descendre jusqu'à l'horizontale (ou plus bas si maîtrisé), remonter en poussant sur les pieds. Commencer en amplitude réduite : très exigeant pour les fléchisseurs de hanche."},
  {id:140,name:"Suitcase Carry",muscle:"Abdominaux",equipment:"Kettlebell",videoUrl:"",notes:"Une charge lourde d'un seul côté. Marcher sans pencher le buste : les obliques du côté opposé travaillent. Changer de main à chaque série."},
  {id:141,name:"Copenhagen Plank",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"",notes:"Gainage latéral, jambe du dessus posée sur un banc (genou pour la version facile, cheville pour la version complète). Bassin haut, corps aligné."},
  {id:142,name:"Développé Couché Pause",muscle:"Pectoraux",equipment:"Barre",videoUrl:"",notes:"Pause franche de 2 s barre posée sur la poitrine, sans rebond ni relâchement, puis remontée explosive. Spécifique powerlifting."},
];

const ex=(exId,sets,reps,rest,targetLoad="",note="",loadRef="none")=>({exId,sets,reps,rest,targetLoad,loadRef,note});
const ss=e=>({...e,linkNext:true,rest:""}); // superset : enchaîné sans repos avec l'exercice suivant

// m = mouvements principaux squat / couché [séries, reps, %] · dl = soulevé de terre
// p = variantes pause (squat / couché) · fs = front squat (% 1RM squat) · cg = couché prise serrée (% 1RM couché)
const WEEKS=[
  {b:0,m:[3,5,"55"],  dl:[3,5,"55"],  p:null,         fs:[2,5,"45"],  cg:[2,8,"50"],  rest:"2min",  rir:"RIR 5 — très facile"},
  {b:1,m:[4,8,"65"],  dl:[3,6,"65"],  p:[3,5,"55"],   fs:[3,6,"50"],  cg:[3,8,"60"],  rest:"2min",  rir:"RIR 3"},
  {b:1,m:[4,8,"67.5"],dl:[3,6,"67.5"],p:[3,5,"57.5"], fs:[3,6,"52.5"],cg:[3,8,"62.5"],rest:"2min",  rir:"RIR 3"},
  {b:1,m:[4,6,"72.5"],dl:[4,5,"72.5"],p:[3,4,"60"],   fs:[3,5,"55"],  cg:[3,6,"65"],  rest:"2min30",rir:"RIR 3"},
  {b:2,m:[5,5,"75"],  dl:[4,4,"75"],  p:[3,4,"62.5"], fs:[3,5,"57.5"],cg:[3,6,"67.5"],rest:"2min30",rir:"RIR 2–3"},
  {b:2,m:[5,5,"77.5"],dl:[4,4,"77.5"],p:[3,3,"65"],   fs:[3,4,"60"],  cg:[3,5,"70"],  rest:"3min",  rir:"RIR 2"},
  {b:2,m:[4,4,"80"],  dl:[3,3,"80"],  p:[2,3,"65"],   fs:[3,4,"60"],  cg:[3,5,"70"],  rest:"3min",  rir:"RIR 2", single:true},
];

const week=(w,i)=>{
  const n=i+1, dl=w.b===0, b2=w.b===2;
  const S=x=>dl?Math.max(2,Math.round(x/2)):x;                 // deload : séries ÷ 2
  const tempo=n<=3&&!dl?"Tempo 2 s à la descente (transition après le travail en tempo), remontée dynamique. ":"Descente contrôlée, remontée explosive. ";
  const acc=dl?"Léger : on apprend le mouvement. ":b2?"Lourd mais propre, 1–2 reps en réserve. ":"2–3 reps en réserve. ";
  const carry=dl?"20s":b2?"40s":"30s";
  const bag=dl?"Sac léger, priorité à la position."
    :b2?"Sac plus lourd qu'au bloc 1 : il doit être difficile de finir la série sans le lâcher."
    :"Choisis un sac que tu peux tenir toute la série sans le lâcher, puis monte de 5–10 kg dès que c'est fluide.";
  const lest=dl?"Au poids du corps.":b2?"Lesté (disque contre la poitrine), contrôle total.":n>=3?"Lesté léger si 12 reps faciles.":"Au poids du corps.";

  // Mouvement principal, avec single RPE 8 en S7 pour recalibrer le 1RM avant le cycle powerlifting
  const main=(exId,[sets,reps,pct],loadRef,cue)=>[
    ...(w.single?[ex(exId,1,"1","3min","87.5",`Single RPE 8 : monte par paliers jusqu'à une rep lourde mais rapide (≈ 85–90 %). Note la charge : elle sert à recalculer ton 1RM pour le cycle powerlifting. ${cue}`,loadRef)]:[]),
    ex(exId,sets,String(reps),w.rest,pct,`${w.single?"Séries de travail après le single. ":""}${tempo}${cue} ${w.rir}.`,loadRef),
  ];

  const lundi={label:"Lundi — Squat, sandbag & GHD",exercises:[
    ...main(1,w.m,"1rm_squat","Back squat — gainage complet avant chaque descente, profondeur constante."),
    ...(w.p?[ex(117,w.p[0],String(w.p[1]),"2min",w.p[2],"Squat pause — 2 s de pause en bas, sans se relâcher, remontée explosive.","1rm_squat")]:[]),
    ex(136,S(3),b2?"6":"8","90s","",`${acc}${bag}`),
    ss(ex(138,S(3),"12","","",`${acc}${lest}`)),
    ex(139,S(3),dl?"8":b2?"15":"10–12","75s","","Enchaîné sur le même GHD. Amplitude progressive : horizontale d'abord, plus bas seulement si le bas du dos reste solide."),
    ss(ex(135,S(3),carry,"","",`${bag} Environ 25–35 m.`)),
    ex(141,S(3),dl?"15s/côté":b2?"30s/côté":"20s/côté","90s","","Version genou au début, cheville quand 30 s sont faciles."),
  ]};

  const mardi={label:"Mardi — Développé couché & haut du corps",exercises:[
    ...main(2,w.m,"1rm_bench","Développé couché — omoplates serrées, pieds ancrés, toucher la poitrine à chaque rep."),
    ...(w.p?[ex(142,w.p[0],String(w.p[1]),"2min",w.p[2],"Pause 2 s sur la poitrine, sans rebond.","1rm_bench")]:[]),
    ex(10,S(4),b2?"6":"8","90s","",`${acc}Rowing barre — buste à 45°, dos verrouillé, tirer vers le nombril.`),
    ex(3,S(3),b2?"5–6":"6–8","90s","",`${acc}Tractions strictes. Assistées si besoin ; lestées si tu dépasses 10 reps propres.`),
    ex(45,S(3),"10","90s","",`${acc}Développé haltères assis — dos calé, verrouillage en haut.`),
    ss(ex(49,S(3),"12","","","Muscu simple : coudes fixes, pas d'élan.")),
    ex(59,S(3),"12–15","60s","","Muscu simple : coudes collés, extension complète."),
    ex(62,S(3),dl?"6":b2?"10–12":"8–10","60s","","Bassin en rétroversion, dos jamais creusé. Amplitude réduite si le bas du dos tire."),
  ]};

  const jeudi={label:"Jeudi — Soulevé de terre & chaîne postérieure",exercises:[
    ...main(4,w.dl,"1rm_sdt","Soulevé de terre — barre collée aux tibias, mise en tension avant de décoller, chaque rep repart du sol."),
    ...(dl?[]:[ex(20,3,b2?"6":"8","2min","",`Good morning barre — charge modérée, dos plat, hanches en arrière. ${acc}`)]),
    ex(137,S(4),dl?"4":b2?"6":"5","90s","",`5 reps = alterner les épaules. ${bag}`),
    ex(134,S(3),"8/jambe","90s","",`${acc}Fentes arrière haltères, buste droit.`),
    ss(ex(139,S(3),dl?"8":b2?"15":"10–12","","","GHD sit-up — amplitude progressive.")),
    ex(108,S(3),"10/côté","60s","","Pallof press — bras tendus 2 s, le buste ne tourne pas."),
    ex(140,S(3),b2?"40s/côté":"30s/côté","75s","","Charge lourde d'un côté, buste droit. Changer de main à mi-série."),
  ]};

  const rounds=dl?2:b2?4:3;
  const samedi={label:"Samedi — Variantes, sandbag & muscu",exercises:[
    ex(118,w.fs[0],String(w.fs[1]),"2min",w.fs[2],`Front squat — % calculé sur ton 1RM de back squat. Coudes hauts, buste droit. ${acc}`,"1rm_squat"),
    ex(58,w.cg[0],String(w.cg[1]),"2min",w.cg[2],`Développé couché prise serrée — mains largeur d'épaules, coudes près du corps. ${acc}`,"1rm_bench"),
    ex(16,S(3),"10","90s","",`${acc}Hip thrust — pause 1 s en haut, bassin en rétroversion.`),
    ex(33,S(3),"10/bras","75s","",`${acc}Rowing haltère — dos plat, tirer le coude vers la hanche.`),
    ss(ex(40,S(3),"15","","","Muscu simple : sans élan, jusqu'à l'horizontale.")),
    ex(37,S(3),"15","60s","","Muscu simple : coudes hauts, rotation externe en fin de mouvement."),
    {kind:"text",title:"Finisher — Medley sandbag & gainage",minutes:dl?6:b2?14:11,
      text:`${rounds} tours, 1 min 30 de repos entre les tours :\n- ${dl?"15":"25"} m Sandbag Bear Hug Carry\n- ${dl?"3":"5"} Sandbag to Shoulder (alterner les épaules)\n- ${dl?"6":"10"} GHD Sit-ups (ou 15 Hollow Rocks)\n- ${dl?"20":"30"} s Planche latérale par côté\n\n${dl?"Très léger : on découvre l'enchaînement.":"Rythme soutenu mais technique impeccable. Le but est le gainage sous fatigue, pas le chrono."}`},
  ]};

  const label=dl?"S1 — Deload · volume −50 %, découverte sandbag & GHD"
    :`S${n} — Bloc ${w.b} · ${b2?"Intensification":"Accumulation"} · ${w.m[0]}×${w.m[1]} à ${w.m[2].replace(".",",")} % · ${w.rir}${w.single?" · single RPE 8":""}`;

  return {label,days:[lundi,mardi,jeudi,samedi]};
};

export const PREPA_PL_PROG={
  id:"prepa_powerlifting_7s",
  name:"Prépa générale avant powerlifting — 7 sem.",
  category:"Powerlifting",
  level:"Intermédiaire / Avancé",
  weeks:WEEKS.map(week),
};
