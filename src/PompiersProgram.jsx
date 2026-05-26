import { useState, useCallback } from "react";

const G = {
  bg: "#080808", bg2: "#0f0f0f", bg3: "#161616", bg4: "#1c1c1c",
  gold: "#C9A84C", goldLight: "#E8C547",
  white: "#F5F0E8", grey: "#888", greyDim: "#444", border: "#2a2a2a",
  red: "#E05252", green: "#52C07A", blue: "#5281E0", purple: "#9B52E0",
  font: "'Barlow',sans-serif", fontD: "'Barlow Condensed',sans-serif",
};

const SENSATION_LABELS = ["", "Très dur 😰", "Dur 😤", "Correct 😐", "Bien 💪", "Excellent 🔥"];

// ─── DONNÉES ──────────────────────────────────────────────────────────────────

const SESSIONS_META = {
  foncier: { label: "Running Foncier", icon: "🏃", color: G.green, short: "FON" },
  ll:      { label: "Luc-Léger Spé",  icon: "⚡", color: G.gold,  short: "L-L" },
  salle:   { label: "Salle de Sport", icon: "🏋️", color: G.blue,  short: "SAL" },
  maison:  { label: "Séance Maison",  icon: "🏠", color: G.purple, short: "MAI" },
};

const PROGRAMME = [
  {
    num:1, label:"Semaine 1", theme:"Bilan Initial — Tests de Référence",
    conseil:"⚠️ Semaine de TESTS. Avant de prescrire des % de VMA ou de 1RM, il faut connaître ton niveau réel. Ces 4 séances sont tes données de départ — elles calibrent tout le reste du programme. Note tout.",
    foncier:{
      duree:"40 min", intensite:"Calibrage FCmax + footing", titre:"📋 TEST — Calibrage Zones Cardio",
      description:"Deux objectifs : estimer ta FC max sur le terrain, puis ancrer ta zone foncière (65-68% FCmax). Ces données calibrent toutes les séances running du programme.",
      plan:[
        {phase:"Échauffement",duree:"10 min",detail:"5 min marche rapide + 5 min footing très léger"},
        {phase:"Test FC max (progression)",duree:"8 min",detail:"Augmente l'allure toutes les 2 min : 70% → 80% → 90% → effort quasi-maximal 2 min. Note la FC la plus haute atteinte = ta FCmax de référence."},
        {phase:"Récupération",duree:"5 min",detail:"Trot très léger jusqu'au retour à < 120 bpm"},
        {phase:"Footing foncier",duree:"12 min",detail:"@ 65-68% FCmax — allure conversationnelle. Calibre l'allure qui correspond à cette zone."},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements mollets, ischio, quadriceps"},
      ],
      conseil_seance:"Note : (1) ta FCmax mesurée, (2) le pace (min/km) qui correspond à 65-68% FCmax. Ces deux valeurs seront tes références pour tout le programme.",
    },
    ll:{
      duree:"40 min", intensite:"Test max", titre:"🎯 TEST — Luc-Léger Baseline",
      description:"Premier test Luc-Léger complet depuis le niveau 1. Objectif : connaître ton niveau de départ ET estimer ta VMA (niveau × 0,5 ≈ VMA en km/h). Ces données calibrent toutes les séances LL.",
      plan:[
        {phase:"Échauffement",duree:"15 min",detail:"Footing léger + mobilité chevilles + 4 accélérations progressives sur 20m"},
        {phase:"🎯 TEST LUC-LÉGER",duree:"Jusqu'à épuisement",detail:"Depuis le niveau 1 jusqu'au max. Stop quand tu manques 2 lignes consécutives. App : 'Beep Test' ou 'Navette Test'."},
        {phase:"Récupération active",duree:"5 min",detail:"Trot très lent — ne t'assieds pas immédiatement"},
        {phase:"Retour au calme",duree:"10 min",detail:"Marche longue + étirements complets"},
      ],
      conseil_seance:"Note le niveau ET la palette atteints. Calcul VMA : niveau atteint × 0,5 = VMA approx. (ex: niveau 12 → VMA ~12 km/h). Cette VMA calibre tous les % VMA des séances suivantes.",
    },
    salle:{
      duree:"70–75 min", intensite:"Estimation 1RM + technique", titre:"📋 TEST — Estimation 1RM & Technique",
      description:"Deux objectifs : estimer ton 1RM sur les 3 grands mouvements (squat, bench, SDT) ET valider la technique. Ces charges calibrent tous les % 1RM du programme.",
      echauffement:"10 min vélo léger + mobilité hanches (cercles), épaules (rotation bras), poignets (10 reps chaque sens)",
      exercices:[
        {nom:"Squat Barre — Estimation 1RM",series:"4",reps:"Progressif",repos:"3 min",charge:"Montée progressive",note:"S1 : 10 reps léger → S2 : 8 reps → S3 : 5 reps → S4 : 3 reps. La charge à 3 reps × 1,08 ≈ 1RM. Note le résultat."},
        {nom:"Soulevé de Terre — Estimation 1RM",series:"4",reps:"Progressif",repos:"3 min",charge:"Montée progressive",note:"Même protocole que le squat. Priorité : technique impeccable avant d'augmenter la charge."},
        {nom:"Développé Couché Barre — Estimation 1RM",series:"4",reps:"Progressif",repos:"2–3 min",charge:"Montée progressive",note:"Même protocole. Note ton 1RM estimé."},
        {nom:"Rowing Barre",series:"3",reps:"12",repos:"90 s",charge:"Léger–Moyen (technique)",note:"Dos parallèle au sol, tirer coudes en arrière — pas de coup de rein. Trouve ta charge de travail."},
        {nom:"Développé Militaire Barre",series:"3",reps:"12",repos:"90 s",charge:"Léger–Moyen (technique)",note:"Core verrouillé, extension complète sans hyperextension lombaire."},
        {nom:"Gainage Planche",series:"3",reps:"Max secondes",repos:"60 s",charge:"Poids de corps",note:"Note ta durée max — référentiel de départ gainage."},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"📋 TEST — Tractions & Pompes Max",
      description:"Tes scores de départ en tractions et pompes. Note chaque série : ce sont tes références pour mesurer la progression sur 8 semaines.",
      blocs:[
        {titre:"BLOC 1 — TEST TRACTIONS",exercices:[
          {nom:"Tractions (prise pronation) — MAX",series:"5",detail:"Max reps absolu / repos 2 min",note:"Note chaque série. Total des 5 séries = ton score de départ."},
        ]},
        {titre:"BLOC 2 — TEST POMPES",exercices:[
          {nom:"Pompes classiques — MAX",series:"4",detail:"Max reps absolu / repos 60 s",note:"Note chaque série. Corps gainé, amplitude complète — pas de triche."},
        ]},
        {titre:"BLOC 3 — TEST JAMBES",exercices:[
          {nom:"Squats poids de corps — Max en 2 min",series:"1",detail:"Autant de reps que possible en 2 min / tempo 2-0-2",note:"Note le nombre total"},
        ]},
      ],
    },
  },
  {
    num:2, label:"Semaine 2", theme:"Construction — Volume & Technique",
    conseil:"Deuxième semaine : tu confirmes la technique en salle et le volume running monte. En running, tu dois te sentir maître de ton effort — si tu souffles trop, ralentis.",
    foncier:{
      duree:"45 min", intensite:"66–68% FCmax + accélérations", titre:"Footing + 6 Accélérations",
      description:"5 minutes de plus + 6 accélérations progressives pour habituer le corps à changer de régime.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche rapide + mobilité"},
        {phase:"Footing continu",duree:"25 min",detail:"@ 66-68% FCmax"},
        {phase:"6 accélérations",duree:"8 min",detail:"6 × 40s à 75% FCmax, récup 60s trot entre chaque"},
        {phase:"Retour au calme",duree:"7 min",detail:"Footing très léger + marche + étirements"},
      ],
      conseil_seance:"Les accélérations se font sur terrain plat. Pas un sprint — un changement de régime nettement ressenti.",
    },
    ll:{
      duree:"42 min", intensite:"93% VMA", titre:"30/30 Volume + Résistance",
      description:"15×30/30 + 2 séries de 4 min pour travailler la résistance à l'effort prolongé.",
      plan:[
        {phase:"Échauffement",duree:"10 min",detail:"Footing + 5 accélérations 20m"},
        {phase:"15 × 30\"/30\"",duree:"15 min",detail:"15 répétitions à 93% VMA / 30s récup active"},
        {phase:"Récup",duree:"3 min",detail:"Trot léger"},
        {phase:"2 × 4 min @ 88% VMA",duree:"12 min",detail:"Récup 2 min trot entre les séries"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements"},
      ],
      conseil_seance:"Les 4 min doivent être inconfortables mais gérées. Rythme stable du début à la fin.",
    },
    salle:{
      duree:"65–70 min", intensite:"67–70% 1RM", titre:"Force de Base — Montée Légère",
      description:"Mêmes exercices que S1, légère hausse des charges. Tu commences à sentir les mouvements.",
      echauffement:"10 min vélo + mobilité + 2 séries légères sur squat et SDT",
      exercices:[
        {nom:"Squat Barre",series:"3",reps:"12",repos:"2 min",charge:"67% 1RM",note:"Tempo descente 3s — sens les quadriceps travailler"},
        {nom:"Soulevé de Terre",series:"3",reps:"10",repos:"2 min",charge:"63% 1RM",note:"Dead stop entre chaque rep — ne laisse pas le dos s'arrondir"},
        {nom:"Développé Couché Barre",series:"3",reps:"12",repos:"90 s",charge:"67% 1RM",note:""},
        {nom:"Rowing Barre",series:"3",reps:"12",repos:"90 s",charge:"63% 1RM",note:""},
        {nom:"Développé Militaire Barre",series:"3",reps:"12",repos:"90 s",charge:"63% 1RM",note:""},
        {nom:"Bulgarian Split Squat Haltères",series:"3",reps:"10/jambe",repos:"90 s",charge:"Léger",note:"Pied arrière surélevé, genou avant dans l'axe"},
        {nom:"Gainage Planche",series:"3",reps:"45 s",repos:"45 s",charge:"Poids de corps",note:""},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Tractions & Pompes — +1 Série",
      description:"Une série de plus sur les tractions. Note et compare avec S1.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS",exercices:[
          {nom:"Tractions (prise pronation)",series:"6",detail:"Max reps / repos 2 min",note:"Compare série par série avec S1"},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes classiques",series:"4",detail:"22 reps / repos 60 s",note:""},
        ]},
        {titre:"BLOC 3 — JAMBES",exercices:[
          {nom:"Fentes Marchées Haltères",series:"3",detail:"15/jambe — haltères légers à moyens",note:""},
        ]},
      ],
    },
  },
  {
    num:3, label:"Semaine 3", theme:"Développement — Résistance",
    conseil:"La fatigue s'installe. Dors 8h, hydrate-toi, mange des protéines. La progression se construit dans la récupération, pas dans la séance.",
    foncier:{
      duree:"50 min", intensite:"66–68% FCmax", titre:"Footing Long",
      description:"50 minutes à allure aisée. Le volume augmente pour ancrer ta base aérobie.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche + mobilité"},
        {phase:"Footing continu",duree:"40 min",detail:"@ 66-68% FCmax — allure stable et maîtrisée"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements quadriceps, ischio, mollets, fléchisseurs de hanche"},
      ],
      conseil_seance:"40 minutes à allure aisée : ne démarre pas trop vite. Les 10 dernières minutes ne doivent pas être en mode survie.",
    },
    ll:{
      duree:"45 min", intensite:"90–95% VMA", titre:"Navettes 20m + Intervalles 3 min",
      description:"Premier contact avec les navettes de 20m (format exact du test) + intervalles longue durée.",
      plan:[
        {phase:"Échauffement",duree:"10 min",detail:"Footing progressif + 4 accélérations sur 20m"},
        {phase:"Navettes 20m — Niv 7–9",duree:"~8 min",detail:"Simulation Luc-Léger audio niveaux 7 à 9 — calibre l'oreille et les demi-tours"},
        {phase:"Récup",duree:"3 min",detail:"Marche active"},
        {phase:"4 × 3 min @ 90-95% VMA",duree:"16 min",detail:"Récup 2 min trot lent entre chaque"},
        {phase:"Retour au calme",duree:"8 min",detail:"Trot très lent + marche + étirements"},
      ],
      conseil_seance:"Les demi-tours en navettes doivent être propres et rapides. Pivot sur l'avant-pied, pas en dérapage.",
    },
    salle:{
      duree:"70 min", intensite:"70–73% 1RM", titre:"Progression — 4 Séries",
      description:"Passage à 4 séries sur les mouvements principaux. Charges en hausse, qualité maintenue.",
      echauffement:"10 min vélo + mobilité + 2 séries légères",
      exercices:[
        {nom:"Squat Barre",series:"4",reps:"10",repos:"2 min",charge:"70% 1RM",note:"Descente 3s, explosion en montée"},
        {nom:"Soulevé de Terre",series:"3",reps:"8",repos:"2–3 min",charge:"67% 1RM",note:"Phase excentrique contrôlée — 2s de descente"},
        {nom:"Développé Couché Barre",series:"4",reps:"10",repos:"90 s",charge:"70% 1RM",note:""},
        {nom:"Rowing Barre",series:"4",reps:"10",repos:"90 s",charge:"67% 1RM",note:"Serrer les omoplates en fin de mouvement"},
        {nom:"Développé Militaire Barre",series:"3",reps:"10",repos:"90 s",charge:"67% 1RM",note:""},
        {nom:"Tractions",series:"3",reps:"Max",repos:"2 min",charge:"Poids de corps",note:"Pleine amplitude — menton au-dessus de la barre"},
        {nom:"Gainage Planche + Élévation jambe",series:"3",reps:"30 s",repos:"45 s",charge:"Poids de corps",note:"Alterne jambe droite/gauche pendant le gainage"},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Variations Tractions & Pompes",
      description:"Variantes pour toucher plus de faisceaux. Ajout des tractions négatives.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS",exercices:[
          {nom:"Tractions (prise pronation)",series:"4",detail:"Max reps / repos 2 min",note:""},
          {nom:"Tractions Négatives (descente 5s)",series:"2",detail:"4–5 reps / repos 2 min",note:"Monte avec aide ou élan, descends seul lentement"},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes Diamant",series:"3",detail:"12 reps / repos 60 s",note:"Triceps + faisceau interne pectoraux"},
          {nom:"Pompes Larges",series:"3",detail:"15 reps / repos 60 s",note:"Faisceau externe"},
        ]},
        {titre:"BLOC 3 — JAMBES",exercices:[
          {nom:"Squats Haltères",series:"3",detail:"20 reps",note:""},
        ]},
      ],
    },
  },
  {
    num:4, label:"Semaine 4", theme:"Spécifique — Simulation Navettes",
    conseil:"Semaine charnière : première simulation Luc-Léger depuis le niveau 8. Note ton niveau — tu as encore 4 semaines pour progresser.",
    foncier:{
      duree:"50 min", intensite:"65% + fartlek 4×3 min @ 75%", titre:"Footing + Fartlek",
      description:"Fartlek intégré : accélérations naturelles au milieu du footing pour habituer le corps aux changements de régime.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche rapide + petites foulées"},
        {phase:"Footing facile",duree:"15 min",detail:"@ 65% FCmax"},
        {phase:"Fartlek 4×3 min",duree:"18 min",detail:"3 min à 75% FCmax / 90s récup trot — répéter 4 fois"},
        {phase:"Footing facile",duree:"7 min",detail:"@ 65% FCmax — retour progressif"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements"},
      ],
      conseil_seance:"Utilise un repère naturel (côte, distance) plutôt qu'un chrono strict pour les accélérations.",
    },
    ll:{
      duree:"42 min", intensite:"Navettes 20m + 95% VMA", titre:"🎯 Simulation Navettes Luc-Léger Niv 8–12",
      description:"Simulation en conditions réelles. Oreille calibrée sur le bip, corps habitué aux demi-tours rapides.",
      plan:[
        {phase:"Échauffement",duree:"10 min",detail:"Footing + mobilité chevilles + 4 accélérations 20m"},
        {phase:"Navettes 20m — Niv 8 à 12",duree:"~18 min",detail:"Simulation depuis le niveau 8 — monte jusqu'à épuisement ou niveau 12. Repos 3 min."},
        {phase:"3 × 2 min @ 95% VMA",duree:"10 min",detail:"Récup 90s trot entre les séries"},
        {phase:"Retour au calme",duree:"7 min",detail:"Marche + étirements"},
      ],
      conseil_seance:"App recommandée : 'Beep Test' ou 'Navette Test'. Note le niveau ET la palette atteints.",
    },
    salle:{
      duree:"70 min", intensite:"73–76% 1RM", titre:"Force — Consolidation + Incliné",
      description:"Introduction du développé incliné. Charges en hausse sur tous les mouvements.",
      echauffement:"10 min vélo + mobilité",
      exercices:[
        {nom:"Squat Barre",series:"4",reps:"10",repos:"2 min",charge:"73% 1RM",note:""},
        {nom:"Soulevé de Terre",series:"4",reps:"8",repos:"2–3 min",charge:"70% 1RM",note:""},
        {nom:"Développé Couché Incliné Barre",series:"4",reps:"10",repos:"2 min",charge:"68% 1RM",note:"Inclinaison 30-45° — cible le faisceau supérieur des pectoraux"},
        {nom:"Rowing Barre",series:"4",reps:"10",repos:"90 s",charge:"70% 1RM",note:""},
        {nom:"Développé Militaire Barre",series:"4",reps:"10",repos:"90 s",charge:"70% 1RM",note:""},
        {nom:"Tractions",series:"4",reps:"Max",repos:"2 min",charge:"Poids de corps",note:"Pleine amplitude obligatoire"},
        {nom:"Bulgarian Split Squat Haltères",series:"3",reps:"10/jambe",repos:"90 s",charge:"Léger–Moyen",note:""},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Chin-Ups + Pompes Volume",
      description:"Passage aux chin-ups (prise supination) pour cibler biceps et dos moyen différemment. Volume pompes augmenté.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS",exercices:[
          {nom:"Chin-Ups (prise serrée supination)",series:"4",detail:"Max reps / repos 2 min",note:"Paumes vers soi — plus de biceps, dos moyen ciblé"},
          {nom:"Tractions (prise pronation)",series:"2",detail:"Max reps / repos 90 s",note:""},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes classiques",series:"5",detail:"Max reps (objectif >20) / repos 60 s",note:""},
        ]},
        {titre:"BLOC 3 — JAMBES",exercices:[
          {nom:"Fentes Marchées Haltères",series:"3",detail:"18/jambe — haltères moyens",note:""},
        ]},
      ],
    },
  },
  {
    num:5, label:"Semaine 5", theme:"Intensité — Phase Haute",
    conseil:"Semaine la plus difficile jusqu'ici. Si la fatigue est excessive, insère un jour de récup. Priorité : sommeil et nutrition.",
    foncier:{
      duree:"55 min", intensite:"67% FCmax", titre:"Semi-Continu Long",
      description:"Alternance course/marche — développe l'endurance spécifique aux efforts prolongés.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche + mobilité"},
        {phase:"Bloc ×4 : 11 min course + 2 min marche",duree:"52 min",detail:"11 min @ 67% FCmax puis 2 min marche active — répéter 4 fois"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements"},
      ],
      conseil_seance:"Les phases de marche sont une récup active — reste en mouvement.",
    },
    ll:{
      duree:"42 min", intensite:"95–100% VMA", titre:"Intervalles 3 min — Haute Intensité",
      description:"7 séries avec récup réduite à 90s. Séance clé pour le seuil lactique et la capacité spécifique Luc-Léger.",
      plan:[
        {phase:"Échauffement",duree:"12 min",detail:"Footing progressif + drills + 5 accélérations sur 20m"},
        {phase:"7 × 3 min @ 95-100% VMA",duree:"24 min",detail:"Récup 90s trot lent entre chaque"},
        {phase:"Retour au calme",duree:"8 min",detail:"Trot très lent + marche"},
      ],
      conseil_seance:"90s de récup va sembler court dès la 4e série. C'est voulu — le Luc-Léger ne laisse pas de répit.",
    },
    salle:{
      duree:"70–75 min", intensite:"76–80% 1RM + Explosivité", titre:"Force + Explosivité — Box Jump",
      description:"Charges lourdes + box jumps pour la puissance explosive des membres inférieurs, essentielle pour le Luc-Léger.",
      echauffement:"10 min vélo + mobilité + activation (3×5 squat sauté très léger)",
      exercices:[
        {nom:"Squat Barre",series:"4",reps:"8",repos:"2–3 min",charge:"76-78% 1RM",note:"Descente 3s, explosion maximale en montée"},
        {nom:"Soulevé de Terre",series:"4",reps:"6",repos:"3 min",charge:"76% 1RM",note:"Stop si forme compromise — sécurité avant tout"},
        {nom:"Développé Couché Barre",series:"4",reps:"8",repos:"2–3 min",charge:"76% 1RM",note:""},
        {nom:"Box Jump",series:"4",reps:"5",repos:"2 min",charge:"Max hauteur maîtrisée",note:"Réception souple et silencieuse, hanche bien rétractée"},
        {nom:"Rowing Barre",series:"4",reps:"8",repos:"2 min",charge:"73% 1RM",note:""},
        {nom:"Développé Militaire Barre",series:"3",reps:"8",repos:"2 min",charge:"72% 1RM",note:""},
        {nom:"Tractions Lestées",series:"3",reps:"6",repos:"2 min",charge:"+5–10 kg",note:"Haltère entre les jambes. Si impossible : Max non-lestées"},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Tractions Lestées + Pompes Explosives",
      description:"Introduction aux tractions lestées et pompes explosives pour développer la puissance spécifique.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS",exercices:[
          {nom:"Tractions Lestées (haltère entre jambes)",series:"4",detail:"6–8 reps / repos 2–3 min",note:"+5 à +10 kg selon niveau"},
          {nom:"Tractions (non-lestées)",series:"2",detail:"Max reps / repos 90 s",note:""},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes Explosives (clap ou impulsion)",series:"3",detail:"8–10 reps / repos 90 s",note:"Décolle les mains du sol à chaque rep"},
          {nom:"Pompes classiques",series:"3",detail:"Max reps / repos 60 s",note:""},
        ]},
        {titre:"BLOC 3 — JAMBES",exercices:[
          {nom:"Squats Haltères + Calf Raise",series:"3",detail:"15 reps / squat + montée sur pointe en haut",note:""},
        ]},
      ],
    },
  },
  {
    num:6, label:"Semaine 6", theme:"Pic de Charge — Test Blanc",
    conseil:"Semaine de test blanc. Note ton niveau Luc-Léger — tu as encore 2 semaines pour progresser. Charge maximale en salle.",
    foncier:{
      duree:"50 min", intensite:"65–70% FCmax (négatif splits)", titre:"Footing Négatif Splits",
      description:"La 2ème moitié plus rapide que la 1ère — excellent travail de gestion de l'effort et de la lucidité.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche + petites foulées"},
        {phase:"1ère moitié",duree:"20 min",detail:"@ 65% FCmax — allure très confortable"},
        {phase:"2ème moitié",duree:"20 min",detail:"@ 68-70% FCmax — légèrement plus rapide, maintenu"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements complets"},
      ],
      conseil_seance:"La 2ème moitié n'est pas un sprint — une accélération progressive et soutenue sur 20 min.",
    },
    ll:{
      duree:"45 min", intensite:"Test max", titre:"🎯 SIMULATION COMPLÈTE LUC-LÉGER",
      description:"Test blanc complet depuis le niveau 1 jusqu'à épuisement. Note ton niveau ET ta palette.",
      plan:[
        {phase:"Échauffement",duree:"15 min",detail:"Footing léger + mobilité + 5 accélérations progressives sur 20m"},
        {phase:"🎯 SIMULATION LUC-LÉGER",duree:"Jusqu'à épuisement",detail:"Depuis le niveau 1 jusqu'au max. Stop quand tu manques 2 lignes consécutives."},
        {phase:"Récupération active",duree:"5 min",detail:"Trot très lent — ne t'assieds pas immédiatement"},
        {phase:"Retour au calme",duree:"10 min",detail:"Marche longue + étirements complets"},
      ],
      conseil_seance:"Ce résultat est ta référence à comparer avec le test final. Note le niveau ET la palette.",
    },
    salle:{
      duree:"75 min", intensite:"80–82% 1RM", titre:"Force — Charge Maximale",
      description:"Charge maximale de tout le programme en salle.",
      echauffement:"12 min vélo + mobilité + 3 séries montées progressives",
      exercices:[
        {nom:"Squat Barre",series:"4",reps:"8",repos:"3 min",charge:"80-82% 1RM",note:""},
        {nom:"Soulevé de Terre",series:"4",reps:"6",repos:"3 min",charge:"80% 1RM",note:""},
        {nom:"Développé Couché Barre",series:"4",reps:"8",repos:"3 min",charge:"80% 1RM",note:""},
        {nom:"Box Jump",series:"3",reps:"5",repos:"2 min",charge:"Max hauteur",note:"Explosivité maximale — réception parfaite"},
        {nom:"Rowing Barre",series:"4",reps:"8",repos:"2 min",charge:"76% 1RM",note:""},
        {nom:"Tractions Lestées",series:"3",reps:"6",repos:"2–3 min",charge:"+10 à +15 kg",note:""},
        {nom:"Développé Militaire Barre",series:"3",reps:"8",repos:"2 min",charge:"75% 1RM",note:""},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Pyramide Tractions + Circuit Jambes",
      description:"Méthode pyramide descendante-montante pour maximiser le recrutement musculaire.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS (PYRAMIDE)",exercices:[
          {nom:"Pyramide Tractions",series:"5",detail:"Max → Max−2 → Max−4 → Max−2 → Max / repos 2 min",note:"Ex si Max=12 : 12-10-8-10-12"},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes classiques",series:"4",detail:"Max reps / repos 60 s",note:""},
          {nom:"Pompes Serrées",series:"2",detail:"20 reps / repos 45 s",note:""},
        ]},
        {titre:"BLOC 3 — CIRCUIT JAMBES",exercices:[
          {nom:"Circuit ×3 tours",series:"3",detail:"20 squats + 10 fentes/jambe + 15 calf raise — récup 60s entre tours",note:""},
        ]},
      ],
    },
  },
  {
    num:7, label:"Semaine 7", theme:"Force Maximale — Pic",
    conseil:"Semaine la plus intense du programme. Après ça, tu affûtes. Donne tout en salle et en running.",
    foncier:{
      duree:"45 min", intensite:"65-67% + 6×100m côtes", titre:"Footing + Côtes",
      description:"Les côtes développent la puissance spécifique et renforcent les membres inférieurs de manière fonctionnelle.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche + foulées progressives"},
        {phase:"Footing",duree:"22 min",detail:"@ 65-67% FCmax"},
        {phase:"6 × 100m de côte",duree:"12 min",detail:"6 montées à 85% effort, récup descente marchée"},
        {phase:"Retour au calme",duree:"8 min",detail:"Trot léger + marche + étirements quadriceps, mollets"},
      ],
      conseil_seance:"Pas de côte ? Remplace par 6×200m plat à 85-87% d'effort.",
    },
    ll:{
      duree:"38 min", intensite:"100–105% VMA", titre:"Sur-Vitesse — 8×2 min",
      description:"On travaille au-dessus de la VMA. La récup courte (1 min) est le défi principal. Séance de pic avant le deload.",
      plan:[
        {phase:"Échauffement",duree:"12 min",detail:"Footing progressif + drills + 5 accélérations 20m"},
        {phase:"8 × 2 min @ 100-105% VMA",duree:"22 min",detail:"Récup 1 min trot entre chaque"},
        {phase:"Retour au calme",duree:"8 min",detail:"Marche + respiration profonde + étirements"},
      ],
      conseil_seance:"Si tu ne tiens pas 105%, reste à 100% plutôt que de t'arrêter — la continuité prime.",
    },
    salle:{
      duree:"75–80 min", intensite:"82–85% 1RM — 5×5", titre:"Force Maximale — 5×5",
      description:"Protocole 5×5 : le plus efficace pour maximiser la force. Qualité irréprochable, échauffement minutieux.",
      echauffement:"12 min vélo + mobilité approfondie + 3 séries montées progressives sur squat et SDT",
      exercices:[
        {nom:"Squat Barre",series:"5",reps:"5",repos:"3 min",charge:"82-85% 1RM",note:"Pareur conseillé — échauffement minutieux obligatoire"},
        {nom:"Soulevé de Terre",series:"4",reps:"5",repos:"3–4 min",charge:"82-85% 1RM",note:"Dead stop entre chaque rep"},
        {nom:"Développé Couché Barre",series:"5",reps:"5",repos:"3 min",charge:"82-85% 1RM",note:"Pareur recommandé"},
        {nom:"Rowing Barre",series:"4",reps:"6",repos:"2–3 min",charge:"78% 1RM",note:""},
        {nom:"Développé Militaire Barre",series:"3",reps:"6",repos:"2–3 min",charge:"75% 1RM",note:""},
        {nom:"Box Jump",series:"3",reps:"5",repos:"2 min",charge:"Explosivité maximale",note:""},
      ],
    },
    maison:{
      duree:"< 30 min", materiel:"Barre + 2 haltères", titre:"Test Personnel — Mesure la Progression",
      description:"Comparaison directe avec S1. Mesure ta progression exacte depuis le début du programme.",
      blocs:[
        {titre:"BLOC 1 — TEST TRACTIONS",exercices:[
          {nom:"Tractions (prise pronation) — 6 séries",series:"6",detail:"Max reps / repos 90 s",note:"Note chaque série. Compare avec S1."},
        ]},
        {titre:"BLOC 2 — TEST POMPES",exercices:[
          {nom:"Pompes — 5 séries",series:"5",detail:"Max reps / repos 60 s",note:"Note chaque série"},
        ]},
        {titre:"BLOC 3 — EXPLOSIVITÉ",exercices:[
          {nom:"Fentes Sautées (jumping lunges)",series:"4",detail:"12 reps / repos 90 s",note:"Réception souple — attention aux genoux"},
        ]},
      ],
    },
  },
  {
    num:8, label:"Semaine 8", theme:"Affûtage — Prêt pour le Test",
    conseil:"Tu ne construis plus rien. Tu affûtes. Volume −30%, intensités maintenues. Récupère, dors, mange bien. Arrive frais et confiant au test.",
    foncier:{
      duree:"25 min", intensite:"55–60% FCmax", titre:"Footing de Récupération",
      description:"Très léger — maintenir les jambes actives sans les fatiguer avant le test.",
      plan:[
        {phase:"Échauffement",duree:"5 min",detail:"Marche rapide"},
        {phase:"Footing très léger",duree:"15 min",detail:"@ 55-60% FCmax — comme une promenade trottinée"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + étirements complets mollets, ischio, quadri, hanches"},
      ],
      conseil_seance:"Visualise mentalement le test pendant ce footing. Chaque navette, chaque demi-tour.",
    },
    ll:{
      duree:"25 min", intensite:"90–95% VMA", titre:"Rappel Luc-Léger — Volume Réduit",
      description:"On rappelle au corps le format sans se vider. Dernière séance running avant le test.",
      plan:[
        {phase:"Échauffement",duree:"10 min",detail:"Footing léger + 4 accélérations sur 20m"},
        {phase:"Navettes légères 20m",duree:"5 min",detail:"Allure modérée niveaux 7-8 — retrouve les sensations sans forcer"},
        {phase:"3 × 1 min @ 90-95% VMA",duree:"7 min",detail:"Récup complète 2 min entre chaque"},
        {phase:"Retour au calme",duree:"5 min",detail:"Marche + respiration"},
      ],
      conseil_seance:"Ne cherche pas à battre des records. Tu prépares ton corps — tu ne le testes pas.",
    },
    salle:{
      duree:"50 min", intensite:"62–65% 1RM — Deload", titre:"Deload — Entretien Sans Fatigue",
      description:"Volume −30%, charges −20% vs pic. Entretien musculaire sans créer de fatigue.",
      echauffement:"8 min vélo + mobilité",
      exercices:[
        {nom:"Squat Barre",series:"3",reps:"8",repos:"2 min",charge:"62% 1RM",note:"Technique parfaite, confort total"},
        {nom:"Soulevé de Terre",series:"3",reps:"6",repos:"2 min",charge:"60% 1RM",note:""},
        {nom:"Développé Couché Barre",series:"3",reps:"8",repos:"2 min",charge:"62% 1RM",note:""},
        {nom:"Rowing Barre",series:"3",reps:"8",repos:"90 s",charge:"58% 1RM",note:""},
        {nom:"Développé Militaire Barre",series:"3",reps:"8",repos:"90 s",charge:"58% 1RM",note:""},
      ],
    },
    maison:{
      duree:"< 20 min", materiel:"Barre + 2 haltères", titre:"Maintenance Légère — Pré-Test",
      description:"Séance courte et sous le maximum. Entretien uniquement.",
      blocs:[
        {titre:"BLOC 1 — TRACTIONS",exercices:[
          {nom:"Tractions (prise pronation)",series:"4",detail:"8 reps (sous le max) / repos 2 min",note:"Qualité uniquement — pas de forçage"},
        ]},
        {titre:"BLOC 2 — POMPES",exercices:[
          {nom:"Pompes classiques",series:"4",detail:"15 reps / repos 60 s",note:"Qualité avant quantité"},
        ]},
        {titre:"BLOC 3 — JAMBES",exercices:[
          {nom:"Squats Haltères",series:"3",detail:"15 reps — charges légères",note:""},
        ]},
      ],
    },
  },
];

