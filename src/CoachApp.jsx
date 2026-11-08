import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, auth, onAuthStateChanged, signOut, isCoachUser, loginWithCode, API_BASE } from "./firebase.js";
import { estimateSecPerRep, customSecPerRep, secPerRepOf, sessionBreakdown, fmtMinutes, isTextBlock, isChained, textMinutes } from "./sessionTime.js";

// ─── THEME ────────────────────────────────────────────────────────────────────
const G = {
  bg:"#080808",bg2:"#0f0f0f",bg3:"#161616",bg4:"#1c1c1c",
  gold:"#C9A84C",goldLight:"#E8C547",
  white:"#F5F0E8",grey:"#888888",greyDim:"#444444",border:"#2a2a2a",
  red:"#E05252",green:"#52C07A",
  font:"'Barlow',sans-serif",fontD:"'Barlow Condensed',sans-serif",
};
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{background:${G.bg};color:${G.white};font-family:${G.font};-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;}
  input,textarea,select,button{font-family:${G.font};}
  input::placeholder,textarea::placeholder{color:#5c5c5c;}
  input[type=search]::-webkit-search-cancel-button{display:none;}
  select option{background:#151515;color:${G.white};}
  ::-webkit-scrollbar{width:8px;height:8px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#262626;border-radius:8px;border:2px solid ${G.bg};}
  .noscroll{scrollbar-width:none;}
  .noscroll::-webkit-scrollbar{display:none;}
  .hov{transition:background-color .15s,border-color .15s;}
  .hov:hover{background-color:#ffffff0a!important;border-color:#ffffff22!important;}
  .inp:focus{border-color:${G.gold}!important;box-shadow:0 0 0 3px ${G.gold}1f;}
  button:focus-visible,a:focus-visible{outline:2px solid ${G.gold};outline-offset:2px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes sheetUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
  @keyframes popIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}
  @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
  .fu{animation:fadeUp .25s ease both;}
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const mkEx = (exId,sets,reps,rest,load="",note="")=>({exId,sets,reps,rest,targetLoad:load,loadRef:"none",note});
const mkPct= (exId,sets,reps,rest,pct,ref,note="")=>({exId,sets,reps,rest,targetLoad:String(pct),loadRef:ref,note});
// Code d’accès client : 4 premières lettres du prénom (sans accents) + année.
// Si le code existe déjà (deux « Thomas »…), on ajoute un suffixe pour qu’il reste unique.
const genCode=(n,existing=[])=>{
  const base=(n||"").trim().split(/\s+/)[0].normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4)||"CLIE";
  const used=new Set(existing.map(c=>(c.code||"").toUpperCase()));
  let code=base+new Date().getFullYear(),i=2;
  while(used.has(code)) code=base+new Date().getFullYear()+"-"+i++;
  return code;
};
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

const CYCLE1_WILLIAM={id:"cycle1_william_fb3j",_v:2,name:"Cycle 1 William — Full Body 3j",category:"Débutant",level:"Débutant",weeks:[
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

// Pas de fiches clients de démonstration : leurs codes seraient des accès valides lisibles dans le bundle.

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

  const setData=useCallback(updater=>{
    setDataLocal(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      const prevMap=new Map(prev.map(x=>[String(x.id),x]));
      const nextIds=new Set(next.map(x=>String(x.id)));
      // Écritures Firestore hors de la phase de rendu (un updater peut être rejoué par React)
      const toWrite=next.filter(item=>{const p=prevMap.get(String(item.id));return !p||JSON.stringify(p)!==JSON.stringify(item);});
      const toDelete=prev.filter(item=>!nextIds.has(String(item.id)));
      setTimeout(()=>{
        toWrite.forEach(item=>setDoc(doc(db,collectionName,String(item.id)),item).catch(console.error));
        toDelete.forEach(item=>deleteDoc(doc(db,collectionName,String(item.id))).catch(console.error));
      },0);
      return next;
    });
  },[collectionName]);
  return [data, setData, ready];
}

// ─── OUTILS ───────────────────────────────────────────────────────────────────
const pad2=n=>String(n).padStart(2,"0");
const isoOf=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const todayISO=()=>isoOf(new Date());
const parseISO=iso=>/^\d{4}-\d{2}-\d{2}/.test(iso||"")?new Date(Number(iso.slice(0,4)),Number(iso.slice(5,7))-1,Number(iso.slice(8,10))):null;
const mondayISO=()=>{const x=new Date();x.setHours(0,0,0,0);x.setDate(x.getDate()-(x.getDay()+6)%7);return isoOf(x);};
const daysSince=iso=>{const d=parseISO(iso);if(!d)return null;const t=new Date();t.setHours(0,0,0,0);return Math.round((t-d)/86400000);};
const fmtDate=iso=>{
  const d=parseISO(iso);
  if(!d) return iso||"";
  const opts={weekday:"short",day:"numeric",month:"short"};
  if(d.getFullYear()!==new Date().getFullYear()) opts.year="numeric";
  return d.toLocaleDateString("fr-FR",opts);
};
const fmtRel=iso=>{
  const n=daysSince(iso);
  if(n==null) return iso||"";
  if(n<=0) return "aujourd'hui";
  if(n===1) return "hier";
  if(n<7) return `il y a ${n} j`;
  return fmtDate(iso);
};
const fmtDuration=min=>min<60?`${min} min`:`${Math.floor(min/60)}h${pad2(min%60)}`;
const isTimed=r=>/^\d+(\.\d+)?(s|sec|min)$/.test(String(r??"").toLowerCase().replace(/\s/g,""));
const firstName=n=>(n||"").trim().split(/\s+/)[0]||"";
const initials=n=>(n||"?").trim().split(/\s+/).map(w=>w[0]).join("").toUpperCase().slice(0,2);
const norm=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const matches=(q,...fields)=>!q||fields.some(f=>norm(f).includes(norm(q)));
const clone=o=>JSON.parse(JSON.stringify(o));
const PALETTE=["#E8C547","#C9A84C","#52C07A","#5285C0","#C05252","#9B59B6"];

// Séances : les saisies manuelles anciennes peuvent avoir weekIdx/dayIdx vides
const sameIdx=(a,b)=>a!==""&&a!=null&&Number(a)===b;
const doneLogsOf=c=>(c.sessionLogs||[]).filter(l=>l.completed);
const lastLogOf=c=>doneLogsOf(c).reduce((best,l)=>!best||String(l.date)>String(best.date)?l:best,null);
const findDoneLog=(logs,progId,wi,di)=>logs.find(l=>l.completed&&String(l.programId)===String(progId)&&sameIdx(l.weekIdx,wi)&&sameIdx(l.dayIdx,di));
const progProgress=(prog,logs)=>{
  let total=0,done=0;
  (prog.weeks||[]).forEach((w,wi)=>(w.days||[]).forEach((_,di)=>{total++;if(findDoneLog(logs,prog.id,wi,di))done++;}));
  return {total,done};
};
const nextSessionOf=(prog,logs)=>{
  for(let wi=0;wi<(prog.weeks||[]).length;wi++){
    const days=prog.weeks[wi].days||[];
    for(let di=0;di<days.length;di++) if(!findDoneLog(logs,prog.id,wi,di)) return {wi,di,day:days[di]};
  }
  return null;
};
const exCount=p=>(p.weeks||[]).reduce((a,w)=>a+(w.days||[]).reduce((b,d)=>b+(d.exercises||[]).length,0),0);

// Supersets / trisets : un exercice marqué linkNext s'enchaîne sans repos avec le suivant.
// Les exercices liés forment un bloc ; le repos du dernier exercice du bloc est pris après le tour.
// Renvoie [{start, items:[{pe,i}]}] (un bloc d'un seul exercice = exercice classique).
const exBlocks=list=>{
  const out=[];
  (list||[]).forEach((pe,i)=>{
    if(i>0&&isChained(list,i-1)) out[out.length-1].items.push({pe,i});
    else out.push({start:i,items:[{pe,i}]});
  });
  return out;
};
const blockKind=n=>n===2?"Superset":n===3?"Triset":"Circuit";
// Numéro affiché : « 3 » pour un exercice seul, « 2A », « 2B »… dans un superset
const blockLabels=list=>{
  const labels=[];
  exBlocks(list).forEach((b,bi)=>b.items.forEach((x,k)=>{labels[x.i]=b.items.length>1?`${bi+1}${"ABCDEFGH"[k]||k+1}`:String(bi+1);}));
  return labels;
};
// Retire l'exercice i sans souder le bloc précédent au bloc suivant
const dropExAt=(list,i)=>{
  const a=list.map(e=>({...e}));
  if(i>0&&isChained(a,i-1)&&!isChained(a,i)) a[i-1].linkNext=false;
  a.splice(i,1);
  return a;
};
const usesExercise=(p,exId)=>(p.weeks||[]).some(w=>(w.days||[]).some(d=>(d.exercises||[]).some(e=>e.exId===exId)));

// Statut de suivi d'un client (accueil + liste clients)
const ORANGE="#E0A052";
const clientStatus=c=>{
  if(!(c.programs||[]).length) return {key:"noprog",label:"Sans programme",color:G.red};
  const last=lastLogOf(c);
  if(!last) return {key:"new",label:"Pas encore commencé",color:"#9a9a9a"};
  const n=daysSince(last.date);
  if(n>=7) return {key:"inactive",label:`Inactif · ${n} j`,color:ORANGE};
  return {key:"active",label:`Séance ${fmtRel(last.date)}`,color:G.green};
};

// Vidéos YouTube : tous les formats de lien sont acceptés et convertis en lecteur intégré
const ytId=url=>String(url||"").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1]||null;
const toEmbed=url=>{const id=ytId(url);return id?`https://www.youtube.com/embed/${id}?playsinline=1&rel=0`:url;};
const normalizeVideo=url=>{const v=String(url||"").trim();const id=ytId(v);return id?`https://www.youtube.com/embed/${id}`:v;};
const videoSearchUrl=name=>`https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercice technique`)}`;

// ─── UI ───────────────────────────────────────────────────────────────────────
const C={
  card:"linear-gradient(180deg,#151515 0%,#0f0f0f 100%)",
  line:"#ffffff0f",line2:"#ffffff1a",soft:"#ffffff0a",
  muted:"#8d8d8d",dim:"#5c5c5c",
  goldGrad:`linear-gradient(135deg,${G.goldLight},${G.gold})`,
};
const ellipsis={whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"};
const eyebrow={fontSize:11,fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",color:C.muted};

const ICONS={
  home:"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  users:"M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  clipboard:"M9 3h6v4H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 12h6M9 16h4",
  book:"M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20v-5M8 7h8",
  sparkle:"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z",
  dumbbell:"M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11",
  leaf:"M5 20c0-9 5.5-15 15-15 0 10-6 15-14 15M5 20l7-7",
  play:"M7 4.5v15l12-7.5z",
  check:"M5 12.5 10 17.5 19 7",
  x:"M6 6l12 12M18 6 6 18",
  plus:"M12 5v14M5 12h14",
  search:"M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  edit:"M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash:"M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy:"M9 9h11v11H9zM5 15H4V4h11v1",
  left:"m15 6-6 6 6 6",right:"m9 6 6 6-6 6",down:"m6 9 6 6 6-6",up:"m6 15 6-6 6 6",
  logout:"M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4",
  video:"M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l5-3v10l-5-3",
  clock:"M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  calendar:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  target:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  bolt:"M13 2 4 14h7l-1 8 9-12h-7z",
  flame:"M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3-1-3 0-6 0-8z",
  alert:"M12 8v5M12 16h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  refresh:"M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  send:"M5 12h14M13 6l6 6-6 6",
  link:"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  chart:"M4 20V11M10 20V5M16 20v-6M2 20h20",
  history:"M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
};
const Icon=({name,size=20,color="currentColor",sw=1.9,fill="none",style})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,display:"block",...style}} aria-hidden="true"><path d={ICONS[name]}/></svg>
);

// Contexte d'interface : disposition (ordinateur / téléphone), confirmation, notification, lecteur vidéo
const UI=createContext({wide:true,confirm:async()=>false,toast:()=>{},openVideo:()=>{}});
const useUI=()=>useContext(UI);
const WIDE_QUERY="(min-width: 900px)";
function useWide(){
  const [wide,setWide]=useState(()=>window.matchMedia?.(WIDE_QUERY).matches??true);
  useEffect(()=>{
    const m=window.matchMedia?.(WIDE_QUERY);
    if(!m) return;
    const on=e=>setWide(e.matches);
    m.addEventListener("change",on);
    return()=>m.removeEventListener("change",on);
  },[]);
  return wide;
}

const BTN={
  gold:{background:C.goldGrad,color:G.bg,border:"1px solid transparent",boxShadow:`0 8px 24px ${G.gold}2e`},
  ghost:{background:C.soft,color:G.white,border:`1px solid ${C.line2}`},
  danger:{background:G.red+"14",color:G.red,border:`1px solid ${G.red}40`},
  quiet:{background:"transparent",color:C.muted,border:"1px solid transparent"},
};
function Btn({variant="gold",size="md",icon,children,style,disabled,type="button",...p}){
  const sm=size==="sm";
  return(
    <button type={type} disabled={disabled} style={{height:sm?34:44,padding:sm?"0 12px":"0 18px",borderRadius:sm?10:13,fontSize:sm?13:14,fontWeight:700,
      display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,cursor:disabled?"default":"pointer",opacity:disabled?.45:1,whiteSpace:"nowrap",
      transition:"opacity .2s",...BTN[variant],...style}} {...p}>
      {icon&&<Icon name={icon} size={sm?15:17}/>}{children}
    </button>
  );
}
function IconBtn({icon,label,variant="ghost",size=38,style,...p}){
  return(
    <button type="button" aria-label={label} title={label} style={{width:size,height:size,borderRadius:12,display:"inline-flex",alignItems:"center",justifyContent:"center",
      cursor:"pointer",flexShrink:0,...BTN[variant],boxShadow:"none",...style}} {...p}>
      <Icon name={icon} size={Math.round(size*.45)}/>
    </button>
  );
}
const Card=({children,style,onClick,...p})=>(
  <div onClick={onClick} className={onClick?"hov":undefined} style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:18,padding:16,cursor:onClick?"pointer":undefined,...style}} {...p}>{children}</div>
);
const Chip=({children,gold,color,style})=>{
  const c=color||(gold?G.goldLight:null);
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,height:24,padding:"0 9px",borderRadius:99,fontSize:11.5,fontWeight:700,
    background:c?c+"1c":C.soft,color:c||"#bdbdbd",border:`1px solid ${c?c+"40":C.line}`,whiteSpace:"nowrap",...style}}>{children}</span>;
};
const inputStyle={width:"100%",height:44,background:"#121212",border:`1px solid ${C.line2}`,borderRadius:12,padding:"0 14px",color:G.white,fontSize:16,outline:"none",transition:"border-color .15s, box-shadow .15s"};
const Field=({label,hint,children,style})=>(
  <label style={{display:"block",marginBottom:14,...style}}>
    <div style={{...eyebrow,fontSize:10.5,marginBottom:7}}>{label}</div>
    {children}
    {hint&&<div style={{fontSize:12,color:C.dim,marginTop:6,lineHeight:1.4}}>{hint}</div>}
  </label>
);
const TextInput=({style,...p})=><input className="inp" style={{...inputStyle,...style}} {...p}/>;
const TextArea=({style,...p})=><textarea className="inp" style={{...inputStyle,height:"auto",minHeight:84,padding:"11px 14px",lineHeight:1.5,resize:"vertical",...style}} {...p}/>;
const Select=({children,style,...p})=>(
  <div style={{position:"relative"}}>
    <select className="inp" style={{...inputStyle,appearance:"none",WebkitAppearance:"none",paddingRight:36,cursor:"pointer",...style}} {...p}>{children}</select>
    <Icon name="down" size={16} color={C.muted} style={{position:"absolute",right:12,top:"50%",marginTop:-8,pointerEvents:"none"}}/>
  </div>
);
const SearchBox=({value,onChange,placeholder="Rechercher…",style,autoFocus})=>(
  <div style={{position:"relative",...style}}>
    <Icon name="search" size={17} color={C.muted} style={{position:"absolute",left:13,top:"50%",marginTop:-8.5,pointerEvents:"none"}}/>
    <input className="inp" type="search" autoFocus={autoFocus} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...inputStyle,paddingLeft:40,paddingRight:38}}/>
    {value&&<button type="button" aria-label="Effacer la recherche" onClick={()=>onChange("")} style={{position:"absolute",right:6,top:6,width:32,height:32,border:"none",background:"none",color:C.muted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="x" size={15}/></button>}
  </div>
);
const Segmented=({options,value,onChange,style})=>(
  <div className="noscroll" role="tablist" style={{display:"flex",gap:4,padding:4,background:"#0c0c0c",border:`1px solid ${C.line}`,borderRadius:14,overflowX:"auto",...style}}>
    {options.map(([k,l,n])=>{
      const a=k===value;
      return(
        <button key={k} type="button" role="tab" aria-selected={a} onClick={()=>onChange(k)} style={{flex:1,minWidth:"max-content",height:36,padding:"0 14px",borderRadius:10,border:"none",
          background:a?"#1d1d1d":"transparent",color:a?G.goldLight:C.muted,fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:a?"inset 0 0 0 1px #ffffff14":"none",
          display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          {l}{n!=null&&<span style={{fontSize:11,color:a?G.gold:C.dim}}>{n}</span>}
        </button>
      );
    })}
  </div>
);
const FilterChips=({options,value,onChange})=>(
  <div className="noscroll" style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
    {options.map(([k,l])=>{
      const a=k===value;
      return <button key={k} type="button" onClick={()=>onChange(k)} style={{flexShrink:0,height:32,padding:"0 13px",borderRadius:99,border:`1px solid ${a?G.gold+"77":C.line2}`,
        background:a?G.gold+"1c":C.soft,color:a?G.goldLight:"#bbb",fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{l}</button>;
    })}
  </div>
);
const Avatar=({name,color=G.gold,size=40})=>(
  <div style={{width:size,height:size,borderRadius:size*.32,background:color+"1f",border:`1px solid ${color}55`,color,display:"flex",alignItems:"center",justifyContent:"center",
    fontFamily:G.fontD,fontWeight:800,fontSize:size*.4,flexShrink:0}}>{initials(name)}</div>
);
const ProgressBar=({value,max,color=G.goldLight})=>(
  <div style={{height:6,borderRadius:99,background:"#ffffff10",overflow:"hidden"}}>
    <div style={{width:`${max?Math.min(100,value/max*100):0}%`,height:"100%",borderRadius:99,background:color,transition:"width .4s ease"}}/>
  </div>
);
const EmptyState=({icon="users",title,text,action})=>(
  <div style={{textAlign:"center",padding:"56px 20px",color:C.muted}}>
    <div style={{width:56,height:56,borderRadius:18,background:C.soft,border:`1px solid ${C.line}`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",color:C.dim}}><Icon name={icon} size={24}/></div>
    {title&&<div style={{fontWeight:700,color:G.white,fontSize:15,marginBottom:6}}>{title}</div>}
    {text&&<div style={{fontSize:13,lineHeight:1.55,maxWidth:340,margin:"0 auto"}}>{text}</div>}
    {action&&<div style={{marginTop:18}}>{action}</div>}
  </div>
);
const SectionTitle=({children,action,style})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,margin:"26px 2px 12px",...style}}>
    <div style={eyebrow}>{children}</div>
    {action}
  </div>
);
const BackLink=({onClick,label="Retour"})=>(
  <button type="button" onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:4,background:"none",border:"none",color:G.goldLight,fontWeight:700,fontSize:14,cursor:"pointer",padding:"6px 0",marginBottom:10}}>
    <Icon name="left" size={17}/>{label}
  </button>
);
function PageHeader({title,sub,actions}){
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginBottom:20}}>
      <div style={{flex:1,minWidth:180}}>
        <div style={{fontFamily:G.fontD,fontSize:34,fontWeight:800,letterSpacing:-1,lineHeight:1}}>{title}</div>
        {sub&&<div style={{fontSize:13,color:C.muted,marginTop:7}}>{sub}</div>}
      </div>
      {actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}
    </div>
  );
}
// Zone de contenu : marges adaptées à l'écran
function Pad({children,max=1080}){
  const {wide}=useUI();
  return <div className="fu" style={{maxWidth:max,margin:"0 auto",padding:wide?"32px 36px 56px":"18px 16px 32px"}}>{children}</div>;
}

// Fenêtre : centrée sur ordinateur, feuille du bas sur téléphone.
// Rendue dans <body> : les animations des pages (transform) fausseraient le positionnement fixe.
function Modal({onClose,title,children,footer,width=540}){
  const {wide}=useUI();
  const box=useRef(null);
  useEffect(()=>{
    // Échap ne ferme que la fenêtre du dessus (ex. création d'exercice ouverte par-dessus le sélecteur)
    const k=e=>{
      if(e.key!=="Escape")return;
      const all=document.querySelectorAll('[role="dialog"]');
      if(all[all.length-1]===box.current) onClose?.();
    };
    window.addEventListener("keydown",k);
    return()=>window.removeEventListener("keydown",k);
  },[onClose]);
  return createPortal(
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:500,background:"#000000b3",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",
      display:"flex",alignItems:wide?"center":"flex-end",justifyContent:"center",padding:wide?24:0,animation:"fadeIn .18s ease"}}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={typeof title==="string"?title:undefined} onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:wide?width:"100%",maxHeight:wide?"88vh":"92dvh",display:"flex",flexDirection:"column",background:"#111",border:`1px solid ${C.line2}`,
          borderRadius:wide?22:"24px 24px 0 0",boxShadow:"0 30px 80px #000c",animation:wide?"popIn .2s ease":"sheetUp .28s cubic-bezier(.2,.9,.3,1)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"18px 20px 10px",flexShrink:0}}>
          <div style={{flex:1,minWidth:0,fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-.4,...ellipsis}}>{title}</div>
          <IconBtn icon="x" label="Fermer" onClick={onClose} size={36}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:footer?"4px 20px 18px":"4px 20px calc(20px + env(safe-area-inset-bottom))"}}>{children}</div>
        {footer&&<div style={{padding:"12px 20px calc(14px + env(safe-area-inset-bottom))",borderTop:`1px solid ${C.line}`,display:"flex",gap:10,flexShrink:0}}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
function useConfirmDialog(){
  const [st,setSt]=useState(null);
  const ask=useCallback(o=>new Promise(resolve=>setSt({...o,resolve})),[]);
  const close=v=>{st?.resolve(v);setSt(null);};
  const node=st&&(
    <Modal onClose={()=>close(false)} title={st.title} width={440}
      footer={<>
        <Btn variant="ghost" style={{flex:1}} onClick={()=>close(false)}>{st.cancel||"Annuler"}</Btn>
        <Btn variant={st.danger?"danger":"gold"} style={{flex:1}} onClick={()=>close(true)}>{st.confirm||"Confirmer"}</Btn>
      </>}>
      {st.text&&<div style={{fontSize:14,color:C.muted,lineHeight:1.55}}>{st.text}</div>}
    </Modal>
  );
  return [ask,node];
}
function useToast(){
  const [msg,setMsg]=useState(null);
  const timer=useRef(null);
  const show=useCallback(m=>{setMsg(m);clearTimeout(timer.current);timer.current=setTimeout(()=>setMsg(null),2400);},[]);
  const node=msg&&(
    <div role="status" style={{position:"fixed",left:"50%",bottom:"calc(92px + env(safe-area-inset-bottom))",transform:"translateX(-50%)",zIndex:600,background:"#1b1b1b",
      border:`1px solid ${C.line2}`,color:G.white,padding:"11px 18px",borderRadius:99,fontSize:13.5,fontWeight:600,boxShadow:"0 12px 40px #000a",animation:"fadeUp .2s ease",
      display:"flex",alignItems:"center",gap:8,maxWidth:"calc(100vw - 32px)"}}>
      <Icon name="check" size={16} color={G.green} sw={2.4}/>{msg}
    </div>
  );
  return [show,node];
}
const VideoFrame=({url,title})=>(
  <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:14,overflow:"hidden",background:"#000"}}>
    <iframe title={title} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={toEmbed(url)}
      allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
  </div>
);
function VideoModal({ex,onClose}){
  if(!ex) return null;
  return(
    <Modal onClose={onClose} title={ex.name} width={760}>
      {ex.videoUrl?<VideoFrame url={ex.videoUrl} title={`Vidéo — ${ex.name}`}/>:(
        <div style={{fontSize:14,color:C.muted,lineHeight:1.55}}>
          Pas encore de vidéo pour cet exercice. Ajoute un lien dans la bibliothèque, ou <a href={videoSearchUrl(ex.name)} target="_blank" rel="noopener noreferrer" style={{color:G.goldLight}}>cherche une démo sur YouTube</a>.
        </div>
      )}
      {ex.notes&&<div style={{fontSize:13,color:"#ccc",lineHeight:1.5,marginTop:14}}>💡 {ex.notes}</div>}
    </Modal>
  );
}
const VideoBtn=({ex,size=34})=>{
  const {openVideo}=useUI();
  const has=!!ex.videoUrl;
  return(
    <button type="button" aria-label={`Vidéo — ${ex.name}`} title={has?"Voir la vidéo":"Pas de vidéo"} onClick={e=>{e.stopPropagation();openVideo(ex);}}
      style={{width:size,height:size,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
        color:has?G.goldLight:C.dim,background:has?G.gold+"14":"transparent",border:`1px solid ${has?G.gold+"55":C.line2}`}}>
      <Icon name="video" size={15}/>
    </button>
  );
};

const Brand=()=>(
  <div style={{display:"flex",alignItems:"center",gap:11}}>
    <div style={{width:36,height:36,borderRadius:12,background:`radial-gradient(circle at 50% 35%,${G.gold}44,#121212 75%)`,border:`1px solid ${G.gold}55`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <Icon name="bolt" size={18} color={G.goldLight} fill={G.goldLight} sw={0}/>
    </div>
    <div>
      <div style={{fontFamily:G.fontD,fontSize:21,fontWeight:800,letterSpacing:-.5,lineHeight:1}}>WANDY<span style={{color:G.goldLight}}> COACH</span></div>
      <div style={{fontSize:9.5,color:C.dim,letterSpacing:2.2,textTransform:"uppercase",marginTop:4}}>Espace coach</div>
    </div>
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function CoachLogin({onLogin}){
  const [code,setCode]=useState("");
  const [err,setErr]=useState(null); // null | "invalid" | "notcoach" | "locked" | "network"
  const [busy,setBusy]=useState(false);
  const attempt=async e=>{
    e?.preventDefault();
    if(!code.trim()||busy)return;
    setBusy(true);
    const r=await onLogin(code);
    setBusy(false);
    if(r!=="ok")setErr(r);
  };
  const msg={invalid:"Code incorrect",notcoach:"Ce code n'ouvre pas l'espace coach",locked:"Trop d'essais — réessaie dans 15 minutes",network:"Connexion impossible — vérifie ton réseau"}[err];
  return(
    <div style={{minHeight:"100dvh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.font,color:G.white,padding:16}}>
      <style>{css}</style>
      <form onSubmit={attempt} className="fu" style={{width:"100%",maxWidth:400,padding:"34px 26px",background:"linear-gradient(180deg,#151515,#0e0e0e)",borderRadius:26,border:`1px solid ${C.line2}`,boxShadow:"0 30px 80px #000a"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:30}}><Brand/></div>
        <Field label="Code coach">
          <TextInput type="password" value={code} onChange={e=>{setCode(e.target.value);setErr(null);}} autoComplete="current-password" autoFocus
            style={{height:54,textAlign:"center",fontSize:20,fontWeight:700,letterSpacing:4}}/>
        </Field>
        <div role="alert" style={{minHeight:20,color:G.red,fontSize:13,textAlign:"center",marginBottom:10}}>{msg}</div>
        <Btn type="submit" disabled={!code.trim()||busy} style={{width:"100%",height:50}}>{busy?"Connexion…":"Accéder à mon espace"}</Btn>
      </form>
    </div>
  );
}

// Code coach vérifié par le serveur ; un code adhérent saisi ici ne donne pas accès à l'espace coach
async function coachLoginWithCode(code){
  const r=await loginWithCode(code.trim().toUpperCase());
  if(r.status!=="ok") return r.status;
  if(r.role!=="coach"){await signOut(auth).catch(()=>{});return "notcoach";}
  return "ok";
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
const NAV=[["home","Accueil","home"],["clients","Clients","users"],["programs","Programmes","clipboard"],["library","Bibliothèque","book"],["ai","IA Coach","sparkle"]];
function Sidebar({view,go,counts,onLogout}){
  return(
    <aside style={{width:240,flexShrink:0,height:"100dvh",position:"sticky",top:0,display:"flex",flexDirection:"column",background:"#0a0a0a",borderRight:`1px solid ${C.line}`,padding:"24px 14px 16px"}}>
      <div style={{padding:"0 6px"}}><Brand/></div>
      <nav style={{display:"flex",flexDirection:"column",gap:4,marginTop:30,flex:1}}>
        {NAV.map(([k,l,ic])=>{
          const a=view===k;
          return(
            <button key={k} type="button" onClick={()=>go(k)} className={a?undefined:"hov"} aria-current={a?"page":undefined}
              style={{display:"flex",alignItems:"center",gap:12,height:44,padding:"0 12px",borderRadius:12,border:"none",background:a?G.gold+"17":"transparent",
                color:a?G.goldLight:"#a8a8a8",fontSize:14,fontWeight:a?700:600,cursor:"pointer",textAlign:"left",boxShadow:a?`inset 0 0 0 1px ${G.gold}33`:"none"}}>
              <Icon name={ic} size={19}/><span style={{flex:1}}>{l}</span>
              {counts[k]!=null&&<span style={{fontSize:11.5,fontWeight:700,color:a?G.gold:C.dim}}>{counts[k]}</span>}
            </button>
          );
        })}
      </nav>
      <button type="button" onClick={onLogout} className="hov" style={{display:"flex",alignItems:"center",gap:12,height:42,padding:"0 12px",borderRadius:12,border:"none",background:"transparent",color:C.dim,fontSize:13,fontWeight:600,cursor:"pointer"}}>
        <Icon name="logout" size={18}/>Déconnexion
      </button>
    </aside>
  );
}
function BottomNav({view,go}){
  return(
    <nav style={{flexShrink:0,display:"flex",background:"#0b0b0bf2",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",borderTop:`1px solid ${C.line}`,padding:"6px 4px calc(6px + env(safe-area-inset-bottom))"}}>
      {NAV.map(([k,l,ic])=>{
        const a=view===k;
        return(
          <button key={k} type="button" onClick={()=>go(k)} aria-current={a?"page":undefined} style={{flex:1,height:54,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,
            border:"none",background:"none",color:a?G.goldLight:"#7a7a7a",fontSize:10.5,fontWeight:700,cursor:"pointer"}}>
            <div style={{width:46,height:28,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"center",background:a?G.gold+"1f":"transparent"}}><Icon name={ic} size={20}/></div>
            {k==="library"?"Biblio":k==="programs"?"Progr.":l}
          </button>
        );
      })}
    </nav>
  );
}

// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function HomeView({data,go,onLogout}){
  const {wide}=useUI();
  const {clients,programs,exercises}=data;
  const monday=mondayISO();
  const allLogs=clients.flatMap(c=>doneLogsOf(c).map(l=>({log:l,client:c})));
  const weekCount=allLogs.filter(x=>String(x.log.date)>=monday).length;
  const recent=[...allLogs].sort((a,b)=>String(b.log.date).localeCompare(String(a.log.date))).slice(0,6);
  const noVideo=exercises.filter(e=>!e.videoUrl).length;
  const rank={noprog:0,inactive:1,new:2};
  const followUps=clients.map(c=>({c,st:clientStatus(c)})).filter(x=>x.st.key!=="active").sort((a,b)=>rank[a.st.key]-rank[b.st.key]);
  const today=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const progName=id=>programs.find(p=>String(p.id)===String(id))?.name;

  const kpis=[
    {label:"Clients",value:clients.length,icon:"users",onClick:()=>go("clients")},
    {label:"Séances cette semaine",value:weekCount,icon:"flame"},
    {label:"Programmes",value:programs.length,icon:"clipboard",onClick:()=>go("programs")},
    {label:"Exercices sans vidéo",value:noVideo,icon:"video",warn:noVideo>0,onClick:()=>go("library",{noVideo:true})},
  ];

  return(
    <Pad>
      <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:22}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{...eyebrow,color:G.gold}}>{today}</div>
          <div style={{fontFamily:G.fontD,fontSize:wide?40:34,fontWeight:800,letterSpacing:-1,lineHeight:1.05,marginTop:6}}>Bonjour coach</div>
        </div>
        {!wide&&<IconBtn icon="logout" label="Déconnexion" onClick={onLogout}/>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:wide?"repeat(4,1fr)":"1fr 1fr",gap:10}}>
        {kpis.map(k=>(
          <Card key={k.label} onClick={k.onClick} style={{padding:16}}>
            <div style={{width:34,height:34,borderRadius:11,display:"flex",alignItems:"center",justifyContent:"center",background:(k.warn?ORANGE:G.gold)+"18",color:k.warn?ORANGE:G.goldLight,marginBottom:14}}><Icon name={k.icon} size={17}/></div>
            <div style={{fontFamily:G.fontD,fontSize:34,fontWeight:800,lineHeight:1,color:k.warn?ORANGE:G.white}}>{k.value}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:6,lineHeight:1.3}}>{k.label}</div>
          </Card>
        ))}
      </div>

      <div style={wide?{display:"flex",gap:8,marginTop:14}:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
        <Btn icon="plus" style={wide?undefined:{gridColumn:"1 / -1"}} onClick={()=>go("clients",{newClient:true})}>Nouveau client</Btn>
        <Btn variant="ghost" icon="clipboard" onClick={()=>go("programs",{mode:"new"})}>{wide?"Nouveau programme":"Programme"}</Btn>
        <Btn variant="ghost" icon="sparkle" onClick={()=>go("ai")}>{wide?"Créer avec l'IA":"IA Coach"}</Btn>
      </div>

      <div style={{display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:wide?24:0}}>
        <div>
          <SectionTitle>À suivre</SectionTitle>
          {followUps.length===0?(
            <Card style={{color:C.muted,fontSize:14,display:"flex",alignItems:"center",gap:10}}><Icon name="check" size={18} color={G.green}/>Tous tes clients sont actifs cette semaine.</Card>
          ):followUps.slice(0,6).map(({c,st})=>(
            <Card key={c.id} onClick={()=>go("clients",{clientId:c.id})} style={{display:"flex",alignItems:"center",gap:12,padding:12,marginBottom:8}}>
              <Avatar name={c.name} color={c.color} size={38}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,...ellipsis}}>{c.name}</div>
                <div style={{fontSize:12,color:st.color,marginTop:2}}>{st.label}</div>
              </div>
              <Icon name="right" size={17} color={C.dim}/>
            </Card>
          ))}
        </div>
        <div>
          <SectionTitle>Activité récente</SectionTitle>
          {recent.length===0?(
            <Card style={{color:C.muted,fontSize:14}}>Les séances terminées par tes clients apparaîtront ici.</Card>
          ):recent.map(({log,client},i)=>(
            <Card key={`${client.id}-${log.id||i}`} onClick={()=>go("clients",{clientId:client.id,tab:"history"})} style={{display:"flex",alignItems:"center",gap:12,padding:12,marginBottom:8}}>
              <div style={{width:38,height:38,borderRadius:12,background:G.green+"18",color:G.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="check" size={18} sw={2.4}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:14,...ellipsis}}>{firstName(client.name)} · {log.dayLabel||"Séance"}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2,...ellipsis}}>{fmtRel(log.date)}{progName(log.programId)?` · ${progName(log.programId)}`:""}{log.duration?` · ${fmtDuration(log.duration)}`:""}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Pad>
  );
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
function ClientsView({data,nav,go}){
  const {wide}=useUI();
  const {clients,programs}=data;
  const [showNew,setShowNew]=useState(!!nav.newClient);
  const sel=clients.find(c=>String(c.id)===String(nav.clientId));
  const program=sel&&nav.programId!=null?programs.find(p=>String(p.id)===String(nav.programId)):null;
  const open=c=>go("clients",{clientId:c.id});

  const list=<ClientList clients={clients} selId={sel?.id} onOpen={open} onNew={()=>setShowNew(true)}/>;
  const detail=sel&&(program
    ?<ProgramDetail key={`${sel.id}-${program.id}`} data={data} program={program} client={sel} go={go} onBack={()=>go("clients",{clientId:sel.id})} backLabel={firstName(sel.name)}/>
    :<ClientDetail key={sel.id} data={data} client={sel} go={go} initialTab={nav.tab}/>);
  const modal=showNew&&<NewClientModal data={data} onClose={()=>setShowNew(false)} onCreated={c=>{setShowNew(false);open(c);}}/>;

  if(wide) return(
    <div style={{display:"flex",height:"100dvh"}}>
      <div style={{width:350,flexShrink:0,borderRight:`1px solid ${C.line}`,overflowY:"auto",padding:"30px 18px"}}>{list}</div>
      <div style={{flex:1,minWidth:0,overflowY:"auto"}}>
        {detail||<EmptyState icon="users" title="Sélectionne un client" text="Son programme, son suivi, ses performances et sa nutrition s'affichent ici."/>}
      </div>
      {modal}
    </div>
  );
  return <>{detail||<Pad>{list}</Pad>}{modal}</>;
}

function ClientList({clients,selId,onOpen,onNew}){
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const withSt=clients.map(c=>({c,st:clientStatus(c)}));
  const count=k=>withSt.filter(x=>k==="all"||(k==="todo"?x.st.key!=="active":x.st.key==="active")).length;
  const shown=withSt
    .filter(({c,st})=>matches(search,c.name,c.goal,c.code)&&(filter==="all"||(filter==="todo"?st.key!=="active":st.key==="active")))
    .sort((a,b)=>a.c.name.localeCompare(b.c.name,"fr"));
  return(
    <>
      <PageHeader title="Clients" sub={`${clients.length} client${clients.length>1?"s":""}`} actions={<Btn size="sm" icon="plus" onClick={onNew}>Nouveau</Btn>}/>
      <SearchBox value={search} onChange={setSearch} placeholder="Nom, objectif ou code…"/>
      <Segmented style={{margin:"10px 0 14px"}} value={filter} onChange={setFilter}
        options={[["all","Tous",count("all")],["active","Actifs",count("active")],["todo","À relancer",count("todo")]]}/>
      {shown.length===0&&<EmptyState icon="users" title={clients.length?"Aucun résultat":"Aucun client"} text={clients.length?"Essaie une autre recherche.":"Crée ton premier client pour lui donner un code d'accès."}/>}
      {shown.map(({c,st})=>{
        const a=String(c.id)===String(selId);
        return(
          <button key={c.id} type="button" onClick={()=>onOpen(c)} className={a?undefined:"hov"}
            style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"11px 12px",marginBottom:6,borderRadius:14,textAlign:"left",cursor:"pointer",color:G.white,
              background:a?G.gold+"12":"transparent",border:`1px solid ${a?G.gold+"44":"transparent"}`}}>
            <Avatar name={c.name} color={c.color} size={40}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14.5,...ellipsis}}>{c.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2,...ellipsis}}>{c.goal||"Objectif à définir"}</div>
            </div>
            <span title={st.label} style={{width:9,height:9,borderRadius:99,background:st.color,flexShrink:0,boxShadow:`0 0 0 3px ${st.color}22`}}/>
          </button>
        );
      })}
    </>
  );
}

