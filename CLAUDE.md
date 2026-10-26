# CLAUDE.md - Application Topo (PWA + APK Android, usage personnel)

## Utilisateur et manière de travailler
- Géomètre topo suisse, **débutant en développement**. Répondre **en français**, simplement, sans jargon (définir un terme technique en une phrase).
- Poser **toujours** des questions **avant** une décision importante ou ambiguë. Ne **jamais deviner** une formule ou une norme de topo : le dire et faire valider.
- Fonctionnalité : lancer les tests, expliquer, dire comment l'essayer, proposer la suite.
- Nouvelle fonctionnalité : **toujours demander** dans quel mode la mettre (**Base** ou **Confirmé**) avant de la coder.
- Tout se fait dans le cloud ; l'utilisateur n'utilise que navigateur / tablette.
- **Git** : commit en français après chaque fonctionnalité qui marche. Ne jamais demander mot de passe ni jeton dans le chat. Aucun identifiant de modèle dans commits / PR.
- Avant d'ajouter une bibliothèque : dire ce qu'elle fait, pourquoi, demander l'accord.

## Stack
- JavaScript vanilla (modules ES), **Vite 8**, **vite-plugin-pwa**, **Vitest 5** ; plan en SVG (fond DXF en canvas).
- Bibliothèques : `delaunator` + `@kninnug/constrainautor` (triangulation avec contraintes), `jspdf` (PDF), `heic-to` (photos HEIC).
- APK Android : Kotlin sans bibliothèque (sauf `play-services-auth`), WebView ; la même appli web sert l'APK.
- Hébergement : GitHub Pages (`publier.yml`) ; APK fabriqué par `apk.yml` (release `apk-derniere-version`).
- Partage de projets : Google Drive (API REST, `drive.file`).

## Structure
```
src/main.js          point d'entrée, état de l'appli, liaison des écrans
src/topo/            calculs de topo (volume, coupe, mesure, implantation, talus, accroche, recalage, DXF…)
src/import/          lecture CSV Emlid, TXT, LandXML, DXF
src/plan/            plan SVG/canvas (vue, fonds swisstopo, DXF, barbules, listes de points)
src/surfaces/ volumes/ mesures/ coupes/ photos/   écrans et logique par onglet
src/leve/            onglet Terrain (lever, implanter, récepteur, guidage, croquis)
src/recalage/        recalage d'un plan DXF
src/export/          CSV, PDF, DXF, LandXML, cartouche
src/projet/          projets (IndexedDB), fichier .topo.json
src/partage/         synchro Google Drive (drive, fichiers, synchro, verrou)
src/android/pont.js  pont web ↔ Android (window.AppliAndroid)
src/aide/textes.js   bulles d'aide ; src/reglages/ réglages ; src/outils/ utilitaires
tests/               tests Vitest (*.test.js)
android/             app Kotlin ; android/noyau/ = NMEA, MN95/RAN95, NTRIP (avec tests)
exemples/            fichiers de référence (NE PAS modifier ni supprimer)
```

## Commandes
- `npm run dev` : serveur de développement ; `npm run preview -- --port 4173` : aperçu (base `/app-topo/`).
- `npm run build` : site / PWA ; `npm run build:android` : range l'appli dans `android/app/src/main/assets/app-topo`.
- `npm test` : tous les tests (tests dans `tests/`, pas dans `src/`).
- Essais visuels : Playwright (Chromium préinstallé).

