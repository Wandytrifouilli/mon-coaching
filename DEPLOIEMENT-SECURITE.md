# Sécurisation — mise en production

Connexion par code, un seul champ pour tout le monde, vérifiée côté serveur (`api/login.js`) :
- **Coach** : code secret rangé dans la variable Vercel `COACH_CODE` (jamais dans le code de l'app).
  Il donne un token Firebase Auth avec la claim `coach: true`.
- **Adhérents** : leur code habituel (fiche `clients/{id}`), sans changement pour eux. Il donne un token
  avec les claims `clientId` + `code`.
- Anti force brute : une IP est bloquée 15 min après 10 codes faux.

`firestore.rules` : un adhérent lit/modifie uniquement sa fiche `clients/{id}` (sans pouvoir changer
`code` ni `id`) et lit `programs`, `exercises`, `foods`. Le coach a tous les droits. Si le coach change le
code d'un adhérent, l'accès de cet adhérent est coupé immédiatement.

`api/chat.js` (IA Coach) est réservé au coach. Le modèle (`claude-sonnet-5-5`) et `max_tokens` sont fixés
côté serveur.

## Ordre de déploiement (à respecter)

Si les règles sont déployées avant la nouvelle app, l'app actuelle ne peut plus lire ni écrire les données.

1. **Console Firebase → Authentication** : cliquer sur *Commencer* si ce n'est pas déjà fait (aucun
   fournisseur à activer).
2. **Console Firebase → Paramètres du projet → Comptes de service** : *Générer une nouvelle clé privée*.
   Garder le fichier JSON hors du dépôt (le `.gitignore` bloque `*firebase-adminsdk*.json`).
3. **Vercel → Settings → Environment Variables** (Production) :
   - `FIREBASE_SERVICE_ACCOUNT` = contenu complet du fichier JSON de la clé.
   - `COACH_CODE` = le code coach secret (6 caractères minimum, la casse est ignorée). Ne pas réutiliser
     `COACH2025`, qui était visible dans l'ancienne app.
   - `ANTHROPIC_API_KEY` (déjà présente).
4. Publier l'app sur Vercel (push sur `main`). Les adhérents déjà connectés sont reconnectés
   automatiquement avec leur code mémorisé. Vérifier la connexion coach et un code adhérent.
5. Déployer les règles en dernier :
   ```bash
   npx firebase deploy --only firestore:rules --project mon-coaching-6399e
   ```
   Attention : un `firebase deploy` sans `--only` déploie désormais aussi les règles.

Changer de code coach : modifier `COACH_CODE` dans Vercel puis redéployer. Les sessions coach déjà
ouvertes restent actives ; pour les couper, désactiver l'utilisateur `coach` dans Firebase → Authentication.

## Tests (émulateurs, jamais la prod)

Java 21+ est requis pour l'émulateur Firestore.

```bash
npm run test:emulators
```

Développement local sur émulateurs : `npm run emulators`, puis `npm run seed:emulators`, puis
`npm run dev:emulators`. Code coach de test : `COACH-TEST`. Codes adhérents de test : `ALEX2025`, `BEAT2025`.

## Limites connues

- Les codes adhérents suivent le format prénom + année : ils sont faciles à deviner pour qui connaît
  l'adhérent. L'anti force brute limite les essais ; des codes aléatoires seraient plus sûrs.
- La clé web Firebase de `src/firebase.js` est publique par nature (ce n'est pas un secret).
