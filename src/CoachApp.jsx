import { useState, useEffect } from "react";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc } from "./firebase.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const G = {
  bg:"#080808",bg2:"#0f0f0f",bg3:"#161616",bg4:"#1c1c1c",
  gold:"#C9A84C",goldLight:"#E8C547",
  white:"#F5F0E8",grey:"#888",greyDim:"#444",border:"#2a2a2a",
  red:"#E05252",green:"#52C07A",
  font:"'Barlow',sans-serif",fontD:"'Barlow Condensed',sans-serif",
};
const COACH_CODE = "COACH2025";
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:${G.bg};color:${G.white};font-family:${G.font};}
  input,textarea,select{font-family:${G.font};}
  ::-webkit-scrollbar{width:5px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:${G.border};border-radius:3px;}
  ::-webkit-scrollbar-thumb:hover{background:${G.greyDim};}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fu{animation:fadeUp .2s ease both;}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const mkEx = (exId,sets,reps,rest,load="",note="")=>({exId,sets,reps,rest,targetLoad:load,loadRef:"none",note});
const mkPct= (exId,sets,reps,rest,pct,ref,note="")=>({exId,sets,reps,rest,targetLoad:String(pct),loadRef:ref,note});
const genCode = n=>n.split(" ")[0].toUpperCase().slice(0,4)+new Date().getFullYear();
const uid = ()=>Math.random().toString(36).slice(2,9);
const MUSCLES = ["Tous","Cardio","Jambes","Pectoraux","Dos","Épaules","Biceps","Triceps","Abdominaux","Avant-bras"];
const EQUIPS = ["Aucun","Barre","Haltères","Poulie","Barre fixe","Machine","Élastique","Kettlebell","Poids du corps"];
const MEAL_SLOTS=[
  {id:"breakfast",icon:"🌅",label:"Petit déjeuner"},
  {id:"snack1",icon:"🍎",label:"Collation matin"},
  {id:"lunch",icon:"🥗",label:"Déjeuner"},
  {id:"snack2",icon:"🍌",label:"Collation après-midi"},
  {id:"dinner",icon:"🌙",label:"Dîner"},
  {id:"other",icon:"💊",label:"Autre / Suppléments"},
];
const emptyMealPlan=()=>({meals:MEAL_SLOTS.map(s=>({id:s.id,label:s.label,items:[],note:""}))});

// ─── BASE ALIMENTAIRE ─────────────────────────────────────────────────────────
// unit:"g" → valeurs pour 100g | unit:"portion" → valeurs pour 1 portion
const FOODS_DB=[
  {id:"pain_mie",        name:"Pain de mie complet",                                         unit:"g",      kcal:87,  protein:3.2, carbs:13,  fat:1.4},
  {id:"flocons_avoine",  name:"Flocon d'avoine",                                              unit:"g",      kcal:370, protein:13,  carbs:58,  fat:7},
  {id:"lait_amande",     name:"Lait d'amande",                                                unit:"g",      kcal:35,  protein:2,   carbs:2.5, fat:1.6},
  {id:"fromage_blanc",   name:"Fromage blanc nature 3% MG Carrefour",                         unit:"g",      kcal:70,  protein:8,   carbs:3,   fat:3},
  {id:"muesli_bjorg",    name:"Muesli Bjorg sans sucres ajoutés",                             unit:"g",      kcal:357, protein:12,  carbs:58,  fat:6},
  {id:"viande_poisson",  name:"Viande / Poisson au choix",                                    unit:"g",      kcal:178, protein:22,  carbs:0,   fat:10},
  {id:"legumes",         name:"Légumes au choix (hors légumineuses)",                         unit:"g",      kcal:24,  protein:1,   carbs:5,   fat:0},
  {id:"farine",          name:"Farine",                                                       unit:"g",      kcal:364, protein:10,  carbs:76,  fat:1},
  {id:"whey",            name:"Scoop de whey",                                                unit:"portion",kcal:120, protein:23,  carbs:2,   fat:1.5},
  {id:"feculents_dej",   name:"Féculents petit déj. (40g pain / biscottes / muffin anglais)", unit:"portion",kcal:139, protein:3,   carbs:25,  fat:1},
  {id:"oeuf",            name:"Œuf entier",                                                   unit:"portion",kcal:79,  protein:7,   carbs:1,   fat:6},
  {id:"topping",         name:"Topping – miel ou sirop d'agave (1 c. à café ~10g)",           unit:"portion",kcal:20,  protein:0,   carbs:5,   fat:0},
  {id:"jambon_dinde",    name:"Jambon / Dinde (1 tranche)",                                   unit:"portion",kcal:33,  protein:6.6, carbs:0.7, fat:0},
  {id:"carre_frais",     name:"Carré frais nature 0%",                                        unit:"portion",kcal:76,  protein:16,  carbs:3,   fat:0},
  {id:"fruits",          name:"Fruits au choix (2 abricots / ½ banane / 120g cerises…)",      unit:"portion",kcal:63,  protein:1,   carbs:15,  fat:1},
  {id:"feculents_cuits", name:"Féculents cuits (100g pâtes/riz ou 130g semoule/boulgour)",    unit:"portion",kcal:136, protein:4,   carbs:30,  fat:0},
  {id:"mat_grasse",      name:"Matière grasse – 1 c. à soupe d'huile",                        unit:"portion",kcal:90,  protein:0,   carbs:0,   fat:10},
  {id:"beurre_cacah",    name:"Beurre de cacahouète PROZIZ (1 c. à café ~8g)",                unit:"portion",kcal:50,  protein:1,   carbs:2,   fat:4},
];
const calcMacros=(items=[],foods=FOODS_DB)=>items.reduce((acc,item)=>{
  const f=foods.find(x=>x.id===item.foodId);
  if(!f)return acc;
  const m=f.unit==="g"?item.qty/100:item.qty;
  return{kcal:acc.kcal+f.kcal*m,protein:acc.protein+f.protein*m,carbs:acc.carbs+f.carbs*m,fat:acc.fat+f.fat*m};
},{kcal:0,protein:0,carbs:0,fat:0});
const rnd=v=>Math.round(v);
const rnd1=v=>Math.round(v*10)/10;