## Conventions de code
- Code et commentaires **simples, en français**, noms clairs (`estPoint`, `nordPoint`, `altitude`).
- Coordonnées toujours **Est, Nord, altitude** (sauf à la lecture du LandXML : Nord, Est, altitude). Tout en **MN95**, mètres ; aucune conversion dans l'appli web (l'APK convertit le GNSS en MN95 / RAN95).
- Une fonction de calcul = courte, commentée (rôle, unités m / m² / m³), **avec un test**. Calculs dans `src/topo/`, séparés de l'interface.
- Nombres : point décimal, 3 décimales pour coordonnées et volumes.
- Messages d'erreur compréhensibles (« ligne 12 illisible »), jamais d'échec silencieux.
- Pas de phrases d'explication dans les écrans : l'aide est dans les bulles (`src/aide/textes.js`).
- Noms de points jamais interprétés (le rôle est choisi par l'utilisateur). Noms levés : contour `C-Stock-n-m`, ligne `L-lib-n-m`, point `P-lib-n`, aire `A-lib-n-m`.
- LandXML : triangles par `id` interne, surfaces TIN seulement, inversion Nord/Est à l'import.
- Version dans `package.json` (affichée dans Projet) : l'augmenter à chaque livraison.
- Données sur l'appareil (IndexedDB) ; seule exception : partage Drive, accepté par l'utilisateur. Le mot de passe NTRIP n'est jamais mis dans le projet ni renvoyé à la page.

## Référence de calcul
Levé du 20/05/2026 (affaire 10 203), tolérance **0,5 %** : Stock 1 = 1636.197 m³, Stock 2 = 648.979 m³, Stock 3 = 372.201 m³ (remblai Mensura). Tests automatiques sur ce cas.

## État d'avancement (version 0.58.0)
**Fait**
- Import points (CSV Emlid, TXT), LandXML, DXF (surfaces et fond de plan) ; recalage Helmert d'un plan DXF.
- Surfaces (stock, terrain naturel, terrassement), volumes (remblai / déblai, comparaison), coupes, mesures / métrés.
- Plan : calques, courbes, fonds swisstopo, rotation, menu « Afficher ».
- Exports : CSV, PDF (cartouche), DXF, LandXML.
- Projets locaux + partage Google Drive (verrou, envoi auto).
- APK : levé RX2 (Bluetooth), corrections swipos (NTRIP), contrôle de surface, implantation point / ligne / talus, libellés et couleurs.
- Modes Base / Confirmé (0.57.0, réglages ⚙, étoile ☆ / ★ dans l'en-tête, Confirmé par défaut, retenu par l'appareil). En Base, éléments `.seulement-confirme` cachés et `estModeBase()` dans le code. Base = projets, import points, Drive, point tapé, récepteur, lever « Levé libre » (« autres » dans le code), rôles et libellés existants, implanter point / ligne simple, accroches DXF, contrôle de surface, réglages du guidage, plan (fonds, cadastre, points, noms, altitudes). Tout le reste (onglet Calculs, DXF, talus, NTRIP, libellés à modifier, options de ligne, triangles / courbes…) = Confirmé.
- Terrain (0.57.1) : « Levé en cours » = liste des levés écrits à la couleur de leur nature, « + Nouveau levé » en haut de la liste.
- Réglages protégés par un code (0.58.0, `src/outils/code.js`, code 1196, dans les deux modes) : modification du nom de l'appareil et réglages NTRIP ; redemandé à chaque ouverture de la fenêtre. Le passage Base → Confirmé reste libre. Simple barrière, pas une vraie sécurité ; ne jamais écrire le code dans les bulles d'aide.

**Reste / à valider**
- Essai terrain du talus (0.56.1) et question ouverte : arrondi (cône) aux angles saillants, est-ce voulu ?
- Précision H / V (message GST) à comparer avec Emlid Flow ; vérifier que le RX2 envoie bien du GST.
- DWG non pris en charge (enregistrer en DXF).
- Google Cloud en mode Test (réautorisation environ tous les 7 jours) : publier l'écran de consentement si besoin.
- Pull request n° 35 (0.53.1 à 0.56.1) à fusionner par l'utilisateur.

**À développer**
- Essai de 2 RX2 pour guidage d'engin type grader sur la même tablette (2 NTRIP ? 2 connexions Bluetooth ?).
- Mode « dessin » pour dessiner des plateformes ou bâtiments directement dans l'appli.
- Mode « Contrôle » pour faire des autocontrôles (à préciser avec l'utilisateur avant de coder : quoi contrôler, tolérances, compte rendu ; mode Base ou Confirmé).
