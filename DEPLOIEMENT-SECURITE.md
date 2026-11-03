# Sécurisation — mise en production

Authentification Firebase Auth :
- **Coach** : compte e-mail/mot de passe avec la custom claim `coach: true`.
- **Clients** : le code est vérifié côté serveur (`api/client-login.js`), qui renvoie un custom token
  (`uid = client_<id>`, claims `clientId` + `code`).

`firestore.rules` : un client lit/modifie uniquement sa fiche `clients/{id}` (sans pouvoir changer `code`
ni `id`) et lit `programs`, `exercises`, `foods`. Le coach a tous les droits. Si le coach change le code
d'un client, l'accès de ce client est coupé immédiatement.

`api/chat.js` est réservé au coach (ID token vérifié). Le modèle (`claude-sonnet-5-5`) et `max_tokens`
sont fixés côté serveur.

## Ordre de déploiement (à respecter)

Si les règles sont déployées avant la nouvelle app, l'app actuelle (sans connexion Firebase) ne peut
plus lire ni écrire les données.

1. **Console Firebase → Authentication** : activer le fournisseur *E-mail/Mot de passe*, puis créer le
   compte du coach (*Users → Add user*).
2. **Console Firebase → Paramètres du projet → Comptes de service** : *Générer une nouvelle clé privée*.
   Conserver le fichier JSON hors du dépôt (le `.gitignore` bloque `*firebase-adminsdk*.json`).
3. Donner le rôle coach au compte :
   ```bash
   FIREBASE_SERVICE_ACCOUNT=chemin/vers/cle.json node scripts/set-coach.mjs email-du-coach@exemple.fr
   ```
4. **Vercel → Settings → Environment Variables** :
   - `FIREBASE_SERVICE_ACCOUNT` = contenu complet du fichier JSON de la clé.
   - `ANTHROPIC_API_KEY` (déjà présente).
   - Si l'app est aussi servie par Firebase Hosting : `ALLOWED_ORIGINS=https://mon-coaching-6399e.web.app`
     côté Vercel, et `VITE_API_BASE=https://<domaine-vercel>` au build pour Firebase Hosting
     (Firebase Hosting ne sert pas le dossier `api/`).
5. Déployer l'app sur Vercel. Les clients déjà connectés sont reconnectés automatiquement avec leur
   code mémorisé. Vérifier la connexion client et coach.
6. Déployer les règles :
   ```bash
   npx firebase deploy --only firestore:rules
   ```
   Attention : un `firebase deploy` sans `--only` déploie désormais aussi les règles.

Option : dans *Authentication → Settings → User actions*, désactiver la création de comptes par les
utilisateurs. Un compte créé ainsi n'a de toute façon accès à rien (ni claim `coach` ni `clientId`).

## Tests (émulateurs, jamais la prod)

Java 21+ est requis pour l'émulateur Firestore.

```bash
npm run test:emulators
```

Développement local sur émulateurs : `npm run emulators`, puis `npm run seed:emulators`, puis
`npm run dev:emulators`. Compte de test : `coach@test.local` / `coach-test-123`. Codes clients de test :
`ALEX2025`, `BEAT2025`.

## Limites connues

- Les codes clients suivent le format prénom + année : ils sont faciles à deviner pour qui connaît le
  client. L'API bloque une IP après 10 échecs en 15 min. Des codes aléatoires seraient plus sûrs.
- La clé web Firebase de `src/firebase.js` est publique par nature (ce n'est pas un secret). On peut
  la restreindre aux domaines de l'app dans Google Cloud Console → Identifiants.
