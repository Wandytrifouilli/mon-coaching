import { useState, useRef, useEffect, useCallback } from "react";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, getDoc, auth, onAuthStateChanged, signOut, isCoachUser, loginClientWithCode, loginCoach, API_BASE } from "./firebase.js";


// ─── THEME ────────────────────────────────────────────────────────────────────
const G = {
  bg:"#080808",bg2:"#0f0f0f",bg3:"#161616",bg4:"#1c1c1c",
  gold:"#C9A84C",goldLight:"#E8C547",
  white:"#F5F0E8",grey:"#888888",greyDim:"#444444",border:"#2a2a2a",
  red:"#E05252",green:"#52C07A",
  font:"'Barlow',sans-serif",fontD:"'Barlow Condensed',sans-serif",
};
const css=`
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  html,body{background:${G.bg};color-scheme:dark;overscroll-behavior:none;-webkit-text-size-adjust:100%;}
  input,textarea,select{font-family:${G.font};}
  button{touch-action:manipulation;font-family:${G.font};-webkit-user-select:none;user-select:none;}
  button:not(:disabled):active{transform:scale(.97);opacity:.85;}
  button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid ${G.gold};outline-offset:2px;}
  ::-webkit-scrollbar{width:0;}
  .app-h{height:100vh;height:100dvh;}
  .sb{padding-bottom:env(safe-area-inset-bottom);}
  .st{padding-top:env(safe-area-inset-top);}
  /* iOS zoome automatiquement sur les champs < 16px : on force 16px sur écrans tactiles */
  @media (pointer:coarse){input:not(.big),select,textarea{font-size:16px!important;}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pulseGold{0%,100%{box-shadow:0 0 0 0 ${G.gold}44}50%{box-shadow:0 0 0 6px ${G.gold}00}}
  @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
  .sx{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);}
  .fu{animation:fadeUp .3s ease both;}
  .gl::after{content:'';display:block;width:36px;height:3px;background:linear-gradient(90deg,${G.goldLight},${G.gold});border-radius:2px;margin-top:7px;}
`;

// ─── MODÈLE DE DONNÉES ───────────────────────────────────────────────────────
// Les données de départ (seed) sont gérées uniquement par l’espace coach (CoachApp.jsx).
// L’app mobile ne fait que lire/écrire les documents existants : elle ne recrée plus
// les éléments supprimés par le coach.
// Exercise: { id, name, muscle, equipment, videoUrl, notes }
// Program exercise slot: { exId, sets, reps, rest, targetLoad:"" }
// Day: { label, exercises:[] }
// Week: { label, days:[] }
// Program: { id, name, category, level, weeks:[] }
// SessionLog: { id, date, programId, weekIdx, dayIdx, dayLabel, exercises:[{exId, name, sets:[{reps,load}]}], notes, completed }