function NewClientModal({data,onClose,onCreated}){
  const {clients,setClients,mealTemplate}=data;
  const {toast}=useUI();
  const [name,setName]=useState("");
  const [goal,setGoal]=useState("");
  const code=name.trim()?genCode(name,clients):"";
  const create=()=>{
    if(!name.trim())return;
    const nc={id:Date.now(),name:name.trim(),code,goal:goal.trim()||"Objectif à définir",
      since:new Date().toLocaleDateString("fr-FR",{month:"short",year:"numeric"}),sessions:0,
      color:PALETTE[clients.length%PALETTE.length],programs:[],sessionLogs:[],tests:{...EMPTY_TESTS},
      mealPlan:mealTemplate?{meals:clone(mealTemplate)}:emptyMealPlan(),
      nutrition:{calories:2000,proteins:150,carbs:220,fats:70,notes:""}};
    setClients(p=>[...p,nc]);
    toast(`${firstName(nc.name)} créé · code ${code}`);
    onCreated(nc);
  };
  return(
    <Modal onClose={onClose} title="Nouveau client" width={460}
      footer={<><Btn variant="ghost" style={{flex:1}} onClick={onClose}>Annuler</Btn><Btn style={{flex:2}} disabled={!name.trim()} onClick={create}>Créer le client</Btn></>}>
      <Field label="Nom complet"><TextInput value={name} onChange={e=>setName(e.target.value)} placeholder="Marie Dupont" autoFocus onKeyDown={e=>e.key==="Enter"&&create()}/></Field>
      <Field label="Objectif"><TextInput value={goal} onChange={e=>setGoal(e.target.value)} placeholder="Perte de poids, force, prépa concours…"/></Field>
      {code&&(
        <div style={{background:G.gold+"10",border:`1px solid ${G.gold}33`,borderRadius:14,padding:14}}>
          <div style={{fontSize:12,color:C.muted}}>Code d'accès à transmettre</div>
          <div style={{fontFamily:"ui-monospace,Menlo,monospace",fontSize:24,fontWeight:700,color:G.goldLight,letterSpacing:3,marginTop:4}}>{code}</div>
          {mealTemplate&&<div style={{fontSize:12,color:C.muted,marginTop:8}}>Ton plan alimentaire modèle sera appliqué automatiquement.</div>}
        </div>
      )}
    </Modal>
  );
}

