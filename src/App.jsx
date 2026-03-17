import { useState, useRef, useEffect } from "react";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from "./firebase.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const G = {
  bg:"#080808",bg2:"#0f0f0f",bg3:"#161616",bg4:"#1c1c1c",
  gold:"#C9A84C",goldLight:"#E8C547",
  white:"#F5F0E8",grey:"#888",greyDim:"#444",border:"#2a2a2a",
  red:"#E05252",green:"#52C07A",
  font:"'Barlow',sans-serif",fontD:"'Barlow Condensed',sans-serif",
};
const css=`
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body{background:${G.bg};}
  input,textarea,select{font-family:${G.font};}
  ::-webkit-scrollbar{width:0;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  .fu{animation:fadeUp .3s ease both;}
  .gl::after{content:'';display:block;width:36px;height:3px;background:linear-gradient(90deg,${G.goldLight},${G.gold});border-radius:2px;margin-top:7px;}
`;

// ─── SEED DATA ────────────────────────────────────────────────────────────────
// Exercise: { id, name, muscle, equipment, videoUrl, notes }
// Program exercise slot: { exId, sets, reps, rest, targetLoad:"" }
// Day: { label, exercises:[] }
// Week: { label, days:[] }
// Program: { id, name, category, level, weeks:[] }
// SessionLog: { id, date, programId, weekIdx, dayIdx, dayLabel, exercises:[{exId, name, sets:[{reps,load}]}], notes, completed }

