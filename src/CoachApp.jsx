import { useState, useEffect } from "react";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } from "./firebase.js";

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
const mkEx = (exId,sets,reps,rest,load="")=>({exId,sets,reps,rest,targetLoad:load});
const genCode = n=>n.split(" ")[0].toUpperCase().slice(0,4)+new Date().getFullYear();
const uid = ()=>Math.random().toString(36).slice(2,9);
const MUSCLES = ["Tous","Jambes","Pectoraux","Dos","Épaules","Biceps","Triceps","Abdominaux"];
const EQUIPS = ["Aucun","Barre","Haltères","Poulie","Barre fixe","Machine","Élastique","Kettlebell","Poids du corps"];

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

const SEED_CLIENTS = [
  {id:1,name:"Sophie Martin",code:"SOPH2025",goal:"Perte de poids",since:"Jan 2025",sessions:4,color:G.goldLight,programs:[1],
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
   nutrition:{calories:3200,proteins:200,carbs:380,fats:90,notes:"Shake post-workout."},sessionLogs:[]},
  {id:3,name:"Camille Roy",code:"CAMI2025",goal:"Tonification",since:"Mar 2025",sessions:0,color:"#8a7040",programs:[],
   nutrition:{calories:2000,proteins:150,carbs:220,fats:65,notes:""},sessionLogs:[]},
];