function ClientDetail({data,client:c,go,initialTab}){
  const {setClients,programs}=data;
  const {wide,toast}=useUI();
  const [tab,setTab]=useState(initialTab||"programs");
  const [editing,setEditing]=useState(false);
  const upd=useCallback(fn=>setClients(p=>p.map(x=>x.id===c.id?fn(x):x)),[setClients,c.id]);
  const logs=c.sessionLogs||[];
  const done=doneLogsOf(c);
  const last=lastLogOf(c);
  const thisWeek=done.filter(l=>String(l.date)>=mondayISO()).length;
  const st=clientStatus(c);
  const assigned=programs.filter(p=>(c.programs||[]).includes(p.id));
  const copyCode=async()=>{
    try{await navigator.clipboard.writeText(c.code);toast("Code copié");}
    catch{toast(`Code : ${c.code}`);}
  };

  return(
    <Pad max={980}>
      {!wide&&<BackLink onClick={()=>go("clients")} label="Clients"/>}
      <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
        <Avatar name={c.name} color={c.color} size={wide?64:56}/>
        <div style={{flex:1,minWidth:180}}>
          <div style={{fontFamily:G.fontD,fontSize:wide?34:28,fontWeight:800,letterSpacing:-.8,lineHeight:1.05}}>{c.name}</div>
          <div style={{fontSize:13,color:C.muted,marginTop:5}}>{c.goal||"Objectif à définir"}{c.since?` · depuis ${c.since}`:""}</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button type="button" onClick={copyCode} title="Copier le code d'accès" className="hov"
            style={{height:38,display:"inline-flex",alignItems:"center",gap:8,padding:"0 12px",borderRadius:12,border:`1px solid ${G.gold}44`,background:G.gold+"10",color:G.goldLight,cursor:"pointer",fontFamily:"ui-monospace,Menlo,monospace",fontWeight:700,letterSpacing:1.5,fontSize:14}}>
            {c.code}<Icon name="copy" size={15}/>
          </button>
          <IconBtn icon="edit" label="Modifier le profil" onClick={()=>setEditing(true)}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"20px 0 18px"}}>
        {[[done.length,"Séances faites"],[thisWeek,"Cette semaine"],[last?fmtRel(last.date):"—","Dernière séance"]].map(([v,l])=>(
          <Card key={l} style={{padding:"12px 14px"}}>
            <div style={{fontFamily:G.fontD,fontSize:typeof v==="number"?28:19,fontWeight:800,lineHeight:1.1,...ellipsis}}>{v}</div>
            <div style={{fontSize:11.5,color:C.muted,marginTop:4}}>{l}</div>
          </Card>
        ))}
      </div>
      {st.key!=="active"&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:st.color,margin:"-6px 2px 16px"}}><Icon name="alert" size={16}/>{st.label}</div>}

      <Segmented value={tab} onChange={setTab} style={{marginBottom:18}}
        options={[["programs","Programmes",assigned.length],["history","Suivi",logs.length],["perfs","Perfs"],["nutrition","Nutrition"]]}/>

      {tab==="programs"&&<ClientProgramsTab data={data} client={c} upd={upd} go={go}/>}
      {tab==="history"&&<ClientHistoryTab data={data} client={c} upd={upd}/>}
      {tab==="perfs"&&<ClientPerfsTab client={c} upd={upd}/>}
      {tab==="nutrition"&&<ClientNutritionTab data={data} client={c} upd={upd}/>}

      {editing&&<EditClientModal data={data} client={c} upd={upd} onClose={()=>setEditing(false)} go={go}/>}
    </Pad>
  );
}

function EditClientModal({data,client:c,upd,onClose,go}){
  const {clients,setClients}=data;
  const {confirm,toast}=useUI();
  const [form,setForm]=useState({name:c.name,goal:c.goal||"",color:c.color||G.gold});
  const save=()=>{if(!form.name.trim())return;upd(x=>({...x,name:form.name.trim(),goal:form.goal.trim(),color:form.color}));onClose();};
  const newCode=async()=>{
    const ok=await confirm({title:"Générer un nouveau code ?",text:`L'ancien code (${c.code}) ne fonctionnera plus et ${firstName(c.name)} sera déconnecté. Tu devras lui transmettre le nouveau code.`,confirm:"Générer",danger:true});
    if(!ok)return;
    const code=genCode(c.name,clients);
    upd(x=>({...x,code}));
    toast(`Nouveau code : ${code}`);
  };
  const remove=async()=>{
    const ok=await confirm({title:`Supprimer ${c.name} ?`,text:"Sa fiche, son historique de séances et son plan alimentaire seront définitivement supprimés. Son code ne fonctionnera plus.",confirm:"Supprimer",danger:true});
    if(!ok)return;
    setClients(p=>p.filter(x=>x.id!==c.id));
    onClose();
    go("clients");
  };
  return(
    <Modal onClose={onClose} title="Profil du client" width={480}
      footer={<><Btn variant="ghost" style={{flex:1}} onClick={onClose}>Annuler</Btn><Btn style={{flex:2}} disabled={!form.name.trim()} onClick={save}>Enregistrer</Btn></>}>
      <Field label="Nom complet"><TextInput value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></Field>
      <Field label="Objectif"><TextInput value={form.goal} onChange={e=>setForm(p=>({...p,goal:e.target.value}))}/></Field>
      <Field label="Couleur">
        <div style={{display:"flex",gap:10}}>
          {PALETTE.map(col=>(
            <button key={col} type="button" aria-label={`Couleur ${col}`} onClick={()=>setForm(p=>({...p,color:col}))}
              style={{width:34,height:34,borderRadius:11,background:col,cursor:"pointer",border:form.color===col?"3px solid #fff":"3px solid transparent"}}/>
          ))}
        </div>
      </Field>
      <div style={{...eyebrow,margin:"22px 0 10px"}}>Accès</div>
      <Card style={{display:"flex",alignItems:"center",gap:12,padding:14}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:C.muted}}>Code actuel</div>
          <div style={{fontFamily:"ui-monospace,Menlo,monospace",fontSize:18,fontWeight:700,color:G.goldLight,letterSpacing:2,marginTop:2}}>{c.code}</div>
        </div>
        <Btn size="sm" variant="ghost" icon="refresh" onClick={newCode}>Nouveau code</Btn>
      </Card>
      <Btn variant="danger" icon="trash" style={{width:"100%",marginTop:22}} onClick={remove}>Supprimer ce client</Btn>
    </Modal>
  );
}