const MUSCLES=["Tous","Jambes","Pectoraux","Dos","Épaules","Biceps","Triceps","Abdominaux","Avant-bras"];
const EQUIPS=["Aucun","Barre","Haltères","Poulie","Barre fixe","Machine","Élastique","Kettlebell","Poids du corps"];
const MEAL_SLOTS=[
  {id:"breakfast",icon:"🌅",label:"Petit déjeuner"},
  {id:"snack1",icon:"🍎",label:"Collation matin"},
  {id:"lunch",icon:"🥗",label:"Déjeuner"},
  {id:"snack2",icon:"🍌",label:"Collation après-midi"},
  {id:"dinner",icon:"🌙",label:"Dîner"},
  {id:"other",icon:"💊",label:"Autre / Suppléments"},
];
const emptyMealPlan=()=>({meals:MEAL_SLOTS.map(s=>({id:s.id,label:s.label,items:[]}))});
// Code d’accès client : 4 premières lettres du prénom (sans accents) + année.
// Si le code existe déjà (deux « Thomas »…), on ajoute un suffixe pour qu’il reste unique.
const genCode=(n,existing=[])=>{
  const base=(n||"").trim().split(/\s+/)[0].normalize("NFD").replace(/[̀-ͯ]/g,"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4)||"CLIE";
  const used=new Set(existing.map(c=>(c.code||"").toUpperCase()));
  let code=base+new Date().getFullYear(),i=2;
  while(used.has(code)) code=base+new Date().getFullYear()+"-"+i++;
  return code;
};

// ─── BASE DE DONNÉES ALIMENTAIRE ──────────────────────────────────────────────
// unit:"g" → valeurs pour 100g | unit:"portion" → valeurs pour 1 portion
const FOODS_DB=[
  // ── Par 100g ──
  {id:"pain_mie",        name:"Pain de mie complet",                                         unit:"g",      kcal:87,  protein:3.2, carbs:13,  fat:1.4},
  {id:"flocons_avoine",  name:"Flocon d'avoine",                                              unit:"g",      kcal:370, protein:13,  carbs:58,  fat:7},
  {id:"lait_amande",     name:"Lait d'amande",                                                unit:"g",      kcal:35,  protein:2,   carbs:2.5, fat:1.6},
  {id:"fromage_blanc",   name:"Fromage blanc nature 3% MG Carrefour",                         unit:"g",      kcal:70,  protein:8,   carbs:3,   fat:3},
  {id:"muesli_bjorg",   name:"Muesli Bjorg sans sucres ajoutés",                             unit:"g",      kcal:357, protein:12,  carbs:58,  fat:6},
  {id:"viande_poisson",  name:"Viande / Poisson au choix",                                    unit:"g",      kcal:178, protein:22,  carbs:0,   fat:10},
  {id:"legumes",         name:"Légumes au choix (hors légumineuses)",                         unit:"g",      kcal:24,  protein:1,   carbs:5,   fat:0},
  {id:"farine",          name:"Farine",                                                       unit:"g",      kcal:364, protein:10,  carbs:76,  fat:1},
  // ── Par portion ──
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
// Calcule les macros totaux d'un tableau d'items [{foodId, qty}]
const calcMacros=(items=[],foods=FOODS_DB)=>items.reduce((acc,item)=>{
  const f=foods.find(x=>x.id===item.foodId);
  if(!f)return acc;
  const m=f.unit==="g"?item.qty/100:item.qty;
  return{kcal:acc.kcal+f.kcal*m,protein:acc.protein+f.protein*m,carbs:acc.carbs+f.carbs*m,fat:acc.fat+f.fat*m};
},{kcal:0,protein:0,carbs:0,fat:0});
const rnd=v=>Math.round(v);
const rnd1=v=>Math.round(v*10)/10;
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
  <div style={{textAlign:"center",padding:"32px 20px",color:G.grey,fontSize:14}}><div style={{fontSize:28,marginBottom:8}}>○</div>{text}</div>
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

// ─── MEAL PLAN EDITOR (coach) ─────────────────────────────────────────────────
function MealPlanEditor({mealPlan,onSave,onLiveChange,foods=FOODS_DB,onSetAsTemplate}){
  const initForm=()=>MEAL_SLOTS.map(s=>{
    const ex=(mealPlan?.meals||[]).find(m=>m.id===s.id);
    return{id:s.id,label:s.label,icon:s.icon,items:ex?.items||[]};
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

  // Remonte les totaux en temps réel vers le parent pendant l'édition
  useEffect(()=>{
    if(editing&&onLiveChange) onLiveChange(calcMacros(form.flatMap(m=>m.items),foods));
  },[form,editing]); // eslint-disable-line

  const save=()=>{
    const meals=form.map(({icon,...rest})=>rest);
    const allItems=form.flatMap(m=>m.items);
    const totals=calcMacros(allItems,foods);
    onSave({meals},totals);
    if(onLiveChange) onLiveChange(null);
    setEditing(false);
  };
  const cancel=()=>{setForm(initForm());if(onLiveChange)onLiveChange(null);setEditing(false);};

  const applyTemplate=()=>{
    if(!firestoreTemplate)return;
    setForm(MEAL_SLOTS.map(s=>{
      const tm=firestoreTemplate.find(m=>m.id===s.id);
      return{id:s.id,label:s.label,icon:s.icon,items:tm?.items||[]};
    }));
  };

  const addItem=(mealId,foodId)=>{
    const food=foods.find(f=>f.id===foodId);
    const defQty=food.unit==="g"?100:1;
    setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:[...m.items,{foodId,qty:defQty}]}));
    setPickerMeal(null);setSearch("");
  };
  const removeItem=(mealId,idx)=>setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:m.items.filter((_,i)=>i!==idx)}));
  const updateQty=(mealId,idx,val)=>setForm(f=>f.map(m=>m.id!==mealId?m:{...m,items:m.items.map((it,i)=>i!==idx?it:{...it,qty:parseFloat(val)||0})}));

  const filteredFoods=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()));
  const totalMacros=calcMacros(form.flatMap(m=>m.items),foods);
  const hasPlan=form.some(m=>m.items.length>0);

  return(
    <div style={{marginTop:14}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0,padding:"14px 16px",background:G.bg2,borderRadius:"12px 12px 0 0",border:`1px solid ${G.border}`,borderBottom:"none"}}>
        <div style={{fontWeight:700,fontSize:14}}>Plan alimentaire</div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {!editing&&hasPlan&&onSetAsTemplate&&(
            <BtnSm variant="ghost" onClick={()=>{const meals=form.map(({icon,...r})=>r);onSetAsTemplate({meals});setTemplateSaved(true);setTimeout(()=>setTemplateSaved(false),2500);}}>
              {templateSaved?"✓ Modèle enregistré":"⭐ Modèle par défaut"}
            </BtnSm>
          )}
          {editing&&(
            <BtnSm variant="ghost" onClick={applyTemplate}
              style={!firestoreTemplate?{opacity:0.35,cursor:"default",pointerEvents:"none"}:{}}>
              📋 Coller le template
            </BtnSm>
          )}
          <BtnSm variant={editing?"ghost":"gold"} onClick={()=>editing?cancel():setEditing(true)}>{editing?"Annuler":"✏️ Modifier"}</BtnSm>
        </div>
      </div>

      {/* Body */}
      <div style={{background:G.bg2,borderRadius:"0 0 12px 12px",padding:16,border:`1px solid ${G.border}`,borderTop:"none"}}>

        {editing?(
          <>
            {/* Totaux en temps réel */}
            {totalMacros.kcal>0&&(
              <div style={{display:"flex",justifyContent:"space-around",background:G.bg3,borderRadius:10,padding:"10px 0",marginBottom:14,border:`1px solid ${G.border}`}}>
                {[[rnd(totalMacros.kcal),"kcal",G.goldLight],[rnd1(totalMacros.protein)+"g","Prot.",G.goldLight],[rnd1(totalMacros.carbs)+"g","Gluc.",G.gold],[rnd1(totalMacros.fat)+"g","Lip.","#C9A84C"]].map(([v,l,c])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontFamily:G.fontD,fontSize:18,fontWeight:800,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontSize:9,color:G.grey,letterSpacing:.5,marginTop:3}}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Repas */}
            {form.map(meal=>{
              const mMacros=calcMacros(meal.items,foods);
              return(
                <div key={meal.id} style={{marginBottom:18}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:12,color:G.gold,fontWeight:700,letterSpacing:.5}}>{meal.icon} {meal.label}</div>
                    {meal.items.length>0&&<div style={{fontSize:10,color:G.grey}}>{rnd(mMacros.kcal)} kcal</div>}
                  </div>

                  {/* Aliments du repas */}
                  {meal.items.map((item,idx)=>{
                    const food=foods.find(f=>f.id===item.foodId);
                    if(!food)return null;
                    const im=calcMacros([item],foods);
                    return(
                      <div key={idx} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,background:G.bg3,borderRadius:8,padding:"8px 10px"}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:G.white,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{food.name}</div>
                          <div style={{fontSize:10,color:G.grey,marginTop:2}}>{rnd(im.kcal)} kcal · P {rnd1(im.protein)}g · G {rnd1(im.carbs)}g · L {rnd1(im.fat)}g</div>
                        </div>
                        <input type="number" value={item.qty} min="0" onChange={e=>updateQty(meal.id,idx,e.target.value)}
                          style={{width:52,background:G.bg4,border:`1px solid ${G.border}`,borderRadius:6,padding:"5px 4px",color:G.goldLight,fontSize:13,fontWeight:700,outline:"none",textAlign:"center"}}/>
                        <div style={{fontSize:10,color:G.grey,flexShrink:0}}>{food.unit==="g"?"g":"port."}</div>
                        <button onClick={()=>removeItem(meal.id,idx)}
                          style={{background:"none",border:"none",color:G.red,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 2px",flexShrink:0}}>×</button>
                      </div>
                    );
                  })}

                  {/* Bouton ajouter */}
                  <button onClick={()=>{setPickerMeal(meal.id);setSearch("");}}
                    style={{width:"100%",background:"transparent",border:`1px dashed ${G.border}`,borderRadius:8,padding:"8px 0",color:G.grey,fontSize:12,cursor:"pointer",marginTop:meal.items.length?4:0,transition:"border .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=G.gold;e.currentTarget.style.color=G.gold;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=G.border;e.currentTarget.style.color=G.grey;}}>
                    + Ajouter un aliment
                  </button>
                </div>
              );
            })}

            <Btn onClick={save}>✓ Enregistrer le plan alimentaire</Btn>
          </>
        ):(
          /* Vue lecture */
          !hasPlan?(
            <div style={{textAlign:"center",padding:"20px 0",color:G.greyDim,fontSize:13}}>Aucun plan alimentaire renseigné</div>
          ):(
            form.filter(m=>m.items.length>0).map(meal=>{
              const mMacros=calcMacros(meal.items,foods);
              return(
                <div key={meal.id} style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${G.border}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{fontSize:10,color:G.gold,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{meal.icon} {meal.label}</div>
                    <div style={{fontSize:10,color:G.grey}}>{rnd(mMacros.kcal)} kcal</div>
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
                </div>
              );
            })
          )
        )}
      </div>

      {/* Sélecteur d'aliment (modal) */}
      {pickerMeal&&(
        <Modal onClose={()=>{setPickerMeal(null);setSearch("");}} title="Ajouter un aliment">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher un aliment..."
            style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 12px",color:G.white,fontSize:14,outline:"none",marginBottom:12}}
            onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border}/>
          {filteredFoods.map(food=>(
            <div key={food.id} onClick={()=>addItem(pickerMeal,food.id)}
              style={{padding:"12px 12px",marginBottom:6,background:G.bg3,borderRadius:8,cursor:"pointer",border:`1px solid ${G.border}`,transition:"border .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=G.gold}
              onMouseLeave={e=>e.currentTarget.style.borderColor=G.border}>
              <div style={{fontWeight:600,fontSize:13,color:G.white,marginBottom:3}}>{food.name}</div>
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

// ─── FOODS MANAGER (coach) ────────────────────────────────────────────────────
const EMPTY_FOOD=()=>({id:"",name:"",unit:"g",kcal:0,protein:0,carbs:0,fat:0});
function FoodsManager({foods,setFoods,go}){
  const [editing,setEditing]=useState(null); // null | "new" | food object
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
    if(editing==="new"){
      setFoods(p=>[...p,entry]);
    }else{
      setFoods(p=>p.map(x=>x.id===entry.id?entry:x));
    }
    setEditing(null);
  };
  const del=id=>{setFoods(p=>p.filter(x=>x.id!==id));setConfirmDel(null);};

  const filtered=foods.filter(f=>f.name.toLowerCase().includes(search.toLowerCase()));

  if(editing){
    const isNew=editing==="new";
    return(
      <div style={{padding:"28px 20px 0"}} className="fu">
        <BackBtn onClick={()=>setEditing(null)} label="Aliments"/>
        <PageH title={isNew?"NOUVEL ALIMENT":"MODIFIER L'ALIMENT"}/>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
          <Inp label={`Calories (kcal/${form.unit==="g"?"100g":"portion"})`} type="number" value={form.kcal} onChange={e=>f("kcal")(e.target.value)}/>
          <Inp label={`Protéines (g/${form.unit==="g"?"100g":"portion"})`} type="number" value={form.protein} onChange={e=>f("protein")(e.target.value)}/>
          <Inp label={`Glucides (g/${form.unit==="g"?"100g":"portion"})`} type="number" value={form.carbs} onChange={e=>f("carbs")(e.target.value)}/>
          <Inp label={`Lipides (g/${form.unit==="g"?"100g":"portion"})`} type="number" value={form.fat} onChange={e=>f("fat")(e.target.value)}/>
        </div>
        {form.name.trim()&&(
          <div style={{marginBottom:14,padding:12,background:G.bg3,borderRadius:8,border:`1px solid ${G.border}`,fontSize:12,color:G.grey}}>
            Aperçu : <span style={{color:G.goldLight,fontWeight:700}}>{form.kcal} kcal</span> · P {form.protein}g · G {form.carbs}g · L {form.fat}g / {form.unit==="g"?"100g":"portion"}
          </div>
        )}
        <Btn onClick={save}>{isNew?"Ajouter l'aliment":"Enregistrer les modifications"}</Btn>
      </div>
    );
  }

  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <PageH title="ALIMENTS" style={{marginBottom:0}}/>
        <Btn onClick={openNew} style={{marginTop:0,padding:"10px 18px",fontSize:13}}>+ Ajouter</Btn>
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..."
        style={{width:"100%",background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 12px",color:G.white,fontSize:14,outline:"none",marginBottom:14,boxSizing:"border-box"}}
        onFocus={e=>e.target.style.borderColor=G.gold} onBlur={e=>e.target.style.borderColor=G.border}/>
      {filtered.map(food=>(
        <div key={food.id} style={{background:G.bg2,borderRadius:12,padding:"14px 16px",marginBottom:8,border:`1px solid ${G.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:600,fontSize:13,color:G.white,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{food.name}</div>
            <div style={{fontSize:11,color:G.grey}}>
              {food.kcal} kcal · P {food.protein}g · G {food.carbs}g · L {food.fat}g
              <span style={{color:G.gold,marginLeft:6}}>/ {food.unit==="g"?"100g":"portion"}</span>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            <BtnSm onClick={()=>openEdit(food)}>✏️</BtnSm>
            <BtnSm variant="ghost" onClick={()=>setConfirmDel(food.id)} style={{color:G.red,borderColor:G.red+"44"}}>🗑</BtnSm>
          </div>
        </div>
      ))}
      {filtered.length===0&&<div style={{textAlign:"center",color:G.greyDim,padding:"32px 0",fontSize:13}}>Aucun aliment trouvé</div>}
      {confirmDel&&(
        <Modal onClose={()=>setConfirmDel(null)} title="Supprimer l'aliment">
          <div style={{color:G.grey,fontSize:14,marginBottom:20}}>
            Supprimer <strong style={{color:G.white}}>{foods.find(f=>f.id===confirmDel)?.name}</strong> ?<br/>
            <span style={{fontSize:12}}>Les plans alimentaires existants qui utilisent cet aliment ne seront plus affichés correctement.</span>
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>del(confirmDel)} style={{background:G.red+"22",borderColor:G.red,color:G.red}}>Supprimer</Btn>
            <BtnSm onClick={()=>setConfirmDel(null)}>Annuler</BtnSm>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── STOCKAGE LOCAL ───────────────────────────────────────────────────────────
// Tolérant aux erreurs (navigation privée, stockage bloqué…) : l'app fonctionne quand même.
const store={
  get:k=>{try{return localStorage.getItem(k);}catch{return null;}},
  set:(k,v)=>{try{localStorage.setItem(k,v);}catch{/* stockage indisponible */}},
  del:k=>{try{localStorage.removeItem(k);}catch{/* stockage indisponible */}},
};
const CLIENT_KEY="wandy_client";

// ─── PERSISTANCE FIRESTORE ────────────────────────────────────────────────────
function useFirestoreCollection(collectionName){
  const [data, setDataLocal] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(()=>{
    // Listener temps réel : le cache local répond tout de suite, le serveur met à jour ensuite
    return onSnapshot(collection(db, collectionName),
      snap => {
        setDataLocal(snap.docs.map(d => d.data()));
        setReady(true);
      },
      err => {
        console.error(`[Firebase] Erreur listener ${collectionName}:`, err);
        setReady(true);
      }
    );
  }, [collectionName]);

  const setData = (updater) => {
    setDataLocal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const prevMap = new Map(prev.map(x => [String(x.id), x]));
      const nextIds = new Set(next.map(x => String(x.id)));
      // Collect diffs first, then schedule Firestore writes OUTSIDE the render phase.
      // Calling setDoc/deleteDoc directly inside a state updater is a side-effect that
      // React 18 concurrent mode can trigger multiple times, causing write cascades.
      const toWrite = [];
      const toDelete = [];
      next.forEach(item => {
        const p = prevMap.get(String(item.id));
        if(!p || JSON.stringify(p) !== JSON.stringify(item)) toWrite.push(item);
      });
      prev.forEach(item => {
        if(!nextIds.has(String(item.id))) toDelete.push(String(item.id));
      });
      setTimeout(() => {
        toWrite.forEach(item => setDoc(doc(db, collectionName, String(item.id)), item).catch(console.error));
        toDelete.forEach(id => deleteDoc(doc(db, collectionName, id)).catch(console.error));
      }, 0);
      return next;
    });
  };

  return [data, setData, ready];
}

// Un seul document en temps réel : le client ne télécharge que sa propre fiche
function useFirestoreDoc(collectionName, id){
  const [state,setState]=useState({data:null,ready:false,missing:false});
  useEffect(()=>{
    if(!id) return;
    return onSnapshot(doc(db,collectionName,String(id)),
      snap=>{
        if(snap.exists()) setState({data:snap.data(),ready:true,missing:false});
        // Absent du cache local ≠ supprimé : on attend la réponse du serveur avant de conclure
        else if(!snap.metadata.fromCache) setState({data:null,ready:true,missing:true});
      },
      err=>{
        console.error(`[Firebase] Erreur document ${collectionName}/${id}:`,err);
        // Refus des règles : fiche supprimée, code changé ou session invalide → accès retiré
        if(err.code==="permission-denied") setState({data:null,ready:true,missing:true});
        else setState(s=>({...s,ready:true}));
      }
    );
  },[collectionName,id]);
  return state;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const readStoredClient=()=>{
  try{
    const c=JSON.parse(store.get(CLIENT_KEY)||"null");
    if(c?.id&&c?.code) return {id:String(c.id),code:c.code};
  }catch{/* valeur corrompue : retour à l'écran de connexion */}
  return null;
};

export default function App(){
  // Session Firebase Auth : undefined tant qu'elle est en cours de restauration
  const [user,setUser]=useState(undefined);
  const [role,setRole]=useState(null); // "client" | "coach" | null
  const [client,setClient]=useState(readStoredClient);
  const [migrationDone,setMigrationDone]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,async u=>{
    if(!u){setRole(null);setUser(null);return;}
    const r=u.uid.startsWith("client_")?"client":(await isCoachUser(u))?"coach":null;
    if(!r){signOut(auth).catch(()=>{});return;}
    setRole(r);
    setUser(u);
  }),[]);

  // Anciennes installations : code mémorisé mais pas encore de session Auth → reconnexion silencieuse
  const migrationTried=useRef(false);
  useEffect(()=>{
    if(user!==null||!client||migrationTried.current) return;
    migrationTried.current=true;
    loginClientWithCode(client.code).then(r=>{
      if(r.status==="invalid"){store.del(CLIENT_KEY);setClient(null);}
      setMigrationDone(true);
    });
  },[user,client]);

  // Retourne "ok" | "invalid" | "locked" | "network"
  const login=async raw=>{
    const code=raw.trim().toUpperCase();
    if(!code) return "invalid";
    const r=await loginClientWithCode(code);
    if(r.status!=="ok") return r.status;
    const c={id:String(r.clientId),code};
    store.set(CLIENT_KEY,JSON.stringify(c));
    setClient(c);
    return "ok";
  };
  // Retourne "ok" | "invalid" | "notcoach" | "network"
  // (sur ordinateur, la redirection vers /coach se fait au rendu une fois la session ouverte)
  const coachLogin=(email,password)=>loginCoach(email,password);
  const logout=()=>{
    store.del(CLIENT_KEY);
    setClient(null);
    signOut(auth).catch(e=>console.error("[Auth] Déconnexion:",e));
  };

  const migrating=user===null&&!!client&&!migrationDone;
  if(user===undefined||migrating) return <Shell css={css}><Loading label="Connexion…"/></Shell>;
  if(user&&role==="client"){
    // L'identité vient du token ; le code mémorisé sert à détecter un changement de code par le coach
    const id=user.uid.slice("client_".length);
    const code=client?.id===id?client.code:null;
    return (
      <Shell css={css}>
        <ClientRoot key={id} clientId={id} code={code} onLogout={logout}/>
      </Shell>
    );
  }
  if(user&&role==="coach"){
    // Ordinateur : espace coach complet (même session Auth)
    if(!IS_PHONE){window.location.replace("/coach");return <Shell css={css}><Loading label="Ouverture de l'espace coach…"/></Shell>;}
    return (
      <Shell css={css}>
        <CoachMobile onLogout={logout}/>
      </Shell>
    );
  }
  return <LoginScreen onLogin={login} onCoachLogin={coachLogin}/>;
}

// ─── CLIENT : chargement des données ──────────────────────────────────────────
function ClientRoot({clientId,code,onLogout}){
  const [exercises,,exReady]=useFirestoreCollection("exercises");
  const [programs,,pgReady]=useFirestoreCollection("programs");
  const [foods,,foodsReady]=useFirestoreCollection("foods");
  const {data:client,ready:clReady,missing}=useFirestoreDoc("clients",clientId);

  // Accès retiré par le coach (fiche supprimée ou code modifié) → retour à la connexion
  const revoked=missing||(!!client&&!!code&&String(client.code||"").toUpperCase()!==code);
  useEffect(()=>{if(revoked)onLogout();},[revoked]); // eslint-disable-line

  const clientRef=useRef(client);
  useEffect(()=>{clientRef.current=client;},[client]);
  const updateClient=useCallback(fn=>{
    const cur=clientRef.current;
    if(!cur) return;
    const next=fn(cur);
    clientRef.current=next;
    // Hors ligne : Firestore garde l'écriture en file d'attente et la synchronise au retour du réseau
    setDoc(doc(db,"clients",String(clientId)),next).catch(e=>console.error("[Firebase] Sauvegarde client:",e));
  },[clientId]);

  if(!exReady||!pgReady||!foodsReady||!clReady||!client||revoked) return <Loading label="Chargement de ton espace…"/>;
  return <ClientPortal client={client} clientId={clientId} updateClient={updateClient} programs={programs} exercises={exercises} foods={foods} onLogout={onLogout}/>;
}

// ─── COACH (version téléphone) ────────────────────────────────────────────────
function CoachMobile({onLogout}){
  const [exercises,setExercises,exReady]=useFirestoreCollection("exercises");
  const [programs,setPrograms,pgReady]=useFirestoreCollection("programs");
  const [clients,setClients,clReady]=useFirestoreCollection("clients");
  const [foods,setFoods,foodsReady]=useFirestoreCollection("foods");
  const dbReady = exReady && pgReady && clReady && foodsReady;

  const [coachView,setCoachView]=useState("dashboard");
  const [selClient,setSelClient]=useState(null);
  const [selProgram,setSelProgram]=useState(null);
  const [selClientForProgram,setSelClientForProgram]=useState(null);
  const [defaultMealTemplate,setDefaultMealTemplate]=useState(()=>{try{const t=store.get('defaultMealTemplate');return t?JSON.parse(t):null;}catch{return null;}});
  const saveDefaultTemplate=(mp)=>{setDefaultMealTemplate(mp);store.set('defaultMealTemplate',JSON.stringify(mp));};

  if(!dbReady) return <Loading label="Connexion à la base de données…"/>;
  return (
    <>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
        {coachView==="dashboard"&&<Dashboard clients={clients} programs={programs} exercises={exercises} go={setCoachView} sel={c=>{setSelClient(c);setCoachView("client-detail");}} selP={p=>{setSelProgram(p);setCoachView("program-detail");}} onLogout={onLogout}/>}
        {coachView==="clients"&&<ClientsList clients={clients} go={setCoachView} sel={c=>{setSelClient(c);setCoachView("client-detail");}}/>}
        {coachView==="client-detail"&&selClient&&<ClientDetail client={clients.find(c=>c.id===selClient.id)||selClient} clients={clients} setClients={setClients} setPrograms={setPrograms} setSel={setSelClient} programs={programs} exercises={exercises} foods={foods} go={setCoachView} onSetAsTemplate={saveDefaultTemplate} selP={p=>{setSelProgram(p);setSelClientForProgram(clients.find(c=>c.id===selClient.id)||selClient);setCoachView("program-detail");}}/>}
        {coachView==="new-client"&&<NewClient setClients={setClients} go={setCoachView} defaultMealTemplate={defaultMealTemplate}/>}
        {coachView==="programs"&&<ProgramsList programs={programs} setPrograms={setPrograms} setClients={setClients} exercises={exercises} go={setCoachView} sel={p=>{setSelProgram(p);setSelClientForProgram(null);setCoachView("program-detail");}} onEdit={p=>{setSelProgram(p);setCoachView("edit-program");}}/>}
        {coachView==="program-detail"&&selProgram&&<ProgramDetail program={programs.find(x=>x.id===selProgram.id)||selProgram} exercises={exercises} go={setCoachView} client={selClientForProgram} onEdit={p=>{setSelProgram(p);setCoachView("edit-program");}}/>}
        {coachView==="edit-program"&&selProgram&&<EditProgram program={programs.find(x=>x.id===selProgram.id)||selProgram} exercises={exercises} setPrograms={setPrograms} go={setCoachView} setSel={setSelProgram}/>}
        {coachView==="new-program"&&<NewProgram exercises={exercises} setPrograms={setPrograms} go={setCoachView}/>}
        {coachView==="exercises"&&<ExLib exercises={exercises} setExercises={setExercises} go={setCoachView}/>}
        {coachView==="new-exercise"&&<NewEx setExercises={setExercises} go={setCoachView}/>}
        {coachView==="ai-coach"&&<AICoach exercises={exercises} setPrograms={setPrograms} go={setCoachView}/>}
        {coachView==="foods"&&<FoodsManager foods={foods} setFoods={setFoods} go={setCoachView}/>}
      </div>
      <CoachNav view={coachView} setView={setCoachView}/>
    </>
  );
}

// ─── ÉCRAN DE CHARGEMENT ──────────────────────────────────────────────────────
function Loading({label="Chargement…"}){
  const [slow,setSlow]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setSlow(true),10000);return()=>clearTimeout(t);},[]);
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:24,textAlign:"center"}}>
      <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,color:G.white,letterSpacing:-1}}>WANDY<span style={{color:G.goldLight}}> COACH</span></div>
      <div style={{fontSize:13,color:G.grey}}>{label}</div>
      <div style={{width:40,height:40,border:`3px solid ${G.border}`,borderTop:`3px solid ${G.goldLight}`,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
      {slow&&(
        <div style={{marginTop:8,maxWidth:280}} className="fu">
          <div style={{fontSize:12,color:G.grey,marginBottom:12,lineHeight:1.5}}>La connexion semble lente. Vérifie ton réseau (Wi-Fi ou données mobiles).</div>
          <Btn variant="outline" onClick={()=>window.location.reload()}>Réessayer</Btn>
        </div>
      )}
    </div>
  );
}

// ─── DÉTECTION APPAREIL ───────────────────────────────────────────────────────
// Ordinateur avec souris → aperçu dans un cadre de téléphone.
// Téléphones et tablettes (portrait comme paysage) → plein écran.
const IS_DESKTOP = !!window.matchMedia?.("(hover:hover) and (pointer:fine)").matches && window.innerWidth>700;
const IS_MOBILE = !IS_DESKTOP;
// Téléphone : le coach reste sur la version mobile ; sinon il est redirigé vers l'espace coach complet
const IS_PHONE = Math.min(window.screen.width, window.screen.height) < 600;
const PHONE_FRAME={width:390,height:"min(844px, calc(100vh - 48px))",borderRadius:44,background:"#1a1a1a",boxShadow:"0 40px 120px #000a, inset 0 0 0 1px #333",padding:"12px",flexShrink:0,position:"relative"};
const PHONE_NOTCH={position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",width:120,height:30,background:"#1a1a1a",borderRadius:"0 0 18px 18px",zIndex:10};

const Shell=({children,css:c})=>IS_DESKTOP?(
  <div style={{background:"#111",minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center"}}>
    <style>{c}</style>
    <div style={PHONE_FRAME}>
      <div style={PHONE_NOTCH}/>
      <div style={{width:"100%",height:"100%",borderRadius:34,overflow:"hidden",display:"flex",flexDirection:"column",background:G.bg,fontFamily:G.font,color:G.white}}>
        <div style={{height:44,flexShrink:0,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:6}}>
          <div style={{fontSize:11,color:"#888",fontFamily:G.font,letterSpacing:.5}}>{new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
        <div style={{flex:1,minHeight:0,display:"flex",flexDirection:"column",position:"relative"}}>
          {children}
        </div>
      </div>
    </div>
  </div>
):(
  <div className="app-h st sx" style={{background:G.bg,width:"100%",display:"flex",flexDirection:"column",fontFamily:G.font,color:G.white,overflow:"hidden",position:"relative"}}>
    <style>{c}</style>
    {children}
  </div>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin,onCoachLogin}){
  const [mode,setMode]=useState("client"); // "client" (code) | "coach" (e-mail + mot de passe)
  const [code,setCode]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState(null); // null | "invalid" | "locked" | "network" | "notcoach"
  const [busy,setBusy]=useState(false);
  const [focused,setFocused]=useState(false);
  const active=(mode==="client"?!!code.trim():!!email.trim()&&!!password)&&!busy;
  const attempt=async e=>{
    e?.preventDefault();
    if(!active) return;
    setBusy(true);
    const r=mode==="client"?await onLogin(code):await onCoachLogin(email,password);
    setBusy(false);
    if(r!=="ok") setErr(r);
  };
  const switchMode=m=>{setMode(m);setErr(null);};
  const coachInput={
    width:"100%",background:G.bg3,border:`1.5px solid ${err?G.red:G.border}`,
    borderRadius:12,padding:"14px 16px",color:G.white,fontSize:16,outline:"none",
    fontFamily:G.font,boxSizing:"border-box",marginBottom:10
  };

  const loginContent=(
    <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
      {/* Logo */}
      <div style={{marginBottom:40,textAlign:"center"}}>
        <div style={{
          width:80,height:80,borderRadius:24,
          background:`linear-gradient(145deg,${G.gold}33,${G.goldLight}18)`,
          border:`1.5px solid ${G.gold}44`,
          display:"flex",alignItems:"center",justifyContent:"center",
          margin:"0 auto 20px",fontSize:34,
          boxShadow:`0 8px 32px ${G.gold}22`
        }}>⚡</div>
        <div style={{fontFamily:G.fontD,fontSize:38,fontWeight:800,color:G.white,letterSpacing:-1.5,lineHeight:1}}>
          WANDY<span style={{color:G.goldLight}}> COACH</span>
        </div>
        <div style={{fontSize:11,color:G.grey,marginTop:8,letterSpacing:4,textTransform:"uppercase"}}>
          Espace personnel
        </div>
      </div>

      {/* Card */}
      <form onSubmit={attempt} style={{
        width:"100%",background:G.bg2,
        borderRadius:20,padding:"28px 24px",
        border:`1px solid ${G.border}`,
        boxShadow:"0 20px 60px #0008"
      }}>
        {mode==="client"?(<>
        <label htmlFor="access-code" style={{display:"block",fontSize:12,color:G.grey,letterSpacing:.5,marginBottom:10,fontWeight:600,textTransform:"uppercase"}}>
          Code d'accès
        </label>
        <input
          id="access-code"
          name="code"
          className="big"
          value={code}
          onChange={e=>{setCode(e.target.value.toUpperCase());setErr(null);}}
          onFocus={()=>setFocused(true)}
          onBlur={()=>setFocused(false)}
          placeholder="XXXX0000"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={!!err}
          style={{
            width:"100%",background:G.bg3,
            border:`1.5px solid ${err?G.red:focused?G.gold:G.border}`,
            borderRadius:12,padding:"16px 18px",
            color:G.white,fontSize:22,outline:"none",
            letterSpacing:5,textAlign:"center",
            fontWeight:700,fontFamily:G.font,
            transition:"border .15s",boxSizing:"border-box"
          }}/>
        </>):(<>
        <label htmlFor="coach-email" style={{display:"block",fontSize:12,color:G.grey,letterSpacing:.5,marginBottom:10,fontWeight:600,textTransform:"uppercase"}}>
          Espace coach
        </label>
        <input id="coach-email" name="email" type="email" value={email} placeholder="E-mail"
          autoComplete="username" autoCapitalize="none" spellCheck={false}
          onChange={e=>{setEmail(e.target.value);setErr(null);}} style={coachInput}/>
        <input id="coach-password" name="password" type="password" value={password} placeholder="Mot de passe"
          autoComplete="current-password" enterKeyHint="go"
          onChange={e=>{setPassword(e.target.value);setErr(null);}} style={coachInput}/>
        </>)}
        <div role="alert" style={{minHeight:26,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",margin:"6px 0 4px"}}>
          {err==="invalid"&&mode==="client"&&<div style={{color:G.red,fontSize:12}}>Code invalide — vérifie-le ou contacte ton coach.</div>}
          {err==="invalid"&&mode==="coach"&&<div style={{color:G.red,fontSize:12}}>E-mail ou mot de passe incorrect.</div>}
          {err==="notcoach"&&<div style={{color:G.red,fontSize:12}}>Ce compte n'a pas accès à l'espace coach.</div>}
          {err==="locked"&&<div style={{color:G.red,fontSize:12}}>Trop d'essais — réessaie dans 15 minutes.</div>}
          {err==="network"&&<div style={{color:G.red,fontSize:12}}>Connexion impossible — vérifie ton réseau et réessaie.</div>}
        </div>
        <button
          type="submit"
          disabled={!active}
          style={{
            width:"100%",padding:"15px 0",
            background:active?`linear-gradient(135deg,${G.gold},${G.goldLight})`:"#2a2a2a",
            border:"none",borderRadius:12,
            color:active?G.bg:"#666",
            fontSize:15,fontWeight:800,
            fontFamily:G.font,letterSpacing:.5,
            cursor:active?"pointer":"default",
            transition:"background .2s, color .2s",
            boxShadow:active?`0 4px 20px ${G.gold}44`:"none"
          }}>
          {busy?"Connexion…":"Accéder →"}
        </button>
      </form>

      {mode==="client"&&(
        <div style={{marginTop:28,fontSize:12,color:G.grey,textAlign:"center",lineHeight:1.6}}>
          Tu n'as pas de code ?<br/>
          <span style={{color:G.white+"bb"}}>Contacte ton coach pour en obtenir un.</span>
        </div>
      )}
      <button type="button" onClick={()=>switchMode(mode==="client"?"coach":"client")}
        style={{marginTop:mode==="client"?16:28,background:"none",border:"none",color:G.greyDim,fontSize:12,cursor:"pointer",fontFamily:G.font,textDecoration:"underline",padding:8}}>
        {mode==="client"?"Accès coach":"← Connexion client"}
      </button>
    </div>
  );

  return(
    <div style={{background:G.bg,minHeight:"100vh",display:"flex",justifyContent:"center",alignItems:"center",fontFamily:G.font,color:G.white}}>
      <style>{css}</style>
      {/* Fond décoratif */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        <div style={{position:"absolute",top:"-20%",left:"-10%",width:"60vw",height:"60vw",borderRadius:"50%",background:`radial-gradient(circle,${G.gold}0a 0%,transparent 70%)`}}/>
        <div style={{position:"absolute",bottom:"-15%",right:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:`radial-gradient(circle,${G.goldLight}07 0%,transparent 70%)`}}/>
      </div>

      {/* Simulation téléphone (desktop) */}
      {IS_DESKTOP&&(
        <div style={{...PHONE_FRAME,zIndex:1}}>
          <div style={PHONE_NOTCH}/>
          <div style={{width:"100%",height:"100%",borderRadius:34,overflow:"auto",background:G.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:28}}>
            {loginContent}
          </div>
        </div>
      )}

      {/* Mobile / tablette */}
      {IS_MOBILE&&(
        <div style={{
          position:"fixed",inset:0,
          background:G.bg,
          display:"flex",flexDirection:"column",
          alignItems:"center",
          padding:"calc(32px + env(safe-area-inset-top)) 24px calc(32px + env(safe-area-inset-bottom))",
          overflowY:"auto",
          zIndex:1
        }}>
          <div style={{width:"100%",maxWidth:400,margin:"auto 0"}}>
            {loginContent}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── COACH NAV ────────────────────────────────────────────────────────────────
function CoachNav({view,setView}){
  const items=[{key:"dashboard",icon:"◈",label:"Accueil"},{key:"clients",icon:"◉",label:"Clients"},{key:"programs",icon:"▦",label:"Prog."},{key:"exercises",icon:"⊕",label:"Exercices"},{key:"foods",icon:"◎",label:"Aliments"},{key:"ai-coach",icon:"✦",label:"IA Coach"}];
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
function ClientDetail({client,clients,setClients,setPrograms,setSel,programs,exercises,go,selP,foods=FOODS_DB,onSetAsTemplate}){
  const [tab,setTab]=useState("program");
  const [showLog,setShowLog]=useState(false);
  const [logForm,setLogForm]=useState({date:new Date().toISOString().split("T")[0],programId:"",weekIdx:"",dayIdx:"",completed:true,notes:""});
  const [nutForm,setNutForm]=useState({...client.nutrition});
  const [editNut,setEditNut]=useState(false);
  const [liveNut,setLiveNut]=useState(null); // totaux en temps réel depuis MealPlanEditor

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
        <>
          {(()=>{
            // Calcul des macros : liveNut (édition en cours) > plan stocké > valeurs manuelles
            const liveMp=clients.find(c=>c.id===client.id)?.mealPlan||client.mealPlan;
            const storedItems=(liveMp?.meals||[]).flatMap(m=>m.items||[]);
            const storedCalc=storedItems.length>0?calcMacros(storedItems,foods):null;
            const src=liveNut||storedCalc;
            const cal=src?rnd(src.kcal):client.nutrition.calories;
            const prot=src?rnd1(src.protein):client.nutrition.proteins;
            const gluc=src?rnd1(src.carbs):client.nutrition.carbs;
            const lip=src?rnd1(src.fat):client.nutrition.fats;
            const isLive=!!liveNut;
            return(
              <div style={{background:G.bg2,borderRadius:12,padding:18,border:`1px solid ${G.border}`,marginBottom:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontWeight:700}}>Objectifs nutritionnels</div>
                    {isLive&&<div style={{fontSize:10,color:G.gold,marginTop:3}}>● Aperçu en temps réel</div>}
                  </div>
                  <BtnSm variant={editNut?"ghost":"gold"} onClick={()=>{setNutForm({...client.nutrition});setEditNut(!editNut);}}>{editNut?"Annuler":"✏️ Notes"}</BtnSm>
                </div>
                {editNut&&(
                  <>
                    <Txa label="Notes / Allergies / Préférences" value={nutForm.notes} placeholder="Éviter le gluten, shake post-workout..." onChange={e=>setNutForm(p=>({...p,notes:e.target.value}))}/>
                    <Btn onClick={saveNut}>Enregistrer les notes</Btn>
                  </>
                )}
                <div style={{textAlign:"center",padding:"12px 0 20px"}}>
                  <div style={{fontFamily:G.fontD,fontSize:56,fontWeight:800,color:G.goldLight,lineHeight:1,transition:"all .3s"}}>{cal}</div>
                  <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:4}}>kcal / jour</div>
                </div>
                <MacroBar label="Protéines" value={prot} max={300} color={G.goldLight}/>
                <MacroBar label="Glucides" value={gluc} max={500} color={G.gold}/>
                <MacroBar label="Lipides" value={lip} max={150} color="#C9A84C66"/>
                {client.nutrition.notes&&!editNut&&<div style={{marginTop:16,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {client.nutrition.notes}</div>}
              </div>
            );
          })()}
          <MealPlanEditor
            foods={foods}
            mealPlan={clients.find(c=>c.id===client.id)?.mealPlan||client.mealPlan}
            onLiveChange={setLiveNut}
            onSetAsTemplate={onSetAsTemplate}
            onSave={(mp,totals)=>{
              setLiveNut(null);
              upd(c=>({
                ...c,
                mealPlan:mp,
                ...(totals.kcal>0?{nutrition:{...c.nutrition,calories:rnd(totals.kcal),proteins:rnd1(totals.protein),carbs:rnd1(totals.carbs),fats:rnd1(totals.fat)}}:{})
              }));
            }}/>
        </>
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
function NewClient({setClients,go,defaultMealTemplate}){
  const [form,setForm]=useState({name:"",goal:"",color:G.goldLight});
  const colors=[G.goldLight,G.gold,"#C9A84C","#8a7040","#a08030"];
  const create=()=>{
    setClients(p=>[...p,{...form,id:Date.now(),code:genCode(form.name,p),since:new Date().toLocaleDateString("fr-FR",{month:"short",year:"numeric"}),sessions:0,programs:[],mealPlan:defaultMealTemplate||emptyMealPlan(),nutrition:{calories:2000,proteins:150,carbs:200,fats:65,notes:""},sessionLogs:[]}]);
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
      {defaultMealTemplate&&<div style={{background:G.gold+"12",borderRadius:10,padding:"10px 14px",marginBottom:16,border:`1px solid ${G.gold}33`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14}}>⭐</span>
        <div style={{fontSize:12,color:G.goldLight}}>Le plan alimentaire modèle sera automatiquement appliqué</div>
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

// ─── CLIENT : OUTILS ──────────────────────────────────────────────────────────
const pad2=n=>String(n).padStart(2,"0");
// Date locale (et non UTC) : une séance terminée à 0h30 reste datée du bon jour
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;};
const fmtDate=iso=>{
  if(!iso||!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso||"";
  const [y,m,d]=iso.slice(0,10).split("-").map(Number);
  const opts={weekday:"short",day:"numeric",month:"short"};
  if(y!==new Date().getFullYear()) opts.year="numeric";
  return new Date(y,m-1,d).toLocaleDateString("fr-FR",opts);
};
const fmtClock=s=>`${Math.floor(s/60)}:${pad2(s%60)}`;
const fmtDuration=min=>min<60?`${min} min`:`${Math.floor(min/60)}h${pad2(min%60)}`;

// Accepte aussi les liens YouTube classiques (watch?v=, youtu.be, shorts) et force la lecture intégrée sur iPhone
const toEmbed=url=>{
  if(!url) return "";
  const m=String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?`https://www.youtube.com/embed/${m[1]}?playsinline=1&rel=0`:url;
};

// Charges en % (1RM, FCmax, VMA) calculées à partir des tests du client — même logique que l'espace coach
const LOAD_REFS=[
  {id:"1rm_squat",label:"1RM Squat",testKey:"rm_squat",unit:"kg"},
  {id:"1rm_bench",label:"1RM Bench",testKey:"rm_bench",unit:"kg"},
  {id:"1rm_sdt",label:"1RM SDT",testKey:"rm_sdt",unit:"kg"},
  {id:"fcmax",label:"FCmax",testKey:"fcmax",unit:"bpm"},
  {id:"vma",label:"VMA",testKey:"vma",unit:"km/h"},
];
// Retourne {text, load, unit} : texte de l'objectif + valeur à pré-remplir dans le champ charge
const slotTarget=(pe,tests)=>{
  const raw=String(pe.targetLoad??"").trim();
  const ref=LOAD_REFS.find(r=>r.id===pe.loadRef);
  if(ref){
    const pct=parseFloat(raw), base=parseFloat(tests?.[ref.testKey]);
    if(pct&&base){
      const v=Math.round(pct/100*base);
      return {text:`${v} ${ref.unit} (${pct}% ${ref.label})`,load:ref.unit==="kg"?String(v):"",unit:ref.unit==="kg"?"kg":null};
    }
    return {text:raw?`${raw}% ${ref.label}`:"",load:"",unit:null};
  }
  if(!raw) return {text:"",load:"",unit:null};
  const m=raw.match(/^(\d+(?:[.,]\d+)?)\s*(kg)?$/i);
  return m?{text:`${m[1]} kg`,load:m[1],unit:"kg"}:{text:raw,load:"",unit:null};
};

const LOAD_UNITS=["kg","élastique","cal","m","km","reps"];
// "60" + kg → "60kg" (format historique) ; une valeur libre reste telle quelle
const withUnit=(load,unit)=>{
  const v=String(load??"").trim();
  if(!v) return "";
  if(/^\d+([.,]\d+)?$/.test(v)) return unit==="kg"||!unit?`${v}kg`:`${v} ${unit}`;
  return v;
};

// Les saisies manuelles du coach peuvent avoir weekIdx/dayIdx vides : on les ignore
const sameIdx=(a,b)=>a!==""&&a!=null&&Number(a)===b;
const findDoneLog=(logs,progId,wi,di)=>logs.find(l=>l.completed&&String(l.programId)===String(progId)&&sameIdx(l.weekIdx,wi)&&sameIdx(l.dayIdx,di));
const progProgress=(prog,logs)=>{
  let total=0,done=0;
  (prog.weeks||[]).forEach((w,wi)=>(w.days||[]).forEach((_,di)=>{total++;if(findDoneLog(logs,prog.id,wi,di))done++;}));
  return {total,done};
};
const nextSessionOf=(prog,logs)=>{
  for(let wi=0;wi<(prog.weeks||[]).length;wi++){
    const w=prog.weeks[wi];
    for(let di=0;di<(w.days||[]).length;di++){
      if(!findDoneLog(logs,prog.id,wi,di)) return {prog,wi,di,week:w,day:w.days[di]};
    }
  }
  return null;
};
const isSameSession=(s,progId,wi,di)=>!!s&&String(s.progId)===String(progId)&&s.weekIdx===wi&&s.dayIdx===di;

const ProgressBar=({value,max,color=G.goldLight,height=5})=>(
  <div style={{background:G.bg4,borderRadius:99,height,overflow:"hidden"}}>
    <div style={{width:`${max?Math.min(100,value/max*100):0}%`,height:"100%",background:`linear-gradient(90deg,${G.gold},${color})`,borderRadius:99,transition:"width .4s"}}/>
  </div>
);

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────
function ClientPortal({client:live,clientId,updateClient,programs,exercises,onLogout,foods=FOODS_DB}){
  const logs=live.sessionLogs||[];
  const nutrition=live.nutrition||{};
  const SESSION_KEY=`wandy_session_${clientId}`;

  // Séance en cours : sauvegardée sur le téléphone pour survivre à un rafraîchissement,
  // à la fermeture de l'onglet ou à un passage sur un autre onglet de l'app.
  // activeSession: { progId, weekIdx, dayIdx, dayLabel, weekLabel, startedAt, notes, exercises:[{exId,name,unit,sets:[{reps,load,done,actualReps}]}] }
  const [session,setSession]=useState(()=>{try{const s=JSON.parse(store.get(SESSION_KEY)||"null");return s?.exercises?s:null;}catch{return null;}});
  const [tab,setTab]=useState("home");
  const [view,setView]=useState(()=>session?"session-active":"list"); // list | week-detail | session-active | session-done
  const [selProg,setSelProg]=useState(()=>session?.progId??null);
  const [selWeek,setSelWeek]=useState(()=>session?.weekIdx??null);
  const [doneInfo,setDoneInfo]=useState(null);
  useEffect(()=>{if(session)store.set(SESSION_KEY,JSON.stringify(session));else store.del(SESSION_KEY);},[session,SESSION_KEY]);

  // Chrono de récupération global : reste visible en bas de l'écran pendant qu'on fait défiler
  const rest=useCountdown();
  const [restOwner,setRestOwner]=useState(null); // {ei, name}
  const startRest=useCallback((ei,secs,name)=>{unlockAudio();setRestOwner({ei,name});rest.start(secs);},[rest.start]); // eslint-disable-line

  // Écran toujours allumé pendant une séance (Wake Lock, si le navigateur le permet)
  const sessionActive=!!session;
  useEffect(()=>{
    if(!sessionActive||!("wakeLock" in navigator)) return;
    let lock=null,cancelled=false;
    const request=()=>{
      if(document.visibilityState!=="visible") return;
      navigator.wakeLock.request("screen").then(l=>{if(cancelled)l.release();else lock=l;}).catch(()=>{});
    };
    request();
    document.addEventListener("visibilitychange",request);
    return()=>{cancelled=true;document.removeEventListener("visibilitychange",request);lock?.release().catch(()=>{});};
  },[sessionActive]);

  const assigned=programs.filter(p=>(live.programs||[]).some(id=>String(id)===String(p.id)));

  const startSession=(prog,weekIdx,day,dayIdx)=>{
    // Même séance déjà en cours → on la reprend
    if(isSameSession(session,prog.id,weekIdx,dayIdx)){setView("session-active");return;}
    if(session&&!window.confirm(`La séance « ${session.dayLabel} » est en cours. L'abandonner pour commencer celle-ci ?`)) return;
    rest.stop();
    const exEntries=(day.exercises||[]).map(pe=>{
      const ex=exercises.find(e=>e.id===pe.exId);
      const target=slotTarget(pe,live.tests);
      return{exId:pe.exId,name:ex?.name||"",videoUrl:ex?.videoUrl||"",notes:ex?.notes||"",coachNote:pe.note||"",target:target.text,muscle:ex?.muscle||"",rest:String(pe.rest||""),unit:target.unit||"kg",sensation:"",
        sets:Array.from({length:Math.max(1,Number(pe.sets)||1)},()=>({reps:String(pe.reps??""),load:target.load,done:false,actualReps:""}))};
    });
    setSession({progId:prog.id,weekIdx,dayIdx,dayLabel:day.label,weekLabel:prog.weeks[weekIdx]?.label||"",exercises:exEntries,notes:"",startedAt:Date.now()});
    setSelProg(prog.id);setSelWeek(weekIdx);
    setView("session-active");
  };

  const updateSet=useCallback((exIdx,setIdx,patch)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,sets:ex.sets.map((st,si)=>si!==setIdx?st:{...st,...(typeof patch==="function"?patch(st):patch)})})}));
  },[]);
  const updateEx=useCallback((exIdx,patch)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,...patch})}));
  },[]);

  const completeSession=()=>{
    const all=session.exercises.flatMap(ex=>ex.sets);
    const pending=all.filter(s=>!s.done).length;
    if(pending>0&&!window.confirm(`${pending} série${pending>1?"s":""} non validée${pending>1?"s":""}. Terminer quand même la séance ?`)) return;
    const duration=session.startedAt?Math.max(1,Math.round((Date.now()-session.startedAt)/60000)):null;
    const log={id:uid(),date:todayISO(),programId:session.progId,weekIdx:session.weekIdx,dayIdx:session.dayIdx,dayLabel:session.dayLabel,weekLabel:session.weekLabel,completed:true,notes:session.notes||"",
      ...(duration?{duration}:{}),
      exercises:session.exercises.map(ex=>({exId:ex.exId,name:ex.name,sensation:ex.sensation||"",sets:ex.sets.map(s=>({reps:s.actualReps||s.reps,load:withUnit(s.load,ex.unit)}))}))};
    updateClient(c=>({...c,sessions:(Number(c.sessions)||0)+1,sessionLogs:[log,...(c.sessionLogs||[])]}));
    // Volume = charge × reps des séries validées en kg
    const volume=session.exercises.reduce((a,ex)=>ex.unit!=="kg"?a:a+ex.sets.filter(s=>s.done).reduce((b,s)=>{
      const l=parseFloat(String(s.load).replace(",",".")),r=parseInt(s.actualReps||s.reps);
      return b+(l>0&&r>0?l*r:0);
    },0),0);
    setDoneInfo({duration,setsDone:all.length-pending,totalSets:all.length,volume:Math.round(volume)});
    rest.stop();
    setSession(null);
    setView("session-done");
  };
  const abandonSession=()=>{
    if(!window.confirm("Abandonner cette séance ? Les données saisies ne seront pas enregistrées.")) return;
    rest.stop();
    setSession(null);
    setView(selProg!=null&&selWeek!=null?"week-detail":"list");
  };

  const goTab=t=>{setTab(t);setView("list");};
  const openWeek=(progId,wi)=>{setSelProg(progId);setSelWeek(wi);setView("week-detail");};

  const restBar=rest.running?(
    <RestBar timeLeft={rest.timeLeft} total={rest.total} label={restOwner?.name} onStop={rest.stop} onAdd={()=>rest.add(15)}
      onOpen={session&&view!=="session-active"?()=>setView("session-active"):null}/>
  ):null;
  const shell={active:tab,onNav:goTab,onLogout,restBar,scrollKey:`${tab}|${view}|${selProg}|${selWeek}`};

  // Bandeau « séance en cours » affiché quand on navigue ailleurs pendant une séance
  const sessionDone=session?session.exercises.reduce((a,ex)=>a+ex.sets.filter(s=>s.done).length,0):0;
  const sessionTotal=session?session.exercises.reduce((a,ex)=>a+ex.sets.length,0):0;
  const resumeBanner=session&&(
    <button onClick={()=>setView("session-active")} style={{width:"100%",textAlign:"left",background:`linear-gradient(135deg,${G.gold}26,${G.bg2} 70%)`,border:`1px solid ${G.gold}66`,borderRadius:12,padding:"12px 14px",marginBottom:18,cursor:"pointer",color:G.white,display:"flex",alignItems:"center",gap:12,animation:"pulseGold 2.4s ease infinite"}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,color:G.goldLight,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>● Séance en cours</div>
        <div style={{fontWeight:700,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{session.dayLabel}</div>
        <div style={{fontSize:11,color:G.grey,marginTop:2}}>{sessionDone}/{sessionTotal} séries validées</div>
      </div>
      <span style={{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,borderRadius:8,padding:"9px 14px",fontWeight:700,fontSize:13,flexShrink:0}}>Reprendre ›</span>
    </button>
  );

  // ── SESSION ACTIVE VIEW ──
  if(view==="session-active"&&session){
    return(
      <ClientShell {...shell}>
        <BackBtn onClick={()=>setView(selProg!=null&&selWeek!=null?"week-detail":"list")} label="Retour"/>
        <div style={{marginBottom:6}}>
          <div style={{fontSize:11,color:G.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>En cours</div>
          <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-1}}>{session.dayLabel}</div>
          {session.weekLabel&&<div style={{fontSize:12,color:G.grey,marginTop:2}}>{session.weekLabel}</div>}
        </div>
        {/* Progression (reste collée en haut pendant le défilement) */}
        <div style={{position:"sticky",top:0,zIndex:5,background:G.bg,padding:"10px 0 12px",marginBottom:4}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:6}}>
            <span>Progression</span>
            <span style={{color:sessionDone===sessionTotal?G.green:G.goldLight}}>{sessionDone}/{sessionTotal} séries</span>
          </div>
          <ProgressBar value={sessionDone} max={sessionTotal} color={sessionDone===sessionTotal?G.green:G.goldLight}/>
        </div>

        {session.exercises.map((ex,ei)=>(
          <ExerciseSessionCard key={ei} ex={ex} ei={ei} onSetChange={updateSet} onExChange={updateEx} sessionLogs={logs}
            restActive={rest.running&&restOwner?.ei===ei} restLeft={rest.timeLeft} onStartRest={startRest} onStopRest={rest.stop}/>
        ))}

        <Txa label="Notes de séance (optionnel)" placeholder="Ressenti, observations..." value={session.notes} onChange={e=>{const v=e.target.value;setSession(s=>({...s,notes:v}));}}/>
        <Btn onClick={completeSession}>✓ Terminer la séance</Btn>
        <button onClick={abandonSession} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",color:G.grey,fontSize:12,textDecoration:"underline",cursor:"pointer",padding:8}}>Abandonner la séance</button>
      </ClientShell>
    );
  }

  // ── SESSION DONE ──
  if(view==="session-done"){
    const stats=doneInfo?[
      doneInfo.duration&&[fmtDuration(doneInfo.duration),"Durée"],
      [`${doneInfo.setsDone}/${doneInfo.totalSets}`,"Séries"],
      doneInfo.volume>0&&[`${doneInfo.volume.toLocaleString("fr-FR")} kg`,"Volume"],
    ].filter(Boolean):[];
    return(
      <ClientShell {...shell}>
        <div style={{textAlign:"center",padding:"48px 4px"}} className="fu">
          <div style={{fontSize:56,marginBottom:16}}>🏆</div>
          <div style={{fontFamily:G.fontD,fontSize:32,fontWeight:800,color:G.goldLight,letterSpacing:-1,marginBottom:8}}>SÉANCE TERMINÉE</div>
          <div style={{fontSize:14,color:G.grey,marginBottom:28}}>Bravo, ta séance a bien été enregistrée !</div>
          {stats.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:`repeat(${stats.length},1fr)`,gap:8,marginBottom:32}}>
              {stats.map(([v,l])=>(
                <div key={l} style={{background:G.bg2,borderRadius:12,padding:"14px 6px",border:`1px solid ${G.border}`}}>
                  <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,color:G.goldLight,lineHeight:1.1}}>{v}</div>
                  <div style={{fontSize:10,color:G.grey,letterSpacing:1,textTransform:"uppercase",marginTop:4}}>{l}</div>
                </div>
              ))}
            </div>
          )}
          <Btn onClick={()=>{setView("list");setTab("historique");}}>Voir mon historique</Btn>
          <div style={{height:12}}/>
          <Btn variant="ghost" onClick={()=>{setView("list");setTab("home");}}>Retour à l'accueil</Btn>
        </div>
      </ClientShell>
    );
  }

  // ── WEEK DETAIL (list of days) ──
  if(view==="week-detail"&&selProg!=null&&selWeek!==null){
    const prog=programs.find(p=>String(p.id)===String(selProg));
    const week=prog?.weeks?.[selWeek];
    if(!prog||!week) return(
      <ClientShell {...shell}>
        <BackBtn onClick={()=>setView("list")} label="Mes programmes"/>
        <Empty text="Ce programme n'est plus disponible."/>
      </ClientShell>
    );
    const hasPrev=selWeek>0, hasNext=selWeek<prog.weeks.length-1;
    const navBtn=on=>({background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,width:40,height:40,color:on?G.goldLight:G.greyDim,fontSize:18,cursor:on?"pointer":"default",opacity:on?1:.4,flexShrink:0});
    return(
      <ClientShell {...shell}>
        <BackBtn onClick={()=>setView("list")} label="Mes programmes"/>
        {resumeBanner}
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10,marginBottom:20}}>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,color:G.gold,fontWeight:600,marginBottom:4}}>{prog.name}</div>
            <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-1}} className="gl">{week.label}</div>
          </div>
          {prog.weeks.length>1&&(
            <div style={{display:"flex",gap:6}}>
              <button aria-label="Semaine précédente" disabled={!hasPrev} onClick={()=>setSelWeek(selWeek-1)} style={navBtn(hasPrev)}>‹</button>
              <button aria-label="Semaine suivante" disabled={!hasNext} onClick={()=>setSelWeek(selWeek+1)} style={navBtn(hasNext)}>›</button>
            </div>
          )}
        </div>
        {(week.days||[]).map((d,di)=>{
          const doneLog=findDoneLog(logs,prog.id,selWeek,di);
          const inProgress=isSameSession(session,prog.id,selWeek,di);
          return(
            <div key={di} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${inProgress?G.gold+"88":G.border}`,borderLeft:`3px solid ${inProgress?G.goldLight:doneLog?G.green:G.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:16}}>{d.label}</div>
                  <div style={{fontSize:12,color:doneLog?G.green:G.grey,marginTop:3}}>
                    {inProgress?<span style={{color:G.goldLight}}>● En cours</span>:doneLog?`✓ Faite · ${fmtDate(doneLog.date)}`:`${(d.exercises||[]).length} exercices`}
                  </div>
                </div>
                <button onClick={()=>startSession(prog,selWeek,d,di)} style={doneLog&&!inProgress
                  ?{background:"transparent",color:G.grey,border:`1px solid ${G.border}`,borderRadius:8,padding:"10px 14px",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}
                  :{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none",borderRadius:8,padding:"10px 16px",fontWeight:700,fontSize:13,cursor:"pointer",flexShrink:0}}>
                  {inProgress?"▶ Reprendre":doneLog?"↻ Refaire":"▶ Commencer"}
                </button>
              </div>
              {/* Exercise preview */}
              {(d.exercises||[]).map((pe,i)=>{
                const ex=exercises.find(e=>e.id===pe.exId);
                const t=slotTarget(pe,live.tests).text;
                return(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"8px 0",borderTop:`1px solid ${G.border}`,fontSize:13}}>
                    <span style={{color:G.white,minWidth:0}}>{ex?.name||"?"}</span>
                    <span style={{color:G.grey,flexShrink:0,textAlign:"right"}}>{pe.sets}×{pe.reps}{t?` · ${t}`:""}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </ClientShell>
    );
  }

  // ── MAIN TABS ──
  const completed=logs.filter(l=>l.completed);
  const weekAgo=(()=>{const d=new Date();d.setDate(d.getDate()-6);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;})();
  const thisWeek=completed.filter(l=>(l.date||"")>=weekAgo).length;
  const next=assigned.map(p=>nextSessionOf(p,logs)).find(Boolean);

  return(
    <ClientShell {...shell}>

      {tab==="home"&&(
        <div className="fu">
          <div style={{marginBottom:22}}>
            <div style={{fontSize:11,color:G.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Mon espace</div>
            <div style={{fontFamily:G.fontD,fontSize:30,fontWeight:800,letterSpacing:-1}} className="gl">{(live.name||"").split(" ")[0].toUpperCase()}</div>
          </div>

          {resumeBanner}
          {/* Prochaine séance : accès direct en un clic */}
          {!session&&next&&(
            <div style={{background:`linear-gradient(145deg,${G.gold}22,${G.bg2} 65%)`,border:`1px solid ${G.gold}55`,borderRadius:14,padding:18,marginBottom:22}}>
              <div style={{fontSize:10,color:G.goldLight,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Prochaine séance</div>
              <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-.5,lineHeight:1.1}}>{next.day.label}</div>
              <div style={{fontSize:12,color:G.grey,marginTop:4}}>{next.prog.name} · {next.week.label} · {(next.day.exercises||[]).length} exercices</div>
              <Btn style={{marginTop:14}} onClick={()=>startSession(next.prog,next.wi,next.day,next.di)}>▶ Commencer la séance</Btn>
              <button onClick={()=>{setTab("programme");openWeek(next.prog.id,next.wi);}} style={{display:"block",margin:"10px auto 0",background:"none",border:"none",color:G.grey,fontSize:12,cursor:"pointer",padding:6}}>Voir le détail de la semaine</button>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:28}}>
            {[[completed.length,"Séances"],[thisWeek,"7 derniers j."],[assigned.length,"Programmes"]].map(([v,l])=>(
              <div key={l} style={{background:G.bg2,borderRadius:12,padding:"14px 10px",border:`1px solid ${G.border}`}}>
                <div style={{fontFamily:G.fontD,fontSize:32,fontWeight:800,color:G.goldLight,lineHeight:1}}>{v}</div>
                <div style={{fontSize:9,color:G.grey,letterSpacing:1,textTransform:"uppercase",marginTop:5}}>{l}</div>
              </div>
            ))}
          </div>
          <SH title="Mes programmes"/>
          {assigned.length===0&&<Empty text="Aucun programme assigné pour l'instant"/>}
          {assigned.map(p=>{
            const {total,done}=progProgress(p,logs);
            const n=nextSessionOf(p,logs);
            return(
              <button key={p.id} onClick={()=>{setTab("programme");openWeek(p.id,n?n.wi:0);}} style={{display:"block",width:"100%",textAlign:"left",color:G.white,background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,borderLeft:`3px solid ${G.gold}`,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:16,marginBottom:8}}>{p.name}</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {p.level&&<Tag text={p.level}/>}<Tag text={`${(p.weeks||[]).length} sem.`} color={G.grey}/><Tag text={`${p.weeks?.[0]?.days?.length||0} j/sem`} color={G.grey}/>
                    </div>
                  </div>
                  <div style={{color:G.gold,fontSize:22}}>›</div>
                </div>
                {total>0&&(
                  <div style={{marginTop:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.grey,marginBottom:5}}>
                      <span>{n?"Progression":"Programme terminé 🎉"}</span><span>{done}/{total} séances</span>
                    </div>
                    <ProgressBar value={done} max={total} color={n?G.goldLight:G.green}/>
                  </div>
                )}
              </button>
            );
          })}
          {logs.length>0&&<>
            <div style={{margin:"24px 0 12px"}}><SH title="Dernières séances" onMore={()=>setTab("historique")}/></div>
            {logs.slice(0,3).map((log,i)=>(
              <MiniLogCard key={log.id||i} log={log} programs={programs}/>
            ))}
          </>}
        </div>
      )}

      {tab==="programme"&&(
        <div className="fu">
          <PageH title="MES PROGRAMMES"/>
          {resumeBanner}
          {assigned.length===0&&<Empty text="Aucun programme assigné"/>}
          {assigned.map(p=>{
            const n=nextSessionOf(p,logs);
            return(
              <div key={p.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`}}>
                <div style={{fontWeight:700,fontSize:16,marginBottom:10}}>{p.name}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
                  {p.level&&<Tag text={p.level}/>}<Tag text={`${(p.weeks||[]).length} semaine${(p.weeks||[]).length>1?"s":""}`} color={G.grey}/>
                </div>
                {/* Week list */}
                {(p.weeks||[]).map((w,wi)=>{
                  const days=w.days||[];
                  const done=days.filter((_,di)=>findDoneLog(logs,p.id,wi,di)).length;
                  const complete=days.length>0&&done===days.length;
                  const current=n&&n.wi===wi;
                  return(
                    <button key={wi} onClick={()=>openWeek(p.id,wi)} style={{width:"100%",textAlign:"left",color:G.white,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"12px",background:current?G.gold+"12":G.bg3,borderRadius:9,marginBottom:7,cursor:"pointer",border:`1px solid ${current?G.gold+"66":G.border}`}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:14}}>{w.label}</div>
                        <div style={{fontSize:11,color:G.grey,marginTop:2}}>
                          {days.length} séance{days.length>1?"s":""} · {days.reduce((a,d)=>a+(d.exercises||[]).length,0)} exercices
                          {current&&<span style={{color:G.goldLight}}> · En cours</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                        {done>0&&<span style={{fontSize:11,fontWeight:700,color:complete?G.green:G.goldLight}}>{complete?"✓":`${done}/${days.length}`}</span>}
                        <span style={{color:G.gold,fontSize:18}}>›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {tab==="nutrition"&&(
        <div className="fu">
          <PageH title="NUTRITION"/>
          {resumeBanner}
          {/* Macros */}
          {(()=>{
            const storedItems=(live.mealPlan?.meals||[]).flatMap(m=>m.items||[]);
            const src=storedItems.length>0?calcMacros(storedItems,foods):null;
            const cal=src?rnd(src.kcal):(nutrition.calories||0);
            const prot=src?rnd1(src.protein):(nutrition.proteins||0);
            const gluc=src?rnd1(src.carbs):(nutrition.carbs||0);
            const lip=src?rnd1(src.fat):(nutrition.fats||0);
            return(
              <div style={{background:G.bg2,borderRadius:12,padding:18,border:`1px solid ${G.border}`,marginBottom:20}}>
                <div style={{textAlign:"center",padding:"12px 0 24px"}}>
                  <div style={{fontFamily:G.fontD,fontSize:60,fontWeight:800,color:G.goldLight,lineHeight:1}}>{cal}</div>
                  <div style={{fontSize:11,color:G.grey,letterSpacing:2,textTransform:"uppercase",marginTop:6}}>kcal / jour</div>
                </div>
                <MacroBar label="Protéines" value={prot} max={300} color={G.goldLight}/>
                <MacroBar label="Glucides" value={gluc} max={500} color={G.gold}/>
                <MacroBar label="Lipides" value={lip} max={150} color="#C9A84C66"/>
                {nutrition.notes&&<div style={{marginTop:16,padding:12,background:G.bg3,borderRadius:8,fontSize:13,color:G.grey,fontStyle:"italic",borderLeft:`3px solid ${G.gold}44`}}>📝 {nutrition.notes}</div>}
              </div>
            );
          })()}
          {/* Plan alimentaire */}
          {(()=>{
            const meals=(live.mealPlan?.meals||[]).filter(m=>(m.items||[]).length>0);
            if(meals.length===0)return(
              <div style={{textAlign:"center",padding:"24px 20px",color:G.grey,fontSize:13,background:G.bg2,borderRadius:12,border:`1px solid ${G.border}`}}>
                <div style={{fontSize:24,marginBottom:8}}>🍽</div>
                Ton coach n'a pas encore assigné de plan alimentaire.
              </div>
            );
            return(
              <div>
                <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:12}}>Plan alimentaire</div>
                {meals.map(meal=>{
                  const slot=MEAL_SLOTS.find(s=>s.id===meal.id);
                  const mMacros=calcMacros(meal.items,foods);
                  return(
                    <div key={meal.id} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,borderLeft:`3px solid ${G.gold}55`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:20}}>{slot?.icon||"🍽"}</span>
                          <div style={{fontSize:11,color:G.goldLight,fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{meal.label}</div>
                        </div>
                        <div style={{fontSize:11,color:G.grey}}>{rnd(mMacros.kcal)} kcal</div>
                      </div>
                      {(meal.items||[]).map((item,idx)=>{
                        const food=foods.find(f=>f.id===item.foodId);
                        if(!food)return null;
                        const im=calcMacros([item],foods);
                        return(
                          <div key={idx} style={{paddingBottom:8,marginBottom:8,borderBottom:idx<meal.items.length-1?`1px solid ${G.border}`:"none"}}>
                            <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:3}}>
                              <div style={{fontSize:13,color:G.white,fontWeight:600}}>{food.name}</div>
                              <div style={{fontSize:12,color:G.gold,fontWeight:700,flexShrink:0}}>{item.qty} {food.unit==="g"?"g":"port."}</div>
                            </div>
                            <div style={{fontSize:11,color:G.grey}}>{rnd(im.kcal)} kcal · P {rnd1(im.protein)}g · G {rnd1(im.carbs)}g · L {rnd1(im.fat)}g</div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {tab==="historique"&&(
        <div className="fu">
          <PageH title="HISTORIQUE" subtitle={completed.length?`${completed.length} séance${completed.length>1?"s":""} enregistrée${completed.length>1?"s":""}`:undefined}/>
          {resumeBanner}
          {logs.length===0&&<Empty text="Aucune séance enregistrée"/>}
          {logs.map((log,i)=><LogCard key={log.id||i} log={log} programs={programs}/>)}
        </div>
      )}
    </ClientShell>
  );
}

// ─── COMPTE À REBOURS ─────────────────────────────────────────────────────────
// Basé sur l'heure de fin (et non sur un compteur) : reste juste même si le téléphone
// met l'onglet en veille ou ralentit les minuteries en arrière-plan.
function useCountdown(onEnd){
  const [endAt,setEndAt]=useState(null);
  const [timeLeft,setTimeLeft]=useState(0);
  const [total,setTotal]=useState(0);
  const onEndRef=useRef(onEnd);
  useEffect(()=>{onEndRef.current=onEnd;});
  useEffect(()=>{
    if(!endAt) return;
    let last=null,fired=false;
    const tick=()=>{
      if(fired) return;
      const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));
      setTimeLeft(left);
      if(left!==last&&left>0&&left<=3) playTick();
      last=left;
      if(left<=0){
        fired=true;
        clearInterval(id);
        setEndAt(null);
        playBeep();
        try{navigator.vibrate?.([200,100,200]);}catch{/* non supporté */}
        onEndRef.current?.();
      }
    };
    const id=setInterval(tick,250);
    tick();
    document.addEventListener("visibilitychange",tick);
    return()=>{clearInterval(id);document.removeEventListener("visibilitychange",tick);};
  },[endAt]);
  const start=useCallback(secs=>{setTotal(secs);setTimeLeft(secs);setEndAt(Date.now()+secs*1000);},[]);
  const stop=useCallback(()=>{setEndAt(null);setTimeLeft(0);},[]);
  const add=useCallback(secs=>{setEndAt(e=>e?e+secs*1000:e);setTotal(t=>t+secs);},[]);
  return{timeLeft,running:!!endAt,total,start,stop,add};
}

// ─── AUDIO HELPERS ────────────────────────────────────────────────────────────
// Safari exige que l'AudioContext soit créé/repris pendant un geste utilisateur.
// On le crée au clic "Go" via unlockAudio(), puis on le réutilise pour les bips.
let _audioCtx=null;
function unlockAudio(){
  try{
    if(!_audioCtx) _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(_audioCtx.state==="suspended") _audioCtx.resume();
  }catch{/* audio indisponible */}
}
function playTone(freq,dur,vol=0.4){
  try{
    const ctx=_audioCtx;
    if(!ctx||ctx.state==="suspended") return;
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);gain.connect(ctx.destination);
    osc.frequency.value=freq;osc.type="sine";
    gain.gain.setValueAtTime(vol,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    osc.start(ctx.currentTime);osc.stop(ctx.currentTime+dur);
    // Disconnect nodes after playback to prevent memory accumulation (critical in Safari)
    const cleanup=()=>{try{osc.disconnect();gain.disconnect();}catch{/* déjà déconnecté */}};
    osc.onended=cleanup;
    setTimeout(cleanup,(dur+0.5)*1000); // fallback si onended ne se déclenche pas
  }catch{/* audio indisponible */}
}
const playTick=()=>playTone(660,0.12,0.3);
const playBeep=()=>{playTone(880,0.15,0.5);setTimeout(()=>playTone(1100,0.25,0.6),160);};

// Parse "90s", "2min", "1:30", "1min30" → secondes
function parseRest(rest){
  const s=String(rest??"").toLowerCase().replace(/\s/g,"");
  if(!s) return 0;
  let m=s.match(/^(\d+)(?:min|m|')(\d+)?/);
  if(m) return Number(m[1])*60+(Number(m[2])||0);
  m=s.match(/^(\d+):(\d{1,2})$/);
  if(m) return Number(m[1])*60+Number(m[2]);
  return parseInt(s)||0;
}
// Détecte si la valeur de reps est un temps (ex: "30s", "45s", "2min")
const isTimed=r=>/^\d+(\.\d+)?(s|sec|min)$/.test(String(r??"").toLowerCase().replace(/\s/g,""));

// ─── BARRE DE RÉCUPÉRATION (au-dessus du menu) ────────────────────────────────
function RestBar({timeLeft,total,label,onStop,onAdd,onOpen}){
  const urgent=timeLeft<=3;
  const c=urgent?G.red:G.goldLight;
  return(
    <div role="timer" aria-live="off" style={{flexShrink:0,background:G.bg2,borderTop:`1px solid ${c}66`,position:"relative"}}>
      <div style={{position:"absolute",top:0,left:0,height:2,width:`${total?timeLeft/total*100:0}%`,background:c,transition:"width .25s linear"}}/>
      <div style={{maxWidth:640,margin:"0 auto",display:"flex",alignItems:"center",gap:10,padding:"10px 16px"}}>
        <div onClick={onOpen||undefined} style={{flex:1,minWidth:0,cursor:onOpen?"pointer":"default"}}>
          <div style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            Récup{label?` · ${label}`:""}{onOpen?" · revenir ›":""}
          </div>
          <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,color:c,lineHeight:1.05,fontVariantNumeric:"tabular-nums"}}>{fmtClock(timeLeft)}</div>
        </div>
        <button onClick={onAdd} style={{background:G.bg3,color:G.goldLight,border:`1px solid ${G.gold}44`,borderRadius:8,padding:"10px 12px",fontWeight:700,fontSize:13,cursor:"pointer"}}>+15s</button>
        <button onClick={onStop} aria-label="Arrêter la récupération" style={{background:G.red+"22",color:G.red,border:`1px solid ${G.red}44`,borderRadius:8,padding:"10px 12px",fontWeight:700,fontSize:13,cursor:"pointer"}}>✕ Stop</button>
      </div>
    </div>
  );
}

// ─── EXERCISE SESSION CARD ────────────────────────────────────────────────────
const iconBtn=active=>({background:active?G.goldLight+"22":G.bg3,color:active?G.goldLight:G.grey,border:`1px solid ${active?G.gold+"66":G.border}`,borderRadius:8,minWidth:38,height:38,padding:"0 10px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"});
const setBtn={width:"100%",borderRadius:7,padding:"10px 0",fontSize:13,fontWeight:700,cursor:"pointer"};

function ExerciseSessionCard({ex,ei,onSetChange,onExChange,sessionLogs,restActive,restLeft,onStartRest,onStopRest}){
  const [vidOpen,setVidOpen]=useState(false);
  const [histOpen,setHistOpen]=useState(false);
  const unit=ex.unit||"kg";
  const restSecs=parseRest(ex.rest);
  const startRest=()=>{if(restSecs>0)onStartRest(ei,restSecs,ex.name);};

  // Chrono de travail (exercices en temps) : à la fin, la série est validée et la récup démarre
  const [activeWorkSet,setActiveWorkSet]=useState(null);
  const activeWorkSetRef=useRef(null);
  useEffect(()=>{activeWorkSetRef.current=activeWorkSet;},[activeWorkSet]);
  const work=useCountdown(()=>{
    const aws=activeWorkSetRef.current;
    if(aws===null) return;
    onSetChange(ei,aws,{done:true});
    setActiveWorkSet(null);
    startRest();
  });

  const allSetsDone=ex.sets.every(s=>s.done);

  const history=[];
  for(const log of (sessionLogs||[])){
    if(history.length>=4) break;
    const found=(log.exercises||[]).find(e=>e.exId===ex.exId);
    if(found) history.push({date:log.date,dayLabel:log.dayLabel,sets:found.sets||[]});
  }
  const last=history[0];

  return(
    <div style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:14,border:`1.5px solid ${allSetsDone?G.green+"55":G.border}`,transition:"border .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15}}><span style={{color:G.gold,fontFamily:G.fontD,marginRight:6}}>{ei+1}.</span>{ex.name}</div>
          {ex.target&&<div style={{fontSize:12,color:G.goldLight,marginTop:4,fontWeight:600}}>🎯 {ex.target}</div>}
          {ex.coachNote&&<div style={{fontSize:12,color:G.white+"cc",marginTop:4,lineHeight:1.4}}>📝 {ex.coachNote}</div>}
          {ex.notes&&<div style={{fontSize:11,color:G.gold+"aa",marginTop:4,lineHeight:1.4}}>💡 {ex.notes}</div>}
          {ex.muscle&&<div style={{marginTop:6}}><Tag text={ex.muscle} color={G.grey}/></div>}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
          {allSetsDone&&<div style={{...iconBtn(false),color:G.green,borderColor:G.green+"55",background:G.green+"18",cursor:"default"}}>✓</div>}
          {history.length>0&&<button aria-label="Historique de l'exercice" onClick={()=>setHistOpen(!histOpen)} style={iconBtn(histOpen)}>📊</button>}
          {ex.videoUrl&&<button aria-label="Vidéo de démonstration" onClick={()=>setVidOpen(!vidOpen)} style={iconBtn(vidOpen)}>▶</button>}
        </div>
      </div>

      {/* Dernière performance, visible d'un coup d'œil */}
      {last&&!histOpen&&(
        <div style={{fontSize:11,color:G.grey,marginBottom:10,lineHeight:1.5}}>
          <span style={{color:G.gold}}>Dernière fois</span> ({fmtDate(last.date)}) : {last.sets.map(s=>`${s.load||"—"}×${s.reps}`).join(" · ")}
        </div>
      )}

      {histOpen&&history.length>0&&(
        <div style={{background:G.bg3,borderRadius:10,padding:12,marginBottom:12,border:`1px solid ${G.border}`}}>
          <div style={{fontSize:11,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Historique récent</div>
          {history.map((h,hi)=>(
            <div key={hi} style={{marginBottom:hi<history.length-1?10:0}}>
              <div style={{fontSize:11,color:G.gold,marginBottom:5}}>{fmtDate(h.date)}{h.dayLabel?` — ${h.dayLabel}`:""}</div>
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
          <iframe title={`Vidéo — ${ex.name}`} loading="lazy" style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={toEmbed(ex.videoUrl)} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
        </div>
      )}

      {/* Chrono récupération + unité de charge */}
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"stretch"}}>
        {restSecs>0&&(
          <div style={{flex:1,background:restActive&&restLeft<=3?G.red+"22":restActive?G.gold+"15":G.bg3,border:`1px solid ${restActive&&restLeft<=3?G.red+"88":restActive?G.gold+"55":G.border}`,borderRadius:10,padding:"8px 8px 8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,transition:"all .3s"}}>
            <div>
              <div style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:1}}>Récup</div>
              <div style={{fontFamily:G.fontD,fontSize:restActive?24:16,fontWeight:800,color:restActive?(restLeft<=3?G.red:G.goldLight):G.grey,transition:"all .3s",letterSpacing:-.5,lineHeight:1.1,fontVariantNumeric:"tabular-nums"}}>{restActive?fmtClock(restLeft):fmtClock(restSecs)}</div>
            </div>
            {restActive
              ?<button onClick={onStopRest} style={{background:G.red+"22",color:G.red,border:`1px solid ${G.red}44`,borderRadius:8,padding:"10px 12px",fontWeight:700,fontSize:13,cursor:"pointer"}}>✕ Stop</button>
              :<button onClick={startRest} style={{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none",borderRadius:8,padding:"10px 14px",fontWeight:700,fontSize:13,cursor:"pointer"}}>▶ Go</button>
            }
          </div>
        )}
        <label style={{flex:restSecs>0?"0 0 auto":1,background:G.bg3,border:`1px solid ${G.border}`,borderRadius:10,padding:"8px 10px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <span style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Unité</span>
          <select value={unit} onChange={e=>onExChange(ei,{unit:e.target.value})}
            style={{background:"transparent",border:"none",color:G.goldLight,fontSize:14,fontWeight:700,outline:"none",cursor:"pointer",padding:0}}>
            {LOAD_UNITS.map(u=><option key={u} value={u} style={{background:G.bg2}}>{u}</option>)}
          </select>
        </label>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:8}}>
        {ex.sets.map((st,si)=>{
          const timed=isTimed(st.reps);
          const workSecs=timed?parseRest(st.reps):0;
          const isActiveWork=work.running&&activeWorkSet===si;
          const prevLoad=last?.sets?.[si]?.load;
          return(
            <div key={si} style={{background:st.done?G.green+"18":G.bg3,borderRadius:9,padding:"10px 8px 8px",border:`1.5px solid ${st.done?G.green+"55":G.border}`,transition:"all .2s"}}>
              {/* Titre série */}
              <div style={{fontSize:10,color:st.done?G.green:G.grey,fontWeight:700,letterSpacing:.8,marginBottom:6}}>
                SÉRIE {si+1}
                {st.actualReps&&!timed
                  ?<span> · <span style={{color:G.red,textDecoration:"line-through"}}>{st.reps}</span> <span style={{color:G.goldLight}}>{st.actualReps}</span></span>
                  :<span> · {st.reps}</span>
                }
              </div>

              {/* Chrono de travail (exercices en temps) */}
              {timed&&!st.done&&(
                <div style={{textAlign:"center",padding:"6px 0 8px",borderBottom:`1px solid ${G.border}`,marginBottom:8}}>
                  <div style={{fontFamily:G.fontD,fontWeight:800,lineHeight:1,transition:"all .3s",fontVariantNumeric:"tabular-nums",
                    fontSize:isActiveWork?(work.timeLeft<=3?44:28):20,
                    color:isActiveWork?(work.timeLeft<=3?G.red:G.goldLight):G.grey}}>
                    {isActiveWork?(work.timeLeft<=3?work.timeLeft:fmtClock(work.timeLeft)):st.reps}
                  </div>
                </div>
              )}

              {/* Charge (visible sauf si timed et chrono en cours) */}
              {!(timed&&isActiveWork)&&(
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8,borderBottom:`1px solid ${G.border}`}}>
                  <input value={st.load} onChange={e=>onSetChange(ei,si,{load:e.target.value})} placeholder={prevLoad?String(prevLoad).replace(/\s*kg$/i,""):"—"}
                    inputMode={unit==="élastique"?"text":"decimal"} aria-label={`Charge série ${si+1}`}
                    style={{flex:1,background:"transparent",border:"none",color:st.done?G.green:G.white,fontSize:16,fontWeight:700,outline:"none",padding:"4px 0",textAlign:"center",minWidth:0}}/>
                  <span style={{fontSize:11,color:G.grey,flexShrink:0}}>{unit}</span>
                </div>
              )}

              {/* Reps réalisées (exercices non-chronométrés uniquement) */}
              {!timed&&!st.done&&(
                <input
                  type="number" inputMode="numeric" min="0"
                  value={st.actualReps||""}
                  onChange={e=>onSetChange(ei,si,{actualReps:e.target.value})}
                  placeholder={`reps : ${st.reps}`} aria-label={`Répétitions réalisées série ${si+1}`}
                  style={{width:"100%",background:"transparent",border:"none",borderBottom:`1px solid ${G.border}`,color:st.actualReps?G.goldLight:G.grey,fontSize:12,fontWeight:600,outline:"none",padding:"4px 0",textAlign:"center",marginBottom:8}}/>
              )}

              {/* Bouton action */}
              {st.done?(
                <button onClick={()=>onSetChange(ei,si,{done:false})}
                  style={{...setBtn,background:"transparent",color:G.green,border:`1px solid ${G.green+"55"}`}}>
                  ✓ Fait
                </button>
              ):timed?(
                isActiveWork
                  ?<button onClick={()=>{work.stop();setActiveWorkSet(null);}}
                    style={{...setBtn,background:G.red+"22",color:G.red,border:`1px solid ${G.red}44`}}>
                    ✕ Stop
                  </button>
                  :<button onClick={()=>{unlockAudio();setActiveWorkSet(si);work.start(workSecs);}}
                    style={{...setBtn,background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg,border:"none"}}>
                    ▶ Lancer
                  </button>
              ):(
                <button onClick={()=>{onSetChange(ei,si,{done:true});startRest();}}
                  style={{...setBtn,background:G.goldLight+"18",color:G.goldLight,border:`1px solid ${G.gold+"44"}`}}>
                  Valider
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div style={{marginTop:12}}>
        <div style={{fontSize:10,color:G.grey,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>Ressenti</div>
        <div style={{display:"flex",gap:6}}>
          {[["😊","Facile"],["😐","Correct"],["😤","Difficile"],["💀","Épuisant"]].map(([emoji,label])=>(
            <button key={emoji} onClick={()=>onExChange(ei,{sensation:ex.sensation===emoji?"":emoji})} aria-label={label} aria-pressed={ex.sensation===emoji}
              style={{flex:1,padding:"6px 0 4px",background:ex.sensation===emoji?G.gold+"33":"transparent",border:`1px solid ${ex.sensation===emoji?G.gold:G.border}`,borderRadius:8,cursor:"pointer",transition:"all .2s",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:18}}>{emoji}</span>
              <span style={{fontSize:9,color:ex.sensation===emoji?G.goldLight:G.grey,fontWeight:600}}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── CLIENT SHELL ─────────────────────────────────────────────────────────────
function ClientShell({children,active,onNav,onLogout,scrollKey,restBar}){
  const items=[{key:"home",icon:"◈",label:"Accueil"},{key:"programme",icon:"▦",label:"Programme"},{key:"nutrition",icon:"◎",label:"Nutrition"},{key:"historique",icon:"◷",label:"Historique"}];
  const scrollRef=useRef(null);
  // Chaque nouvel écran s'ouvre en haut de page
  useEffect(()=>{scrollRef.current?.scrollTo(0,0);},[scrollKey]);
  return(
    <>
      <div ref={scrollRef} style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:"16px 20px 32px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:G.fontD,fontSize:13,fontWeight:800,letterSpacing:.5,color:G.grey}}>WANDY<span style={{color:G.gold}}> COACH</span></div>
            <button onClick={()=>{if(window.confirm("Se déconnecter de ton espace ?"))onLogout();}} style={{background:G.bg3,border:`1px solid ${G.border}`,borderRadius:8,padding:"8px 12px",color:G.grey,fontSize:11,cursor:"pointer"}}>Déconnexion</button>
          </div>
          {children}
        </div>
      </div>
      {restBar}
      <nav className="sb" style={{flexShrink:0,width:"100%",background:G.bg2,borderTop:`1px solid ${G.border}`,zIndex:100}}>
        <div style={{display:"flex",maxWidth:640,margin:"0 auto"}}>
          {items.map(({key,icon,label})=>{
            const a=active===key;
            return<button key={key} onClick={()=>onNav(key)} aria-current={a?"page":undefined} style={{flex:1,minHeight:56,padding:"10px 0 8px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:a?G.goldLight:G.grey,fontSize:10,fontWeight:600,letterSpacing:.5,transition:"color .2s",borderTop:a?`2px solid ${G.goldLight}`:"2px solid transparent"}}>
              <span style={{fontSize:18,lineHeight:1}}>{icon}</span><span>{label}</span>
            </button>;
          })}
        </div>
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
      // Modèle et longueur de réponse sont fixés côté serveur ; l'accès est réservé au coach connecté
      const idToken=await auth.currentUser?.getIdToken();
      if(!idToken) throw new Error("Session expirée, reconnecte-toi");
      // La conversation envoyée commence au premier message du coach (le message d'accueil reste local)
      const history=newMsgs.slice(newMsgs.findIndex(m=>m.role==="user"));
      const res=await fetch(`${API_BASE}/api/chat`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${idToken}`},
        body:JSON.stringify({
          system:SYSTEM,
          messages:history.map(m=>({role:m.role,content:m.content||"(programme créé)"}))
        })
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||"Erreur serveur");
      const text=data.text||"Désolé, une erreur s'est produite.";

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
          <div style={{fontSize:11,color:G.grey,marginTop:2}}>{fmtDate(log.date)}</div>
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
          <div style={{fontSize:12,color:G.grey,marginTop:2}}>{fmtDate(log.date)}{log.weekLabel?` · ${log.weekLabel}`:""}{log.duration?` · ${fmtDuration(log.duration)}`:""}</div>
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
                    <div style={{fontSize:11,color:G.grey,marginTop:2}}>{s.reps}{isTimed(s.reps)?"":" reps"}</div>
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
