import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { db, doc, collection, onSnapshot, setDoc, deleteDoc, auth, onAuthStateChanged, signOut, isCoachUser, loginClientWithCode, loginCoach, API_BASE } from "./firebase.js";


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
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes sheetUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pop{0%{transform:scale(.6)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
  @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:.35}}
  .noscroll{scrollbar-width:none;}
  .noscroll::-webkit-scrollbar{display:none;}
  input::placeholder,textarea::placeholder{color:#5c5c5c;}
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

const MEAL_SLOTS=[
  {id:"breakfast",icon:"🌅",label:"Petit déjeuner"},
  {id:"snack1",icon:"🍎",label:"Collation matin"},
  {id:"lunch",icon:"🥗",label:"Déjeuner"},
  {id:"snack2",icon:"🍌",label:"Collation après-midi"},
  {id:"dinner",icon:"🌙",label:"Dîner"},
  {id:"other",icon:"💊",label:"Autre / Suppléments"},
];

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
const Btn=({children,variant="gold",style:s={},...p})=>{
  const v={gold:{background:`linear-gradient(135deg,${G.goldLight},${G.gold})`,color:G.bg},outline:{background:"transparent",color:G.gold,border:`1px solid ${G.gold}55`},ghost:{background:G.bg3,color:G.grey,border:`1px solid ${G.border}`},danger:{background:"#E0525215",color:G.red,border:`1px solid ${G.red}33`}};
  return <button style={{border:"none",borderRadius:8,padding:"12px 20px",fontWeight:700,fontSize:14,cursor:"pointer",width:"100%",display:"block",...v[variant],...s}} {...p}>{children}</button>;
};

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
  // (la redirection vers /coach se fait au rendu une fois la session ouverte)
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
    // Espace coach unique (ordinateur et téléphone), même session Auth
    window.location.replace("/coach");
    return <Shell css={css}><Loading label="Ouverture de l'espace coach…"/></Shell>;
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
          width:84,height:84,borderRadius:28,
          background:`radial-gradient(circle at 50% 35%,${G.gold}38,#121212 70%)`,
          border:`1px solid ${G.gold}55`,
          display:"flex",alignItems:"center",justifyContent:"center",
          margin:"0 auto 22px",
          boxShadow:`0 14px 44px ${G.gold}2e, inset 0 1px 0 #ffffff14`
        }}>
          <svg width="42" height="42" viewBox="0 0 24 24" aria-hidden="true">
            <defs><linearGradient id="boltG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={G.goldLight}/><stop offset="1" stopColor={G.gold}/></linearGradient></defs>
            <path d="M13.5 2 4 14h7l-1.5 8L20 9.5h-7z" fill="url(#boltG)"/>
          </svg>
        </div>
        <div style={{fontFamily:G.fontD,fontSize:38,fontWeight:800,color:G.white,letterSpacing:-1.5,lineHeight:1}}>
          WANDY<span style={{color:G.goldLight}}> COACH</span>
        </div>
        <div style={{fontSize:11,color:G.grey,marginTop:8,letterSpacing:4,textTransform:"uppercase"}}>
          Espace personnel
        </div>
      </div>

      {/* Card */}
      <form onSubmit={attempt} style={{
        width:"100%",background:"linear-gradient(180deg,#151515,#0e0e0e)",
        borderRadius:26,padding:"26px 22px",
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
            borderRadius:16,padding:"16px 18px",
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
            width:"100%",height:54,padding:0,
            background:active?`linear-gradient(135deg,${G.goldLight},${G.gold})`:"#222",
            border:"none",borderRadius:16,
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


// ─── CLIENT : OUTILS ──────────────────────────────────────────────────────────
const pad2=n=>String(n).padStart(2,"0");
const isoOf=d=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
// Date locale (et non UTC) : une séance terminée à 0h30 reste datée du bon jour
const todayISO=()=>isoOf(new Date());
const parseISO=iso=>/^\d{4}-\d{2}-\d{2}/.test(iso||"")?new Date(Number(iso.slice(0,4)),Number(iso.slice(5,7))-1,Number(iso.slice(8,10))):null;
const mondayOf=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-(x.getDay()+6)%7);return x;};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const fmtDate=iso=>{
  const d=parseISO(iso);
  if(!d) return iso||"";
  const opts={weekday:"short",day:"numeric",month:"short"};
  if(d.getFullYear()!==new Date().getFullYear()) opts.year="numeric";
  return d.toLocaleDateString("fr-FR",opts);
};
const fmtClock=s=>`${Math.floor(s/60)}:${pad2(s%60)}`;
const fmtDuration=min=>min<60?`${min} min`:`${Math.floor(min/60)}h${pad2(min%60)}`;
const firstName=n=>(n||"").trim().split(/\s+/)[0]||"";
const initials=n=>(n||"?").trim().split(/\s+/).map(w=>w[0]).join("").toUpperCase().slice(0,2);
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;