function ClientProgramsTab({data,client:c,upd,go}){
  const {programs,setPrograms}=data;
  const {confirm,toast}=useUI();
  const [picker,setPicker]=useState(false);
  const logs=c.sessionLogs||[];
  const assigned=programs.filter(p=>(c.programs||[]).includes(p.id));
  const assign=p=>{upd(x=>({...x,programs:[...(x.programs||[]),p.id]}));setPicker(false);toast(`${p.name} assigné`);};
  const unassign=async p=>{
    const ok=await confirm({title:"Retirer ce programme ?",text:`${p.name} ne sera plus visible par ${firstName(c.name)}. L'historique de ses séances est conservé.`,confirm:"Retirer",danger:true});
    if(ok) upd(x=>({...x,programs:(x.programs||[]).filter(id=>id!==p.id)}));
  };
  const personalize=p=>{
    const copy={...clone(p),id:Date.now(),name:`${p.name} (${firstName(c.name)})`,_copy:true};
    delete copy._v;
    setPrograms(prev=>[...prev,copy]);
    upd(x=>({...x,programs:[...(x.programs||[]).filter(id=>id!==p.id),copy.id]}));
    toast("Copie personnelle créée");
    go("programs",{programId:copy.id,mode:"edit"});
  };
  return(
    <>
      {assigned.length===0&&<EmptyState icon="clipboard" title="Aucun programme assigné" text={`Assigne un programme pour que ${firstName(c.name)} voie ses séances.`}/>}
      {assigned.map(p=>{
        const pp=progProgress(p,logs);
        const nx=nextSessionOf(p,logs);
        return(
          <Card key={p.id} style={{marginBottom:10}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:16}}>{p.name}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
                  {p._copy&&<Chip gold>Version perso</Chip>}
                  {p.level&&<Chip>{p.level}</Chip>}
                  <Chip>{(p.weeks||[]).length} sem.</Chip>
                </div>
              </div>
              <IconBtn icon="x" label="Retirer le programme" variant="quiet" size={34} onClick={()=>unassign(p)}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,margin:"14px 0 7px"}}>
              <span>{nx?`Prochaine : S${nx.wi+1} · ${nx.day.label}`:"Programme terminé 🎉"}</span><span>{pp.done}/{pp.total}</span>
            </div>
            <ProgressBar value={pp.done} max={pp.total} color={nx?G.goldLight:G.green}/>
            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <Btn size="sm" variant="ghost" icon="chart" onClick={()=>go("clients",{clientId:c.id,programId:p.id})}>Séances et résultats</Btn>
              {!p._copy&&<Btn size="sm" variant="quiet" icon="edit" onClick={()=>personalize(p)}>Personnaliser</Btn>}
              {p._copy&&<Btn size="sm" variant="quiet" icon="edit" onClick={()=>go("programs",{programId:p.id,mode:"edit"})}>Modifier</Btn>}
            </div>
          </Card>
        );
      })}
      <Btn variant="ghost" icon="plus" style={{width:"100%",marginTop:4,borderStyle:"dashed"}} onClick={()=>setPicker(true)}>Assigner un programme</Btn>
      {picker&&<ProgramPickerModal programs={programs.filter(p=>!(c.programs||[]).includes(p.id))} onPick={assign} onClose={()=>setPicker(false)}/>}
    </>
  );
}

function ProgramPickerModal({programs,onPick,onClose}){
  const {wide}=useUI();
  const [search,setSearch]=useState("");
  const shown=programs.filter(p=>matches(search,p.name,p.category,p.level));
  return(
    <Modal onClose={onClose} title="Assigner un programme" width={560}>
      <SearchBox value={search} onChange={setSearch} placeholder="Nom, catégorie, niveau…" style={{marginBottom:12}} autoFocus={wide}/>
      {shown.length===0&&<EmptyState icon="clipboard" title="Aucun programme" text="Tous tes programmes sont déjà assignés, ou aucun ne correspond."/>}
      {shown.map(p=>(
        <button key={p.id} type="button" onClick={()=>onPick(p)} className="hov"
          style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",marginBottom:8,borderRadius:14,border:`1px solid ${C.line}`,background:C.soft,color:G.white,textAlign:"left",cursor:"pointer"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14.5,...ellipsis}}>{p.name}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3}}>{[p.category,p.level,`${(p.weeks||[]).length} sem.`,`${p.weeks?.[0]?.days?.length||0} j/sem`].filter(Boolean).join(" · ")}</div>
          </div>
          <Icon name="plus" size={18} color={G.goldLight}/>
        </button>
      ))}
    </Modal>
  );
}

