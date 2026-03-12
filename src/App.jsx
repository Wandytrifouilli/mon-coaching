import { useState } from "react";

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
  {id:1,name:"Squat Barre",muscle:"Jambes",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/ultWZbUMPL8",notes:"Dos droit, genoux alignés"},
  {id:2,name:"Développé Couché",muscle:"Pectoraux",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/rT7DgCr-3pg",notes:"Coudes à 45°"},
  {id:3,name:"Tractions",muscle:"Dos",equipment:"Barre fixe",videoUrl:"https://www.youtube.com/embed/eGo4IYlbE5g",notes:"Pleine amplitude"},
  {id:4,name:"Soulevé de Terre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/op9kVnSso6Q",notes:"Barre proche du corps"},
  {id:5,name:"Développé Militaire",muscle:"Épaules",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/2yjwXTZQDDI",notes:"Core serré"},
  {id:6,name:"Curl Haltères",muscle:"Biceps",equipment:"Haltères",videoUrl:"",notes:"Supination en haut"},
  {id:7,name:"Triceps Poulie",muscle:"Triceps",equipment:"Poulie",videoUrl:"",notes:"Coudes fixes"},
  {id:8,name:"Gainage Planche",muscle:"Abdominaux",equipment:"Aucun",videoUrl:"",notes:"Bassin neutre"},
  {id:9,name:"Fentes Marchées",muscle:"Jambes",equipment:"Haltères",videoUrl:"",notes:"Genou arrière bas"},
  {id:10,name:"Rowing Barre",muscle:"Dos",equipment:"Barre",videoUrl:"https://www.youtube.com/embed/G8l_8chR5BE",notes:"Dos parallèle"},
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
export default function App(){
  const [auth,setAuth]=useState("login");
  const [exercises,setExercises]=useState(SEED_EX);
  const [programs,setPrograms]=useState(SEED_PROGRAMS);
  const [clients,setClients]=useState(SEED_CLIENTS);
  const [currentClient,setCurrentClient]=useState(null);
  const [coachView,setCoachView]=useState("dashboard");
  const [selClient,setSelClient]=useState(null);
  const [selProgram,setSelProgram]=useState(null);

  const login=code=>{
    if(code.toUpperCase()==="COACH2025"){setAuth("coach");return true;}
    const c=clients.find(c=>c.code===code.toUpperCase());
    if(c){setCurrentClient(c);setAuth("client");return true;}
    return false;
  };
  const logout=()=>{setAuth("login");setCurrentClient(null);setCoachView("dashboard");};

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
        {coachView==="client-detail"&&selClient&&<ClientDetail client={clients.find(c=>c.id===selClient.id)||selClient} clients={clients} setClients={setClients} setSel={setSelClient} programs={programs} exercises={exercises} go={setCoachView} selP={p=>{setSelProgram(p);setCoachView("program-detail");}}/>}
        {coachView==="new-client"&&<NewClient setClients={setClients} go={setCoachView}/>}
        {coachView==="programs"&&<ProgramsList programs={programs} exercises={exercises} go={setCoachView} sel={p=>{setSelProgram(p);setCoachView("program-detail");}}/>}
        {coachView==="program-detail"&&selProgram&&<ProgramDetail program={selProgram} exercises={exercises} go={setCoachView}/>}
        {coachView==="new-program"&&<NewProgram exercises={exercises} setPrograms={setPrograms} go={setCoachView}/>}
        {coachView==="exercises"&&<ExLib exercises={exercises} setExercises={setExercises} go={setCoachView}/>}
        {coachView==="new-exercise"&&<NewEx setExercises={setExercises} go={setCoachView}/>}
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
      {/* Notch */}
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
    {IS_MOBILE&&<div style={{background:G.bg,width:"100%",maxWidth:430,minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:G.font,color:G.white}}>
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
        <div style={{fontFamily:G.fontD,fontSize:36,fontWeight:800,color:G.white,letterSpacing:-1}}>COACH<span style={{color:G.goldLight}}>PRO</span></div>
        <div style={{fontSize:11,color:G.grey,marginTop:5,letterSpacing:3,textTransform:"uppercase"}}>Espace personnel</div>
      </div>
      <div style={{width:"100%"}} className="fu">
        <Label>Code d'accès</Label>
        <input value={code} onChange={e=>{setCode(e.target.value.toUpperCase());setErr(false);}} onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Ex: SOPH2025"
          style={{width:"100%",background:G.bg3,border:`1.5px solid ${err?G.red:G.border}`,borderRadius:10,padding:"14px 16px",color:G.white,fontSize:18,outline:"none",letterSpacing:3,textAlign:"center",marginBottom:8,transition:"border .2s"}}/>
        {err&&<div style={{color:G.red,fontSize:12,textAlign:"center",marginBottom:8}}>Code invalide — contacte ton coach.</div>}
        <div style={{height:8}}/>
        <Btn onClick={attempt} disabled={!code}>Accéder →</Btn>
      </div>
      <div style={{marginTop:32,padding:16,background:G.bg2,borderRadius:12,border:`1px solid ${G.border}`,width:"100%"}} className="fu">
        <div style={{fontSize:10,color:G.greyDim,textAlign:"center",marginBottom:10,letterSpacing:1.5,textTransform:"uppercase"}}>Comptes démo</div>
        {[["🎯 Coach","COACH2025","Accès complet"],["Sophie","SOPH2025","Cliente"],["Thomas","THOM2025","Client"]].map(([n,c,r])=>(
          <div key={c} onClick={()=>{setCode(c);setErr(false);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 4px",cursor:"pointer",borderBottom:`1px solid ${G.border}`}}>
            <span style={{color:G.grey,fontSize:13}}>{n} <span style={{color:G.greyDim,fontSize:11}}>· {r}</span></span>
            <span style={{color:G.goldLight,fontFamily:"monospace",letterSpacing:2,fontSize:13}}>{c}</span>
          </div>
        ))}
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
      {IS_MOBILE&&<div style={{background:G.bg,width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:28,fontFamily:G.font,color:G.white}}>
        {loginContent}
      </div>}
    </div>
  );
}

// ─── COACH NAV ────────────────────────────────────────────────────────────────
function CoachNav({view,setView}){
  const items=[{key:"dashboard",icon:"◈",label:"Accueil"},{key:"clients",icon:"◉",label:"Clients"},{key:"programs",icon:"▦",label:"Prog."},{key:"exercises",icon:"⊕",label:"Exercices"}];
  const ak=v=>{if(["client-detail","new-client"].includes(v))return"clients";if(["program-detail","new-program"].includes(v))return"programs";if(v==="new-exercise")return"exercises";return v;};
  return(
    <nav style={{flexShrink:0,width:"100%",background:G.bg2,borderTop:`1px solid ${G.border}`,display:"flex",zIndex:100}}>
      {items.map(({key,icon,label})=>{
        const a=ak(view)===key;
        return<button key={key} onClick={()=>setView(key)} style={{flex:1,padding:"12px 0 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",color:a?G.goldLight:G.greyDim,fontSize:10,fontWeight:600,letterSpacing:.5,transition:"color .2s",borderTop:a?`2px solid ${G.goldLight}`:"2px solid transparent"}}>
          <span style={{fontSize:18}}>{icon}</span><span>{label}</span>
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:28}}>
        {[[clients.length,"Clients"],[programs.length,"Programmes"],[exercises.length,"Exercices"]].map(([v,l])=>(
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
function ClientDetail({client,clients,setClients,setSel,programs,exercises,go,selP}){
  const [tab,setTab]=useState("program");
  const [showLog,setShowLog]=useState(false);
  const [logForm,setLogForm]=useState({date:new Date().toISOString().split("T")[0],programId:"",weekIdx:"",dayIdx:"",completed:true,notes:""});
  const [nutForm,setNutForm]=useState({...client.nutrition});
  const [editNut,setEditNut]=useState(false);

  const upd=fn=>{setClients(p=>p.map(c=>c.id===client.id?fn(c):c));setSel(fn(client));};
  const toggle=pid=>upd(c=>({...c,programs:c.programs.includes(pid)?c.programs.filter(x=>x!==pid):[...c.programs,pid]}));
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
                <div style={{fontWeight:700}}>{p.name}</div>
                <BtnSm variant="danger" onClick={()=>toggle(p.id)}>Retirer</BtnSm>
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
function ProgramsList({programs,exercises,go,sel}){
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <PageH title="PROGRAMMES" subtitle={`${programs.length} créés`} action={<BtnSm onClick={()=>go("new-program")}>+ Nouveau</BtnSm>}/>
      {programs.map((p,i)=>(
        <div key={p.id} onClick={()=>sel(p)} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:10,border:`1px solid ${G.border}`,cursor:"pointer",animationDelay:`${i*50}ms`}} className="fu">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{p.name}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[p.category,p.level,`${p.weeks.length} sem.`,`${p.weeks[0]?.days.length||0} j/sem`].filter(Boolean).map(t=><Tag key={t} text={t} color={G.grey}/>)}
              </div>
            </div>
            <div style={{color:G.greyDim,fontSize:20}}>›</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PROGRAM DETAIL (coach) ───────────────────────────────────────────────────
function ProgramDetail({program,exercises,go}){
  const [weekIdx,setWeekIdx]=useState(0);
  const [dayIdx,setDayIdx]=useState(0);
  const [playing,setPlaying]=useState(null);
  const week=program.weeks[weekIdx];
  const day=week?.days[dayIdx];
  return(
    <div style={{padding:"28px 20px 0"}} className="fu">
      <BackBtn onClick={()=>go("programs")} label="Programmes"/>
      <PageH title={program.name} subtitle={`${program.weeks.length} semaine${program.weeks.length>1?"s":""}`}/>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
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
        {week.days.map((d,i)=>(
          <button key={i} onClick={()=>{setDayIdx(i);setPlaying(null);}} style={{flexShrink:0,padding:"6px 14px",background:dayIdx===i?G.bg4:G.bg3,color:dayIdx===i?G.white:G.grey,border:`1px solid ${dayIdx===i?G.border+"88":G.border}`,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"}}>
            {d.label} <span style={{fontSize:11,opacity:.5}}>({d.exercises.length})</span>
          </button>
        ))}
      </div>}

      {day&&day.exercises.map((pe,i)=>{
        const ex=exercises.find(e=>e.id===pe.exId);
        if(!ex)return null;
        const key=`${weekIdx}-${dayIdx}-${i}`;
        return(
          <div key={i} style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:12,border:`1px solid ${G.border}`}}>
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
            {form.weeks.length>1&&<BtnSm variant="danger" onClick={()=>removeWeek(weekIdx)}>✕ Sem.</BtnSm>}
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
                  <BtnSm variant="danger" onClick={()=>toggleEx(ex)}>✕</BtnSm>
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
      return{exId:pe.exId,name:ex?.name||"",videoUrl:ex?.videoUrl||"",notes:ex?.notes||"",muscle:ex?.muscle||"",sets:Array.from({length:pe.sets},()=>({reps:pe.reps,load:pe.targetLoad||"",done:false}))};
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

  const completeSession=()=>{
    const log={id:uid(),date:new Date().toISOString().split("T")[0],programId:session.progId,weekIdx:session.weekIdx,dayIdx:session.dayIdx,dayLabel:session.dayLabel,weekLabel:session.weekLabel,completed:true,notes:session.notes,exercises:session.exercises.map(ex=>({exId:ex.exId,name:ex.name,sets:ex.sets.map(s=>({reps:s.reps,load:s.load}))}))};
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
          <ExerciseSessionCard key={ei} ex={ex} ei={ei} onLoadChange={updateLoad} onToggleDone={toggleDone}/>
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
            {[[live.sessions,"Séances totales"],[assigned.length,"Programmes actifs"]].map(([v,l])=>(
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

// ─── EXERCISE SESSION CARD (needs own state for video toggle) ─────────────────
function ExerciseSessionCard({ex,ei,onLoadChange,onToggleDone}){
  const [vidOpen,setVidOpen]=useState(false);
  const allSetsDone=ex.sets.every(s=>s.done);
  return(
    <div style={{background:G.bg2,borderRadius:12,padding:16,marginBottom:14,border:`1.5px solid ${allSetsDone?G.green+"55":G.border}`,transition:"border .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:15}}><span style={{color:G.gold,fontFamily:G.fontD,marginRight:6}}>{ei+1}.</span>{ex.name}</div>
          {ex.notes&&<div style={{fontSize:11,color:G.gold+"88",marginTop:4}}>💡 {ex.notes}</div>}
          {ex.muscle&&<div style={{marginTop:6}}><Tag text={ex.muscle} color={G.grey}/></div>}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:8}}>
          {ex.videoUrl&&<BtnSm onClick={()=>setVidOpen(!vidOpen)}>{vidOpen?"▼":"▶"}</BtnSm>}
          {allSetsDone&&<Tag text="✓" color={G.green}/>}
        </div>
      </div>
      {vidOpen&&ex.videoUrl&&(
        <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:8,overflow:"hidden",background:"#000",marginBottom:12}}>
          <iframe style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={ex.videoUrl} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8}}>
        {ex.sets.map((st,si)=>(
          <div key={si} style={{background:st.done?G.green+"18":G.bg3,borderRadius:9,padding:"10px 10px 8px",border:`1.5px solid ${st.done?G.green+"55":G.border}`,transition:"all .2s"}}>
            <div style={{fontSize:10,color:st.done?G.green:G.grey,fontWeight:700,letterSpacing:.8,marginBottom:6}}>SÉRIE {si+1} · {st.reps}</div>
            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:8}}>
              <input value={st.load} onChange={e=>onLoadChange(ei,si,e.target.value)} placeholder="—" style={{flex:1,background:"transparent",border:"none",borderBottom:`1px solid ${G.border}`,color:st.done?G.green:G.white,fontSize:14,fontWeight:700,outline:"none",padding:"2px 0",textAlign:"center",minWidth:0}}/>
              <span style={{fontSize:11,color:G.grey}}>kg</span>
            </div>
            <button onClick={()=>onToggleDone(ei,si)} style={{width:"100%",background:st.done?"transparent":G.goldLight+"18",color:st.done?G.green:G.goldLight,border:`1px solid ${st.done?G.green+"55":G.gold+"44"}`,borderRadius:6,padding:"5px 0",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {st.done?"✓ Fait":"Valider"}
            </button>
          </div>
        ))}
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
              <div style={{fontWeight:600,fontSize:13,color:G.goldLight,marginBottom:8}}>{ex.name}</div>
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