const SEED_EX = [
  // ── JAMBES ──
  {id:1,name:"Squat Barre",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/ultWZbUMPL8",notes:"Dos droit, genoux alignés"},
  {id:9,name:"Fentes Marchées",muscle:"Jambes",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/D7KaRcUTQeE",notes:"Genou arrière proche du sol"},
  {id:11,name:"Leg Press",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/IZxyjW7MPJQ",notes:"Pieds écartés largeur épaules"},
  {id:12,name:"Leg Extension",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/YyvSfVjQeL0",notes:"Extension complète, descente contrôlée"},
  {id:13,name:"Leg Curl Allongé",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/1Tq3QdYUuHs",notes:"Hanches plaquées sur le banc"},
  {id:14,name:"Squat Gobelet",muscle:"Jambes",equipment:"Kettlebell",videoUrl:"https://www.youtube.com/embed/MxsFDhcyFyE",notes:"Coudes entre les genoux en bas"},
  {id:15,name:"Romanian Deadlift",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/JCXUYuzwNrM",notes:"Dos plat, hanches en arrière"},
  {id:16,name:"Hip Thrust",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/xDmFkJxPzeM",notes:"Extension complète des hanches"},
  {id:17,name:"Step Up",muscle:"Jambes",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/dQqApCGd5Ss",notes:"Genou à 90° en haut"},
  {id:18,name:"Hack Squat",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/0tn5K9NlCfo",notes:"Descendre à 90°, genoux alignés"},
  {id:19,name:"Mollets Debout",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/gwLzBJYoWlI",notes:"Amplitude maximale, pause en haut"},
  {id:20,name:"Good Morning",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/YA-h3n9L4YU",notes:"Dos plat, légère flexion genoux"},
  {id:21,name:"Wall Sit",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/y-wV4Venusw",notes:"Cuisses parallèles au sol"},
  {id:22,name:"Box Jump",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/52r_Ul5k03g",notes:"Réception souple, genoux fléchis"},
  {id:23,name:"Bulgarian Split Squat",muscle:"Jambes",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/2C-uNgKwPLE",notes:"Pied arrière surélevé, descente verticale"},

  // ── PECTORAUX ──
  {id:2,name:"Développé Couché",muscle:"Pectoraux",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/rT7DgCr-3pg",notes:"Coudes à 45°, amplitude complète"},
  {id:24,name:"Développé Couché Haltères",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/VmB1G1K7v94",notes:"Rotation des poignets en haut"},
  {id:25,name:"Développé Incliné Barre",muscle:"Pectoraux",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/jPLdzuHckI8",notes:"Inclinaison 30-45°, faisceau sup"},
  {id:26,name:"Développé Incliné Haltères",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/8iPEnn-ltC8",notes:"Coudes légèrement fléchis en haut"},
  {id:27,name:"Écarté Haltères Plat",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/eozdVDA78K0",notes:"Arc léger, ne pas descendre trop bas"},
  {id:28,name:"Dips Pectoraux",muscle:"Pectoraux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/2z8JmcrW-As",notes:"Penché en avant, coudes écartés"},
  {id:29,name:"Pec Deck Machine",muscle:"Pectoraux",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/Z57CtFmRMxA",notes:"Contraction maximale en centre"},
  {id:30,name:"Pompes",muscle:"Pectoraux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/IODxDxX7oi4",notes:"Corps gainé, coudes à 45°"},
  {id:31,name:"Cable Crossover",muscle:"Pectoraux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/taI4XduLpTk",notes:"Mains se croisent en bas du mouvement"},

  // ── DOS ──
  {id:3,name:"Tractions",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/eGo4IYlbE5g",notes:"Pleine amplitude, sans élan"},
  {id:4,name:"Soulevé de Terre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/op9kVnSso6Q",notes:"Barre proche du corps"},
  {id:10,name:"Rowing Barre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/G8l_8chR5BE",notes:"Dos parallèle au sol, coudes hauts"},
  {id:32,name:"Tirage Vertical Poulie",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/CAwf7n6Luuc",notes:"Coudes vers le bas, omoplate rétractées"},
  {id:33,name:"Rowing Haltère Unilatéral",muscle:"Dos",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/roCP3W-lfKo",notes:"Dos plat, tirer vers la hanche"},
  {id:34,name:"Tirage Horizontal Poulie",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/GZbfZ033f74",notes:"Serrer les omoplates en fin de mouvement"},
  {id:35,name:"Hyperextension",muscle:"Dos",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/ph3pddpKzzw",notes:"Extension sans dépasser la ligne du corps"},
  {id:36,name:"Tirage Nuque Poulie",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/eSYBCuBDDHo",notes:"Barre derrière la tête, coudes pointés vers le bas"},
  {id:37,name:"Face Pull",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/rep-qVOkqgk",notes:"Tirer vers le visage, coudes hauts"},
  {id:38,name:"Shrugs Barre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/cJRVVxmytaM",notes:"Élévation verticale, pas de rotation"},
  {id:39,name:"Déficit Deadlift",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/bDFBSNNSjUs",notes:"Sur plateforme surélevée, amplitude accrue"},

  // ── ÉPAULES ──
  {id:5,name:"Développé Militaire",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/2yjwXTZQDDI",notes:"Core serré, regard droit"},
  {id:40,name:"Élévations Latérales",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/3VcKaXpzqRo",notes:"Légère flexion des coudes, montée lente"},
  {id:41,name:"Développé Arnold",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/6Z15_WdXmVw",notes:"Rotation des poignets pendant le mouvement"},
  {id:42,name:"Oiseau Haltères",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/Z6n49aQTHFs",notes:"Buste penché, coudes légèrement fléchis"},
  {id:43,name:"Upright Row",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/um3SX3fZSqc",notes:"Coudes au-dessus des poignets"},
  {id:44,name:"Élévations Frontales",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/sOiBHNGlBzU",notes:"Montée jusqu'à hauteur des épaules"},
  {id:45,name:"Développé Haltères Assis",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/qEwKCR5JCog",notes:"Dos droit contre le banc"},
  {id:46,name:"Reverse Fly Poulie",muscle:"Épaules",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/ea7TXQMiMnE",notes:"Câbles croisés, bras légèrement fléchis"},

  // ── BICEPS ──
  {id:6,name:"Curl Haltères",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/sAq_ocpRh_I",notes:"Supination en haut du mouvement"},
  {id:47,name:"Curl Barre",muscle:"Biceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/kwG2ipFRgfo",notes:"Coudes fixes le long du corps"},
  {id:48,name:"Curl Incliné",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/soxrZlIl35U",notes:"Bras perpendiculaires au sol, longue portion"},
  {id:49,name:"Curl Marteau",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/TwD-YGVP4Bk",notes:"Poignets neutres, brachial ciblé"},
  {id:50,name:"Curl Poulie Basse",muscle:"Biceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/NFzTWp2qpiE",notes:"Tension constante, coude fixe"},
  {id:51,name:"Curl Concentration",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/0AUGkch3tzc",notes:"Coude contre la cuisse, isolation maximale"},
  {id:52,name:"Curl Barre EZ",muscle:"Biceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/zG2-v6RxOEo",notes:"Prise en supination, moins de stress poignets"},
  {id:53,name:"Curl Spider",muscle:"Biceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/N0bLDTFcRug",notes:"Poitrine contre le banc incliné"},

  // ── TRICEPS ──
  {id:7,name:"Triceps Poulie",muscle:"Triceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/2-LAMcpzODU",notes:"Coudes fixes, extension complète"},
  {id:54,name:"Dips Triceps",muscle:"Triceps",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/0326dy_-CzM",notes:"Corps droit, coudes le long du corps"},
  {id:55,name:"Skull Crusher",muscle:"Triceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/d_KZxkY_0cM",notes:"Descendre vers le front, coudes fixes"},
  {id:56,name:"Extension Triceps Haltère",muscle:"Triceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/YbX7Wd8jQ-Q",notes:"Coudes serrés, longue portion ciblée"},
  {id:57,name:"Kickback Triceps",muscle:"Triceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/6SS6K3lAwZ8",notes:"Buste parallèle au sol, extension complète"},
  {id:58,name:"Close Grip Bench Press",muscle:"Triceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/nEF0bv2FW94",notes:"Prise serrée, coudes le long du corps"},
  {id:59,name:"Triceps Corde Poulie",muscle:"Triceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/kiuVA0gs3EI",notes:"Écarter la corde en bas du mouvement"},

  // ── ABDOMINAUX ──
  {id:8,name:"Gainage Planche",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/pSHjTRCQxIw",notes:"Bassin neutre, respiration continue"},
  {id:60,name:"Crunch",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/Xyd_fa5zoEU",notes:"Mains derrière la tête, menton décollé"},
  {id:61,name:"Relevé de Jambes",muscle:"Abdominaux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/Pr1ieGZ5atk",notes:"Jambes tendues, montée lente"},
  {id:62,name:"Ab Wheel",muscle:"Abdominaux",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/ZJOG6_5gNUI",notes:"Creuser le ventre, ne pas cambrer"},
  {id:63,name:"Mountain Climbers",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/nmwgirgXLYM",notes:"Hanches basses, rythme rapide"},
  {id:64,name:"Russian Twist",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/wkD8rjkodUI",notes:"Pieds décollés, rotation complète"},
  {id:65,name:"Crunch Poulie Haute",muscle:"Abdominaux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/AV5PGc8E4-4",notes:"Contracte les abdos vers les genoux"},
  {id:66,name:"Planche Latérale",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/K2gOjwfj-lA",notes:"Hanches alignées, corps en planche"},
  {id:67,name:"V-Sit",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/7UGzOJrKSqw",notes:"Corps en V, abdos contractés"},
  {id:68,name:"Dead Bug",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/4XLEnwUr1d8",notes:"Dos plaqué au sol, mouvement lent"},

  // ── CROSSFIT / FONCTIONNEL ──
  {id:69,name:"Burpees",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/dZgVxmf6jkA",notes:"Réception souple, saut vertical complet"},
  {id:70,name:"Kettlebell Swing",muscle:"Dos",equipment:"Kettlebell",videoUrl:"https://www.youtube.com/embed/YSxHifyI6s8",notes:"Propulsion des hanches, bras passifs"},
  {id:71,name:"Thruster",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/L219ltL15zk",notes:"Squat + développé en un mouvement fluide"},
  {id:72,name:"Wall Ball",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/fpUD0mcFp_0",notes:"Squat profond, lancer haut sur le mur"},
  {id:73,name:"Box Jump",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/52r_Xl5k03g",notes:"Réception souple, extension complète"},
  {id:74,name:"Clean & Jerk",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/oxYIjfNBsZ0",notes:"Puissance des hanches, saisie rapide"},
  {id:75,name:"Snatch",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/9xQp2sldyts",notes:"Prise large, extension explosive"},
  {id:76,name:"Power Clean",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/KjGvwQl8tis",notes:"Triple extension, amortissement actif"},
  {id:77,name:"Toes to Bar",muscle:"Abdominaux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/6dHvNBDMQY4",notes:"Élan contrôlé, toucher la barre avec les pieds"},
  {id:78,name:"Double Under",muscle:"Jambes",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/82rd87EMTP4",notes:"Poignets souples, saut régulier"},
  {id:79,name:"Rope Climb",muscle:"Dos",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/mMJpFrJEnc4",notes:"Prise alternée, jambes en appui"},
  {id:80,name:"Push Press",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/iaBVSJm78ko",notes:"Légère flexion genoux, extension explosive"},
  {id:81,name:"Rowing Ergomètre",muscle:"Dos",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/zBjCMFGkYOU",notes:"Jambes, hanches, bras dans l'ordre"},
  {id:82,name:"Devil Press",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/aHPfuFmhiGE",notes:"Burpee + Snatch haltères combinés"},
  {id:83,name:"Sandbag Carry",muscle:"Dos",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/iqKLjNBFjcA",notes:"Sac sur l'épaule, pas réguliers"},
  {id:84,name:"GHD Sit-Up",muscle:"Abdominaux",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/1pbZ8mX3hDY",notes:"Amplitude complète, contrôle la descente"},
  {id:85,name:"L-Sit",muscle:"Abdominaux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/IUZJoSP66HI",notes:"Jambes parallèles au sol, bras tendus"},
  {id:86,name:"Muscle Up",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/bN5_V1OKlSY",notes:"Transition rapide traction → dips"},
  {id:87,name:"Handstand Push-Up",muscle:"Épaules",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/4qeNMjmQNfM",notes:"Mains à largeur épaules, descente contrôlée"},
  {id:88,name:"Ring Dips",muscle:"Pectoraux",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/MMnIVymOEXo",notes:"Anneaux stables, coudes le long du corps"},
  {id:89,name:"Pistol Squat",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/vq5-vdgJc0I",notes:"Jambe tendue devant, descente lente"},
  {id:90,name:"Farmers Walk",muscle:"Dos",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/Fkzk_RqlYig",notes:"Dos droit, pas réguliers et rapides"},
  {id:91,name:"Battle Rope",muscle:"Épaules",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/dNE4ZCsHDoo",notes:"Genoux fléchis, ondes régulières"},
  {id:92,name:"Turkish Get-Up",muscle:"Épaules",equipment:"Kettlebell",videoUrl:"https://www.youtube.com/embed/0bWRPC49-KI",notes:"Bras tendu, regard sur la cloche"},
  {id:93,name:"Sumo Deadlift High Pull",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/g5kLayl1UQI",notes:"Prise étroite, extension + tirage"},
  {id:94,name:"Push-Up Ring",muscle:"Pectoraux",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/7ueVPPVoqRQ",notes:"Anneaux instables, gainage maximal"},
  {id:95,name:"Sled Push",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/bGIoSc1Cj8I",notes:"Corps incliné, pousser depuis les hanches"},
  {id:96,name:"Air Squat",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/C_VtOYc6j5c",notes:"Genoux dans l'axe, talons au sol"},
  {id:97,name:"Kettlebell Clean",muscle:"Dos",equipment:"Kettlebell",videoUrl:"https://www.youtube.com/embed/0Z0oBUPL0P8",notes:"Rotation du poignet en haut"},
  {id:98,name:"Planche Push-Up",muscle:"Pectoraux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/IODxDxX7oi4",notes:"Position basse, corps gainé"},
  {id:99,name:"Overhead Squat",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/RD_vUnqwqqI",notes:"Barre au-dessus de la tête, dos droit"},
  {id:100,name:"Atlas Stone",muscle:"Dos",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/p4cn0TQOAPA",notes:"Soulever en serrant la pierre contre le corps"},
  {id:101,name:"Bear Crawl",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/gBEAzBMdQ-8",notes:"Genoux à 5cm du sol, dos plat"},
  {id:102,name:"Dumbbell Snatch",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/yhh_R2Nt_08",notes:"Extension explosive, verrouillage en haut"},
  {id:103,name:"Inverted Row",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/LK3E-40LRHE",notes:"Corps rigide, tirer le sternum vers la barre"},
  {id:104,name:"Broad Jump",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/WGHBLObUUH0",notes:"Saut en longueur, réception souple"},
  {id:105,name:"Ski Erg",muscle:"Dos",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/FY-N3pqBBMI",notes:"Traction vers le bas, hanches en arrière"},

  // ── PROGRAMME GROSSESSE ──
  {id:106,name:"Deadlift Sumo Barre",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/WH1oJERG8eI",notes:"Stance large, pieds 45°, dos plat, poussée du sol — barre proche du corps"},
  {id:107,name:"Cable Pull-Through",muscle:"Jambes",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/mNwlpNhQXrk",notes:"Câble bas entre les jambes, charnière hanche pure, fessiers contractés en haut"},
  {id:108,name:"Pallof Press Câble",muscle:"Abdominaux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/AH_QZLm_0-s",notes:"Debout, unilatéral, hauteur poitrine — résister à la rotation"},
  {id:109,name:"Bird Dog Lestés",muscle:"Abdominaux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/wiFNA3sqjCA",notes:"2 s de pause en extension complète, dos plat, genoux à 5 cm du sol"},
  {id:110,name:"Activation Fessiers Élastique",muscle:"Jambes",equipment:"Élastique",videoUrl:"https://www.youtube.com/embed/Y20ABnLDHhQ",notes:"Clamshell, hip abduction, monster walk — 15 reps par mouvement"},
  {id:111,name:"Band Pull Apart",muscle:"Épaules",equipment:"Élastique",videoUrl:"https://www.youtube.com/embed/HFv0e5JqULM",notes:"Bras tendus devant, écarter l'élastique à hauteur des épaules, omoplate rétractées"},
  {id:112,name:"RDL Unilatéral Haltère",muscle:"Jambes",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/qH1lLrkXNRE",notes:"Vitesse lente, équilibre, dos plat — jambe d'appui légèrement fléchie"},
  {id:113,name:"Planche sur Genoux",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/DHBMtGlXnmk",notes:"Gainage actif, stopper si doming abdominal visible"},
  {id:114,name:"Vélo Stationnaire",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/JqaCVNKRWF4",notes:"FC < 140 bpm, cadence modérée, dos droit"},
];


const mkEx = (exId,sets,reps,rest,load="")=>({exId,sets,reps,rest,targetLoad:load});
const SEED_PROGRAMS = [
  {id:1,name:"Full Body 3j/sem",category:"Force",level:"Intermédiaire",weeks:[
    {label:"Semaine 1 — Découverte",days:[
      {label:"Séance A",exercises:[mkEx(1,4,"8","90s","60kg"),mkEx(2,4,"8","90s","50kg"),mkEx(8,3,"45s","45s")]},
      {label:"Séance B",exercises:[mkEx(4,4,"5","2min","80kg"),mkEx(3,3,"Max","60s"),mkEx(10,3,"10","75s","40kg")]},
      {label:"Séance C",exercises:[mkEx(9,3,"12","60s"),mkEx(5,4,"8","90s","30kg"),mkEx(6,3,"12","60s")]},
    ]},
    {label:"Semaine 2 — Progression",days:[
      {label:"Séance A",exercises:[mkEx(1,4,"8","90s","65kg"),mkEx(2,4,"8","90s","55kg"),mkEx(8,3,"50s","45s")]},
      {label:"Séance B",exercises:[mkEx(4,4,"5","2min","85kg"),mkEx(3,3,"Max","60s"),mkEx(10,3,"10","75s","45kg")]},
      {label:"Séance C",exercises:[mkEx(9,3,"12","60s"),mkEx(5,4,"8","90s","35kg"),mkEx(6,3,"12","60s")]},
    ]},
    {label:"Semaine 3 — Intensification",days:[
      {label:"Séance A",exercises:[mkEx(1,5,"5","2min","70kg"),mkEx(2,5,"5","2min","60kg"),mkEx(8,4,"45s","45s")]},
      {label:"Séance B",exercises:[mkEx(4,5,"3","2min","90kg"),mkEx(3,4,"Max","60s"),mkEx(10,4,"8","90s","50kg")]},
      {label:"Séance C",exercises:[mkEx(9,4,"10","60s"),mkEx(5,5,"5","2min","40kg"),mkEx(6,4,"10","60s")]},
    ]},
  ]},
  {id:2,name:"PPL 6j/sem",category:"PPL",level:"Avancé",weeks:[
    {label:"Semaine 1",days:[
      {label:"Push",exercises:[mkEx(2,5,"5","2min","80kg"),mkEx(5,4,"8","90s","40kg"),mkEx(7,4,"12","60s")]},
      {label:"Pull",exercises:[mkEx(4,4,"5","2min","100kg"),mkEx(3,4,"8","75s"),mkEx(10,3,"10","60s","50kg")]},
      {label:"Legs",exercises:[mkEx(1,5,"5","2min","100kg"),mkEx(9,4,"10","90s"),mkEx(8,3,"60s","45s")]},
      {label:"Push 2",exercises:[mkEx(2,4,"10","75s","70kg"),mkEx(5,3,"12","60s","35kg"),mkEx(7,3,"15","45s")]},
      {label:"Pull 2",exercises:[mkEx(3,3,"Max","60s"),mkEx(6,4,"12","60s"),mkEx(10,3,"12","60s","45kg")]},
      {label:"Legs 2",exercises:[mkEx(1,4,"8","90s","90kg"),mkEx(9,3,"12","60s")]},
    ]},
  ]},

  // ── PROGRAMME GROSSESSE (sans hip thrust) ──────────────────────────────────
  {id:3,name:"Programme Grossesse",category:"Prénatal",level:"Tous niveaux",weeks:[

    // ── T1 — Semaines 1 à 12 ──────────────────────────────────────────────
    {label:"T1 — S1·S12",days:[
      {label:"Lundi · Bas du corps",exercises:[
        mkEx(110,2,"15","45s",""),
        mkEx(1,4,"8","90s","73% 1RM"),
        mkEx(106,4,"8","90s","70% 1RM"),
        mkEx(107,4,"12","60s",""),
        mkEx(11,3,"12","75s","65% 1RM"),
        mkEx(108,3,"12/côté","60s",""),
        mkEx(109,3,"10/côté","45s","2kg"),
      ]},
      {label:"Mardi · Cardio & Traction",exercises:[
        mkEx(81,1,"20 min","","FC < 140 bpm"),
        mkEx(3,4,"5","90s",""),
        mkEx(32,4,"10","75s","70% 1RM"),
        mkEx(34,3,"10","60s","67% 1RM"),
        mkEx(37,3,"15","45s",""),
        mkEx(52,3,"10","60s",""),
        mkEx(90,3,"25 m","90s",""),
      ]},
      {label:"Jeudi · Haut du corps",exercises:[
        mkEx(111,2,"15","45s",""),
        mkEx(5,4,"8","90s","70% 1RM"),
        mkEx(26,3,"10","75s","67% 1RM"),
        mkEx(3,4,"5","90s",""),
        mkEx(33,4,"8/côté","75s","67% 1RM"),
        mkEx(34,3,"10","60s","65% 1RM"),
        mkEx(40,3,"15","45s",""),
        mkEx(59,3,"12","45s",""),
        mkEx(48,3,"10","60s",""),
      ]},
      {label:"Vendredi · Full Body",exercises:[
        mkEx(114,1,"15 min","","FC < 140 bpm"),
        mkEx(1,3,"10","75s","65% 1RM"),
        mkEx(106,3,"8","75s","62% 1RM"),
        mkEx(103,3,"10","60s",""),
        mkEx(45,3,"10","60s","65% 1RM"),
        mkEx(112,3,"8/côté","60s",""),
        mkEx(113,3,"40s","45s",""),
      ]},
    ]},

    // ── T2 — Semaines 13 à 26 ─────────────────────────────────────────────
    {label:"T2 — S13·S26",days:[
      {label:"Lundi · Bas du corps",exercises:[
        mkEx(110,2,"15","45s",""),
        mkEx(1,4,"8","90s","70% 1RM"),
        mkEx(106,4,"8","90s","67% 1RM"),
        mkEx(107,4,"12","60s",""),
        mkEx(11,3,"12","75s","62% 1RM"),
        mkEx(108,3,"12/côté","60s",""),
        mkEx(109,3,"10/côté","45s","2kg"),
      ]},
      {label:"Mardi · Cardio & Traction",exercises:[
        mkEx(81,1,"20 min","","FC < 140 bpm"),
        mkEx(3,4,"5","90s",""),
        mkEx(32,4,"10","75s","65% 1RM"),
        mkEx(34,3,"10","60s","62% 1RM"),
        mkEx(37,3,"15","45s",""),
        mkEx(52,3,"10","60s",""),
        mkEx(90,3,"25 m","90s",""),
      ]},
      {label:"Jeudi · Haut du corps",exercises:[
        mkEx(111,2,"15","45s",""),
        mkEx(5,4,"8","90s","65% 1RM"),
        mkEx(26,3,"10","75s","67% 1RM"),
        mkEx(3,4,"5","90s",""),
        mkEx(33,4,"8/côté","75s","62% 1RM"),
        mkEx(34,3,"10","60s","60% 1RM"),
        mkEx(40,3,"15","45s",""),
        mkEx(59,3,"12","45s",""),
        mkEx(48,3,"10","60s",""),
      ]},
      {label:"Vendredi · Full Body",exercises:[
        mkEx(114,1,"15 min","","FC < 140 bpm"),
        mkEx(1,3,"10","75s","62% 1RM"),
        mkEx(106,3,"8","75s","59% 1RM"),
        mkEx(103,3,"10","60s",""),
        mkEx(45,3,"10","60s","65% 1RM"),
        mkEx(112,3,"8/côté","60s",""),
        mkEx(113,3,"40s","45s",""),
      ]},
    ]},

    // ── T3 — Semaines 27 à 40 ─────────────────────────────────────────────
    {label:"T3 — S27·S40",days:[
      {label:"Lundi · Bas du corps",exercises:[
        mkEx(110,2,"15","45s",""),
        mkEx(1,3,"8","90s","65% 1RM"),
        mkEx(106,4,"8","90s","62% 1RM"),
        mkEx(107,4,"12","60s",""),
        mkEx(11,3,"12","75s","60% 1RM"),
        mkEx(108,3,"12/côté","60s",""),
        mkEx(109,3,"10/côté","45s","2kg"),
      ]},
      {label:"Mardi · Cardio & Traction",exercises:[
        mkEx(81,1,"20 min","","FC < 140 bpm"),
        mkEx(3,4,"5","90s",""),
        mkEx(32,4,"10","75s","65% 1RM"),
        mkEx(34,3,"10","60s","62% 1RM"),
        mkEx(37,3,"15","45s",""),
        mkEx(52,3,"10","60s",""),
        mkEx(90,3,"25 m","90s",""),
      ]},
      {label:"Jeudi · Haut du corps",exercises:[
        mkEx(111,2,"15","45s",""),
        mkEx(5,4,"8","90s","62% 1RM"),
        mkEx(26,3,"10","75s","67% 1RM"),
        mkEx(3,4,"5","90s",""),
        mkEx(33,4,"8/côté","75s","62% 1RM"),
        mkEx(34,3,"10","60s","60% 1RM"),
        mkEx(40,3,"15","45s",""),
        mkEx(59,3,"12","45s",""),
        mkEx(48,3,"10","60s",""),
      ]},
      {label:"Vendredi · Full Body",exercises:[
        mkEx(114,1,"15 min","","FC < 140 bpm"),
        mkEx(1,3,"10","75s","58% 1RM"),
        mkEx(106,3,"8","75s","55% 1RM"),
        mkEx(103,3,"10","60s",""),
        mkEx(45,3,"10","60s","65% 1RM"),
        mkEx(112,3,"8/côté","60s",""),
        mkEx(113,3,"40s","45s",""),
      ]},
    ]},

  ]},
];

const SEED_CLIENTS = [
  {id:1,name:"Sophie Martin",code:"SOPH2025",goal:"Perte de poids",since:"Jan 2025",sessions:4,color:G.goldLight,programs:[1],
   nutrition:{calories:1800,proteins:130,carbs:180,fats:60,notes:"Éviter le gluten."},
   sessionLogs:[
     {id:"log1",date:"2025-03-10",programId:1,weekIdx:0,dayIdx:0,dayLabel:"Séance A",completed:true,notes:"Bonne séance",
      exercises:[
        {exId:1,name:"Squat Barre",sets:[{reps:"8",load:"55kg"},{reps:"8",load:"55kg"},{reps:"8",load:"60kg"},{reps:"7",load:"60kg"}]},
        {exId:2,name:"Développé Couché",sets:[{reps:"8",load:"45kg"},{reps:"8",load:"50kg"},{reps:"7",load:"50kg"},{reps:"6",load:"50kg"}]},
        {exId:8,name:"Gainage Planche",sets:[{reps:"45s",load:""},{reps:"45s",load:""},{reps:"40s",load:""}]},
      ]},
   ]},
  {id:2,name:"Thomas Dubois",code:"THOM2025",goal:"Prise de masse",since:"Fév 2025",sessions:2,color:G.gold,programs:[2],
   nutrition:{calories:3200,proteins:200,carbs:380,fats:90,notes:"Shake post-workout."},sessionLogs:[]},
  {id:3,name:"Camille Roy",code:"CAMI2025",goal:"Tonification",since:"Mar 2025",sessions:0,color:"#8a7040",programs:[],
   nutrition:{calories:2000,proteins:150,carbs:220,fats:65,notes:""},sessionLogs:[]},
];

const MUSCLES=["Tous","Jambes","Pectoraux","Dos","Épaules","Biceps","Triceps","Abdominaux"];
const EQUIPS=["Aucun","Barre","Haltères","Poulie","Barre fixe","Machine","Élastique","Kettlebell","Poids du corps"];
const genCode=n=>n.split(" ")[0].toUpperCase().slice(0,4)+new Date().getFullYear();
const uid=()=>Math.random().toString(36).slice(2,9);

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Tag=({text,color=G.gold})=>(
  <span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:4,padding:"2px 9px",fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase"}}>{text}</span>
);
const Label=({children})=>(
  <div style={{fontSize:11,color:G.grey,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{children}</div>
);
const Inp=({label,...p})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label>{label}</Label>}
    <input style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:14,outline:"none",transition:"border .2s"}}
      onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border} {...p}/>
  </div>
);
const Txa=({label,...p})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label>{label}</Label>}
    <textarea style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:14,outline:"none",resize:"vertical",minHeight:66}}
      onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border} {...p}/>
  </div>
);
const Btn=({children,variant="gold",style:s={},...p})=>{
  const v={gold:{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg},outline:{background:"transparent",color:G.gold,border:`1px solid ${G.gold}55`},ghost:{background:G.bg3,color:G.grey,border:`1px solid ${G.border}`},danger:{background:"#E0525215",color:G.red,border:`1px solid ${G.red}33`}};
  return <button style={{border:"none",borderRadius:8,padding:"12px 20px",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%",display:"block",...v[variant],...s}} {...p}>{children}</button>;
};
const BtnSm=({children,variant="gold",...p})=>{
  const v={gold:{background:G.goldLight+"18",color:G.goldLight,border:`1px solid ${G.gold}44`},ghost:{background:G.bg3,color:G.grey,border:`1px solid ${G.border}`},danger:{background:"#E0525210",color:G.red,border:`1px solid ${G.red}22`}};
  return <button style={{...v[variant],borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}} {...p}>{children}</button>;
};
const MacroBar=({label,value,max,color})=>(
  <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
      <span style={{color:G.grey}}>{label}</span><span style={{color:G.white,fontWeight:700}}>{value}g</span>
    </div>
    <div style={{background:G.bg4,borderRadius:99,height:5}}><div style={{width:`${Math.min(100,(value/max)*100)}%`,height:"100%",background:color,borderRadius:99,transition:"width .8s"}}/></div>
  </div>
);
const Av=({name,color=G.gold,size=48})=>(
  <div style={{width:size,height:size,borderRadius:size*.3,background:color+"18",border:`1.5px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:size*.35,color,flexShrink:0}}>
    {name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}
  </div>
);
const BackBtn=({label="Retour",onClick})=>(
  <button onClick={onClick} style={{background:"none",border:"none",color:G.gold,cursor:"pointer",fontSize:13,fontWeight:600,padding:"0 0 18px",display:"flex",alignItems:"center",gap:6}}>← {label}</button>
);
const PageH=({title,subtitle,action})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24}}>
    <div>
      <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,letterSpacing:-1}} className="gl">{title}</div>
      {subtitle&&<div style={{fontSize:12,color:G.grey,marginTop:4}}>{subtitle}</div>}
    </div>
    {action}
  </div>
);
const Empty=({text})=>(
  <div style={{textAlign:"center",padding:"32px 20px",color:G.greyDim,fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>○</div>{text}</div>
);
const Modal=({onClose,title,children})=>(
  <div style={{position:"fixed",inset:0,background:"#000000dd",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:G.bg2,borderRadius:"20px 20px 0 0",padding:"20px 20px 32px",width:"100%",maxWidth:430,border:`1px solid ${G.border}`,maxHeight:"85vh",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexShrink:0}}>
        <div style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,letterSpacing:-.5}}>{title}</div>
        <button onClick={onClose} style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,width:34,height:34,cursor:"pointer",color:G.grey,fontSize:16,flexShrink:0}}>✕</button>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {children}
      </div>
    </div>
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
// ─── PERSISTANCE FIRESTORE ────────────────────────────────────────────────────
function useFirestoreCollection(collectionName, seed){
  const [data, setDataLocal] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const colRef = collection(db, collectionName);

    // Listener temps réel — uniquement pour les mises à jour
    const unsub = onSnapshot(colRef,
      snap => {
        setDataLocal(snap.docs.map(d => d.data()));
        setReady(true);
      },
      err => {
        console.error(`[Firebase] Erreur listener ${collectionName}:`, err);
        setDataLocal(seed);
        setReady(true);
      }
    );

    // Seeding séparé : vérifie si la collection est vide puis insère les données
    getDocs(colRef).then(snap => {
      if(snap.empty){
        const BATCH_SIZE = 499;
        const batches = [];
        for(let i = 0; i < seed.length; i += BATCH_SIZE){
          const b = writeBatch(db);
          seed.slice(i, i + BATCH_SIZE).forEach(item =>
            b.set(doc(db, collectionName, String(item.id)), item)
          );
          batches.push(b.commit());
        }
        return Promise.all(batches);
      }
    }).catch(err => console.error(`[Firebase] Erreur seed ${collectionName}:`, err));

    return unsub;
  }, [collectionName]); // eslint-disable-line

  const setData = (updater) => {
    setDataLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevMap = new Map(prev.map(x => [String(x.id), x]));
      const nextIds = new Set(next.map(x => String(x.id)));
      next.forEach(item => {
        const p = prevMap.get(String(item.id));
        if(!p || JSON.stringify(p) !== JSON.stringify(item))
          setDoc(doc(db, collectionName, String(item.id)), item).catch(console.error);
      });
      prev.forEach(item => {
        if(!nextIds.has(String(item.id)))
          deleteDoc(doc(db, collectionName, String(item.id))).catch(console.error);
      });
      return next;
    });
  };

  return [data, setData, ready];
}

export default function App(){
  const [auth,setAuth]=useState("login");
  const [exercises,setExercises,exReady]=useFirestoreCollection("exercises", SEED_EX);
  const [programs,setPrograms,pgReady]=useFirestoreCollection("programs", SEED_PROGRAMS);
  const [clients,setClients,clReady]=useFirestoreCollection("clients", SEED_CLIENTS);
  const dbReady = exReady && pgReady && clReady;

  // Migration : ajoute les nouveaux exercices/programmes seed manquants dans Firestore
  useEffect(()=>{
    if(!exReady) return;
    const ids = new Set(exercises.map(e=>e.id));
    const missing = SEED_EX.filter(e=>!ids.has(e.id));
    if(missing.length>0) setExercises(prev=>[...prev,...missing]);
  },[exReady]); // eslint-disable-line
  useEffect(()=>{
    if(!pgReady) return;
    const ids = new Set(programs.map(p=>p.id));
    const missing = SEED_PROGRAMS.filter(p=>!ids.has(p.id));
    if(missing.length>0) setPrograms(prev=>[...prev,...missing]);
  },[pgReady]); // eslint-disable-line

  const [currentClient,setCurrentClient]=useState(null);
  const [coachView,setCoachView]=useState("dashboard");
  const [selClient,setSelClient]=useState(null);
  const [selProgram,setSelProgram]=useState(null);
  const [selClientForProgram,setSelClientForProgram]=useState(null);

  const login=code=>{
    if(code.toUpperCase()==="COACH2025"){setAuth("coach");return true;}
    const c=clients.find(c=>c.code===code.toUpperCase());
    if(c){setCurrentClient(c);setAuth("client");return true;}
    return false;
  };
  const logout=()=>{setAuth("login");setCurrentClient(null);setCoachView("dashboard");};

  if(!dbReady) return (
    <Shell css={css}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
        <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,color:G.goldLight,letterSpacing:-1}}>MON COACHING</div>
        <div style={{fontSize:13,color:G.grey}}>Connexion à la base de données…</div>
        <div style={{width:40,height:40,border:`3px solid ${G.border}`,borderTop:`3px solid ${G.goldLight}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </Shell>
  );
  if(auth==="login") return <LoginScreen onLogin={login}/>;
  if(auth==="client") return (
    <Shell css={css}>
      <ClientPortal client={currentClient} clients={clients} setClients={setClients} programs={programs} exercises={exercises} onLogout={logout}/>
    </Shell>
  );
  return (
    <Shell css={css}>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {coachView==="dashboard"&&<Dashboard clients={clients} programs={programs} exercises={exercises} go={setCoachView} sel={c=>{setSelClient(c);setCoachView("client-detail");}} selP={p=>{setSelProgram(p);setCoachView("program-detail");}} onLogout={logout}/>}
        {coachView==="clients"&&<ClientsList clients={clients} go={setCoachView} sel={c=>{setSelClient(c);setCoachView("client-detail");}}/>}
        {coachView==="client-detail"&&selClient&&<ClientDetail client={clients.find(c=>c.id===selClient.id)||selClient} clients={clients} setClients={setClients} setPrograms={setPrograms} setSel={setSelClient} programs={programs} exercises={exercises} go={setCoachView} selP={p=>{setSelProgram(p);setSelClientForProgram(clients.find(c=>c.id===selClient.id)||selClient);setCoachView("program-detail");}}/>}
        {coachView==="new-client"&&<NewClient setClients={setClients} go={setCoachView}/>}
        {coachView==="programs"&&<ProgramsList programs={programs} setPrograms={setPrograms} setClients={setClients} exercises={exercises} go={setCoachView} sel={p=>{setSelProgram(p);setSelClientForProgram(null);setCoachView("program-detail");}} onEdit={p=>{setSelProgram(p);setCoachView("edit-program");}}/>}
        {coachView==="program-detail"&&selProgram&&<ProgramDetail program={programs.find(x=>x.id===selProgram.id)||selProgram} exercises={exercises} go={setCoachView} client={selClientForProgram} onEdit={p=>{setSelProgram(p);setCoachView("edit-program");}}/>}
        {coachView==="edit-program"&&selProgram&&<EditProgram program={programs.find(x=>x.id===selProgram.id)||selProgram} exercises={exercises} setPrograms={setPrograms} go={setCoachView} setSel={setSelProgram}/>}
        {coachView==="new-program"&&<NewProgram exercises={exercises} setPrograms={setPrograms} go={setCoachView}/>}
        {coachView==="exercises"&&<ExLib exercises={exercises} setExercises={setExercises} go={setCoachView}/>}
        {coachView==="new-exercise"&&<NewEx setExercises={setExercises} go={setCoachView}/>}
        {coachView==="ai-coach"&&<AICoach exercises={exercises} setPrograms={setPrograms} go={setCoachView}/>}
      </div>
      <CoachNav view={coachView} setView={setCoachView}/>
    </Shell>
  );
}

const IS_MOBILE = window.innerWidth <= 480;
const Shell=({children,css:c})=>(
  <div style={{background:IS_MOBILE?"#080808":"#111",minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:IS_MOBILE?"flex-start":"center"}}>
    <style>{c}</style>
    {!IS_MOBILE&&<div style={{width:390,height:844,borderRadius:44,background:"#1a1a1a",boxShadow:"0 40px 120px #000a, inset 0 0 0 1px #333",padding:"12px",flexShrink:0,position:"relative"}}>
      <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",width:120,height:30,background:"#1a1a1a",borderRadius:"0 0 18px 18px",zIndex:10}}/>
      <div style={{width:"100%",height:"100%",borderRadius:34,overflow:"hidden",display:"flex",flexDirection:"column",background:G.bg}}>
        <div style={{height:44,flexShrink:0,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:6}}>
          <div style={{fontSize:11,color:"#888",fontFamily:G.font,letterSpacing:.5}}>{new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>
          {children}
        </div>
      </div>
    </div>}
    {IS_MOBILE&&<div style={{background:G.bg,width:"100vw",minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:G.font,color:G.white,margin:"0 auto"}}>
      {children}
    </div>}
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin}){
  const [code,setCode]=useState("");
  const [err,setErr]=useState(false);
  const attempt=()=>{if(!onLogin(code)){setErr(true);setTimeout(()=>setErr(false),2500);}};
  const loginContent=(
    <>
      <div style={{marginBottom:36,textAlign:"center"}} className="fu">
        <div style={{width:74,height:74,borderRadius:22,background:`linear-gradient(135deg,${G.goldLight}20,${G.gold}40)`,border:`1.5px solid ${G.gold}55`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:32}}>⚡</div>
        <div style={{fontFamily:G.fontD,fontSize:36,fontWeight:800,color:G.white,letterSpacing:-1}}>WANDY<span style={{color:G.goldLight}}> COACH</span></div>
        <div style={{fontSize:11,color:G.grey,marginTop:5,letterSpacing:3,textTransform:"uppercase"}}>Espace personnel</div>
      </div>
      <div style={{width:"100%"}} className="fu">
        <Label>Code d'accès</Label>
        <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr(false);}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Entre ton code..."
          style={{width:"100%",background:G.bg3,border:`1.5px solid ${err?G.red:G.border}`,borderRadius:10,padding:"14px 16px",color:G.white,fontSize:18,outline:"none",letterSpacing:3,textAlign:"center",marginBottom:8,transition:"border .2s"}}/>
        {err&&<div style={{color:G.red,fontSize:12,textAlign:"center",marginBottom:8}}>Code invalide — contacte ton coach.</div>}
        <div style={{height:8}}/>
        <Btn onClick={attempt} disabled={!code}>Accéder →</Btn>
      </div>
    </>
  );
  return(
    <div style={{background:"#111",minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:IS_MOBILE?"flex-start":"center"}}>
      <style>{css}</style>
      {!IS_MOBILE&&<div style={{width:390,height:844,borderRadius:44,background:"#1a1a1a",boxShadow:"0 40px 120px #000a, inset 0 0 0 1px #333",padding:"12px",flexShrink:0,position:"relative"}}>
        <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",width:120,height:30,background:"#1a1a1a",borderRadius:"0 0 18px 18px",zIndex:10}}/>
        <div style={{width:"100%",height:"100%",borderRadius:34,overflow:"hidden",background:G.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28,fontFamily:G.font,color:G.white}}>
          {loginContent}
        </div>
      </div>}
      {IS_MOBILE&&<div style={{background:G.bg,width:"100vw",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"28px 24px",fontFamily:G.font,color:G.white}}>
        <div style={{width:"100%",maxWidth:400}}>
          {loginContent}
        </div>
      </div>}
    </div>
  );
}

// ─── COACH NAV ────────────────────────────────────────────────────────────────
function CoachNav({view,setView}){
  const items=[{key:"dashboard",icon:"◈",label:"Accueil"},{key:"clients",icon:"◉",label:"Clients"},{key:"programs",icon:"▦",label:"Prog."},{key:"exercises",icon:"⊕",label:"Exercices"},{key:"ai-coach",icon:"✦",label:"IA Coach"}];
  const ak=v=>{if(["client-detail","new-client"].includes(v))return"clients";if(["program-detail","new-program","edit-program"].includes(v))return"programs";if(v==="new-exercise")return"exercises";return v;};
  return(
    <nav style={{flexShrink:0,width:"100%",background:G.bg2,borderTop:`1px solid ${G.border}`,display:"flex",zIndex:100}}>
      {items.map(({key,icon,label})=>{
        const a=ak(view)===key;
        const isAI=key==="ai-coach";
        return<button key={key} onClick={()=>setView(key)} style={{flex:1,padding:"12px 0 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:a?(isAI?G.goldLight:G.goldLight):isAI?G.gold+"88":G.greyDim,fontSize:10,fontWeight:600,letterSpacing:.5,transition:"color .2s",borderTop:a?`2px solid ${G.goldLight}`:"2px solid transparent"}}>
          <span style={{fontSize:isAI?20:18}}>{icon}</span><span>{label}</span>
        </button>;
      })}
    </nav>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({clients,programs,exercises,go,sel,selP,onLogout}){
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:28}}>
        <div>
          <div style={{fontSize:11,color:G.gold,fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Bienvenue</div>
          <div style={{fontFamily:G.fontD,fontSize:30,fontWeight:800,letterSpacing:-1,lineHeight:1}} className="gl">TABLEAU DE BORD</div>
        </div>
        <button onClick={onLogout} style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"7px 12px",color:G.grey,fontSize:12,cursor:"pointer"}}>Déconnexion</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28}}>
        {[[clients.length,"Clients"],[exercises.length,"Exercices"]].map(([v,l])=>(
          <div key={l} style={{background:G.bg2,borderRadius:12,padding:"16px 10px",textAlign:"center",border:`1px solid ${G.border}`}}>
            <div style={{fontFamily:G.fontD,fontSize:34,fontWeight:800,color:G.goldLight,lineHeight:1}}>{v}</div>
            <div style={{fontSize:10,color:G.grey,letterSpacing:1,textTransform:"uppercase",marginTop:4}}>{l}</div>
          </div>
        ))}
      </div>
      <SH title="Clients actifs" onMore={()=>go("clients")}/>
      {clients.map((c,i)=><CRow key={c.id} c={c} delay={i*50} onClick={()=>sel(c)}/>)}
      <div style={{height:16}}/>
      <SH title="Programmes récents" onMore={()=>go("programs")}/>
      {programs.slice(0,2).map(p=>(
        <div key={p.id} onClick={()=>selP(p)} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[p.level,`${p.weeks.length} sem.`,`${p.weeks[0]?.days.length||0} j/sem`].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}
              </div>
            </div>
            <div style={{color:G.greyDim,fontSize:20}}>›</div>
          </div>
        </div>
      ))}
    </div>
  );
}
const SH=({title,onMore})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
    <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>{title}</div>
    {onMore&&<button onClick={onMore} style={{background:"none",border:"none",color:G.goldLight,cursor:"pointer",fontSize:12,fontWeight:600}}>Voir tout</button>}
  </div>
);
const CRow=({c,delay=0,onClick,showCode})=>(
  <div onClick={onClick} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,borderLeft:`3px solid ${c.color}`,cursor:"pointer",animationDelay:`${delay}ms`}} className="fu">
    <div style={{display:"flex",alignItems:"center",gap:14}}>
      <Av name={c.name} color={c.color} size={44}/>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:15}}>{c.name}</div>
        <div style={{fontSize:12,color:G.grey,marginTop:2}}>{c.goal} · {c.sessions} séances</div>
        {showCode&&<div style={{fontSize:11,color:G.gold,marginTop:4,fontFamily:"monospace",letterSpacing:1.5}}>{c.code}</div>}
      </div>
      <div style={{color:G.greyDim,fontSize:20}}>›</div>
    </div>
  </div>
);

// ─── CLIENTS LIST ─────────────────────────────────────────────────────────────
function ClientsList({clients,go,sel}){
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <PageH title="CLIENTS" subtitle={`${clients.length} actifs`} action={<BtnSm onClick={()=>go("new-client")}>+ Nouveau</BtnSm>}/>
      {clients.map((c,i)=><CRow key={c.id} c={c} delay={i*50} onClick={()=>sel(c)} showCode/>)}
    </div>
  );
}

// ─── CLIENT DETAIL (coach side) ───────────────────────────────────────────────
function ClientDetail({client,clients,setClients,setPrograms,setSel,programs,exercises,go,selP}){
  const [tab,setTab]=useState("program");
  const [showLog,setShowLog]=useState(false);
  const [logForm,setLogForm]=useState({date:new Date().toISOString().split("T")[0],programId:"",weekIdx:"",dayIdx:"",completed:true,notes:""});
  const [nutForm,setNutForm]=useState({...client.nutrition});
  const [editNut,setEditNut]=useState(false);

  const upd=fn=>{setClients(p=>p.map(c=>c.id===client.id?fn(c):c));setSel(fn(client));};
  const removeProgram=pid=>upd(c=>({...c,programs:c.programs.filter(x=>x!==pid)}));
  const toggle=pid=>upd(c=>({...c,programs:c.programs.includes(pid)?c.programs.filter(x=>x!==pid):[...c.programs,pid]}));
  const copyAndEdit=(p)=>{
    const copy={...JSON.parse(JSON.stringify(p)),id:Date.now(),name:`${p.name} (${client.name.split(" ")[0]})`,_copy:true};
    setPrograms(prev=>[...prev,copy]);
    upd(c=>({...c,programs:[...c.programs.filter(x=>x!==p.id),copy.id]}));
    selP(copy);
  };
  const saveNut=()=>{upd(c=>({...c,nutrition:nutForm}));setEditNut(false);};
  const saveLog=()=>{
    const prog=programs.find(p=>p.id===Number(logForm.programId));
    const week=prog?.weeks[Number(logForm.weekIdx)];
    const day=week?.days[Number(logForm.dayIdx)];
    const exEntries=(day?.exercises||[]).map(pe=>({exId:pe.exId,name:exercises.find(e=>e.id===pe.exId)?.name||"",sets:Array.from({length:pe.sets},(_,i)=>({reps:pe.reps,load:pe.targetLoad||""}))}));
    upd(c=>({...c,sessions:c.sessions+(logForm.completed?1:0),sessionLogs:[{id:uid(),date:logForm.date,programId:Number(logForm.programId),weekIdx:Number(logForm.weekIdx),dayIdx:Number(logForm.dayIdx),dayLabel:day?.label||"",completed:logForm.completed,notes:logForm.notes,exercises:exEntries},...c.sessionLogs]}));
    setShowLog(false);
  };

  const assigned=programs.filter(p=>client.programs.includes(p.id));
  const unassigned=programs.filter(p=>!client.programs.includes(p.id));
  const selProg=programs.find(p=>p.id===Number(logForm.programId));
  const selWeek=selProg?.weeks[Number(logForm.weekIdx)];

  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("clients")} label="Clients"/>
      <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
        <Av name={client.name} color={client.color} size={54}/>
        <div style={{flex:1}}>
          <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.5}}>{client.name}</div>
          <div style={{fontSize:12,color:G.grey,marginTop:2}}>{client.goal} · {client.sessions} séances</div>
          <div style={{display:"inline-block",marginTop:6,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:5,padding:"2px 10px",fontSize:11,color:G.gold,fontFamily:"monospace",letterSpacing:2}}>{client.code}</div>
        </div>
      </div>

      <div style={{display:"flex",background:G.bg2,borderRadius:10,padding:3,marginBottom:20,gap:3}}>
        {[["program","Programme"],["nutrition","Nutrition"],["suivi","Suivi"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"8px 0",background:tab===k?G.bg4:"transparent",color:tab===k?G.goldLight:G.grey,border:tab===k?`1px solid ${G.border}`:"1px solid transparent",borderRadius:8,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .2s"}}>{l}</button>
        ))}
      </div>

      {tab==="program"&&(
        <>
          {assigned.length===0&&<Empty text="Aucun programme assigné"/>}
          {assigned.map(p=>(
            <div key={p.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontWeight:700,flex:1}}>{p.name}{p._copy&&<span style={{fontSize:10,color:G.gold,marginLeft:8,fontWeight:400}}>copie perso</span>}</div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <BtnSm onClick={()=>copyAndEdit(p)}>✏️</BtnSm>
                  <BtnSm variant="danger" onClick={()=>toggle(p.id)}>Retirer</BtnSm>
                </div>
              </div>
              <div style={{fontSize:12,color:G.grey,marginBottom:10}}>{p.weeks.length} semaine{p.weeks.length>1?"s":""} · {p.weeks[0]?.days.length||0} jours/sem</div>
              <BtnSm onClick={()=>selP(p)}>Voir le programme →</BtnSm>
            </div>
          ))}
          {unassigned.length>0&&<>
            <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",margin:"16px 0 10px"}}>Assigner un programme</div>
            {unassigned.map(p=>(
              <div key={p.id} style={{background:G.bg2,borderRadius:10,padding:14,marginBottom:10,border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:600}}>{p.name}</div><div style={{fontSize:12,color:G.grey}}>{p.category} · {p.level}</div></div>
                <BtnSm onClick={()=>toggle(p.id)}>+ Assigner</BtnSm>
              </div>
            ))}
          </>}
        </>
      )}

      {tab==="nutrition"&&(
        <div style={{background:G.bg2,borderRadius:12,padding:18,border:`1px solid ${G.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:700}}>Objectifs nutritionnels</div>
            <BtnSm variant={editNut?"ghost":"gold"} onClick={()=>{setNutForm({...client.nutrition});setEditNut(!editNut);}}>{editNut?"Annuler":"Modifier"}</BtnSm>
          </div>
          {editNut?(
            <>{[["Calories (kcal)","calories"],["Protéines (g)","proteins"],["Glucides (g)","carbs"],["Lipides (g)","fats"]].map(([l,k])=>(
              <Inp key={k} label={l} type="number" value={nutForm[k]} onChange={e=>setNutForm(p=>({...p,[k]:Number(e.target.value)}))}/>
            ))}
            <Txa label="Notes" value={nutForm.notes} placeholder="Allergies, préférences..." onChange={e=>setNutForm(p=>({...p,notes:e.target.value}))}/>
            <Btn onClick={saveNut}>Enregistrer</Btn></>
          ):(
            <><div style={{textAlign:"center",padding:"12px 0 20px"}}>
              <div style={{fontFamily:G.fontD,fontSize:56,fontWeight:800,color:G.goldLight,lineHeight:1}}>{nutForm.calories}</div>
              <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:4}}>kcal / jour</div>
            </div>
            <MacroBar label="Protéines" value={nutForm.proteins} max={300} color={G.goldLight}/>
            <MacroBar label="Glucides" value={nutForm.carbs} max={500} color={G.gold}/>
            <MacroBar label="Lipides" value={nutForm.fats} max={150} color="#C9A84C66"/>
            {nutForm.notes&&<div style={{marginTop:16,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {nutForm.notes}</div>}</>
          )}
        </div>
      )}

      {tab==="suivi"&&(
        <>
          <Btn onClick={()=>setShowLog(true)} style={{marginBottom:16}}>+ Enregistrer une séance</Btn>
          {client.sessionLogs.length===0&&<Empty text="Aucune séance enregistrée"/>}
          {client.sessionLogs.map((log,i)=><LogCard key={log.id||i} log={log} programs={programs}/>)}
        </>
      )}

      {showLog&&(
        <Modal onClose={()=>setShowLog(false)} title="Nouvelle séance">
          <Inp label="Date" type="date" value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))}/>
          <div style={{marginBottom:14}}>
            <Label>Programme</Label>
            <select value={logForm.programId} onChange={e=>setLogForm(p=>({...p,programId:e.target.value,weekIdx:"",dayIdx:""}))} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:14,outline:"none"}}>
              <option value="">Choisir...</option>
              {assigned.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {selProg&&<div style={{marginBottom:14}}>
            <Label>Semaine</Label>
            <select value={logForm.weekIdx} onChange={e=>setLogForm(p=>({...p,weekIdx:e.target.value,dayIdx:""}))} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:14,outline:"none"}}>
              <option value="">Choisir...</option>
              {selProg.weeks.map((w,i)=><option key={i} value={i}>{w.label}</option>)}
            </select>
          </div>}
          {selWeek&&<div style={{marginBottom:14}}>
            <Label>Séance</Label>
            <select value={logForm.dayIdx} onChange={e=>setLogForm(p=>({...p,dayIdx:e.target.value}))} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:14,outline:"none"}}>
              <option value="">Choisir...</option>
              {selWeek.days.map((d,i)=><option key={i} value={i}>{d.label}</option>)}
            </select>
          </div>}
          <Inp label="Notes" placeholder="Observations..." value={logForm.notes} onChange={e=>setLogForm(p=>({...p,notes:e.target.value}))}/>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[true,false].map(v=>(
              <button key={String(v)} onClick={()=>setLogForm(p=>({...p,completed:v}))} style={{flex:1,padding:"10px 0",background:logForm.completed===v?(v?G.green+"22":G.red+"22"):G.bg3,color:logForm.completed===v?(v?G.green:G.red):G.grey,border:`1px solid ${logForm.completed===v?(v?G.green:G.red):G.border}`,borderRadius:8,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                {v?"✓ Complétée":"✗ Manquée"}
              </button>
            ))}
          </div>
          <Btn onClick={saveLog} disabled={!logForm.programId}>Enregistrer</Btn>
        </Modal>
      )}
    </div>
  );
}

// ─── NEW CLIENT ───────────────────────────────────────────────────────────────
function NewClient({setClients,go}){
  const [form,setForm]=useState({name:"",goal:"",color:G.goldLight});
  const colors=[G.goldLight,G.gold,"#C9A84C","#8a7040","#a08030"];
  const create=()=>{
    setClients(p=>[...p,{...form,id:Date.now(),code:genCode(form.name),since:new Date().toLocaleDateString("fr-FR",{month:"short",year:"numeric"}),sessions:0,programs:[],nutrition:{calories:2000,proteins:150,carbs:200,fats:65,notes:""},sessionLogs:[]}]);
    go("clients");
  };
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("clients")} label="Clients"/>
      <PageH title="NOUVEAU CLIENT"/>
      <Inp label="Nom complet" placeholder="Sophie Martin" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
      <Inp label="Objectif" placeholder="Perte de poids..." value={form.goal} onChange={e=>setForm(p=>({...p,goal:e.target.value}))}/>
      <div style={{marginBottom:20}}>
        <Label>Couleur</Label>
        <div style={{display:"flex",gap:10}}>
          {colors.map(c=><div key={c} onClick={()=>setForm(p=>({...p,color:c}))} style={{width:34,height:34,borderRadius:9,background:c,cursor:"pointer",border:form.color===c?"2.5px solid #fff":"2.5px solid transparent",transition:"border .2s"}}/>)}
        </div>
      </div>
      {form.name&&<div style={{background:G.bg3,borderRadius:10,padding:14,marginBottom:20,border:`1px solid ${G.border}`}}>
        <div style={{fontSize:11,color:G.grey,marginBottom:4}}>Code d'accès généré</div>
        <div style={{fontFamily:"monospace",fontSize:22,color:G.goldLight,letterSpacing:3}}>{genCode(form.name)}</div>
        <div style={{fontSize:11,color:G.greyDim,marginTop:4}}>À transmettre à ton client</div>
      </div>}
      <Btn onClick={create} disabled={!form.name||!form.goal}>Créer le client</Btn>
    </div>
  );
}

// ─── PROGRAMS LIST ────────────────────────────────────────────────────────────
function ProgramsList({programs,setPrograms,setClients,exercises,go,sel,onEdit}){
  const deleteProgram=(pid)=>{
    setPrograms(p=>p.filter(x=>x.id!==pid));
    setClients(cs=>cs.map(c=>({...c,programs:c.programs.filter(x=>x!==pid)})));
  };
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <PageH title="PROGRAMMES" subtitle={`${programs.length} créés`} action={<BtnSm onClick={()=>go("new-program")}>+ Nouveau</BtnSm>}/>
      {programs.length===0&&<Empty text="Aucun programme créé"/>}
      {programs.map((p,i)=>(
        <div key={p.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,animationDelay:`${i*50}ms`}} className="fu">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>sel(p)}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[p.category,p.level,`${p.weeks.length} sem.`,`${p.weeks[0]?.days.length||0} j/sem`].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:10}}>
              <BtnSm onClick={()=>onEdit(p)}>✏️</BtnSm>
              <BtnSm onClick={()=>sel(p)}>›</BtnSm>
              <BtnSm variant="danger" onClick={()=>deleteProgram(p.id)}>✕</BtnSm>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PROGRAM DETAIL (coach) ───────────────────────────────────────────────────
function ProgramDetail({program,exercises,go,onEdit,client}){
  const [weekIdx,setWeekIdx]=useState(0);
  const [dayIdx,setDayIdx]=useState(0);
  const [playing,setPlaying]=useState(null);
  const week=program.weeks[weekIdx];
  const day=week?.days[dayIdx];
  const dayLog=client?.sessionLogs?.find(l=>l.programId===program.id&&l.weekIdx===weekIdx&&l.dayIdx===dayIdx&&l.completed);
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go(client?"client-detail":"programs")} label={client?client.name.split(" ")[0]:"Programmes"}/>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:G.fontD,fontSize:26,fontWeight:800,letterSpacing:-1}} className="gl">{program.name}</div>
          <div style={{fontSize:12,color:G.grey,marginTop:6}}>{program.weeks.length} semaine{program.weeks.length>1?"s":""}</div>
        </div>
        <BtnSm onClick={()=>onEdit(program)}>✏️ Modifier</BtnSm>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",marginTop:10}}>
        {[program.category,program.level].filter(Boolean).map(t=><Tag key={t} text={t}/>)}
      </div>

      {/* Week tabs */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:4}}>
        {program.weeks.map((w,i)=>(
          <button key={i} onClick={()=>{setWeekIdx(i);setDayIdx(0);setPlaying(null);}} style={{flexShrink:0,padding:"7px 14px",background:weekIdx===i?G.goldLight+"22":G.bg2,color:weekIdx===i?G.goldLight:G.grey,border:`1px solid ${weekIdx===i?G.goldLight+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {w.label}
          </button>
        ))}
      </div>

      {/* Day tabs */}
      {week&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:20,marginTop:10}}>
        {week.days.map((d,i)=>{
          const done=client?.sessionLogs?.some(l=>l.programId===program.id&&l.weekIdx===weekIdx&&l.dayIdx===i&&l.completed);
          return(
            <button key={i} onClick={()=>{setDayIdx(i);setPlaying(null);}} style={{flexShrink:0,padding:"6px 14px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:done?G.green:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":done?G.green+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {done&&<span style={{marginRight:4}}>✓</span>}{d.label} <span style={{fontSize:11,opacity:.5}}>({d.exercises.length})</span>
            </button>
          );
        })}
      </div>}

      {dayLog&&(
        <div style={{background:G.green+"15",border:`1px solid ${G.green}44`,borderRadius:10,padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>✓</span>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:G.green}}>Séance complétée</div>
            <div style={{fontSize:11,color:G.grey,marginTop:2}}>{dayLog.date}{dayLog.notes?` · "${dayLog.notes}"`:""}</div>
          </div>
        </div>
      )}
      {day&&day.exercises.map((pe,i)=>{
        const ex=exercises.find(e=>e.id===pe.exId);
        if(!ex)return null;
        const key=`${weekIdx}-${dayIdx}-${i}`;
        const clientEx=dayLog?.exercises?.find(e=>e.exId===pe.exId);
        return(
          <div key={i} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${clientEx?G.green+"44":G.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:15}}><span style={{color:G.gold,fontFamily:G.fontD,marginRight:8}}>{i+1}.</span>{ex.name}</div>
                <div style={{fontSize:12,color:G.grey,marginTop:4}}>{pe.sets} séries × {pe.reps} — repos {pe.rest}</div>
                {pe.targetLoad&&<div style={{fontSize:12,color:G.goldLight,marginTop:3}}>🎯 Charge cible : {pe.targetLoad}</div>}
                {ex.notes&&<div style={{fontSize:12,color:G.gold+"88",marginTop:4}}>📝 {ex.notes}</div>}
                <div style={{marginTop:6}}><Tag text={ex.muscle} color={G.grey}/></div>
              </div>
              {ex.videoUrl&&<BtnSm onClick={()=>setPlaying(playing===key?null:key)}>{playing===key?"▼":"▶"}</BtnSm>}
            </div>
            {playing===key&&ex.videoUrl&&(
              <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:8,overflow:"hidden",background:"#000",marginTop:10}}>
                <iframe style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={ex.videoUrl} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
              </div>
            )}
            {clientEx&&(
              <div style={{marginTop:10,background:G.bg3,borderRadius:8,padding:10,border:`1px solid ${G.green}33`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <div style={{fontSize:10,color:G.green,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>Résultats client</div>
                  {clientEx.sensation&&<span style={{fontSize:18}} title="Ressenti">{clientEx.sensation}</span>}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {clientEx.sets.map((s,si)=>(
                    <div key={si} style={{background:G.bg4,borderRadius:6,padding:"5px 10px",border:`1px solid ${G.border}`,textAlign:"center",minWidth:58}}>
                      <div style={{fontSize:10,color:G.grey,marginBottom:2}}>S{si+1}</div>
                      <div style={{fontSize:13,fontWeight:800,color:s.load?G.goldLight:G.greyDim}}>{s.load||"—"}</div>
                      <div style={{fontSize:10,color:G.grey}}>{s.reps}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── NEW PROGRAM ──────────────────────────────────────────────────────────────
function NewProgram({exercises,setPrograms,go}){
  const [form,setForm]=useState({name:"",category:"",level:"Intermédiaire",weeks:[{label:"Semaine 1",days:[{label:"Séance A",exercises:[]}]}]});
  const [weekIdx,setWeekIdx]=useState(0);
  const [dayIdx,setDayIdx]=useState(0);
  const [picker,setPicker]=useState(false);
  const [filter,setFilter]=useState("Tous");

  const week=form.weeks[weekIdx];
  const day=week?.days[dayIdx];
  const filtered=exercises.filter(e=>filter==="Tous"||e.muscle===filter);

  const addWeek=()=>{
    if(form.weeks.length>=12)return;
    const n=form.weeks.length+1;
    setForm(p=>({...p,weeks:[...p.weeks,{label:`Semaine ${n}`,days:[{label:"Séance A",exercises:[]}]}]}));
    setWeekIdx(form.weeks.length);setDayIdx(0);
  };
  const removeWeek=wi=>{
    if(form.weeks.length<=1)return;
    setForm(p=>({...p,weeks:p.weeks.filter((_,i)=>i!==wi)}));
    setWeekIdx(Math.max(0,weekIdx-(wi<=weekIdx?1:0)));setDayIdx(0);
  };
  const duplicateWeek=()=>{
    if(form.weeks.length>=12)return;
    const copy=JSON.parse(JSON.stringify(form.weeks[weekIdx]));
    copy.label=copy.label+" (copie)";
    const nw=[...form.weeks];
    nw.splice(weekIdx+1,0,copy);
    setForm(p=>({...p,weeks:nw}));
    setWeekIdx(weekIdx+1);setDayIdx(0);
  };
  const addDay=()=>{
    if(week.days.length>=7)return;
    const labels=["A","B","C","D","E","F","G"];
    const newDay={label:`Séance ${labels[week.days.length]||week.days.length+1}`,exercises:[]};
    setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:[...w.days,newDay]})}));
    setDayIdx(week.days.length);
  };
  const removeDay=di=>{
    if(week.days.length<=1)return;
    setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:w.days.filter((_,j)=>j!==di)})}));
    setDayIdx(Math.max(0,dayIdx-(di<=dayIdx?1:0)));
  };
  const updateLabel=(type,idx,val)=>{
    if(type==="week") setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==idx?w:{...w,label:val})}));
    else setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:w.days.map((d,j)=>j!==idx?d:{...d,label:val})})}));
  };
  const toggleEx=ex=>{
    setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.find(e=>e.exId===ex.id)?d.exercises.filter(e=>e.exId!==ex.id):[...d.exercises,{exId:ex.id,sets:3,reps:"10",rest:"60s",targetLoad:""}]})})}));
  };
  const updateExField=(exId,field,val)=>{
    setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.map(e=>e.exId===exId?{...e,[field]:val}:e)})})}));
  };
  const moveEx=(from,to)=>{
    setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:(()=>{const a=[...d.exercises];const[item]=a.splice(from,1);a.splice(to,0,item);return a;})()})})}));
  };
  const totalEx=form.weeks.reduce((a,w)=>a+w.days.reduce((b,d)=>b+d.exercises.length,0),0);
  const create=()=>{setPrograms(p=>[...p,{...form,id:Date.now()}]);go("programs");};

  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("programs")} label="Programmes"/>
      <PageH title="NOUVEAU PROGRAMME"/>
      <Inp label="Nom du programme" placeholder="Full Body 3j/sem" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Inp label="Catégorie" placeholder="Force, PPL..." value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}/>
        <div style={{marginBottom:14}}>
          <Label>Niveau</Label>
          <select value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:13,outline:"none"}}>
            {["Débutant","Intermédiaire","Avancé"].map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* WEEKS */}
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <Label>Semaines ({form.weeks.length}/12)</Label>
          {form.weeks.length<12&&<BtnSm onClick={addWeek}>+ Semaine</BtnSm>}
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6}}>
          {form.weeks.map((w,i)=>(
            <button key={i} onClick={()=>{setWeekIdx(i);setDayIdx(0);}} style={{flexShrink:0,padding:"7px 12px",background:weekIdx===i?G.goldLight+"22":G.bg3,color:weekIdx===i?G.goldLight:G.grey,border:`1px solid ${weekIdx===i?G.goldLight+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              S{i+1}
              <span style={{marginLeft:4,background:weekIdx===i?G.goldLight:G.greyDim,color:weekIdx===i?G.bg:G.bg,borderRadius:99,fontSize:10,padding:"1px 5px",fontWeight:800}}>{w.days.reduce((a,d)=>a+d.exercises.length,0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* WEEK EDITOR */}
      <div style={{background:G.bg2,borderRadius:12,padding:16,border:`1px solid ${G.border}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <input value={week?.label||""} onChange={e=>updateLabel("week",weekIdx,e.target.value)} style={{background:"transparent",border:"none",color:G.goldLight,fontSize:15,fontWeight:800,outline:"none",fontFamily:G.fontD,letterSpacing:.5,width:"55%"}}/>
          <div style={{display:"flex",gap:6}}>
            {form.weeks.length>1&&<BtnSm variant="danger" onClick={()=>removeWeek(weekIdx)}>✕</BtnSm>}
            {form.weeks.length<12&&<BtnSm variant="ghost" onClick={duplicateWeek}>⧉ Dupliquer</BtnSm>}
            {week&&week.days.length<7&&<BtnSm onClick={addDay}>+ Jour</BtnSm>}
          </div>
        </div>

        {/* DAYS tabs */}
        {week&&<div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
          {week.days.map((d,i)=>(
            <button key={i} onClick={()=>setDayIdx(i)} style={{flexShrink:0,padding:"5px 12px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":G.border}`,borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {d.label}
              <span style={{marginLeft:4,fontSize:10,opacity:.6}}>({d.exercises.length})</span>
            </button>
          ))}
        </div>}

        {/* DAY EDITOR */}
        {day&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <input value={day.label} onChange={e=>updateLabel("day",dayIdx,e.target.value)} style={{background:"transparent",border:"none",color:G.white,fontSize:14,fontWeight:700,outline:"none",width:"55%"}}/>
            <div style={{display:"flex",gap:6}}>
              {week.days.length>1&&<BtnSm variant="danger" onClick={()=>removeDay(dayIdx)}>✕</BtnSm>}
              <BtnSm onClick={()=>{setFilter("Tous");setPicker(true);}}>+ Exercices</BtnSm>
            </div>
          </div>
          {day.exercises.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:G.greyDim,fontSize:13}}>Aucun exercice — clique sur "+ Exercices"</div>}
          {day.exercises.map((pe,i)=>{
            const ex=exercises.find(e=>e.id===pe.exId);
            return(
              <div key={pe.exId} style={{background:G.bg3,borderRadius:9,padding:12,marginBottom:8,border:`1px solid ${G.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>{i+1}. {ex?.name}</div>
                  <div style={{display:"flex",gap:4}}>
                    {i>0&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i-1)}>▲</BtnSm>}
                    {i<day.exercises.length-1&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i+1)}>▼</BtnSm>}
                    <BtnSm variant="danger" onClick={()=>toggleEx(ex)}>✕</BtnSm>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  {[["Séries","sets","number"],["Reps","reps","text"],["Repos","rest","text"],["Charge cible","targetLoad","text"]].map(([l,k,t])=>(
                    <div key={k}>
                      <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                      <input type={t} value={pe[k]} placeholder={k==="targetLoad"?"optionnel":""} onChange={e=>updateExField(pe.exId,k,t==="number"?Number(e.target.value):e.target.value)}
                        style={{width:"100%",background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"6px 7px",color:G.white,fontSize:12,outline:"none"}}/>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>}
      </div>

      <Btn onClick={create} disabled={!form.name||totalEx===0}>
        Créer · {form.weeks.length} sem. · {totalEx} exercices au total
      </Btn>

      {picker&&(
        <Modal onClose={()=>setPicker(false)} title={`Exercices — ${day?.label||""}`}>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
            {MUSCLES.map(m=>(
              <button key={m} onClick={()=>setFilter(m)} style={{flexShrink:0,padding:"5px 12px",background:filter===m?G.goldLight+"22":G.bg3,color:filter===m?G.goldLight:G.grey,border:`1px solid ${filter===m?G.goldLight+"44":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{m}</button>
            ))}
          </div>
          {filtered.map(ex=>{
            const sel=!!day?.exercises.find(e=>e.exId===ex.id);
            return(
              <div key={ex.id} onClick={()=>toggleEx(ex)} style={{background:sel?G.goldLight+"0d":G.bg3,borderRadius:10,padding:12,marginBottom:8,border:`1px solid ${sel?G.goldLight+"55":G.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:600,fontSize:14}}>{ex.name}</div>
                  <div style={{fontSize:11,color:G.grey,marginTop:2}}>{ex.muscle} · {ex.equipment}</div>
                </div>
                <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${sel?G.goldLight:G.greyDim}`,background:sel?G.goldLight:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:G.bg,fontSize:13,fontWeight:800}}>{sel?"✓":""}</div>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

// ─── EDIT PROGRAM ─────────────────────────────────────────────────────────────
function EditProgram({program,exercises,setPrograms,go,setSel}){
  const [form,setForm]=useState(JSON.parse(JSON.stringify(program)));
  const [weekIdx,setWeekIdx]=useState(0);
  const [dayIdx,setDayIdx]=useState(0);
  const [picker,setPicker]=useState(false);
  const [filter,setFilter]=useState("Tous");

  const week=form.weeks[weekIdx];
  const day=week?.days[dayIdx];
  const filtered=exercises.filter(e=>filter==="Tous"||e.muscle===filter);

  const addWeek=()=>{if(form.weeks.length>=12)return;const n=form.weeks.length+1;setForm(p=>({...p,weeks:[...p.weeks,{label:`Semaine ${n}`,days:[{label:"Séance A",exercises:[]}]}]}));setWeekIdx(form.weeks.length);setDayIdx(0);};
  const removeWeek=wi=>{if(form.weeks.length<=1)return;setForm(p=>({...p,weeks:p.weeks.filter((_,i)=>i!==wi)}));setWeekIdx(Math.max(0,weekIdx-(wi<=weekIdx?1:0)));setDayIdx(0);};
  const duplicateWeek=()=>{if(form.weeks.length>=12)return;const copy=JSON.parse(JSON.stringify(form.weeks[weekIdx]));copy.label=copy.label+" (copie)";const nw=[...form.weeks];nw.splice(weekIdx+1,0,copy);setForm(p=>({...p,weeks:nw}));setWeekIdx(weekIdx+1);setDayIdx(0);};
  const addDay=()=>{if(week.days.length>=7)return;const labels=["A","B","C","D","E","F","G"];const nd={label:`Séance ${labels[week.days.length]||week.days.length+1}`,exercises:[]};setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:[...w.days,nd]})}));setDayIdx(week.days.length);};
  const removeDay=di=>{if(week.days.length<=1)return;setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:w.days.filter((_,j)=>j!==di)})}));setDayIdx(Math.max(0,dayIdx-(di<=dayIdx?1:0)));};
  const updateLabel=(type,idx,val)=>{if(type==="week")setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==idx?w:{...w,label:val})}));else setForm(p=>({...p,weeks:p.weeks.map((w,i)=>i!==weekIdx?w:{...w,days:w.days.map((d,j)=>j!==idx?d:{...d,label:val})})}));};
  const toggleEx=ex=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.find(e=>e.exId===ex.id)?d.exercises.filter(e=>e.exId!==ex.id):[...d.exercises,{exId:ex.id,sets:3,reps:"10",rest:"60s",targetLoad:""}]})})}));};
  const updateExField=(exId,field,val)=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.map(e=>e.exId===exId?{...e,[field]:val}:e)})})}));};
  const moveEx=(from,to)=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:(()=>{const a=[...d.exercises];const[item]=a.splice(from,1);a.splice(to,0,item);return a;})()})})}));};

  const save=()=>{
    setPrograms(p=>p.map(x=>x.id===form.id?form:x));
    setSel(form);
    go("program-detail");
  };

  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("program-detail")} label="Programme"/>
      <PageH title="MODIFIER LE PROGRAMME"/>
      <Inp label="Nom du programme" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Inp label="Catégorie" value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}/>
        <div style={{marginBottom:14}}>
          <Label>Niveau</Label>
          <select value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:13,outline:"none"}}>
            {["Débutant","Intermédiaire","Avancé"].map(l=><option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <Label>Semaines ({form.weeks.length}/12)</Label>
          {form.weeks.length<12&&<BtnSm onClick={addWeek}>+ Semaine</BtnSm>}
        </div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6}}>
          {form.weeks.map((w,i)=>(
            <button key={i} onClick={()=>{setWeekIdx(i);setDayIdx(0);}} style={{flexShrink:0,padding:"7px 12px",background:weekIdx===i?G.goldLight+"22":G.bg3,color:weekIdx===i?G.goldLight:G.grey,border:`1px solid ${weekIdx===i?G.goldLight+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              S{i+1}<span style={{marginLeft:4,fontSize:10,opacity:.6}}>({w.days.reduce((a,d)=>a+d.exercises.length,0)})</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{background:G.bg2,borderRadius:12,padding:16,border:`1px solid ${G.border}`,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <input value={week?.label||""} onChange={e=>updateLabel("week",weekIdx,e.target.value)} style={{background:"transparent",border:"none",color:G.goldLight,fontSize:15,fontWeight:800,outline:"none",fontFamily:G.fontD,letterSpacing:.5,width:"55%"}}/>
          <div style={{display:"flex",gap:6}}>
            {form.weeks.length>1&&<BtnSm variant="danger" onClick={()=>removeWeek(weekIdx)}>✕</BtnSm>}
            {form.weeks.length<12&&<BtnSm variant="ghost" onClick={duplicateWeek}>⧉ Dupliquer</BtnSm>}
            {week&&week.days.length<7&&<BtnSm onClick={addDay}>+ Jour</BtnSm>}
          </div>
        </div>
        {week&&<div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:6,marginBottom:12}}>
          {week.days.map((d,i)=>(
            <button key={i} onClick={()=>setDayIdx(i)} style={{flexShrink:0,padding:"5px 12px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":G.border}`,borderRadius:7,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {d.label}<span style={{marginLeft:4,fontSize:10,opacity:.6}}>({d.exercises.length})</span>
            </button>
          ))}
        </div>}
        {day&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <input value={day.label} onChange={e=>updateLabel("day",dayIdx,e.target.value)} style={{background:"transparent",border:"none",color:G.white,fontSize:14,fontWeight:700,outline:"none",width:"55%"}}/>
            <div style={{display:"flex",gap:6}}>
              {week.days.length>1&&<BtnSm variant="danger" onClick={()=>removeDay(dayIdx)}>✕</BtnSm>}
              <BtnSm onClick={()=>{setFilter("Tous");setPicker(true);}}>+ Exercices</BtnSm>
            </div>
          </div>
          {day.exercises.length===0&&<div style={{textAlign:"center",padding:"16px 0",color:G.greyDim,fontSize:13}}>Aucun exercice</div>}
          {day.exercises.map((pe,i)=>{
            const ex=exercises.find(e=>e.id===pe.exId);
            return(
              <div key={pe.exId} style={{background:G.bg3,borderRadius:9,padding:12,marginBottom:8,border:`1px solid ${G.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>{i+1}. {ex?.name}</div>
                  <div style={{display:"flex",gap:4}}>
                    {i>0&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i-1)}>▲</BtnSm>}
                    {i<day.exercises.length-1&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i+1)}>▼</BtnSm>}
                    <BtnSm variant="danger" onClick={()=>toggleEx(ex)}>✕</BtnSm>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  {[["Séries","sets","number"],["Reps","reps","text"],["Repos","rest","text"],["Charge","targetLoad","text"]].map(([l,k,t])=>(
                    <div key={k}>
                      <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                      <input type={t} value={pe[k]} placeholder={k==="targetLoad"?"optionnel":""} onChange={e=>updateExField(pe.exId,k,t==="number"?Number(e.target.value):e.target.value)}
                        style={{width:"100%",background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"6px 7px",color:G.white,fontSize:12,outline:"none"}}/>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>}
      </div>

      <Btn onClick={save}>✓ Enregistrer les modifications</Btn>

      {picker&&(
        <Modal onClose={()=>setPicker(false)} title={`Exercices — ${day?.label||""}`}>
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
            {MUSCLES.map(m=>(
              <button key={m} onClick={()=>setFilter(m)} style={{flexShrink:0,padding:"5px 12px",background:filter===m?G.goldLight+"22":G.bg3,color:filter===m?G.goldLight:G.grey,border:`1px solid ${filter===m?G.goldLight+"44":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{m}</button>
            ))}
          </div>
          {filtered.map(ex=>{
            const sel=!!day?.exercises.find(e=>e.exId===ex.id);
            return(
              <div key={ex.id} onClick={()=>toggleEx(ex)} style={{background:sel?G.goldLight+"0d":G.bg3,borderRadius:10,padding:12,marginBottom:8,border:`1px solid ${sel?G.goldLight+"55":G.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontWeight:600,fontSize:14}}>{ex.name}</div><div style={{fontSize:11,color:G.grey,marginTop:2}}>{ex.muscle} · {ex.equipment}</div></div>
                <div style={{width:22,height:22,borderRadius:6,border:`1.5px solid ${sel?G.goldLight:G.greyDim}`,background:sel?G.goldLight:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:G.bg,fontSize:13,fontWeight:800}}>{sel?"✓":""}</div>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}

// ─── EXERCISES LIBRARY ────────────────────────────────────────────────────────
function ExLib({exercises,setExercises,go}){
  const [filter,setFilter]=useState("Tous");
  const [search,setSearch]=useState("");
  const [playing,setPlaying]=useState(null);
  const filtered=exercises.filter(e=>(filter==="Tous"||e.muscle===filter)&&e.name.toLowerCase().includes(search.toLowerCase()));
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <PageH title="EXERCICES" subtitle={`${exercises.length} dans la bibliothèque`} action={<BtnSm onClick={()=>go("new-exercise")}>+ Nouveau</BtnSm>}/>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{width:"100%",background:G.bg2,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:14,outline:"none",marginBottom:14}}/>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,marginBottom:16}}>
        {MUSCLES.map(m=>(
          <button key={m} onClick={()=>setFilter(m)} style={{flexShrink:0,padding:"5px 12px",background:filter===m?G.goldLight+"22":G.bg2,color:filter===m?G.goldLight:G.grey,border:`1px solid ${filter===m?G.goldLight+"44":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{m}</button>
        ))}
      </div>
      {filtered.length===0&&<Empty text="Aucun exercice trouvé"/>}
      {filtered.map((ex,i)=>(
        <div key={ex.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`,animationDelay:`${i*40}ms`}} className="fu">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>{ex.name}</div>
              <div style={{display:"flex",gap:6}}><Tag text={ex.muscle}/><Tag text={ex.equipment} color={G.grey}/></div>
              {ex.notes&&<div style={{fontSize:12,color:G.grey,marginTop:8,fontStyle:"italic"}}>📝 {ex.notes}</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginLeft:10}}>
              {ex.videoUrl&&<BtnSm onClick={()=>setPlaying(playing===ex.id?null:ex.id)}>{playing===ex.id?"▼":"▶"}</BtnSm>}
              <BtnSm variant="danger" onClick={()=>setExercises(p=>p.filter(e=>e.id!==ex.id))}>✕</BtnSm>
            </div>
          </div>
          {playing===ex.id&&ex.videoUrl&&(
            <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:8,overflow:"hidden",background:"#000",marginTop:6}}>
              <iframe style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={ex.videoUrl} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NewEx({setExercises,go}){
  const [form,setForm]=useState({name:"",muscle:"Jambes",equipment:"Barre",videoUrl:"",notes:""});
  const create=()=>{setExercises(p=>[...p,{...form,id:Date.now()}]);go("exercises");};
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("exercises")} label="Exercices"/>
      <PageH title="NOUVEL EXERCICE"/>
      <Inp label="Nom de l'exercice" placeholder="Squat Barre" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
      <div style={{marginBottom:16}}>
        <Label>Groupe musculaire</Label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {MUSCLES.slice(1).map(m=>(
            <button key={m} onClick={()=>setForm(p=>({...p,muscle:m}))} style={{padding:"6px 12px",background:form.muscle===m?G.goldLight+"22":G.bg3,color:form.muscle===m?G.goldLight:G.grey,border:`1px solid ${form.muscle===m?G.goldLight+"55":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{m}</button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:16}}>
        <Label>Équipement</Label>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {EQUIPS.map(eq=>(
            <button key={eq} onClick={()=>setForm(p=>({...p,equipment:eq}))} style={{padding:"6px 12px",background:form.equipment===eq?G.goldLight+"22":G.bg3,color:form.equipment===eq?G.goldLight:G.grey,border:`1px solid ${form.equipment===eq?G.goldLight+"55":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>{eq}</button>
          ))}
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <Label>Lien vidéo YouTube (optionnel)</Label>
        <input placeholder="https://www.youtube.com/embed/XXXXX" value={form.videoUrl} onChange={e=>setForm(p=>({...p,videoUrl:e.target.value}))} onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border} style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"11px 14px",color:G.white,fontSize:13,outline:"none",transition:"border .2s"}}/>
        <div style={{fontSize:11,color:G.greyDim,marginTop:5}}>Remplace "watch?v=" par "embed/" dans l'URL</div>
      </div>
      <Txa label="Notes techniques (optionnel)" placeholder="Conseils d'exécution..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/>
      <Btn onClick={create} disabled={!form.name}>Ajouter à la bibliothèque</Btn>
    </div>
  );
}

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────
function ClientPortal({client,clients,setClients,programs,exercises,onLogout}){
  const live=clients.find(c=>c.id===client.id)||client;
  const [tab,setTab]=useState("home");
  const [view,setView]=useState("list"); // list | week-detail | session-active | session-done
  const [selProg,setSelProg]=useState(null);
  const [selWeek,setSelWeek]=useState(null);
  const [selDay,setSelDay]=useState(null);
  // activeSession: { progId, weekIdx, dayIdx, dayLabel, exercises:[{exId,name,sets:[{reps,load,done}]}] }
  const [session,setSession]=useState(null);

  const assigned=programs.filter(p=>live.programs.includes(p.id));

  const startSession=(prog,weekIdx,day,dayIdx)=>{
    const exEntries=day.exercises.map(pe=>{
      const ex=exercises.find(e=>e.id===pe.exId);
      return{exId:pe.exId,name:ex?.name||"",videoUrl:ex?.videoUrl||"",notes:ex?.notes||"",muscle:ex?.muscle||"",rest:pe.rest||"",sensation:"",sets:Array.from({length:pe.sets},()=>({reps:pe.reps,load:pe.targetLoad||"",done:false}))};
    });
    setSession({progId:prog.id,weekIdx,dayIdx,dayLabel:day.label,weekLabel:prog.weeks[weekIdx]?.label||"",exercises:exEntries,notes:""});
    setView("session-active");
  };

  const updateLoad=(exIdx,setIdx,val)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,sets:ex.sets.map((st,si)=>si!==setIdx?st:{...st,load:val})})}));
  };
  const toggleDone=(exIdx,setIdx)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,sets:ex.sets.map((st,si)=>si!==setIdx?st:{...st,done:!st.done})})}));
  };
  const updateSensation=(exIdx,val)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,sensation:val})}));
  };

  const completeSession=()=>{
    const log={id:uid(),date:new Date().toISOString().split("T")[0],programId:session.progId,weekIdx:session.weekIdx,dayIdx:session.dayIdx,dayLabel:session.dayLabel,weekLabel:session.weekLabel,completed:true,notes:session.notes,exercises:session.exercises.map(ex=>({exId:ex.exId,name:ex.name,sensation:ex.sensation||"",sets:ex.sets.map(s=>({reps:s.reps,load:s.load}))}))};
    setClients(p=>p.map(c=>c.id===live.id?{...c,sessions:c.sessions+1,sessionLogs:[log,...c.sessionLogs]}:c));
    setView("session-done");
  };

  const navItems=[{key:"home",icon:"◈",label:"Accueil"},{key:"programme",icon:"▦",label:"Programme"},{key:"nutrition",icon:"◎",label:"Nutrition"},{key:"historique",icon:"◷",label:"Historique"}];

  const goTab=(t)=>{setTab(t);setView("list");setSelProg(null);setSelWeek(null);setSelDay(null);setSession(null);};

  // ── SESSION ACTIVE VIEW ──
  if(view==="session-active"&&session){
    const allDone=session.exercises.every(ex=>ex.sets.every(s=>s.done));
    return(
      <ClientShell active={tab} onNav={goTab} onLogout={onLogout}>
        <BackBtn onClick={()=>{setView("week-detail");setSession(null);}} label="Retour"/>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,color:G.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>En cours</div>
          <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-1}}>{session.dayLabel}</div>
          <div style={{fontSize:12,color:G.grey,marginTop:2}}>{session.weekLabel}</div>
        </div>

        {session.exercises.map((ex,ei)=>(
          <ExerciseSessionCard key={ei} ex={ex} ei={ei} onLoadChange={updateLoad} onToggleDone={toggleDone} onSensationChange={updateSensation} sessionLogs={live.sessionLogs}/>
        ))}

        <Txa label="Notes de séance (optionnel)" placeholder="Ressenti, observations..." value={session.notes} onChange={e=>setSession(s=>({...s,notes:e.target.value}))}/>
        <Btn onClick={completeSession}>✓ Terminer la séance</Btn>
      </ClientShell>
    );
  }

  // ── SESSION DONE ──
  if(view==="session-done"){
    return(
      <ClientShell active={tab} onNav={goTab} onLogout={onLogout}>
        <div style={{textAlign:"center",padding:"60px 20px"}} className="fu">
          <div style={{fontSize:56,marginBottom:16}}>🏆</div>
          <div style={{fontFamily:G.fontD,fontSize:32,fontWeight:800,color:G.goldLight,letterSpacing:-1,marginBottom:8}}>SÉANCE TERMINÉE</div>
          <div style={{fontSize:14,color:G.grey,marginBottom:36}}>Bravo, ta séance a bien été enregistrée !</div>
          <Btn onClick={()=>{setView("list");setTab("historique");}}>Voir mon historique</Btn>
          <div style={{height:12}}/>
          <Btn variant="ghost" onClick={()=>{setView("list");setTab("home");}}>Retour à l'accueil</Btn>
        </div>
      </ClientShell>
    );
  }

  // ── WEEK DETAIL (list of days) ──
  if(view==="week-detail"&&selProg&&selWeek!==null){
    const prog=programs.find(p=>p.id===selProg);
    const week=prog?.weeks[selWeek];
    if(!prog||!week) return null;
    return(
      <ClientShell active={tab} onNav={goTab} onLogout={onLogout}>
        <BackBtn onClick={()=>setView("list")} label="Mes programmes"/>
        <div style={{marginBottom:20}}>
          <div style={{fontSize:12,color:G.gold,fontWeight:600,marginBottom:4}}>{prog.name}</div>
          <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-1}} className="gl">{week.label}</div>
        </div>
        {week.days.map((d,di)=>(
          <div key={di} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:16}}>{d.label}</div>
                <div style={{fontSize:12,color:G.grey,marginTop:3}}>{d.exercises.length} exercices</div>
              </div>
              <button onClick={()=>startSession(prog,selWeek,d,di)} style={{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}}>
                ▶ Commencer
              </button>
            </div>
            {/* Exercise preview */}
            {d.exercises.map((pe,i)=>{
              const ex=exercises.find(e=>e.id===pe.exId);
              return(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderTop:`1px solid ${G.border}`,fontSize:13}}>
                  <span style={{color:G.white}}>{ex?.name||"?"}</span>
                  <span style={{color:G.grey}}>{pe.sets}×{pe.reps}{pe.targetLoad?` · ${pe.targetLoad}`:""}</span>
                </div>
              );
            })}
          </div>
        ))}
      </ClientShell>
    );
  }

  // ── MAIN TABS ──
  return(
    <ClientShell active={tab} onNav={goTab} onLogout={onLogout}>

      {tab==="home"&&(
        <div className="fu">
          <div style={{marginBottom:28}}>
            <div style={{fontSize:11,color:G.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Mon espace</div>
            <div style={{fontFamily:G.fontD,fontSize:30,fontWeight:800,letterSpacing:-1}} className="gl">{live.name.split(" ")[0].toUpperCase()}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:28}}>
            {[[live.sessionLogs.filter(l=>l.completed).length,"Séances complétées"],[assigned.length,"Programmes actifs"]].map(([v,l])=>(
              <div key={l} style={{background:G.bg2,borderRadius:12,padding:"16px 14px",border:`1px solid ${G.border}`}}>
                <div style={{fontFamily:G.fontD,fontSize:38,fontWeight:800,color:G.goldLight,lineHeight:1}}>{v}</div>
                <div style={{fontSize:10,color:G.grey,letterSpacing:1,textTransform:"uppercase",marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>
          <SH title="Mes programmes"/>
          {assigned.length===0&&<Empty text="Aucun programme assigné pour l'instant"/>}
          {assigned.map(p=>{
            const totalEx=p.weeks.reduce((a,w)=>a+w.days.reduce((b,d)=>b+d.exercises.length,0),0);
            return(
              <div key={p.id} onClick={()=>{setSelProg(p.id);setSelWeek(0);setView("week-detail");setTab("programme");}} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,borderLeft:`3px solid ${G.gold}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{p.name}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <Tag text={p.level}/><Tag text={`${p.weeks.length} sem.`} color={G.grey}/><Tag text={`${p.weeks[0]?.days.length} j/sem`} color={G.grey}/>
                    </div>
                  </div>
                  <div style={{color:G.gold,fontSize:22}}>›</div>
                </div>
              </div>
            );
          })}
          {live.sessionLogs.length>0&&<>
            <div style={{margin:"24px 0 12px"}}><SH title="Dernières séances"/></div>
            {live.sessionLogs.slice(0,3).map((log,i)=>(
              <MiniLogCard key={log.id||i} log={log} programs={programs}/>
            ))}
          </>}
        </div>
      )}

      {tab==="programme"&&(
        <div className="fu">
          <PageH title="MES PROGRAMMES"/>
          {assigned.length===0&&<Empty text="Aucun programme assigné"/>}
          {assigned.map(p=>(
            <div key={p.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`}}>
              <div style={{fontWeight:700,fontSize:16,marginBottom:10}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                <Tag text={p.level}/><Tag text={`${p.weeks.length} semaine${p.weeks.length>1?"s":""}`} color={G.grey}/>
              </div>
              {/* Week list */}
              {p.weeks.map((w,wi)=>(
                <div key={wi} onClick={()=>{setSelProg(p.id);setSelWeek(wi);setView("week-detail");}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:G.bg3,borderRadius:9,marginBottom:7,cursor:"pointer",border:`1px solid ${G.border}`}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>{w.label}</div>
                    <div style={{fontSize:11,color:G.grey,marginTop:2}}>{w.days.length} séance{w.days.length>1?"s":""} · {w.days.reduce((a,d)=>a+d.exercises.length,0)} exercices</div>
                  </div>
                  <div style={{color:G.gold,fontSize:18}}>›</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab==="nutrition"&&(
        <div className="fu">
          <PageH title="NUTRITION"/>
          <div style={{background:G.bg2,borderRadius:12,padding:18,border:`1px solid ${G.border}`}}>
            <div style={{textAlign:"center",padding:"12px 0 24px"}}>
              <div style={{fontFamily:G.fontD,fontSize:60,fontWeight:800,color:G.goldLight,lineHeight:1}}>{live.nutrition.calories}</div>
              <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>kcal / jour</div>
            </div>
            <MacroBar label="Protéines" value={live.nutrition.proteins} max={300} color={G.goldLight}/>
            <MacroBar label="Glucides" value={live.nutrition.carbs} max={500} color={G.gold}/>
            <MacroBar label="Lipides" value={live.nutrition.fats} max={150} color="#C9A84C66"/>
            {live.nutrition.notes&&<div style={{marginTop:16,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {live.nutrition.notes}</div>}
          </div>
        </div>
      )}

      {tab==="historique"&&(
        <div className="fu">
          <PageH title="HISTORIQUE"/>
          {live.sessionLogs.length===0&&<Empty text="Aucune séance enregistrée"/>}
          {live.sessionLogs.map((log,i)=><LogCard key={log.id||i} log={log} programs={programs}/>)}
        </div>
      )}
    </ClientShell>
  );
}

// ─── REST TIMER HOOK ──────────────────────────────────────────────────────────
function useRestTimer(){
  const [timeLeft,setTimeLeft]=useState(0);
  const [running,setRunning]=useState(false);
  const ref=useRef(null);
  const start=(secs)=>{
    clearInterval(ref.current);
    setTimeLeft(secs);
    setRunning(true);
    ref.current=setInterval(()=>{
      setTimeLeft(t=>{if(t<=1){clearInterval(ref.current);setRunning(false);return 0;}return t-1;});
    },1000);
  };
  const stop=()=>{clearInterval(ref.current);setRunning(false);setTimeLeft(0);};
  return{timeLeft,running,start,stop};
}

// Parse "90s", "2min", "45s" → secondes
function parseRest(rest){
  if(!rest)return 0;
  const s=rest.toLowerCase().trim();
  if(s.includes("min")){const p=s.replace("min","").trim().split(":").map(Number);return p.length===2?p[0]*60+p[1]:p[0]*60;}
  if(s.includes("s"))return parseInt(s)||0;
  return parseInt(s)||0;
}

// ─── EXERCISE SESSION CARD ────────────────────────────────────────────────────
function ExerciseSessionCard({ex,ei,onLoadChange,onToggleDone,onSensationChange,sessionLogs}){
  const [vidOpen,setVidOpen]=useState(false);
  const [histOpen,setHistOpen]=useState(false);
  const [units,setUnits]=useState(ex.sets.map(()=>"kg"));
  const {timeLeft,running,start,stop}=useRestTimer();
  const allSetsDone=ex.sets.every(s=>s.done);
  const restSecs=parseRest(ex.rest||"");
  const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  const UNITS=["kg","élastique","cal","m","km","reps"];

  const setUnit=(si,u)=>setUnits(prev=>prev.map((x,i)=>i===si?u:x));

  const history=[];
  for(const log of (sessionLogs||[])){
    if(history.length>=4) break;
    const found=(log.exercises||[]).find(e=>e.exId===ex.exId);
    if(found) history.push({date:log.date,dayLabel:log.dayLabel,sets:found.sets});
  }

  return(
    <div style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:14,border:`1.5px solid ${allSetsDone?G.green+"55":G.border}`,transition:"border .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15}}><span style={{color:G.gold,fontFamily:G.fontD,marginRight:6}}>{ei+1}.</span>{ex.name}</div>
          {ex.notes&&<div style={{fontSize:11,color:G.gold+"88",marginTop:4}}>💡 {ex.notes}</div>}
          {ex.muscle&&<div style={{marginTop:6}}><Tag text={ex.muscle} color={G.grey}/></div>}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
          {history.length>0&&<BtnSm onClick={()=>setHistOpen(!histOpen)} variant="ghost">{histOpen?"▼":"📊"}</BtnSm>}
          {ex.videoUrl&&<BtnSm onClick={()=>setVidOpen(!vidOpen)}>{vidOpen?"▼":"▶"}</BtnSm>}
          {allSetsDone&&<Tag text="✓" color={G.green}/>}
        </div>
      </div>

      {histOpen&&history.length>0&&(
        <div style={{background:G.bg3,borderRadius:10,padding:12,marginBottom:12,border:`1px solid ${G.border}`}}>
          <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Historique récent</div>
          {history.map((h,hi)=>(
            <div key={hi} style={{marginBottom:hi<history.length-1?10:0}}>
              <div style={{fontSize:11,color:G.gold,marginBottom:5}}>{h.date}{h.dayLabel?` — ${h.dayLabel}`:""}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {h.sets.map((s,si)=>(
                  <div key={si} style={{background:G.bg4,borderRadius:6,padding:"5px 10px",border:`1px solid ${G.border}`,textAlign:"center",minWidth:60}}>
                    <div style={{fontSize:10,color:G.grey,marginBottom:2}}>S{si+1}</div>
                    <div style={{fontSize:13,fontWeight:800,color:s.load?G.goldLight:G.greyDim}}>{s.load||"—"}</div>
                    <div style={{fontSize:10,color:G.grey}}>{s.reps}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {vidOpen&&ex.videoUrl&&(
        <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:8,overflow:"hidden",background:"#000",marginBottom:12}}>
          <iframe style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={ex.videoUrl} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
        </div>
      )}

      {restSecs>0&&(
        <div style={{background:running?G.gold+"15":G.bg3,border:`1px solid ${running?G.gold+"55":G.border}`,borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",transition:"all .3s"}}>
          <div>
            <div style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Récupération</div>
            <div style={{fontFamily:G.fontD,fontSize:running?28:16,fontWeight:800,color:running?(timeLeft<=10?G.red:G.goldLight):G.grey,transition:"all .3s",letterSpacing:-.5}}>
              {running?fmt(timeLeft):`${restSecs}s`}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {running
              ?<button onClick={stop} style={{background:G.red+"22",color:G.red,border:`1px solid ${G.red}44`,borderRadius:8,padding:"8px 14px",fontWeight:700,fontSize:13,cursor:"pointer"}}>✕ Stop</button>
              :<button onClick={()=>start(restSecs)} style={{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,fontSize:13,cursor:"pointer"}}>▶ Go</button>
            }
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
        {ex.sets.map((st,si)=>(
          <div key={si} style={{background:st.done?G.green+"18":G.bg3,borderRadius:9,padding:"10px 10px 8px",border:`1.5px solid ${st.done?G.green+"55":G.border}`,transition:"all .2s"}}>
            <div style={{fontSize:10,color:st.done?G.green:G.grey,fontWeight:700,letterSpacing:.8,marginBottom:6}}>SÉRIE {si+1} · {st.reps}</div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
              <input value={st.load} onChange={e=>onLoadChange(ei,si,e.target.value)} placeholder="—"
                style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${G.border}`,color:st.done?G.green:G.white,fontSize:14,fontWeight:700,outline:"none",padding:"2px 0",textAlign:"center",minWidth:0}}/>
            </div>
            <select value={units[si]} onChange={e=>setUnit(si,e.target.value)}
              style={{width:"100%",background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"4px 6px",color:st.done?G.green:G.grey,fontSize:11,outline:"none",marginBottom:6,cursor:"pointer"}}>
              {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={()=>{onToggleDone(ei,si);if(!st.done&&restSecs>0)start(restSecs);}}
              style={{width:"100%",background:st.done?"transparent":G.goldLight+"18",color:st.done?G.green:G.goldLight,border:`1px solid ${st.done?G.green+"55":G.gold+"44"}`,borderRadius:6,padding:"5px 0",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {st.done?"✓ Fait":"Valider"}
            </button>
          </div>
        ))}
      </div>
      <div style={{marginTop:12}}>
        <div style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Ressenti</div>
        <div style={{display:"flex",gap:6}}>
          {[["😊","Facile"],["😐","Correct"],["😤","Difficile"],["💀","Épuisant"]].map(([emoji,label])=>(
            <button key={emoji} onClick={()=>onSensationChange(ei,emoji)} title={label}
              style={{flex:1,padding:"6px 0",background:ex.sensation===emoji?G.gold+"33":"transparent",border:`1px solid ${ex.sensation===emoji?G.gold:G.border}`,borderRadius:8,fontSize:18,cursor:"pointer",transition:"all .2s"}}>
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT SHELL ─────────────────────────────────────────────────────────────
function ClientShell({children,active,onNav,onLogout}){
  const items=[{key:"home",icon:"◈",label:"Accueil"},{key:"programme",icon:"▦",label:"Programme"},{key:"nutrition",icon:"◎",label:"Nutrition"},{key:"historique",icon:"◷",label:"Historique"}];
  return(
    <>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"20px 20px 24px"}}>
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:4}}>
          <button onClick={onLogout} style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"6px 12px",color:G.grey,fontSize:11,cursor:"pointer"}}>Déconnexion</button>
        </div>
        {children}
      </div>
      <nav style={{flexShrink:0,width:"100%",background:G.bg2,borderTop:`1px solid ${G.border}`,display:"flex",zIndex:100}}>
        {items.map(({key,icon,label})=>{
          const a=active===key;
          return<button key={key} onClick={()=>onNav(key)} style={{flex:1,padding:"12px 0 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:a?G.goldLight:G.greyDim,fontSize:10,fontWeight:600,letterSpacing:.5,transition:"color .2s",borderTop:a?`2px solid ${G.goldLight}`:"2px solid transparent"}}>
            <span style={{fontSize:18}}>{icon}</span><span>{label}</span>
          </button>;
        })}
      </nav>
    </>
  );
}

// ─── AI COACH ─────────────────────────────────────────────────────────────────
function AICoach({exercises,setPrograms,go}){
  const [messages,setMessages]=useState([
    {role:"assistant",content:"Bonjour ! Je suis ton assistant IA Coach. Je peux créer des programmes d'entraînement complets directement dans ton application.\n\nDis-moi par exemple :\n• \"Crée un programme PPL 6 jours sur 4 semaines pour un client intermédiaire\"\n• \"Génère un full body débutant 3j/sem avec progression sur 8 semaines\"\n• \"Fais un programme de force sur 6 semaines axé squat et développé couché\""}
  ]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);

  const scrollBottom=()=>setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),100);

  const SYSTEM=`Tu es un assistant coach sportif expert intégré dans l'application Wandy Coach.
Tu peux créer des programmes d'entraînement complets. Quand l'utilisateur te demande de créer un programme, tu dois OBLIGATOIREMENT répondre avec un JSON valide dans un bloc \`\`\`json ... \`\`\` en plus de ton message texte.

La liste des exercices disponibles dans l'app (utilise leurs IDs exacts) :
${exercises.map(e=>`- id:${e.id} "${e.name}" (${e.muscle}, ${e.equipment})`).join("\n")}

Format JSON du programme :
{
  "action": "create_program",
  "program": {
    "name": "Nom du programme",
    "category": "Force|PPL|Full Body|CrossFit|Cardio|etc",
    "level": "Débutant|Intermédiaire|Avancé",
    "weeks": [
      {
        "label": "Semaine 1 — Description",
        "days": [
          {
            "label": "Séance A",
            "exercises": [
              {"exId": 1, "sets": 4, "reps": "8", "rest": "90s", "targetLoad": "60kg"}
            ]
          }
        ]
      }
    ]
  }
}

Règles importantes :
- Utilise uniquement les IDs d'exercices listés ci-dessus
- Le champ "rest" accepte : "30s", "60s", "90s", "2min", "3min"
- Le champ "targetLoad" est optionnel (laisse "" si pas de charge)
- Crée toujours plusieurs semaines avec progression
- Réponds en français, sois précis et professionnel
- TOUJOURS inclure le JSON si tu crées un programme`;

  const send=async()=>{
    if(!input.trim()||loading)return;
    const userMsg={role:"user",content:input.trim()};
    const newMsgs=[...messages,userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    scrollBottom();

    try{
      const res=await fetch("/api/chat",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:4000,
          system:SYSTEM,
          messages:newMsgs.map(m=>({role:m.role,content:m.content}))
        })
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Erreur serveur");
      const text=data.content?.[0]?.text||"Désolé, une erreur s'est produite.";

      // Cherche un bloc JSON dans la réponse
      const jsonMatch=text.match(/```json\s*([\s\S]*?)```/);
      let programCreated=null;
      if(jsonMatch){
        try{
          const parsed=JSON.parse(jsonMatch[1]);
          if(parsed.action==="create_program"&&parsed.program){
            const newProg={...parsed.program,id:Date.now()};
            setPrograms(p=>[...p,newProg]);
            programCreated=newProg;
          }
        }catch(e){console.error("JSON parse error",e);}
      }

      // Nettoie le JSON du message affiché
      const cleanText=text.replace(/```json[\s\S]*?```/g,"").trim();
      setMessages(p=>[...p,{role:"assistant",content:cleanText,programCreated}]);
    }catch(e){
      setMessages(p=>[...p,{role:"assistant",content:`Erreur : ${e.message}`}]);
    }
    setLoading(false);
    scrollBottom();
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",padding:"20px 0 0"}}>
      {/* Header */}
      <div style={{padding:"0 20px 16px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg,${G.goldLight}22,${G.gold}44)`,border:`1px solid ${G.gold}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✦</div>
          <div>
            <div style={{fontFamily:G.fontD,fontSize:18,fontWeight:800,letterSpacing:-.5}}>IA Coach</div>
            <div style={{fontSize:11,color:G.grey}}>Création automatique de programmes</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:12}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"85%",background:m.role==="user"?`linear-gradient(135deg,${G.goldLight},${G.gold})`:G.bg3,color:m.role==="user"?G.bg:G.white,borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"12px 14px",fontSize:13,lineHeight:1.55,border:m.role==="user"?"none":`1px solid ${G.border}`,whiteSpace:"pre-wrap"}}>
              {m.content}
            </div>
            {m.programCreated&&(
              <div style={{marginTop:8,background:G.green+"15",border:`1px solid ${G.green}44`,borderRadius:12,padding:"10px 14px",maxWidth:"85%",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:18}}>✓</span>
                <div>
                  <div style={{fontSize:12,fontWeight:700,color:G.green}}>Programme créé !</div>
                  <div style={{fontSize:11,color:G.grey,marginTop:2}}>"{m.programCreated.name}" ajouté à ta bibliothèque</div>
                </div>
                <button onClick={()=>go("programs")} style={{marginLeft:"auto",background:G.green+"22",color:G.green,border:`1px solid ${G.green}44`,borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Voir →</button>
              </div>
            )}
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",alignItems:"flex-start"}}>
            <div style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:"16px 16px 16px 4px",padding:"12px 16px",display:"flex",gap:6,alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:G.gold,animation:"pulse 1.2s ease infinite",animationDelay:`${i*0.2}s`}}/>)}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"12px 20px 16px",borderTop:`1px solid ${G.border}`,flexShrink:0}}>
        <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Décris le programme que tu veux créer..." rows={2}
            style={{flex:1,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:12,padding:"10px 14px",color:G.white,fontSize:13,outline:"none",resize:"none",lineHeight:1.5,fontFamily:G.font}}/>
          <button onClick={send} disabled={!input.trim()||loading}
            style={{background:input.trim()&&!loading?`linear-gradient(135deg,${G.goldLight},${G.gold})`:`${G.gold}33`,color:input.trim()&&!loading?G.bg:G.greyDim,border:"none",borderRadius:12,width:44,height:44,fontSize:20,cursor:input.trim()&&!loading?"pointer":"default",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s"}}>
            ↑
          </button>
        </div>
        <div style={{fontSize:10,color:G.greyDim,marginTop:6,textAlign:"center"}}>Entrée pour envoyer · Maj+Entrée pour un retour à la ligne</div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}

const MiniLogCard=({log,programs})=>{
  const prog=programs.find(p=>p.id===log.programId);
  return(
    <div style={{background:G.bg2,borderRadius:10,padding:12,marginBottom:8,border:`1px solid ${G.border}`,borderLeft:`3px solid ${log.completed?G.green:G.red}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontWeight:700,fontSize:13}}>{prog?.name||"Séance"}{log.dayLabel?` — ${log.dayLabel}`:""}</div>
          <div style={{fontSize:11,color:G.grey,marginTop:2}}>{log.date}</div>
        </div>
        <Tag text={log.completed?"✓":"✗"} color={log.completed?G.green:G.red}/>
      </div>
    </div>
  );
};

const LogCard=({log,programs})=>{
  const [open,setOpen]=useState(false);
  const prog=programs.find(p=>p.id===log.programId);
  return(
    <div style={{background:G.bg2,borderRadius:10,marginBottom:10,border:`1px solid ${G.border}`,borderLeft:`3px solid ${log.completed?G.green:G.red}`,overflow:"hidden"}}>
      <div onClick={()=>setOpen(!open)} style={{padding:14,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{prog?.name||"Séance"}{log.dayLabel?` — ${log.dayLabel}`:""}</div>
          <div style={{fontSize:12,color:G.grey,marginTop:2}}>{log.date}{log.weekLabel?` · ${log.weekLabel}`:""}</div>
          {log.notes&&<div style={{fontSize:12,color:"#aaa",marginTop:4,fontStyle:"italic"}}>"{log.notes}"</div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0,marginLeft:10}}>
          <Tag text={log.completed?"✓ Fait":"✗ Manqué"} color={log.completed?G.green:G.red}/>
          <span style={{color:G.greyDim,fontSize:14}}>{open?"▲":"▼"}</span>
        </div>
      </div>
      {open&&log.exercises&&log.exercises.length>0&&(
        <div style={{padding:"0 14px 14px"}}>
          <div style={{height:1,background:G.border,marginBottom:12}}/>
          {log.exercises.map((ex,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontWeight:600,fontSize:13,color:G.goldLight}}>{ex.name}</div>
                {ex.sensation&&<span style={{fontSize:16}} title="Ressenti">{ex.sensation}</span>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(88px,1fr))",gap:6}}>
                {ex.sets.map((s,j)=>(
                  <div key={j} style={{background:G.bg3,borderRadius:7,padding:"8px 10px",border:`1px solid ${G.border}`,textAlign:"center"}}>
                    <div style={{fontSize:10,color:G.grey,marginBottom:4,letterSpacing:.5}}>Série {j+1}</div>
                    <div style={{fontSize:15,fontWeight:800,color:s.load?G.goldLight:G.greyDim}}>{s.load||"—"}</div>
                    <div style={{fontSize:11,color:G.grey,marginTop:2}}>{s.reps} reps</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