function ClientHistoryTab({data,client:c,upd}){
  const {programs}=data;
  const {confirm}=useUI();
  const [adding,setAdding]=useState(false);
  const logs=[...(c.sessionLogs||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const removeLog=async log=>{
    const ok=await confirm({title:"Supprimer cette séance ?",text:`${log.dayLabel||"Séance"} du ${fmtDate(log.date)} sera retirée de l'historique.`,confirm:"Supprimer",danger:true});
    if(ok) upd(x=>({...x,sessions:Math.max(0,(Number(x.sessions)||0)-(log.completed?1:0)),sessionLogs:(x.sessionLogs||[]).filter(l=>l!==log&&(log.id==null||l.id!==log.id))}));
  };
  return(
    <>
      <Btn variant="ghost" icon="plus" style={{width:"100%",marginBottom:14}} onClick={()=>setAdding(true)}>Ajouter une séance manuellement</Btn>
      {logs.length===0&&<EmptyState icon="history" title="Aucune séance" text={`Les séances terminées par ${firstName(c.name)} dans son application apparaîtront ici.`}/>}
      {logs.map((log,i)=><LogCard key={log.id||i} log={log} programs={programs} onDelete={()=>removeLog(log)}/>)}
      {adding&&<ManualLogModal data={data} client={c} upd={upd} onClose={()=>setAdding(false)}/>}
    </>
  );
}

function LogCard({log,programs,onDelete}){
  const [open,setOpen]=useState(false);
  const prog=programs.find(p=>String(p.id)===String(log.programId));
  const sets=(log.exercises||[]).reduce((a,e)=>a+(e.sets||[]).length,0);
  return(
    <Card style={{padding:0,marginBottom:8,overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center"}}>
        <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:12,padding:14,background:"none",border:"none",color:G.white,textAlign:"left",cursor:"pointer"}}>
          <div style={{width:38,height:38,borderRadius:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:(log.completed?G.green:G.red)+"18",color:log.completed?G.green:G.red}}>
            <Icon name={log.completed?"check":"x"} size={18} sw={2.4}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14.5,...ellipsis}}>{log.dayLabel||"Séance"}{prog?<span style={{color:C.muted,fontWeight:600}}> · {prog.name}</span>:null}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:3,...ellipsis}}>{fmtDate(log.date)}{log.weekLabel?` · ${log.weekLabel}`:""}{log.duration?` · ${fmtDuration(log.duration)}`:""}{sets?` · ${sets} séries`:""}</div>
          </div>
          <Icon name="down" size={17} color={C.muted} style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}/>
        </button>
      </div>
      {open&&(
        <div style={{padding:"0 14px 14px",animation:"fadeIn .2s ease"}}>
          {log.notes&&<div style={{fontSize:13,color:"#ccc",lineHeight:1.5,padding:"10px 12px",background:"#0b0b0b",borderRadius:12,marginBottom:12,borderLeft:`3px solid ${G.gold}`}}>« {log.notes} »</div>}
          {(log.exercises||[]).map((ex,i)=>(
            <div key={i} style={{marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13.5,color:G.goldLight,marginBottom:7}}>{ex.name}{ex.sensation?` ${ex.sensation}`:""}
                {ex.kind==="text"&&<span style={{marginLeft:8,fontSize:12,color:ex.done?G.green:C.muted}}>{ex.done?"✓ fait":"non fait"}</span>}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(ex.sets||[]).map((s,j)=>(
                  <span key={j} style={{fontSize:12.5,fontWeight:700,padding:"6px 10px",borderRadius:10,background:"#0b0b0b",border:`1px solid ${C.line}`,color:s.load?G.white:C.muted}}>
                    {s.load||"—"} × {s.reps}{isTimed(s.reps)?"":""}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!(log.exercises||[]).length&&!log.notes&&<div style={{fontSize:13,color:C.muted,marginBottom:10}}>Aucun détail enregistré.</div>}
          {onDelete&&<Btn size="sm" variant="quiet" icon="trash" style={{color:G.red,paddingLeft:0}} onClick={onDelete}>Supprimer cette séance</Btn>}
        </div>
      )}
    </Card>
  );
}

function ManualLogModal({data,client:c,upd,onClose}){
  const {programs,exercises}=data;
  const assigned=programs.filter(p=>(c.programs||[]).includes(p.id));
  const [f,setF]=useState({date:todayISO(),programId:assigned[0]?String(assigned[0].id):"",weekIdx:"",dayIdx:"",completed:true,notes:""});
  const prog=programs.find(p=>String(p.id)===f.programId);
  const week=prog?.weeks?.[Number(f.weekIdx)];
  const day=f.dayIdx!==""?week?.days?.[Number(f.dayIdx)]:null;
  const save=()=>{
    const exEntries=(day?.exercises||[]).map(pe=>isTextBlock(pe)?{kind:"text",name:pe.title||"Bloc libre",done:true,sets:[]}:({exId:pe.exId,name:exercises.find(e=>e.id===pe.exId)?.name||"",
      sets:Array.from({length:Number(pe.sets)||1},()=>({reps:pe.reps,load:pe.targetLoad||""}))}));
    const log={id:uid(),date:f.date,programId:prog?prog.id:"",weekIdx:f.weekIdx===""?"":Number(f.weekIdx),dayIdx:f.dayIdx===""?"":Number(f.dayIdx),
      dayLabel:day?.label||"Séance",weekLabel:week?.label||"",completed:f.completed,notes:f.notes,exercises:exEntries,manual:true};
    upd(x=>({...x,sessions:(Number(x.sessions)||0)+(f.completed?1:0),sessionLogs:[log,...(x.sessionLogs||[])]}));
    onClose();
  };
  return(
    <Modal onClose={onClose} title="Ajouter une séance" width={480}
      footer={<><Btn variant="ghost" style={{flex:1}} onClick={onClose}>Annuler</Btn><Btn style={{flex:2}} onClick={save}>Enregistrer</Btn></>}>
      <Field label="Date"><TextInput type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/></Field>
      <Field label="Programme">
        <Select value={f.programId} onChange={e=>setF(p=>({...p,programId:e.target.value,weekIdx:"",dayIdx:""}))}>
          <option value="">Séance libre (hors programme)</option>
          {assigned.map(p=><option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </Select>
      </Field>
      {prog&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Field label="Semaine">
            <Select value={f.weekIdx} onChange={e=>setF(p=>({...p,weekIdx:e.target.value,dayIdx:""}))}>
              <option value="">—</option>
              {prog.weeks.map((w,i)=><option key={i} value={i}>S{i+1}</option>)}
            </Select>
          </Field>
          <Field label="Séance">
            <Select value={f.dayIdx} disabled={!week} onChange={e=>setF(p=>({...p,dayIdx:e.target.value}))}>
              <option value="">—</option>
              {(week?.days||[]).map((d,i)=><option key={i} value={i}>{d.label}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <Field label="Statut">
        <Segmented value={f.completed?"done":"missed"} onChange={v=>setF(p=>({...p,completed:v==="done"}))} options={[["done","Faite"],["missed","Manquée"]]}/>
      </Field>
      <Field label="Notes"><TextArea value={f.notes} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Ressenti, charges, remarques…"/></Field>
    </Modal>
  );
}

const PERF_SECTIONS=[
  {label:"Cardio",fields:[["fcmax","FCmax","bpm"],["vma","VMA","km/h"]]},
  {label:"Force (1RM estimé)",fields:[["rm_squat","Squat","kg"],["rm_bench","Développé couché","kg"],["rm_sdt","Soulevé de terre","kg"]]},
  {label:"Tests au poids du corps",fields:[["tractions_max","Tractions max","reps"],["pompes_max","Pompes max","reps"],["gainage_max","Gainage planche","sec"]]},
];
function ClientPerfsTab({client:c,upd}){
  const {wide,toast}=useUI();
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({...EMPTY_TESTS,...(c.tests||{})});
  const t=c.tests||{};
  const start=()=>{setForm({...EMPTY_TESTS,...(c.tests||{})});setEditing(true);};
  const save=()=>{upd(x=>({...x,tests:form}));setEditing(false);toast("Performances enregistrées");};
  return(
    <>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:4}}>
        <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>Les charges en % des programmes sont calculées à partir de ces valeurs.</div>
        {editing
          ?<div style={{display:"flex",gap:8}}><Btn size="sm" variant="ghost" onClick={()=>setEditing(false)}>Annuler</Btn><Btn size="sm" icon="check" onClick={save}>Enregistrer</Btn></div>
          :<Btn size="sm" variant="ghost" icon="edit" onClick={start}>Modifier</Btn>}
      </div>
      {PERF_SECTIONS.map(sec=>(
        <div key={sec.label}>
          <SectionTitle>{sec.label}</SectionTitle>
          <div style={{display:"grid",gridTemplateColumns:wide?"repeat(3,1fr)":"1fr 1fr",gap:10}}>
            {sec.fields.map(([k,label,unit])=>(
              <Card key={k} style={{padding:"12px 14px"}}>
                <div style={{fontSize:11.5,color:C.muted,marginBottom:8}}>{label}</div>
                {editing?(
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <TextInput type="number" inputMode="decimal" value={form[k]} placeholder="—" onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} style={{height:38,textAlign:"center",fontWeight:700}}/>
                    <span style={{fontSize:12,color:C.muted}}>{unit}</span>
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"baseline",gap:5}}>
                    <span style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,color:t[k]?G.goldLight:C.dim,lineHeight:1}}>{t[k]||"—"}</span>
                    {t[k]&&<span style={{fontSize:12,color:C.muted}}>{unit}</span>}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
      <SectionTitle>Notes</SectionTitle>
      {editing
        ?<TextArea value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Conditions des tests, dates, observations…"/>
        :<Card style={{fontSize:14,color:t.notes?"#ddd":C.dim,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{t.notes||"Aucune note"}</Card>}
    </>
  );
}

function ClientNutritionTab({data,client:c,upd}){
  const {foods,mealTemplate,setMealTemplate}=data;
  const {toast}=useUI();
  const [live,setLive]=useState(null);
  const [notes,setNotes]=useState(c.nutrition?.notes||"");
  const stored=(c.mealPlan?.meals||[]).flatMap(m=>m.items||[]);
  const src=live||(stored.length?calcMacros(stored,foods):null);
  const n=c.nutrition||{};
  const kcal=src?rnd(src.kcal):n.calories||0;
  const macros=[["Protéines",src?rnd1(src.protein):n.proteins||0,G.goldLight,300],["Glucides",src?rnd1(src.carbs):n.carbs||0,G.gold,500],["Lipides",src?rnd1(src.fat):n.fats||0,"#a08a4c",150]];
  const notesDirty=notes!==(n.notes||"");
  const saveTemplate=meals=>{
    setDoc(doc(db,"settings","mealTemplate"),{meals})
      .then(()=>{setMealTemplate(meals);toast("Modèle enregistré : il sera appliqué aux nouveaux clients");})
      .catch(()=>toast("Impossible d'enregistrer le modèle"));
  };
  return(
    <>
      <Card>
        <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}>
          <div style={{minWidth:120}}>
            <div style={{fontFamily:G.fontD,fontSize:46,fontWeight:800,color:G.goldLight,lineHeight:1}}>{kcal}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>kcal / jour{live?" · aperçu":""}</div>
          </div>
          <div style={{flex:1,minWidth:200}}>
            {macros.map(([l,v,col,max])=>(
              <div key={l} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12.5,marginBottom:5}}><span style={{color:C.muted}}>{l}</span><span style={{fontWeight:700}}>{v} g</span></div>
                <ProgressBar value={v} max={max} color={col}/>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <SectionTitle>Notes, allergies, préférences</SectionTitle>
      <TextArea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Sans gluten, shake après l'entraînement…"/>
      {notesDirty&&<Btn size="sm" icon="check" style={{marginTop:8}} onClick={()=>{upd(x=>({...x,nutrition:{...(x.nutrition||{}),notes}}));toast("Notes enregistrées");}}>Enregistrer les notes</Btn>}
      <SectionTitle>Plan alimentaire</SectionTitle>
      <MealPlanEditor key={c.id} foods={foods} mealPlan={c.mealPlan} template={mealTemplate} onSaveTemplate={saveTemplate} onLiveChange={setLive}
        onSave={(mp,totals)=>{
          setLive(null);
          upd(x=>({...x,mealPlan:mp,...(totals.kcal>0?{nutrition:{...(x.nutrition||{}),calories:rnd(totals.kcal),proteins:rnd1(totals.protein),carbs:rnd1(totals.carbs),fats:rnd1(totals.fat)}}:{})}));
          toast("Plan alimentaire enregistré");
        }}/>
    </>
  );
}

function MealPlanEditor({mealPlan,foods,onSave,onLiveChange,template,onSaveTemplate}){
  const {wide}=useUI();
  const fromMeals=meals=>MEAL_SLOTS.map(s=>{
    const m=(meals||[]).find(x=>x.id===s.id);
    return {id:s.id,label:s.label,icon:s.icon,items:clone(m?.items||[]),note:m?.note||""};
  });
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState(()=>fromMeals(mealPlan?.meals));
  const [picker,setPicker]=useState(null);
  const [search,setSearch]=useState("");
  const stripped=()=>form.map(({icon,...rest})=>rest); // eslint-disable-line no-unused-vars
  const totals=calcMacros(form.flatMap(m=>m.items),foods);
  const hasPlan=form.some(m=>m.items.length>0);

  useEffect(()=>{if(editing&&onLiveChange)onLiveChange(totals);},[form,editing]); // eslint-disable-line

  const startEdit=(useTemplate=false)=>{setForm(useTemplate&&template?fromMeals(template):fromMeals(mealPlan?.meals));setEditing(true);};
  const cancel=()=>{setForm(fromMeals(mealPlan?.meals));onLiveChange?.(null);setEditing(false);};
  const save=()=>{onSave({meals:stripped()},totals);onLiveChange?.(null);setEditing(false);};
  const setMeal=(id,fn)=>setForm(f=>f.map(m=>m.id===id?fn(m):m));
  const addItem=foodId=>{
    const food=foods.find(x=>x.id===foodId);
    setMeal(picker,m=>({...m,items:[...m.items,{foodId,qty:food?.unit==="g"?100:1}]}));
    setPicker(null);setSearch("");
  };

  if(!editing) return(
    <Card>
      {!hasPlan?(
        <EmptyState icon="leaf" title="Pas encore de plan alimentaire" text="Compose les repas : les calories et les macros sont calculées automatiquement."
          action={<div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
            {template&&<Btn icon="copy" onClick={()=>startEdit(true)}>Partir du modèle</Btn>}
            <Btn variant={template?"ghost":"gold"} icon="plus" onClick={()=>startEdit(false)}>Créer le plan</Btn>
          </div>}/>
      ):(
        <>
          {form.filter(m=>m.items.length).map(m=>(
            <div key={m.id} style={{paddingBottom:12,marginBottom:12,borderBottom:`1px solid ${C.line}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:12,color:G.gold,fontWeight:700,letterSpacing:.6,textTransform:"uppercase"}}>{m.icon} {m.label}</div>
                <div style={{fontSize:12,color:C.muted}}>{rnd(calcMacros(m.items,foods).kcal)} kcal</div>
              </div>
              {m.items.map((it,i)=>{
                const food=foods.find(x=>x.id===it.foodId);
                return food?<div key={i} style={{fontSize:14,marginBottom:3}}>{food.name} <span style={{color:C.muted}}>— {it.qty} {food.unit==="g"?"g":"port."}</span></div>:null;
              })}
              {m.note&&<div style={{fontSize:12.5,color:C.muted,marginTop:6,whiteSpace:"pre-wrap"}}>{m.note}</div>}
            </div>
          ))}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn size="sm" icon="edit" onClick={()=>startEdit(false)}>Modifier le plan</Btn>
            <Btn size="sm" variant="ghost" icon="copy" onClick={()=>onSaveTemplate(stripped())}>Définir comme modèle</Btn>
          </div>
        </>
      )}
    </Card>
  );

  const shownFoods=foods.filter(x=>matches(search,x.name));
  return(
    <>
      <Card style={{position:"sticky",top:0,zIndex:5,display:"flex",justifyContent:"space-around",padding:"12px 8px",marginBottom:12,background:"#141414"}}>
        {[[rnd(totals.kcal),"kcal"],[rnd1(totals.protein)+"g","Prot."],[rnd1(totals.carbs)+"g","Gluc."],[rnd1(totals.fat)+"g","Lip."]].map(([v,l])=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontFamily:G.fontD,fontSize:21,fontWeight:800,color:G.goldLight,lineHeight:1}}>{v}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:3}}>{l}</div>
          </div>
        ))}
      </Card>
      {template&&<Btn size="sm" variant="ghost" icon="copy" style={{marginBottom:12}} onClick={()=>setForm(fromMeals(template))}>Remplacer par le modèle</Btn>}
      {form.map(m=>(
        <Card key={m.id} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:13,color:G.goldLight,fontWeight:700}}>{m.icon} {m.label}</div>
            {m.items.length>0&&<div style={{fontSize:12,color:C.muted}}>{rnd(calcMacros(m.items,foods).kcal)} kcal</div>}
          </div>
          {m.items.map((it,i)=>{
            const food=foods.find(x=>x.id===it.foodId);
            if(!food) return null;
            const im=calcMacros([it],foods);
            return(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,background:"#0b0b0b",borderRadius:12,padding:"8px 10px"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13.5,fontWeight:600,...ellipsis}}>{food.name}</div>
                  <div style={{fontSize:11.5,color:C.muted,marginTop:2}}>{rnd(im.kcal)} kcal · P {rnd1(im.protein)} · G {rnd1(im.carbs)} · L {rnd1(im.fat)}</div>
                </div>
                <input className="inp" type="number" inputMode="decimal" min="0" value={it.qty} aria-label="Quantité"
                  onChange={e=>setMeal(m.id,x=>({...x,items:x.items.map((y,j)=>j===i?{...y,qty:parseFloat(e.target.value)||0}:y)}))}
                  style={{...inputStyle,width:70,height:36,padding:"0 6px",textAlign:"center",fontWeight:700,color:G.goldLight}}/>
                <span style={{fontSize:11.5,color:C.muted,width:30}}>{food.unit==="g"?"g":"port."}</span>
                <IconBtn icon="x" label="Retirer" variant="quiet" size={32} onClick={()=>setMeal(m.id,x=>({...x,items:x.items.filter((_,j)=>j!==i)}))}/>
              </div>
            );
          })}
          <Btn size="sm" variant="quiet" icon="plus" style={{color:G.goldLight,paddingLeft:2}} onClick={()=>{setPicker(m.id);setSearch("");}}>Ajouter un aliment</Btn>
          <TextArea value={m.note} onChange={e=>setMeal(m.id,x=>({...x,note:e.target.value}))} placeholder="Note pour ce repas (préparation, timing…)" style={{minHeight:56,marginTop:6,fontSize:14}}/>
        </Card>
      ))}
      <div style={{display:"flex",gap:10,position:"sticky",bottom:0,padding:"10px 0",background:`linear-gradient(0deg,${G.bg} 70%,transparent)`}}>
        <Btn variant="ghost" style={{flex:1}} onClick={cancel}>Annuler</Btn>
        <Btn icon="check" style={{flex:2}} onClick={save}>Enregistrer le plan</Btn>
      </div>
      {picker&&(
        <Modal onClose={()=>setPicker(null)} title="Ajouter un aliment" width={560}>
          <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un aliment…" style={{marginBottom:12}} autoFocus={wide}/>
          {shownFoods.map(food=>(
            <button key={food.id} type="button" onClick={()=>addItem(food.id)} className="hov"
              style={{width:"100%",textAlign:"left",padding:"11px 13px",marginBottom:6,borderRadius:12,border:`1px solid ${C.line}`,background:C.soft,color:G.white,cursor:"pointer"}}>
              <div style={{fontWeight:600,fontSize:14}}>{food.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:3}}>{food.kcal} kcal · P {food.protein} · G {food.carbs} · L {food.fat} <span style={{color:G.gold}}>/ {food.unit==="g"?"100 g":"portion"}</span></div>
            </button>
          ))}
          {shownFoods.length===0&&<EmptyState icon="leaf" title="Aucun aliment trouvé" text="Ajoute-le dans Bibliothèque → Aliments."/>}
        </Modal>
      )}
    </>
  );
}

// ─── PROGRAMMES ───────────────────────────────────────────────────────────────
const blankProgram=()=>({name:"",category:"",level:"Intermédiaire",weeks:[{label:"Semaine 1",days:[{label:"Séance A",exercises:[]}]}]});
function ProgramsView({data,nav,go}){
  const {wide,toast}=useUI();
  const {programs,setPrograms}=data;
  const sel=programs.find(p=>String(p.id)===String(nav.programId));
  const mode=nav.mode||"detail";
  let right=null;
  if(mode==="new"){
    right=<ProgramEditor key="new" data={data} init={blankProgram()} title="Nouveau programme"
      onSave={form=>{const np={...form,id:Date.now()};setPrograms(p=>[...p,np]);toast("Programme créé");go("programs",{programId:np.id});}}
      onCancel={()=>go("programs")}/>;
  }else if(sel&&mode==="edit"){
    right=<ProgramEditor key={`edit-${sel.id}`} data={data} init={clone(sel)} title="Modifier le programme"
      onSave={form=>{setPrograms(p=>p.map(x=>x.id===form.id?form:x));toast("Programme enregistré");go("programs",{programId:form.id});}}
      onCancel={()=>go("programs",{programId:sel.id})}/>;
  }else if(sel){
    right=<ProgramDetail key={sel.id} data={data} program={sel} go={go} onBack={wide?null:()=>go("programs")} backLabel="Programmes"/>;
  }
  const list=<ProgramList data={data} selId={sel?.id} onOpen={p=>go("programs",{programId:p.id})} onNew={()=>go("programs",{mode:"new"})}/>;
  if(wide) return(
    <div style={{display:"flex",height:"100dvh"}}>
      <div style={{width:350,flexShrink:0,borderRight:`1px solid ${C.line}`,overflowY:"auto",padding:"30px 18px"}}>{list}</div>
      <div style={{flex:1,minWidth:0,overflowY:"auto"}}>
        {right||<EmptyState icon="clipboard" title="Sélectionne un programme" text="Ou crée-en un nouveau, à la main ou avec l'IA Coach."/>}
      </div>
    </div>
  );
  return right||<Pad>{list}</Pad>;
}

function ProgramList({data,selId,onOpen,onNew}){
  const {programs,clients}=data;
  const [search,setSearch]=useState("");
  const [level,setLevel]=useState("all");
  const levels=[...new Set(programs.map(p=>p.level).filter(Boolean))];
  const nClients=p=>clients.filter(c=>(c.programs||[]).includes(p.id)).length;
  const shown=programs.filter(p=>matches(search,p.name,p.category)&&(level==="all"||p.level===level)).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
  return(
    <>
      <PageHeader title="Programmes" sub={`${programs.length} programme${programs.length>1?"s":""}`} actions={<Btn size="sm" icon="plus" onClick={onNew}>Nouveau</Btn>}/>
      <SearchBox value={search} onChange={setSearch} placeholder="Nom ou catégorie…"/>
      {levels.length>1&&<div style={{margin:"10px 0 4px"}}><FilterChips value={level} onChange={setLevel} options={[["all","Tous"],...levels.map(l=>[l,l])]}/></div>}
      <div style={{height:10}}/>
      {shown.length===0&&<EmptyState icon="clipboard" title={programs.length?"Aucun résultat":"Aucun programme"} text={programs.length?"Essaie une autre recherche.":"Crée ton premier programme."}/>}
      {shown.map(p=>{
        const a=String(p.id)===String(selId);
        const n=nClients(p);
        return(
          <button key={p.id} type="button" onClick={()=>onOpen(p)} className={a?undefined:"hov"}
            style={{width:"100%",display:"block",padding:"12px 14px",marginBottom:6,borderRadius:14,textAlign:"left",cursor:"pointer",color:G.white,
              background:a?G.gold+"12":"transparent",border:`1px solid ${a?G.gold+"44":"transparent"}`}}>
            <div style={{fontWeight:700,fontSize:14.5,...ellipsis}}>{p.name}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7}}>
              {p.level&&<Chip>{p.level}</Chip>}
              <Chip>{(p.weeks||[]).length} sem. · {p.weeks?.[0]?.days?.length||0} j</Chip>
              {n>0&&<Chip gold><Icon name="users" size={12}/>{n}</Chip>}
              {p._copy&&<Chip>Perso</Chip>}
            </div>
          </button>
        );
      })}
    </>
  );
}

function ProgramDetail({data,program,client,go,onBack,backLabel}){
  const {wide,confirm,toast}=useUI();
  const {setPrograms,clients,setClients,exercises}=data;
  const logs=client?.sessionLogs||[];
  const first=client?nextSessionOf(program,logs):null;
  const [wi,setWi]=useState(first?.wi||0);
  const [di,setDi]=useState(first?.di||0);
  const week=program.weeks?.[wi];
  const day=week?.days?.[di];
  const dayLog=client?findDoneLog(logs,program.id,wi,di):null;
  const users=clients.filter(c=>(c.programs||[]).includes(program.id));

  const duplicate=()=>{
    const copy={...clone(program),id:Date.now(),name:`${program.name} (copie)`};
    delete copy._v;
    setPrograms(p=>[...p,copy]);
    toast("Programme dupliqué");
    go("programs",{programId:copy.id,mode:"edit"});
  };
  const remove=async()=>{
    const ok=await confirm({title:"Supprimer ce programme ?",danger:true,confirm:"Supprimer",
      text:users.length?`Il est assigné à ${users.map(u=>firstName(u.name)).join(", ")} : il sera retiré de leur application. L'historique des séances est conservé.`:"Cette action est définitive."});
    if(!ok)return;
    setPrograms(p=>p.filter(x=>x.id!==program.id));
    if(users.length) setClients(cs=>cs.map(c=>(c.programs||[]).includes(program.id)?{...c,programs:c.programs.filter(id=>id!==program.id)}:c));
    go("programs");
  };

  return(
    <Pad max={980}>
      {onBack&&<BackLink onClick={onBack} label={backLabel}/>}
      <div style={{display:"flex",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200}}>
          {client&&<div style={{...eyebrow,color:G.gold,marginBottom:6}}>Suivi de {firstName(client.name)}</div>}
          <div style={{fontFamily:G.fontD,fontSize:wide?34:28,fontWeight:800,letterSpacing:-.8,lineHeight:1.05}}>{program.name}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
            {program.category&&<Chip>{program.category}</Chip>}
            {program.level&&<Chip>{program.level}</Chip>}
            <Chip>{(program.weeks||[]).length} semaine{(program.weeks||[]).length>1?"s":""}</Chip>
            {client&&(()=>{const pp=progProgress(program,logs);return <Chip color={G.green}>{pp.done}/{pp.total} séances faites</Chip>;})()}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn size="sm" icon="edit" onClick={()=>go("programs",{programId:program.id,mode:"edit"})}>Modifier</Btn>
          {!client&&<IconBtn icon="copy" label="Dupliquer" onClick={duplicate}/>}
          {!client&&<IconBtn icon="trash" label="Supprimer" variant="danger" onClick={remove}/>}
        </div>
      </div>

      {!client&&users.length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:16}}>
          <span style={{fontSize:12.5,color:C.muted}}>Assigné à</span>
          {users.map(u=>(
            <button key={u.id} type="button" onClick={()=>go("clients",{clientId:u.id})} className="hov"
              style={{display:"inline-flex",alignItems:"center",gap:7,height:32,padding:"0 10px 0 4px",borderRadius:99,border:`1px solid ${C.line2}`,background:C.soft,color:G.white,cursor:"pointer",fontSize:13,fontWeight:600}}>
              <Avatar name={u.name} color={u.color} size={24}/>{firstName(u.name)}
            </button>
          ))}
        </div>
      )}

      <div className="noscroll" style={{display:"flex",gap:8,overflowX:"auto",margin:"22px 0 12px",paddingBottom:2}}>
        {(program.weeks||[]).map((w,i)=>{
          const a=i===wi;
          const complete=client&&(w.days||[]).length>0&&(w.days||[]).every((_,j)=>findDoneLog(logs,program.id,i,j));
          return(
            <button key={i} type="button" onClick={()=>{setWi(i);setDi(0);}} title={w.label}
              style={{flexShrink:0,minWidth:56,height:52,borderRadius:15,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
                background:a?C.goldGrad:C.soft,color:a?G.bg:G.white,border:`1px solid ${a?"transparent":C.line}`}}>
              <span style={{fontSize:9.5,fontWeight:700,opacity:.7,letterSpacing:1}}>SEM.</span>
              <span style={{fontFamily:G.fontD,fontSize:18,fontWeight:800,lineHeight:1}}>{complete?<Icon name="check" size={16} sw={2.6}/>:i+1}</span>
            </button>
          );
        })}
      </div>
      {week&&<div style={{fontSize:13,color:C.muted,margin:"0 2px 12px"}}>{week.label}</div>}
      {week&&(
        <Segmented value={di} onChange={setDi} style={{marginBottom:16}}
          options={(week.days||[]).map((d,j)=>[j,`${client&&findDoneLog(logs,program.id,wi,j)?"✓ ":""}${d.label}`,(d.exercises||[]).length])}/>
      )}

      {dayLog&&(
        <Card style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,borderColor:G.green+"44",padding:14}}>
          <Icon name="check" size={20} color={G.green} sw={2.4}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:700,fontSize:14,color:G.green}}>Séance faite {fmtRel(dayLog.date)}{dayLog.duration?` · ${fmtDuration(dayLog.duration)}`:""}</div>
            {dayLog.notes&&<div style={{fontSize:13,color:"#ccc",marginTop:3}}>« {dayLog.notes} »</div>}
          </div>
        </Card>
      )}

      {day&&(day.exercises||[]).length>0&&<SessionDuration day={day} exercises={exercises} style={{marginBottom:12}}/>}
      {(!day||!(day.exercises||[]).length)&&<EmptyState icon="dumbbell" title="Séance vide" text="Ajoute des exercices en modifiant le programme."/>}
      <div style={{display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:10}}>
        {(()=>{
        const list=day?.exercises||[];
        const labels=blockLabels(list);
        const card=(pe,i)=>{
          if(isTextBlock(pe)) return(
            <Card key={i} style={{padding:14,gridColumn:"1 / -1",borderColor:G.gold+"33"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{minWidth:30,height:30,padding:"0 4px",borderRadius:10,background:G.gold+"18",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:15,flexShrink:0}}>{labels[i]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15}}>{pe.title||"Bloc libre"}{textMinutes(pe)>0&&<span style={{fontSize:13,color:C.muted,fontWeight:600}}> · ≈ {fmtMinutes(textMinutes(pe))}</span>}</div>
                  <div style={{fontSize:13.5,color:"#d0d0d0",marginTop:6,lineHeight:1.55,whiteSpace:"pre-wrap"}}>{pe.text||"—"}</div>
                </div>
              </div>
            </Card>
          );
          const ex=exercises.find(e=>e.id===pe.exId);
          const comp=computeLoad(pe,client?.tests);
          const ref=LOAD_REFS.find(r=>r.id===pe.loadRef&&r.id!=="none");
          const res=dayLog?.exercises?.find(e=>e.exId===pe.exId);
          const chained=isChained(list,i);
          return(
            <Card key={i} style={{padding:14,borderColor:res?G.green+"33":C.line}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{minWidth:30,height:30,padding:"0 4px",borderRadius:10,background:G.gold+"18",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:15,flexShrink:0}}>{labels[i]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15}}>{ex?.name||"Exercice supprimé"}</div>
                  <div style={{fontSize:13,color:"#c8c8c8",marginTop:4}}>{pe.sets} × {pe.reps}{chained?<span style={{color:G.goldLight}}> · enchaîner sans repos</span>:pe.rest?<span style={{color:C.muted}}> · repos {pe.rest}</span>:null}</div>
                  {pe.targetLoad&&<div style={{fontSize:12.5,color:G.goldLight,marginTop:4}}>🎯 {comp?`${comp.value} ${comp.unit} (${comp.pct}% ${comp.label.replace("% ","")})`:`${pe.targetLoad}${ref?` · ${ref.label}`:""}`}</div>}
                  {pe.note&&<div style={{fontSize:12.5,color:"#bbb",marginTop:6,lineHeight:1.45}}>📝 {pe.note}</div>}
                </div>
                {ex&&<VideoBtn ex={ex}/>}
              </div>
              {res&&(
                <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                  <div style={{fontSize:11,color:G.green,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>Réalisé {res.sensation||""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {(res.sets||[]).map((s,j)=><span key={j} style={{fontSize:12.5,fontWeight:700,padding:"5px 9px",borderRadius:9,background:"#0b0b0b",border:`1px solid ${C.line}`,color:s.load?G.white:C.muted}}>{s.load||"—"} × {s.reps}</span>)}
                  </div>
                </div>
              )}
            </Card>
          );
        };
        return exBlocks(list).map(b=>{
          if(b.items.length===1) return card(b.items[0].pe,b.start);
          const tail=b.items[b.items.length-1].pe;
          return(
            <div key={`grp-${b.start}`} style={{gridColumn:"1 / -1",border:`1.5px solid ${G.gold}66`,borderRadius:20,padding:10,background:`linear-gradient(180deg,${G.gold}12,transparent 70%)`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"2px 4px 10px"}}>
                <Chip gold><Icon name="link" size={12}/>{blockKind(b.items.length)}</Chip>
                <span style={{fontSize:12.5,color:"#ccc"}}>À enchaîner sans repos{tail.rest?<> · repos <b style={{color:G.goldLight}}>{tail.rest}</b> après le tour</>:""}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:8}}>{b.items.map(x=>card(x.pe,x.i))}</div>
            </div>
          );
        });
        })()}
      </div>
    </Pad>
  );
}

// Durée estimée d'une séance : effort (reps × temps par rép. ou durée) + récupérations
function SessionDuration({day,exercises,style}){
  const b=sessionBreakdown(day,exercises);
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",padding:"10px 12px",borderRadius:14,background:G.gold+"0f",border:`1px solid ${G.gold}33`,...style}}>
      <Icon name="clock" size={18} color={G.goldLight}/>
      <span style={{fontSize:14,fontWeight:700}}>Durée estimée <span style={{color:G.goldLight,fontFamily:G.fontD,fontSize:18,fontWeight:800,marginLeft:4}}>≈ {fmtMinutes(b.total/60)}</span></span>
      <span style={{fontSize:12.5,color:C.muted}}>{fmtMinutes(b.work/60)} d'effort · {fmtMinutes(b.rest/60)} de récupération</span>
    </div>
  );
}

const LEVELS=["Débutant","Intermédiaire","Avancé","Tous niveaux"];
function ProgramEditor({data,init,title,onSave,onCancel}){
  const {exercises,setExercises}=data;
  const {wide,confirm,toast}=useUI();
  const [form,setForm]=useState(init);
  const [wi,setWi]=useState(0);
  const [di,setDi]=useState(0);
  const [picker,setPicker]=useState(false);
  const [creating,setCreating]=useState(null); // {name, muscle} : création rapide d'un exercice manquant
  const [openNotes,setOpenNotes]=useState({});
  const initial=useRef(JSON.stringify(init));
  const week=form.weeks[wi];
  const day=week?.days[di];
  const total=exCount(form);

  const setWeeks=fn=>setForm(p=>({...p,weeks:fn(p.weeks)}));
  const setDay=fn=>setWeeks(ws=>ws.map((w,i)=>i!==wi?w:{...w,days:w.days.map((d,j)=>j!==di?d:fn(d))}));
  const addWeek=()=>{setWeeks(ws=>[...ws,{label:`Semaine ${ws.length+1}`,days:[{label:"Séance A",exercises:[]}]}]);setWi(form.weeks.length);setDi(0);};
  const duplicateWeek=()=>{const copy=clone(week);copy.label=`Semaine ${form.weeks.length+1}`;setWeeks(ws=>[...ws.slice(0,wi+1),copy,...ws.slice(wi+1)]);setWi(wi+1);setDi(0);};
  const removeWeek=async()=>{
    if(form.weeks.length<=1)return;
    if(!(await confirm({title:`Supprimer ${week.label} ?`,text:"Toutes ses séances seront retirées du programme.",confirm:"Supprimer",danger:true})))return;
    setWeeks(ws=>ws.filter((_,i)=>i!==wi));setWi(Math.max(0,wi-1));setDi(0);
  };
  const addDay=()=>{const letters="ABCDEFG";setWeeks(ws=>ws.map((w,i)=>i!==wi?w:{...w,days:[...w.days,{label:`Séance ${letters[w.days.length]||w.days.length+1}`,exercises:[]}]}));setDi(week.days.length);};
  const removeDay=async()=>{
    if(week.days.length<=1)return;
    if(day.exercises.length&&!(await confirm({title:`Supprimer ${day.label} ?`,text:`${day.exercises.length} exercice(s) seront retirés.`,confirm:"Supprimer",danger:true})))return;
    setWeeks(ws=>ws.map((w,i)=>i!==wi?w:{...w,days:w.days.filter((_,j)=>j!==di)}));setDi(Math.max(0,di-1));
  };
  const toggleEx=ex=>setDay(d=>{
    const at=d.exercises.findIndex(e=>e.exId===ex.id);
    return {...d,exercises:at>=0?dropExAt(d.exercises,at):[...d.exercises,{exId:ex.id,sets:3,reps:"10",rest:"60s",targetLoad:"",loadRef:"none",note:""}]};
  });
  const updEx=(i,field,val)=>setDay(d=>({...d,exercises:d.exercises.map((e,j)=>j===i?{...e,[field]:val}:e)}));
  // Monter / descendre : dans un superset on échange l'ordre sans casser le groupe ;
  // à la limite du groupe, l'exercice en sort et passe de l'autre côté du bloc voisin.
  const moveEx=(i,dir)=>setDay(d=>{
    const a=d.exercises.map(e=>({...e}));
    const blocks=exBlocks(a);
    const bi=blocks.findIndex(b=>b.items.some(x=>x.i===i));
    const b=blocks[bi];
    const k=b.items.findIndex(x=>x.i===i);
    if(dir<0?k>0:k<b.items.length-1){
      const j=i+dir,fi=!!a[i].linkNext,fj=!!a[j].linkNext;
      [a[i],a[j]]=[a[j],a[i]];
      a[i].linkNext=fi;a[j].linkNext=fj;
      return {...d,exercises:a};
    }
    const nb=blocks[bi+dir];
    if(!nb) return d;
    if(b.items.length>1&&k===b.items.length-1) a[i-1].linkNext=false;
    const [it]=a.splice(i,1);
    it.linkNext=false;
    a.splice(dir<0?nb.start:nb.start-1+nb.items.length,0,it);
    return {...d,exercises:a};
  });
  const removeEx=i=>setDay(d=>({...d,exercises:dropExAt(d.exercises,i)}));
  // Exercice manquant : créé dans la bibliothèque et ajouté directement à la séance en cours
  const createEx=f=>{
    const ex={...f,id:Date.now()};
    setExercises(p=>[...p,ex]);
    toggleEx(ex);
    setCreating(null);
    toast(`« ${ex.name} » créé et ajouté à ${day?.label||"la séance"}`);
  };
  const addText=()=>setDay(d=>({...d,exercises:[...d.exercises,{kind:"text",title:"",text:"",minutes:""}]}));
  const toggleLink=i=>setDay(d=>({...d,exercises:d.exercises.map((e,j)=>j===i?{...e,linkNext:!e.linkNext}:e)}));
  const cancel=async()=>{
    if(JSON.stringify(form)!==initial.current&&!(await confirm({title:"Abandonner les modifications ?",text:"Les changements non enregistrés seront perdus.",confirm:"Abandonner",danger:true})))return;
    onCancel();
  };
  const canSave=!!form.name.trim()&&total>0;

  return(
    <div>
      <div style={{position:"sticky",top:0,zIndex:20,background:"#080808ee",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:`1px solid ${C.line}`}}>
        <div style={{maxWidth:980,margin:"0 auto",padding:wide?"16px 36px":"12px 16px",display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:G.fontD,fontSize:wide?26:22,fontWeight:800,letterSpacing:-.5,...ellipsis}}>{title}</div>
            <div style={{fontSize:12,color:canSave?C.muted:ORANGE,marginTop:2}}>{!form.name.trim()?"Donne un nom au programme":total===0?"Ajoute au moins un exercice":`${form.weeks.length} sem. · ${total} exercices`}</div>
          </div>
          <Btn variant="ghost" size="sm" onClick={cancel}>Annuler</Btn>
          <Btn size="sm" icon="check" disabled={!canSave} onClick={()=>onSave({...form,name:form.name.trim()})}>Enregistrer</Btn>
        </div>
      </div>

      <Pad max={980}>
        <div style={{display:"grid",gridTemplateColumns:wide?"2fr 1fr 1fr":"1fr",gap:wide?12:0}}>
          <Field label="Nom du programme"><TextInput value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Full body 3 j/sem"/></Field>
          <Field label="Catégorie"><TextInput value={form.category||""} onChange={e=>setForm(p=>({...p,category:e.target.value}))} placeholder="Force, hypertrophie…"/></Field>
          <Field label="Niveau"><Select value={form.level||"Intermédiaire"} onChange={e=>setForm(p=>({...p,level:e.target.value}))}>{LEVELS.map(l=><option key={l}>{l}</option>)}</Select></Field>
        </div>

        <SectionTitle style={{marginTop:10}}>Semaines</SectionTitle>
        <div className="noscroll" style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:2}}>
          {form.weeks.map((w,i)=>{
            const a=i===wi;
            const n=w.days.reduce((s,d)=>s+d.exercises.length,0);
            return(
              <button key={i} type="button" onClick={()=>{setWi(i);setDi(0);}} style={{flexShrink:0,height:40,padding:"0 14px",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13,
                background:a?C.goldGrad:C.soft,color:a?G.bg:G.white,border:`1px solid ${a?"transparent":C.line2}`}}>
                S{i+1}<span style={{opacity:.6,fontSize:11,marginLeft:5}}>{n}</span>
              </button>
            );
          })}
          <button type="button" onClick={addWeek} style={{flexShrink:0,height:40,padding:"0 14px",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13,background:"transparent",color:G.goldLight,border:`1px dashed ${G.gold}66`,display:"flex",alignItems:"center",gap:6}}>
            <Icon name="plus" size={15}/>Semaine
          </button>
        </div>

        {week&&(
          <Card style={{marginTop:12,padding:wide?18:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              <input className="inp" value={week.label} aria-label="Nom de la semaine" onChange={e=>setWeeks(ws=>ws.map((w,i)=>i===wi?{...w,label:e.target.value}:w))}
                style={{...inputStyle,flex:1,minWidth:160,fontFamily:G.fontD,fontSize:19,fontWeight:800,color:G.goldLight,background:"transparent",border:"1px solid transparent",padding:"0 6px"}}/>
              <Btn size="sm" variant="ghost" icon="copy" onClick={duplicateWeek}>Dupliquer</Btn>
              {form.weeks.length>1&&<IconBtn icon="trash" label="Supprimer la semaine" variant="quiet" size={34} onClick={removeWeek}/>}
            </div>

            <div className="noscroll" style={{display:"flex",gap:6,overflowX:"auto",margin:"12px 0 14px",paddingBottom:2}}>
              {week.days.map((d,j)=>{
                const a=j===di;
                return(
                  <button key={j} type="button" onClick={()=>setDi(j)} style={{flexShrink:0,height:36,padding:"0 13px",borderRadius:11,cursor:"pointer",fontWeight:700,fontSize:13,
                    background:a?"#232323":"transparent",color:a?G.white:C.muted,border:`1px solid ${a?C.line2:C.line}`}}>
                    {d.label}<span style={{opacity:.55,fontSize:11,marginLeft:5}}>{d.exercises.length}</span>
                  </button>
                );
              })}
              {week.days.length<7&&<button type="button" onClick={addDay} style={{flexShrink:0,height:36,padding:"0 12px",borderRadius:11,cursor:"pointer",fontWeight:700,fontSize:13,background:"transparent",color:G.goldLight,border:`1px dashed ${G.gold}55`,display:"flex",alignItems:"center",gap:5}}><Icon name="plus" size={14}/>Séance</button>}
            </div>

            {day&&(
              <>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:day.exercises.length?8:12}}>
                  <input className="inp" value={day.label} aria-label="Nom de la séance" onChange={e=>setDay(d=>({...d,label:e.target.value}))}
                    style={{...inputStyle,flex:1,height:40,fontWeight:700,fontSize:15}}/>
                  {week.days.length>1&&<IconBtn icon="trash" label="Supprimer la séance" variant="quiet" size={36} onClick={removeDay}/>}
                </div>
                {day.exercises.length>0&&<SessionDuration day={day} exercises={exercises} style={{marginBottom:12}}/>}
                {(()=>{
                  const labels=blockLabels(day.exercises);
                  const last=day.exercises.length-1;
                  // Bouton entre deux exercices : lier (superset) ou délier
                  const linker=i=>{
                    const on=!!day.exercises[i].linkNext;
                    return(
                      <div key={`lk-${i}`} style={{display:"flex",justifyContent:"center",margin:"-2px 0 6px"}}>
                        <button type="button" onClick={()=>toggleLink(i)} aria-pressed={on}
                          title={on?"Séparer ces deux exercices":"Enchaîner ces deux exercices sans repos (superset)"}
                          style={{display:"inline-flex",alignItems:"center",gap:6,height:28,padding:"0 12px",borderRadius:99,cursor:"pointer",fontSize:12,fontWeight:700,
                            background:on?G.gold+"22":"transparent",color:on?G.goldLight:C.muted,border:`1px ${on?"solid":"dashed"} ${on?G.gold+"88":C.line2}`}}>
                          <Icon name="link" size={13}/>{on?"Enchaîné sans repos · délier":"Lier au suivant (superset)"}
                        </button>
                      </div>
                    );
                  };
                  const dur=sessionBreakdown(day,exercises).rows;
                  const moveBtns=i=>(<>
                    <IconBtn icon="up" label="Monter" variant="quiet" size={30} disabled={i===0} style={{opacity:i===0?.3:1}} onClick={()=>i>0&&moveEx(i,-1)}/>
                    <IconBtn icon="down" label="Descendre" variant="quiet" size={30} disabled={i===last} style={{opacity:i===last?.3:1}} onClick={()=>i<last&&moveEx(i,1)}/>
                    <IconBtn icon="x" label="Retirer" variant="quiet" size={30} onClick={()=>removeEx(i)}/>
                  </>);
                  // Bloc texte libre : le coach décrit le travail comme il veut (circuit, EMOM…)
                  const textCard=(pe,i)=>(
                    <div key={`txt-${i}`} style={{background:"#0b0b0b",border:`1px solid ${G.gold}33`,borderRadius:14,padding:12,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{minWidth:26,height:26,padding:"0 4px",borderRadius:8,background:G.gold+"18",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:13,flexShrink:0}}>{labels[i]}</div>
                        <input className="inp" value={pe.title||""} onChange={e=>updEx(i,"title",e.target.value)} placeholder="Titre — ex : Circuit final" aria-label="Titre du bloc"
                          style={{...inputStyle,flex:1,minWidth:0,height:34,fontSize:14,fontWeight:700,padding:"0 10px"}}/>
                        {dur[i].total>0&&<span style={{fontSize:12,color:C.muted,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>≈ {fmtMinutes(dur[i].total/60)}</span>}
                        {moveBtns(i)}
                      </div>
                      <TextArea value={pe.text||""} onChange={e=>updEx(i,"text",e.target.value)} aria-label="Ce que le client doit faire"
                        placeholder={"Écris librement ce que le client doit faire. Ex :\n3 tours, 1 min de repos entre les tours :\n- 10 burpees\n- 15 squats sautés\n- 20 mountain climbers"}
                        style={{minHeight:130,fontSize:14.5}}/>
                      <label style={{display:"flex",alignItems:"center",gap:8,marginTop:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:10.5,color:C.muted,fontWeight:700,letterSpacing:.6,textTransform:"uppercase"}}>Durée estimée</span>
                        <input className="inp" value={pe.minutes??""} onChange={e=>updEx(i,"minutes",e.target.value.replace(/[^\d.,]/g,""))} inputMode="decimal" placeholder="—"
                          style={{...inputStyle,width:70,height:34,fontSize:15,padding:"0 10px",textAlign:"center"}}/>
                        <span style={{fontSize:13,color:C.muted}}>min <span style={{color:C.dim}}>· comptée dans la durée de la séance</span></span>
                      </label>
                    </div>
                  );
                  const card=(pe,i,group)=>{
                  if(isTextBlock(pe)) return textCard(pe,i);
                  const ex=exercises.find(e=>e.id===pe.exId);
                  const showNote=openNotes[`${wi}-${di}-${i}`]||!!pe.note;
                  const chained=isChained(day.exercises,i);
                  return(
                    <div key={`${pe.exId}-${i}`} style={{background:"#0b0b0b",border:`1px solid ${group?G.gold+"33":C.line}`,borderRadius:14,padding:12,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                        <div style={{minWidth:26,height:26,padding:"0 4px",borderRadius:8,background:G.gold+"18",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:13,flexShrink:0}}>{labels[i]}</div>
                        <div style={{flex:1,minWidth:0,fontWeight:700,fontSize:14,...ellipsis}}>{ex?.name||"Exercice supprimé"}</div>
                        <span title="Durée estimée de l'exercice, récupérations comprises" style={{fontSize:12,color:C.muted,fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>≈ {fmtMinutes(dur[i].total/60)}</span>
                        {ex&&<VideoBtn ex={ex} size={30}/>}
                        {moveBtns(i)}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:wide?"repeat(4,1fr) 1.3fr":"1fr 1fr",gap:8}}>
                        {[["Séries","sets","number"],["Reps / durée","reps","text"],[group&&!chained?"Repos après le tour":"Repos","rest","text"],["Charge","targetLoad","text"]].map(([l,k,t])=>(
                          <label key={k} style={{display:"block"}}>
                            <div style={{fontSize:10.5,color:k==="rest"&&group&&!chained?G.goldLight:C.muted,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",marginBottom:4,...ellipsis}}>{l}</div>
                            {k==="rest"&&chained
                              ?<div title="Pas de repos : on enchaîne directement l'exercice suivant" style={{...inputStyle,height:38,fontSize:13,padding:"0 10px",display:"flex",alignItems:"center",gap:6,color:G.goldLight,background:G.gold+"10",borderColor:G.gold+"33"}}><Icon name="link" size={13}/>Enchaîner</div>
                              :<input className="inp" type={t} inputMode={t==="number"?"numeric":undefined} value={pe[k]??""} placeholder={k==="targetLoad"?"60kg ou %":""}
                                onChange={e=>updEx(i,k,t==="number"?Number(e.target.value):e.target.value)} style={{...inputStyle,height:38,fontSize:15,padding:"0 10px"}}/>}
                          </label>
                        ))}
                        <label style={{display:"block",gridColumn:wide?"auto":"1 / -1"}}>
                          <div style={{fontSize:10.5,color:C.muted,fontWeight:700,letterSpacing:.6,textTransform:"uppercase",marginBottom:4}}>% calculé sur</div>
                          <Select value={pe.loadRef||"none"} onChange={e=>updEx(i,"loadRef",e.target.value)} style={{height:38,fontSize:14,color:pe.loadRef&&pe.loadRef!=="none"?G.goldLight:C.muted}}>
                            {LOAD_REFS.map(r=><option key={r.id} value={r.id}>{r.id==="none"?"Charge fixe":r.label}</option>)}
                          </Select>
                        </label>
                      </div>
                      {showNote
                        ?<TextArea value={pe.note||""} onChange={e=>updEx(i,"note",e.target.value)} placeholder="Consignes pour le client (tempo, placement…)" style={{minHeight:52,marginTop:8,fontSize:14}}/>
                        :<Btn size="sm" variant="quiet" icon="plus" style={{marginTop:6,paddingLeft:2,color:C.muted}} onClick={()=>setOpenNotes(o=>({...o,[`${wi}-${di}-${i}`]:true}))}>Consigne</Btn>}
                    </div>
                  );
                  };
                  return exBlocks(day.exercises).flatMap(b=>{
                    const endI=b.items[b.items.length-1].i;
                    const canLink=endI<last&&!isTextBlock(day.exercises[endI])&&!isTextBlock(day.exercises[endI+1]);
                    const after=canLink?linker(endI):null;
                    if(b.items.length===1) return [card(b.items[0].pe,b.start,false),after];
                    const tail=b.items[b.items.length-1].pe;
                    return [
                      <div key={`grp-${b.start}`} style={{border:`1.5px solid ${G.gold}66`,borderRadius:18,padding:"10px 8px 2px",marginBottom:8,background:`linear-gradient(180deg,${G.gold}12,transparent 70%)`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",padding:"0 4px 10px"}}>
                          <Chip gold><Icon name="link" size={12}/>{blockKind(b.items.length)}</Chip>
                          <span style={{fontSize:12.5,color:"#ccc"}}>{b.items.length} exercices à la suite, sans repos{tail.rest?<> · repos <b style={{color:G.goldLight}}>{tail.rest}</b> après le tour</>:""}</span>
                        </div>
                        {b.items.flatMap((x,k)=>[card(x.pe,x.i,true),k<b.items.length-1?linker(x.i):null])}
                      </div>,
                      after,
                    ];
                  });
                })()}
                <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap"}}>
                  <Btn variant="ghost" icon="plus" style={{flex:"2 1 200px",borderStyle:"dashed"}} onClick={()=>setPicker(true)}>Ajouter des exercices</Btn>
                  <Btn variant="quiet" icon="edit" style={{flex:"1 1 160px",color:G.goldLight}} onClick={()=>setCreating({})}>Créer un exercice</Btn>
                  <Btn variant="quiet" icon="clipboard" style={{flex:"1 1 160px",color:G.goldLight}} onClick={addText}>Bloc texte libre</Btn>
                </div>
              </>
            )}
          </Card>
        )}
      </Pad>
      {picker&&day&&<ExercisePickerModal exercises={exercises} selected={day.exercises.map(e=>e.exId)} title={`Exercices — ${day.label}`} onToggle={toggleEx} onClose={()=>setPicker(false)}
        onCreate={pre=>setCreating(pre)}/>}
      {creating&&day&&<ExerciseModal init={null} preset={creating} title={`Nouvel exercice → ${day.label}`} saveLabel="Créer et ajouter" onSave={createEx} onClose={()=>setCreating(null)}/>}
    </div>
  );
}

function ExercisePickerModal({exercises,selected,title,onToggle,onClose,onCreate}){
  const {wide}=useUI();
  const [search,setSearch]=useState("");
  const [muscle,setMuscle]=useState("Tous");
  const shown=exercises.filter(e=>(muscle==="Tous"||e.muscle===muscle)&&matches(search,e.name,e.muscle,e.equipment));
  return(
    <Modal onClose={onClose} title={title} width={620}
      footer={<Btn icon="check" style={{flex:1}} onClick={onClose}>Terminé · {selected.length} exercice{selected.length>1?"s":""}</Btn>}>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <SearchBox value={search} onChange={setSearch} placeholder="Squat, tirage, haltères…" style={{flex:1,minWidth:0}} autoFocus={wide}/>
        {onCreate&&<Btn variant="ghost" icon="plus" onClick={()=>onCreate({name:search.trim(),muscle:muscle!=="Tous"?muscle:undefined})}>{wide?"Nouvel exercice":"Créer"}</Btn>}
      </div>
      <div style={{marginBottom:12}}><FilterChips value={muscle} onChange={setMuscle} options={MUSCLES.map(m=>[m,m])}/></div>
      {shown.length===0&&<EmptyState icon="dumbbell" title="Aucun exercice" text={onCreate?"Il manque dans ta bibliothèque ? Crée-le, il sera ajouté à la séance.":"Crée-le dans Bibliothèque → Exercices."}
        action={onCreate&&<Btn icon="plus" onClick={()=>onCreate({name:search.trim(),muscle:muscle!=="Tous"?muscle:undefined})}>{search.trim()?`Créer « ${search.trim()} »`:"Créer un exercice"}</Btn>}/>}
      {shown.map(ex=>{
        const on=selected.includes(ex.id);
        return(
          <button key={ex.id} type="button" onClick={()=>onToggle(ex)} className={on?undefined:"hov"}
            style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"10px 12px",marginBottom:6,borderRadius:12,textAlign:"left",cursor:"pointer",color:G.white,
              background:on?G.gold+"12":C.soft,border:`1px solid ${on?G.gold+"66":C.line}`}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:600,fontSize:14,...ellipsis}}>{ex.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ex.muscle} · {ex.equipment}{ex.videoUrl?"":" · sans vidéo"}</div>
            </div>
            <div style={{width:24,height:24,borderRadius:8,border:`1.5px solid ${on?G.goldLight:C.dim}`,background:on?G.goldLight:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:G.bg,flexShrink:0}}>
              {on&&<Icon name="check" size={15} sw={3}/>}
            </div>
          </button>
        );
      })}
    </Modal>
  );
}

// ─── BIBLIOTHÈQUE ─────────────────────────────────────────────────────────────
function LibraryView({data,nav}){
  const [tab,setTab]=useState(nav.libTab||"exercises");
  return(
    <Pad>
      <PageHeader title="Bibliothèque" sub="Exercices et aliments utilisés dans les programmes et les plans."/>
      <Segmented value={tab} onChange={setTab} style={{marginBottom:16,maxWidth:420}}
        options={[["exercises","Exercices",data.exercises.length],["foods","Aliments",data.foods.length]]}/>
      {tab==="exercises"?<ExercisesPanel data={data} initialNoVideo={!!nav.noVideo}/>:<FoodsPanel data={data}/>}
    </Pad>
  );
}

function ExercisesPanel({data,initialNoVideo}){
  const {exercises,setExercises,programs}=data;
  const {wide,toast}=useUI();
  const [search,setSearch]=useState("");
  const [muscle,setMuscle]=useState("Tous");
  const [noVideo,setNoVideo]=useState(initialNoVideo);
  const [editing,setEditing]=useState(null); // exercice | "new"
  const missing=exercises.filter(e=>!e.videoUrl).length;
  const shown=exercises
    .filter(e=>(muscle==="Tous"||e.muscle===muscle)&&(!noVideo||!e.videoUrl)&&matches(search,e.name,e.muscle,e.equipment))
    .sort((a,b)=>a.name.localeCompare(b.name,"fr"));
  const save=ex=>{
    if(editing==="new") setExercises(p=>[...p,{...ex,id:Date.now()}]);
    else setExercises(p=>p.map(x=>x.id===ex.id?ex:x));
    toast(editing==="new"?"Exercice créé":"Exercice enregistré");
    setEditing(null);
  };
  const remove=ex=>{setExercises(p=>p.filter(x=>x.id!==ex.id));setEditing(null);toast("Exercice supprimé");};
  return(
    <>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un exercice…" style={{flex:1,minWidth:220}}/>
        <Btn icon="plus" onClick={()=>setEditing("new")}>Nouvel exercice</Btn>
      </div>
      <div style={{marginBottom:10}}><FilterChips value={muscle} onChange={setMuscle} options={MUSCLES.map(m=>[m,m])}/></div>
      {missing>0&&(
        <button type="button" onClick={()=>setNoVideo(!noVideo)} style={{display:"inline-flex",alignItems:"center",gap:7,height:32,padding:"0 12px",borderRadius:99,cursor:"pointer",fontWeight:700,fontSize:12.5,marginBottom:14,
          border:`1px solid ${noVideo?ORANGE:ORANGE+"55"}`,background:noVideo?ORANGE+"22":"transparent",color:ORANGE}}>
          <Icon name="video" size={14}/>{noVideo?"Afficher tout":`${missing} sans vidéo`}
        </button>
      )}
      <div style={{fontSize:12.5,color:C.muted,margin:"0 2px 10px"}}>{shown.length} exercice{shown.length>1?"s":""}</div>
      {shown.length===0&&<EmptyState icon="dumbbell" title="Aucun exercice" text="Modifie les filtres ou crée un nouvel exercice."/>}
      <div style={{display:"grid",gridTemplateColumns:wide?"repeat(auto-fill,minmax(260px,1fr))":"1fr",gap:8}}>
        {shown.map(ex=>(
          <Card key={ex.id} onClick={()=>setEditing(ex)} style={{display:"flex",alignItems:"center",gap:12,padding:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14.5,...ellipsis}}>{ex.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:3,...ellipsis}}>{ex.muscle} · {ex.equipment} · <span title={customSecPerRep(ex)?"Temps par répétition saisi":"Temps par répétition estimé automatiquement"}>{customSecPerRep(ex)?"":"≈ "}{secPerRepOf(ex)} s/rép.</span></div>
            </div>
            {ex.videoUrl?<VideoBtn ex={ex}/>:<Chip color={ORANGE}>Sans vidéo</Chip>}
          </Card>
        ))}
      </div>
      {editing&&<ExerciseModal init={editing==="new"?null:editing} usage={editing==="new"?0:programs.filter(p=>usesExercise(p,editing.id)).length}
        onSave={save} onDelete={remove} onClose={()=>setEditing(null)}/>}
    </>
  );
}

function ExerciseModal({init,usage,onSave,onDelete,onClose,preset,title,saveLabel="Enregistrer"}){
  const {confirm}=useUI();
  const [f,setF]=useState(init?{...init}:{name:preset?.name||"",muscle:preset?.muscle||"Jambes",equipment:"Barre",videoUrl:"",notes:""});
  const embedOk=!!ytId(f.videoUrl);
  const autoSec=estimateSecPerRep(f);
  const save=()=>{
    if(!f.name.trim())return;
    const {secPerRep,...rest}=f;
    const spr=Number(String(secPerRep??"").replace(",","."));
    // Vide = estimation automatique (le champ n'est pas enregistré)
    onSave({...rest,name:f.name.trim(),videoUrl:normalizeVideo(f.videoUrl),...(spr>0?{secPerRep:Math.round(spr*10)/10}:{})});
  };
  const remove=async()=>{
    const ok=await confirm({title:`Supprimer ${init.name} ?`,danger:true,confirm:"Supprimer",
      text:usage?`Il est utilisé dans ${usage} programme(s) : il y apparaîtra comme « Exercice supprimé ».`:"Cette action est définitive."});
    if(ok) onDelete(init);
  };
  return(
    <Modal onClose={onClose} title={title||(init?"Modifier l'exercice":"Nouvel exercice")} width={600}
      footer={<>
        {init&&<IconBtn icon="trash" label="Supprimer l'exercice" variant="danger" size={44} onClick={remove}/>}
        <Btn variant="ghost" style={{flex:1}} onClick={onClose}>Annuler</Btn>
        <Btn style={{flex:2}} disabled={!f.name.trim()} onClick={save}>{saveLabel}</Btn>
      </>}>
      <Field label="Nom"><TextInput value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Squat barre" autoFocus={!init}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="Muscle"><Select value={f.muscle} onChange={e=>setF(p=>({...p,muscle:e.target.value}))}>{MUSCLES.filter(m=>m!=="Tous").map(m=><option key={m}>{m}</option>)}</Select></Field>
        <Field label="Équipement"><Select value={f.equipment} onChange={e=>setF(p=>({...p,equipment:e.target.value}))}>{EQUIPS.map(m=><option key={m}>{m}</option>)}</Select></Field>
      </div>
      <Field label="Vidéo YouTube" hint={<>Colle n'importe quel lien YouTube (vidéo, youtu.be, shorts). {f.name.trim()&&<a href={videoSearchUrl(f.name)} target="_blank" rel="noopener noreferrer" style={{color:G.goldLight}}>Chercher « {f.name.trim()} » sur YouTube</a>}</>}>
        <TextInput value={f.videoUrl||""} onChange={e=>setF(p=>({...p,videoUrl:e.target.value}))} placeholder="https://youtu.be/…" inputMode="url"/>
      </Field>
      {f.videoUrl&&(embedOk
        ?<div style={{marginBottom:14}}><VideoFrame url={f.videoUrl} title={`Aperçu — ${f.name}`}/></div>
        :<div style={{fontSize:12.5,color:ORANGE,margin:"-6px 0 14px"}}>Lien non reconnu comme une vidéo YouTube : il sera enregistré tel quel.</div>)}
      <Field label="Temps moyen par répétition" hint={<>Sert à calculer la durée des séances. Laisse vide pour l'estimation automatique : <b style={{color:G.goldLight}}>{autoSec} s</b> pour ce type d'exercice.</>}>
        <div style={{position:"relative"}}>
          <TextInput value={f.secPerRep??""} onChange={e=>setF(p=>({...p,secPerRep:e.target.value.replace(/[^\d.,]/g,"")}))} placeholder={`${autoSec} (auto)`} inputMode="decimal" style={{paddingRight:90}}/>
          <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>sec / rép.</span>
        </div>
      </Field>
      <Field label="Conseils techniques"><TextArea value={f.notes||""} onChange={e=>setF(p=>({...p,notes:e.target.value}))} placeholder="Dos droit, genoux alignés…"/></Field>
      {init&&usage>0&&<div style={{fontSize:12.5,color:C.muted}}>Utilisé dans {usage} programme{usage>1?"s":""}.</div>}
    </Modal>
  );
}

const EMPTY_FOOD=()=>({id:"",name:"",unit:"g",kcal:0,protein:0,carbs:0,fat:0});
function FoodsPanel({data}){
  const {foods,setFoods}=data;
  const {wide,toast}=useUI();
  const [search,setSearch]=useState("");
  const [editing,setEditing]=useState(null);
  const shown=foods.filter(x=>matches(search,x.name)).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
  const save=entry=>{
    if(editing==="new") setFoods(p=>[...p,entry]);
    else setFoods(p=>p.map(x=>x.id===entry.id?entry:x));
    toast(editing==="new"?"Aliment ajouté":"Aliment enregistré");
    setEditing(null);
  };
  const remove=food=>{setFoods(p=>p.filter(x=>x.id!==food.id));setEditing(null);toast("Aliment supprimé");};
  return(
    <>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14}}>
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un aliment…" style={{flex:1,minWidth:220}}/>
        <Btn icon="plus" onClick={()=>setEditing("new")}>Nouvel aliment</Btn>
      </div>
      {shown.length===0&&<EmptyState icon="leaf" title="Aucun aliment" text="Ajoute les aliments que tu utilises dans tes plans."/>}
      <div style={{display:"grid",gridTemplateColumns:wide?"repeat(auto-fill,minmax(320px,1fr))":"1fr",gap:8}}>
        {shown.map(food=>(
          <Card key={food.id} onClick={()=>setEditing(food)} style={{padding:12}}>
            <div style={{fontWeight:700,fontSize:14,...ellipsis}}>{food.name}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:4}}>{food.kcal} kcal · P {food.protein} · G {food.carbs} · L {food.fat} <span style={{color:G.gold}}>/ {food.unit==="g"?"100 g":"portion"}</span></div>
          </Card>
        ))}
      </div>
      {editing&&<FoodModal init={editing==="new"?null:editing} onSave={save} onDelete={remove} onClose={()=>setEditing(null)}/>}
    </>
  );
}

function FoodModal({init,onSave,onDelete,onClose}){
  const {confirm}=useUI();
  const [f,setF]=useState(init?{...init}:EMPTY_FOOD());
  const per=f.unit==="g"?"100 g":"portion";
  const save=()=>{
    if(!f.name.trim())return;
    onSave({...f,name:f.name.trim(),id:init?f.id:`${norm(f.name).replace(/[^a-z0-9]/g,"_").slice(0,30)}_${Date.now()}`,
      kcal:parseFloat(f.kcal)||0,protein:parseFloat(f.protein)||0,carbs:parseFloat(f.carbs)||0,fat:parseFloat(f.fat)||0});
  };
  const remove=async()=>{
    if(await confirm({title:`Supprimer ${init.name} ?`,text:"Les plans alimentaires qui l'utilisent ne l'afficheront plus.",confirm:"Supprimer",danger:true})) onDelete(init);
  };
  return(
    <Modal onClose={onClose} title={init?"Modifier l'aliment":"Nouvel aliment"} width={500}
      footer={<>
        {init&&<IconBtn icon="trash" label="Supprimer l'aliment" variant="danger" size={44} onClick={remove}/>}
        <Btn variant="ghost" style={{flex:1}} onClick={onClose}>Annuler</Btn>
        <Btn style={{flex:2}} disabled={!f.name.trim()} onClick={save}>Enregistrer</Btn>
      </>}>
      <Field label="Nom"><TextInput value={f.name} onChange={e=>setF(p=>({...p,name:e.target.value}))} placeholder="Riz basmati cuit" autoFocus={!init}/></Field>
      <Field label="Valeurs pour"><Segmented value={f.unit} onChange={v=>setF(p=>({...p,unit:v}))} options={[["g","100 g"],["portion","1 portion"]]}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[["kcal",`Calories (kcal / ${per})`],["protein","Protéines (g)"],["carbs","Glucides (g)"],["fat","Lipides (g)"]].map(([k,l])=>(
          <Field key={k} label={l}><TextInput type="number" inputMode="decimal" value={f[k]} onChange={e=>setF(p=>({...p,[k]:e.target.value}))}/></Field>
        ))}
      </div>
    </Modal>
  );
}

// ─── IA COACH ─────────────────────────────────────────────────────────────────
const AI_EXAMPLES=["Crée un PPL 6 jours sur 4 semaines pour un intermédiaire","Full body débutant 3 j/sem avec progression sur 8 semaines","Programme de force 6 semaines axé squat et développé couché"];
function AIView({data,go}){
  const {wide}=useUI();
  const {exercises,setPrograms}=data;
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const bottomRef=useRef(null);
  const scrollBottom=()=>setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth",block:"end"}),80);

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
- Superset / triset : ajoute "linkNext": true sur un exercice pour l'enchaîner sans repos avec l'exercice suivant (2 exercices liés = superset, 3 = triset). Le "rest" du dernier exercice du groupe est le repos pris après le tour ; n'écris pas "SUPERSET" dans les consignes
- Bloc libre (circuit, EMOM, AMRAP…) : à la place d'un exercice, tu peux mettre {"kind": "text", "title": "Circuit final", "text": "3 tours :\n- 10 burpees\n- 15 squats sautés", "minutes": 12}
- Crée toujours plusieurs semaines avec progression
- Réponds en français, sois précis et professionnel
- TOUJOURS inclure le JSON si tu crées un programme`;

  const send=async text=>{
    const content=(text??input).trim();
    if(!content||loading)return;
    const newMsgs=[...messages,{role:"user",content}];
    setMessages(newMsgs);setInput("");setLoading(true);scrollBottom();
    try{
      // Modèle et longueur de réponse sont fixés côté serveur ; l'accès est réservé au coach connecté
      const idToken=await auth.currentUser?.getIdToken();
      if(!idToken) throw new Error("Session expirée, reconnecte-toi");
      const res=await fetch(`${API_BASE}/api/chat`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${idToken}`},
        body:JSON.stringify({system:SYSTEM,messages:newMsgs.map(m=>({role:m.role,content:m.content||"(programme créé)"}))}),
      });
      const resp=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(resp.error||"Erreur serveur");
      const reply=resp.text||"Désolé, une erreur s'est produite.";
      const jsonMatch=reply.match(/```json\s*([\s\S]*?)```/);
      let programCreated=null;
      if(jsonMatch){
        try{
          const parsed=JSON.parse(jsonMatch[1]);
          if(parsed.action==="create_program"&&parsed.program){
            programCreated={...parsed.program,id:Date.now()};
            setPrograms(p=>[...p,programCreated]);
          }
        }catch(e){console.error("[IA] JSON invalide",e);}
      }
      setMessages(p=>[...p,{role:"assistant",content:reply.replace(/```json[\s\S]*?```/g,"").trim(),programCreated}]);
    }catch(e){
      setMessages(p=>[...p,{role:"assistant",content:`Erreur : ${e.message}`,error:true}]);
    }
    setLoading(false);scrollBottom();
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:wide?"100dvh":"100%"}}>
      <div style={{flex:1,overflowY:"auto"}}>
        <div style={{maxWidth:820,margin:"0 auto",padding:wide?"32px 36px 16px":"18px 16px 12px"}}>
          <PageHeader title="IA Coach" sub="Décris le programme : il est créé directement dans ta bibliothèque, prêt à être ajusté."/>
          {messages.length===0&&(
            <div style={{display:"grid",gap:8}}>
              {AI_EXAMPLES.map(ex=>(
                <Card key={ex} onClick={()=>send(ex)} style={{display:"flex",alignItems:"center",gap:12,padding:14}}>
                  <Icon name="sparkle" size={18} color={G.goldLight}/><div style={{flex:1,fontSize:14}}>{ex}</div><Icon name="right" size={16} color={C.dim}/>
                </Card>
              ))}
            </div>
          )}
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start",marginBottom:12}}>
              <div style={{maxWidth:"88%",whiteSpace:"pre-wrap",fontSize:14,lineHeight:1.55,padding:"12px 15px",
                background:m.role==="user"?C.goldGrad:"#141414",color:m.role==="user"?G.bg:m.error?G.red:G.white,
                borderRadius:m.role==="user"?"18px 18px 6px 18px":"18px 18px 18px 6px",border:m.role==="user"?"none":`1px solid ${C.line}`}}>
                {m.content}
              </div>
              {m.programCreated&&(
                <Card style={{marginTop:8,maxWidth:"88%",display:"flex",alignItems:"center",gap:12,padding:12,borderColor:G.green+"44"}}>
                  <Icon name="check" size={18} color={G.green} sw={2.4}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13.5,color:G.green}}>Programme créé</div>
                    <div style={{fontSize:12.5,color:C.muted,...ellipsis}}>{m.programCreated.name}</div>
                  </div>
                  <Btn size="sm" variant="ghost" onClick={()=>go("programs",{programId:m.programCreated.id})}>Ouvrir</Btn>
                </Card>
              )}
            </div>
          ))}
          {loading&&(
            <div style={{display:"inline-flex",gap:6,padding:"14px 16px",background:"#141414",border:`1px solid ${C.line}`,borderRadius:"18px 18px 18px 6px"}}>
              {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:99,background:G.gold,animation:"pulse 1.2s ease infinite",animationDelay:`${i*.2}s`}}/>)}
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
      </div>
      <div style={{flexShrink:0,borderTop:`1px solid ${C.line}`,background:"#0a0a0a"}}>
        <form onSubmit={e=>{e.preventDefault();send();}} style={{maxWidth:820,margin:"0 auto",padding:wide?"14px 36px 18px":"10px 16px 12px",display:"flex",gap:10,alignItems:"flex-end"}}>
          <textarea className="inp" value={input} onChange={e=>setInput(e.target.value)} rows={2} placeholder="Décris le programme à créer…"
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            style={{...inputStyle,height:"auto",minHeight:52,maxHeight:160,padding:"12px 14px",resize:"none",lineHeight:1.45,flex:1}}/>
          <IconBtn icon="send" label="Envoyer" variant="gold" size={52} disabled={!input.trim()||loading} style={{opacity:!input.trim()||loading?.4:1}} type="submit"/>
        </form>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
