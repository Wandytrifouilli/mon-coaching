// Firebase Admin côté serveur (fonctions Vercel). Les fichiers préfixés par « _ » ne sont pas exposés comme routes.
import { readFileSync } from "node:fs";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "mon-coaching-6399e";

function adminApp() {
  if (getApps().length) return getApps()[0];
  // FIREBASE_SERVICE_ACCOUNT : contenu JSON de la clé de compte de service, ou chemin vers le fichier
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    const json = sa.trim().startsWith("{") ? sa : readFileSync(sa, "utf8");
    return initializeApp({ credential: cert(JSON.parse(json)) });
  }
  // Sans clé, seuls les émulateurs sont autorisés : évite d'écrire en prod avec des identifiants locaux implicites
  if (process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return initializeApp({ projectId: process.env.GCLOUD_PROJECT || PROJECT_ID });
  }
  throw new Error("FIREBASE_SERVICE_ACCOUNT manquant sur le serveur");
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());

// CORS : même origine par défaut. ALLOWED_ORIGINS (liste séparée par des virgules) autorise d'autres
// domaines, par ex. l'app servie par Firebase Hosting qui appelle l'API Vercel.
// Retourne true si la requête (préflight OPTIONS) est entièrement traitée.
export function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function readJsonBody(req) {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}
