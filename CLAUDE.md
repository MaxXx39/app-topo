# CLAUDE.md - Application Topo (PWA + APK Android, usage personnel)

## Utilisateur et manière de travailler
- Géomètre topo suisse, **débutant en développement**. Répondre **en français**, simplement, sans jargon (définir un terme technique en une phrase).
- Poser **toujours** des questions **avant** une décision importante ou ambiguë. Ne **jamais deviner** une formule ou une norme de topo : le dire et faire valider.
- Fonctionnalité : lancer les tests, expliquer, dire comment l'essayer, proposer la suite.
- Nouvelle fonctionnalité : **toujours demander** dans quel mode la mettre (**Base**, **Intermédiaire** ou **Expert**) avant de la coder.
- Tout se fait dans le cloud ; l'utilisateur n'utilise que navigateur / tablette.
- **Git** : commit en français après chaque fonctionnalité qui marche. Ne jamais demander mot de passe ni jeton dans le chat. Aucun identifiant de modèle dans commits / PR.
- Avant d'ajouter une bibliothèque : dire ce qu'elle fait, pourquoi, demander l'accord.

## Stack
- JavaScript vanilla (modules ES), **Vite 8**, **vite-plugin-pwa**, **Vitest 5** ; plan en SVG (fond DXF en canvas).
- Bibliothèques : `delaunator` + `@kninnug/constrainautor` (triangulation), `jspdf` (PDF), `heic-to` (photos HEIC).
- APK Android : Kotlin sans bibliothèque (sauf `play-services-auth`), WebView ; la même appli web sert l'APK.
- Hébergement : GitHub Pages (`publier.yml`) ; APK fabriqué par `apk.yml` (release `apk-derniere-version`). Partage de projets : Google Drive (`drive.file`).

## Structure
```
src/main.js          point d'entrée, état, liaison des écrans (gros fichier : chercher avec grep)
src/topo/            calculs de topo (volume, coupe, mesure, implantation, talus, accroche, recalage,
                     contrôle, dessin, lame, levé direct, métré, DXF…)
src/import/          lecture CSV Emlid, TXT, LandXML, DXF ; écran de l'onglet Projet
src/plan/            plan SVG/canvas (vue, fonds swisstopo, DXF, listes de points, dessins)
src/surfaces/ volumes/ mesures/ coupes/ photos/ dessin/   écrans et logique de Calculs
src/leve/            Terrain (lever, implanter, contrôle, guidage/lame, récepteur, croquis, fenêtres)
src/recalage/ export/ projet/ partage/ (Drive)   recalage DXF ; exports ; projets (IndexedDB) ; synchro
src/android/pont.js  pont web ↔ Android (window.AppliAndroid)
src/aide/textes.js   bulles d'aide ; src/reglages/ réglages et modes ; src/outils/ utilitaires
tests/               tests Vitest (*.test.js)
android/             app Kotlin ; android/noyau/ = NMEA, MN95/RAN95, NTRIP (avec tests)
docs/                tableau des modes (xlsx) ; exemples/ = fichiers de référence (NE PAS modifier)
```