// Firebase Auth : les données ne sont chargées qu'une fois le coach connecté (règles Firestore).
export default function CoachApp(){
  const [status,setStatus]=useState("loading"); // "loading" | "login" | "coach"
  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(u&&await isCoachUser(u)){setStatus("coach");return;}
    // Session client (ou compte sans rôle) sur cet appareil : on la ferme pour l'espace coach
    if(u)await signOut(auth).catch(()=>{});
    setStatus("login");
  }),[]);

  if(status==="loading")return <LoadingScreen/>;
  if(status==="login")return <CoachLogin onLogin={coachLoginWithCode}/>;
  return <CoachMain onLogout={()=>signOut(auth).catch(e=>console.error("[Auth] Déconnexion:",e))}/>;
}

function LoadingScreen(){
  return(
    <div style={{minHeight:"100dvh",background:G.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:18,fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      <Brand/>
      <div style={{width:34,height:34,border:"3px solid #222",borderTop:`3px solid ${G.goldLight}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
    </div>
  );
}

function CoachMain({onLogout}){
  const wide=useWide();
  const [exercises,setExercises,exReady]=useFirestoreCollection("exercises",SEED_EX);
  const [programs,setPrograms,pgReady]=useFirestoreCollection("programs",SEED_PROGRAMS);
  const [clients,setClients,clReady]=useFirestoreCollection("clients",[]);
  const [foods,setFoods,foodsReady]=useFirestoreCollection("foods",FOODS_DB);
  const [mealTemplate,setMealTemplate]=useState(null);
  useEffect(()=>{
    getDoc(doc(db,"settings","mealTemplate")).then(s=>{if(s.exists())setMealTemplate(s.data().meals||null);}).catch(()=>{});
  },[]);
  const [nav,setNav]=useState({view:"home"});
  const go=useCallback((view,extra={})=>{
    setNav({view,...extra});
    document.getElementById("coach-main")?.scrollTo(0,0);
  },[]);
  const [confirm,confirmNode]=useConfirmDialog();
  const [toast,toastNode]=useToast();
  const [videoEx,setVideoEx]=useState(null);
  const ui=useMemo(()=>({wide,confirm,toast,openVideo:setVideoEx}),[wide,confirm,toast]);

  if(!(exReady&&pgReady&&clReady&&foodsReady)) return <LoadingScreen/>;

  const data={clients,setClients,programs,setPrograms,exercises,setExercises,foods,setFoods,mealTemplate,setMealTemplate};
  const counts={clients:clients.length,programs:programs.length,library:exercises.length};
  // La clé remonte la vue quand on change de section ou d'élément (état local remis à zéro)
  const key=`${nav.view}-${nav.clientId??""}-${nav.programId??""}-${nav.mode??""}-${nav.newClient?1:0}-${nav.noVideo?1:0}`;
  let content;
  if(nav.view==="clients") content=<ClientsView key={nav.newClient?key:"clients"} data={data} nav={nav} go={go}/>;
  else if(nav.view==="programs") content=<ProgramsView data={data} nav={nav} go={go}/>;
  else if(nav.view==="library") content=<LibraryView key={key} data={data} nav={nav}/>;
  else if(nav.view==="ai") content=<AIView data={data} go={go}/>;
  else content=<HomeView data={data} go={go} onLogout={onLogout}/>;

  return(
    <UI.Provider value={ui}>
      <style>{css}</style>
      {wide?(
        <div style={{display:"flex",minHeight:"100dvh",background:G.bg,color:G.white,fontFamily:G.font}}>
          <Sidebar view={nav.view} go={go} counts={counts} onLogout={onLogout}/>
          <main id="coach-main" style={{flex:1,minWidth:0,height:"100dvh",overflowY:"auto"}}>{content}</main>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:G.bg,color:G.white,fontFamily:G.font}}>
          <main id="coach-main" style={{flex:1,minHeight:0,overflowY:nav.view==="ai"?"hidden":"auto",paddingTop:"env(safe-area-inset-top)",WebkitOverflowScrolling:"touch"}}>{content}</main>
          <BottomNav view={nav.view} go={go}/>
        </div>
      )}
      <VideoModal ex={videoEx} onClose={()=>setVideoEx(null)}/>
      {confirmNode}
      {toastNode}
    </UI.Provider>
  );
}
