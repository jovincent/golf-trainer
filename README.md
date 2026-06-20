# FlightLab — Entraîneur Golf Garmin R10

Application web d'entraînement au golf construite autour du **Garmin Approach R10**.
Capte les shots en Bluetooth, calcule les trajectoires avec des modèles balistiques,
suit la progression et propose des drills guidés — le tout stocké localement,
sans cloud, sans compte.

> **Navigateur requis : Chrome ou Edge desktop** (ou Chrome Android).
> La connexion Bluetooth repose sur l'API Web Bluetooth, absente de Safari/iOS/Firefox.

---

## Démarrage rapide

```bash
npm install
npm run dev        # Lance l'API (port 4141) + le front Vite (port 4040)
```

Ouvre **http://localhost:4040** dans Chrome ou Edge.

Sans radar, choisis la source **Simulateur**, clique **Connecter** et frappe des
balles — tout fonctionne avec des données simulées réalistes.

### Commandes disponibles

| Commande | Rôle |
|---|---|
| `npm run dev` | API + Vite en parallèle **(commande principale)** |
| `npm run server` | API Express seule (port 4141) |
| `npm run web` | Vite seul — ⚠️ **sans API, les profils ne chargent pas** |
| `npm run build` | Build de production |
| `npm run preview` | Aperçu du build |

> **Important :** toujours utiliser `npm run dev`. `npm run web` ne démarre pas
> l'API Express — les profils joueurs n'apparaissent pas et rien n'est persisté.

---

## Architecture

```
Golf-Trainer/
├── src/
│   ├── adapters/
│   │   ├── garminR10.ts      # Bluetooth BLE — Garmin Approach R10
│   │   └── simulator.ts      # Générateur de shots réalistes (sans matériel)
│   ├── components/
│   │   └── ConnectionBar.tsx # Barre connexion + sélecteur modèle de vol + son
│   ├── hooks/
│   │   └── useTheme.ts       # 5 thèmes CSS via data-theme sur <html>
│   ├── lib/
│   │   ├── api.ts            # Client HTTP → API Express (profils + séances)
│   │   ├── export.ts         # Export CSV
│   │   ├── flight.ts         # 4 modèles de trajectoire balistique
│   │   ├── sounds.ts         # Sons de feedback (succès, erreur)
│   │   └── stats.ts          # Statistiques (mean, stdDev, percentile…)
│   ├── pages/
│   │   ├── LiveSession.tsx   # Session en direct
│   │   ├── Stats.tsx         # Statistiques & pattern de dispersion
│   │   ├── Practice.tsx      # Drills guidés
│   │   ├── History.tsx       # Historique des séances
│   │   ├── Compare.tsx       # Comparaison inter-profils
│   │   ├── Course.tsx        # Simulation de parcours (WIP)
│   │   └── Junior.tsx        # Mode enfant simplifié ⭐
│   ├── store.ts              # État global Zustand
│   ├── types.ts              # Types TypeScript (Shot, Session, Club…)
│   └── App.tsx               # Navigation + sélecteur de profil + thèmes
├── server/
│   ├── index.js              # API Express (port 4141)
│   ├── db.js                 # Accès SQLite (WAL mode)
│   └── data/
│       └── fairway.db        # Base SQLite locale (ignorée par git)
└── .claude/
    └── launch.json           # Config preview Claude Code (npm run dev)
```

---

## Stack

| Couche | Technologie |
|---|---|
| Front | React 18 · TypeScript 5 · Vite 5 |
| Style | Tailwind CSS 3 · CSS custom properties · 5 thèmes |
| État global | Zustand |
| Graphiques | Recharts |
| Icônes | lucide-react |
| Backend | Express 4 (Node.js ESM) |
| Base de données | SQLite via `node:sqlite` natif (WAL mode) |
| Bluetooth | Web Bluetooth API (Chrome/Edge uniquement) |
| Dev tooling | concurrently · TypeScript strict |

---

## Modèles de vol

Sélectionnables en temps réel via le menu déroulant dans la barre de connexion.
Tous les shots existants sont recalculés à la volée lors d'un changement de modèle.

| Modèle | Algorithme | Calibration | RMSE vs Garmin |
|---|---|---|---|
| **TRUTH 🎯** | Euler + drag/lift/spin | GLOBAL=0.926, calibré sur 4 shots Hy réels | ≈ 1.95 m |
| **Calibré** | Euler + drag/lift/spin | GLOBAL=0.9, TRIM par club | ≈ 2.51 m |
| **Physique** | Runge-Kutta 4, aéro complète | Non calibré | Variable |
| **Régression** | Polynôme empirique | Données synthétiques | Non mesuré |

Le modèle **TRUTH** est recommandé. Il a été optimisé par recherche sur grille
(grid search GLOBAL ∈ [0.88, 0.96]) pour minimiser l'erreur quadratique moyenne
sur des données terrain Garmin R10 (hybride). Le facteur TRIM par club est mis
à l'échelle `× (0.9 / 0.926)` pour conserver l'échelonnement relatif des clubs,
sauf le Hy (TRIM=1.0 absorbé dans le GLOBAL).

---

## Persistance — SQLite locale

Toutes les données sont stockées dans `server/data/fairway.db`, créée
automatiquement au premier lancement. **Aucune donnée ne quitte la machine.**