// Accepte aussi les liens YouTube classiques (watch?v=, youtu.be, shorts) et force la lecture intégrée sur iPhone
const toEmbed=url=>{
  if(!url) return "";
  const m=String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m?`https://www.youtube.com/embed/${m[1]}?playsinline=1&rel=0`:url;
};
// Sans lien du coach, le bouton vidéo propose une recherche YouTube : chaque exercice garde sa démo
const videoSearchUrl=name=>`https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} exercice technique`)}`;

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
const parseKg=load=>{
  const s=String(load??"").toLowerCase().trim();
  if(!/kg$/.test(s)&&!/^\d+([.,]\d+)?$/.test(s)) return 0;
  return parseFloat(s.replace(",","."))||0;
};
const logVolume=log=>(log.exercises||[]).reduce((a,ex)=>a+(ex.sets||[]).reduce((b,s)=>{
  const l=parseKg(s.load),r=parseInt(s.reps);
  return b+(l>0&&r>0?l*r:0);
},0),0);
// Durée estimée d'une séance : temps d'effort (~40 s par série) + récupérations
const estMinutes=day=>{
  let s=0;
  (day.exercises||[]).forEach(pe=>{const n=Math.max(1,Number(pe.sets)||1);s+=n*((isTimed(pe.reps)?parseRest(pe.reps):40)+parseRest(pe.rest));});
  return Math.max(5,Math.round(s/300)*5);
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
const countSets=s=>s?s.exercises.reduce((a,ex)=>({done:a.done+ex.sets.filter(x=>x.done).length,total:a.total+ex.sets.length}),{done:0,total:0}):{done:0,total:0};

// ─── CLIENT : UI ──────────────────────────────────────────────────────────────
const C={
  card:"linear-gradient(180deg,#151515 0%,#0f0f0f 100%)",
  line:"#ffffff0f",line2:"#ffffff1a",soft:"#ffffff0a",
  muted:"#8d8d8d",dim:"#5c5c5c",bronze:"#9a7a35",
  goldGrad:`linear-gradient(135deg,${G.goldLight},${G.gold})`,
};
const ellipsis={whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"};
const eyebrow={fontSize:11,fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",color:C.muted};

const ICONS={
  home:"M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  dumbbell:"M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11",
  leaf:"M5 20c0-9 5.5-15 15-15 0 10-6 15-14 15M5 20l7-7",
  chart:"M4 20V11M10 20V5M16 20v-6M2 20h20",
  play:"M7 4.5v15l12-7.5z",
  check:"M5 12.5 10 17.5 19 7",
  x:"M6 6l12 12M18 6 6 18",
  clock:"M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  right:"m9 6 6 6-6 6",down:"m6 9 6 6 6-6",
  logout:"M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4",
  video:"M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM16 10l5-3v10l-5-3",
  history:"M3 12a9 9 0 1 0 3-6.7M3 4v4h4M12 8v4l3 2",
  flame:"M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.5 3 2.5 3-1-3 0-6 0-8z",
  bolt:"M13 2 4 14h7l-1 8 9-12h-7z",
  trophy:"M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3",
  stop:"M7 7h10v10H7z",
  target:"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  calendar:"M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  weight:"M6 8h12l2 12H4zM9 8a3 3 0 0 1 6 0",
};
const Icon=({name,size=20,color="currentColor",sw=1.9,fill="none",style})=>(
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,display:"block",...style}} aria-hidden="true"><path d={ICONS[name]}/></svg>
);

const Ring=({value=0,max=1,size=64,stroke=6,color=G.goldLight,track="#ffffff12",children})=>{
  const r=(size-stroke)/2,c=2*Math.PI*r,p=max?Math.min(1,Math.max(0,value/max)):0;
  return(
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r} stroke={track} strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeOpacity={p>0?1:0}
          strokeDasharray={c} strokeDashoffset={c*(1-p)} style={{transition:"stroke-dashoffset .6s ease, stroke .3s"}}/>
      </svg>
      {children&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>{children}</div>}
    </div>
  );
};

const Card=({children,style,...p})=>(
  <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:22,padding:18,...style}} {...p}>{children}</div>
);
const PrimaryBtn=({children,danger,style,...p})=>(
  <button style={{width:"100%",height:54,borderRadius:16,border:danger?`1px solid ${G.red}55`:"none",background:danger?G.red+"1f":C.goldGrad,color:danger?G.red:G.bg,
    fontSize:16,fontWeight:800,letterSpacing:.2,display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",
    boxShadow:danger?"none":`0 10px 30px ${G.gold}33`,...style}} {...p}>{children}</button>
);
const GhostBtn=({children,style,...p})=>(
  <button style={{width:"100%",height:50,borderRadius:16,border:`1px solid ${C.line2}`,background:C.soft,color:G.white,fontSize:15,fontWeight:700,
    display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",...style}} {...p}>{children}</button>
);
const Chip=({children,gold,style,...p})=>(
  <span style={{display:"inline-flex",alignItems:"center",gap:5,height:28,padding:"0 10px",borderRadius:99,fontSize:12,fontWeight:700,
    background:gold?G.gold+"1f":C.soft,color:gold?G.goldLight:"#bdbdbd",border:`1px solid ${gold?G.gold+"44":C.line}`,whiteSpace:"nowrap",...style}} {...p}>{children}</span>
);
const SectionTitle=({children,action})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"26px 2px 12px"}}>
    <div style={eyebrow}>{children}</div>
    {action}
  </div>
);
const LinkBtn=({children,style,...p})=>(
  <button style={{background:"none",border:"none",color:G.goldLight,fontSize:13,fontWeight:700,cursor:"pointer",padding:"4px 0",display:"flex",alignItems:"center",gap:2,...style}} {...p}>{children}</button>
);
const roundBtn={width:42,height:42,borderRadius:14,border:`1px solid ${C.line2}`,background:C.soft,color:G.white,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0};

// Feuille du bas (remplace les fenêtres de confirmation du navigateur)
function Sheet({open,onClose,children}){
  if(!open) return null;
  return(
    <div onClick={onClose} style={{position:"absolute",inset:0,zIndex:400,background:"#000000b8",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center",animation:"fadeIn .2s ease"}}>
      <div onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
        style={{width:"100%",maxWidth:520,background:"#121212",borderTop:`1px solid ${C.line2}`,borderRadius:"28px 28px 0 0",padding:"10px 22px calc(24px + env(safe-area-inset-bottom))",animation:"sheetUp .32s cubic-bezier(.2,.9,.3,1)",maxHeight:"88%",overflowY:"auto"}}>
        <div style={{width:40,height:4,borderRadius:2,background:"#ffffff26",margin:"0 auto 20px"}}/>
        {children}
      </div>
    </div>
  );
}
function useConfirm(){
  const [state,setState]=useState(null);
  const ask=useCallback(opts=>new Promise(resolve=>setState({...opts,resolve})),[]);
  const close=v=>{state?.resolve(v);setState(null);};
  const node=(
    <Sheet open={!!state} onClose={()=>close(false)}>
      {state&&<>
        <div style={{fontFamily:G.fontD,fontSize:26,fontWeight:800,letterSpacing:-.5,marginBottom:8}}>{state.title}</div>
        {state.text&&<div style={{fontSize:14,color:C.muted,lineHeight:1.55,marginBottom:24}}>{state.text}</div>}
        <PrimaryBtn danger={state.danger} onClick={()=>close(true)}>{state.confirm||"Confirmer"}</PrimaryBtn>
        <GhostBtn style={{marginTop:10}} onClick={()=>close(false)}>{state.cancel||"Annuler"}</GhostBtn>
      </>}
    </Sheet>
  );
  return [ask,node];
}

// Vidéo d'un exercice : feuille du bas ouverte depuis n'importe quel écran du portail client
const VideoCtx=createContext(()=>{});
function VideoSheet({ex,onClose}){
  return(
    <Sheet open={!!ex} onClose={onClose}>
      {ex&&<>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <div style={{flex:1,minWidth:0,fontFamily:G.fontD,fontSize:24,fontWeight:800,letterSpacing:-.4,lineHeight:1.1}}>{ex.name}</div>
          <button aria-label="Fermer" onClick={onClose} style={roundBtn}><Icon name="x" size={18}/></button>
        </div>
        {ex.videoUrl?(
          <div style={{position:"relative",paddingBottom:"56.25%",borderRadius:16,overflow:"hidden",background:"#000",marginBottom:14}}>
            <iframe title={`Vidéo — ${ex.name}`} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}} src={toEmbed(ex.videoUrl)} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen/>
          </div>
        ):(
          <div style={{fontSize:14,color:C.muted,lineHeight:1.5,marginBottom:16}}>Ton coach n'a pas encore ajouté de vidéo pour cet exercice. Tu peux regarder une démonstration sur YouTube.</div>
        )}
        {ex.notes&&<div style={{fontSize:13,color:"#ccc",lineHeight:1.5,marginBottom:16}}>💡 {ex.notes}</div>}
        {!ex.videoUrl&&(
          <a href={videoSearchUrl(ex.name)} target="_blank" rel="noopener noreferrer"
            style={{width:"100%",height:54,borderRadius:16,background:C.goldGrad,color:G.bg,fontSize:16,fontWeight:800,textDecoration:"none",
              display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:`0 10px 30px ${G.gold}33`}}>
            <Icon name="play" size={16} fill="currentColor" sw={0}/>Voir une démo sur YouTube
          </a>
        )}
      </>}
    </Sheet>
  );
}
const VideoBtn=({ex,size=38})=>{
  const open=useContext(VideoCtx);
  return(
    <button aria-label={`Vidéo — ${ex.name}`} onClick={e=>{e.stopPropagation();open(ex);}}
      style={{...roundBtn,width:size,height:size,borderRadius:12,color:ex.videoUrl?G.goldLight:"#aaa",borderColor:ex.videoUrl?G.gold+"55":C.line2,background:ex.videoUrl?G.gold+"14":C.soft}}>
      <Icon name="video" size={16}/>
    </button>
  );
};

// ─── CLIENT PORTAL ────────────────────────────────────────────────────────────
function ClientPortal({client:live,clientId,updateClient,programs,exercises,onLogout,foods=FOODS_DB}){
  const logs=live.sessionLogs||[];
  const SESSION_KEY=`wandy_session_${clientId}`;

  // Séance en cours : sauvegardée sur le téléphone pour survivre à un rafraîchissement,
  // à la fermeture de l'onglet ou à un passage sur un autre onglet de l'app.
  // activeSession: { progId, weekIdx, dayIdx, dayLabel, weekLabel, startedAt, notes, exercises:[{exId,name,unit,sets:[{reps,load,done,actualReps}]}] }
  const [session,setSession]=useState(()=>{try{const s=JSON.parse(store.get(SESSION_KEY)||"null");return s?.exercises?s:null;}catch{return null;}});
  const [tab,setTab]=useState("home"); // home | train | food | progress
  const [workoutOpen,setWorkoutOpen]=useState(()=>!!session);
  const [doneInfo,setDoneInfo]=useState(null);
  const [profileOpen,setProfileOpen]=useState(false);
  const [trainSel,setTrainSel]=useState({progId:null,wi:null});
  useEffect(()=>{if(session)store.set(SESSION_KEY,JSON.stringify(session));else store.del(SESSION_KEY);},[session,SESSION_KEY]);

  // Chrono de récupération global : reste visible même en changeant d'écran
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

  const [confirm,confirmNode]=useConfirm();
  const [videoEx,setVideoEx]=useState(null);
  const assigned=programs.filter(p=>(live.programs||[]).some(id=>String(id)===String(p.id)));
  const next=assigned.map(p=>nextSessionOf(p,logs)).find(Boolean);

  const startSession=async(prog,weekIdx,day,dayIdx)=>{
    // Même séance déjà en cours → on la reprend
    if(isSameSession(session,prog.id,weekIdx,dayIdx)){setWorkoutOpen(true);return;}
    if(session&&!(await confirm({title:"Une séance est en cours",text:`« ${session.dayLabel} » n'est pas terminée. L'abandonner pour commencer « ${day.label} » ?`,confirm:"Commencer la nouvelle",cancel:"Garder l'actuelle",danger:true}))) return;
    rest.stop();
    const exEntries=(day.exercises||[]).map(pe=>{
      const ex=exercises.find(e=>e.id===pe.exId);
      const target=slotTarget(pe,live.tests);
      return{exId:pe.exId,name:ex?.name||"",videoUrl:ex?.videoUrl||"",notes:ex?.notes||"",coachNote:pe.note||"",target:target.text,muscle:ex?.muscle||"",rest:String(pe.rest||""),unit:target.unit||"kg",sensation:"",
        sets:Array.from({length:Math.max(1,Number(pe.sets)||1)},()=>({reps:String(pe.reps??""),load:target.load,done:false,actualReps:""}))};
    });
    setSession({progId:prog.id,weekIdx,dayIdx,dayLabel:day.label,weekLabel:prog.weeks[weekIdx]?.label||"",exercises:exEntries,notes:"",startedAt:Date.now()});
    setWorkoutOpen(true);
  };

  const updateSet=useCallback((exIdx,setIdx,patch)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,sets:ex.sets.map((st,si)=>si!==setIdx?st:{...st,...patch})})}));
  },[]);
  const updateEx=useCallback((exIdx,patch)=>{
    setSession(s=>({...s,exercises:s.exercises.map((ex,ei)=>ei!==exIdx?ex:{...ex,...patch})}));
  },[]);

  const finishSession=async()=>{
    const all=session.exercises.flatMap(ex=>ex.sets);
    const pending=all.filter(s=>!s.done).length;
    if(pending>0&&!(await confirm({title:"Terminer la séance ?",text:`${pending} série${pending>1?"s":""} non validée${pending>1?"s":""}. Elles seront enregistrées telles quelles.`,confirm:"Terminer quand même",cancel:"Continuer la séance"}))) return;
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
    setDoneInfo({duration,setsDone:all.length-pending,totalSets:all.length,volume:Math.round(volume),label:session.dayLabel});
    rest.stop();
    setSession(null);
    setWorkoutOpen(false);
  };
  const abandonSession=async()=>{
    if(!(await confirm({title:"Abandonner la séance ?",text:"Les séries saisies ne seront pas enregistrées.",confirm:"Abandonner",cancel:"Continuer",danger:true}))) return;
    rest.stop();
    setSession(null);
    setWorkoutOpen(false);
  };
  const logout=async()=>{
    setProfileOpen(false);
    if(await confirm({title:"Se déconnecter ?",text:"Tu pourras te reconnecter à tout moment avec ton code d'accès.",confirm:"Se déconnecter",danger:true})) onLogout();
  };
  const openTrain=(progId,wi)=>{setTrainSel({progId,wi});setTab("train");};

  let screen;
  if(doneInfo){
    screen=<DoneView info={doneInfo} name={firstName(live.name)} onHome={()=>{setDoneInfo(null);setTab("home");}} onProgress={()=>{setDoneInfo(null);setTab("progress");}}/>;
  }else if(workoutOpen&&session){
    screen=<WorkoutView session={session} setSession={setSession} updateSet={updateSet} updateEx={updateEx} logs={logs}
      rest={rest} restOwner={restOwner} startRest={startRest}
      onMinimize={()=>setWorkoutOpen(false)} onFinish={finishSession} onAbandon={abandonSession}/>;
  }else{
    const common={live,logs,assigned,session,exercises,programs,onStart:startSession,onResume:()=>setWorkoutOpen(true)};
    screen=(<>
      <div key={tab} style={{position:"absolute",inset:0,overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch"}}>
        <div className="fu" style={{maxWidth:640,margin:"0 auto",padding:`22px 18px ${session?190:130}px`}}>
          {tab==="home"&&<HomeTab {...common} next={next} onOpenTrain={openTrain} onProfile={()=>setProfileOpen(true)} setTab={setTab}/>}
          {tab==="train"&&<TrainTab {...common} sel={trainSel} setSel={setTrainSel}/>}
          {tab==="food"&&<NutritionTab live={live} foods={foods}/>}
          {tab==="progress"&&<ProgressTab logs={logs} programs={programs}/>}
        </div>
      </div>
      <BottomDock tab={tab} setTab={setTab} session={session} rest={rest} onResume={()=>setWorkoutOpen(true)}/>
    </>);
  }

  return(
    <div style={{position:"relative",flex:1,minHeight:0,overflow:"hidden"}}>
      <VideoCtx.Provider value={setVideoEx}>{screen}</VideoCtx.Provider>
      <VideoSheet ex={videoEx} onClose={()=>setVideoEx(null)}/>
      <Sheet open={profileOpen} onClose={()=>setProfileOpen(false)}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:22}}>
          <div style={{width:64,height:64,borderRadius:22,background:C.goldGrad,color:G.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:26}}>{initials(live.name)}</div>
          <div style={{minWidth:0}}>
            <div style={{fontFamily:G.fontD,fontSize:26,fontWeight:800,letterSpacing:-.5,...ellipsis}}>{live.name}</div>
            {live.goal&&<div style={{fontSize:13,color:C.muted,marginTop:2}}>Objectif : {live.goal}</div>}
            {live.since&&<div style={{fontSize:12,color:C.dim,marginTop:2}}>Suivi depuis {live.since}</div>}
          </div>
        </div>
        <GhostBtn onClick={logout} style={{color:G.red}}><Icon name="logout" size={18}/>Se déconnecter</GhostBtn>
      </Sheet>
      {confirmNode}
    </div>
  );
}

// ─── ACCUEIL ──────────────────────────────────────────────────────────────────
function HomeTab({live,logs,assigned,session,next,onStart,onResume,onOpenTrain,onProfile,setTab,programs}){
  const now=new Date();
  const hour=now.getHours();
  const hello=hour<5||hour>=18?"Bonsoir":"Bonjour";
  const completed=logs.filter(l=>l.completed);
  const doneDates=new Set(completed.map(l=>l.date));
  const mon=mondayOf(now);
  const week=[...Array(7)].map((_,i)=>addDays(mon,i));
  const today=isoOf(now);
  const thisWeek=week.filter(d=>doneDates.has(isoOf(d))).length;
  // Série de semaines consécutives avec au moins une séance
  const weeksWith=new Set(completed.map(l=>{const d=parseISO(l.date);return d?isoOf(mondayOf(d)):null;}).filter(Boolean));
  let w=mon,streak=0;
  if(!weeksWith.has(isoOf(w))) w=addDays(w,-7);
  while(weeksWith.has(isoOf(w))){streak++;w=addDays(w,-7);}
  const prog=next?.prog||assigned[0];
  const pp=prog?progProgress(prog,logs):null;
  const sp=countSets(session);
  const lastLog=logs[0];
  const lastProg=lastLog&&programs.find(p=>String(p.id)===String(lastLog.programId));

  return(<>
    {/* En-tête */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:22}}>
      <div style={{minWidth:0}}>
        <div style={{...eyebrow,color:G.gold}}>{cap(now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}))}</div>
        <div style={{fontFamily:G.fontD,fontSize:34,fontWeight:800,letterSpacing:-1,lineHeight:1.05,marginTop:4,...ellipsis}}>
          {hello}, <span style={{background:C.goldGrad,WebkitBackgroundClip:"text",backgroundClip:"text",color:"transparent"}}>{firstName(live.name)}</span>
        </div>
      </div>
      <button onClick={onProfile} aria-label="Mon profil" style={{width:48,height:48,borderRadius:16,border:`1px solid ${G.gold}55`,background:`radial-gradient(circle at 30% 20%,${G.gold}40,#141414 70%)`,color:G.goldLight,fontFamily:G.fontD,fontWeight:800,fontSize:18,cursor:"pointer",flexShrink:0}}>
        {initials(live.name)}
      </button>
    </div>

    {/* Semaine en cours */}
    <Card style={{padding:"16px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,padding:"0 4px"}}>
        <div style={{fontSize:14,fontWeight:700}}>Cette semaine</div>
        <div style={{display:"flex",gap:10,alignItems:"center",fontSize:12,color:C.muted}}>
          <span><b style={{color:G.white}}>{thisWeek}</b> séance{thisWeek>1?"s":""}</span>
          {streak>1&&<span style={{display:"flex",alignItems:"center",gap:3,color:G.goldLight,fontWeight:700}}><Icon name="flame" size={14}/>{streak} sem.</span>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
        {week.map(d=>{
          const iso=isoOf(d),done=doneDates.has(iso),isToday=iso===today;
          return(
            <div key={iso} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
              <div style={{fontSize:11,fontWeight:700,color:isToday?G.goldLight:C.dim}}>{"LMMJVSD"[(d.getDay()+6)%7]}</div>
              <div style={{width:36,height:36,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,
                background:done?C.goldGrad:isToday?G.gold+"14":C.soft,color:done?G.bg:isToday?G.goldLight:"#777",
                border:isToday&&!done?`1.5px solid ${G.gold}aa`:`1px solid ${done?"transparent":C.line}`,boxShadow:done?`0 4px 14px ${G.gold}40`:"none"}}>
                {done?<Icon name="check" size={16} sw={2.6}/>:d.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </Card>

    {/* Séance en cours / prochaine séance */}
    <div style={{marginTop:14}}>
      {session?(
        <HeroCard label="Séance en cours" title={session.dayLabel} sub={session.weekLabel}
          aside={<Ring value={sp.done} max={sp.total} size={58} stroke={5}><span style={{fontFamily:G.fontD,fontWeight:800,fontSize:15}}>{sp.total?Math.round(sp.done/sp.total*100):0}%</span></Ring>}
          meta={[`${sp.done}/${sp.total} séries`]}
          cta={<PrimaryBtn onClick={onResume}><Icon name="play" size={16} fill="currentColor" sw={0}/>Reprendre la séance</PrimaryBtn>}/>
      ):next?(
        <HeroCard label="Prochaine séance" title={next.day.label} sub={`${next.prog.name} · ${next.week.label}`}
          meta={[`${(next.day.exercises||[]).length} exercices`,`≈ ${estMinutes(next.day)} min`]}
          preview={(next.day.exercises||[]).map(pe=>pe.exId)}
          cta={<PrimaryBtn onClick={()=>onStart(next.prog,next.wi,next.day,next.di)}><Icon name="play" size={16} fill="currentColor" sw={0}/>Démarrer la séance</PrimaryBtn>}
          footer={<LinkBtn onClick={()=>onOpenTrain(next.prog.id,next.wi)} style={{margin:"12px auto 0"}}>Voir toute la semaine <Icon name="right" size={14}/></LinkBtn>}/>
      ):assigned.length>0?(
        <Card style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{width:56,height:56,borderRadius:18,background:C.goldGrad,color:G.bg,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Icon name="trophy" size={28}/></div>
          <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800}}>Programme terminé !</div>
          <div style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>Bravo. Ton coach va te préparer la suite.</div>
        </Card>
      ):(
        <Card style={{textAlign:"center",padding:"28px 20px"}}>
          <div style={{width:56,height:56,borderRadius:18,background:C.soft,color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}><Icon name="dumbbell" size={26}/></div>
          <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800}}>Ton programme arrive</div>
          <div style={{fontSize:13,color:C.muted,marginTop:6,lineHeight:1.5}}>Ton coach prépare ton entraînement. Il apparaîtra ici.</div>
        </Card>
      )}
    </div>

    {/* Programme */}
    {prog&&pp&&pp.total>0&&(<>
      <SectionTitle>Mon programme</SectionTitle>
      <button onClick={()=>onOpenTrain(prog.id,next&&String(next.prog.id)===String(prog.id)?next.wi:null)} style={{width:"100%",textAlign:"left",color:G.white,cursor:"pointer",background:C.card,border:`1px solid ${C.line}`,borderRadius:22,padding:16,display:"flex",alignItems:"center",gap:14}}>
        <Ring value={pp.done} max={pp.total} size={62} stroke={6}><span style={{fontFamily:G.fontD,fontWeight:800,fontSize:16}}>{Math.round(pp.done/pp.total*100)}%</span></Ring>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:16,...ellipsis}}>{prog.name}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:4}}>{next&&String(next.prog.id)===String(prog.id)?`Semaine ${next.wi+1} sur ${prog.weeks.length} · `:""}{pp.done}/{pp.total} séances</div>
        </div>
        <Icon name="right" size={18} color={C.muted}/>
      </button>
    </>)}

    {/* Dernière séance */}
    {lastLog&&(<>
      <SectionTitle action={<LinkBtn onClick={()=>setTab("progress")}>Tout voir <Icon name="right" size={14}/></LinkBtn>}>Dernière séance</SectionTitle>
      <Card style={{padding:14,display:"flex",alignItems:"center",gap:14}}>
        <DateBadge iso={lastLog.date}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,...ellipsis}}>{lastLog.dayLabel||lastProg?.name||"Séance"}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:3,...ellipsis}}>
            {[lastProg?.name,lastLog.duration&&fmtDuration(lastLog.duration),`${(lastLog.exercises||[]).length} exercices`].filter(Boolean).join(" · ")}
          </div>
        </div>
        {lastLog.completed&&<div style={{width:30,height:30,borderRadius:10,background:G.green+"1f",color:G.green,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="check" size={16} sw={2.4}/></div>}
      </Card>
    </>)}
  </>);
}

