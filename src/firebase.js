import { initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";

// Configuration publique (identifie le projet, n'est pas un secret) : l'accès aux données
// est contrôlé par Firebase Auth + firestore.rules.
const firebaseConfig = {
  apiKey: "AIzaSyCrhd9TagXrEQo8GD8Lc1rJlod0nN-T7xA",
  authDomain: "mon-coaching-6399e.firebaseapp.com",
  projectId: "mon-coaching-6399e",
  storageBucket: "mon-coaching-6399e.firebasestorage.app",
  messagingSenderId: "885029359700",
  appId: "1:885029359700:web:366b943ddabf1126f69dc1",
};

// VITE_FIREBASE_EMULATORS=1 : développement local sur les émulateurs (projet demo-, aucune donnée réelle)
const USE_EMULATORS = import.meta.env.VITE_FIREBASE_EMULATORS === "1";

const app = initializeApp(USE_EMULATORS ? { ...firebaseConfig, projectId: "demo-wandy" } : firebaseConfig);

export const auth = getAuth(app);

// Cache local persistant : l'app s'ouvre instantanément avec les dernières données connues
// et les séances enregistrées sans réseau (salle en sous-sol…) sont synchronisées au retour du réseau.
let firestore;
try {
  firestore = initializeFirestore(app, {
    localCache: USE_EMULATORS ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch (e) {
  console.warn("[Firebase] Cache persistant indisponible, mode mémoire.", e);
  firestore = getFirestore(app);
}

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
}

export const db = firestore;
export { doc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, getDoc, query, where };
export { onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword, signOut };

// Fonctions serveur (Vercel). VITE_API_BASE permet d'appeler l'API Vercel depuis un autre hébergement.
export const API_BASE = import.meta.env.VITE_API_BASE || "";

// Vrai si l'utilisateur connecté porte la claim coach (posée par scripts/set-coach.mjs)
export async function isCoachUser(user) {
  if (!user || user.uid.startsWith("client_")) return false;
  try {
    return (await user.getIdTokenResult()).claims.coach === true;
  } catch {
    // Hors ligne avec un token expiré : on se fie au type de compte, les règles Firestore tranchent
    return !!user.email;
  }
}

// Connexion client : le code est vérifié côté serveur, qui renvoie un custom token.
// Retourne { status: "ok", clientId } | { status: "invalid" | "locked" | "network" }
export async function loginClientWithCode(code) {
  let res;
  try {
    res = await fetch(`${API_BASE}/api/client-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  } catch {
    return { status: "network" };
  }
  if (res.status === 401) return { status: "invalid" };
  if (res.status === 429) return { status: "locked" };
  if (!res.ok) return { status: "network" };
  try {
    const { token, clientId } = await res.json();
    await signInWithCustomToken(auth, token);
    return { status: "ok", clientId };
  } catch {
    return { status: "network" };
  }
}

// Connexion coach (compte e-mail). Retourne "ok" | "invalid" | "notcoach" | "network"
export async function loginCoach(email, password) {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (await isCoachUser(user)) return "ok";
    await signOut(auth);
    return "notcoach";
  } catch (e) {
    if (e?.code === "auth/network-request-failed") return "network";
    return "invalid";
  }
}
