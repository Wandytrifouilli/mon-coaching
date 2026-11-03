// Donne le rôle coach (custom claim coach: true) à un compte Firebase Auth existant.
// Usage : FIREBASE_SERVICE_ACCOUNT=chemin/vers/cle.json node scripts/set-coach.mjs coach@exemple.fr
// Le coach doit se reconnecter ensuite pour que la claim soit prise en compte.
import { adminAuth } from "../api/_lib/firebaseAdmin.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage : node scripts/set-coach.mjs <email-du-coach>");
  process.exit(1);
}

const user = await adminAuth().getUserByEmail(email);
await adminAuth().setCustomUserClaims(user.uid, { ...(user.customClaims || {}), coach: true });
console.log(`OK : ${email} (uid ${user.uid}) a maintenant le rôle coach.`);