function HeroCard({label,title,sub,meta=[],aside,cta,footer}){
  return(
    <div style={{position:"relative",overflow:"hidden",borderRadius:26,padding:20,border:`1px solid ${G.gold}40`,
      background:`radial-gradient(120% 90% at 100% 0%,${G.gold}38 0%,transparent 55%),radial-gradient(80% 60% at 0% 100%,${G.gold}14 0%,transparent 60%),linear-gradient(180deg,#171717,#0d0d0d)`,
      boxShadow:`0 20px 50px #000a, inset 0 1px 0 #ffffff10`}}>
      <div style={{position:"absolute",right:-30,top:-30,opacity:.07,color:G.goldLight}}><Icon name="bolt" size={170} fill="currentColor" sw={0}/></div>
      <div style={{position:"relative",display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
        <div style={{minWidth:0}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,...eyebrow,color:G.goldLight,fontSize:10}}>
            <span style={{width:6,height:6,borderRadius:3,background:G.goldLight,animation:"pulseDot 1.8s ease infinite"}}/>{label}
          </span>
          <div style={{fontFamily:G.fontD,fontSize:32,fontWeight:800,letterSpacing:-.8,lineHeight:1.05,marginTop:8}}>{title}</div>
          {sub&&<div style={{fontSize:13,color:C.muted,marginTop:5,lineHeight:1.4}}>{sub}</div>}
        </div>
        {aside}
      </div>
      {meta.length>0&&(
        <div style={{position:"relative",display:"flex",gap:6,flexWrap:"wrap",margin:"14px 0 18px"}}>
          {meta.map((m,i)=><Chip key={i}>{i===0?<Icon name="dumbbell" size={13}/>:<Icon name="clock" size={13}/>}{m}</Chip>)}
        </div>
      )}
      <div style={{position:"relative"}}>{cta}{footer}</div>
    </div>
  );
}

const DateBadge=({iso})=>{
  const d=parseISO(iso);
  return(
    <div style={{width:48,height:52,borderRadius:14,background:C.soft,border:`1px solid ${C.line}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <div style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,lineHeight:1,color:G.goldLight}}>{d?d.getDate():"–"}</div>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",marginTop:3}}>{d?d.toLocaleDateString("fr-FR",{month:"short"}).replace(".",""):""}</div>
    </div>
  );
};

// ─── ENTRAÎNEMENT ─────────────────────────────────────────────────────────────
function TrainTab({live,logs,assigned,session,exercises,sel,setSel,onStart,onResume}){
  const prog=assigned.find(p=>String(p.id)===String(sel.progId))||assigned[0];
  const weekBar=useRef(null);
  const n=prog?nextSessionOf(prog,logs):null;
  const wi=prog&&sel.wi!=null&&prog.weeks?.[sel.wi]?sel.wi:(n?n.wi:0);
  const [openDay,setOpenDay]=useState(()=>n&&n.wi===wi?n.di:null);
  useEffect(()=>{weekBar.current?.querySelector("[data-active=true]")?.scrollIntoView({inline:"center",block:"nearest"});},[wi,prog?.id]);

  if(!prog) return(<>
    <PageTitle>Entraînement</PageTitle>
    <Card style={{textAlign:"center",color:C.muted,fontSize:14,padding:28}}>Aucun programme assigné pour l'instant.</Card>
  </>);

  const pp=progProgress(prog,logs);
  const week=prog.weeks[wi];
  const pick=(progId,w)=>{setSel({progId,wi:w});setOpenDay(null);};

  return(<>
    <PageTitle>Entraînement</PageTitle>

    {assigned.length>1&&(
      <div className="noscroll" style={{display:"flex",gap:8,overflowX:"auto",margin:"0 -18px 14px",padding:"0 18px"}}>
        {assigned.map(p=>{
          const a=String(p.id)===String(prog.id);
          return <button key={p.id} onClick={()=>pick(p.id,null)} style={{flexShrink:0,height:38,padding:"0 16px",borderRadius:99,border:`1px solid ${a?G.gold+"88":C.line2}`,background:a?G.gold+"1f":C.soft,color:a?G.goldLight:"#bbb",fontWeight:700,fontSize:13,cursor:"pointer"}}>{p.name}</button>;
        })}
      </div>
    )}

    <Card style={{display:"flex",alignItems:"center",gap:16}}>
      <Ring value={pp.done} max={pp.total} size={72} stroke={7}>
        <span style={{fontFamily:G.fontD,fontWeight:800,fontSize:18,lineHeight:1}}>{pp.done}</span>
        <span style={{fontSize:10,color:C.muted}}>/ {pp.total}</span>
      </Ring>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,letterSpacing:-.4,lineHeight:1.1}}>{prog.name}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
          {prog.level&&<Chip gold>{prog.level}</Chip>}
          <Chip>{prog.weeks.length} sem.</Chip>
          <Chip>{prog.weeks[0]?.days?.length||0} j/sem</Chip>
        </div>
      </div>
    </Card>

    {/* Sélecteur de semaine */}
    <div ref={weekBar} className="noscroll" style={{display:"flex",gap:8,overflowX:"auto",margin:"18px -18px 0",padding:"2px 18px 4px"}}>
      {prog.weeks.map((w,i)=>{
        const days=w.days||[];
        const done=days.filter((_,di)=>findDoneLog(logs,prog.id,i,di)).length;
        const complete=days.length>0&&done===days.length;
        const a=i===wi;
        return(
          <button key={i} data-active={a} onClick={()=>pick(prog.id,i)} style={{flexShrink:0,minWidth:62,height:62,borderRadius:18,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,
            background:a?C.goldGrad:C.soft,color:a?G.bg:G.white,border:`1px solid ${a?"transparent":n?.wi===i?G.gold+"77":C.line}`,boxShadow:a?`0 8px 24px ${G.gold}40`:"none"}}>
            <span style={{fontSize:10,fontWeight:700,opacity:.7,letterSpacing:1}}>SEM.</span>
            <span style={{fontFamily:G.fontD,fontSize:20,fontWeight:800,lineHeight:1}}>{complete?<Icon name="check" size={18} sw={2.6}/>:i+1}</span>
          </button>
        );
      })}
    </div>
    {week&&<div style={{fontSize:13,color:C.muted,margin:"12px 2px 14px"}}>{week.label}</div>}

    {(week?.days||[]).map((d,di)=>{
      const doneLog=findDoneLog(logs,prog.id,wi,di);
      const inProgress=isSameSession(session,prog.id,wi,di);
      const isNext=n&&n.wi===wi&&n.di===di;
      const open=openDay===di;
      return(
        <div key={di} style={{background:C.card,borderRadius:22,marginBottom:10,border:`1px solid ${inProgress||isNext?G.gold+"66":C.line}`,overflow:"hidden"}}>
          <button onClick={()=>setOpenDay(open?null:di)} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:16,background:"none",border:"none",color:G.white,textAlign:"left",cursor:"pointer"}}>
            <div style={{width:42,height:42,borderRadius:14,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:G.fontD,fontWeight:800,fontSize:17,
              background:doneLog?G.green+"1f":inProgress||isNext?G.gold+"1f":C.soft,color:doneLog?G.green:inProgress||isNext?G.goldLight:"#999"}}>
              {doneLog?<Icon name="check" size={20} sw={2.4}/>:String.fromCharCode(65+di)}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:16,...ellipsis}}>{d.label}</div>
              <div style={{fontSize:12,marginTop:3,color:doneLog?G.green:inProgress?G.goldLight:C.muted}}>
                {inProgress?"● En cours":doneLog?`Faite · ${fmtDate(doneLog.date)}`:`${(d.exercises||[]).length} exercices · ≈ ${estMinutes(d)} min`}
              </div>
            </div>
            <Icon name="down" size={18} color={C.muted} style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}/>
          </button>
          {open&&(
            <div style={{padding:"0 16px 16px",animation:"fadeIn .2s ease"}}>
              {(d.exercises||[]).map((pe,i)=>{
                const ex=exercises.find(e=>e.id===pe.exId);
                const t=slotTarget(pe,live.tests).text;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderTop:`1px solid ${C.line}`}}>
                    <div style={{width:24,fontFamily:G.fontD,fontWeight:800,color:C.dim,fontSize:14}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600}}>{ex?.name||"Exercice"}</div>
                      {t&&<div style={{fontSize:12,color:G.gold,marginTop:2}}>{t}</div>}
                    </div>
                    <div style={{fontSize:13,color:"#bbb",fontWeight:700,flexShrink:0}}>{pe.sets} × {pe.reps}</div>
                    {ex&&<VideoBtn ex={ex} size={34}/>}
                  </div>
                );
              })}
              <div style={{marginTop:12}}>
                {inProgress
                  ?<PrimaryBtn onClick={onResume}><Icon name="play" size={16} fill="currentColor" sw={0}/>Reprendre</PrimaryBtn>
                  :doneLog
                    ?<GhostBtn onClick={()=>onStart(prog,wi,d,di)}>Refaire cette séance</GhostBtn>
                    :<PrimaryBtn onClick={()=>onStart(prog,wi,d,di)}><Icon name="play" size={16} fill="currentColor" sw={0}/>Démarrer</PrimaryBtn>}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </>);
}

const PageTitle=({children,sub})=>(
  <div style={{marginBottom:20}}>
    <div style={{fontFamily:G.fontD,fontSize:34,fontWeight:800,letterSpacing:-1,lineHeight:1}}>{children}</div>
    {sub&&<div style={{fontSize:13,color:C.muted,marginTop:6}}>{sub}</div>}
  </div>
);

// ─── MODE SÉANCE (plein écran) ────────────────────────────────────────────────
function WorkoutView({session,setSession,updateSet,updateEx,logs,rest,restOwner,startRest,onMinimize,onFinish,onAbandon}){
  const {done,total}=countSets(session);
  const goNext=ei=>{
    const el=document.getElementById(`ex-${ei+1}`);
    if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
  };
  return(
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",background:G.bg,animation:"fadeIn .2s ease"}}>
      <header style={{flexShrink:0,padding:"10px 14px 0",background:"linear-gradient(180deg,#101010,#0a0a0a)",borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:640,margin:"0 auto"}}>
          <button aria-label="Réduire la séance" onClick={onMinimize} style={roundBtn}><Icon name="down" size={20}/></button>
          <div style={{flex:1,minWidth:0,textAlign:"center"}}>
            <div style={{fontFamily:G.fontD,fontSize:19,fontWeight:800,letterSpacing:-.3,...ellipsis}}>{session.dayLabel}</div>
            <div style={{fontSize:12,color:C.muted,display:"flex",gap:6,justifyContent:"center",alignItems:"center",marginTop:1}}>
              <Icon name="clock" size={12}/><Elapsed since={session.startedAt}/><span>·</span><span style={{color:done===total?G.green:G.goldLight,fontWeight:700}}>{done}/{total} séries</span>
            </div>
          </div>
          <button onClick={onFinish} style={{height:42,padding:"0 14px",borderRadius:14,border:"none",background:done===total?C.goldGrad:G.gold+"22",color:done===total?G.bg:G.goldLight,fontWeight:800,fontSize:13,cursor:"pointer",flexShrink:0}}>Terminer</button>
        </div>
        <div style={{height:3,background:"#ffffff0d",margin:"10px -14px 0"}}>
          <div style={{height:"100%",width:`${total?done/total*100:0}%`,background:done===total?G.green:C.goldGrad,transition:"width .4s ease"}}/>
        </div>
      </header>

      <div style={{flex:1,minHeight:0,overflowY:"auto",overscrollBehavior:"contain",WebkitOverflowScrolling:"touch"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:`14px 12px ${rest.running?150:40}px`}}>
          {session.exercises.map((ex,ei)=>(
            <ExerciseBlock key={ei} ex={ex} ei={ei} logs={logs} onSetChange={updateSet} onExChange={updateEx}
              restActive={rest.running&&restOwner?.ei===ei} onStartRest={startRest} onDone={goNext}/>
          ))}
          <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:22,padding:16,marginTop:4}}>
            <div style={{...eyebrow,marginBottom:10}}>Notes de séance</div>
            <textarea value={session.notes} onChange={e=>{const v=e.target.value;setSession(s=>({...s,notes:v}));}} placeholder="Ressenti, observations pour ton coach…" rows={3}
              style={{width:"100%",background:C.soft,border:`1px solid ${C.line}`,borderRadius:14,padding:"12px 14px",color:G.white,fontSize:15,outline:"none",resize:"vertical",lineHeight:1.5}}/>
          </div>
          <PrimaryBtn onClick={onFinish} style={{marginTop:16}}><Icon name="check" size={18} sw={2.6}/>Terminer la séance</PrimaryBtn>
          <button onClick={onAbandon} style={{display:"block",margin:"14px auto 0",background:"none",border:"none",color:C.dim,fontSize:13,cursor:"pointer",padding:8}}>Abandonner la séance</button>
        </div>
      </div>

      {rest.running&&<RestPill timeLeft={rest.timeLeft} total={rest.total} label={restOwner?.name} onAdd={rest.add} onSkip={rest.stop}/>}
    </div>
  );
}

function Elapsed({since}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t);},[]);
  const s=since?Math.max(0,Math.floor((now-since)/1000)):0;
  const h=Math.floor(s/3600);
  return <span style={{fontVariantNumeric:"tabular-nums"}}>{h?`${h}:${pad2(Math.floor(s/60)%60)}:${pad2(s%60)}`:fmtClock(s)}</span>;
}

const cellInput={width:"100%",height:42,background:C.soft,border:`1px solid ${C.line}`,borderRadius:12,color:G.white,fontSize:16,fontWeight:700,textAlign:"center",outline:"none",padding:0,fontVariantNumeric:"tabular-nums"};
const stripKg=v=>String(v??"").replace(/\s*kg$/i,"");

function ExerciseBlock({ex,ei,logs,onSetChange,onExChange,restActive,onStartRest,onDone}){
  const allDone=ex.sets.every(s=>s.done);
  const [open,setOpen]=useState(!allDone);
  const openVideo=useContext(VideoCtx);
  const [hist,setHist]=useState(false);
  const unit=ex.unit||"kg";
  const restSecs=parseRest(ex.rest);
  const doneCount=ex.sets.filter(s=>s.done).length;

  const history=[];
  for(const log of logs){
    if(history.length>=4) break;
    const found=(log.exercises||[]).find(e=>e.exId===ex.exId);
    if(found) history.push({date:log.date,dayLabel:log.dayLabel,sets:found.sets||[]});
  }
  const last=history[0];

  // Valide une série : vibration, récupération, et si c'était la dernière, on replie et on passe à l'exercice suivant
  const complete=si=>{
    const willAllDone=ex.sets.every((s,i)=>i===si||s.done);
    // Charge vide : on reprend celle de la série précédente (on ne la tape qu'une fois)
    const carried=!String(ex.sets[si].load||"").trim()&&si>0?ex.sets[si-1].load:"";
    onSetChange(ei,si,carried?{done:true,load:carried}:{done:true});
    try{navigator.vibrate?.(12);}catch{/* non supporté */}
    if(restSecs>0) onStartRest(ei,restSecs,ex.name);
    if(willAllDone) setTimeout(()=>{setOpen(false);onDone(ei);},380);
  };

  // Chrono de travail (exercices en temps) : à la fin, la série est validée automatiquement
  const [activeWork,setActiveWork]=useState(null);
  const activeWorkRef=useRef(null);
  useEffect(()=>{activeWorkRef.current=activeWork;},[activeWork]);
  const work=useCountdown(()=>{
    const a=activeWorkRef.current;
    if(a===null) return;
    setActiveWork(null);
    complete(a);
  });

  return(
    <div id={`ex-${ei}`} style={{scrollMarginTop:12,background:C.card,border:`1px solid ${allDone?G.green+"44":C.line}`,borderRadius:22,marginBottom:12,overflow:"hidden",transition:"border .3s"}}>
      <div style={{display:"flex",alignItems:"center"}}>
      <button onClick={()=>setOpen(!open)} aria-expanded={open} style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:12,padding:14,background:"none",border:"none",color:G.white,textAlign:"left",cursor:"pointer"}}>
        <div style={{width:40,height:40,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:G.fontD,fontWeight:800,fontSize:17,
          background:allDone?G.green+"22":G.gold+"18",color:allDone?G.green:G.goldLight}}>
          {allDone?<Icon name="check" size={20} sw={2.6}/>:ei+1}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:16,lineHeight:1.25}}>{ex.name}</div>
          <div style={{fontSize:12,color:allDone?G.green:C.muted,marginTop:3}}>{doneCount}/{ex.sets.length} séries{ex.muscle?` · ${ex.muscle}`:""}</div>
        </div>
        <Icon name="down" size={18} color={C.muted} style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}/>
      </button>
      <div style={{paddingRight:12}}><VideoBtn ex={ex}/></div>
      </div>

      {open&&(
        <div style={{padding:"0 12px 14px",animation:"fadeIn .2s ease"}}>
          {/* Infos et raccourcis */}
          <div style={{display:"flex",flexWrap:"wrap",gap:6,margin:"0 2px 12px"}}>
            {ex.target&&<Chip gold><Icon name="target" size={13}/>{ex.target}</Chip>}
            {restSecs>0&&<button aria-label="Lancer la récupération" onClick={()=>onStartRest(ei,restSecs,ex.name)} style={{all:"unset",cursor:"pointer"}}><Chip gold={restActive}><Icon name="clock" size={13}/>Récup {fmtClock(restSecs)}</Chip></button>}
            <label style={{position:"relative",display:"inline-flex"}}>
              <Chip style={{paddingRight:26}}><Icon name="weight" size={13}/>{unit}</Chip>
              <Icon name="down" size={12} color="#999" style={{position:"absolute",right:9,top:8,pointerEvents:"none"}}/>
              <select aria-label="Unité de charge" value={unit} onChange={e=>onExChange(ei,{unit:e.target.value})} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%"}}>
                {LOAD_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <button onClick={()=>openVideo(ex)} style={{all:"unset",cursor:"pointer"}}><Chip gold={!!ex.videoUrl}><Icon name="video" size={13}/>Vidéo</Chip></button>
            {history.length>0&&<button onClick={()=>setHist(!hist)} style={{all:"unset",cursor:"pointer"}}><Chip gold={hist}><Icon name="history" size={13}/>Historique</Chip></button>}
          </div>

          {ex.coachNote&&<div style={{fontSize:13,color:"#ddd",lineHeight:1.45,margin:"0 2px 10px",padding:"10px 12px",background:G.gold+"0f",borderRadius:12,borderLeft:`3px solid ${G.gold}`}}>{ex.coachNote}</div>}
          {ex.notes&&<div style={{fontSize:12,color:C.muted,lineHeight:1.45,margin:"0 2px 12px"}}>💡 {ex.notes}</div>}


          {hist&&(
            <div style={{background:"#0b0b0b",borderRadius:14,padding:12,marginBottom:12,border:`1px solid ${C.line}`}}>
              {history.map((h,hi)=>(
                <div key={hi} style={{marginBottom:hi<history.length-1?12:0}}>
                  <div style={{fontSize:12,color:G.gold,fontWeight:700,marginBottom:6}}>{fmtDate(h.date)}{h.dayLabel?` · ${h.dayLabel}`:""}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {h.sets.map((s,si)=><Chip key={si}>{stripKg(s.load)||"—"} × {s.reps}</Chip>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tableau des séries */}
          <div style={{display:"grid",gridTemplateColumns:"28px minmax(0,1fr) 70px 58px 44px",gap:6,padding:"0 4px 6px",fontSize:10,fontWeight:700,letterSpacing:1,color:C.dim,textTransform:"uppercase"}}>
            <span style={{textAlign:"center"}}>#</span><span>Précédent</span><span style={{textAlign:"center"}}>{unit==="élastique"?"Élast.":unit}</span><span style={{textAlign:"center"}}>Reps</span><span/>
          </div>
          {ex.sets.map((st,si)=>{
            const timed=isTimed(st.reps);
            const isActive=work.running&&activeWork===si;
            const prev=last?.sets?.[si];
            return(
              <div key={si} style={{display:"grid",gridTemplateColumns:"28px minmax(0,1fr) 70px 58px 44px",gap:6,alignItems:"center",padding:"5px 4px",borderRadius:14,background:st.done?G.green+"12":"transparent",transition:"background .25s"}}>
                <div style={{fontFamily:G.fontD,fontWeight:800,fontSize:15,textAlign:"center",color:st.done?G.green:"#aaa"}}>{si+1}</div>
                <button onClick={()=>prev&&onSetChange(ei,si,{load:unit==="kg"?stripKg(prev.load):String(prev.load||"")})} disabled={!prev}
                  style={{all:"unset",cursor:prev?"pointer":"default",fontSize:13,color:prev?"#9a9a9a":C.dim,...ellipsis}} aria-label={prev?"Reprendre la charge précédente":undefined}>
                  {prev?`${stripKg(prev.load)||"—"} × ${prev.reps}`:"—"}
                </button>
                <input value={st.load} onChange={e=>onSetChange(ei,si,{load:e.target.value})} placeholder={(si>0&&ex.sets[si-1].load)||(prev?stripKg(prev.load):"")||"—"}
                  inputMode={unit==="élastique"?"text":"decimal"} aria-label={`Charge série ${si+1}`}
                  style={{...cellInput,color:st.done?G.green:G.white,background:st.done?"transparent":C.soft}}/>
                {timed
                  ?<div style={{...cellInput,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isActive?17:14,color:isActive?(work.timeLeft<=3?G.red:G.goldLight):st.done?G.green:"#ccc",background:isActive?G.gold+"1a":st.done?"transparent":C.soft,borderColor:isActive?G.gold+"66":C.line}}>
                    {isActive?fmtClock(work.timeLeft):st.reps}
                  </div>
                  :<input value={st.actualReps||""} onChange={e=>onSetChange(ei,si,{actualReps:e.target.value.replace(/[^\d]/g,"")})} placeholder={st.reps}
                    inputMode="numeric" aria-label={`Répétitions série ${si+1}`}
                    style={{...cellInput,color:st.done?G.green:G.goldLight,background:st.done?"transparent":C.soft}}/>
                }
                {st.done
                  ?<button aria-label={`Annuler la validation de la série ${si+1}`} onClick={()=>onSetChange(ei,si,{done:false})} style={{width:44,height:42,borderRadius:12,border:"none",background:G.green,color:"#062b14",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",animation:"pop .25s ease"}}><Icon name="check" size={20} sw={3}/></button>
                  :timed
                    ?(isActive
                      ?<button aria-label="Arrêter le chrono" onClick={()=>{work.stop();setActiveWork(null);}} style={{width:44,height:42,borderRadius:12,border:`1px solid ${G.red}66`,background:G.red+"22",color:G.red,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Icon name="stop" size={16} fill="currentColor" sw={0}/></button>
                      :<button aria-label={`Lancer le chrono série ${si+1}`} onClick={()=>{unlockAudio();setActiveWork(si);work.start(parseRest(st.reps));}} style={{width:44,height:42,borderRadius:12,border:"none",background:C.goldGrad,color:G.bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Icon name="play" size={16} fill="currentColor" sw={0}/></button>)
                    :<button aria-label={`Valider la série ${si+1}`} onClick={()=>complete(si)} style={{width:44,height:42,borderRadius:12,border:`1.5px solid ${G.gold}77`,background:G.gold+"14",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Icon name="check" size={20} sw={2.4}/></button>
                }
              </div>
            );
          })}

          {/* Ressenti */}
          <div style={{display:"flex",gap:6,marginTop:12}}>
            {[["😊","Facile"],["😐","Correct"],["😤","Dur"],["💀","Épuisant"]].map(([emoji,label])=>{
              const a=ex.sensation===emoji;
              return(
                <button key={emoji} onClick={()=>onExChange(ei,{sensation:a?"":emoji})} aria-pressed={a}
                  style={{flex:1,height:40,borderRadius:12,border:`1px solid ${a?G.gold+"88":C.line}`,background:a?G.gold+"1f":"transparent",color:a?G.goldLight:C.muted,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                  <span style={{fontSize:15}}>{emoji}</span>{label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Chrono de récupération flottant (mode séance)
function RestPill({timeLeft,total,label,onAdd,onSkip}){
  const urgent=timeLeft<=3;
  const small={width:44,height:44,borderRadius:14,border:`1px solid ${C.line2}`,background:C.soft,color:G.white,fontWeight:800,fontSize:13,cursor:"pointer",flexShrink:0};
  return(
    <div role="timer" style={{position:"absolute",left:12,right:12,bottom:"calc(12px + env(safe-area-inset-bottom))",zIndex:50,maxWidth:560,margin:"0 auto",
      background:"rgba(22,22,22,.94)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",border:`1px solid ${urgent?G.red+"88":G.gold+"55"}`,borderRadius:24,padding:10,
      display:"flex",alignItems:"center",gap:10,boxShadow:"0 20px 60px #000d",animation:"sheetUp .3s ease"}}>
      <Ring value={timeLeft} max={total} size={60} stroke={5} color={urgent?G.red:G.goldLight}>
        <span style={{fontFamily:G.fontD,fontSize:17,fontWeight:800,fontVariantNumeric:"tabular-nums",color:urgent?G.red:G.white}}>{fmtClock(timeLeft)}</span>
      </Ring>
      <div style={{flex:1,minWidth:0}}>
        <div style={{...eyebrow,fontSize:10}}>Récupération</div>
        <div style={{fontSize:14,fontWeight:700,marginTop:2,...ellipsis}}>{label||"Repos"}</div>
      </div>
      <button aria-label="Retirer 15 secondes" onClick={()=>onAdd(-15)} style={small}>−15</button>
      <button aria-label="Ajouter 15 secondes" onClick={()=>onAdd(15)} style={small}>+15</button>
      <button onClick={onSkip} style={{...small,width:"auto",padding:"0 14px",border:"none",background:C.goldGrad,color:G.bg}}>Passer</button>
    </div>
  );
}

// ─── FIN DE SÉANCE ────────────────────────────────────────────────────────────
function DoneView({info,name,onHome,onProgress}){
  const stats=[
    info.duration&&[fmtDuration(info.duration),"Durée","clock"],
    [`${info.setsDone}/${info.totalSets}`,"Séries","check"],
    info.volume>0&&[`${info.volume.toLocaleString("fr-FR")} kg`,"Volume","weight"],
  ].filter(Boolean);
  return(
    <div style={{position:"absolute",inset:0,overflowY:"auto",display:"flex",flexDirection:"column",background:`radial-gradient(90% 50% at 50% 0%,${G.gold}2a,transparent 70%),${G.bg}`}}>
      <div style={{maxWidth:480,width:"100%",margin:"auto",padding:"40px 22px calc(32px + env(safe-area-inset-bottom))",textAlign:"center"}} className="fu">
        <div style={{width:112,height:112,borderRadius:36,margin:"0 auto 24px",background:C.goldGrad,color:G.bg,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 20px 60px ${G.gold}55`,animation:"pop .5s cubic-bezier(.2,1.4,.4,1)"}}>
          <Icon name="trophy" size={56} sw={1.7}/>
        </div>
        <div style={{fontFamily:G.fontD,fontSize:38,fontWeight:800,letterSpacing:-1,lineHeight:1}}>SÉANCE TERMINÉE</div>
        <div style={{fontSize:15,color:C.muted,marginTop:10}}>Bravo {name} ! « {info.label} » est enregistrée.</div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${stats.length},1fr)`,gap:8,margin:"30px 0 32px"}}>
          {stats.map(([v,l,ic])=>(
            <div key={l} style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:20,padding:"16px 6px"}}>
              <div style={{color:G.goldLight,display:"flex",justifyContent:"center",marginBottom:8}}><Icon name={ic} size={18}/></div>
              <div style={{fontFamily:G.fontD,fontSize:22,fontWeight:800,lineHeight:1.05}}>{v}</div>
              <div style={{...eyebrow,fontSize:10,marginTop:5}}>{l}</div>
            </div>
          ))}
        </div>
        <PrimaryBtn onClick={onHome}>Retour à l'accueil</PrimaryBtn>
        <GhostBtn onClick={onProgress} style={{marginTop:10}}>Voir mes progrès</GhostBtn>
      </div>
    </div>
  );
}

// ─── BARRE DU BAS (onglets flottants + séance réduite) ────────────────────────
function BottomDock({tab,setTab,session,rest,onResume}){
  const items=[["home","home","Accueil"],["train","dumbbell","Training"],["food","leaf","Nutrition"],["progress","chart","Progrès"]];
  const sp=countSets(session);
  return(
    <div style={{position:"absolute",left:0,right:0,bottom:0,zIndex:40,padding:"28px 12px calc(10px + env(safe-area-inset-bottom))",pointerEvents:"none",background:"linear-gradient(180deg,transparent,#080808e6 40%)"}}>
      <div style={{maxWidth:520,margin:"0 auto",pointerEvents:"auto"}}>
        {session&&(
          <button onClick={onResume} style={{width:"100%",height:52,display:"flex",alignItems:"center",gap:10,background:C.goldGrad,color:G.bg,border:"none",borderRadius:18,padding:"0 14px",marginBottom:8,fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:`0 10px 30px ${G.gold}40`,animation:"sheetUp .3s ease"}}>
            <span style={{width:8,height:8,borderRadius:4,background:G.bg,animation:"pulseDot 1.4s ease infinite",flexShrink:0}}/>
            <span style={{flex:1,minWidth:0,textAlign:"left",...ellipsis}}>{rest.running?`Récup · ${fmtClock(rest.timeLeft)}`:session.dayLabel}</span>
            <span style={{fontSize:12,opacity:.75}}>{sp.done}/{sp.total}</span>
            <span style={{display:"flex",alignItems:"center",gap:2}}>Reprendre<Icon name="right" size={16} sw={2.4}/></span>
          </button>
        )}
        <nav style={{display:"flex",gap:4,background:"rgba(24,24,24,.88)",backdropFilter:"blur(22px)",WebkitBackdropFilter:"blur(22px)",border:`1px solid ${C.line2}`,borderRadius:26,padding:6,boxShadow:"0 14px 40px #000c"}}>
          {items.map(([key,icon,label])=>{
            const a=tab===key;
            return(
              <button key={key} onClick={()=>setTab(key)} aria-current={a?"page":undefined}
                style={{flex:1,height:54,borderRadius:20,border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,
                  background:a?G.gold+"1c":"transparent",color:a?G.goldLight:"#7d7d7d",transition:"background .2s,color .2s"}}>
                <Icon name={icon} size={21} sw={a?2.2:1.8}/>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:.3}}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ─── NUTRITION ────────────────────────────────────────────────────────────────
function NutritionTab({live,foods}){
  const nutrition=live.nutrition||{};
  const storedItems=(live.mealPlan?.meals||[]).flatMap(m=>m.items||[]);
  const src=storedItems.length>0?calcMacros(storedItems,foods):null;
  const cal=src?rnd(src.kcal):(Number(nutrition.calories)||0);
  const prot=src?rnd1(src.protein):(Number(nutrition.proteins)||0);
  const gluc=src?rnd1(src.carbs):(Number(nutrition.carbs)||0);
  const lip=src?rnd1(src.fat):(Number(nutrition.fats)||0);
  const macros=[["Protéines",prot,prot*4,G.goldLight],["Glucides",gluc,gluc*4,G.gold],["Lipides",lip,lip*9,C.bronze]];
  const sum=macros.reduce((a,m)=>a+m[2],0)||1;
  const meals=(live.mealPlan?.meals||[]).filter(m=>(m.items||[]).length>0);

  // Anneau segmenté : part de chaque macro dans les calories
  const size=168,stroke=14,r=(size-stroke)/2,c=2*Math.PI*r,gap=macros.filter(m=>m[2]>0).length>1?6:0;
  let offset=0;

  return(<>
    <PageTitle sub="Tes objectifs quotidiens">Nutrition</PageTitle>
    <Card style={{padding:"22px 18px"}}>
      <div style={{position:"relative",width:size,height:size,margin:"0 auto"}}>
        <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}} aria-hidden="true">
          <circle cx={size/2} cy={size/2} r={r} stroke="#ffffff10" strokeWidth={stroke} fill="none"/>
          {macros.map(([l,,k,col])=>{
            if(k<=0) return null;
            const len=Math.max(0,c*k/sum-gap);
            const el=<circle key={l} cx={size/2} cy={size/2} r={r} stroke={col} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${len} ${c}`} strokeDashoffset={-offset}/>;
            offset+=c*k/sum;
            return el;
          })}
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:G.fontD,fontSize:44,fontWeight:800,lineHeight:1,letterSpacing:-1}}>{cal.toLocaleString("fr-FR")}</div>
          <div style={{...eyebrow,fontSize:10,marginTop:4}}>kcal / jour</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:22}}>
        {macros.map(([l,g,k,col])=>(
          <div key={l} style={{background:C.soft,borderRadius:16,padding:"12px 10px",border:`1px solid ${C.line}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted,fontWeight:700}}><span style={{width:8,height:8,borderRadius:4,background:col}}/>{l}</div>
            <div style={{fontFamily:G.fontD,fontSize:24,fontWeight:800,marginTop:6,lineHeight:1}}>{g}<span style={{fontSize:13,color:C.muted,marginLeft:2}}>g</span></div>
            <div style={{fontSize:11,color:C.dim,marginTop:3}}>{Math.round(k/sum*100)}% des kcal</div>
          </div>
        ))}
      </div>
      {nutrition.notes&&<div style={{marginTop:14,padding:"12px 14px",background:G.gold+"0f",borderRadius:14,fontSize:13,color:"#ddd",lineHeight:1.5,borderLeft:`3px solid ${G.gold}`}}>{nutrition.notes}</div>}
    </Card>

    <SectionTitle>Plan alimentaire</SectionTitle>
    {meals.length===0
      ?<Card style={{textAlign:"center",padding:"26px 20px",color:C.muted,fontSize:14,lineHeight:1.5}}>Ton coach n'a pas encore défini de plan alimentaire.</Card>
      :meals.map(meal=><MealCard key={meal.id} meal={meal} foods={foods}/>)}
  </>);
}

function MealCard({meal,foods}){
  const [open,setOpen]=useState(false);
  const slot=MEAL_SLOTS.find(s=>s.id===meal.id);
  const m=calcMacros(meal.items,foods);
  return(
    <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:20,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} aria-expanded={open} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:14,background:"none",border:"none",color:G.white,textAlign:"left",cursor:"pointer"}}>
        <div style={{width:44,height:44,borderRadius:14,background:C.soft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{slot?.icon||"🍽"}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15}}>{meal.label}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:2}}>{meal.items.length} aliment{meal.items.length>1?"s":""} · P {rnd(m.protein)} · G {rnd(m.carbs)} · L {rnd(m.fat)}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontFamily:G.fontD,fontSize:18,fontWeight:800,color:G.goldLight,lineHeight:1}}>{rnd(m.kcal)}</div>
          <div style={{fontSize:10,color:C.muted}}>kcal</div>
        </div>
        <Icon name="down" size={16} color={C.muted} style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}/>
      </button>
      {open&&(
        <div style={{padding:"0 14px 10px",animation:"fadeIn .2s ease"}}>
          {meal.items.map((item,idx)=>{
            const food=foods.find(f=>f.id===item.foodId);
            if(!food) return null;
            const im=calcMacros([item],foods);
            return(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderTop:`1px solid ${C.line}`}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:14,fontWeight:600,lineHeight:1.35}}>{food.name}</div>
                  <div style={{fontSize:11,color:C.muted,marginTop:2}}>{rnd(im.kcal)} kcal · P {rnd1(im.protein)} · G {rnd1(im.carbs)} · L {rnd1(im.fat)}</div>
                </div>
                <Chip gold>{item.qty} {food.unit==="g"?"g":"port."}</Chip>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PROGRÈS ──────────────────────────────────────────────────────────────────
function ProgressTab({logs,programs}){
  const completed=logs.filter(l=>l.completed);
  const volume=completed.reduce((a,l)=>a+logVolume(l),0);
  const minutes=completed.reduce((a,l)=>a+(Number(l.duration)||0),0);
  const now=new Date();
  const monthKey=`${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
  const thisMonth=completed.filter(l=>(l.date||"").startsWith(monthKey)).length;
  // 8 dernières semaines
  const mon=mondayOf(now);
  const weeks=[...Array(8)].map((_,i)=>addDays(mon,-7*(7-i)));
  const counts=weeks.map(w=>{const a=isoOf(w),b=isoOf(addDays(w,7));return completed.filter(l=>l.date>=a&&l.date<b).length;});
  const maxC=Math.max(1,...counts);
  // Historique groupé par mois
  const groups=[];
  logs.forEach(l=>{
    const d=parseISO(l.date);
    const key=d?cap(d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})):"Autres";
    const g=groups.find(x=>x.key===key);
    if(g) g.items.push(l); else groups.push({key,items:[l]});
  });
  const fmtVol=v=>v>=10000?`${(v/1000).toLocaleString("fr-FR",{maximumFractionDigits:1})} t`:`${Math.round(v).toLocaleString("fr-FR")} kg`;
  const stats=[
    [completed.length,"Séances","dumbbell"],
    [thisMonth,"Ce mois-ci","calendar"],
    [volume>0?fmtVol(volume):"—","Volume soulevé","weight"],
    [minutes>0?fmtDuration(minutes):"—","Temps d'entraînement","clock"],
  ];
  return(<>
    <PageTitle>Progrès</PageTitle>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      {stats.map(([v,l,ic])=>(
        <Card key={l} style={{padding:16}}>
          <div style={{width:34,height:34,borderRadius:11,background:G.gold+"18",color:G.goldLight,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}><Icon name={ic} size={17}/></div>
          <div style={{fontFamily:G.fontD,fontSize:28,fontWeight:800,lineHeight:1,letterSpacing:-.5}}>{v}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:5}}>{l}</div>
        </Card>
      ))}
    </div>

    <Card style={{marginTop:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700}}>Séances par semaine</div>
        <div style={{fontSize:12,color:C.muted}}>8 semaines</div>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:8,height:110}}>
        {counts.map((c,i)=>{
          const cur=i===counts.length-1;
          return(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%",justifyContent:"flex-end"}}>
              <div style={{fontSize:11,fontWeight:700,color:c?(cur?G.goldLight:"#bbb"):"transparent"}}>{c}</div>
              <div style={{width:"100%",maxWidth:28,height:`${Math.max(6,c/maxC*72)}px`,borderRadius:8,background:c?(cur?C.goldGrad:G.gold+"55"):"#ffffff0d",transition:"height .5s ease"}}/>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {weeks.map((w,i)=><div key={i} style={{flex:1,textAlign:"center",fontSize:10,color:i===weeks.length-1?G.goldLight:C.dim,fontWeight:700}}>{`${w.getDate()}/${w.getMonth()+1}`}</div>)}
      </div>
    </Card>

    {logs.length===0
      ?<Card style={{marginTop:24,textAlign:"center",color:C.muted,fontSize:14,padding:28}}>Ton historique apparaîtra ici après ta première séance.</Card>
      :groups.map(g=>(
        <div key={g.key}>
          <SectionTitle>{g.key}</SectionTitle>
          {g.items.map((log,i)=><HistoryItem key={log.id||i} log={log} programs={programs}/>)}
        </div>
      ))}
  </>);
}

function HistoryItem({log,programs}){
  const [open,setOpen]=useState(false);
  const prog=programs.find(p=>String(p.id)===String(log.programId));
  const sens=(log.exercises||[]).map(e=>e.sensation).filter(Boolean);
  return(
    <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:20,marginBottom:10,overflow:"hidden"}}>
      <button onClick={()=>setOpen(!open)} aria-expanded={open} style={{width:"100%",display:"flex",alignItems:"center",gap:14,padding:14,background:"none",border:"none",color:G.white,textAlign:"left",cursor:"pointer"}}>
        <DateBadge iso={log.date}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,...ellipsis}}>{log.dayLabel||prog?.name||"Séance"}</div>
          <div style={{fontSize:12,color:C.muted,marginTop:3,...ellipsis}}>
            {[prog?.name,log.duration&&fmtDuration(log.duration),!log.completed&&"Manquée"].filter(Boolean).join(" · ")||fmtDate(log.date)}
          </div>
        </div>
        {sens.length>0&&<div style={{fontSize:14,letterSpacing:-2,flexShrink:0}}>{sens.slice(0,3).join("")}</div>}
        <Icon name="down" size={16} color={C.muted} style={{transform:open?"rotate(180deg)":"none",transition:"transform .2s"}}/>
      </button>
      {open&&(
        <div style={{padding:"0 14px 14px",animation:"fadeIn .2s ease"}}>
          {log.notes&&<div style={{fontSize:13,color:"#ccc",fontStyle:"italic",margin:"0 0 12px",padding:"10px 12px",background:C.soft,borderRadius:12}}>« {log.notes} »</div>}
          {(log.exercises||[]).map((ex,i)=>(
            <div key={i} style={{padding:"10px 0",borderTop:`1px solid ${C.line}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:14,color:G.goldLight}}>{ex.name}</div>
                {ex.sensation&&<span style={{fontSize:15}}>{ex.sensation}</span>}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {(ex.sets||[]).map((s,j)=><Chip key={j}>{stripKg(s.load)||"—"}{s.load&&/kg$/i.test(String(s.load))?" kg":""} × {s.reps}</Chip>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
  // Ajoute (ou retire, si négatif) du temps au chrono en cours
  const add=useCallback(secs=>{
    setEndAt(e=>e?Math.max(Date.now()+1000,e+secs*1000):e);
    setTotal(t=>Math.max(1,t+secs));
  },[]);
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