// ─── PERFORMANCES / TESTS ─────────────────────────────────────────────────────
const LOAD_REFS = [
  {id:"none",       label:"—",             testKey:null,         unit:""},
  {id:"1rm_squat",  label:"% 1RM Squat",   testKey:"rm_squat",  unit:"kg"},
  {id:"1rm_bench",  label:"% 1RM Bench",   testKey:"rm_bench",  unit:"kg"},
  {id:"1rm_sdt",    label:"% 1RM SDT",     testKey:"rm_sdt",    unit:"kg"},
  {id:"fcmax",      label:"% FCmax",        testKey:"fcmax",     unit:"bpm"},
  {id:"vma",        label:"% VMA",          testKey:"vma",       unit:"km/h"},
];
const EMPTY_TESTS={fcmax:"",vma:"",rm_squat:"",rm_bench:"",rm_sdt:"",tractions_max:"",pompes_max:"",gainage_max:"",notes:""};
const computeLoad=(pe,tests)=>{
  const ref=LOAD_REFS.find(r=>r.id===(pe.loadRef||"none"));
  if(!ref||ref.id==="none"||!tests)return null;
  const base=parseFloat(tests[ref.testKey]);
  const pct=parseFloat(pe.targetLoad);
  if(!base||!pct)return null;
  return{value:Math.round(pct/100*base),unit:ref.unit,label:ref.label,pct};
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_EX = [
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
  {id:2,name:"Développé Couché",muscle:"Pectoraux",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/rT7DgCr-3pg",notes:"Coudes à 45°, amplitude complète"},
  {id:24,name:"Développé Couché Haltères",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/VmB1G1K7v94",notes:"Rotation des poignets en haut"},
  {id:25,name:"Développé Incliné Barre",muscle:"Pectoraux",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/jPLdzuHckI8",notes:"Inclinaison 30-45°, faisceau sup"},
  {id:26,name:"Développé Incliné Haltères",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/8iPEnn-ltC8",notes:"Coudes légèrement fléchis en haut"},
  {id:27,name:"Écarté Haltères Plat",muscle:"Pectoraux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/eozdVDA78K0",notes:"Arc léger, ne pas descendre trop bas"},
  {id:28,name:"Dips Pectoraux",muscle:"Pectoraux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/2z8JmcrW-As",notes:"Penché en avant, coudes écartés"},
  {id:29,name:"Pec Deck Machine",muscle:"Pectoraux",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/Z57CtFmRMxA",notes:"Contraction maximale en centre"},
  {id:30,name:"Pompes",muscle:"Pectoraux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/IODxDxX7oi4",notes:"Corps gainé, coudes à 45°"},
  {id:31,name:"Cable Crossover",muscle:"Pectoraux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/taI4XduLpTk",notes:"Mains se croisent en bas du mouvement"},
  {id:3,name:"Tractions",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/eGo4IYlbE5g",notes:"Pleine amplitude, sans élan"},
  {id:4,name:"Soulevé de Terre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/op9kVnSso6Q",notes:"Barre proche du corps"},
  {id:10,name:"Rowing Barre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/G8l_8chR5BE",notes:"Dos parallèle au sol, coudes hauts"},
  {id:32,name:"Tirage Vertical Poulie",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/CAwf7n6Luuc",notes:"Coudes vers le bas, omoplate rétractées"},
  {id:33,name:"Rowing Haltère Unilatéral",muscle:"Dos",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/roCP3W-lfKo",notes:"Dos plat, tirer vers la hanche"},
  {id:34,name:"Tirage Horizontal Poulie",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/GZbfZ033f74",notes:"Serrer les omoplates en fin de mouvement"},
  {id:35,name:"Hyperextension",muscle:"Dos",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/ph3pddpKzzw",notes:"Extension sans dépasser la ligne du corps"},
  {id:37,name:"Face Pull",muscle:"Dos",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/rep-qVOkqgk",notes:"Tirer vers le visage, coudes hauts"},
  {id:38,name:"Shrugs Barre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/cJRVVxmytaM",notes:"Élévation verticale, pas de rotation"},
  {id:5,name:"Développé Militaire",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/2yjwXTZQDDI",notes:"Core serré, regard droit"},
  {id:40,name:"Élévations Latérales",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/3VcKaXpzqRo",notes:"Légère flexion des coudes, montée lente"},
  {id:41,name:"Développé Arnold",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/6Z15_WdXmVw",notes:"Rotation des poignets pendant le mouvement"},
  {id:42,name:"Oiseau Haltères",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/Z6n49aQTHFs",notes:"Buste penché, coudes légèrement fléchis"},
  {id:43,name:"Upright Row",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/um3SX3fZSqc",notes:"Coudes au-dessus des poignets"},
  {id:44,name:"Élévations Frontales",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/sOiBHNGlBzU",notes:"Montée jusqu'à hauteur des épaules"},
  {id:45,name:"Développé Haltères Assis",muscle:"Épaules",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/qEwKCR5JCog",notes:"Dos droit contre le banc"},
  {id:46,name:"Reverse Fly Poulie",muscle:"Épaules",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/ea7TXQMiMnE",notes:"Câbles croisés, bras légèrement fléchis"},
  {id:6,name:"Curl Haltères",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/sAq_ocpRh_I",notes:"Supination en haut du mouvement"},
  {id:47,name:"Curl Barre",muscle:"Biceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/kwG2ipFRgfo",notes:"Coudes fixes le long du corps"},
  {id:48,name:"Curl Incliné",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/soxrZlIl35U",notes:"Bras perpendiculaires au sol, longue portion"},
  {id:49,name:"Curl Marteau",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/TwD-YGVP4Bk",notes:"Poignets neutres, brachial ciblé"},
  {id:50,name:"Curl Poulie Basse",muscle:"Biceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/NFzTWp2qpiE",notes:"Tension constante, coude fixe"},
  {id:51,name:"Curl Concentration",muscle:"Biceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/0AUGkch3tzc",notes:"Coude contre la cuisse, isolation maximale"},
  {id:52,name:"Curl Barre EZ",muscle:"Biceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/zG2-v6RxOEo",notes:"Prise en supination, moins de stress poignets"},
  {id:7,name:"Triceps Poulie",muscle:"Triceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/2-LAMcpzODU",notes:"Coudes fixes, extension complète"},
  {id:54,name:"Dips Triceps",muscle:"Triceps",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/0326dy_-CzM",notes:"Corps droit, coudes le long du corps"},
  {id:55,name:"Skull Crusher",muscle:"Triceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/d_KZxkY_0cM",notes:"Descendre vers le front, coudes fixes"},
  {id:56,name:"Extension Triceps Haltère",muscle:"Triceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/YbX7Wd8jQ-Q",notes:"Coudes serrés, longue portion ciblée"},
  {id:57,name:"Kickback Triceps",muscle:"Triceps",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/6SS6K3lAwZ8",notes:"Buste parallèle au sol, extension complète"},
  {id:58,name:"Close Grip Bench Press",muscle:"Triceps",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/nEF0bv2FW94",notes:"Prise serrée, coudes le long du corps"},
  {id:59,name:"Triceps Corde Poulie",muscle:"Triceps",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/kiuVA0gs3EI",notes:"Écarter la corde en bas du mouvement"},
  {id:8,name:"Gainage Planche",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/pSHjTRCQxIw",notes:"Bassin neutre, respiration continue"},
  {id:60,name:"Crunch",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/Xyd_fa5zoEU",notes:"Mains derrière la tête, menton décollé"},
  {id:61,name:"Relevé de Jambes",muscle:"Abdominaux",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/Pr1ieGZ5atk",notes:"Jambes tendues, montée lente"},
  {id:62,name:"Ab Wheel",muscle:"Abdominaux",equipment:"Aucun",videoUrl:"https://www.youtube.com/embed/ZJOG6_5gNUI",notes:"Creuser le ventre, ne pas cambrer"},
  {id:63,name:"Mountain Climbers",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/nmwgirgXLYM",notes:"Hanches basses, rythme rapide"},
  {id:64,name:"Russian Twist",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/wkD8rjkodUI",notes:"Pieds décollés, rotation complète"},
  {id:65,name:"Crunch Poulie Haute",muscle:"Abdominaux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/AV5PGc8E4-4",notes:"Contracte les abdos vers les genoux"},
  {id:66,name:"Planche Latérale",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/K2gOjwfj-lA",notes:"Hanches alignées, corps en planche"},
  {id:68,name:"Dead Bug",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/4XLEnwUr1d8",notes:"Dos plaqué au sol, mouvement lent"},
  {id:90,name:"Farmers Walk",muscle:"Dos",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/Fkzk_RqlYig",notes:"Dos droit, pas réguliers et rapides"},
  {id:81,name:"Rowing Ergomètre",muscle:"Dos",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/zBjCMFGkYOU",notes:"Jambes, hanches, bras dans l'ordre"},
  {id:103,name:"Inverted Row",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/LK3E-40LRHE",notes:"Corps rigide, tirer le sternum vers la barre"},
  {id:106,name:"Deadlift Sumo Barre",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/WH1oJERG8eI",notes:"Stance large, pieds 45°, dos plat, poussée du sol — barre proche du corps"},
  {id:107,name:"Cable Pull-Through",muscle:"Jambes",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/mNwlpNhQXrk",notes:"Câble bas entre les jambes, charnière hanche pure, fessiers contractés en haut"},
  {id:108,name:"Pallof Press Câble",muscle:"Abdominaux",equipment:"Poulie",videoUrl:"https://www.youtube.com/embed/AH_QZLm_0-s",notes:"Debout, unilatéral, hauteur poitrine — résister à la rotation"},
  {id:109,name:"Bird Dog Lestés",muscle:"Abdominaux",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/wiFNA3sqjCA",notes:"2 s de pause en extension complète, dos plat, genoux à 5 cm du sol"},
  {id:110,name:"Activation Fessiers Élastique",muscle:"Jambes",equipment:"Élastique",videoUrl:"https://www.youtube.com/embed/Y20ABnLDHhQ",notes:"Clamshell, hip abduction, monster walk — 15 reps par mouvement"},
  {id:111,name:"Band Pull Apart",muscle:"Épaules",equipment:"Élastique",videoUrl:"https://www.youtube.com/embed/HFv0e5JqULM",notes:"Bras tendus devant, écarter l'élastique à hauteur des épaules, omoplate rétractées"},
  {id:112,name:"RDL Unilatéral Haltère",muscle:"Jambes",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/qH1lLrkXNRE",notes:"Vitesse lente, équilibre, dos plat — jambe d'appui légèrement fléchie"},
  {id:113,name:"Planche sur Genoux",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/DHBMtGlXnmk",notes:"Gainage actif, stopper si doming abdominal visible"},
  {id:114,name:"Vélo Stationnaire",muscle:"Jambes",equipment:"Machine",videoUrl:"https://www.youtube.com/embed/JqaCVNKRWF4",notes:"FC < 140 bpm, cadence modérée, dos droit"},

  // ── AVANT-BRAS ──
  {id:115,name:"Curl Poignet Haltères",muscle:"Avant-bras",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/rUDDhR3DNeY",notes:"Avant-bras posés sur les cuisses, flexion complète du poignet, tempo lent"},
  {id:116,name:"Curl Poignet Inversé",muscle:"Avant-bras",equipment:"Haltères",videoUrl:"https://www.youtube.com/embed/a4NaRXbzOOE",notes:"Prise pronation, extension du poignet vers le haut, avant-bras fixés sur les cuisses"},

  // ── POWERLIFTING ──
  {id:117,name:"Squat Pause",muscle:"Jambes",equipment:"Barre",videoUrl:"",notes:"Pause 2-3s en bas, genoux alignés, sortie explosive — garder les abdos braqués"},
  {id:118,name:"Front Squat",muscle:"Jambes",equipment:"Barre",videoUrl:"",notes:"Coudes hauts, dos vertical, barre sur les deltoïdes antérieurs — descente lente"},

  // ── CARDIO / POMPIERS ──
  {id:119,name:"Footing foncier",muscle:"Cardio",equipment:"Poids du corps",videoUrl:"",notes:"Zone conversationnelle (RPE 4/10) — tu dois pouvoir parler normalement pendant tout l'effort. C'est la base aérobie."},
  {id:120,name:"Luc-Léger (Navette)",muscle:"Cardio",equipment:"Poids du corps",videoUrl:"",notes:"App : 'Beep Test' ou 'Navette Test'. Depuis le niveau 1. Stop quand tu rates 2 lignes consécutives. VMA ≈ niveau atteint × 0,5 km/h."},
  {id:121,name:"Fractionnés VMA",muscle:"Cardio",equipment:"Poids du corps",videoUrl:"",notes:"Effort à ~100% VMA sur la distance ou durée indiquée. Récupération complète entre chaque répétition. Ne pas partir trop vite sur le 1er."},
  {id:122,name:"Burpees",muscle:"Cardio",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/TU8QYVW0gDU",notes:"Planche → pompe → relevé → saut bras levés. Corps rigide en planche. Rythme régulier, pas de course de vitesse."},
  {id:123,name:"Squat Sauté",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"https://www.youtube.com/embed/A-cFYWvaHr0",notes:"Réception souple genoux fléchis → rechainer immédiatement. Explosivité, genoux dans l'axe à chaque atterrissage."},
  {id:124,name:"Fentes Sautées",muscle:"Jambes",equipment:"Poids du corps",videoUrl:"",notes:"Changer de jambe dans les airs, atterrissage souple. Genoux dans l'axe, buste droit."},

  // ── GAINAGE CROSSFIT ──
  {id:125,name:"Superman (Arch Hold)",muscle:"Dos",equipment:"Poids du corps",videoUrl:"",notes:"Face au sol, bras et jambes tendus. Soulever simultanément bras et jambes en contractant les lombaires et fessiers. Tenir 2-3s en haut, redescendre lentement. Renforce la chaîne postérieure."},
  {id:126,name:"Hollow Hold",muscle:"Abdominaux",equipment:"Poids du corps",videoUrl:"",notes:"Sur le dos, bas du dos plaqué au sol. Bras tendus derrière la tête, jambes tendues à 30-45° du sol. Contracter les abdos pour maintenir la position. Variante débutant : genoux fléchis. Mouvement de base en CrossFit et gymnastique."},
];

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
  // ── PROGRAMME MAISON — BARRE DE TRACTION + HALTÈRES ───────────────────────
  {id:4,name:"Force Maison 3j/sem",category:"Force",level:"Débutant / Intermédiaire",weeks:[
    {label:"Semaine 1 — Découverte",days:[
      {label:"Séance A — Bas + Poussé",exercises:[mkEx(14,4,"12","90s"),mkEx(9,3,"12","75s"),mkEx(24,3,"12","90s"),mkEx(45,3,"12","75s"),mkEx(54,3,"Max","75s"),mkEx(115,3,"20","45s"),mkEx(8,3,"40s","45s")]},
      {label:"Séance B — Dos + Avant-bras",exercises:[mkEx(3,4,"Max","2min"),mkEx(33,3,"12","75s"),mkEx(15,3,"12","90s"),mkEx(49,3,"15","60s"),mkEx(116,3,"20","45s"),mkEx(90,3,"30s","75s"),mkEx(61,3,"15","60s")]},
      {label:"Séance C — Full Body + Épaules",exercises:[mkEx(23,3,"10","90s"),mkEx(103,4,"12","75s"),mkEx(41,3,"12","75s"),mkEx(42,3,"15","60s"),mkEx(56,3,"15","60s"),mkEx(6,3,"12","60s"),mkEx(66,3,"40s","45s")]},
    ]},
    {label:"Semaine 2 — Construction",days:[
      {label:"Séance A — Bas + Poussé",exercises:[mkEx(14,4,"12","90s"),mkEx(9,3,"14","75s"),mkEx(24,4,"10","90s"),mkEx(45,3,"12","75s"),mkEx(54,3,"Max","75s"),mkEx(115,3,"20","45s"),mkEx(8,3,"45s","45s")]},
      {label:"Séance B — Dos + Avant-bras",exercises:[mkEx(3,4,"Max","2min"),mkEx(33,4,"12","75s"),mkEx(15,4,"10","90s"),mkEx(49,3,"15","60s"),mkEx(116,3,"20","45s"),mkEx(90,4,"30s","75s"),mkEx(61,3,"15","60s")]},
      {label:"Séance C — Full Body + Épaules",exercises:[mkEx(23,4,"10","90s"),mkEx(103,4,"12","75s"),mkEx(41,3,"12","75s"),mkEx(42,3,"15","60s"),mkEx(56,3,"15","60s"),mkEx(6,3,"12","60s"),mkEx(66,3,"45s","45s")]},
    ]},
    {label:"Semaine 3 — Intensification",days:[
      {label:"Séance A — Bas + Poussé",exercises:[mkEx(14,4,"10","90s"),mkEx(9,4,"12","75s"),mkEx(24,4,"10","90s"),mkEx(45,4,"10","75s"),mkEx(54,4,"Max","90s"),mkEx(115,4,"20","45s"),mkEx(8,4,"45s","45s")]},
      {label:"Séance B — Dos + Avant-bras",exercises:[mkEx(3,5,"Max","2min"),mkEx(33,4,"12","75s"),mkEx(15,4,"10","90s"),mkEx(49,4,"12","60s"),mkEx(116,4,"20","45s"),mkEx(90,4,"35s","75s"),mkEx(61,4,"15","60s")]},
      {label:"Séance C — Full Body + Épaules",exercises:[mkEx(23,4,"10","90s"),mkEx(103,4,"12","75s"),mkEx(41,4,"10","75s"),mkEx(42,4,"15","60s"),mkEx(56,4,"12","60s"),mkEx(6,4,"10","60s"),mkEx(66,4,"45s","45s")]},
    ]},
    {label:"Semaine 4 — Peak",days:[
      {label:"Séance A — Bas + Poussé",exercises:[mkEx(14,5,"8","2min"),mkEx(9,4,"12","75s"),mkEx(24,4,"8","2min"),mkEx(45,4,"10","90s"),mkEx(54,4,"Max","90s"),mkEx(115,4,"20","45s"),mkEx(8,4,"50s","45s")]},
      {label:"Séance B — Dos + Avant-bras",exercises:[mkEx(3,5,"Max","2min"),mkEx(33,4,"10","90s"),mkEx(15,4,"8","2min"),mkEx(49,4,"12","60s"),mkEx(116,4,"20","45s"),mkEx(90,4,"40s","75s"),mkEx(61,4,"15","60s")]},
      {label:"Séance C — Full Body + Épaules",exercises:[mkEx(23,4,"8","2min"),mkEx(103,4,"10","90s"),mkEx(41,4,"10","90s"),mkEx(42,4,"15","60s"),mkEx(56,4,"12","60s"),mkEx(6,4,"10","60s"),mkEx(66,4,"50s","45s")]},
    ]},
  ]},

  // ── PROGRAMME FORCE SBD — 6 SEMAINES ─────────────────────────────────────
  {id:5,name:"Force SBD 6 semaines",category:"Powerlifting",level:"Avancé",weeks:[
    {label:"S1 — Accumulation @75%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,1,"5","3min","75% 1RM"),mkEx(1,4,"5","3min","70% 1RM"),mkEx(117,3,"5","2min","65% 1RM"),mkEx(11,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 1 — Bench lourd",exercises:[mkEx(2,1,"5","3min","75% 1RM"),mkEx(2,4,"5","3min","70% 1RM"),mkEx(58,3,"6","2min","70% 1RM"),mkEx(10,4,"8","90s"),mkEx(56,3,"12","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,1,"4","3min","75% 1RM"),mkEx(4,3,"4","3min","70% 1RM"),mkEx(118,3,"6","2min","65% 1RM"),mkEx(16,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 2 — Bench volume",exercises:[mkEx(2,4,"6","2min","70% 1RM"),mkEx(26,3,"10","90s"),mkEx(32,4,"10","75s"),mkEx(6,3,"12","75s")]},
    ]},
    {label:"S2 — Accumulation @77.5%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,1,"5","3min","77.5% 1RM"),mkEx(1,4,"5","3min","72.5% 1RM"),mkEx(117,3,"5","2min","65% 1RM"),mkEx(11,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 1 — Bench lourd",exercises:[mkEx(2,1,"5","3min","77.5% 1RM"),mkEx(2,4,"5","3min","72.5% 1RM"),mkEx(58,3,"6","2min","72.5% 1RM"),mkEx(10,4,"8","90s"),mkEx(56,3,"12","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,1,"4","3min","77.5% 1RM"),mkEx(4,3,"4","3min","72.5% 1RM"),mkEx(118,3,"6","2min","65% 1RM"),mkEx(16,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 2 — Bench volume",exercises:[mkEx(2,4,"6","2min","72.5% 1RM"),mkEx(26,3,"10","90s"),mkEx(32,4,"10","75s"),mkEx(6,3,"12","75s")]},
    ]},
    {label:"S3 — Accumulation max @80%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,1,"5","3min","80% 1RM"),mkEx(1,4,"5","3min","75% 1RM"),mkEx(117,3,"5","2min","67.5% 1RM"),mkEx(11,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 1 — Bench lourd",exercises:[mkEx(2,1,"5","3min","80% 1RM"),mkEx(2,4,"5","3min","75% 1RM"),mkEx(58,3,"6","2min","75% 1RM"),mkEx(10,4,"8","90s"),mkEx(56,3,"12","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,1,"4","3min","80% 1RM"),mkEx(4,3,"4","3min","75% 1RM"),mkEx(118,3,"6","2min","67.5% 1RM"),mkEx(16,3,"10","90s"),mkEx(13,3,"12","75s")]},
      {label:"Upper 2 — Bench volume",exercises:[mkEx(2,4,"6","2min","75% 1RM"),mkEx(26,3,"10","90s"),mkEx(32,4,"10","75s"),mkEx(6,3,"12","75s")]},
    ]},
    {label:"S4 — Intensification @82.5%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,1,"4","4min","82.5% 1RM"),mkEx(1,4,"4","3min","77.5% 1RM"),mkEx(117,3,"4","2min","70% 1RM"),mkEx(11,3,"8","90s"),mkEx(13,3,"10","75s")]},
      {label:"Upper 1 — Bench lourd",exercises:[mkEx(2,1,"4","4min","82.5% 1RM"),mkEx(2,4,"4","3min","77.5% 1RM"),mkEx(58,3,"4","2min","77.5% 1RM"),mkEx(10,4,"6","90s"),mkEx(56,3,"10","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,1,"3","4min","82.5% 1RM"),mkEx(4,3,"3","3min","77.5% 1RM"),mkEx(118,3,"5","2min","70% 1RM"),mkEx(16,3,"8","90s"),mkEx(13,3,"10","75s")]},
      {label:"Upper 2 — Bench volume",exercises:[mkEx(2,4,"5","2min","77.5% 1RM"),mkEx(26,3,"8","90s"),mkEx(32,4,"8","75s"),mkEx(6,3,"10","75s")]},
    ]},
    {label:"S5 — Pic de contrainte @85%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,1,"3","4min","85% 1RM"),mkEx(1,3,"4","3min","80% 1RM"),mkEx(117,2,"3","2min","72.5% 1RM"),mkEx(11,3,"8","90s"),mkEx(13,2,"10","75s")]},
      {label:"Upper 1 — Bench lourd",exercises:[mkEx(2,1,"3","4min","85% 1RM"),mkEx(2,3,"4","3min","80% 1RM"),mkEx(58,3,"3","2min","80% 1RM"),mkEx(10,3,"6","90s"),mkEx(56,2,"10","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,1,"3","4min","85% 1RM"),mkEx(4,2,"3","3min","80% 1RM"),mkEx(118,2,"4","2min","72.5% 1RM"),mkEx(16,3,"8","90s"),mkEx(13,2,"10","75s")]},
      {label:"Upper 2 — Bench volume",exercises:[mkEx(2,3,"5","2min","80% 1RM"),mkEx(26,3,"8","90s"),mkEx(32,3,"8","75s"),mkEx(6,3,"10","75s")]},
    ]},
    {label:"S6 — Deload actif @70%",days:[
      {label:"Lower 1 — Squat",exercises:[mkEx(1,3,"3","3min","70% 1RM"),mkEx(11,2,"12","90s"),mkEx(13,2,"12","75s")]},
      {label:"Upper 1 — Bench",exercises:[mkEx(2,3,"3","3min","70% 1RM"),mkEx(58,2,"6","90s","70% 1RM"),mkEx(10,2,"10","75s")]},
      {label:"Lower 2 — Deadlift",exercises:[mkEx(4,3,"3","3min","70% 1RM"),mkEx(16,2,"12","90s"),mkEx(13,2,"12","75s")]},
      {label:"Upper 2 — Bench",exercises:[mkEx(2,3,"3","3min","70% 1RM"),mkEx(26,2,"12","90s"),mkEx(32,2,"12","75s")]},
    ]},
  ]},

  {id:3,name:"Programme Grossesse",category:"Prénatal",level:"Tous niveaux",weeks:[
    {label:"T1 — S1·S12",days:[
      {label:"Lundi · Bas du corps",exercises:[mkEx(110,2,"15","45s",""),mkEx(1,4,"8","90s","73% 1RM"),mkEx(106,4,"8","90s","70% 1RM"),mkEx(107,4,"12","60s",""),mkEx(11,3,"12","75s","65% 1RM"),mkEx(108,3,"12/côté","60s",""),mkEx(109,3,"10/côté","45s","2kg")]},
      {label:"Mardi · Cardio & Traction",exercises:[mkEx(81,1,"20 min","","FC < 140 bpm"),mkEx(3,4,"5","90s",""),mkEx(32,4,"10","75s","70% 1RM"),mkEx(34,3,"10","60s","67% 1RM"),mkEx(37,3,"15","45s",""),mkEx(52,3,"10","60s",""),mkEx(90,3,"25 m","90s","")]},
      {label:"Jeudi · Haut du corps",exercises:[mkEx(111,2,"15","45s",""),mkEx(5,4,"8","90s","70% 1RM"),mkEx(26,3,"10","75s","67% 1RM"),mkEx(3,4,"5","90s",""),mkEx(33,4,"8/côté","75s","67% 1RM"),mkEx(34,3,"10","60s","65% 1RM"),mkEx(40,3,"15","45s",""),mkEx(59,3,"12","45s",""),mkEx(48,3,"10","60s","")]},
      {label:"Vendredi · Full Body",exercises:[mkEx(114,1,"15 min","","FC < 140 bpm"),mkEx(1,3,"10","75s","65% 1RM"),mkEx(106,3,"8","75s","62% 1RM"),mkEx(103,3,"10","60s",""),mkEx(45,3,"10","60s","65% 1RM"),mkEx(112,3,"8/côté","60s",""),mkEx(113,3,"40s","45s","")]},
    ]},
    {label:"T2 — S13·S26",days:[
      {label:"Lundi · Bas du corps",exercises:[mkEx(110,2,"15","45s",""),mkEx(1,4,"8","90s","70% 1RM"),mkEx(106,4,"8","90s","67% 1RM"),mkEx(107,4,"12","60s",""),mkEx(11,3,"12","75s","62% 1RM"),mkEx(108,3,"12/côté","60s",""),mkEx(109,3,"10/côté","45s","2kg")]},
      {label:"Mardi · Cardio & Traction",exercises:[mkEx(81,1,"20 min","","FC < 140 bpm"),mkEx(3,4,"5","90s",""),mkEx(32,4,"10","75s","65% 1RM"),mkEx(34,3,"10","60s","62% 1RM"),mkEx(37,3,"15","45s",""),mkEx(52,3,"10","60s",""),mkEx(90,3,"25 m","90s","")]},
      {label:"Jeudi · Haut du corps",exercises:[mkEx(111,2,"15","45s",""),mkEx(5,4,"8","90s","65% 1RM"),mkEx(26,3,"10","75s","67% 1RM"),mkEx(3,4,"5","90s",""),mkEx(33,4,"8/côté","75s","62% 1RM"),mkEx(34,3,"10","60s","60% 1RM"),mkEx(40,3,"15","45s",""),mkEx(59,3,"12","45s",""),mkEx(48,3,"10","60s","")]},
      {label:"Vendredi · Full Body",exercises:[mkEx(114,1,"15 min","","FC < 140 bpm"),mkEx(1,3,"10","75s","62% 1RM"),mkEx(106,3,"8","75s","59% 1RM"),mkEx(103,3,"10","60s",""),mkEx(45,3,"10","60s","65% 1RM"),mkEx(112,3,"8/côté","60s",""),mkEx(113,3,"40s","45s","")]},
    ]},
    {label:"T3 — S27·S40",days:[
      {label:"Lundi · Bas du corps",exercises:[mkEx(110,2,"15","45s",""),mkEx(1,3,"8","90s","65% 1RM"),mkEx(106,4,"8","90s","62% 1RM"),mkEx(107,4,"12","60s",""),mkEx(11,3,"12","75s","60% 1RM"),mkEx(108,3,"12/côté","60s",""),mkEx(109,3,"10/côté","45s","2kg")]},
      {label:"Mardi · Cardio & Traction",exercises:[mkEx(81,1,"20 min","","FC < 140 bpm"),mkEx(3,4,"5","90s",""),mkEx(32,4,"10","75s","65% 1RM"),mkEx(34,3,"10","60s","62% 1RM"),mkEx(37,3,"15","45s",""),mkEx(52,3,"10","60s",""),mkEx(90,3,"25 m","90s","")]},
      {label:"Jeudi · Haut du corps",exercises:[mkEx(111,2,"15","45s",""),mkEx(5,4,"8","90s","62% 1RM"),mkEx(26,3,"10","75s","67% 1RM"),mkEx(3,4,"5","90s",""),mkEx(33,4,"8/côté","75s","62% 1RM"),mkEx(34,3,"10","60s","60% 1RM"),mkEx(40,3,"15","45s",""),mkEx(59,3,"12","45s",""),mkEx(48,3,"10","60s","")]},
      {label:"Vendredi · Full Body",exercises:[mkEx(114,1,"15 min","","FC < 140 bpm"),mkEx(1,3,"10","75s","58% 1RM"),mkEx(106,3,"8","75s","55% 1RM"),mkEx(103,3,"10","60s",""),mkEx(45,3,"10","60s","65% 1RM"),mkEx(112,3,"8/côté","60s",""),mkEx(113,3,"40s","45s","")]},
    ]},
  ]},
];

// ─── PROGRAMME POMPIERS (seed éditable) ──────────────────────────────────────
const POMPIERS_PROG = {id:"pompiers_pros",_v:3,name:"Programme Pompiers Pros",category:"Pompiers",level:"Intermédiaire",weeks:[
  // ── S1 : TESTS DE RÉFÉRENCE ─────────────────────────────────────────────────
  {label:"S1 — Tests de référence",days:[
    {label:"🏃 Foncier — Calibrage allure",exercises:[
      mkEx(119,1,"5 km","—","RPE 4-5/10","Note ton pace (min/km) en zone conversationnelle — c'est ta référence footing pour tout le programme"),
    ]},
    {label:"⚡ Luc-Léger — Test initial",exercises:[
      mkEx(119,1,"15 min","—","RPE 3/10","Footing léger + mobilité chevilles + 4 accélérations progressives sur 20m"),
      mkEx(120,1,"Jusqu'à épuisement","—","","Depuis le niveau 1 jusqu'au max. Stop quand tu rates 2 lignes consécutives. Note le niveau atteint → VMA ≈ niveau × 0,5 km/h"),
      mkEx(119,1,"10 min","—","RPE 2/10","Récupération active — trot très lent, ne pas s'asseoir"),
    ]},
    {label:"🏋️ Salle — Estimation 1RM & Technique",exercises:[
      mkEx(1,4,"10 / 8 / 5 / 3","3 min","Montée progressive"),
      mkEx(4,4,"10 / 8 / 5 / 3","3 min","Montée progressive"),
      mkEx(2,4,"10 / 8 / 5 / 3","2 min","Montée progressive"),
      mkEx(10,3,"12","90s","Technique"),
      mkEx(5,3,"12","90s","Technique"),
      mkEx(8,3,"Max (secondes)","60s",""),
    ]},
    {label:"🏠 Maison — Tests corps",exercises:[
      mkEx(3,1,"Max","—",""),
      mkEx(30,1,"Max","—",""),
      mkEx(8,3,"Max (secondes)","60s",""),
      mkEx(63,3,"30s","30s",""),
    ]},
  ]},
  // ── S2 : BASE — PRISE DE REPÈRES ────────────────────────────────────────────
  {label:"S2 — Base · Prise de repères",days:[
    {label:"🏃 Foncier",exercises:[
      mkEx(119,1,"5 km","—","RPE 4/10","Zone conversationnelle tout au long — tu dois pouvoir parler"),
    ]},
    {label:"⚡ Luc-Léger",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,8,"30s effort / 30s récup","Récup passive","100","vma","Allure soutenue sur chaque répétition. Récup complète entre chaque."),
      mkEx(119,1,"10 min","—","RPE 2/10","Retour au calme — trot léger"),
    ]},
    {label:"🏋️ Salle — Technique @60% 1RM",exercises:[
      mkPct(1,3,"12","2 min","60","1rm_squat"),
      mkPct(4,3,"10","2 min","60","1rm_sdt"),
      mkPct(2,3,"12","90s","60","1rm_bench"),
      mkEx(10,3,"12","90s","Technique"),
      mkEx(5,3,"12","90s","Léger"),
      mkEx(8,4,"40s","45s",""),
    ]},
    {label:"🏠 Maison — Circuit 3 tours",exercises:[
      mkEx(3,3,"Max -2","90s",""),
      mkEx(30,3,"15","60s",""),
      mkEx(8,3,"45s","45s",""),
      mkEx(63,3,"30s","30s",""),
    ]},
  ]},
  // ── S3 : BASE — MONTÉE EN VOLUME ────────────────────────────────────────────
  {label:"S3 — Base · Montée en volume",days:[
    {label:"🏃 Foncier",exercises:[
      mkEx(119,1,"6 km","—","RPE 4/10","Zone conversationnelle — même allure qu'en S2"),
    ]},
    {label:"⚡ Luc-Léger",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,10,"30s effort / 30s récup","Récup passive","100","vma"),
      mkEx(119,1,"10 min retour calme","—","RPE 3/10"),
    ]},
    {label:"🏋️ Salle — Volume @65% 1RM",exercises:[
      mkPct(1,4,"10","2 min","65","1rm_squat"),
      mkPct(4,4,"8","2 min","65","1rm_sdt"),
      mkPct(2,4,"10","90s","65","1rm_bench"),
      mkEx(10,3,"12","90s","Charges moyennes"),
      mkEx(5,3,"10","90s","Charges moyennes"),
      mkEx(8,4,"45s","45s",""),
      mkEx(66,3,"30s","30s",""),
    ]},
    {label:"🏠 Maison — Circuit 3 tours",exercises:[
      mkEx(3,3,"Max -2","90s",""),
      mkEx(30,3,"20","60s",""),
      mkEx(122,3,"10","60s",""),
      mkEx(8,3,"50s","45s",""),
    ]},
  ]},
  // ── S4 : CONSTRUCTION ───────────────────────────────────────────────────────
  {label:"S4 — Construction · Intensité progressive",days:[
    {label:"🏃 Foncier + Sprints",exercises:[
      mkEx(119,1,"6 km","—","RPE 4/10","Footing conversationnel, puis récupère 3 min avant les sprints"),
      mkEx(121,4,"100m sprint","3 min","RPE 8/10","Sprint maximal sur 100m, marche retour. Bien récupérer entre chaque."),
    ]},
    {label:"⚡ Luc-Léger — Transition 1min",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,12,"30s effort / 30s récup","Récup passive","100","vma"),
      mkEx(119,1,"10 min","—","RPE 2/10","Retour au calme — trot léger"),
    ]},
    {label:"🏋️ Salle — Construction @70% 1RM",exercises:[
      mkPct(1,4,"8","2 min","70","1rm_squat"),
      mkPct(4,4,"6","2 min","70","1rm_sdt"),
      mkPct(2,4,"8","2 min","70","1rm_bench"),
      mkEx(10,4,"10","90s","Charges moyennes"),
      mkEx(5,4,"8","90s","Charges moyennes"),
      mkEx(8,4,"50s","45s",""),
    ]},
    {label:"🏠 Maison — Circuit 4 tours",exercises:[
      mkEx(3,4,"Max -1","90s",""),
      mkEx(30,4,"20","60s",""),
      mkEx(122,4,"12","60s",""),
      mkEx(123,3,"15","45s",""),
    ]},
  ]},
  // ── S5 : DÉVELOPPEMENT ──────────────────────────────────────────────────────
  {label:"S5 — Développement · Spécifique",days:[
    {label:"🏃 Foncier + Sprints",exercises:[
      mkEx(119,1,"7 km","—","RPE 4-5/10","Légèrement plus soutenu qu'en S4 — allure ferme mais contrôlée"),
      mkEx(121,6,"100m sprint","3 min","RPE 8-9/10","Sprints explosifs — cherche à accélérer progressivement sur les 100m"),
    ]},
    {label:"⚡ Luc-Léger — Intervalles 1min",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,8,"1 min effort / 1 min récup","Récup passive","100","vma"),
      mkEx(119,1,"10 min","—","RPE 2/10","Retour au calme — trot léger"),
    ]},
    {label:"🏋️ Salle — Développement @75% 1RM",exercises:[
      mkPct(1,4,"6","2 min 30s","75","1rm_squat"),
      mkPct(4,4,"5","2 min 30s","75","1rm_sdt"),
      mkPct(2,4,"6","2 min","75","1rm_bench"),
      mkEx(10,4,"8","2 min","Charges lourdes"),
      mkEx(5,4,"6","2 min","Charges lourdes"),
      mkEx(8,4,"55s","45s",""),
    ]},
    {label:"🏠 Maison — Épreuve simulation",exercises:[
      mkEx(3,4,"Max","90s",""),
      mkEx(122,4,"15","60s",""),
      mkEx(30,4,"25","45s",""),
      mkEx(123,4,"20","45s",""),
      mkEx(124,3,"20 (10/jambe)","45s",""),
    ]},
  ]},
  // ── S6 : PIC DE CHARGE ──────────────────────────────────────────────────────
  {label:"S6 — Pic de charge",days:[
    {label:"🏃 Foncier — Variation allure",exercises:[
      mkEx(119,1,"8 km","—","RPE 4/10","Distance totale — inclut la portion à allure soutenue ci-dessous"),
      mkEx(119,1,"dont 1,5 km en continu","—","RPE 6-7/10","Au milieu de la sortie — allure soutenue sans sprint, retour en RPE 4/10 ensuite"),
    ]},
    {label:"⚡ Luc-Léger — Volume max",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,10,"1 min effort / 1 min récup","Récup passive","100","vma"),
      mkEx(119,1,"10 min","—","RPE 2/10","Retour au calme — trot léger"),
    ]},
    {label:"🏋️ Salle — Pic @80% 1RM",exercises:[
      mkPct(1,5,"5","3 min","80","1rm_squat"),
      mkPct(4,5,"4","3 min","80","1rm_sdt"),
      mkPct(2,5,"5","3 min","80","1rm_bench"),
      mkEx(10,4,"8","2 min","Lourd"),
      mkEx(5,4,"5","2 min 30s","Lourd"),
    ]},
    {label:"🏠 Maison — Circuit chrono",exercises:[
      mkEx(3,5,"Max","90s",""),
      mkEx(122,5,"15","60s",""),
      mkEx(30,5,"25","45s",""),
      mkEx(63,3,"40s","20s",""),
    ]},
  ]},
  // ── S7 : AFFÛTAGE ───────────────────────────────────────────────────────────
  {label:"S7 — Affûtage · Fraîcheur physique",days:[
    {label:"🏃 Foncier — Qualité",exercises:[
      mkEx(119,1,"5 km","—","RPE 4/10","Affûtage — priorité à la qualité du geste et de la respiration, pas à la performance"),
    ]},
    {label:"⚡ Luc-Léger — Volume réduit",exercises:[
      mkEx(119,1,"10 min","—","RPE 3/10","Footing léger + mobilité — ne pas s'essouffler avant le travail"),
      mkPct(121,6,"1 min effort / 1 min récup","Récup passive","100","vma"),
      mkEx(119,1,"10 min","—","RPE 2/10","Retour au calme — trot léger"),
    ]},
    {label:"🏋️ Salle — Affûtage @75% 1RM",exercises:[
      mkPct(1,3,"5","3 min","75","1rm_squat"),
      mkPct(4,3,"4","3 min","75","1rm_sdt"),
      mkPct(2,3,"5","2 min","75","1rm_bench"),
      mkEx(10,3,"8","90s","Technique"),
      mkEx(5,3,"5","90s","Technique"),
    ]},
    {label:"🏠 Maison — Circuit allégé",exercises:[
      mkEx(3,3,"Max -2","2 min",""),
      mkEx(30,3,"20","60s",""),
      mkEx(8,3,"45s","45s",""),
    ]},
  ]},
  // ── S8 : VALIDATION — RETESTS ───────────────────────────────────────────────
  {label:"S8 — Validation · Retests",days:[
    {label:"🏃 Foncier — Retest allure",exercises:[
      mkEx(119,1,"5 km","—","RPE 4-5/10","Mêmes conditions qu'en S1. Compare ton pace (min/km) — c'est ta progression sur 8 semaines."),
    ]},
    {label:"⚡ Luc-Léger — Retest max",exercises:[
      mkEx(119,1,"15 min","—","RPE 3/10","Mêmes conditions qu'en S1 — footing léger + mobilité + 4 accélérations"),
      mkEx(120,1,"Jusqu'à épuisement","—","","Depuis le niveau 1. Note le niveau atteint et compare à S1. C'est ta progression sur 8 semaines."),
      mkEx(119,1,"10 min","—","RPE 2/10","Récupération active"),
    ]},
    {label:"🏋️ Salle — Retest 1RM",exercises:[
      mkEx(1,4,"10 / 8 / 5 / 3","3 min","Montée progressive — compare à S1"),
      mkEx(4,4,"10 / 8 / 5 / 3","3 min","Montée progressive — compare à S1"),
      mkEx(2,4,"10 / 8 / 5 / 3","2 min","Montée progressive — compare à S1"),
      mkEx(8,3,"Max (secondes)","60s","Compare à S1"),
    ]},
    {label:"🏠 Maison — Retests corps",exercises:[
      mkEx(3,1,"Max","—","Compare à S1"),
      mkEx(30,1,"Max","—","Compare à S1"),
      mkEx(8,3,"Max (secondes)","60s","Compare à S1"),
    ]},
  ]},
]};
SEED_PROGRAMS.unshift(POMPIERS_PROG);

// ─── PROGRAMME HYPERTROPHIE FONCTIONNELLE 7 SEMAINES ─────────────────────────
const HYPERTRO_PROG = {id:"hypertro_fonctionnelle",name:"Hypertrophie Fonctionnelle 7 sem.",category:"Hypertrophie",level:"Intermédiaire",weeks:[
  // ── S1 : ADAPTATION ─────────────────────────────────────────────────────────
  {label:"S1 — Adaptation · Découverte",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkEx(14,3,"15","90s","Moyen","Squat Gobelet — dos droit, coudes hauts, profondeur max"),
      mkEx(23,3,"12/jambe","—","","SUPERSET A1 → enchaîner sans repos. Pied arrière surélevé, buste droit."),
      mkEx(30,3,"15","75s","","SUPERSET A2 → repos 75s après la paire. Corps gainé, coudes 45°."),
      mkEx(16,3,"15","—","Moyen","SUPERSET B1 → enchaîner. Extension complète des hanches."),
      mkEx(41,3,"12","75s","","SUPERSET B2 → repos 75s. Rotation des poignets pendant le mouvement."),
      mkEx(123,2,"12","60s","","Finisher plyométrique — réception souple, rebond immédiat"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkEx(15,3,"15","90s","Léger-Moyen","RDL — dos plat, charnière pure de hanche. Descendre jusqu'à tension ischio."),
      mkEx(103,3,"12","90s","","Inverted Row — corps rigide, tirer le sternum vers la barre"),
      mkEx(33,3,"12/côté","—","","SUPERSET A1 → enchaîner. Dos plat, tirer vers la hanche."),
      mkEx(49,3,"15","75s","","SUPERSET A2 → repos 75s. Poignets neutres."),
      mkEx(35,3,"15","—","","SUPERSET B1 → enchaîner. Ne pas dépasser la ligne du corps."),
      mkEx(112,3,"10/jambe","75s","","SUPERSET B2 → repos 75s. Vitesse lente, dos plat."),
      mkEx(66,3,"30s/côté","30s","","Planche latérale — hanches alignées"),
    ]},
    {label:"Séance C — EMOM 16 min Fonctionnel",exercises:[
      mkEx(122,4,"6 reps","Reste de la minute","","EMOM 16 min — 4 rotations. Minute 1 : Burpees"),
      mkEx(30,4,"10 reps","Reste de la minute","","EMOM 16 min — Minute 2 : Pompes. Coudes à 45°."),
      mkEx(124,4,"10 reps","Reste de la minute","","EMOM 16 min — Minute 3 : Fentes Sautées. Atterrissage souple."),
      mkEx(63,4,"20 reps","Reste de la minute","","EMOM 16 min — Minute 4 : Mountain Climbers. Hanches basses."),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(26,3,"12","—","Moyen","SUPERSET A1 → enchaîner. Développé incliné, inclinaison 30°."),
      mkEx(10,3,"12","75s","Moyen","SUPERSET A2 → repos 75s. Dos parallèle, coudes hauts."),
      mkEx(40,3,"15","—","Léger","SUPERSET B1 → enchaîner. Montée lente, légère flexion coudes."),
      mkEx(6,3,"15","75s","Léger-Moyen","SUPERSET B2 → repos 75s. Supination en haut."),
      mkEx(54,3,"Max","—","","SUPERSET C1 → enchaîner. Corps droit, coudes le long du corps."),
      mkEx(56,3,"12","75s","Léger","SUPERSET C2 → repos 75s. Coudes serrés, extension complète."),
      mkEx(68,3,"8/côté","45s","","Dead Bug — dos plaqué au sol, mouvement lent"),
    ]},
  ]},
  // ── S2 : ADAPTATION ++ ──────────────────────────────────────────────────────
  {label:"S2 — Adaptation · Volume progressif",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkEx(1,3,"12","90s","65% 1RM","Squat barre — profondeur complète, tempo 3-1-1"),
      mkEx(23,3,"12/jambe","—","","SUPERSET A1 → enchaîner"),
      mkEx(30,3,"15","75s","","SUPERSET A2 → repos 75s"),
      mkEx(16,3,"15","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(41,3,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(9,2,"16/jambe","60s","","Fentes marchées — buste droit, grand pas"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkEx(15,3,"12","90s","Moyen","RDL — légère hausse charge vs S1"),
      mkEx(3,3,"Max","90s","","Tractions — descendre jusqu'à extension complète"),
      mkEx(33,3,"12/côté","—","Moyen","SUPERSET A1 → enchaîner"),
      mkEx(49,3,"12","75s","","SUPERSET A2 → repos 75s"),
      mkEx(35,3,"15","—","","SUPERSET B1 → enchaîner"),
      mkEx(112,3,"10/jambe","75s","","SUPERSET B2 → repos 75s"),
      mkEx(8,3,"45s","45s","","Gainage planche — bassin neutre"),
    ]},
    {label:"Séance C — EMOM 16 min Fonctionnel",exercises:[
      mkEx(122,4,"7 reps","Reste de la minute","","EMOM 16 min — 4 rotations. Minute 1 : +1 rep vs S1."),
      mkEx(30,4,"12 reps","Reste de la minute","","EMOM 16 min — Minute 2 : +2 reps vs S1."),
      mkEx(124,4,"12 reps","Reste de la minute","","EMOM 16 min — Minute 3 : +2 reps vs S1."),
      mkEx(63,4,"25 reps","Reste de la minute","","EMOM 16 min — Minute 4 : +5 reps vs S1."),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(26,3,"12","—","Moyen","SUPERSET A1 → enchaîner"),
      mkEx(10,3,"12","75s","Moyen","SUPERSET A2 → repos 75s"),
      mkEx(40,3,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(6,3,"12","75s","Moyen","SUPERSET B2 → repos 75s"),
      mkEx(54,3,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,3,"12","75s","Léger","SUPERSET C2 → repos 75s"),
      mkEx(64,3,"20","45s","","Russian Twist — pieds décollés, rotation complète"),
    ]},
  ]},
  // ── S3 : HYPERTROPHIE ───────────────────────────────────────────────────────
  {label:"S3 — Hypertrophie · 4 séries",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkPct(1,4,"10","90s","70","1rm_squat","Squat — tempo contrôlé 3-0-1"),
      mkEx(23,4,"10/jambe","—","","SUPERSET A1 → enchaîner"),
      mkEx(30,4,"15","75s","","SUPERSET A2 → repos 75s"),
      mkEx(16,4,"12","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(41,4,"10","75s","","SUPERSET B2 → repos 75s"),
      mkEx(9,3,"14/jambe","60s","","Fentes marchées — allure continue"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkPct(15,4,"10","90s","70","1rm_sdt","RDL — focus étirement ischio, phase excentrique lente"),
      mkEx(3,4,"Max","90s","","Tractions — ajouter lest si plus de 10 reps propres"),
      mkEx(33,4,"10/côté","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(49,4,"12","75s","Moyen","SUPERSET A2 → repos 75s"),
      mkEx(17,4,"12/jambe","—","Moyen","SUPERSET B1 — Step Up → enchaîner"),
      mkEx(35,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(62,3,"Max","60s","","Ab Wheel — creuser le ventre, ne pas cambrer"),
    ]},
    {label:"Séance C — EMOM 20 min Fonctionnel",exercises:[
      mkEx(122,5,"8 reps","Reste de la minute","","EMOM 20 min — 5 rotations. Minute 1 : Burpees"),
      mkEx(30,5,"12 reps","Reste de la minute","","EMOM 20 min — Minute 2 : Pompes"),
      mkEx(124,5,"12 reps","Reste de la minute","","EMOM 20 min — Minute 3 : Fentes Sautées"),
      mkEx(63,5,"25 reps","Reste de la minute","","EMOM 20 min — Minute 4 : Mountain Climbers"),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(24,4,"10","—","Moyen-Lourd","SUPERSET A1 — Développé couché haltères → enchaîner"),
      mkEx(10,4,"10","75s","Lourd","SUPERSET A2 → repos 75s"),
      mkEx(40,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(6,4,"12","75s","Moyen","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"10","75s","Moyen","SUPERSET C2 → repos 75s"),
      mkEx(8,3,"50s","45s","","Gainage planche"),
    ]},
  ]},
  // ── S4 : HYPERTROPHIE ++ ────────────────────────────────────────────────────
  {label:"S4 — Hypertrophie · Progression charges",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkPct(1,4,"8","90s","72","1rm_squat","Squat — augmenter la charge vs S3"),
      mkEx(23,4,"10/jambe","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(30,4,"20","75s","","SUPERSET A2 → repos 75s. Pompes déficit si possible."),
      mkEx(16,4,"12","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(5,4,"10","75s","Moyen","SUPERSET B2 — Développé militaire barre → repos 75s"),
      mkEx(123,3,"15","60s","","Finisher — squat sauté explosif"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkPct(15,4,"8","90s","72","1rm_sdt","RDL — charge progressive vs S3"),
      mkEx(3,4,"Max","90s","","Tractions — qualité avant quantité"),
      mkEx(33,4,"10/côté","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(6,4,"12","75s","Moyen","SUPERSET A2 → repos 75s"),
      mkEx(17,4,"12/jambe","—","Lourd","SUPERSET B1 — Step Up → enchaîner"),
      mkEx(112,4,"10/jambe","75s","","SUPERSET B2 → repos 75s"),
      mkEx(66,3,"35s/côté","30s","","Planche latérale — +5s vs S3"),
    ]},
    {label:"Séance C — EMOM 20 min Fonctionnel",exercises:[
      mkEx(122,5,"9 reps","Reste de la minute","","EMOM 20 min — 5 rotations. Minute 1 : +1 rep vs S3."),
      mkEx(30,5,"15 reps","Reste de la minute","","EMOM 20 min — Minute 2 : +3 reps."),
      mkEx(124,5,"14 reps","Reste de la minute","","EMOM 20 min — Minute 3 : +2 reps."),
      mkEx(63,5,"30 reps","Reste de la minute","","EMOM 20 min — Minute 4 : +5 reps."),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(26,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(10,4,"10","75s","Lourd","SUPERSET A2 → repos 75s"),
      mkEx(40,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(47,4,"12","75s","Moyen","SUPERSET B2 — Curl barre → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(59,4,"12","75s","Moyen","SUPERSET C2 — Triceps corde poulie → repos 75s"),
      mkEx(68,3,"10/côté","45s","","Dead Bug — lent et contrôlé"),
    ]},
  ]},
  // ── S5 : INTENSIFICATION ────────────────────────────────────────────────────
  {label:"S5 — Intensification · Charges lourdes",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkPct(1,4,"6","2min","77","1rm_squat","Squat — descente 3s, sortie explosive"),
      mkEx(23,4,"8/jambe","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(30,4,"Max","75s","","SUPERSET A2 — Pompes jusqu'à l'échec → repos 75s"),
      mkEx(16,4,"10","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(5,4,"8","90s","Lourd","SUPERSET B2 — Développé militaire → repos 90s"),
      mkEx(9,3,"12/jambe","60s","Moyen","Fentes marchées — charge continue"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkPct(15,4,"8","2min","75","1rm_sdt","RDL — tension continue, phase excentrique 3s"),
      mkEx(3,4,"Max","2min","","Tractions — rest-pause si nécessaire"),
      mkEx(33,4,"8/côté","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(49,4,"12","75s","Lourd","SUPERSET A2 → repos 75s"),
      mkEx(17,4,"10/jambe","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(35,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(62,3,"Max","60s","","Ab Wheel — contrôle parfait"),
    ]},
    {label:"Séance C — EMOM 20 min Intensifié",exercises:[
      mkEx(122,5,"10 reps","Reste de la minute","","EMOM 20 min — 5 rotations. Minute 1 : Burpees explosifs."),
      mkEx(30,5,"15 reps","Reste de la minute","","EMOM 20 min — Minute 2 : Pompes explosives."),
      mkEx(124,5,"14 reps","Reste de la minute","","EMOM 20 min — Minute 3 : Fentes sautées."),
      mkEx(63,5,"30 reps","Reste de la minute","","EMOM 20 min — Minute 4 : Mountain Climbers rythme max."),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(24,4,"8","—","Lourd","SUPERSET A1 → enchaîner. Phase excentrique 3s."),
      mkEx(10,4,"8","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(40,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(6,4,"10","75s","Lourd","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"8","75s","Moyen-Lourd","SUPERSET C2 → repos 75s"),
      mkEx(8,3,"55s","45s","","Gainage planche — +5s vs S4"),
    ]},
  ]},
  // ── S6 : PIC DE CHARGE ──────────────────────────────────────────────────────
  {label:"S6 — Pic de charge · Intensification max",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkPct(1,5,"5","2min","80","1rm_squat","Squat — 1 série supplémentaire vs S5. Pic de charge."),
      mkEx(23,4,"8/jambe","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(30,4,"Max","75s","","SUPERSET A2 — Pompes à l'échec → repos 75s"),
      mkEx(16,4,"10","—","Très lourd","SUPERSET B1 → enchaîner"),
      mkEx(5,4,"6","90s","Lourd","SUPERSET B2 → repos 90s"),
      mkEx(123,3,"15","60s","","Finisher squat sauté explosif"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkPct(15,5,"5","2min","80","1rm_sdt","RDL — pic de charge, rigueur technique"),
      mkEx(3,5,"Max","2min","","Tractions — pic de volume"),
      mkEx(33,4,"8/côté","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(47,4,"10","75s","Lourd","SUPERSET A2 — Curl barre → repos 75s"),
      mkEx(17,4,"10/jambe","—","Très lourd","SUPERSET B1 → enchaîner"),
      mkEx(35,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(64,3,"25","45s","","Russian Twist — pieds décollés"),
    ]},
    {label:"Séance C — EMOM 20 min Peak",exercises:[
      mkEx(122,5,"10 reps","Reste de la minute","","EMOM 20 min — 5 rotations. Minute 1 : Burpees — intensité maximale."),
      mkEx(30,5,"Max reps","Reste de la minute","","EMOM 20 min — Minute 2 : Pompes jusqu'à l'échec."),
      mkEx(124,5,"16 reps","Reste de la minute","","EMOM 20 min — Minute 3 : pic de volume."),
      mkEx(63,5,"35 reps","Reste de la minute","","EMOM 20 min — Minute 4 : pic de volume."),
    ]},
    {label:"Séance D — Supersets Haut du Corps",exercises:[
      mkEx(26,4,"8","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(10,4,"8","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(40,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(6,4,"10","75s","Lourd","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"8","75s","Lourd","SUPERSET C2 → repos 75s"),
      mkEx(62,3,"Max","60s","","Ab Wheel — pic"),
    ]},
  ]},
  // ── S7 : DELOAD ─────────────────────────────────────────────────────────────
  {label:"S7 — Deload · Récupération active",days:[
    {label:"Séance A — Force & Poids de Corps",exercises:[
      mkEx(14,2,"15","90s","Léger","Squat Gobelet — retour aux bases, qualité du mouvement"),
      mkEx(23,2,"12/jambe","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(30,2,"15","75s","","SUPERSET A2 → repos 75s"),
      mkEx(16,2,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(41,2,"12","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Tirage & Charnière",exercises:[
      mkEx(15,2,"15","90s","Léger","RDL — focus mobilité et technique, charges réduites"),
      mkEx(103,2,"15","90s","","Inverted Row — volume réduit"),
      mkEx(33,2,"12/côté","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(49,2,"15","75s","Léger","SUPERSET A2 → repos 75s"),
      mkEx(8,2,"40s","45s","","Gainage — récupération active"),
    ]},
    {label:"Séance C — EMOM 12 min Récupération",exercises:[
      mkEx(30,3,"10 reps","Reste de la minute","","EMOM 12 min — 3 rotations. Minute 1 : Pompes. Allure légère."),
      mkEx(9,3,"10/jambe","Reste de la minute","","EMOM 12 min — Minute 2 : Fentes marchées légères."),
      mkEx(63,3,"15 reps","Reste de la minute","","EMOM 12 min — Minute 3 : Mountain Climbers, rythme modéré."),
      mkEx(66,3,"25s/côté","Reste de la minute","","EMOM 12 min — Minute 4 : Planche latérale."),
    ]},
    {label:"Séance D — Supersets Légers",exercises:[
      mkEx(26,2,"15","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(10,2,"15","75s","Léger","SUPERSET A2 → repos 75s"),
      mkEx(40,2,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(6,2,"15","75s","Léger","SUPERSET B2 → repos 75s"),
      mkEx(68,2,"8/côté","45s","","Dead Bug — récupération active"),
    ]},
  ]},
]};
SEED_PROGRAMS.push(HYPERTRO_PROG);

// ─── PROGRAMME MAISON 3j/sem — CYCLE 2 ──────────────────────────────────────
const MAISON_CYCLE2 = {id:"maison_3j_cycle2",name:"Maison 3j/sem — Cycle 2",category:"Maison",level:"Débutant / Intermédiaire",weeks:[
  // S1 — DÉCOUVERTE
  {label:"S1 — Découverte · Maîtrise du mouvement",days:[
    {label:"Séance A — Push · Pectoraux & Épaules",exercises:[
      mkEx(24,3,"12","—","","SUPERSET A1 → enchaîner sans repos. Amplitude complète, descente lente 3s."),
      mkEx(30,3,"12","90s","","SUPERSET A2 → repos 90s après la paire. Corps gainé, coudes à 45°."),
      mkEx(41,3,"12","—","","SUPERSET B1 → enchaîner. Rotation des poignets pendant le mouvement."),
      mkEx(40,3,"15","75s","","SUPERSET B2 → repos 75s. Légère flexion des coudes, montée lente."),
      mkEx(54,3,"Max","—","","SUPERSET C1 → enchaîner. Corps droit, coudes le long du corps."),
      mkEx(56,3,"12","75s","","SUPERSET C2 → repos 75s. Coudes serrés, extension complète."),
      mkEx(68,3,"8/côté","45s","","Dead Bug — dos plaqué au sol, mouvement lent et contrôlé"),
    ]},
    {label:"Séance B — Pull · Dos & Biceps",exercises:[
      mkEx(3,3,"Max","2min","","Tractions — descendre jusqu'à extension complète des bras"),
      mkEx(33,3,"12/côté","—","","SUPERSET A1 → enchaîner. Dos plat, tirer vers la hanche."),
      mkEx(49,3,"15","90s","","SUPERSET A2 → repos 90s. Poignets neutres, coudes fixes."),
      mkEx(103,3,"12","—","","SUPERSET B1 → enchaîner. Corps rigide, tirer le sternum vers la barre."),
      mkEx(6,3,"12","75s","","SUPERSET B2 → repos 75s. Supination en haut du mouvement."),
      mkEx(90,3,"20m","90s","","Farmers Walk — dos droit, pas réguliers et rapides"),
      mkEx(61,3,"12","60s","","Relevé de Jambes — jambes tendues, montée lente"),
    ]},
    {label:"Séance C — Jambes · Full Body",exercises:[
      mkEx(23,3,"10/jambe","—","","SUPERSET A1 → enchaîner. Pied arrière surélevé, buste droit."),
      mkEx(16,3,"15","90s","","SUPERSET A2 → repos 90s. Extension complète des hanches en haut."),
      mkEx(9,3,"12/jambe","—","","SUPERSET B1 → enchaîner. Genou arrière proche du sol."),
      mkEx(14,3,"15","90s","","SUPERSET B2 → repos 90s. Coudes hauts, profondeur maximale."),
      mkEx(22,2,"8","90s","","Box Jump — réception souple, genoux fléchis, rebond immédiat"),
      mkEx(63,3,"30s","—","","SUPERSET C1 → enchaîner. Hanches basses, rythme régulier."),
      mkEx(66,3,"25s/côté","45s","","SUPERSET C2 → repos 45s. Hanches alignées, corps en planche."),
    ]},
  ]},
  // S2 — CONSTRUCTION
  {label:"S2 — Construction · Volume progressif",days:[
    {label:"Séance A — Push · Pectoraux & Épaules",exercises:[
      mkEx(24,4,"12","—","","SUPERSET A1 → enchaîner. +1 série vs S1."),
      mkEx(30,4,"12","90s","","SUPERSET A2 → repos 90s"),
      mkEx(41,4,"12","—","","SUPERSET B1 → enchaîner"),
      mkEx(40,4,"15","75s","","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"12","75s","","SUPERSET C2 → repos 75s"),
      mkEx(68,3,"8/côté","45s","","Dead Bug — dos plaqué, mouvement lent"),
    ]},
    {label:"Séance B — Pull · Dos & Biceps",exercises:[
      mkEx(3,4,"Max","2min","","Tractions — +1 série vs S1, qualité avant quantité"),
      mkEx(33,4,"12/côté","—","","SUPERSET A1 → enchaîner"),
      mkEx(49,4,"12","90s","","SUPERSET A2 → repos 90s"),
      mkEx(103,4,"12","—","","SUPERSET B1 → enchaîner"),
      mkEx(6,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(90,4,"20m","90s","","Farmers Walk — +1 série vs S1"),
      mkEx(61,3,"12","60s","","Relevé de Jambes"),
    ]},
    {label:"Séance C — Jambes · Full Body",exercises:[
      mkEx(23,4,"10/jambe","—","","SUPERSET A1 → enchaîner. +1 série vs S1."),
      mkEx(16,4,"15","90s","","SUPERSET A2 → repos 90s"),
      mkEx(9,4,"12/jambe","—","","SUPERSET B1 → enchaîner"),
      mkEx(14,4,"15","90s","","SUPERSET B2 → repos 90s"),
      mkEx(22,3,"10","90s","","Box Jump — +1 série vs S1, réception souple"),
      mkEx(63,3,"30s","—","","SUPERSET C1 → enchaîner"),
      mkEx(66,3,"30s/côté","45s","","SUPERSET C2 → repos 45s. +5s vs S1."),
    ]},
  ]},
  // S3 — INTENSIFICATION
  {label:"S3 — Intensification · Charges montantes",days:[
    {label:"Séance A — Push · Pectoraux & Épaules",exercises:[
      mkEx(24,4,"10","—","","SUPERSET A1 → enchaîner. Charge progressive vs S2, descente 3s."),
      mkEx(30,4,"15","90s","","SUPERSET A2 → repos 90s"),
      mkEx(41,4,"10","—","","SUPERSET B1 → enchaîner. Charge progressive."),
      mkEx(40,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"10","75s","","SUPERSET C2 → repos 75s. Charge progressive."),
      mkEx(8,3,"40s","45s","","Gainage planche — bassin neutre, respiration continue"),
    ]},
    {label:"Séance B — Pull · Dos & Biceps",exercises:[
      mkEx(3,4,"Max","2min","","Tractions — ajouter lest si plus de 10 reps propres"),
      mkEx(33,4,"10/côté","—","","SUPERSET A1 → enchaîner. Charge progressive."),
      mkEx(49,4,"12","90s","","SUPERSET A2 → repos 90s"),
      mkEx(103,4,"10","—","","SUPERSET B1 → enchaîner"),
      mkEx(48,4,"12","75s","","SUPERSET B2 — Curl Incliné → repos 75s. Longue portion, coudes perpendiculaires au sol."),
      mkEx(90,3,"25m","90s","","Farmers Walk — distance augmentée vs S2"),
      mkEx(61,3,"15","60s","","Relevé de Jambes — +3 reps vs S2"),
    ]},
    {label:"Séance C — Jambes · Full Body",exercises:[
      mkEx(23,4,"8/jambe","—","","SUPERSET A1 → enchaîner. Charge progressive, buste vertical."),
      mkEx(16,4,"12","90s","","SUPERSET A2 → repos 90s. Charge progressive."),
      mkEx(9,4,"14/jambe","—","","SUPERSET B1 → enchaîner"),
      mkEx(14,4,"12","90s","","SUPERSET B2 → repos 90s. Kettlebell/haltère plus lourd."),
      mkEx(123,3,"12","60s","","Squat Sauté — réception souple, rechainer immédiatement"),
      mkEx(63,4,"35s","—","","SUPERSET C1 → enchaîner"),
      mkEx(66,4,"30s/côté","45s","","SUPERSET C2 → repos 45s"),
    ]},
  ]},
  // S4 — PIC
  {label:"S4 — Pic · Intensité maximale",days:[
    {label:"Séance A — Push · Pectoraux & Épaules",exercises:[
      mkEx(24,5,"8","—","","SUPERSET A1 → enchaîner. Pic de charge — descente 3s, sortie explosive."),
      mkEx(30,4,"Max","90s","","SUPERSET A2 — Pompes jusqu'à l'échec → repos 90s"),
      mkEx(41,4,"8","—","","SUPERSET B1 → enchaîner. Charge maximale."),
      mkEx(40,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(54,4,"Max","—","","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"8","75s","","SUPERSET C2 → repos 75s. Pic de charge."),
      mkEx(8,3,"45s","45s","","Gainage planche — +5s vs S3"),
    ]},
    {label:"Séance B — Pull · Dos & Biceps",exercises:[
      mkEx(3,5,"Max","2min","","Tractions — pic de volume, +1 série vs S3"),
      mkEx(33,4,"8/côté","—","","SUPERSET A1 → enchaîner. Pic de charge."),
      mkEx(49,4,"10","90s","","SUPERSET A2 → repos 90s"),
      mkEx(103,4,"8","—","","SUPERSET B1 → enchaîner"),
      mkEx(48,4,"10","75s","","SUPERSET B2 → repos 75s. Charge progressive vs S3."),
      mkEx(90,4,"25m","90s","","Farmers Walk — charge maximale"),
      mkEx(61,4,"15","60s","","Relevé de Jambes — +1 série vs S3"),
    ]},
    {label:"Séance C — Jambes · Full Body",exercises:[
      mkEx(23,5,"8/jambe","—","","SUPERSET A1 → enchaîner. +1 série, charge maximale."),
      mkEx(16,4,"10","90s","","SUPERSET A2 → repos 90s. Charge lourde."),
      mkEx(9,4,"12/jambe","—","","SUPERSET B1 → enchaîner"),
      mkEx(14,4,"10","90s","","SUPERSET B2 → repos 90s. Kettlebell/haltère lourd."),
      mkEx(123,3,"15","60s","","Squat Sauté — +3 reps vs S3, explosivité maximale"),
      mkEx(63,4,"40s","—","","SUPERSET C1 → enchaîner"),
      mkEx(66,4,"35s/côté","45s","","SUPERSET C2 → repos 45s. Pic de gainage."),
    ]},
  ]},
  // S5 — DELOAD
  {label:"S5 — Deload · Récupération active",days:[
    {label:"Séance A — Push · Récupération",exercises:[
      mkEx(24,3,"12","—","Léger","SUPERSET A1 → enchaîner. Retour aux bases, qualité du mouvement."),
      mkEx(30,3,"12","90s","","SUPERSET A2 → repos 90s. Charges réduites."),
      mkEx(41,3,"12","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(40,3,"15","75s","Léger","SUPERSET B2 → repos 75s"),
      mkEx(56,2,"12","75s","Léger","Extension Triceps — léger, focus technique"),
      mkEx(68,2,"8/côté","45s","","Dead Bug — récupération active"),
    ]},
    {label:"Séance B — Pull · Récupération",exercises:[
      mkEx(3,3,"Max","2min","","Tractions — volume réduit, qualité technique"),
      mkEx(33,3,"12/côté","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(49,3,"15","90s","Léger","SUPERSET A2 → repos 90s"),
      mkEx(103,3,"15","—","","SUPERSET B1 → enchaîner"),
      mkEx(6,3,"15","75s","Léger","SUPERSET B2 → repos 75s"),
      mkEx(61,2,"12","60s","","Relevé de Jambes — allure calme"),
    ]},
    {label:"Séance C — Jambes · Récupération",exercises:[
      mkEx(23,3,"10/jambe","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(16,3,"15","90s","Léger","SUPERSET A2 → repos 90s. Charges réduites."),
      mkEx(14,3,"15","—","Léger","SUPERSET B1 → enchaîner. Squat Gobelet léger, focus qualité."),
      mkEx(9,3,"12/jambe","75s","Léger","SUPERSET B2 → repos 75s"),
      mkEx(63,2,"25s","—","","Mountain Climbers — allure modérée"),
      mkEx(66,2,"25s/côté","45s","","Planche Latérale — deload actif"),
    ]},
  ]},
]};
SEED_PROGRAMS.push(MAISON_CYCLE2);

// ─── HYPERTROPHIE CONFIRMÉ 6 SEMAINES ────────────────────────────────────────
const HYPERTRO_CONFIRME = {id:"hypertro_confirme_6s",_v:2,name:"Hypertrophie Confirmé 6 sem.",category:"Hypertrophie",level:"Confirmé",weeks:[
  // S1
  {label:"S1 — Accumulation · Mise en route",days:[
    {label:"Séance A — Upper Push + Tractions (pronation large)",exercises:[
      mkPct(2,4,"12","2min",70,"1rm_bench","Amplitude complète, coudes à 45°, descente 3s"),
      mkEx(3,4,"Max","2min","","Prise pronation large — amplitude complète, descente lente 2s"),
      mkEx(26,4,"12","—","Moyen","SUPERSET A1 → enchaîner. Inclinaison 30°, faisceau supérieur."),
      mkEx(10,4,"12","90s","Moyen","SUPERSET A2 → repos 90s. Dos parallèle, coudes hauts."),
      mkEx(28,3,"Max","90s","","Dips Pectoraux — penché en avant, coudes écartés"),
      mkEx(55,3,"12","—","","SUPERSET B1 → enchaîner. Descendre vers le front, coudes fixes."),
      mkEx(37,3,"15","75s","","SUPERSET B2 — Face Pull → repos 75s. Coudes hauts, tirer vers le visage."),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,4,"12","3min",70,"1rm_squat","Profondeur complète, tempo 3-0-1, genoux alignés"),
      mkEx(11,4,"12","2min","Moyen","Leg Press — pieds largeur épaules, amplitude complète"),
      mkEx(13,4,"12","—","Moyen","SUPERSET A1 → enchaîner. Hanches plaquées sur le banc."),
      mkEx(15,4,"12","90s","Moyen","SUPERSET A2 → repos 90s. Descente jusqu'à tension ischio."),
      mkEx(12,3,"15","—","","SUPERSET B1 → enchaîner. Extension complète, descente contrôlée."),
      mkEx(19,4,"15","60s","","SUPERSET B2 → repos 60s. Amplitude maximale, pause en haut."),
      mkEx(62,3,"Max","60s","","Ab Wheel — creuser le ventre, ne pas cambrer"),
    ]},
    {label:"Séance C — Upper Pull + Chin-ups (supination)",exercises:[
      mkEx(3,4,"Max","2min","","Prise supination (chin-ups) — mains face à toi, biceps actifs. Amplitude complète."),
      mkEx(5,4,"12","90s","65% RM","Développé Militaire — core serré, regard droit"),
      mkEx(32,4,"12","—","Moyen","SUPERSET A1 → enchaîner. Omoplates rétractées, coudes vers le bas."),
      mkEx(33,4,"12/côté","90s","","SUPERSET A2 → repos 90s. Dos plat, tirer vers la hanche."),
      mkEx(52,3,"12","—","","SUPERSET B1 — Curl EZ → enchaîner. Coudes fixes."),
      mkEx(59,3,"15","75s","","SUPERSET B2 — Corde Poulie → repos 75s. Écarter la corde en bas."),
      mkEx(48,3,"12","60s","","Curl Incliné — bras perpendiculaires au sol, longue portion"),
    ]},
    {label:"Séance D — Lower B · Charnière & Fessiers",exercises:[
      mkPct(4,4,"8","3min",70,"1rm_sdt","Dos plat, barre proche du corps, poussée du sol"),
      mkEx(16,4,"12","90s","Moyen","Hip Thrust — extension complète des hanches, pause en haut"),
      mkEx(23,3,"10/jambe","—","","SUPERSET A1 → enchaîner. Pied arrière surélevé, buste droit."),
      mkEx(13,3,"12","90s","","SUPERSET A2 → repos 90s"),
      mkEx(9,3,"12/jambe","—","Moyen","SUPERSET B1 → enchaîner. Genou arrière proche du sol."),
      mkEx(19,3,"15","60s","","SUPERSET B2 → repos 60s"),
      mkEx(8,3,"40s","45s","","Gainage Planche — bassin neutre, respiration continue"),
    ]},
    {label:"Séance E — Upper Volume + Traction lestée/neutre",exercises:[
      mkEx(3,4,"8","2min","Lest","Lestée (ceinture) ou prise neutre — ajouter charge si >10 reps propres"),
      mkEx(41,3,"12","—","Moyen","SUPERSET A1 — Arnold → enchaîner. Rotation poignets."),
      mkEx(40,3,"15","75s","Léger","SUPERSET A2 → repos 75s. Montée lente, légère flexion coudes."),
      mkEx(42,3,"15","—","","SUPERSET B1 → enchaîner. Buste penché, étirement arrière."),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
      mkEx(47,3,"12","—","Moyen","SUPERSET C1 — Curl Barre → enchaîner. Coudes fixes."),
      mkEx(56,3,"15","60s","","SUPERSET C2 — Extension Triceps → repos 60s"),
      mkEx(29,3,"15","60s","","Pec Deck — finisher, contraction maximale"),
    ]},
  ]},
  // S2
  {label:"S2 — Accumulation · Progression charges",days:[
    {label:"Séance A — Upper Push + Tractions (pronation large)",exercises:[
      mkPct(2,4,"10","2min",73,"1rm_bench","Charge progressive vs S1, même technique"),
      mkEx(3,4,"Max","2min","","Prise pronation large — objectif +1 rep vs S1"),
      mkEx(26,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(10,4,"10","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(28,4,"Max","90s","","Dips — +1 série vs S1"),
      mkEx(55,4,"10","—","","SUPERSET B1 → enchaîner"),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,4,"10","3min",73,"1rm_squat","Charge progressive vs S1"),
      mkEx(11,4,"10","2min","Lourd","Leg Press — progression charges"),
      mkEx(13,4,"12","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(15,4,"10","90s","Moyen-Lourd","SUPERSET A2 → repos 90s. Focus excentrique."),
      mkEx(12,3,"15","—","","SUPERSET B1 → enchaîner"),
      mkEx(19,4,"15","60s","","SUPERSET B2 → repos 60s"),
      mkEx(62,3,"Max","60s","","Ab Wheel"),
    ]},
    {label:"Séance C — Upper Pull + Chin-ups (supination)",exercises:[
      mkEx(3,4,"Max","2min","","Chin-ups — objectif +1 rep vs S1"),
      mkEx(5,4,"10","90s","70% RM","Développé Militaire — charge progressive"),
      mkEx(32,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(33,4,"10/côté","90s","Moyen","SUPERSET A2 → repos 90s"),
      mkEx(52,4,"10","—","","SUPERSET B1 → enchaîner"),
      mkEx(59,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(48,3,"10","60s","","Curl Incliné — charge progressive"),
    ]},
    {label:"Séance D — Lower B · Charnière & Fessiers",exercises:[
      mkPct(4,4,"6","3min",73,"1rm_sdt","Charge progressive vs S1"),
      mkEx(16,4,"10","90s","Lourd","Hip Thrust — charge progressive"),
      mkEx(23,4,"10/jambe","—","Moyen","SUPERSET A1 → enchaîner"),
      mkEx(13,4,"12","90s","","SUPERSET A2 → repos 90s"),
      mkEx(9,4,"12/jambe","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(19,3,"15","60s","","SUPERSET B2 → repos 60s"),
      mkEx(8,3,"45s","45s","","Gainage — +5s vs S1"),
    ]},
    {label:"Séance E — Upper Volume + Traction lestée/neutre",exercises:[
      mkEx(3,4,"8","2min","Lest","Lestée — charge progressive vs S1"),
      mkEx(41,4,"10","—","Moyen","SUPERSET A1 → enchaîner"),
      mkEx(40,4,"12","75s","Léger","SUPERSET A2 → repos 75s"),
      mkEx(42,4,"12","—","","SUPERSET B1 → enchaîner"),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
      mkEx(47,4,"10","—","Moyen","SUPERSET C1 → enchaîner"),
      mkEx(56,4,"12","60s","","SUPERSET C2 → repos 60s"),
      mkEx(29,3,"15","60s","","Pec Deck — finisher"),
    ]},
  ]},
  // S3
  {label:"S3 — Intensification · Charges lourdes",days:[
    {label:"Séance A — Upper Push + Tractions (pronation large)",exercises:[
      mkPct(2,4,"8","2min",77,"1rm_bench","Montée de charge, phase excentrique 3s"),
      mkEx(3,5,"Max","2min","","Prise pronation large — +1 série. Lest si >10 reps propres."),
      mkEx(26,4,"8","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(10,4,"8","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(28,4,"Max","90s","Lest","Dips — ajouter lest si plus de 12 reps propres"),
      mkEx(58,4,"8","—","Moyen-Lourd","SUPERSET B1 — Close Grip → enchaîner. Prise serrée, coudes le long du corps."),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,5,"6","3min",80,"1rm_squat","Pic de charge — +1 série. Sortie explosive."),
      mkEx(11,4,"8","2min","Lourd","Leg Press — charges lourdes"),
      mkEx(13,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(15,4,"8","90s","75% RM","SUPERSET A2 → repos 90s. Descente 4s."),
      mkEx(12,4,"12","—","Lourd","SUPERSET B1 → enchaîner. Drop set sur la dernière série."),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(62,3,"Max","60s","","Ab Wheel"),
    ]},
    {label:"Séance C — Upper Pull + Chin-ups (supination)",exercises:[
      mkEx(3,5,"Max","2min","","Chin-ups — +1 série. Lest si >10 reps."),
      mkEx(5,4,"8","90s","75% RM","Développé Militaire — charge lourde"),
      mkEx(32,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(33,4,"8/côté","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(47,4,"10","—","Lourd","SUPERSET B1 — Curl Barre → enchaîner. Coudes fixes."),
      mkEx(59,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(48,3,"10","60s","","Curl Incliné — charge progressive"),
    ]},
    {label:"Séance D — Lower B · Charnière & Fessiers",exercises:[
      mkPct(4,4,"5","3min",77,"1rm_sdt","Charge lourde — rigueur technique absolue"),
      mkEx(16,4,"10","90s","Lourd","Hip Thrust — charge lourde, pause 1s en haut"),
      mkEx(23,4,"8/jambe","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(13,4,"10","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(9,4,"10/jambe","—","Moyen-Lourd","SUPERSET B1 → enchaîner"),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(8,3,"50s","45s","","Gainage — +5s vs S2"),
    ]},
    {label:"Séance E — Upper Volume + Traction lestée/neutre",exercises:[
      mkEx(3,4,"6","2min","Lest lourd","Lestée — charge max, priorité technique"),
      mkEx(41,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(40,4,"12","75s","Moyen","SUPERSET A2 → repos 75s"),
      mkEx(44,3,"12","—","Moyen","SUPERSET B1 — Élévations Frontales → enchaîner"),
      mkEx(42,3,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(47,4,"8","—","Lourd","SUPERSET C1 → enchaîner"),
      mkEx(55,4,"10","75s","Moyen","SUPERSET C2 — Skull Crusher → repos 75s"),
      mkEx(31,3,"15","60s","","Cable Crossover — finisher"),
    ]},
  ]},
  // S4
  {label:"S4 — Intensification · Volume lourd",days:[
    {label:"Séance A — Upper Push + Tractions (pronation large)",exercises:[
      mkPct(2,5,"6","2min",80,"1rm_bench","Pic de volume — 5 séries, excentrique 3s"),
      mkEx(3,5,"Max","2min","Lest","Prise pronation lestée — max reps propres"),
      mkEx(24,4,"8","—","Lourd","SUPERSET A1 — Haltères → enchaîner. Rotation poignets en haut."),
      mkEx(10,4,"8","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(28,4,"Max","90s","Lest","Dips lestés — aller à l'échec"),
      mkEx(58,4,"6","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(37,4,"15","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,5,"5","3min",82,"1rm_squat","Pic de charge — 5 séries"),
      mkEx(11,5,"8","2min","Très lourd","Leg Press — pic de volume"),
      mkEx(13,4,"10","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(15,4,"6","90s","77% RM","SUPERSET A2 → repos 90s. Excentrique 4s."),
      mkEx(12,4,"10","—","Lourd","SUPERSET B1 — Drop set sur la dernière série → enchaîner"),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(62,4,"Max","60s","","Ab Wheel — +1 série"),
    ]},
    {label:"Séance C — Upper Pull + Chin-ups (supination)",exercises:[
      mkEx(3,5,"Max","2min","Lest","Chin-ups lestés — max reps, pic de volume"),
      mkEx(5,4,"6","90s","80% RM","Développé Militaire — pic de charge"),
      mkEx(32,4,"8","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(33,4,"8/côté","90s","Lourd","SUPERSET A2 → repos 90s"),
      mkEx(47,4,"8","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(59,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(51,3,"12","60s","","Curl Concentration — isolation maximale"),
    ]},
    {label:"Séance D — Lower B · Charnière & Fessiers",exercises:[
      mkPct(4,5,"4","3min",82,"1rm_sdt","Pic de charge — 5 séries"),
      mkEx(16,5,"8","90s","Très lourd","Hip Thrust — pic de volume"),
      mkEx(23,4,"8/jambe","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(13,4,"10","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(9,4,"10/jambe","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(8,3,"55s","45s","","Gainage — +5s vs S3"),
    ]},
    {label:"Séance E — Upper Volume + Traction lestée/neutre",exercises:[
      mkEx(3,5,"6","2min","Lest max","Lestée — +1 série vs S3, charge maximale"),
      mkEx(41,4,"8","—","Lourd","SUPERSET A1 → enchaîner"),
      mkEx(40,4,"12","75s","Moyen","SUPERSET A2 → repos 75s"),
      mkEx(44,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(42,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(47,4,"8","—","Lourd","SUPERSET C1 → enchaîner"),
      mkEx(55,4,"8","75s","Lourd","SUPERSET C2 → repos 75s"),
      mkEx(29,3,"15","45s","","Pec Deck — finisher"),
    ]},
  ]},
  // S5
  {label:"S5 — Pic · Intensité maximale",days:[
    {label:"Séance A — Upper Push + Tractions (pronation large)",exercises:[
      mkPct(2,4,"5","3min",85,"1rm_bench","Très lourd — sécurité parades obligatoires. Excentrique 3s."),
      mkEx(3,4,"Max","2min","Lest lourd","Prise pronation lestée — pic de charge"),
      mkEx(24,4,"6","—","Très lourd","SUPERSET A1 → enchaîner. Drop set sur la 4e série."),
      mkEx(10,4,"6","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(28,3,"Max","2min","Lest max","Dips lestés — dernière série à l'échec"),
      mkEx(58,4,"5","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,5,"4","4min",85,"1rm_squat","Charge maximale. Sécurité parades. Sortie explosive."),
      mkEx(11,5,"6","2min","Très lourd","Leg Press — drop set sur la 5e série"),
      mkEx(13,4,"8","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(15,4,"5","90s","80% RM","SUPERSET A2 → repos 90s. Excentrique max 4s."),
      mkEx(12,4,"10","—","Lourd","SUPERSET B1 — Drop set obligatoire → enchaîner"),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(62,3,"Max","60s","","Ab Wheel — pic"),
    ]},
    {label:"Séance C — Upper Pull + Chin-ups (supination)",exercises:[
      mkEx(3,5,"Max","2min","Lest max","Chin-ups lestés — charge maximale, chaque série à l'échec"),
      mkEx(5,4,"5","2min","85% RM","Développé Militaire — charge maximale"),
      mkEx(32,4,"8","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(33,4,"6/côté","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(52,4,"6","—","Lourd","SUPERSET B1 — Curl EZ → enchaîner"),
      mkEx(50,4,"12","75s","","SUPERSET B2 — Curl Poulie Basse → repos 75s. Drop set sur la dernière."),
      mkEx(51,3,"12","60s","","Curl Concentration — finisher, isolation maximale"),
    ]},
    {label:"Séance D — Lower B · Charnière & Fessiers",exercises:[
      mkPct(4,5,"4","4min",85,"1rm_sdt","Charge maximale. Échauffement prolongé obligatoire."),
      mkEx(16,5,"8","90s","Très lourd","Hip Thrust — charge max, pause 1s en haut"),
      mkEx(23,4,"6/jambe","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(13,4,"8","90s","Très lourd","SUPERSET A2 → repos 90s"),
      mkEx(9,3,"10/jambe","—","Lourd","SUPERSET B1 → enchaîner"),
      mkEx(19,4,"20","60s","","SUPERSET B2 → repos 60s"),
      mkEx(8,3,"60s","45s","","Gainage — pic"),
    ]},
    {label:"Séance E — Upper Volume + Traction lestée/neutre",exercises:[
      mkEx(3,5,"Max","2min","Lest max","Lestée — charge maximale, 5 séries à l'échec"),
      mkEx(41,4,"8","—","Très lourd","SUPERSET A1 → enchaîner"),
      mkEx(40,4,"12","75s","Moyen","SUPERSET A2 → repos 75s. Drop set sur dernière."),
      mkEx(44,4,"12","—","Moyen","SUPERSET B1 → enchaîner"),
      mkEx(42,4,"12","75s","","SUPERSET B2 → repos 75s"),
      mkEx(47,4,"8","—","Lourd","SUPERSET C1 → enchaîner"),
      mkEx(55,4,"8","75s","Lourd","SUPERSET C2 → repos 75s. Drop set sur la 4e série."),
      mkEx(29,3,"15","45s","","Pec Deck — finisher"),
    ]},
  ]},
  // S6
  {label:"S6 — Deload · Récupération & consolidation",days:[
    {label:"Séance A — Upper Push + Tractions",exercises:[
      mkPct(2,3,"10","90s",60,"1rm_bench","Deload — technique parfaite, charges réduites"),
      mkEx(3,3,"Max","2min","","Tractions pronation — sans lest, volume réduit"),
      mkEx(26,3,"12","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(10,3,"12","90s","Léger","SUPERSET A2 → repos 90s"),
      mkEx(56,3,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(37,3,"15","75s","","SUPERSET B2 → repos 75s"),
    ]},
    {label:"Séance B — Lower A · Quadriceps",exercises:[
      mkPct(1,3,"10","2min",60,"1rm_squat","Deload — profondeur et technique"),
      mkEx(11,3,"12","90s","Léger","Leg Press — volume réduit"),
      mkEx(13,3,"12","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(15,3,"12","90s","Léger","SUPERSET A2 → repos 90s"),
      mkEx(12,3,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(19,3,"15","60s","","SUPERSET B2 → repos 60s"),
    ]},
    {label:"Séance C — Upper Pull + Tractions",exercises:[
      mkEx(3,3,"Max","2min","","Chin-ups sans lest — récupération active"),
      mkEx(5,3,"12","90s","Léger","Développé Militaire — léger"),
      mkEx(32,3,"12","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(33,3,"12/côté","90s","Léger","SUPERSET A2 → repos 90s"),
      mkEx(6,3,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(7,3,"15","60s","","SUPERSET B2 → repos 60s"),
    ]},
    {label:"Séance D — Lower B · Charnière",exercises:[
      mkPct(4,3,"6","2min",60,"1rm_sdt","Deload — léger, focus mobilité"),
      mkEx(16,3,"12","90s","Léger","Hip Thrust — volume réduit"),
      mkEx(23,3,"10/jambe","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(9,3,"12/jambe","75s","Léger","SUPERSET A2 → repos 75s"),
      mkEx(19,3,"15","60s","","Mollets — récupération active"),
      mkEx(8,2,"40s","45s","","Gainage — deload"),
    ]},
    {label:"Séance E — Upper Volume · Récupération",exercises:[
      mkEx(3,3,"Max","2min","Léger","Tractions sans lest — récupération active"),
      mkEx(41,3,"12","—","Léger","SUPERSET A1 → enchaîner"),
      mkEx(40,3,"15","75s","Léger","SUPERSET A2 → repos 75s"),
      mkEx(49,3,"15","—","Léger","SUPERSET B1 → enchaîner"),
      mkEx(7,3,"15","60s","","SUPERSET B2 → repos 60s"),
      mkEx(29,2,"15","60s","","Pec Deck — récupération"),
    ]},
  ]},
]};
SEED_PROGRAMS.push(HYPERTRO_CONFIRME);

// ─── DÉBUTANT FULL BODY 3j/sem ───────────────────────────────────────────────
const DEBUTANT_FB = {id:"debutant_fullbody_3j",name:"Débutant Full Body 3j/sem",category:"Débutant",level:"Débutant",weeks:[
  // S1
  {label:"S1 — Découverte · Apprentissage des mouvements",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,3,"15","2min","Léger","Squat Barre — dos droit, descente lente. Commence très léger pour apprendre le mouvement."),
      mkEx(2,3,"12","90s","Léger","Développé Couché — coudes à 45°, amplitude complète. Charge légère, focus technique."),
      mkEx(3,3,"Max","2min","","Tractions — si impossible : sauter en haut puis descente lente 3s (négatives). Viser minimum 3 reps."),
      mkEx(15,3,"12","90s","Léger","RDL Haltères — dos plat, charnière de hanche. Descendre jusqu'à la tension dans les ischio."),
      mkEx(6,3,"15","60s","Léger","Curl Haltères — coudes fixes, supination en haut"),
      mkEx(56,3,"15","60s","Léger","Extension Triceps Haltère — coudes serrés, extension complète"),
      mkEx(8,3,"30s","45s","","Gainage Planche — bassin neutre, respiration continue"),
      mkEx(119,1,"15 min","—","RPE 4-5/10","Footing léger fin de séance — allure conversationnelle"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,3,"15","2min","Léger","Leg Press — pieds largeur épaules, amplitude complète. Apprendre le mouvement."),
      mkEx(32,3,"12","90s","Léger","Tirage Vertical Poulie — omoplates rétractées, coudes vers le bas"),
      mkEx(29,3,"15","90s","Léger","Pec Deck / Butterfly — contraction maximale en centre. Charge légère."),
      mkEx(34,3,"12","75s","Léger","Tirage Horizontal Poulie — serrer les omoplates en fin de mouvement"),
      mkEx(13,3,"15","75s","Léger","Leg Curl Allongé — hanches plaquées, descente contrôlée"),
      mkEx(7,3,"15","60s","Léger","Triceps Poulie — coudes fixes, extension complète"),
      mkEx(50,3,"15","60s","Léger","Curl Poulie Basse — coude fixe, tension constante"),
      mkEx(8,3,"30s","45s","","Gainage Planche — bassin neutre"),
      mkEx(119,1,"15 min","—","RPE 4-5/10","Footing léger fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,3,"10","30s","","Superman/Arch — soulever bras et jambes, tenir 2s en haut. Rebaisser lentement."),
      mkEx(126,3,"20s","30s","","Hollow Hold — bas du dos au sol, jambes à 45°. Variante : genoux fléchis si trop difficile."),
      mkEx(8,3,"30s","30s","","Gainage Planche — enchaîner dans le circuit"),
      mkEx(66,3,"20s/côté","30s","","Planche Latérale — hanches alignées"),
      mkEx(63,3,"20s","30s","","Mountain Climbers — hanches basses, rythme régulier"),
      mkEx(122,2,"5","60s","","Burpees — rythme débutant, qualité du mouvement. Pas de rush."),
      mkEx(119,1,"20 min","—","RPE 5/10","Footing — allure conversationnelle. Tu dois pouvoir parler normalement."),
    ]},
  ]},
  // S2
  {label:"S2 — Construction · Légère progression des charges",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,3,"12","2min","Léger","Squat Barre — même technique que S1, légère hausse de charge"),
      mkEx(2,3,"10","90s","Léger","Développé Couché — légère progression"),
      mkEx(3,3,"Max","2min","","Tractions — objectif +1 rep vs S1. Négatifs si besoin."),
      mkEx(15,3,"12","90s","Léger","RDL — légère progression"),
      mkEx(6,3,"12","60s","Léger","Curl Haltères"),
      mkEx(56,3,"12","60s","Léger","Extension Triceps"),
      mkEx(8,3,"35s","45s","","Gainage — +5s vs S1"),
      mkEx(119,1,"15 min","—","RPE 5/10","Footing fin de séance"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,3,"12","2min","Léger","Leg Press — légère hausse de charge"),
      mkEx(32,3,"12","90s","Léger","Tirage Vertical Poulie — légère progression"),
      mkEx(29,3,"12","90s","Léger","Pec Deck — légère progression"),
      mkEx(34,3,"12","75s","Léger","Tirage Horizontal Poulie"),
      mkEx(13,3,"12","75s","Léger","Leg Curl"),
      mkEx(7,3,"12","60s","Léger","Triceps Poulie"),
      mkEx(50,3,"12","60s","Léger","Curl Poulie Basse"),
      mkEx(8,3,"35s","45s","","Gainage — +5s vs S1"),
      mkEx(119,1,"15 min","—","RPE 5/10","Footing fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,3,"12","30s","","Superman — +2 reps vs S1"),
      mkEx(126,3,"25s","30s","","Hollow Hold — +5s vs S1"),
      mkEx(8,3,"35s","30s","","Gainage — +5s"),
      mkEx(66,3,"25s/côté","30s","","Planche Latérale — +5s"),
      mkEx(63,3,"25s","30s","","Mountain Climbers — +5s"),
      mkEx(122,2,"7","60s","","Burpees — +2 reps vs S1"),
      mkEx(119,1,"20 min","—","RPE 5/10","Footing — même allure, continue la régularité"),
    ]},
  ]},
  // S3
  {label:"S3 — Progression · Charges modérées",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,3,"10","2min","Moyen","Squat Barre — nouvelle hausse de charge, maintenir la profondeur"),
      mkEx(2,3,"10","90s","Moyen","Développé Couché — progression continue"),
      mkEx(3,3,"Max","2min","","Tractions — objectif +1 rep vs S2"),
      mkEx(15,3,"10","90s","Moyen","RDL — descente contrôlée, tension ischio"),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères"),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps"),
      mkEx(8,4,"35s","45s","","Gainage — +1 série"),
      mkEx(119,1,"15 min","—","RPE 5-6/10","Footing fin de séance — légère accélération possible"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,3,"10","2min","Moyen","Leg Press — charge progressive"),
      mkEx(32,3,"10","90s","Moyen","Tirage Vertical Poulie"),
      mkEx(29,3,"12","90s","Moyen","Pec Deck — progression"),
      mkEx(34,3,"10","75s","Moyen","Tirage Horizontal Poulie"),
      mkEx(13,3,"12","75s","Moyen","Leg Curl"),
      mkEx(7,3,"12","60s","Moyen","Triceps Poulie"),
      mkEx(50,3,"12","60s","Moyen","Curl Poulie Basse"),
      mkEx(8,4,"35s","45s","","Gainage — +1 série"),
      mkEx(119,1,"15 min","—","RPE 5-6/10","Footing fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,3,"15","30s","","Superman — +3 reps vs S2"),
      mkEx(126,3,"30s","30s","","Hollow Hold — 30s. Si maîtrisé : jambes plus basses."),
      mkEx(8,3,"40s","30s","","Gainage — +5s"),
      mkEx(66,3,"30s/côté","30s","","Planche Latérale — +5s"),
      mkEx(63,3,"30s","30s","","Mountain Climbers — +5s"),
      mkEx(122,3,"8","60s","","Burpees — +1 série, +1 rep"),
      mkEx(119,1,"25 min","—","RPE 5-6/10","Footing — 25 min. Légère progression vs S2."),
    ]},
  ]},
  // S4
  {label:"S4 — Consolidation · Ancrage de la technique",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,4,"10","2min","Moyen","Squat Barre — +1 série. Charge identique ou légère hausse."),
      mkEx(2,4,"10","90s","Moyen","Développé Couché — +1 série"),
      mkEx(3,4,"Max","2min","","Tractions — +1 série. Viser 3+ reps propres."),
      mkEx(15,4,"10","90s","Moyen","RDL — +1 série"),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères"),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps"),
      mkEx(8,4,"40s","45s","","Gainage — +5s vs S3"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance — légèrement plus soutenu"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,4,"10","2min","Moyen","Leg Press — +1 série"),
      mkEx(32,4,"10","90s","Moyen","Tirage Vertical Poulie — +1 série"),
      mkEx(29,4,"12","90s","Moyen","Pec Deck — +1 série"),
      mkEx(34,4,"10","75s","Moyen","Tirage Horizontal Poulie — +1 série"),
      mkEx(13,3,"12","75s","Moyen","Leg Curl"),
      mkEx(7,3,"12","60s","Moyen","Triceps Poulie"),
      mkEx(50,3,"12","60s","Moyen","Curl Poulie Basse"),
      mkEx(8,4,"40s","45s","","Gainage — +5s"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,4,"15","30s","","Superman — +1 série"),
      mkEx(126,4,"30s","30s","","Hollow Hold — +1 série. Jambes plus basses si maîtrisé."),
      mkEx(8,4,"40s","30s","","Gainage — +1 série"),
      mkEx(66,4,"30s/côté","30s","","Planche Latérale — +1 série"),
      mkEx(63,3,"30s","30s","","Mountain Climbers"),
      mkEx(122,3,"10","60s","","Burpees — +2 reps"),
      mkEx(119,1,"25 min","—","RPE 6/10","Footing — 25 min, légère accélération"),
    ]},
  ]},
  // S5
  {label:"S5 — Intensification douce · Légère surcharge",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,4,"8","2min","Moyen","Squat Barre — légère hausse de charge vs S4, 8 reps contrôlés"),
      mkEx(2,4,"8","90s","Moyen","Développé Couché — charge progressive"),
      mkEx(3,4,"Max","2min","","Tractions — max reps par série. Lest si >8 reps propres."),
      mkEx(15,4,"8","90s","Moyen","RDL — charge progressive, focus excentrique"),
      mkEx(6,4,"10","60s","Moyen","Curl Haltères — +1 série"),
      mkEx(56,4,"10","60s","Moyen","Extension Triceps — +1 série"),
      mkEx(8,4,"45s","45s","","Gainage — +5s"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,4,"8","2min","Moyen","Leg Press — charge progressive"),
      mkEx(32,4,"8","90s","Moyen","Tirage Vertical Poulie — légère hausse de charge"),
      mkEx(29,4,"10","90s","Moyen","Pec Deck — progression"),
      mkEx(34,4,"10","75s","Moyen","Tirage Horizontal Poulie"),
      mkEx(13,4,"10","75s","Moyen","Leg Curl — +1 série"),
      mkEx(7,4,"12","60s","Moyen","Triceps Poulie — +1 série"),
      mkEx(50,4,"12","60s","Moyen","Curl Poulie Basse — +1 série"),
      mkEx(8,4,"45s","45s","","Gainage — +5s"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,4,"15","30s","","Superman — +1 série vs S4"),
      mkEx(126,4,"35s","30s","","Hollow Hold — +5s"),
      mkEx(8,4,"45s","30s","","Gainage — +5s"),
      mkEx(66,4,"35s/côté","30s","","Planche Latérale — +5s"),
      mkEx(63,4,"35s","30s","","Mountain Climbers — rythme plus soutenu"),
      mkEx(122,3,"12","60s","","Burpees — +2 reps"),
      mkEx(119,1,"30 min","—","RPE 6/10","Footing — 30 min. Belle progression !"),
    ]},
  ]},
  // S6
  {label:"S6 — Bilan · Consolidation finale",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,4,"10","2min","Moyen","Squat Barre — compare ta charge avec S1 : belle progression !"),
      mkEx(2,4,"10","90s","Moyen","Développé Couché — bilan progression"),
      mkEx(3,4,"Max","2min","","Tractions — compte tes reps et compare avec S1 !"),
      mkEx(15,4,"10","90s","Moyen","RDL — consolidation"),
      mkEx(6,4,"12","60s","Moyen","Curl Haltères"),
      mkEx(56,4,"12","60s","Moyen","Extension Triceps"),
      mkEx(8,4,"45s","45s","","Gainage — niveau S5 maintenu"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance"),
    ]},
    {label:"Séance B — Full Body Salle (machines & poulies)",exercises:[
      mkEx(11,4,"10","2min","Moyen","Leg Press — compare ta charge vs S1 !"),
      mkEx(32,4,"10","90s","Moyen","Tirage Vertical — bilan"),
      mkEx(29,4,"12","90s","Moyen","Pec Deck — consolidation"),
      mkEx(34,4,"10","75s","Moyen","Tirage Horizontal — bilan"),
      mkEx(13,4,"12","75s","Moyen","Leg Curl"),
      mkEx(7,4,"12","60s","Moyen","Triceps Poulie"),
      mkEx(50,4,"12","60s","Moyen","Curl Poulie Basse"),
      mkEx(8,4,"45s","45s","","Gainage — niveau maintenu"),
      mkEx(119,1,"15 min","—","RPE 6/10","Footing fin de séance"),
    ]},
    {label:"Séance C — Cardio & Gainage CrossFit",exercises:[
      mkEx(125,4,"15","30s","","Superman — niveau maintenu"),
      mkEx(126,4,"35s","30s","","Hollow Hold — bilan"),
      mkEx(8,4,"45s","30s","","Gainage — bilan"),
      mkEx(66,4,"35s/côté","30s","","Planche Latérale — bilan"),
      mkEx(63,4,"35s","30s","","Mountain Climbers"),
      mkEx(122,3,"12","60s","","Burpees — bilan"),
      mkEx(119,1,"30 min","—","RPE 6/10","Footing — 30 min. 6 semaines complètes, excellent travail !"),
    ]},
  ]},
]};
SEED_PROGRAMS.push(DEBUTANT_FB);

// ─── BASES SOLIDES — 8 SEMAINES ──────────────────────────────────────────────
// Tempo (polyarticulaires uniquement): E-PB-C-PH
// ex: 3-2-1-0 = 3s descente → 2s pause bas → 1s montée → 0s pause haut
const BASES_SOLIDES = {id:"bases_solides_8s",_v:2,name:"Bases Solides — 8 sem.",category:"Powerbuilding",level:"Intermédiaire",weeks:[
  // ── S1 ────────────────────────────────────────────────────────────────────
  {label:"S1 — Activation Technique · Tempo 3-2-1-0 · 55-60%",days:[
    {label:"Séance A — Squat · Position & Tension",exercises:[
      mkEx(1,4,"5","3min","55% 1RM","⏱ TEMPO 3-2-1-0 — 3s descente → PAUSE 2s en bas (cuisse ≥ parallèle) → sortie explosive → 0s en haut. Charge très légère. Focus : tension abdominale, neutralité vertébrale, genoux alignés sur les pointes de pieds."),
      mkEx(118,3,"5","2min","45% 1RM","⏱ TEMPO 3-1-1-0 — Front Squat. Coudes à l'horizontale, barre sur les deltoïdes antérieurs. Force à garder le tronc vertical. Travail de mobilité cheville/hanche."),
      mkEx(15,3,"8","90s","52% 1RM SDT","Romanian Deadlift — Dos plat, hanches reculées, descente jusqu'à l'étirement maximal des ischio-jambiers. Accessoire clé pour renforcer la charnière de hanche."),
      mkEx(16,3,"12","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. PAUSE 1s en haut, fessiers contractés. Stabilité pelvienne pour le squat lourd."),
      mkEx(109,3,"8","45s","Léger","Bird Dog Lestés — 2s pause en extension complète. Dos plat, genoux à 5 cm du sol. Stabilité lombaire."),
      mkEx(108,3,"12","45s","Léger","Pallof Press Câble — Résistance à la rotation, 2s pause bras tendus. Core anti-rotation."),
    ]},
    {label:"Séance B — Bench · Pause Poitrine & Dos",exercises:[
      mkEx(2,4,"5","3min","55% 1RM","⏱ TEMPO 3-2-1-0 — 3s descente → PAUSE 2s sur la poitrine (sans rebond) → poussée explosive. Charge légère. Renforce la position de départ et l'explosivité en bas du mouvement."),
      mkEx(10,4,"6","2min","55% 1RM","Rowing Barre — Dos parallèle au sol, coudes hauts, omoplates serrées en haut. Soutien dorsal essentiel pour le bench."),
      mkEx(5,3,"8","90s","50% 1RM","Développé Militaire — Gainage total, pas de cambrure lombaire, amplitude complète. Force des épaules et triceps."),
      mkEx(3,3,"Max","2min","","⏱ TEMPO 3-0-1-0 — Tractions Prise Large. Montée explosive, 3s descente contrôlée. Si > 8 reps propres : lestées."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — Coudes fixes, amplitude complète. Accessoire biceps."),
      mkEx(40,3,"15","60s","Léger","Élévations Latérales — Pas d'élan, montée contrôlée, brève pause en haut. Faisceau moyen."),
    ]},
    {label:"Séance C — Deadlift · Engagement & Charnière",exercises:[
      mkEx(4,4,"4","3min","55% 1RM","⏱ TEMPO CONTRÔLÉ — Mise en position 3s : barre sur les tibias, dos plat, grand dorsal engagé, omoplates rétractées. PAUSE 1s à hauteur du genou. Remontée explosive. Descente 2s. Focus total sur la position en bas du mouvement."),
      mkEx(15,3,"8","90s","52% 1RM SDT","⏱ TEMPO 3-2-0-0 — RDL. 3s descente, 2s étirement maximal des ischio-jambiers. Renforce la chaîne postérieure en position allongée."),
      mkEx(20,3,"10","90s","Léger","⏱ TEMPO 3-1-1-0 — Good Morning. Barre sur les trapèzes hauts, dos plat, charnière de hanche pure. Renforce les érecteurs et ischio en inclinaison avant."),
      mkEx(16,3,"12","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. PAUSE 1s en haut, fessiers contractés. Extenseur de hanche complémentaire."),
      mkEx(8,4,"45s","45s","","Gainage Planche — 45s de tension abdominale. Bassin neutre, pas de rotation."),
      mkEx(109,3,"8","45s","","Bird Dog — 2s pause en extension. Stabilisation lombaire."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"12","90s","55% 1RM","Squat Pause — Pause 2s en bas, sortie contrôlée. Volume quadriceps."),
      mkEx(2,4,"12","75s","58% 1RM","Développé Couché — Amplitude complète, sensation pectoraux. Volume hypertrophie."),
      mkEx(32,4,"12","75s","Modéré","Tirage Vertical Poulie — Étirement complet en haut, contraction en bas. Volume grand dorsal."),
      mkEx(15,3,"12","60s","Léger","RDL — Volume ischio-jambiers. Amplitude complète."),
      mkEx(13,3,"15","60s","Léger","Leg Curl — Contraction maximale en haut. Volume isolé ischio."),
      mkEx(19,3,"20","45s","Modéré","Mollets Debout — Amplitude totale, pause en bas (étirement) et en haut (contraction)."),
    ]},
  ]},
  // ── S2 ────────────────────────────────────────────────────────────────────
  {label:"S2 — Consolidation Technique · Tempo 3-2-1-0 · 60-65%",days:[
    {label:"Séance A — Squat · Position & Tension (+5%)",exercises:[
      mkEx(1,4,"5","3min","60% 1RM","⏱ TEMPO 3-2-1-0 — Identique S1, +5%. La position NE CHANGE PAS avec la charge. Si genoux en dedans ou dos arrondi : revenir à 55%."),
      mkEx(118,3,"5","2min","50% 1RM","⏱ TEMPO 3-1-1-0 — Front Squat. +5% vs S1. Progresser uniquement si S1 impeccable."),
      mkEx(15,3,"8","90s","57% 1RM SDT","Romanian Deadlift — Légère hausse. Focus étirement sans arrondir le dos."),
      mkEx(16,3,"12","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. PAUSE 1s en haut. Même charge ou légère hausse."),
      mkEx(109,3,"10","45s","Léger","Bird Dog — +2 reps vs S1, qualité identique."),
      mkEx(108,3,"12","45s","Léger","Pallof Press — Câble légèrement augmenté si S1 maîtrisé."),
    ]},
    {label:"Séance B — Bench · Pause Poitrine (+5%)",exercises:[
      mkEx(2,4,"5","3min","60% 1RM","⏱ TEMPO 3-2-1-0 — PAUSE 2s sur la poitrine, barre immobile. +5% vs S1. Si rebond ou pause disparaît : revenir à 55%."),
      mkEx(10,4,"6","2min","60% 1RM","Rowing Barre — Même technique, +5%. Dos parallèle au sol."),
      mkEx(5,3,"8","90s","55% 1RM","Développé Militaire — +5%. Gainage actif, amplitude complète."),
      mkEx(3,3,"Max","2min","","⏱ TEMPO 3-0-1-0 — Tractions. Viser +1 rep par série vs S1."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — Coudes fixes. Légère progression."),
      mkEx(40,3,"15","60s","Léger","Élévations Latérales — Pas d'élan."),
    ]},
    {label:"Séance C — Deadlift · Engagement (+5%)",exercises:[
      mkEx(4,4,"4","3min","60% 1RM","⏱ TEMPO CONTRÔLÉ — +5% vs S1. PAUSE 1s au genou maintenue. Engagement grand dorsal avant de tirer, impératif. Reset complet entre chaque rep."),
      mkEx(15,3,"8","90s","57% 1RM SDT","⏱ TEMPO 3-2-0-0 — RDL. Légère hausse. Focus étirement ischio."),
      mkEx(20,3,"10","90s","Léger","⏱ TEMPO 3-1-1-0 — Good Morning. Légère hausse si S1 impeccable."),
      mkEx(16,3,"12","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. +5%."),
      mkEx(8,4,"50s","45s","","Gainage — +5s vs S1."),
      mkEx(109,3,"10","45s","","Bird Dog — +2 reps."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"12","90s","57% 1RM","Squat Pause — Pause 2s en bas. Légère hausse vs S1."),
      mkEx(2,4,"12","75s","60% 1RM","Développé Couché — Amplitude complète. +2% vs S1."),
      mkEx(32,4,"12","75s","Modéré","Tirage Vertical Poulie — Volume grand dorsal. Légère progression."),
      mkEx(15,3,"12","60s","Léger","RDL — Volume ischio-jambiers."),
      mkEx(13,3,"15","60s","Léger","Leg Curl — Volume isolé."),
      mkEx(19,3,"20","45s","Modéré","Mollets — Amplitude totale."),
    ]},
  ]},
  // ── S3 ────────────────────────────────────────────────────────────────────
  {label:"S3 — Construction · Tempo 3-1-1-0 · 65-70%",days:[
    {label:"Séance A — Squat · Tempo Réduit + Volume",exercises:[
      mkEx(1,4,"5","3min","65% 1RM","⏱ TEMPO 3-1-1-0 — Pause réduite à 1s en bas. Intention explosive en montée maximale. La position reste identique à S1-S2, mais l'intention de pousser le sol est maximale dès la fin de la pause."),
      mkEx(118,3,"4","2min","55% 1RM","⏱ TEMPO 3-1-1-0 — Front Squat. Reps réduites, charge en hausse."),
      mkEx(15,4,"8","90s","60% 1RM SDT","Romanian Deadlift — +1 série vs S1-S2. Volume chaîne postérieure."),
      mkEx(16,3,"10","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. Reps réduites, charge augmentée."),
      mkEx(109,3,"10","45s","Modéré","Bird Dog — Lest augmenté."),
      mkEx(108,3,"12","45s","Modéré","Pallof Press — Câble plus lourd."),
    ]},
    {label:"Séance B — Bench · Pause 1s + Volume",exercises:[
      mkEx(2,4,"5","3min","65% 1RM","⏱ TEMPO 3-1-1-0 — Pause réduite à 1s sur la poitrine. La barre marque toujours un arrêt net, pas de rebond. Intention explosive maximale après la pause."),
      mkEx(10,4,"8","2min","62.5% 1RM","Rowing Barre — +2 reps vs S1-S2, légère hausse de charge."),
      mkEx(5,3,"8","90s","55% 1RM","Développé Militaire — Amplitude complète, gainage actif."),
      mkEx(3,4,"Max","2min","","⏱ TEMPO 3-0-1-0 — Tractions. +1 série vs S1-S2."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — Coudes fixes."),
      mkEx(40,3,"15","60s","Léger","Élévations Latérales — Contrôlé."),
    ]},
    {label:"Séance C — Deadlift · Construction Volume",exercises:[
      mkEx(4,4,"4","3min","65% 1RM","⏱ TEMPO CONTRÔLÉ — PAUSE 1s au genou maintenue. +10% vs S1. L'engagement du grand dorsal prend tout son sens avec la charge. Reset complet entre chaque rep."),
      mkEx(15,4,"8","90s","60% 1RM SDT","⏱ TEMPO 3-1-0-0 — RDL. +1 série. Volume ischio-jambiers."),
      mkEx(20,3,"10","90s","Modéré","⏱ TEMPO 3-1-1-0 — Good Morning. Légère hausse de charge."),
      mkEx(16,3,"10","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. Reps réduites, charge augmentée."),
      mkEx(8,4,"50s","45s","","Gainage — 50s."),
      mkEx(109,3,"10","45s","","Bird Dog — +2 reps."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"10","90s","62.5% 1RM","Squat Pause — Pause 2s. Reps réduites, charge augmentée."),
      mkEx(2,4,"10","75s","65% 1RM","Développé Couché — Reps réduites, charges en hausse. Volume pectoraux."),
      mkEx(32,4,"12","75s","Modéré","Tirage Vertical Poulie — Volume grand dorsal."),
      mkEx(15,3,"12","60s","Modéré","RDL — Volume chaîne postérieure."),
      mkEx(13,4,"12","60s","Modéré","Leg Curl — +1 série. Volume ischio."),
      mkEx(19,3,"20","45s","Modéré","Mollets — Amplitude totale."),
    ]},
  ]},
  // ── S4 ────────────────────────────────────────────────────────────────────
  {label:"S4 — Consolidation Construction · Tempo 3-1-1-0 · 67.5-72.5%",days:[
    {label:"Séance A — Squat · +1 Série",exercises:[
      mkEx(1,5,"4","3min","67.5% 1RM","⏱ TEMPO 3-1-1-0 — 5×4, pause 1s en bas. Premier vrai volume de force. Si la technique flanche à la série 5, retirer la dernière série. Qualité prime."),
      mkEx(118,3,"4","2min","57.5% 1RM","⏱ TEMPO 3-1-1-0 — Front Squat. Légère hausse."),
      mkEx(15,4,"6","90s","65% 1RM SDT","Romanian Deadlift — Reps réduites, charge augmentée."),
      mkEx(16,3,"10","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. Hausse de charge."),
      mkEx(109,3,"10","45s","Modéré","Bird Dog."),
      mkEx(108,3,"12","45s","Modéré","Pallof Press."),
    ]},
    {label:"Séance B — Bench · +1 Série",exercises:[
      mkEx(2,5,"4","3min","67.5% 1RM","⏱ TEMPO 3-1-1-0 — 5×4 avec PAUSE 1s sur la poitrine. La charge est ressentie. Intention explosive maximale après la pause. Repos complet."),
      mkEx(10,4,"8","2min","65% 1RM","Rowing Barre — Charge augmentée. Omoplates serrées en haut."),
      mkEx(5,3,"8","90s","57.5% 1RM","Développé Militaire — Amplitude complète."),
      mkEx(3,4,"Max","2min","","⏱ TEMPO 3-0-1-0 — Tractions. Maintien volume."),
      mkEx(6,3,"12","60s","Modéré","Curl Haltères."),
      mkEx(40,3,"15","60s","Léger","Élévations Latérales."),
    ]},
    {label:"Séance C — Deadlift · +1 Série",exercises:[
      mkEx(4,5,"3","3min","67.5% 1RM","⏱ TEMPO CONTRÔLÉ — 5×3, PAUSE 1s au genou. Volume de force. Chaque rep réinitialisée, concentration maximale."),
      mkEx(15,4,"6","90s","65% 1RM SDT","⏱ TEMPO 3-1-0-0 — RDL. Reps réduites, charge augmentée."),
      mkEx(20,3,"10","90s","Modéré","⏱ TEMPO 3-1-1-0 — Good Morning. Maintien."),
      mkEx(16,3,"10","75s","Modéré","⏱ TEMPO 2-1-1-0 — Hip Thrust. Hausse de charge."),
      mkEx(8,4,"55s","45s","","Gainage — +5s."),
      mkEx(109,3,"10","45s","","Bird Dog."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"10","90s","65% 1RM","Squat Pause — Pause 2s. Charge augmentée."),
      mkEx(2,4,"10","75s","67.5% 1RM","Développé Couché — Volume pectoraux, charges montantes."),
      mkEx(32,4,"10","75s","Modéré","Tirage Vertical Poulie — Reps réduites, charge augmentée."),
      mkEx(15,3,"10","60s","Modéré","RDL — Volume chaîne postérieure."),
      mkEx(13,4,"12","60s","Modéré","Leg Curl — Volume ischio."),
      mkEx(19,3,"20","45s","Modéré","Mollets."),
    ]},
  ]},
  // ── S5 ────────────────────────────────────────────────────────────────────
  {label:"S5 — Intensification · Tempo 2-1-1-0 · 72.5-77.5%",days:[
    {label:"Séance A — Squat · Charges Montantes",exercises:[
      mkEx(1,4,"4","3min","72.5% 1RM","⏱ TEMPO 2-1-1-0 — Tempo raccourci, pause 1s en bas. Les charges sont maintenant significatives. Transfert technique → force. La position reste identique à S1. Intention maximale à chaque montée."),
      mkEx(118,3,"4","2min","60% 1RM","⏱ TEMPO 2-1-1-0 — Front Squat. Hausse de charge."),
      mkEx(15,4,"6","90s","67.5% 1RM SDT","Romanian Deadlift — Charge progressive. Reps réduites."),
      mkEx(16,3,"8","75s","Lourd","⏱ TEMPO 2-1-1-0 — Hip Thrust. Charge progressive."),
      mkEx(109,3,"10","45s","Modéré","Bird Dog."),
      mkEx(108,3,"12","45s","Modéré","Pallof Press."),
    ]},
    {label:"Séance B — Bench · Charges Montantes",exercises:[
      mkEx(2,4,"4","3min","72.5% 1RM","⏱ TEMPO 2-1-1-0 — 1s pause sur la poitrine. Charges en hausse notable. Intention explosive maximale à partir du bas. Technique de S1-S4 testée sous charge réelle."),
      mkEx(10,4,"8","2min","67.5% 1RM","Rowing Barre — Charge en hausse. Contraction dorsaux."),
      mkEx(5,3,"6","90s","60% 1RM","Développé Militaire — Reps réduites, charge augmentée."),
      mkEx(3,4,"Max","2min","","⏱ TEMPO 2-0-1-0 — Tractions. Lestées si > 8 reps. Excentrique réduit."),
      mkEx(6,3,"10","60s","Modéré","Curl Haltères."),
      mkEx(40,3,"12","60s","Modéré","Élévations Latérales."),
    ]},
    {label:"Séance C — Deadlift · Charges Montantes",exercises:[
      mkEx(4,4,"3","3min","72.5% 1RM","⏱ TEMPO CONTRÔLÉ — Pause 1s au genou maintenue. Mise en position 2s. Les charges font ressentir chaque centimètre. L'engagement du grand dorsal est non-négociable. Reset complet."),
      mkEx(15,4,"6","90s","67.5% 1RM SDT","⏱ TEMPO 3-1-0-0 — RDL. Maintien excentrique long."),
      mkEx(20,3,"8","90s","Modéré","⏱ TEMPO 3-1-1-0 — Good Morning. Charge modérée."),
      mkEx(16,3,"8","75s","Lourd","⏱ TEMPO 2-1-1-0 — Hip Thrust. Charge progressive."),
      mkEx(8,4,"55s","45s","","Gainage — 55s."),
      mkEx(109,3,"10","45s","","Bird Dog."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"8","90s","67.5% 1RM","Squat Pause — Pause 2s. Charges montantes, reps réduites."),
      mkEx(2,4,"8","75s","70% 1RM","Développé Couché — Charges montantes. Volume pectoraux en intensification."),
      mkEx(32,4,"10","75s","Modéré","Tirage Vertical Poulie — Volume dos."),
      mkEx(15,3,"10","60s","Modéré","RDL — Volume ischio."),
      mkEx(13,4,"10","60s","Modéré","Leg Curl — Reps réduites, charge augmentée."),
      mkEx(19,3,"15","45s","Lourd","Mollets — Amplitude totale."),
    ]},
  ]},
  // ── S6 ────────────────────────────────────────────────────────────────────
  {label:"S6 — Intensification Haute · Tempo 2-0-1-0 · 77.5-82.5%",days:[
    {label:"Séance A — Squat · Sans Pause en Bas",exercises:[
      mkEx(1,4,"3","3min","77.5% 1RM","⏱ TEMPO 2-0-1-0 — Plus de pause en bas. Descente contrôlée 2s, inversion immédiate et explosive. Utilisation de l'élan élastique. Charge haute : technique non-négociable. C'est ici que les semaines de travail paient."),
      mkEx(118,3,"3","2min","62.5% 1RM","⏱ TEMPO 2-1-1-0 — Front Squat. Maintien pause légère pour conserver le travail de position."),
      mkEx(15,3,"6","90s","72.5% 1RM SDT","Romanian Deadlift — Charge haute, reps réduites."),
      mkEx(16,3,"8","75s","Lourd","⏱ TEMPO 2-0-1-0 — Hip Thrust. Charge haute."),
      mkEx(109,3,"10","45s","Modéré","Bird Dog."),
      mkEx(108,3,"12","45s","Modéré","Pallof Press."),
    ]},
    {label:"Séance B — Bench · Sans Pause / Charges Hautes",exercises:[
      mkEx(2,4,"3","3min","77.5% 1RM","⏱ TEMPO 2-0-1-0 — Descente 2s, toucher-repousser immédiatement de façon explosive. La barre touche toujours la poitrine, pas de rebond brutal. Intention maximale."),
      mkEx(10,4,"6","2min","70% 1RM","Rowing Barre — Charges hautes, reps réduites. Contraction dorsaux."),
      mkEx(5,3,"5","90s","65% 1RM","Développé Militaire — Charge haute. Amplitude complète."),
      mkEx(3,4,"Max","2min","","⏱ TEMPO 2-0-1-0 — Tractions Lestées. Intention maximale."),
      mkEx(6,3,"10","60s","Modéré","Curl Haltères."),
      mkEx(40,3,"12","60s","Modéré","Élévations Latérales."),
    ]},
    {label:"Séance C — Deadlift · Sans Pause au Genou",exercises:[
      mkEx(4,4,"3","3min","77.5% 1RM","⏱ TEMPO ACCÉLÉRÉ — La pause au genou disparaît. Mise en position 2s, tirage explosif immédiat. Charge haute : chaque centimètre doit être tiré en position parfaite. Descente contrôlée 2s. Reset entre chaque rep."),
      mkEx(15,3,"6","90s","72.5% 1RM SDT","⏱ TEMPO 3-1-0-0 — RDL. Maintien excentrique long."),
      mkEx(20,3,"8","90s","Modéré","⏱ TEMPO 3-1-1-0 — Good Morning. Charge modérée maintenue."),
      mkEx(16,3,"8","75s","Lourd","⏱ TEMPO 2-0-1-0 — Hip Thrust. Charge haute."),
      mkEx(8,4,"60s","45s","","Gainage — 60s."),
      mkEx(109,3,"10","45s","","Bird Dog."),
    ]},
    {label:"Séance D — Volume Hypertrophie Classique",exercises:[
      mkEx(117,4,"8","90s","70% 1RM","Squat Pause — Pause 2s. Charge haute vs S1."),
      mkEx(2,4,"8","75s","72.5% 1RM","Développé Couché — Charge haute. Volume pectoraux intensifié."),
      mkEx(32,4,"10","75s","Modéré","Tirage Vertical Poulie — Volume dos."),
      mkEx(15,3,"8","60s","Modéré","RDL — Volume chaîne postérieure."),
      mkEx(13,4,"10","60s","Modéré","Leg Curl — Volume ischio."),
      mkEx(19,3,"15","45s","Lourd","Mollets."),
    ]},
  ]},
  // ── S7 ────────────────────────────────────────────────────────────────────
  {label:"S7 — Approche Force · 80-87.5% · Intention Maximale",days:[
    {label:"Séance A — Squat Lourd",exercises:[
      mkEx(1,1,"3","4min","80% 1RM","⏱ TEMPO 2-0-1-0 — SÉRIE D'ACTIVATION : 3 reps. Bracing abdominal maximal. Visualiser la descente avant de débloquer la barre."),
      mkEx(1,3,"3","4min","82.5% 1RM","⏱ TEMPO 2-0-1-0 — TRAVAIL PRINCIPAL 3×3 @ 82.5%. Intention maximale, sortir le plus vite possible tout en maintenant la position. Repos complet 4-5 min si besoin."),
      mkEx(1,1,"1","5min","87.5% 1RM","SINGLE DE FORCE @ 87.5% — Seulement si 3×3 impeccables. Pas d'égo : si doute sur la position, rester sur les 3×3."),
      mkEx(15,3,"6","90s","72.5% 1RM SDT","Romanian Deadlift — Maintien technique. Volume chaîne postérieure."),
      mkEx(16,3,"8","75s","Lourd","⏱ TEMPO 2-0-1-0 — Hip Thrust. Charge haute."),
      mkEx(8,4,"60s","45s","","Gainage — 60s."),
    ]},
    {label:"Séance B — Bench Lourd",exercises:[
      mkEx(2,1,"3","4min","80% 1RM","⏱ TEMPO 2-1-1-0 — ACTIVATION : 3 reps, pause 1s poitrine. Préparer mentalement."),
      mkEx(2,3,"3","4min","82.5% 1RM","⏱ TEMPO 2-1-1-0 — TRAVAIL PRINCIPAL 3×3 @ 82.5%. PAUSE 1s poitrine sur chaque rep. Intention de poussée maximale. Repos 4-5 min."),
      mkEx(2,1,"1","5min","87.5% 1RM","SINGLE @ 87.5% — 1 rep avec pause poitrine. Seulement si 3×3 impeccables."),
      mkEx(10,4,"6","2min","72.5% 1RM","Rowing Barre — Maintien volume dorsal."),
      mkEx(5,3,"5","90s","67.5% 1RM","Développé Militaire — Volume épaules."),
      mkEx(3,4,"Max","2min","","⏱ TEMPO 2-0-1-0 — Tractions Lestées. Volume dos/biceps."),
    ]},
    {label:"Séance C — Deadlift Lourd",exercises:[
      mkEx(4,1,"3","4min","80% 1RM","⏱ TEMPO CONTRÔLÉ — ACTIVATION : 3 reps, mise en position impeccable. Grand dorsal engagé. Reset entre chaque rep."),
      mkEx(4,3,"3","4min","82.5% 1RM","⏱ TEMPO ACCÉLÉRÉ — TRAVAIL PRINCIPAL 3×3 @ 82.5%. Intention de pousser le sol vers le bas. Pas de touch-and-go. Repos 4-5 min."),
      mkEx(4,1,"1","5min","87.5% 1RM","SINGLE @ 87.5% — Seulement si 3×3 propres. La barre peut ralentir, elle ne doit pas s'arrêter."),
      mkEx(15,3,"6","90s","72.5% 1RM SDT","⏱ TEMPO 3-1-0-0 — RDL. Maintien technique."),
      mkEx(20,3,"8","90s","Modéré","⏱ TEMPO 3-1-1-0 — Good Morning. Maintien."),
      mkEx(8,4,"60s","45s","","Gainage — 60s."),
    ]},
    {label:"Séance D — Récupération Active (Volume Léger)",exercises:[
      mkEx(1,3,"10","90s","60% 1RM","Squat — Volume léger après la semaine lourde. Récupération active quadriceps."),
      mkEx(2,3,"10","75s","62.5% 1RM","Développé Couché — Léger. Sensation pectoraux, pas de performance."),
      mkEx(32,4,"12","75s","Léger","Tirage Vertical Poulie — Volume dos."),
      mkEx(13,3,"15","60s","Léger","Leg Curl — Récupération ischio."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — Accessoire bras."),
      mkEx(19,3,"20","45s","Modéré","Mollets."),
    ]},
  ]},
  // ── S8 ────────────────────────────────────────────────────────────────────
  {label:"S8 — Deload · Récupération & Bilan · 50-60%",days:[
    {label:"Séance A — Squat Technique Deload",exercises:[
      mkEx(1,3,"5","2min","55% 1RM","⏱ TEMPO 3-2-1-0 — Retour au tempo S1. Récupération tendineuse et articulaire. Comparer : la position doit être nettement plus fluide qu'en S1."),
      mkEx(118,3,"5","2min","45% 1RM","⏱ TEMPO 3-1-1-0 — Front Squat. Retour aux bases, récupération mobilité."),
      mkEx(15,3,"8","90s","50% 1RM SDT","Romanian Deadlift — Très léger. Récupération ischio-jambiers."),
      mkEx(16,3,"12","75s","Léger","⏱ TEMPO 2-1-1-0 — Hip Thrust. Décharge complète."),
      mkEx(109,3,"10","45s","Léger","Bird Dog — Ancrage stabilité acquise."),
      mkEx(108,3,"12","45s","Léger","Pallof Press — Très léger."),
    ]},
    {label:"Séance B — Bench Technique Deload",exercises:[
      mkEx(2,3,"5","2min","55% 1RM","⏱ TEMPO 3-2-1-0 — Retour tempo S1, PAUSE 2s poitrine. Récupération coudes et épaules. La technique doit être plus précise qu'en S1."),
      mkEx(10,3,"6","2min","55% 1RM","Rowing Barre — Très léger. Récupération dorsaux."),
      mkEx(5,3,"8","90s","50% 1RM","Développé Militaire — Très léger."),
      mkEx(3,3,"Max","2min","","⏱ TEMPO 3-0-1-0 — Tractions. Sans lest. Deload."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — Léger."),
    ]},
    {label:"Séance C — Deadlift Technique Deload",exercises:[
      mkEx(4,3,"4","2min","55% 1RM","⏱ TEMPO CONTRÔLÉ — Retour au tempo S1. Mise en position 3s, PAUSE 1s au genou. Récupération disques et érecteurs. Se concentrer sur la qualité de chaque centimètre."),
      mkEx(15,3,"8","90s","50% 1RM SDT","⏱ TEMPO 3-2-0-0 — RDL. Très léger."),
      mkEx(20,3,"10","90s","Léger","⏱ TEMPO 3-1-1-0 — Good Morning. Très léger."),
      mkEx(16,3,"12","75s","Léger","⏱ TEMPO 2-1-1-0 — Hip Thrust. Décharge."),
      mkEx(8,3,"45s","45s","","Gainage — Retour S1."),
    ]},
    {label:"Séance D — Bilan Final",exercises:[
      mkEx(1,2,"8","90s","55% 1RM","Squat Bilan — Compare ta position et ton contrôle avec S1. 8 semaines de technique, le résultat doit être visible."),
      mkEx(2,2,"8","75s","55% 1RM","Bench Bilan — Compare la stabilité des épaules et la sensation en bas vs S1."),
      mkEx(4,2,"5","90s","55% 1RM","SDT Bilan — Compare l'engagement grand dorsal et la position vertébrale vs S1. Le cycle suivant peut commencer."),
      mkEx(32,3,"12","75s","Léger","Tirage Vertical Poulie — Volume léger."),
      mkEx(13,3,"15","60s","Léger","Leg Curl — Léger."),
      mkEx(19,3,"20","45s","Léger","Mollets — Léger."),
    ]},
  ]},
]};
SEED_PROGRAMS.push(BASES_SOLIDES);

// ─── CYCLE 1 WILLIAM — FULL BODY 3j/sem ──────────────────────────────────────
// Séance C identique chaque semaine (fixe, salle, optionnelle)
const _wC={label:"Séance C — Salle · Optionnelle (même chaque semaine)",exercises:[
  mkEx(11,3,"12","90s","","Leg Press — pieds largeur épaules, amplitude complète, genoux alignés. Augmente la charge dès que tu maîtrises toutes les reps proprement."),
  mkEx(29,3,"12","75s","","Pec Deck — amplitude complète, contraction max au centre, descente contrôlée."),
  mkEx(32,3,"12","75s","","Tirage Vertical Poulie — omoplates rétractées, coudes vers le bas, amplitude complète."),
  mkEx(34,3,"12","75s","","Tirage Horizontal Poulie — serrer les omoplates en fin de mouvement."),
  mkEx(13,3,"12","60s","","Leg Curl Allongé — hanches plaquées au banc, descente contrôlée."),
  mkEx(7,3,"12","60s","","Triceps Poulie — coudes fixes au corps, extension complète."),
  mkEx(50,3,"12","60s","","Curl Poulie Basse — coude fixe, tension constante sur tout l'arc."),
]};

const CYCLE1_WILLIAM={id:"cycle1_william_fb3j",name:"Cycle 1 William — Full Body 3j",category:"Débutant",level:"Débutant",weeks:[
  // ── S1 ──────────────────────────────────────────────────────────────────
  {label:"S1 — Découverte · Apprentissage des mouvements",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,3,"12","90s","Léger","Squat Barre — descente lente jusqu'à la parallèle. Commence très léger : genoux alignés sur les pointes de pieds, dos plat, regard droit."),
      mkEx(2,3,"10","90s","Léger","Développé Couché — coudes à 45°, barre touche légèrement la poitrine, amplitude complète. Charge légère, focus technique."),
      mkEx(3,3,"Max","90s","","Tractions — amplitude complète. Si impossible : sauter en haut et descendre lentement 3s (négatifs). Objectif : 3 reps propres minimum."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — coudes fixes, supination en haut, amplitude complète."),
      mkEx(56,3,"12","60s","Léger","Extension Triceps Haltère — coude serré près de la tête, amplitude complète."),
      mkEx(8,3,"30s","45s","","Gainage Planche — bassin neutre, respiration continue."),
    ]},
    {label:"Séance B — Full Body Maison",exercises:[
      mkEx(15,3,"12","90s","Léger","Romanian Deadlift — dos plat, hanches en arrière, descente jusqu'à l'étirement des ischio. Très léger pour apprendre le mouvement."),
      mkEx(9,3,"10/jambe","90s","Léger","Fentes Marchées — grand pas en avant, genou arrière proche du sol, buste droit. Haltères légers ou poids du corps. Focus : équilibre et alignement du genou."),
      mkEx(10,3,"10","90s","Léger","Rowing Barre — dos parallèle au sol, coudes hauts, tirer la barre vers le nombril. Amplitude complète."),
      mkEx(5,3,"10","90s","Léger","Développé Militaire — gainage actif, amplitude complète, pas de cambrure lombaire."),
      mkEx(49,3,"12","60s","Léger","Curl Marteau — prise neutre, coudes fixes. Biceps et brachioradial."),
      mkEx(66,3,"20s","45s","","Planche Latérale — hanches alignées, corps bien droit."),
    ]},
    _wC,
  ]},
  // ── S2 ──────────────────────────────────────────────────────────────────
  {label:"S2 — Consolidation · Légère progression",days:[
    {label:"Séance A — Full Body Maison (variante)",exercises:[
      mkEx(1,3,"12","90s","Léger","Squat Barre — légère hausse de charge si S1 maîtrisé. Même technique."),
      mkEx(2,3,"10","90s","Léger","Développé Couché — légère progression. Amplitude complète."),
      mkEx(103,3,"10","90s","Léger","Inverted Row — corps rigide sous la barre, tirer le sternum vers la barre. Variante du dos différente des tractions."),
      mkEx(49,3,"12","60s","Léger","Curl Marteau — variation biceps vs S1. Prise neutre, coudes fixes."),
      mkEx(56,3,"12","60s","Léger","Extension Triceps — légère progression."),
      mkEx(66,3,"25s","45s","","Planche Latérale — +5s vs S1. Variation gainage."),
    ]},
    {label:"Séance B — Full Body Maison (variante)",exercises:[
      mkEx(15,3,"12","90s","Léger","Romanian Deadlift — légère hausse si S1 maîtrisé."),
      mkEx(9,3,"10/jambe","90s","Léger","Fentes Marchées — légère hausse si S1 maîtrisé. Même alignement."),
      mkEx(10,3,"10","90s","Léger","Rowing Barre — légère progression. Même technique."),
      mkEx(5,3,"10","90s","Léger","Développé Militaire — légère progression."),
      mkEx(6,3,"12","60s","Léger","Curl Haltères — variation vs S1."),
      mkEx(8,3,"35s","45s","","Gainage Planche — +5s vs S1. Variation vs Planche Latérale."),
    ]},
    _wC,
  ]},
  // ── S3 ──────────────────────────────────────────────────────────────────
  {label:"S3 — Construction · 3×10 · Charges modérées",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,3,"10","90s","Moyen","Squat Barre — reps réduites, charge augmentée. Même technique."),
      mkEx(2,3,"10","90s","Moyen","Développé Couché — progression continue."),
      mkEx(3,3,"Max","90s","","Tractions — viser +1 rep par série vs S1. Négatifs si besoin."),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères — légère progression."),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps — légère progression."),
      mkEx(8,3,"40s","45s","","Gainage — +10s vs S1."),
    ]},
    {label:"Séance B — Full Body Maison (variante)",exercises:[
      mkEx(15,3,"10","90s","Moyen","Romanian Deadlift — reps réduites, charge augmentée."),
      mkEx(9,3,"10/jambe","90s","Moyen","Fentes Marchées — haltères légèrement plus lourds. Contrôle du genou et de l'équilibre."),
      mkEx(10,3,"10","90s","Moyen","Rowing Barre — progression charge."),
      mkEx(5,3,"10","90s","Moyen","Développé Militaire — progression."),
      mkEx(49,3,"12","60s","Moyen","Curl Marteau — variation vs S2."),
      mkEx(66,3,"30s","45s","","Planche Latérale — +10s vs S1."),
    ]},
    _wC,
  ]},
  // ── S4 ──────────────────────────────────────────────────────────────────
  {label:"S4 — Consolidation · +1 Série sur les gros mouvements",days:[
    {label:"Séance A — Full Body Maison (variante)",exercises:[
      mkEx(1,4,"10","90s","Moyen","Squat Barre — +1 série vs S3. Charge identique ou légère hausse."),
      mkEx(2,4,"10","90s","Moyen","Développé Couché — +1 série."),
      mkEx(103,4,"10","90s","Moyen","Inverted Row — +1 série. Corps rigide, amplitude complète."),
      mkEx(49,3,"12","60s","Moyen","Curl Marteau — maintien."),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps — maintien."),
      mkEx(66,3,"30s","45s","","Planche Latérale — maintien."),
    ]},
    {label:"Séance B — Full Body Maison",exercises:[
      mkEx(15,4,"10","90s","Moyen","Romanian Deadlift — +1 série vs S3."),
      mkEx(9,4,"10/jambe","90s","Moyen","Fentes Marchées — +1 série vs S3. Charge maintenue ou légère hausse."),
      mkEx(10,4,"10","90s","Moyen","Rowing Barre — +1 série."),
      mkEx(5,3,"10","90s","Moyen","Développé Militaire — maintien."),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères — variation."),
      mkEx(8,3,"45s","45s","","Gainage — +5s vs S3."),
    ]},
    _wC,
  ]},
  // ── S5 ──────────────────────────────────────────────────────────────────
  {label:"S5 — Progression · 4×8 · Légère intensification",days:[
    {label:"Séance A — Full Body Maison",exercises:[
      mkEx(1,4,"8","90s","Moyen","Squat Barre — reps réduites, nouvelle hausse de charge. Qualité du mouvement maintenue."),
      mkEx(2,4,"8","90s","Moyen","Développé Couché — charge progressive, technique identique."),
      mkEx(3,4,"Max","90s","","Tractions — +1 série. Viser 3-5 reps propres minimum par série."),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères — maintien volume."),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps — maintien."),
      mkEx(8,4,"45s","45s","","Gainage — +1 série, 45s."),
    ]},
    {label:"Séance B — Full Body Maison (variante)",exercises:[
      mkEx(15,4,"8","90s","Moyen","Romanian Deadlift — reps réduites, charge augmentée."),
      mkEx(9,4,"10/jambe","90s","Moyen","Fentes Marchées — progression charge. Buste droit, genou arrière proche du sol."),
      mkEx(10,4,"8","90s","Moyen","Rowing Barre — reps réduites, charge augmentée."),
      mkEx(5,3,"10","90s","Moyen","Développé Militaire — maintien."),
      mkEx(49,3,"12","60s","Moyen","Curl Marteau — variation."),
      mkEx(66,4,"35s","45s","","Planche Latérale — +1 série, +5s."),
    ]},
    _wC,
  ]},
  // ── S6 ──────────────────────────────────────────────────────────────────
  {label:"S6 — Bilan · Consolidation finale · 6 semaines ✓",days:[
    {label:"Séance A — Full Body Maison (bilan)",exercises:[
      mkEx(1,4,"10","90s","Moyen","Squat Barre — compare ta charge avec S1 : belle progression ! Même technique."),
      mkEx(2,4,"10","90s","Moyen","Développé Couché — bilan progression."),
      mkEx(3,4,"Max","90s","","Tractions — compte tes reps et compare avec S1 !"),
      mkEx(6,3,"12","60s","Moyen","Curl Haltères — maintien."),
      mkEx(56,3,"12","60s","Moyen","Extension Triceps — maintien."),
      mkEx(8,4,"45s","45s","","Gainage — niveau S5 maintenu."),
    ]},
    {label:"Séance B — Full Body Maison (bilan)",exercises:[
      mkEx(15,4,"10","90s","Moyen","Romanian Deadlift — compare ta charge vs S1."),
      mkEx(9,4,"10/jambe","90s","Moyen","Fentes Marchées — bilan. Compare ta maîtrise et ta charge avec S1."),
      mkEx(10,4,"10","90s","Moyen","Rowing Barre — bilan."),
      mkEx(5,3,"10","90s","Moyen","Développé Militaire — bilan."),
      mkEx(49,3,"12","60s","Moyen","Curl Marteau — consolidation."),
      mkEx(66,4,"35s","45s","","Planche Latérale — bilan."),
    ]},
    _wC,
  ]},
]};
SEED_PROGRAMS.push(CYCLE1_WILLIAM);

const SEED_CLIENTS = [
  {id:1,name:"Sophie Martin",code:"SOPH2025",goal:"Perte de poids",since:"Jan 2025",sessions:4,color:G.goldLight,programs:[1],
   mealPlan:emptyMealPlan(),
   nutrition:{calories:1800,proteins:130,carbs:180,fats:60,notes:"Éviter le gluten."},
   sessionLogs:[
     {id:"log1",date:"2025-03-10",programId:1,weekIdx:0,dayIdx:0,dayLabel:"Séance A",completed:true,notes:"Bonne séance",
      exercises:[
        {exId:1,name:"Squat Barre",sensation:"😊",sets:[{reps:"8",load:"55kg"},{reps:"8",load:"55kg"},{reps:"8",load:"60kg"},{reps:"7",load:"60kg"}]},
        {exId:2,name:"Développé Couché",sensation:"😐",sets:[{reps:"8",load:"45kg"},{reps:"8",load:"50kg"},{reps:"7",load:"50kg"},{reps:"6",load:"50kg"}]},
        {exId:8,name:"Gainage Planche",sensation:"",sets:[{reps:"45s",load:""},{reps:"45s",load:""},{reps:"40s",load:""}]},
      ]}
   ]},
  {id:2,name:"Thomas Dubois",code:"THOM2025",goal:"Prise de masse",since:"Fév 2025",sessions:2,color:G.gold,programs:[2],
   mealPlan:emptyMealPlan(),
   nutrition:{calories:3200,proteins:200,carbs:380,fats:90,notes:"Shake post-workout."},sessionLogs:[]},
  {id:3,name:"Camille Roy",code:"CAMI2025",goal:"Tonification",since:"Mar 2025",sessions:0,color:"#8a7040",programs:[],
   mealPlan:emptyMealPlan(),
   nutrition:{calories:2000,proteins:150,carbs:220,fats:65,notes:""},sessionLogs:[]},
];

// ─── FIRESTORE HOOK ───────────────────────────────────────────────────────────
function useFirestoreCollection(collectionName, seed) {
  const [data, setDataLocal] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const colRef = collection(db, collectionName);
    let initDone = false;
    const unsub = onSnapshot(colRef,
      snap => {
        const items = snap.docs.map(d=>d.data());
        setDataLocal(items);
        if(!initDone){ initDone=true; setReady(true); }
      },
      err => {
        console.error(`[Firebase] ${collectionName}:`, err);
        if(!initDone){ initDone=true; setDataLocal(seed); setReady(true); }
      }
    );
    const timer = setTimeout(()=>{ if(!initDone){ initDone=true; setDataLocal(seed); setReady(true); } }, 5000);
    getDocs(colRef).then(snap=>{
      const existingMap=new Map(snap.docs.map(d=>[d.id,d.data()]));
      const missing=seed.filter(item=>!existingMap.has(String(item.id)));
      const outdated=seed.filter(item=>{
        const ex=existingMap.get(String(item.id));
        return ex&&item._v&&ex._v!==item._v;
      });
      const toWrite=[...missing,...outdated];
      if(toWrite.length>0){
        const BATCH_SIZE=499;
        const batches=[];
        for(let i=0;i<toWrite.length;i+=BATCH_SIZE){
          const b=writeBatch(db);
          toWrite.slice(i,i+BATCH_SIZE).forEach(item=>b.set(doc(db,collectionName,String(item.id)),item));
          batches.push(b.commit());
        }
        return Promise.all(batches);
      }
    }).catch(err=>console.error(`[Firebase] seed ${collectionName}:`,err));
    return ()=>{ unsub(); clearTimeout(timer); };
  },[collectionName]); // eslint-disable-line

  const setData=(updater)=>{
    setDataLocal(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      const prevMap=new Map(prev.map(x=>[String(x.id),x]));
      const nextIds=new Set(next.map(x=>String(x.id)));
      next.forEach(item=>{
        const p=prevMap.get(String(item.id));
        if(!p||JSON.stringify(p)!==JSON.stringify(item))
          setDoc(doc(db,collectionName,String(item.id)),item).catch(console.error);
      });
      prev.forEach(item=>{
        if(!nextIds.has(String(item.id)))
          deleteDoc(doc(db,collectionName,String(item.id))).catch(console.error);
      });
      return next;
    });
  };
  return [data, setData, ready];
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────
const Tag=({text,color=G.gold})=>(
  <span style={{background:color+"18",color,border:`1px solid ${color}33`,borderRadius:4,padding:"2px 9px",fontSize:11,fontWeight:600,letterSpacing:.8,textTransform:"uppercase"}}>{text}</span>
);
const Label=({children})=>(
  <div style={{fontSize:11,color:G.grey,fontWeight:600,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>{children}</div>
);
const Inp=({label,...p})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label>{label}</Label>}
    <input style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:14,outline:"none"}}
      onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border} {...p}/>
  </div>
);
const Txa=({label,...p})=>(
  <div style={{marginBottom:14}}>
    {label&&<Label>{label}</Label>}
    <textarea style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:14,outline:"none",resize:"vertical",minHeight:66}}
      onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border} {...p}/>
  </div>
);
const Btn=({children,variant="gold",style:s={},...p})=>{
  const v={gold:{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none"},outline:{background:"transparent",color:G.gold,border:`1px solid ${G.gold}55`},ghost:{background:G.bg3,color:G.grey,border:`1px solid ${G.border}`},danger:{background:"#E0525215",color:G.red,border:`1px solid ${G.red}33`}};
  return <button style={{...v[variant],borderRadius:8,padding:"10px 20px",fontWeight:700,fontSize:14,cursor:"pointer",...s}} {...p}>{children}</button>;
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
    <div style={{background:G.bg4,borderRadius:99,height:5}}><div style={{width:`${Math.min(100,(value/max)*100)}%`,height:"100%",background:color,borderRadius:99}}/></div>
  </div>
);
const Av=({name,color=G.gold,size=40})=>(
  <div style={{width:size,height:size,borderRadius:size*.28,background:color+"18",border:`1.5px solid ${color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:size*.38,color,flexShrink:0}}>
    {name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)}
  </div>
);
const Modal=({onClose,title,children,width=520})=>(
  <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{background:G.bg2,borderRadius:16,padding:28,width,maxWidth:"90vw",border:`1px solid ${G.border}`,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.5}}>{title}</div>
        <button onClick={onClose} style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,width:32,height:32,cursor:"pointer",color:G.grey,fontSize:16}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);
const Empty=({text,icon="○"})=>(
  <div style={{textAlign:"center",padding:"80px 20px",color:G.greyDim}}>
    <div style={{fontSize:40,marginBottom:14,opacity:.2}}>{icon}</div>
    <div style={{fontSize:14}}>{text}</div>
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function CoachLogin({onLogin}){
  const [code,setCode]=useState("");
  const [err,setErr]=useState(false);
  const attempt=()=>{if(!onLogin(code)){setErr(true);setTimeout(()=>setErr(false),2500);}};
  return(
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      <div style={{width:380,padding:40,background:G.bg2,borderRadius:20,border:`1px solid ${G.border}`}} className="fu">
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{width:64,height:64,borderRadius:18,background:`linear-gradient(135deg,${G.goldLight}20,${G.gold}40)`,border:`1.5px solid ${G.gold}55`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px",fontSize:28}}>⚡</div>
          <div style={{fontFamily:G.fontD,fontSize:32,fontWeight:800,letterSpacing:-1}}>WANDY<span style={{color:G.goldLight}}> COACH</span></div>
          <div style={{fontSize:11,color:G.grey,marginTop:4,letterSpacing:3,textTransform:"uppercase"}}>Espace Coach — Bureau</div>
        </div>
        <Label>Code coach</Label>
        <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="COACH2025"
          style={{width:"100%",background:G.bg3,border:`1.5px solid ${err?G.red:G.border}`,borderRadius:10,padding:"14px 16px",color:G.white,fontSize:18,outline:"none",letterSpacing:4,textAlign:"center",marginBottom:err?8:16}}/>
        {err&&<div style={{color:G.red,fontSize:12,textAlign:"center",marginBottom:12}}>Code invalide</div>}
        <Btn onClick={attempt} disabled={!code} style={{width:"100%"}}>Accéder →</Btn>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({view,setView,onLogout,counts}){
  const items=[
    {key:"dashboard",icon:"◈",label:"Tableau de bord"},
    {key:"clients",icon:"◉",label:"Clients",count:counts.clients},
    {key:"programs",icon:"▦",label:"Programmes",count:counts.programs},
    {key:"exercises",icon:"⊕",label:"Exercices",count:counts.exercises},
    {key:"foods",icon:"◎",label:"Aliments",count:counts.foods},
  ];
  const isActive=v=>{
    if(v==="clients"&&view==="program-from-client")return true;
    return view===v;
  };
  return(
    <div style={{width:220,flexShrink:0,background:"#0c0c0c",borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:"24px 20px 20px",borderBottom:`1px solid ${G.border}`}}>
        <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-1}}>WANDY<span style={{color:G.goldLight}}> COACH</span></div>
        <div style={{fontSize:10,color:G.grey,marginTop:3,letterSpacing:2,textTransform:"uppercase"}}>Espace Coach</div>
      </div>
      <nav style={{flex:1,padding:"14px 10px",display:"flex",flexDirection:"column",gap:3}}>
        {items.map(({key,icon,label,count})=>{
          const a=isActive(key);
          return(
            <button key={key} onClick={()=>setView(key)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,background:a?G.gold+"18":"transparent",border:a?`1px solid ${G.gold}33`:"1px solid transparent",color:a?G.goldLight:G.grey,cursor:"pointer",fontSize:13,fontWeight:a?700:500,textAlign:"left",transition:"all .15s",width:"100%"}}>
              <span style={{fontSize:16}}>{icon}</span>
              <span style={{flex:1}}>{label}</span>
              {count!==undefined&&<span style={{background:a?G.goldLight+"22":G.bg3,color:a?G.goldLight:G.greyDim,borderRadius:99,fontSize:10,padding:"1px 7px",fontWeight:700}}>{count}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"12px 10px",borderTop:`1px solid ${G.border}`}}>
        <button onClick={onLogout} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,background:"transparent",border:"1px solid transparent",color:G.greyDim,cursor:"pointer",fontSize:12,fontWeight:500,width:"100%",textAlign:"left"}}
          onMouseEnter={e=>{e.currentTarget.style.color=G.red;e.currentTarget.style.background="#E0525210";}}
          onMouseLeave={e=>{e.currentTarget.style.color=G.greyDim;e.currentTarget.style.background="transparent";}}>
          <span style={{fontSize:14}}>⎋</span> Déconnexion
        </button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({clients,programs,exercises,onSelClient,onSelProgram}){
  const totalSessions=clients.reduce((a,c)=>a+c.sessions,0);
  return(
    <div style={{padding:36,maxWidth:960,overflowY:"auto"}} className="fu">
      <div style={{marginBottom:32}}>
        <div style={{fontSize:12,color:G.gold,fontWeight:600,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Bienvenue</div>
        <div style={{fontFamily:G.fontD,fontSize:36,fontWeight:800,letterSpacing:-1}}>TABLEAU DE BORD</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:36}}>
        {[[clients.length,"Clients actifs","◉"],[programs.length,"Programmes","▦"],[exercises.length,"Exercices","⊕"],[totalSessions,"Séances totales","◎"]].map(([v,l,ic])=>(
          <div key={l} style={{background:G.bg2,borderRadius:14,padding:20,border:`1px solid ${G.border}`}}>
            <div style={{fontSize:20,color:G.gold,marginBottom:10}}>{ic}</div>
            <div style={{fontFamily:G.fontD,fontSize:40,fontWeight:800,color:G.goldLight,lineHeight:1}}>{v}</div>
            <div style={{fontSize:11,color:G.grey,letterSpacing:1,textTransform:"uppercase",marginTop:5}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>
        <div>
          <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Clients récents</div>
          {clients.length===0&&<Empty text="Aucun client" icon="◉"/>}
          {clients.slice(0,5).map(c=>(
            <div key={c.id} onClick={()=>onSelClient(c)} style={{background:G.bg2,borderRadius:12,padding:"12px 16px",marginBottom:8,border:`1px solid ${G.border}`,borderLeft:`3px solid ${c.color}`,cursor:"pointer",display:"flex",alignItems:"center",gap:12,transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=G.bg3} onMouseLeave={e=>e.currentTarget.style.background=G.bg2}>
              <Av name={c.name} color={c.color} size={36}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                <div style={{fontSize:11,color:G.grey,marginTop:2}}>{c.goal} · {c.sessions} séances</div>
              </div>
              <div style={{color:G.greyDim,fontSize:16}}>›</div>
            </div>
          ))}
        </div>
        <div>
          <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:14}}>Programmes récents</div>
          {programs.length===0&&<Empty text="Aucun programme" icon="▦"/>}
          {programs.slice(0,5).map(p=>(
            <div key={p.id} onClick={()=>onSelProgram(p)} style={{background:G.bg2,borderRadius:12,padding:"12px 16px",marginBottom:8,border:`1px solid ${G.border}`,cursor:"pointer",transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background=G.bg3} onMouseLeave={e=>e.currentTarget.style.background=G.bg2}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:5}}>{p.name}</div>
                  <div style={{display:"flex",gap:5}}>{[p.level,`${p.weeks.length} sem.`].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}</div>
                </div>
                <div style={{color:G.greyDim,fontSize:16}}>›</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MEAL PLAN EDITOR ─────────────────────────────────────────────────────────
function MealPlanEditor({mealPlan,onSave,onLiveChange,foods=FOODS_DB}){
  const initForm=()=>MEAL_SLOTS.map(s=>{
    const ex=(mealPlan?.meals||[]).find(m=>m.id===s.id);
    return{id:s.id,label:s.label,icon:s.icon,items:ex?.items||[],note:ex?.note||""};
  });
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState(initForm);
  const [pickerMeal,setPickerMeal]=useState(null);
  const [search,setSearch]=useState("");
  const [templateSaved,setTemplateSaved]=useState(false);
  const [firestoreTemplate,setFirestoreTemplate]=useState(null);

  useEffect(()=>{
    getDoc(doc(db,"settings","mealTemplate"))
      .then(snap=>{if(snap.exists())setFirestoreTemplate(snap.data().meals||null);})
      .catch(()=>{});
  },[]);

  useEffect(()=>{
    if(editing&&onLiveChange) onLiveChange(calcMacros(form.flatMap(m=>m.items),foods));
  },[form,editing]); // eslint-disable-line

  const saveAsTemplate=()=>{
    const meals=form.map(({icon,...rest})=>rest);
    setDoc(doc(db,"settings","mealTemplate"),{meals})
      .then(()=>{setFirestoreTemplate(meals);setTemplateSaved(true);setTimeout(()=>setTemplateSaved(false),2500);})
      .catch(()=>{});
  };

  const applyTemplate=(thenEdit=false)=>{
    const t=firestoreTemplate;
    if(!t)return;
    setForm(MEAL_SLOTS.map(s=>{
      const tm=t.find(m=>m.id===s.id);
      return{id:s.id,label:s.label,icon:s.icon,items:tm?.items||[]};
    }));
    if(thenEdit)setEditing(true);
  };

  const save=()=>{
    const meals=form.map(({icon,...rest})=>rest);
    const totals=calcMacros(form.flatMap(m=>m.items),foods);
    onSave({meals},totals);
    if(onLiveChange) onLiveChange(null);
    setEditing(false);
  };
  const cancel=()=>{setForm(initForm());if(onLiveChange)onLiveChange(null);setEditing(false);};

  const addItem=(mealId,foodId)=>{
    const food=foods.find(f=>f.id===foodId);
    const defQty=food.unit==="g"?100:1;
    setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:[...m.items,{foodId,qty:defQty}]}));
    setPickerMeal(null);setSearch("");
  };
  const removeItem=(mealId,idx)=>setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:m.items.filter((_,i)=>i!==idx)}));
  const updateQty=(mealId,idx,val)=>setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:m.items.map((it,i)=>i!==idx?it:{...it,qty:parseFloat(val)||0})}));
  const updateNote=(mealId,val)=>setForm(f=>f.map(m=>m.id!==mealId?m:{...m,note:val}));

  const filteredFoods=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()));
  const totalMacros=calcMacros(form.flatMap(m=>m.items),foods);
  const hasPlan=form.some(m=>m.items.length>0);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14}}>Plan alimentaire</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {!editing&&hasPlan&&(
            <BtnSm variant="ghost" onClick={saveAsTemplate}>
              {templateSaved?"✓ Sauvegardé":"💾 Modèle"}
            </BtnSm>
          )}
          {editing&&(
            <BtnSm variant="ghost" onClick={()=>applyTemplate(false)}
              style={!firestoreTemplate?{opacity:0.35,cursor:"default",pointerEvents:"none"}:{}}>
              📋 Coller le template
            </BtnSm>
          )}
          <BtnSm variant={editing?"ghost":"gold"} onClick={()=>editing?cancel():setEditing(true)}>{editing?"Annuler":"✏️ Modifier"}</BtnSm>
        </div>
      </div>

      {editing?(
        <>
          {totalMacros.kcal>0&&(
            <div style={{display:"flex",justifyContent:"space-around",background:G.bg3,borderRadius:10,padding:"10px 0",marginBottom:16,border:`1px solid ${G.border}`}}>
              {[[rnd(totalMacros.kcal),"kcal",G.goldLight],[rnd1(totalMacros.protein)+"g","Prot.",G.goldLight],[rnd1(totalMacros.carbs)+"g","Gluc.",G.gold],[rnd1(totalMacros.fat)+"g","Lip.","#C9A84C"]].map(([v,l,c])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                  <div style={{fontSize:10,color:G.grey,letterSpacing:.5,marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
          )}
          {form.map(meal=>{
            const mMacros=calcMacros(meal.items,foods);
            return(
              <div key={meal.id} style={{marginBottom:18}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:12,color:G.gold,fontWeight:700}}>{meal.icon} {meal.label}</div>
                  {meal.items.length>0&&<div style={{fontSize:11,color:G.grey}}>{rnd(mMacros.kcal)} kcal</div>}
                </div>
                {meal.items.map((item,idx)=>{
                  const food=foods.find(f=>f.id===item.foodId);
                  if(!food)return null;
                  const im=calcMacros([item],foods);
                  return(
                    <div key={idx} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,background:G.bg3,borderRadius:8,padding:"8px 10px"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:G.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{food.name}</div>
                        <div style={{fontSize:11,color:G.grey,marginTop:2}}>{rnd(im.kcal)} kcal · P {rnd1(im.protein)}g · G {rnd1(im.carbs)}g · L {rnd1(im.fat)}g</div>
                      </div>
                      <input type="number" value={item.qty} min="0" onChange={e=>updateQty(meal.id,idx,e.target.value)}
                        style={{width:56,background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"5px 6px",color:G.goldLight,fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                      <div style={{fontSize:11,color:G.grey,flexShrink:0}}>{food.unit==="g"?"g":"port."}</div>
                      <button onClick={()=>removeItem(meal.id,idx)}
                        style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 2px",flexShrink:0}}>×</button>
                    </div>
                  );
                })}
                <button onClick={()=>{setPickerMeal(meal.id);setSearch("");}}
                  style={{width:"100%",background:"transparent",border:`1px dashed ${G.border}`,borderRadius:8,padding:"7px 0",color:G.grey,fontSize:12,cursor:"pointer",marginTop:meal.items.length?4:0}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=G.gold;e.currentTarget.style.color=G.gold;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.grey;}}>
                  + Ajouter un aliment
                </button>
                <textarea value={meal.note||""} onChange={e=>updateNote(meal.id,e.target.value)}
                  placeholder="Note pour ce repas (préparation, timing, conseils…)"
                  rows={2}
                  style={{width:"100%",marginTop:8,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,
                    padding:"8px 10px",color:G.white,fontSize:12,fontFamily:G.font,resize:"vertical",
                    outline:"none",boxSizing:"border-box",lineHeight:1.5}}
                  onFocus={e=>e.currentTarget.style.borderColor=G.gold}
                  onBlur={e=>e.currentTarget.style.borderColor=G.border}/>
              </div>
            );
          })}
          <Btn onClick={save} style={{width:"100%"}}>✓ Enregistrer le plan alimentaire</Btn>
        </>
      ):(
        !hasPlan?(
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{color:G.greyDim,fontSize:13,marginBottom:firestoreTemplate?14:0}}>Aucun plan alimentaire renseigné</div>
            {firestoreTemplate&&(
              <button onClick={()=>applyTemplate(true)}
                style={{background:`linear-gradient(135deg,${G.gold}22,${G.gold}11)`,border:`1px solid ${G.gold}55`,
                  borderRadius:10,padding:"12px 20px",color:G.goldLight,fontFamily:G.font,fontWeight:700,
                  fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8}}>
                📋 Pré-remplir avec le modèle
              </button>
            )}
          </div>
        ):(
          form.filter(m=>m.items.length>0).map(meal=>{
            const mMacros=calcMacros(meal.items,foods);
            return(
              <div key={meal.id} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:.5,textTransform:"uppercase"}}>{meal.icon} {meal.label}</div>
                  <div style={{fontSize:11,color:G.grey}}>{rnd(mMacros.kcal)} kcal</div>
                </div>
                {meal.items.map((item,idx)=>{
                  const food=foods.find(f=>f.id===item.foodId);
                  if(!food)return null;
                  return(
                    <div key={idx} style={{fontSize:13,color:G.white,marginBottom:3}}>
                      {food.name} <span style={{color:G.grey}}>— {item.qty} {food.unit==="g"?"g":"port."}</span>
                    </div>
                  );
                })}
                {meal.note&&<div style={{marginTop:8,padding:"7px 10px",background:G.bg3,borderRadius:8,
                  borderLeft:`3px solid ${G.gold}55`,fontSize:12,color:G.grey,lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                  {meal.note}
                </div>}
              </div>
            );
          })
        )
      )}

      {pickerMeal&&(
        <Modal onClose={()=>{setPickerMeal(null);setSearch("");}} title="Ajouter un aliment">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un aliment..."
            style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 12px",color:G.white,fontSize:14,outline:"none",marginBottom:12}}
            onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border}/>
          {filteredFoods.map(food=>(
            <div key={food.id} onClick={()=>addItem(pickerMeal,food.id)}
              style={{padding:"10px 12px",marginBottom:6,background:G.bg3,borderRadius:8,cursor:"pointer",border:`1px solid ${G.border}`}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=G.gold}
              onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
              <div style={{fontWeight:600,fontSize:13,color:G.white,marginBottom:2}}>{food.name}</div>
              <div style={{fontSize:11,color:G.grey}}>
                {food.kcal} kcal · {food.protein}g prot · {food.carbs}g gluc · {food.fat}g lip
                <span style={{color:G.gold,marginLeft:6}}>/ {food.unit==="g"?"100g":"1 portion"}</span>
              </div>
            </div>
          ))}
          {filteredFoods.length===0&&<div style={{textAlign:"center",color:G.greyDim,padding:20}}>Aucun aliment trouvé</div>}
        </Modal>
      )}
    </div>
  );
}

// ─── CLIENT DETAIL PANEL ──────────────────────────────────────────────────────
function ClientDetailPanel({client,clients,setClients,programs,setPrograms,onViewProgram,onDelete,foods=FOODS_DB}){
  const [tab,setTab]=useState("program");
  const [editNut,setEditNut]=useState(false);
  const [nutForm,setNutForm]=useState({...client.nutrition});
  const [liveNut,setLiveNut]=useState(null);
  const [editName,setEditName]=useState(false);
  const [nameVal,setNameVal]=useState(client.name);
  const [editTests,setEditTests]=useState(false);
  const [testsForm,setTestsForm]=useState({...EMPTY_TESTS,...(client.tests||{})});

  const cur=clients.find(c=>c.id===client.id)||client;
  const upd=fn=>setClients(p=>p.map(c=>c.id===cur.id?fn(c):c));
  const toggleProg=pid=>upd(c=>({...c,programs:c.programs.includes(pid)?c.programs.filter(x=>x!==pid):[...c.programs,pid]}));
  const saveNut=()=>{upd(c=>({...c,nutrition:nutForm}));setEditNut(false);};
  const saveName=()=>{upd(c=>({...c,name:nameVal}));setEditName(false);};
  const saveTests=()=>{upd(c=>({...c,tests:testsForm}));setEditTests(false);};
  const copyAndEdit=p=>{
    const copy={...JSON.parse(JSON.stringify(p)),id:Date.now(),name:`${p.name} (${cur.name.split(" ")[0]})`,_copy:true};
    setPrograms(prev=>[...prev,copy]);
    upd(c=>({...c,programs:[...c.programs.filter(x=>x!==p.id),copy.id]}));
    onViewProgram(copy,cur);
  };

  const assigned=programs.filter(p=>cur.programs.includes(p.id));
  const unassigned=programs.filter(p=>!cur.programs.includes(p.id));

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"20px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <Av name={cur.name} color={cur.color} size={50}/>
          <div style={{flex:1}}>
            {editName?(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <input value={nameVal} onChange={e=>setNameVal(e.target.value)} autoFocus
                  style={{background:G.bg3,border:`1px solid ${G.gold}`,borderRadius:6,padding:"6px 10px",color:G.white,fontSize:18,fontWeight:700,outline:"none",flex:1}}/>
                <BtnSm onClick={saveName}>✓</BtnSm>
                <BtnSm variant="ghost" onClick={()=>setEditName(false)}>✕</BtnSm>
              </div>
            ):(
              <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.5}}>{cur.name}</div>
            )}
            <div style={{fontSize:12,color:G.grey,marginTop:3}}>{cur.goal} · {cur.sessions} séances</div>
            <div style={{display:"inline-block",marginTop:5,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:4,padding:"2px 8px",fontSize:11,color:G.gold,fontFamily:"monospace",letterSpacing:2}}>{cur.code}</div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <BtnSm variant="ghost" onClick={()=>{setNameVal(cur.name);setEditName(true);}}>✏️</BtnSm>
            <BtnSm variant="danger" onClick={()=>confirm(`Supprimer ${cur.name} ?`)&&onDelete(cur.id)}>🗑</BtnSm>
          </div>
        </div>
      </div>
      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        {[["program","Programme"],["perfs","Performances"],["nutrition","Nutrition"],["suivi","Historique"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{padding:"10px 20px",background:"none",border:"none",borderBottom:tab===k?`2px solid ${G.goldLight}`:"2px solid transparent",color:tab===k?G.goldLight:G.grey,cursor:"pointer",fontSize:13,fontWeight:tab===k?700:500,marginBottom:-1}}>
            {l}
          </button>
        ))}
      </div>
      {/* Content */}
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {tab==="program"&&(
          <>
            {assigned.length===0&&<Empty text="Aucun programme assigné" icon="▦"/>}
            {assigned.map(p=>(
              <div key={p.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontWeight:700}}>{p.name}{p._copy&&<span style={{fontSize:10,color:G.gold,marginLeft:8,fontWeight:400}}>copie perso</span>}</div>
                  <div style={{display:"flex",gap:6}}>
                    <BtnSm onClick={()=>copyAndEdit(p)}>✏️ Personnaliser</BtnSm>
                    <BtnSm variant="danger" onClick={()=>toggleProg(p.id)}>Retirer</BtnSm>
                  </div>
                </div>
                <div style={{fontSize:12,color:G.grey,marginBottom:10}}>{p.weeks.length} semaine{p.weeks.length>1?"s":""} · {p.weeks[0]?.days.length||0} jours/sem</div>
                <BtnSm onClick={()=>onViewProgram(p,cur)}>Voir séances & résultats →</BtnSm>
              </div>
            ))}
            {/* Section "Assigner un programme" */}
            {unassigned.length>0&&(
              <>
                <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",margin:"20px 0 10px"}}>Assigner un programme</div>
                {unassigned.map(p=>(
                  <div key={p.id} style={{background:G.bg2,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontWeight:600,fontSize:13}}>{p.name}</div><div style={{fontSize:11,color:G.grey,marginTop:2}}>{p.category} · {p.level}</div></div>
                    <BtnSm onClick={()=>toggleProg(p.id)}>+ Assigner</BtnSm>
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {tab==="perfs"&&(()=>{
          const t=cur.tests||{};
          const tf=k=>v=>setTestsForm(p=>({...p,[k]:v}));
          const SECTIONS=[
            {label:"❤️ Cardio",fields:[["fcmax","FCmax","bpm"],["vma","VMA","km/h"]]},
            {label:"🏋️ Force (1RM estimé)",fields:[["rm_squat","Squat","kg"],["rm_bench","Développé couché","kg"],["rm_sdt","Soulevé de terre","kg"]]},
            {label:"💪 Tests corps",fields:[["tractions_max","Tractions max","reps"],["pompes_max","Pompes max","reps"],["gainage_max","Gainage planche","sec"]]},
          ];
          return(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div style={{fontFamily:G.fontD,fontSize:18,fontWeight:800,letterSpacing:.5,color:G.goldLight}}>Performances & Tests</div>
                <div style={{display:"flex",gap:6}}>
                  {editTests?(
                    <>
                      <BtnSm variant="ghost" onClick={()=>{setTestsForm({...EMPTY_TESTS,...(cur.tests||{})});setEditTests(false);}}>Annuler</BtnSm>
                      <BtnSm onClick={saveTests}>✓ Enregistrer</BtnSm>
                    </>
                  ):(
                    <BtnSm variant="ghost" onClick={()=>{setTestsForm({...EMPTY_TESTS,...(cur.tests||{})});setEditTests(true);}}>✏️ Modifier</BtnSm>
                  )}
                </div>
              </div>
              {SECTIONS.map(sec=>(
                <div key={sec.label} style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>{sec.label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    {sec.fields.map(([key,label,unit])=>(
                      <div key={key} style={{background:G.bg2,borderRadius:10,padding:"12px 14px",border:`1px solid ${G.border}`}}>
                        <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{label}</div>
                        {editTests?(
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <input type="number" value={testsForm[key]} placeholder="—"
                              onChange={e=>tf(key)(e.target.value)}
                              style={{flex:1,background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"6px 8px",color:G.white,fontSize:15,fontWeight:700,outline:"none",textAlign:"center"}}/>
                            <span style={{fontSize:11,color:G.grey,flexShrink:0}}>{unit}</span>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                            <span style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,color:t[key]?G.goldLight:G.greyDim}}>{t[key]||"—"}</span>
                            {t[key]&&<span style={{fontSize:11,color:G.grey}}>{unit}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:11,color:G.gold,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>📝 Notes</div>
                {editTests?(
                  <textarea value={testsForm.notes||""} onChange={e=>tf("notes")(e.target.value)} rows={3} placeholder="Observations, conditions du test, date..."
                    style={{width:"100%",background:G.bg2,border:`1px solid ${G.border}`,borderRadius:10,padding:12,color:G.white,fontSize:13,outline:"none",resize:"vertical",fontFamily:G.font}}/>
                ):(
                  <div style={{background:G.bg2,borderRadius:10,padding:12,border:`1px solid ${G.border}`,fontSize:13,color:t.notes?G.white:G.greyDim,minHeight:48}}>
                    {t.notes||"Aucune note"}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {tab==="nutrition"&&(()=>{
          const storedItems=(cur.mealPlan?.meals||[]).flatMap(m=>m.items||[]);
          const storedCalc=storedItems.length>0?calcMacros(storedItems,foods):null;
          const src=liveNut||storedCalc;
          const cal=src?rnd(src.kcal):cur.nutrition?.calories||0;
          const prot=src?rnd1(src.protein):cur.nutrition?.proteins||0;
          const gluc=src?rnd1(src.carbs):cur.nutrition?.carbs||0;
          const lip=src?rnd1(src.fat):cur.nutrition?.fats||0;
          return(
            <>
              <div style={{background:G.bg2,borderRadius:12,padding:20,border:`1px solid ${G.border}`,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:liveNut?6:18}}>
                  <div>
                    <div style={{fontWeight:700}}>Objectifs nutritionnels</div>
                    {liveNut&&<div style={{fontSize:10,color:G.gold,marginTop:3}}>● Aperçu en temps réel</div>}
                  </div>
                  <BtnSm variant={editNut?"ghost":"gold"} onClick={()=>{setNutForm({...cur.nutrition});setEditNut(!editNut);}}>{editNut?"Annuler":"Notes"}</BtnSm>
                </div>
                {editNut&&(
                  <>
                    <Txa label="Notes / Allergies / Préférences" value={nutForm.notes||""} placeholder="Allergies, préférences..." onChange={e=>setNutForm(p=>({...p,notes:e.target.value}))}/>
                    <Btn onClick={saveNut} style={{width:"100%",marginTop:4}}>Enregistrer les notes</Btn>
                  </>
                )}
                <div style={{textAlign:"center",padding:"12px 0 20px"}}>
                  <div style={{fontFamily:G.fontD,fontSize:52,fontWeight:800,color:G.goldLight,lineHeight:1,transition:"all .3s"}}>{cal}</div>
                  <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:4}}>kcal / jour</div>
                </div>
                <MacroBar label="Protéines" value={prot} max={300} color={G.goldLight}/>
                <MacroBar label="Glucides" value={gluc} max={500} color={G.gold}/>
                <MacroBar label="Lipides" value={lip} max={150} color="#C9A84C66"/>
                {cur.nutrition?.notes&&<div style={{marginTop:14,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {cur.nutrition.notes}</div>}
              </div>
              <div style={{background:G.bg2,borderRadius:12,padding:20,border:`1px solid ${G.border}`}}>
                <MealPlanEditor
                  foods={foods}
                  mealPlan={cur.mealPlan}
                  onLiveChange={setLiveNut}
                  onSave={(mp,totals)=>{
                    setLiveNut(null);
                    upd(c=>({...c,mealPlan:mp,...(totals.kcal>0?{nutrition:{...c.nutrition,calories:rnd(totals.kcal),proteins:rnd1(totals.protein),carbs:rnd1(totals.carbs),fats:rnd1(totals.fat)}}:{})}));
                  }}/>
              </div>
            </>
          );
        })()}
        {tab==="suivi"&&(
          <>
            <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:14}}>
              {cur.sessionLogs?.length||0} séance{cur.sessionLogs?.length!==1?"s":""} enregistrée{cur.sessionLogs?.length!==1?"s":""}
            </div>
            {(!cur.sessionLogs||cur.sessionLogs.length===0)&&<Empty text="Aucune séance enregistrée" icon="◎"/>}
            {cur.sessionLogs?.map(log=>{
              const prog=programs.find(p=>p.id===log.programId);
              return(
                <div key={log.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${log.completed?G.green+"44":G.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13}}>{log.dayLabel||"Séance"}</div>
                      <div style={{fontSize:11,color:G.grey,marginTop:3}}>{log.date} · {prog?.name||"Programme"}</div>
                      {log.notes&&<div style={{fontSize:12,color:G.grey,marginTop:4,fontStyle:"italic"}}>"{log.notes}"</div>}
                    </div>
                    {log.completed&&<span style={{color:G.green,fontSize:11,fontWeight:700,background:G.green+"15",border:`1px solid ${G.green}33`,borderRadius:4,padding:"2px 8px"}}>✓ Complétée</span>}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {log.exercises?.slice(0,5).map((ex,ei)=>(
                      <div key={ei} style={{background:G.bg3,borderRadius:6,padding:"4px 10px",fontSize:11,color:G.grey,border:`1px solid ${G.border}`}}>
                        {ex.name}{ex.sensation?` ${ex.sensation}`:""}
                      </div>
                    ))}
                    {(log.exercises?.length||0)>5&&<div style={{background:G.bg3,borderRadius:6,padding:"4px 10px",fontSize:11,color:G.greyDim}}>+{log.exercises.length-5}</div>}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── FOODS MANAGER ────────────────────────────────────────────────────────────
const EMPTY_FOOD=()=>({id:"",name:"",unit:"g",kcal:0,protein:0,carbs:0,fat:0});
function FoodsManager({foods,setFoods}){
  const [editing,setEditing]=useState(null);
  const [form,setForm]=useState(EMPTY_FOOD());
  const [search,setSearch]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);

  const openNew=()=>{setForm(EMPTY_FOOD());setEditing("new");};
  const openEdit=f=>{setForm({...f});setEditing(f);};
  const f=k=>v=>setForm(p=>({...p,[k]:v}));

  const save=()=>{
    const entry={
      ...form,
      id:editing==="new"?(form.name.toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,30)+"_"+Date.now()):form.id,
      kcal:parseFloat(form.kcal)||0,
      protein:parseFloat(form.protein)||0,
      carbs:parseFloat(form.carbs)||0,
      fat:parseFloat(form.fat)||0,
    };
    if(!entry.name.trim())return;
    if(editing==="new") setFoods(p=>[...p,entry]);
    else setFoods(p=>p.map(x=>x.id===entry.id?entry:x));
    setEditing(null);
  };
  const del=id=>{setFoods(p=>p.filter(x=>x.id!==id));setConfirmDel(null);};

  const filtered=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"20px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.5}}>ALIMENTS</div>
        <Btn onClick={openNew} style={{padding:"8px 18px"}}>+ Ajouter un aliment</Btn>
      </div>
      <div style={{padding:"16px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un aliment..."
          style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:14,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border}/>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:10}}>
          {filtered.map(food=>(
            <div key={food.id} style={{background:G.bg2,borderRadius:12,padding:"14px 16px",border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,fontSize:14,color:G.white,marginBottom:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{food.name}</div>
                <div style={{fontSize:12,color:G.grey}}>
                  {food.kcal} kcal · P {food.protein}g · G {food.carbs}g · L {food.fat}g
                  <span style={{color:G.gold,marginLeft:8}}>/ {food.unit==="g"?"100g":"portion"}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0}}>
                <BtnSm onClick={()=>openEdit(food)}>✏️</BtnSm>
                <BtnSm variant="ghost" onClick={()=>setConfirmDel(food.id)} style={{color:G.red,borderColor:G.red+"44"}}>🗑</BtnSm>
              </div>
            </div>
          ))}
        </div>
        {filtered.length===0&&<div style={{textAlign:"center",color:G.greyDim,padding:"48px 0",fontSize:14}}>Aucun aliment trouvé</div>}
      </div>

      {editing&&(
        <Modal onClose={()=>setEditing(null)} title={editing==="new"?"Nouvel aliment":"Modifier l'aliment"}>
          <Inp label="Nom de l'aliment" value={form.name} onChange={e=>f("name")(e.target.value)} placeholder="Ex: Riz basmati cuit"/>
          <div style={{marginBottom:14}}>
            <Label>Type de mesure</Label>
            <div style={{display:"flex",gap:8}}>
              {[["g","Par 100g"],["portion","Par portion"]].map(([val,label])=>(
                <button key={val} onClick={()=>f("unit")(val)}
                  style={{flex:1,padding:"10px 0",borderRadius:8,border:`1px solid ${form.unit===val?G.gold:G.border}`,background:form.unit===val?G.gold+"22":"transparent",color:form.unit===val?G.goldLight:G.grey,fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label={`Calories (kcal/${form.unit==="g"?"100g":"portion"})`} type="number" value={form.kcal} onChange={e=>f("kcal")(e.target.value)}/>
            <Inp label={`Protéines (g)`} type="number" value={form.protein} onChange={e=>f("protein")(e.target.value)}/>
            <Inp label={`Glucides (g)`} type="number" value={form.carbs} onChange={e=>f("carbs")(e.target.value)}/>
            <Inp label={`Lipides (g)`} type="number" value={form.fat} onChange={e=>f("fat")(e.target.value)}/>
          </div>
          {form.name.trim()&&(
            <div style={{marginBottom:14,padding:12,background:G.bg3,borderRadius:8,fontSize:12,color:G.grey}}>
              Aperçu : <span style={{color:G.goldLight,fontWeight:700}}>{form.kcal} kcal</span> · P {form.protein}g · G {form.carbs}g · L {form.fat}g / {form.unit==="g"?"100g":"portion"}
            </div>
          )}
          <Btn onClick={save} style={{width:"100%"}}>{editing==="new"?"Ajouter l'aliment":"Enregistrer les modifications"}</Btn>
        </Modal>
      )}

      {confirmDel&&(
        <Modal onClose={()=>setConfirmDel(null)} title="Supprimer l'aliment">
          <div style={{color:G.grey,fontSize:14,marginBottom:20}}>
            Supprimer <strong style={{color:G.white}}>{foods.find(f=>f.id===confirmDel)?.name}</strong> ?
            <br/><span style={{fontSize:12}}>Les plans alimentaires utilisant cet aliment ne s'afficheront plus correctement.</span>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>del(confirmDel)} style={{background:G.red+"22",borderColor:G.red,color:G.red,flex:1}}>Supprimer</Btn>
            <BtnSm onClick={()=>setConfirmDel(null)}>Annuler</BtnSm>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({clients,setClients,programs,setPrograms,onViewProgram,initialClient,foods=FOODS_DB}){
  const [sel,setSel]=useState(initialClient||null);
  const [showNew,setShowNew]=useState(false);
  const [search,setSearch]=useState("");
  const [newForm,setNewForm]=useState({name:"",goal:"",calories:2000,proteins:150,carbs:220,fats:70,notes:""});

  useEffect(()=>{ if(initialClient) setSel(initialClient); },[initialClient?.id]); // eslint-disable-line

  const filtered=clients.filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||c.goal.toLowerCase().includes(search.toLowerCase()));
  const selClient=sel?(clients.find(c=>c.id===sel.id)||sel):null;

  const createClient=()=>{
    if(!newForm.name)return;
    const nc={id:Date.now(),name:newForm.name,code:genCode(newForm.name),goal:newForm.goal||"Objectif à définir",
      since:new Date().toLocaleDateString("fr-FR",{month:"short",year:"numeric"}),sessions:0,
      color:["#E8C547","#C9A84C","#52C07A","#5285C0","#C05252","#9B59B6"][clients.length%6],
      programs:[],sessionLogs:[],
      nutrition:{calories:newForm.calories,proteins:newForm.proteins,carbs:newForm.carbs,fats:newForm.fats,notes:newForm.notes}};
    setClients(p=>[...p,nc]);
    setSel(nc);
    setShowNew(false);
    setNewForm({name:"",goal:"",calories:2000,proteins:150,carbs:220,fats:70,notes:""});
  };
  const deleteClient=id=>{setClients(p=>p.filter(c=>c.id!==id));setSel(null);};

  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      {/* Left list */}
      <div style={{width:290,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 14px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,letterSpacing:-.5}}>CLIENTS <span style={{fontSize:13,color:G.grey,fontFamily:G.font,fontWeight:400}}>({clients.length})</span></div>
            <BtnSm onClick={()=>setShowNew(true)}>+ Nouveau</BtnSm>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px",color:G.white,fontSize:13,outline:"none"}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 8px"}}>
          {filtered.length===0&&<Empty text="Aucun client" icon="◉"/>}
          {filtered.map(c=>(
            <div key={c.id} onClick={()=>setSel(c)}
              style={{borderRadius:10,padding:"11px 12px",marginBottom:4,border:`1px solid ${selClient?.id===c.id?G.gold+"44":G.border}`,borderLeft:`3px solid ${c.color}`,background:selClient?.id===c.id?G.gold+"0a":G.bg2,cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"background .1s"}}
              onMouseEnter={e=>{if(selClient?.id!==c.id)e.currentTarget.style.background=G.bg3;}}
              onMouseLeave={e=>{if(selClient?.id!==c.id)e.currentTarget.style.background=G.bg2;}}>
              <Av name={c.name} color={c.color} size={32}/>
              <div style={{flex:1,overflow:"hidden"}}>
                <div style={{fontWeight:700,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                <div style={{fontSize:11,color:G.grey,marginTop:1}}>{c.sessions} séances</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Right detail */}
      <div style={{flex:1,overflow:"hidden",background:G.bg}}>
        {selClient?(
          <ClientDetailPanel key={selClient.id} client={selClient} clients={clients} setClients={setClients}
            programs={programs} setPrograms={setPrograms} onViewProgram={onViewProgram} onDelete={deleteClient} foods={foods}/>
        ):(
          <Empty text="Sélectionne un client pour voir son profil" icon="◉"/>
        )}
      </div>
      {/* New client modal */}
      {showNew&&(
        <Modal onClose={()=>setShowNew(false)} title="Nouveau client">
          <Inp label="Nom complet" placeholder="Marie Dupont" value={newForm.name} onChange={e=>setNewForm(p=>({...p,name:e.target.value}))}/>
          <Inp label="Objectif" placeholder="Perte de poids, prise de masse..." value={newForm.goal} onChange={e=>setNewForm(p=>({...p,goal:e.target.value}))}/>
          <div style={{fontSize:12,color:G.grey,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",margin:"4px 0 12px"}}>Nutrition de départ</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {[["Calories (kcal)","calories"],["Protéines (g)","proteins"],["Glucides (g)","carbs"],["Lipides (g)","fats"]].map(([l,k])=>(
              <Inp key={k} label={l} type="number" value={newForm[k]} onChange={e=>setNewForm(p=>({...p,[k]:Number(e.target.value)}))}/>
            ))}
          </div>
          <Txa label="Notes nutrition" placeholder="Allergies, préférences..." value={newForm.notes} onChange={e=>setNewForm(p=>({...p,notes:e.target.value}))}/>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn variant="ghost" onClick={()=>setShowNew(false)} style={{flex:1}}>Annuler</Btn>
            <Btn onClick={createClient} disabled={!newForm.name} style={{flex:2}}>Créer le client</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PROGRAM DETAIL (desktop) ─────────────────────────────────────────────────
function ProgramDetailView({program,programs,exercises,onEdit,client,onBack}){
  const [weekIdx,setWeekIdx]=useState(0);
  const [dayIdx,setDayIdx]=useState(0);
  const [playing,setPlaying]=useState(null);
  const cur=programs.find(p=>p.id===program.id)||program;
  const week=cur.weeks[weekIdx];
  const day=week?.days[dayIdx];
  const dayLog=client?.sessionLogs?.find(l=>l.programId===cur.id&&l.weekIdx===weekIdx&&l.dayIdx===dayIdx&&l.completed);
  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"20px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            {onBack&&<button onClick={onBack} style={{background:"none",border:"none",color:G.gold,cursor:"pointer",fontSize:12,fontWeight:600,padding:"0 0 8px",display:"flex",alignItems:"center",gap:5}}>← {client?client.name.split(" ")[0]:"Retour"}</button>}
            <div style={{fontFamily:G.fontD,fontSize:26,fontWeight:800,letterSpacing:-.5}}>{cur.name}</div>
            <div style={{display:"flex",gap:6,marginTop:6}}>
              {[cur.category,cur.level,`${cur.weeks.length} semaine${cur.weeks.length>1?"s":""}`].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}
              {client&&<Tag text={`Séances: ${client.sessions}`} color={G.green}/>}
            </div>
          </div>
          {onEdit&&<BtnSm onClick={()=>onEdit(cur)}>✏️ Modifier</BtnSm>}
        </div>
      </div>
      <div style={{padding:"12px 24px 0",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10}}>
          {cur.weeks.map((w,i)=>(
            <button key={i} onClick={()=>{setWeekIdx(i);setDayIdx(0);setPlaying(null);}}
              style={{flexShrink:0,padding:"7px 14px",background:weekIdx===i?G.goldLight+"22":G.bg3,color:weekIdx===i?G.goldLight:G.grey,border:`1px solid ${weekIdx===i?G.goldLight+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {w.label}
            </button>
          ))}
        </div>
        {week&&(
          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10}}>
            {week.days.map((d,i)=>{
              const done=client?.sessionLogs?.some(l=>l.programId===cur.id&&l.weekIdx===weekIdx&&l.dayIdx===i&&l.completed);
              return(
                <button key={i} onClick={()=>{setDayIdx(i);setPlaying(null);}}
                  style={{flexShrink:0,padding:"6px 14px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:done?G.green:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":done?G.green+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {done&&<span style={{marginRight:4}}>✓</span>}{d.label} <span style={{fontSize:10,opacity:.5}}>({d.exercises.length})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        {dayLog&&(
          <div style={{background:G.green+"15",border:`1px solid ${G.green}44`,borderRadius:10,padding:"10px 14px",marginBottom:18,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>✓</span>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:G.green}}>Séance complétée</div>
              <div style={{fontSize:11,color:G.grey,marginTop:2}}>{dayLog.date}{dayLog.notes?` · "${dayLog.notes}"`:""}</div>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {day?.exercises.map((pe,i)=>{
            const ex=exercises.find(e=>e.id===pe.exId);
            if(!ex)return null;
            const key=`${weekIdx}-${dayIdx}-${i}`;
            const clientEx=dayLog?.exercises?.find(e=>e.exId===pe.exId);
            return(
              <div key={i} style={{background:G.bg2,borderRadius:12,padding:16,border:`1px solid ${clientEx?G.green+"44":G.border}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:14}}><span style={{color:G.gold,fontFamily:G.fontD,marginRight:6}}>{i+1}.</span>{ex.name}</div>
                    <div style={{fontSize:12,color:G.grey,marginTop:4}}>{pe.sets} séries × {pe.reps} — repos {pe.rest}</div>
                    {pe.targetLoad&&(()=>{
                      const comp=computeLoad(pe,client?.tests);
                      return(
                        <div style={{fontSize:12,color:G.goldLight,marginTop:3}}>
                          🎯{" "}
                          {comp
                            ?<><span style={{color:G.white,fontWeight:700}}>{comp.value} {comp.unit}</span><span style={{color:G.grey,marginLeft:5}}>({comp.pct}% — {comp.label.replace("% ","")})</span></>
                            :<span>{pe.targetLoad}{pe.loadRef&&pe.loadRef!=="none"&&<span style={{color:G.grey,marginLeft:4}}>— {LOAD_REFS.find(r=>r.id===pe.loadRef)?.label}</span>}</span>
                          }
                        </div>
                      );
                    })()}
                    {(pe.note||ex.notes)&&<div style={{fontSize:11,color:G.gold+"88",marginTop:4}}>📝 {pe.note||ex.notes}</div>}
                    <div style={{marginTop:6}}><Tag text={ex.muscle} color={G.grey}/></div>
                  </div>
                  {ex.videoUrl&&<BtnSm variant="ghost" onClick={()=>setPlaying(playing===key?null:key)}>{playing===key?"▼":"▶"}</BtnSm>}
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
                      {clientEx.sensation&&<span style={{fontSize:18}}>{clientEx.sensation}</span>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {clientEx.sets.map((s,si)=>(
                        <div key={si} style={{background:G.bg4,borderRadius:6,padding:"5px 10px",border:`1px solid ${G.border}`,textAlign:"center",minWidth:54}}>
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
        {(!day||day.exercises.length===0)&&<Empty text="Aucun exercice dans cette séance" icon="▦"/>}
      </div>
    </div>
  );
}

// ─── PROGRAM FORM (new / edit) ────────────────────────────────────────────────
function ProgramForm({init,exercises,onSave,onCancel,title}){
  const [form,setForm]=useState(init);
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
  const toggleEx=ex=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.find(e=>e.exId===ex.id)?d.exercises.filter(e=>e.exId!==ex.id):[...d.exercises,{exId:ex.id,sets:3,reps:"10",rest:"60s",targetLoad:"",loadRef:"none",note:""}]})})}));};
  const updateExField=(exId,field,val)=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.map(e=>e.exId===exId?{...e,[field]:val}:e)})})}));};
  const moveEx=(from,to)=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:(()=>{const a=[...d.exercises];const[item]=a.splice(from,1);a.splice(to,0,item);return a;})()})})}));};
  const totalEx=form.weeks.reduce((a,w)=>a+w.days.reduce((b,d)=>b+d.exercises.length,0),0);
  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{padding:"20px 24px",borderBottom:`1px solid ${G.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.5}}>{title}</div>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="ghost" onClick={onCancel} style={{padding:"8px 16px"}}>Annuler</Btn>
          <Btn onClick={()=>onSave(form)} disabled={!form.name||totalEx===0} style={{padding:"8px 20px"}}>✓ Enregistrer</Btn>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14,marginBottom:8}}>
          <Inp label="Nom du programme" placeholder="Full Body 3j/sem" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/>
          <Inp label="Catégorie" placeholder="Force, PPL..." value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}/>
          <div style={{marginBottom:14}}>
            <Label>Niveau</Label>
            <select value={form.level} onChange={e=>setForm(p=>({...p,level:e.target.value}))}
              style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:13,outline:"none"}}>
              {["Débutant","Intermédiaire","Avancé","Tous niveaux"].map(l=><option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        {/* Week tabs */}
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:16,alignItems:"center"}}>
          {form.weeks.map((w,i)=>(
            <button key={i} onClick={()=>{setWeekIdx(i);setDayIdx(0);}}
              style={{flexShrink:0,padding:"7px 14px",background:weekIdx===i?G.goldLight+"22":G.bg3,color:weekIdx===i?G.goldLight:G.grey,border:`1px solid ${weekIdx===i?G.goldLight+"55":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
              S{i+1} <span style={{fontSize:10,opacity:.6}}>({w.days.reduce((a,d)=>a+d.exercises.length,0)})</span>
            </button>
          ))}
          {form.weeks.length<12&&<BtnSm variant="ghost" onClick={addWeek}>+ Semaine</BtnSm>}
        </div>
        {/* Week editor */}
        <div style={{background:G.bg2,borderRadius:14,padding:20,border:`1px solid ${G.border}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <input value={week?.label||""} onChange={e=>updateLabel("week",weekIdx,e.target.value)}
              style={{background:"transparent",border:"none",color:G.goldLight,fontSize:16,fontWeight:800,outline:"none",fontFamily:G.fontD,letterSpacing:.5,flex:1}}/>
            <div style={{display:"flex",gap:8}}>
              {form.weeks.length>1&&<BtnSm variant="danger" onClick={()=>removeWeek(weekIdx)}>✕ Supprimer</BtnSm>}
              {form.weeks.length<12&&<BtnSm variant="ghost" onClick={duplicateWeek}>⧉ Dupliquer</BtnSm>}
              {week&&week.days.length<7&&<BtnSm onClick={addDay}>+ Jour</BtnSm>}
            </div>
          </div>
          {week&&(
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {week.days.map((d,i)=>(
                <button key={i} onClick={()=>setDayIdx(i)}
                  style={{padding:"6px 14px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {d.label} <span style={{fontSize:10,opacity:.6}}>({d.exercises.length})</span>
                </button>
              ))}
            </div>
          )}
          {day&&(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <input value={day.label} onChange={e=>updateLabel("day",dayIdx,e.target.value)}
                  style={{background:"transparent",border:"none",color:G.white,fontSize:14,fontWeight:700,outline:"none",flex:1}}/>
                <div style={{display:"flex",gap:8}}>
                  {week.days.length>1&&<BtnSm variant="danger" onClick={()=>removeDay(dayIdx)}>✕</BtnSm>}
                  <BtnSm onClick={()=>{setFilter("Tous");setPicker(true);}}>+ Exercices</BtnSm>
                </div>
              </div>
              {day.exercises.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:G.greyDim,fontSize:13}}>Aucun exercice — cliquer sur "+ Exercices"</div>}
              {day.exercises.map((pe,i)=>{
                const ex=exercises.find(e=>e.id===pe.exId);
                return(
                  <div key={pe.exId} style={{background:G.bg3,borderRadius:10,padding:14,marginBottom:8,border:`1px solid ${G.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{fontWeight:700,fontSize:13}}>{i+1}. {ex?.name}</div>
                      <div style={{display:"flex",gap:4}}>
                        {i>0&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i-1)}>▲</BtnSm>}
                        {i<day.exercises.length-1&&<BtnSm variant="ghost" onClick={()=>moveEx(i,i+1)}>▼</BtnSm>}
                        <BtnSm variant="danger" onClick={()=>toggleEx(ex)}>✕</BtnSm>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:8}}>
                      {[["Séries","sets","number"],["Reps","reps","text"],["Repos","rest","text"],["Charge (valeur)","targetLoad","text"]].map(([l,k,t])=>(
                        <div key={k}>
                          <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                          <input type={t} value={pe[k]} placeholder={k==="targetLoad"?"%  ou texte libre":""}
                            onChange={e=>updateExField(pe.exId,k,t==="number"?Number(e.target.value):e.target.value)}
                            style={{width:"100%",background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"6px 8px",color:G.white,fontSize:12,outline:"none"}}/>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>Référence (pour calcul auto)</div>
                      <select value={pe.loadRef||"none"} onChange={e=>updateExField(pe.exId,"loadRef",e.target.value)}
                        style={{width:"100%",background:G.bg4,border:`1px solid ${pe.loadRef&&pe.loadRef!=="none"?G.gold+"66":G.border}`,borderRadius:6,padding:"6px 8px",color:pe.loadRef&&pe.loadRef!=="none"?G.goldLight:G.grey,fontSize:12,outline:"none",cursor:"pointer"}}>
                        {LOAD_REFS.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    <div style={{marginTop:8}}>
                      <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>Note de séance</div>
                      <textarea value={pe.note||""} onChange={e=>updateExField(pe.exId,"note",e.target.value)}
                        placeholder="Instructions, coaching cues, consignes..."
                        rows={2}
                        style={{width:"100%",background:G.bg4,border:`1px solid ${pe.note?G.gold+"44":G.border}`,borderRadius:6,padding:"6px 8px",color:G.white,fontSize:12,outline:"none",resize:"vertical",fontFamily:G.font,lineHeight:1.4}}/>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
      {picker&&(
        <Modal onClose={()=>setPicker(false)} title={`Exercices — ${day?.label||""}`} width={560}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {MUSCLES.map(m=>(
              <button key={m} onClick={()=>setFilter(m)}
                style={{padding:"5px 12px",background:filter===m?G.goldLight+"22":G.bg3,color:filter===m?G.goldLight:G.grey,border:`1px solid ${filter===m?G.goldLight+"44":G.border}`,borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer"}}>
                {m}
              </button>
            ))}
          </div>
          <div style={{maxHeight:420,overflowY:"auto"}}>
            {filtered.map(ex=>{
              const sel2=!!day?.exercises.find(e=>e.exId===ex.id);
              return(
                <div key={ex.id} onClick={()=>toggleEx(ex)}
                  style={{background:sel2?G.goldLight+"0d":G.bg3,borderRadius:10,padding:"10px 14px",marginBottom:8,border:`1px solid ${sel2?G.goldLight+"55":G.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13}}>{ex.name}</div>
                    <div style={{fontSize:11,color:G.grey,marginTop:2}}>{ex.muscle} · {ex.equipment}</div>
                  </div>
                  <div style={{width:20,height:20,borderRadius:5,border:`1.5px solid ${sel2?G.goldLight:G.greyDim}`,background:sel2?G.goldLight:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:G.bg,fontSize:12,fontWeight:800}}>{sel2?"✓":""}</div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PROGRAMS VIEW ────────────────────────────────────────────────────────────
function ProgramsView({programs,setPrograms,exercises,initialProgram}){
  const [sel,setSel]=useState(initialProgram||null);
  const [subView,setSubView]=useState(initialProgram?"detail":"empty");
  const [search,setSearch]=useState("");

  useEffect(()=>{
    if(initialProgram){setSel(initialProgram);setSubView("detail");}
  },[initialProgram?.id]); // eslint-disable-line

  const filtered=programs.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||p.category?.toLowerCase().includes(search.toLowerCase()));
  const cur=sel?(programs.find(p=>p.id===sel.id)||sel):null;

  const deleteProgram=pid=>{
    if(confirm("Supprimer ce programme ?"))setPrograms(p=>p.filter(x=>x.id!==pid));
    if(sel?.id===pid){setSel(null);setSubView("empty");}
  };
  return(
    <div style={{display:"flex",height:"100%",overflow:"hidden"}}>
      <div style={{width:290,borderRight:`1px solid ${G.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 14px",borderBottom:`1px solid ${G.border}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,letterSpacing:-.5}}>PROGRAMMES <span style={{fontSize:13,color:G.grey,fontFamily:G.font,fontWeight:400}}>({programs.length})</span></div>
            <BtnSm onClick={()=>{setSel(null);setSubView("new");}}>+ Nouveau</BtnSm>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
            style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px",color:G.white,fontSize:13,outline:"none"}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"6px 8px"}}>
          {filtered.length===0&&<Empty text="Aucun programme" icon="▦"/>}
          {filtered.map(p=>(
            <div key={p.id} onClick={()=>{setSel(p);setSubView("detail");}}
              style={{borderRadius:10,padding:"11px 12px",marginBottom:4,border:`1px solid ${cur?.id===p.id?G.gold+"44":G.border}`,background:cur?.id===p.id?G.gold+"0a":G.bg2,cursor:"pointer",transition:"background .1s"}}
              onMouseEnter={e=>{if(cur?.id!==p.id)e.currentTarget.style.background=G.bg3;}}
              onMouseLeave={e=>{if(cur?.id!==p.id)e.currentTarget.style.background=G.bg2;}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{[p.category,p.level].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}</div>
                </div>
                <div style={{display:"flex",gap:4,marginLeft:6,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                  <BtnSm variant="ghost" onClick={()=>{setSel(p);setSubView("edit");}}>✏️</BtnSm>
                  <BtnSm variant="danger" onClick={()=>deleteProgram(p.id)}>✕</BtnSm>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflow:"hidden",background:G.bg}}>
        {subView==="new"&&(
          <ProgramForm title="Nouveau programme"
            init={{name:"",category:"",level:"Intermédiaire",weeks:[{label:"Semaine 1",days:[{label:"Séance A",exercises:[]}]}]}}
            exercises={exercises}
            onSave={form=>{const np={...form,id:Date.now()};setPrograms(p=>[...p,np]);setSel(np);setSubView("detail");}}
            onCancel={()=>setSubView("empty")}/>
        )}
        {subView==="edit"&&cur&&(
          <ProgramForm title="Modifier le programme"
            init={JSON.parse(JSON.stringify(cur))}
            exercises={exercises}
            onSave={form=>{setPrograms(p=>p.map(x=>x.id===form.id?form:x));setSel(form);setSubView("detail");}}
            onCancel={()=>setSubView("detail")}/>
        )}
        {subView==="detail"&&cur&&(
          <ProgramDetailView program={cur} programs={programs} exercises={exercises}
            onEdit={p=>{setSel(p);setSubView("edit");}} client={null}/>
        )}
        {(subView==="empty"||(!cur&&subView!=="new"))&&(
          <Empty text="Sélectionne ou crée un programme" icon="▦"/>
        )}
      </div>
    </div>
  );
}

// ─── EXERCISES VIEW ───────────────────────────────────────────────────────────
function ExercisesView({exercises,setExercises}){
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("Tous");
  const [showNew,setShowNew]=useState(false);
  const [playing,setPlaying]=useState(null);
  const [newForm,setNewForm]=useState({name:"",muscle:"Jambes",equipment:"Barre",videoUrl:"",notes:""});

  const filtered=exercises.filter(e=>{
    const mok=filter==="Tous"||e.muscle===filter;
    const sok=!search||e.name.toLowerCase().includes(search.toLowerCase())||e.muscle.toLowerCase().includes(search.toLowerCase());
    return mok&&sok;
  });
  const createEx=()=>{
    if(!newForm.name)return;
    setExercises(p=>[...p,{...newForm,id:Date.now()}]);
    setShowNew(false);
    setNewForm({name:"",muscle:"Jambes",equipment:"Barre",videoUrl:"",notes:""});
  };
  const deleteEx=id=>{if(confirm("Supprimer cet exercice ?"))setExercises(p=>p.filter(e=>e.id!==id));};

  return(
    <div style={{padding:28,height:"100%",overflowY:"auto"}} className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,letterSpacing:-.5}}>EXERCICES</div>
          <div style={{fontSize:12,color:G.grey,marginTop:3}}>{filtered.length} sur {exercises.length}</div>
        </div>
        <BtnSm onClick={()=>setShowNew(true)}>+ Nouvel exercice</BtnSm>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..."
          style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"7px 14px",color:G.white,fontSize:13,outline:"none",width:240}}/>
        {MUSCLES.map(m=>(
          <button key={m} onClick={()=>setFilter(m)}
            style={{padding:"6px 14px",background:filter===m?G.goldLight+"22":G.bg2,color:filter===m?G.goldLight:G.grey,border:`1px solid ${filter===m?G.goldLight+"44":G.border}`,borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {m}
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {filtered.map(ex=>(
          <div key={ex.id} style={{background:G.bg2,borderRadius:12,padding:16,border:`1px solid ${G.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>{ex.name}</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}><Tag text={ex.muscle} color={G.grey}/><Tag text={ex.equipment} color={G.greyDim}/></div>
              </div>
              <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
                {ex.videoUrl&&<BtnSm variant="ghost" onClick={()=>setPlaying(playing===ex.id?null:ex.id)}>{playing===ex.id?"▼":"▶"}</BtnSm>}
                <BtnSm variant="danger" onClick={()=>deleteEx(ex.id)}>✕</BtnSm>
              </div>
            </div>
            {ex.notes&&<div style={{fontSize:12,color:G.grey,fontStyle:"italic",marginTop:6}}>📝 {ex.notes}</div>}
            {playing===ex.id&&ex.videoUrl&&(
              <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:8,overflow:"hidden",background:"#000",marginTop:10}}>
                <iframe style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={ex.videoUrl} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
              </div>
            )}
          </div>
        ))}
      </div>
      {showNew&&(
        <Modal onClose={()=>setShowNew(false)} title="Nouvel exercice">
          <Inp label="Nom" placeholder="Squat Barre" value={newForm.name} onChange={e=>setNewForm(p=>({...p,name:e.target.value}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{marginBottom:14}}>
              <Label>Muscle</Label>
              <select value={newForm.muscle} onChange={e=>setNewForm(p=>({...p,muscle:e.target.value}))}
                style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:13,outline:"none"}}>
                {MUSCLES.filter(m=>m!=="Tous").map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}>
              <Label>Équipement</Label>
              <select value={newForm.equipment} onChange={e=>setNewForm(p=>({...p,equipment:e.target.value}))}
                style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",color:G.white,fontSize:13,outline:"none"}}>
                {EQUIPS.map(eq=><option key={eq}>{eq}</option>)}
              </select>
            </div>
          </div>
          <Inp label="URL vidéo YouTube (embed)" placeholder="https://www.youtube.com/embed/..." value={newForm.videoUrl} onChange={e=>setNewForm(p=>({...p,videoUrl:e.target.value}))}/>
          <Txa label="Notes / conseils" placeholder="Conseils de technique..." value={newForm.notes} onChange={e=>setNewForm(p=>({...p,notes:e.target.value}))}/>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn variant="ghost" onClick={()=>setShowNew(false)} style={{flex:1}}>Annuler</Btn>
            <Btn onClick={createEx} disabled={!newForm.name} style={{flex:2}}>Créer l'exercice</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function CoachApp(){
  const [auth,setAuth]=useState(()=>sessionStorage.getItem("wandy_coach_auth")||"login");
  const [view,setView]=useState("dashboard");
  const [exercises,setExercises,exReady]=useFirestoreCollection("exercises",SEED_EX);
  const [programs,setPrograms,pgReady]=useFirestoreCollection("programs",SEED_PROGRAMS);
  const [clients,setClients,clReady]=useFirestoreCollection("clients",SEED_CLIENTS);
  const [foods,setFoods,foodsReady]=useFirestoreCollection("foods",FOODS_DB);
  const dbReady=exReady&&pgReady&&clReady&&foodsReady;

  // Cross-view navigation state
  const [dashClient,setDashClient]=useState(null);
  const [dashProgram,setDashProgram]=useState(null);
  const [programFromClient,setProgramFromClient]=useState(null); // {program, client}
  const navigateToClient=c=>{setDashClient(c);setView("clients");};
  const navigateToProgram=p=>{setDashProgram(p);setView("programs");};
  const viewProgramFromClient=(p,c)=>{setProgramFromClient({program:p,client:c});setView("program-from-client");};

  const changeView=v=>{
    setView(v);
    if(v!=="clients")setDashClient(null);
    if(v!=="programs")setDashProgram(null);
    if(v!=="program-from-client")setProgramFromClient(null);
  };

  if(!dbReady)return(
    <div style={{minHeight:"100vh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,color:G.goldLight}}>WANDY COACH</div>
      <div style={{fontSize:13,color:G.grey}}>Connexion à la base de données…</div>
      <div style={{width:36,height:36,border:`3px solid ${G.border}`,borderTop:`3px solid ${G.goldLight}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
    </div>
  );

  if(auth==="login")return(
    <CoachLogin onLogin={code=>{if(code===COACH_CODE){sessionStorage.setItem("wandy_coach_auth","coach");setAuth("coach");return true;}return false;}}/>
  );

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      <Sidebar
        view={view}
        setView={changeView}
        onLogout={()=>{sessionStorage.removeItem("wandy_coach_auth");setAuth("login");setView("dashboard");}}
        counts={{clients:clients.length,programs:programs.length,exercises:exercises.length,foods:foods.length}}/>
      <main style={{flex:1,height:"100vh",overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {view==="dashboard"&&(
          <div style={{flex:1,overflowY:"auto"}}>
            <Dashboard clients={clients} programs={programs} exercises={exercises}
              onSelClient={navigateToClient} onSelProgram={navigateToProgram}/>
          </div>
        )}
        {view==="clients"&&(
          <div style={{flex:1,overflow:"hidden"}}>
            <ClientsView clients={clients} setClients={setClients} programs={programs} setPrograms={setPrograms}
              onViewProgram={viewProgramFromClient} initialClient={dashClient} foods={foods}/>
          </div>
        )}
        {view==="foods"&&(
          <div style={{flex:1,overflow:"hidden"}}>
            <FoodsManager foods={foods} setFoods={setFoods}/>
          </div>
        )}
        {view==="programs"&&(
          <div style={{flex:1,overflow:"hidden"}}>
            <ProgramsView programs={programs} setPrograms={setPrograms} exercises={exercises} initialProgram={dashProgram}/>
          </div>
        )}
        {view==="program-from-client"&&programFromClient&&(
          <div style={{flex:1,overflow:"hidden"}}>
            <ProgramDetailView
              program={programFromClient.program}
              programs={programs}
              exercises={exercises}
              client={clients.find(c=>c.id===programFromClient.client.id)||programFromClient.client}
              onEdit={p=>{setDashProgram(p);changeView("programs");}}
              onBack={()=>{setProgramFromClient(null);setView("clients");}}/>
          </div>
        )}
        {view==="exercises"&&(
          <div style={{flex:1,overflow:"hidden"}}>
            <ExercisesView exercises={exercises} setExercises={setExercises}/>
          </div>
        )}
      </main>
    </div>
  );
}