## Commandes
- `npm run dev` ; `npm run preview -- --port 4173` (aperçu, base `/app-topo/`) ; `npm run build` ; `npm run build:android` ; `npm test` (tests dans `tests/`).
- Essais visuels : Playwright (Chromium préinstallé) sur l'aperçu ; pour Terrain, simuler l'APK avec un faux `window.AppliAndroid` (`prendrePoint`, `lireReglagesCorrections`, `choisirRecepteur`…) puis `window.recevoirEtatRecepteur(etat)`, `window.recevoirPositionTablette(position)`. Arrêter l'aperçu : `pkill -f "[v]ite preview"`.
- Pas de SDK Android ici : le Kotlin est compilé par `apk.yml` (vérifier « Fabriquer l'APK »).

## Livraison et publication
- À chaque livraison : version augmentée dans `package.json` **et** `package-lock.json` (lignes 3 et 9), CLAUDE.md et bulles d'aide à jour, `npm test` et `npm run build` sans erreur, essai Playwright, commit puis envoi sur la branche de travail.
- Publier site + APK (seulement si l'utilisateur le demande) : PR vers `main`, attendre « construire » et « apk » au vert, fusionner (merge), puis `git fetch origin main && git merge --ff-only origin/main`. Jamais de rebase ni de force-push.
- APK : https://github.com/MaxXx39/app-topo/releases/download/apk-derniere-version/Topo.apk

## Conventions de code
- Code et commentaires **simples, en français**, noms clairs. Une fonction de calcul = courte, commentée (rôle, unités), **avec un test**, dans `src/topo/`.
- Coordonnées **Est, Nord, altitude** (sauf lecture LandXML : Nord, Est, altitude), tout en **MN95**, mètres ; aucune conversion dans l'appli web (l'APK convertit GNSS et GPS tablette en MN95 / RAN95). Nombres : point décimal, 3 décimales.
- Messages d'erreur compréhensibles, jamais d'échec silencieux. Pas de phrases d'explication dans les écrans : l'aide est dans les bulles (`textes.js`, apostrophes `\'`).
- Texte venant de l'extérieur (noms d'appareils, fichiers, points) toujours passé par `echapper()`.
- Noms des levés et surfaces avec préfixe (0.90, `prefixerNoms` à chaque modification et à l'ouverture) : **`LV-`** levé (stock, terrain, recollement, levé libre, métré), **`Surf-`** surface importée ou de Dessin (« Surf-Dessin N »). Surfaces importées **sans nature** (0.90) : utilisables comme stock ou terrain (`peutEtreStock`, `peutEtreTerrain`).
- Noms de points jamais interprétés. Noms levés : contour `C-Stock-n-m`, ligne `L-lib-n-m`, point `P-lib-n`, aire `A-lib-n-m` ; sommets de dessin `D1-1`.
- Dans l'appli on écrit **GNSS**, jamais « RX2 » (le récepteur peut être un RS4…) ; seule exception : l'ancien nom de liste « Levé RX2 date ».
- Données sur l'appareil (IndexedDB) ; seule exception : Drive. Mot de passe NTRIP jamais dans le projet (sauf liste partagée swipos sur Drive, acceptée).
- Réglages de l'appareil (hors projet) : `topo-reglages` (téléphone, mode), `topo-terrain`, `topo-plan-terrain-part`, `topo-plan-guidage-part`.
- Pas de bouton « Annuler » visible : ne pas promettre d'annulation.

## Référence de calcul
Levé du 20/05/2026 (affaire 10 203), tolérance **0,5 %** : Stock 1 = 1636.197 m³, Stock 2 = 648.979 m³, Stock 3 = 372.201 m³. Tests automatiques sur ce cas.

## Modes : Base, Intermédiaire, Expert (0.85)
- Réglages ⚙ ; logo = **pyramide** (vert / jaune / pointe rouge ; Base = vert seul, Intermédiaire = + jaune, Expert = les 3) ; **Intermédiaire par défaut** ; l'ancien « Confirmé » = Expert. Rien n'est supprimé du projet en changeant de mode.
- Tableau de référence : `docs/modes-base-intermediaire-expert.xlsx` (à relire avant de coder). Règle : Base ⇒ Intermédiaire ⇒ Expert (une fonction cochée plus bas l'est plus haut).
- Code (`reglages/reglages.js`) : `modeAppli()`, `aAcces('intermediaire' | 'expert')`, `estModeBase()`, `lameActive()` (= Expert) ; HTML : classes `.seulement-intermediaire` / `.seulement-expert` ; calques du plan : propriété `niveau`. **Nouvelle fonction : demander le mode, puis poser la classe ou `aAcces`.**
- **Base** : ouvrir un projet, Drive, points isolés (« Levé libre »), implanter point / ligne / surface (sans « Enregistrer l'implantation », coupes dans l'axe), Contrôle, récepteur, GPS tablette, plan (fonds, plans DXF, « Afficher »).
- **Intermédiaire** en plus : créer un projet, lignes / contours, toutes les natures de levé (Stock, Terrain, Recollement, Métré), libellés, triangles en trop, couleurs et exports de listes, Calculs (volumes, mesures), exports PDF / DXF, mail, listes partagées, réglage swipos.
- **Expert** en plus : bloc Import, exporter / dupliquer / supprimer un projet, Surface Projet, export CSV / LandXML, « Quoi exporter ? », prendre la main, talus, « À implanter », coupes, Dessin, **Guidage** (ex-Lame) et 2e récepteur, réglages NTRIP, journal NMEA, supprimer un levé, calque Triangles.
- Choix pris en codant le tableau (à revalider) : « Relancer NTRIP » dans tous les modes sans code ; « Enregistrer » de la fenêtre Exporter en Base (mail / « autrement » dès Intermédiaire) ; options de ligne à l'implantation et export du contrôle en Base ; code de sécurité inchangé.
- **Code de sécurité** (`outils/code.js`, tous modes ; simple barrière, ne jamais l'écrire dans les bulles) : passer en Expert (0.90), nom de l'appareil, réglages NTRIP, roue ⚙ de Contrôle (tolérances, points, durée), prendre la main (Drive), listes partagées. Import de points de contrôle dans Projet : **sans** code (0.90).

## Écrans
- **En-tête** : icône dossier (ambre) = Projet (crayon = renommer, Expert seulement) ; pyramide du mode (ouvre les réglages) ; main Drive (visible partout, cliquable seulement en Expert ; en Base / Intermédiaire, main rendue après 5 min reprise au premier geste) ; barre d'état du récepteur dessous (toujours visible dans l'APK, la toucher ouvre la fenêtre du récepteur). **Barre du bas** : Lever, Implanter, Contrôle, Guidage (APK ; couleurs ambre, sarcelle, rouge, bleu ; trait de la couleur du mode sur toute la largeur), Calculs (rose), Plan. Dans le code, le mode Guidage reste `'lame'`.
- **Démarrage** : fenêtre « Que veux-tu faire ? » (Continuer, Ouvrir un projet, Nouveau projet ; pas de fenêtre au tout premier lancement).
- **Exporter** (0.93, `export/module.js`) : bloc unique dans Projet, sous Import et listes : 1. Quoi ? (Plan et volumes, Mesures, Listes de points, Contrôles [Base], Implantations, Plans DXF recalés, Fichier projet [Expert]) ; 2. Format ; 3. fenêtre Exporter. Plus aucun export ailleurs (Volumes, Mesures, Contrôle, Implanter, listes, DXF).
- **Synchronisation Drive** (0.93) : `etat.synchroEnCours` (connexion, `apresOuverture`) → écran bloqué « En attente de synchronisation » (`montrerAttenteSynchro`), « Continuer sans synchroniser » après 15 s, lecture seule tant que la synchro n'est pas finie.
- **Recalage DXF** (0.92, `recalage/barre.js`, `etapeRecalage`) : étapes écrites (impaire = point sur le DXF à recaler, paire = position calée : point levé / contrôle, accroche d'un autre DXF, GNSS, ou tapée) ; Helmert avec échelle ; paramètres et écarts montrés avant « Appliquer » ; 3e point et plus pour contrôler.
- **Projet** : « + Nouveau projet », « Ouvrir projet » (liste triée, 📱 / ☁), projet ouvert (fond ambre, crayon = renommer) ; blocs repliables : Import (Expert), Listes (points, levés, dessins, surfaces, contrôle ; couleur par pastille, « exporter »), DXF importés (recalage Helmert).
- **Lever** (APK ; sur le site depuis 0.96 : seulement Lever, sans prise de point, pour modifier les levés) : bandeau « Lever en cours : nom ✎ » + Changer / + Nouveau en haut du cadre ambre ; rôle choisi (Contour, Ligne de rupture, Point isolé ; métré : Aire, Longueur, Point compté) en onglet relié à un cadre qui contient libellés, « Ligne en cours » et cadre « Point » (ID point, photo, « Enreg. Pts » ou touche volume −, position, Annuler) ; en bas : lignes du levé, triangles en trop, photos. Photos (0.96) : `photo.attentePoint` puis `photo.point` (prochain point enregistré), 📷 sur le plan (`photosDuPlan`, `montrerPhoto`). Natures : Stock, **Terrain** (ex-terrain naturel + terrassement ; anciens « Terrassement » conservés), **Recollement** (comme Terrain, **à approfondir** avec l'utilisateur), Métré, Levé libre, Surface (faite dans Dessin). Règles : `topo/lignes-levee.js`, `controlerPlacePoint` (main) ; un point n'est jamais dans 2 lignes ; segment qui en croise un autre → fenêtre dédiée. Libellés (0.95, `leve/libelles.js`) : ceux de départ fixes (couleur seule modifiable), ceux ajoutés modifiés dans les réglages ⚙ (Expert) et partagés par Drive (`libelles` des listes partagées) ; plus de crayon dans Lever. « + Lignes depuis les suites de points » (Intermédiaire, `suitesLibres`, `creerLignesDepuisSuites`). Libellé **« Aucun »** (0.90) tout à gauche, choisi à chaque démarrage : noms `L-1-3`, `P-5`, `A-1-2` (`debutDeNom`). « + Nouveau » ouvre la fenêtre du nom. Sons / vibrations (`outils/son.js`, `vibrer` → `AppliAndroid.vibrer`) : point enregistré, point refusé (`refuser`), perte et retour du RTK fixe.
- **Implanter** : point, ligne, surface, talus ; barre d'accroche (Point, Sommet, Milieu, Sur ligne, Centre ; « Ligne » = DXF, ligne de rupture / contour d'un levé montré, côté de dessin) ; flèches ▲ / ▼ du plan. Guidage en 3 colonnes (0.91 : avance / gauche à gauche, flèche au milieu toujours, monter / descendre en grand à droite) ; « ◀ précédent » / « suivant ▶ » ; « ⌖ Proche » (Expert : la cible suit le point montré le plus proche, `pointLePlusProche`) ; case « Seulement l'élément à implanter » (`elementSeul`) ; surfaces vides pas proposées ; levé sans contour = bord pointillé + fond léger ; grille des coupes en direct (Expert, `pasDeGrille`) ; orientation toujours cap GNSS (marche en secours).
- **Contrôle** : points de contrôle du projet, écarts E / N / plan / hauteur, tolérances (vert ≤ 2 cm, orange ≤ 4 cm), historique CSV / PDF, rappel à la connexion du récepteur et pendant le travail ; durée entre deux contrôles par projet (`delaiControleHeures`, 4 h par défaut, réglable en Expert).
- **Guidage** (Expert) : lame de niveleuse avec 2 GNSS ; formules **validées** (`topo/lame.js`) : écart d'un coin = altitude surface − altitude coin (+ = monter) ; dévers = (H droite − H gauche) ÷ largeur × 100 ; bords de la surface, profil en long (pentes, ruptures > 0.5 %).
- **Récepteur** : Bluetooth, corrections swipos (NTRIP) sans Emlid Flow, choix d'un réglage de la liste partagée, journal NMEA (Expert), 2e récepteur (Expert). **GPS de la tablette** (APK, sans GNSS) : seulement pour se localiser.
- **Calculs** (Intermédiaire) : Volumes, Mesures / métrés ; (Expert) Coupes, **Dessin** (sommets D1-1…, angle ↰ / ↱ **validé**, altitude « pente depuis le dernier » = `altitudeSelonChoix`, **formule à faire valider**) → « Créer la surface ».
- **Plan** (0.94, tableau « Affichage ») : boutons **Fond** (photo + transparence, cadastre), **DXF** (plans, couleur, calques par flèche), **Afficher** (catégories `SECTIONS` de `plan/listes-points.js` : Contrôle, Levé, Volume [Expert], Surface Import, Dessin, Métré, Points Import ; roues ⚙ : Contrôle et Levé en Expert, Surface Import partout), **Seul** (`listesDuTravail`, `elementSeul`). Réglages `CALQUES_DEPART` non retenus : tout revient au départ à chaque démarrage (listes et DXF remis visibles). **Exports** : tous dans Projet › Exporter, puis fenêtre « Exporter » (Enregistrer, mail, autrement).
- **Drive** (`partage/`) : dossier « App Topo › Configuration Projet ». **Une seule main par projet** : verrou par appareil (15 min), main verte / grise / rouge dans l'en-tête, lecture seule sinon, reprise automatique quand la main est rendue ; prendre la main = Expert + code ; la version de Drive l'emporte.

## Reste / à valider
- Liste d'améliorations du 29.10.2026 : lots 1 (0.90), 2 (0.91), 4 (0.92), 5 (0.93), 6 (0.94) et Lever (0.95–0.96) faits. Reste : 3D simple sans bibliothèque (Expert), puis lot 3 Guidage en dernier ; plus tard : règle « bip-bip » ; point 26 (couleur / points d'un levé de volume) en attente. Couleur des points dans « Afficher » : bug pas reproduit (l'utilisateur redira s'il le revoit).
- Décisions du 30.10 : noms `Surf-Dessin N` et `P-1` / `L-1-3` validés. Guidage : choix de la machine **Grader** ou **Bull** ; coupe courte (±5 m) : Bull = perpendiculaire à la lame (ligne des 2 GNSS) ; Grader = la lame n'est pas forcément perpendiculaire au sens de marche (coupe dans le sens de marche). Choix de la machine par une case à cocher en haut du Guidage ; coupe 20 m devant, 10 m derrière. Lot 3 (Guidage) fait en dernier. Plan : boutons **Fond, DXF, Afficher** remplacent Calques et Plans ; Intermédiaire = comme Base ; visibilité remise aux valeurs de l'Excel à chaque démarrage. Plan (30.10) : levés libres dans « Levé », listes de points importées dans une catégorie « Points Import », courbes de niveau dans la roue Expert de Levé, Volume caché en Base / Intermédiaire, bouton « Seulement ce sur quoi je travaille » (Lever : levé en cours ; Implanter : l'élément ; Contrôle : points de contrôle ; ailleurs : la liste cochée), transparence de la photo par réglette 0–100 %. Libellés : ceux de départ non modifiables, ceux ajoutés modifiables (partagés par Drive).
- Essais terrain : guidage de lame, GPS tablette, envoi par mail / autrement, listes partagées et prise de main avec 2 appareils.
- Talus (0.56.1) : arrondi (cône) aux angles saillants, est-ce voulu ? Précision H / V (GST) à comparer avec Emlid Flow.
- Hauteur de canne : le récepteur ne l'envoie pas ; proposition en attente : la taper (mode à choisir).
- DWG non pris en charge (DXF seulement). Google Cloud en mode Test (réautorisation ~7 jours).
- Terrain sans triangles visibles : réglé en 0.91 (bord pointillé + fond léger d'un levé sans contour ; triangles dans la roue Expert de Levé).
- À développer : Dessin, plateforme avec talus jusqu'au terrain naturel (entrées en terre, volume).

## Historique (résumé)
0.57 modes · 0.58 code de sécurité · 0.59 Contrôle · 0.60–0.62 Dessin · 0.63 2e récepteur · 0.70 guidage de lame · 0.72 GPS tablette · 0.76 Drive (une main par projet) · 0.77 levés au lieu de surfaces · 0.78 écran Lever · 0.79 fenêtre Exporter, listes partagées · 0.82 journal NMEA · 0.84 démarrage, crayon du projet, guidage de ligne · 0.85 trois modes · 0.86 Guidage, modes dans la barre du bas · 0.87 pyramide, GNSS, Terrain / Recollement · 0.88 Lever compact · 0.89 couleur de Calculs, pastilles de couleur · 0.90 lot 1 de la liste du 29.10 (modes, Aucun, préfixes LV- / Surf-, sons, durée de contrôle) · 0.91 lot 2 Implantation · 0.92 lot 4 recalage DXF en étapes · 0.93 lot 5 Exporter dans Projet, attente de synchronisation · 0.94 lot 6 Plan (Fond, DXF, Afficher, Seul) · 0.95 libellés partagés, lignes depuis les suites · 0.96 photos rattachées à un point (📷 sur le plan), Lever sur le site · 0.97 forme des points par libellé (`plan/formes.js`, 4e case du libellé) · 0.98 GeoTIFF swisstopo avec le DXF (`export/geotiff.js`, WMS LV95, d'après le module de l'utilisateur).