Les shots sont écrits **balle par balle** (pas en fin de séance) — rien n'est
perdu en cas de fermeture du navigateur en cours de frappe.

### API REST (port 4141)

```
# Profils joueurs
GET    /api/profiles                        liste des profils
POST   /api/profiles                        créer un profil  { name }
PUT    /api/profiles/:id                    renommer         { name }
DELETE /api/profiles/:id                    supprimer

# Séances & shots
GET    /api/sessions?profileId=...          séances du profil
POST   /api/sessions                        créer une séance { profileId, label, club }
POST   /api/sessions/bulk                   import multiple
POST   /api/sessions/:id/shots             ajouter un shot
PATCH  /api/sessions/:id                    mettre à jour (label, clubs…)
DELETE /api/sessions/:id                    supprimer une séance
DELETE /api/sessions?profileId=...          vider l'historique du profil
```

---

## Fonctionnalités par onglet

### Session (en direct)
Métriques shot par shot : carry, vitesse balle/club, smash factor, spin, apex,
écart ligne. Tableau cumulatif des balles. Sauvegarde automatique.

### Stats
- **Pattern de dispersion** : nuage carry/écart, zones vertes ≤5%, orange 5-8%,
  rouge >8% (en % du carry). Chaque point affiche une flèche orientée selon
  l'axe de spin à la retombée (carry + 2 × atan(offline/carry)).
- **Gapping** : carry moyen par club, détection des gaps trop larges ou serrés.
- **Régularité** : écart-type carry et dispersion latérale par club.

### Practice (Drills)
Couloir de précision + régularité de distance, notés en direct. Objectifs
configurables.

### Historique
Liste de toutes les séances du profil actif. Chaque séance est dépliable et
affiche les shots avec :
- Numéro + club
- **Carry en grand** (métrique principale)
- V. club · V. balle · Smash · Apex · Backspin · Angle de lancement
- Badge d'écart latéral coloré (vert/orange/rouge) avec direction G/D
- Survol : popover complet avec les 20 métriques du shot
- Export CSV de tout l'historique

### Comparer
Comparaison des performances entre profils sur les mêmes clubs.

### Junior ⭐
Mode simplifié pour les enfants :
- Notation 1-3 étoiles avec emoji et couleur selon la précision latérale
- Barre de direction visuelle (zones colorées carry-relatives)
- Record de session mis en avant avec badge 🏆
- Historique de session en mini-cartes colorées
- Bouton simulateur intégré quand la source est le simulateur

---

## Profils joueurs

Le sélecteur de profil (bouton avec icône utilisateur en haut à droite) permet
de créer, renommer et supprimer des profils. Chaque profil a son propre
historique de séances isolé.

**Profils fournis :** Jonathan, Jo, Boubou (432 shots), Annemarie (288 shots).

> Si le sélecteur n'apparaît pas : l'API Express n'est pas démarrée.
> Solution : `npm run dev` (pas `npm run web`).

---

## Thèmes visuels

5 thèmes accessibles via le bouton palette (⬤ + 🎨) en haut à droite.
Implémentés via CSS custom properties sur l'attribut `data-theme` du `<html>`.

| ID | Nom | Ambiance |
|---|---|---|
| `fairway` | Fairway | Vert gazon classique (défaut) |
| `dark-pro` | Dark Pro | Fond sombre, pro |
| `augusta` | Augusta | Vert foncé premium |
| `sports` | Sports | Bleu vif dynamique |
| `field` | Terrain | Tons terre / olive |

---

## Adaptateur Garmin R10 — calibration BLE

Garmin ne publie pas le protocole Bluetooth du R10. Le parsing dans
`src/adapters/garminR10.ts` est basé sur du reverse engineering et nécessite
une calibration sur l'appareil physique.

### Étapes pour calibrer

1. Choisir la source **Garmin Approach R10**, cliquer **Connecter**, sélectionner le radar.
2. Ouvrir la console du navigateur (F12).
3. Frapper quelques balles — les octets bruts s'affichent dans le panneau **Diagnostic R10**.
4. Identifier la caractéristique BLE qui notifie sur chaque coup.
5. Adapter `handlePacket()` dans `garminR10.ts` pour parser le bon format binaire.

Le panneau **Diagnostic R10** dans l'app affiche tous les messages BLE en temps réel
(UUID services, caractéristiques, données brutes).

---

## Développement

```bash
# Vérifier les types TypeScript
npx tsc --noEmit

# Inspecter la base de données
sqlite3 server/data/fairway.db ".tables"
sqlite3 server/data/fairway.db "SELECT name FROM profiles;"
sqlite3 server/data/fairway.db "SELECT p.name, COUNT(s.id) shots FROM profiles p LEFT JOIN shots s ON s.profileId = p.id GROUP BY p.id;"

# Logs de l'API (si lancée en arrière-plan)
tail -f /tmp/golf-api.log
```

### Gotchas

- `server/data/fairway.db` est dans `.gitignore` — les données ne sont pas versionnées.
- Les erreurs TypeScript dans `Course.tsx` sont pré-existantes (bug de type dans
  le calcul de distance), sans impact sur le reste de l'app.
- La barre de connexion affiche le panneau **Diagnostic R10** uniquement quand
  la source sélectionnée est **Garmin Approach R10**.
- `recomputeAll()` dans le store recalcule toutes les trajectoires quand le
  modèle de vol change — peut prendre quelques ms sur de gros historiques.