// ─── FIRESTORE HOOK ───────────────────────────────────────────────────────────
function useFirestoreCollection(collectionName, seed) {
  const [data, setDataLocal] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    const colRef = collection(db, collectionName);
    const unsub = onSnapshot(colRef,
      snap => { setDataLocal(snap.docs.map(d=>d.data())); setReady(true); },
      err => { console.error(`[Firebase] ${collectionName}:`, err); setDataLocal(seed); setReady(true); }
    );
    getDocs(colRef).then(snap=>{
      if(snap.empty && seed.length>0){
        const BATCH_SIZE=499;
        const batches=[];
        for(let i=0;i<seed.length;i+=BATCH_SIZE){
          const b=writeBatch(db);
          seed.slice(i,i+BATCH_SIZE).forEach(item=>b.set(doc(db,collectionName,String(item.id)),item));
          batches.push(b.commit());
        }
        return Promise.all(batches);
      }
    }).catch(err=>console.error(`[Firebase] seed ${collectionName}:`,err));
    return unsub;
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

// ─── CLIENT DETAIL PANEL ──────────────────────────────────────────────────────
function ClientDetailPanel({client,clients,setClients,programs,setPrograms,onViewProgram,onDelete}){
  const [tab,setTab]=useState("program");
  const [editNut,setEditNut]=useState(false);
  const [nutForm,setNutForm]=useState({...client.nutrition});
  const [editName,setEditName]=useState(false);
  const [nameVal,setNameVal]=useState(client.name);

  const cur=clients.find(c=>c.id===client.id)||client;
  const upd=fn=>setClients(p=>p.map(c=>c.id===cur.id?fn(c):c));
  const toggleProg=pid=>upd(c=>({...c,programs:c.programs.includes(pid)?c.programs.filter(x=>x!==pid):[...c.programs,pid]}));
  const saveNut=()=>{upd(c=>({...c,nutrition:nutForm}));setEditNut(false);};
  const saveName=()=>{upd(c=>({...c,name:nameVal}));setEditName(false);};
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
        {[["program","Programme"],["nutrition","Nutrition"],["suivi","Historique"]].map(([k,l])=>(
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
        {tab==="nutrition"&&(
          <div style={{background:G.bg2,borderRadius:12,padding:20,border:`1px solid ${G.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{fontWeight:700}}>Objectifs nutritionnels</div>
              <BtnSm variant={editNut?"ghost":"gold"} onClick={()=>{setNutForm({...cur.nutrition});setEditNut(!editNut);}}>{editNut?"Annuler":"Modifier"}</BtnSm>
            </div>
            {editNut?(
              <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[["Calories (kcal)","calories"],["Protéines (g)","proteins"],["Glucides (g)","carbs"],["Lipides (g)","fats"]].map(([l,k])=>(
                    <Inp key={k} label={l} type="number" value={nutForm[k]||0} onChange={e=>setNutForm(p=>({...p,[k]:Number(e.target.value)}))}/>
                  ))}
                </div>
                <Txa label="Notes" value={nutForm.notes||""} placeholder="Allergies, préférences..." onChange={e=>setNutForm(p=>({...p,notes:e.target.value}))}/>
                <Btn onClick={saveNut} style={{width:"100%",marginTop:4}}>Enregistrer</Btn>
              </>
            ):(
              <>
                <div style={{textAlign:"center",padding:"12px 0 20px"}}>
                  <div style={{fontFamily:G.fontD,fontSize:52,fontWeight:800,color:G.goldLight,lineHeight:1}}>{cur.nutrition?.calories||0}</div>
                  <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:4}}>kcal / jour</div>
                </div>
                <MacroBar label="Protéines" value={cur.nutrition?.proteins||0} max={300} color={G.goldLight}/>
                <MacroBar label="Glucides" value={cur.nutrition?.carbs||0} max={500} color={G.gold}/>
                <MacroBar label="Lipides" value={cur.nutrition?.fats||0} max={150} color="#C9A84C66"/>
                {cur.nutrition?.notes&&<div style={{marginTop:14,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {cur.nutrition.notes}</div>}
              </>
            )}
          </div>
        )}
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

// ─── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({clients,setClients,programs,setPrograms,onViewProgram,initialClient}){
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
            programs={programs} setPrograms={setPrograms} onViewProgram={onViewProgram} onDelete={deleteClient}/>
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
                    {pe.targetLoad&&<div style={{fontSize:12,color:G.goldLight,marginTop:3}}>🎯 {pe.targetLoad}</div>}
                    {ex.notes&&<div style={{fontSize:11,color:G.gold+"88",marginTop:4}}>📝 {ex.notes}</div>}
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
  const toggleEx=ex=>{setForm(p=>({...p,weeks:p.weeks.map((w,wi)=>wi!==weekIdx?w:{...w,days:w.days.map((d,di)=>di!==dayIdx?d:{...d,exercises:d.exercises.find(e=>e.exId===ex.id)?d.exercises.filter(e=>e.exId!==ex.id):[...d.exercises,{exId:ex.id,sets:3,reps:"10",rest:"60s",targetLoad:""}]})})}));};
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
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                      {[["Séries","sets","number"],["Reps","reps","text"],["Repos","rest","text"],["Charge cible","targetLoad","text"]].map(([l,k,t])=>(
                        <div key={k}>
                          <div style={{fontSize:10,color:G.grey,letterSpacing:.8,textTransform:"uppercase",marginBottom:3}}>{l}</div>
                          <input type={t} value={pe[k]} placeholder={k==="targetLoad"?"optionnel":""}
                            onChange={e=>updateExField(pe.exId,k,t==="number"?Number(e.target.value):e.target.value)}
                            style={{width:"100%",background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"6px 8px",color:G.white,fontSize:12,outline:"none"}}/>
                        </div>
                      ))}
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
  const [auth,setAuth]=useState("login");
  const [view,setView]=useState("dashboard");
  const [exercises,setExercises,exReady]=useFirestoreCollection("exercises",SEED_EX);
  const [programs,setPrograms,pgReady]=useFirestoreCollection("programs",SEED_PROGRAMS);
  const [clients,setClients,clReady]=useFirestoreCollection("clients",SEED_CLIENTS);
  const dbReady=exReady&&pgReady&&clReady;

  // Migrations
  useEffect(()=>{
    if(!exReady)return;
    const ids=new Set(exercises.map(e=>e.id));
    const missing=SEED_EX.filter(e=>!ids.has(e.id));
    if(missing.length>0)setExercises(prev=>[...prev,...missing]);
  },[exReady]); // eslint-disable-line
  useEffect(()=>{
    if(!pgReady)return;
    const ids=new Set(programs.map(p=>p.id));
    const missing=SEED_PROGRAMS.filter(p=>!ids.has(p.id));
    if(missing.length>0)setPrograms(prev=>[...prev,...missing]);
  },[pgReady]); // eslint-disable-line

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
    <CoachLogin onLogin={code=>{if(code===COACH_CODE){setAuth("coach");return true;}return false;}}/>
  );

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      <Sidebar
        view={view}
        setView={changeView}
        onLogout={()=>{setAuth("login");setView("dashboard");}}
        counts={{clients:clients.length,programs:programs.length,exercises:exercises.length}}/>
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
              onViewProgram={viewProgramFromClient} initialClient={dashClient}/>
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