// ─── UTILITAIRES ──────────────────────────────────────────────────────────────

const logKey = (weekNum, type) => `pompiers_${weekNum}_${type}`;

const loadLogs = (key = "pompiers_logs") => {
  try { return JSON.parse(localStorage.getItem(key) || "{}"); }
  catch { return {}; }
};

const saveLogs = (logs, key = "pompiers_logs") => {
  localStorage.setItem(key, JSON.stringify(logs));
};

const mkSalleLog = (exercices) =>
  exercices.map(ex => ({ nom: ex.nom, charge: "", sensation: 0, notes: "" }));

const mkMaisonLog = (blocs) =>
  blocs.flatMap(b => b.exercices.map(ex => ({ nom: ex.nom, series: ex.series, reps: Array(parseInt(ex.series)||4).fill(""), notes: "" })));

// ─── COMPOSANT PRINCIPAL ──────────────────────────────────────────────────────

export default function PompiersProgram({ onBack, clientId }) {
  const storageKey = clientId ? `pompiers_logs_${clientId}` : "pompiers_logs";
  const [semaine, setSemaine] = useState(0);
  const [onglet, setOnglet] = useState("foncier");
  const [logs, setLogs] = useState(() => loadLogs(storageKey));
  const [modal, setModal] = useState(null); // null | { type, weekNum, draft }
  const [viewLog, setViewLog] = useState(null); // null | { type, weekNum }

  const W = PROGRAMME[semaine];

  const getLog = (weekNum, type) => logs[logKey(weekNum, type)] || null;

  const openLog = useCallback((type) => {
    const existing = getLog(W.num, type);
    let draft;
    if (type === "foncier" || type === "ll") {
      draft = existing || { dureeReelle: "", sensation: 0, niveauAtteint: "", notes: "", done: false };
    } else if (type === "salle") {
      draft = existing || { sensation: 0, notes: "", done: false, exercices: mkSalleLog(W.salle.exercices) };
    } else {
      draft = existing || { sensation: 0, notes: "", done: false, exercices: mkMaisonLog(W.maison.blocs) };
    }
    setModal({ type, weekNum: W.num, draft: JSON.parse(JSON.stringify(draft)) });
  }, [W, logs]);

  const saveLog = useCallback(() => {
    if (!modal) return;
    const k = logKey(modal.weekNum, modal.type);
    const updated = { ...logs, [k]: { ...modal.draft, date: new Date().toISOString().split("T")[0], done: true } };
    setLogs(updated);
    saveLogs(updated, storageKey);
    setModal(null);
  }, [modal, logs, storageKey]);

  const updateDraft = (patch) => setModal(m => ({ ...m, draft: { ...m.draft, ...patch } }));

  const onglets = [
    { key: "foncier", ...SESSIONS_META.foncier },
    { key: "ll",     ...SESSIONS_META.ll     },
    { key: "salle",  ...SESSIONS_META.salle  },
    { key: "maison", ...SESSIONS_META.maison },
  ];

  const currentMeta = SESSIONS_META[onglet];

  return (
    <div style={{ background: G.bg, minHeight: "100vh", fontFamily: G.font, color: G.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:0;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .25s ease both;}
        input,textarea,select{font-family:'Barlow',sans-serif;}
        .ex-row:nth-child(even){background:#111;}
      `}</style>

      {/* HEADER */}
      <div style={{ background: G.bg2, borderBottom: `1px solid ${G.border}`, padding: "16px 16px 14px" }}>
        {onBack && (
          <button onClick={onBack} style={{ background:"none", border:"none", color:G.grey, fontFamily:G.font, fontSize:13, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            ← Retour
          </button>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:32 }}>🚒</span>
          <div>
            <div style={{ fontFamily:G.fontD, fontSize:22, fontWeight:800, color:G.goldLight, letterSpacing:1, lineHeight:1.1 }}>PROGRAMME POMPIERS PROS</div>
            <div style={{ color:G.grey, fontSize:12, marginTop:3 }}>8 Semaines · Luc-Léger · Force · Endurance</div>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginTop:12 }}>
          {[["📅","4 séances/sem."],["🎯","Luc-Léger"],["⏱","8 semaines"],["🏠","< 30 min maison"]].map(([icon,val])=>(
            <div key={val} style={{ background:G.bg3, borderRadius:8, padding:"8px 4px", textAlign:"center" }}>
              <div style={{ fontSize:16 }}>{icon}</div>
              <div style={{ fontSize:10, color:G.grey, marginTop:3, lineHeight:1.3 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SÉLECTEUR SEMAINES */}
      <div style={{ background:G.bg2, borderBottom:`1px solid ${G.border}`, padding:"10px 14px" }}>
        <div style={{ fontSize:10, color:G.grey, marginBottom:7, textTransform:"uppercase", letterSpacing:1 }}>Semaine</div>
        <div style={{ display:"flex", gap:5, overflowX:"auto", paddingBottom:2 }}>
          {PROGRAMME.map((w, i) => {
            const active = i === semaine;
            const logged = ["foncier","ll","salle","maison"].filter(t => getLog(w.num, t)).length;
            return (
              <button key={i} onClick={()=>{ setSemaine(i); setOnglet("foncier"); }}
                style={{ flex:"0 0 auto", padding:"7px 10px", borderRadius:8,
                  border: active ? `2px solid ${G.gold}` : `1px solid ${G.border}`,
                  background: active ? G.gold : G.bg3,
                  color: active ? G.bg : G.white,
                  fontFamily:G.fontD, fontWeight:800, fontSize:12, cursor:"pointer",
                  minWidth:52, textAlign:"center", position:"relative" }}>
                S{i+1}
                {logged > 0 && (
                  <span style={{ position:"absolute", top:3, right:3, width:6, height:6, borderRadius:"50%", background: logged===4 ? G.green : G.gold }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* INFO SEMAINE */}
      <div className="fu" key={`w${semaine}`} style={{ padding:"12px 14px 0" }}>
        <div style={{ background:G.bg3, borderRadius:10, padding:"10px 12px", borderLeft:`3px solid ${G.gold}` }}>
          <div style={{ fontFamily:G.fontD, fontSize:17, fontWeight:800, color:G.goldLight }}>{W.label} — {W.theme}</div>
          <div style={{ color:G.grey, fontSize:12, marginTop:5, lineHeight:1.5 }}>{W.conseil}</div>
        </div>
      </div>

      {/* ONGLETS */}
      <div style={{ padding:"10px 14px 0" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:5 }}>
          {onglets.map(({ key, icon, color, short }) => {
            const active = onglet === key;
            const logged = getLog(W.num, key);
            return (
              <button key={key} onClick={()=>setOnglet(key)}
                style={{ padding:"9px 4px", borderRadius:8,
                  border: active ? `2px solid ${color}` : `1px solid ${G.border}`,
                  background: active ? color+"20" : G.bg3,
                  color: active ? color : G.grey,
                  fontFamily:G.font, fontWeight: active ? 700 : 500,
                  fontSize:11, cursor:"pointer", textAlign:"center", position:"relative" }}>
                <div style={{ fontSize:17 }}>{icon}</div>
                <div style={{ marginTop:3 }}>{short}</div>
                {logged && <span style={{ position:"absolute", top:4, right:4, width:6, height:6, borderRadius:"50%", background:G.green }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENU */}
      <div className="fu" key={`${semaine}-${onglet}`} style={{ padding:"12px 14px 100px" }}>

        {/* LOG EXISTANT */}
        {getLog(W.num, onglet) && (
          <div style={{ background:"#0a1a0a", border:`1px solid ${G.green}40`, borderRadius:10, padding:"10px 12px", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <span style={{ color:G.green, fontWeight:700, fontSize:12 }}>✓ Séance enregistrée</span>
              <span style={{ color:G.grey, fontSize:11, marginLeft:8 }}>{getLog(W.num, onglet).date}</span>
            </div>
            <button onClick={()=>openLog(onglet)} style={{ background:"none", border:`1px solid ${G.green}50`, color:G.green, borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer" }}>Modifier</button>
          </div>
        )}

        {/* ── RUNNING FONCIER ── */}
        {onglet==="foncier" && (
          <SessionCard color={G.green} icon="🏃" titre={W.foncier.titre} duree={W.foncier.duree} intensite={W.foncier.intensite}>
            <p style={{ color:G.grey, fontSize:13, lineHeight:1.6, marginBottom:12 }}>{W.foncier.description}</p>
            <PlanTable plan={W.foncier.plan} color={G.green} />
            {W.foncier.conseil_seance && <ConseilBox texte={W.foncier.conseil_seance} />}
          </SessionCard>
        )}

        {/* ── LUC-LÉGER ── */}
        {onglet==="ll" && (
          <SessionCard color={G.gold} icon="⚡" titre={W.ll.titre} duree={W.ll.duree} intensite={W.ll.intensite}>
            <p style={{ color:G.grey, fontSize:13, lineHeight:1.6, marginBottom:12 }}>{W.ll.description}</p>
            <PlanTable plan={W.ll.plan} color={G.gold} />
            {W.ll.conseil_seance && <ConseilBox texte={W.ll.conseil_seance} />}
          </SessionCard>
        )}

        {/* ── SALLE ── */}
        {onglet==="salle" && (
          <SessionCard color={G.blue} icon="🏋️" titre={W.salle.titre} duree={W.salle.duree} intensite={W.salle.intensite}>
            <div style={{ background:G.bg4, borderRadius:8, padding:"8px 10px", marginBottom:12, fontSize:12, color:G.grey }}>
              <span style={{ color:G.blue, fontWeight:600 }}>Échauffement : </span>{W.salle.echauffement}
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${G.border}` }}>
                    {["Exercice","Séries","Reps","Repos","Charge cible"].map(h=>(
                      <th key={h} style={{ padding:"6px 5px", textAlign:"left", color:G.grey, fontSize:10, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {W.salle.exercices.map((ex,i)=>(
                    <tr key={i} className="ex-row">
                      <td style={{ padding:"9px 5px" }}>
                        <div style={{ fontWeight:600, color:G.white }}>{ex.nom}</div>
                        {ex.note && <div style={{ fontSize:10, color:G.grey, marginTop:2, lineHeight:1.4 }}>{ex.note}</div>}
                      </td>
                      <td style={{ padding:"9px 5px", color:G.blue, fontWeight:700, fontFamily:G.fontD, fontSize:14 }}>{ex.series}</td>
                      <td style={{ padding:"9px 5px", color:G.goldLight, fontWeight:700 }}>{ex.reps}</td>
                      <td style={{ padding:"9px 5px", color:G.grey, fontSize:11 }}>{ex.repos}</td>
                      <td style={{ padding:"9px 5px", color:G.white, fontSize:11 }}>{ex.charge}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SessionCard>
        )}

        {/* ── MAISON ── */}
        {onglet==="maison" && (
          <SessionCard color={G.purple} icon="🏠" titre={W.maison.titre} duree={W.maison.duree} intensite={W.maison.materiel}>
            <p style={{ color:G.grey, fontSize:13, lineHeight:1.6, marginBottom:12 }}>{W.maison.description}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {W.maison.blocs.map((bloc,bi)=>(
                <div key={bi} style={{ background:G.bg3, borderRadius:10, overflow:"hidden" }}>
                  <div style={{ background:G.purple+"25", borderLeft:`3px solid ${G.purple}`, padding:"7px 10px", fontFamily:G.fontD, fontSize:12, fontWeight:700, color:G.purple }}>{bloc.titre}</div>
                  {bloc.exercices.map((ex,ei)=>(
                    <div key={ei} style={{ padding:"9px 12px", borderBottom: ei<bloc.exercices.length-1?`1px solid ${G.border}`:"none" }}>
                      <div style={{ fontWeight:600, color:G.white, marginBottom:3, fontSize:13 }}>{ex.nom}</div>
                      <div style={{ fontSize:11, color:G.goldLight }}>{ex.series} séries — {ex.detail}</div>
                      {ex.note && <div style={{ fontSize:11, color:G.grey, fontStyle:"italic", marginTop:2 }}>{ex.note}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </SessionCard>
        )}

        {/* BOUTON JOURNALISER */}
        <button onClick={()=>openLog(onglet)}
          style={{ width:"100%", marginTop:14, padding:"14px", borderRadius:12,
            background: getLog(W.num,onglet) ? G.green+"22" : `linear-gradient(135deg,${currentMeta.color}22,${currentMeta.color}11)`,
            border:`1px solid ${currentMeta.color}50`,
            color: currentMeta.color, fontFamily:G.font, fontWeight:700, fontSize:14,
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {getLog(W.num,onglet) ? "✏️ Modifier mon journal" : `📝 Journaliser cette séance`}
        </button>
      </div>

      {/* ── MODAL JOURNAL ── */}
      {modal && (
        <LogModal
          modal={modal}
          W={W}
          onClose={()=>setModal(null)}
          onSave={saveLog}
          updateDraft={updateDraft}
          setModal={setModal}
        />
      )}
    </div>
  );
}

// ─── MODAL JOURNAL ────────────────────────────────────────────────────────────

function LogModal({ modal, W, onClose, onSave, updateDraft, setModal }) {
  const { type, draft } = modal;
  const meta = SESSIONS_META[type];
  const isRunning = type === "foncier" || type === "ll";
  const isLL = type === "ll";
  const isSalle = type === "salle";

  const updateEx = (i, patch) => {
    const exercices = [...draft.exercices];
    exercices[i] = { ...exercices[i], ...patch };
    updateDraft({ exercices });
  };

  const updateRep = (exIdx, serieIdx, val) => {
    const exercices = draft.exercices.map((ex, i) => {
      if (i !== exIdx) return ex;
      const reps = [...ex.reps];
      reps[serieIdx] = val;
      return { ...ex, reps };
    });
    updateDraft({ exercices });
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      {/* overlay */}
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"#000a" }} />
      <div style={{ position:"relative", background:G.bg2, borderRadius:"20px 20px 0 0", border:`1px solid ${G.border}`, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        {/* Header modal */}
        <div style={{ padding:"16px 16px 12px", borderBottom:`1px solid ${G.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{ fontFamily:G.fontD, fontSize:18, fontWeight:800, color:meta.color }}>
              {meta.icon} Journal — {meta.label}
            </div>
            <div style={{ fontSize:12, color:G.grey, marginTop:2 }}>S{modal.weekNum} · {W.label}</div>
          </div>
          <button onClick={onClose} style={{ background:G.bg3, border:`1px solid ${G.border}`, color:G.grey, borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:16 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ overflowY:"auto", padding:"14px 16px", flex:1 }}>

          {/* ── RUNNING (foncier + ll) ── */}
          {isRunning && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <LogField label="⏱ Durée réelle effectuée" placeholder="ex: 32 min">
                <input value={draft.dureeReelle||""} onChange={e=>updateDraft({dureeReelle:e.target.value})}
                  style={inputStyle} placeholder="ex: 32 min" />
              </LogField>

              {isLL && (
                <LogField label="🎯 Niveau Luc-Léger atteint (si simulation)">
                  <div style={{ display:"flex", gap:8 }}>
                    <input value={draft.niveauAtteint||""} onChange={e=>updateDraft({niveauAtteint:e.target.value})}
                      style={{ ...inputStyle, flex:1 }} placeholder="ex: 10.5" />
                    <input value={draft.palette||""} onChange={e=>updateDraft({palette:e.target.value})}
                      style={{ ...inputStyle, flex:1 }} placeholder="Palette (ex: 7)" />
                  </div>
                  <div style={{ fontSize:11, color:G.grey, marginTop:4 }}>Niveau · Palette (nb de navettes dans le dernier niveau)</div>
                </LogField>
              )}

              <LogField label="💓 Sensation globale">
                <SensationPicker value={draft.sensation} onChange={v=>updateDraft({sensation:v})} color={meta.color} />
              </LogField>

              <LogField label="📝 Notes libres">
                <textarea value={draft.notes||""} onChange={e=>updateDraft({notes:e.target.value})}
                  rows={3} style={{ ...inputStyle, resize:"vertical" }} placeholder="Ressenti, conditions, météo, douleurs éventuelles..." />
              </LogField>
            </div>
          )}

          {/* ── SALLE ── */}
          {isSalle && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(draft.exercices||[]).map((ex, i) => (
                <div key={i} style={{ background:G.bg3, borderRadius:10, padding:"12px" }}>
                  <div style={{ fontWeight:700, fontSize:13, color:G.white, marginBottom:10 }}>{ex.nom}</div>
                  <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:G.grey, marginBottom:4 }}>Charge utilisée</div>
                      <input value={ex.charge||""} onChange={e=>updateEx(i,{charge:e.target.value})}
                        style={inputStyle} placeholder="ex: 80 kg" />
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:G.grey, marginBottom:4 }}>Notes (reps, variation…)</div>
                      <input value={ex.notes||""} onChange={e=>updateEx(i,{notes:e.target.value})}
                        style={inputStyle} placeholder="ex: 3×10 ok" />
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:G.grey, marginBottom:5 }}>Sensation sur cet exercice</div>
                  <SensationPicker value={ex.sensation} onChange={v=>updateEx(i,{sensation:v})} color={G.blue} compact />
                </div>
              ))}

              <LogField label="💓 Sensation globale de la séance">
                <SensationPicker value={draft.sensation} onChange={v=>updateDraft({sensation:v})} color={G.blue} />
              </LogField>

              <LogField label="📝 Notes générales">
                <textarea value={draft.notes||""} onChange={e=>updateDraft({notes:e.target.value})}
                  rows={2} style={{ ...inputStyle, resize:"vertical" }} placeholder="Énergie, douleurs, observations..." />
              </LogField>
            </div>
          )}

          {/* ── MAISON ── */}
          {!isRunning && !isSalle && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {(draft.exercices||[]).map((ex, i) => (
                <div key={i} style={{ background:G.bg3, borderRadius:10, padding:"12px" }}>
                  <div style={{ fontWeight:700, fontSize:13, color:G.white, marginBottom:8 }}>{ex.nom}</div>
                  <div style={{ fontSize:11, color:G.grey, marginBottom:6 }}>Reps par série</div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
                    {(ex.reps||[]).map((r, si) => (
                      <div key={si} style={{ textAlign:"center" }}>
                        <div style={{ fontSize:10, color:G.grey, marginBottom:3 }}>S{si+1}</div>
                        <input value={r} onChange={e=>updateRep(i,si,e.target.value)}
                          style={{ ...inputStyle, width:52, textAlign:"center", padding:"6px 4px" }} placeholder="—" />
                      </div>
                    ))}
                  </div>
                  {ex.notes !== undefined && (
                    <input value={ex.notes||""} onChange={e=>updateEx(i,{notes:e.target.value})}
                      style={inputStyle} placeholder="Notes (charge lestée, variante...)" />
                  )}
                </div>
              ))}

              <LogField label="💓 Sensation globale">
                <SensationPicker value={draft.sensation} onChange={v=>updateDraft({sensation:v})} color={G.purple} />
              </LogField>

              <LogField label="📝 Notes libres">
                <textarea value={draft.notes||""} onChange={e=>updateDraft({notes:e.target.value})}
                  rows={2} style={{ ...inputStyle, resize:"vertical" }} placeholder="Ressenti, progression notée..." />
              </LogField>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 16px", borderTop:`1px solid ${G.border}`, flexShrink:0, display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:"12px", background:G.bg3, border:`1px solid ${G.border}`, color:G.grey, borderRadius:10, fontFamily:G.font, fontWeight:600, fontSize:14, cursor:"pointer" }}>
            Annuler
          </button>
          <button onClick={onSave} style={{ flex:2, padding:"12px", background:`linear-gradient(135deg,${meta.color},${meta.color}cc)`, border:"none", color: meta.color===G.gold?G.bg:G.white, borderRadius:10, fontFamily:G.font, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            ✓ Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SOUS-COMPOSANTS ──────────────────────────────────────────────────────────

function SensationPicker({ value, onChange, color, compact }) {
  return (
    <div style={{ display:"flex", gap: compact ? 4 : 6 }}>
      {[1,2,3,4,5].map(v => (
        <button key={v} onClick={()=>onChange(v)}
          style={{ flex:1, padding: compact ? "5px 2px" : "8px 2px", borderRadius:8,
            border:`1px solid ${value===v ? color : G.border}`,
            background: value===v ? color+"30" : G.bg4,
            color: value===v ? color : G.greyDim,
            fontFamily:G.font, fontSize: compact ? 14 : 18,
            cursor:"pointer", textAlign:"center" }}>
          {["😰","😤","😐","💪","🔥"][v-1]}
          {!compact && <div style={{ fontSize:9, color: value===v ? color : G.greyDim, marginTop:3 }}>{SENSATION_LABELS[v].split(" ")[0]}</div>}
        </button>
      ))}
    </div>
  );
}

function LogField({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:12, color:G.grey, marginBottom:7, fontWeight:600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = {
  width:"100%", background:G.bg4, border:`1px solid ${G.border}`,
  borderRadius:8, padding:"9px 10px", color:G.white,
  fontFamily:G.font, fontSize:13, outline:"none",
};

function SessionCard({ color, icon, titre, duree, intensite, children }) {
  return (
    <div style={{ background:G.bg3, borderRadius:12, overflow:"hidden" }}>
      <div style={{ background:color+"18", borderBottom:`1px solid ${color}30`, padding:"12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>{icon}</span>
          <div>
            <div style={{ fontFamily:G.fontD, fontWeight:800, fontSize:16, color }}>{titre}</div>
            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <Badge val={duree} icon="⏱" color={color} />
              <Badge val={intensite} icon="📊" color={color} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding:"14px" }}>{children}</div>
    </div>
  );
}

function Badge({ val, icon, color }) {
  return (
    <span style={{ fontSize:11, color, background:color+"20", padding:"2px 8px", borderRadius:100, fontWeight:600 }}>
      {icon} {val}
    </span>
  );
}

function PlanTable({ plan, color }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:12 }}>
      {plan.map((p, i) => (
        <div key={i} style={{ display:"flex", gap:8, background:G.bg4, borderRadius:8, padding:"9px 10px",
          borderLeft:`3px solid ${i===0||i===plan.length-1?G.greyDim:color}` }}>
          <div style={{ minWidth:100 }}>
            <div style={{ fontSize:10, fontWeight:700, color:i===0||i===plan.length-1?G.grey:color, textTransform:"uppercase", letterSpacing:.5 }}>{p.phase}</div>
            <div style={{ fontSize:11, color:G.grey, marginTop:2 }}>{p.duree}</div>
          </div>
          <div style={{ fontSize:12, color:G.white, lineHeight:1.5 }}>{p.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ConseilBox({ texte }) {
  return (
    <div style={{ background:"#1a1500", border:`1px solid ${G.gold}40`, borderRadius:8, padding:"9px 10px", marginTop:6 }}>
      <span style={{ color:G.gold, fontWeight:700, fontSize:11 }}>💡 Conseil : </span>
      <span style={{ color:G.grey, fontSize:12, lineHeight:1.5 }}>{texte}</span>
    </div>
  );
}
