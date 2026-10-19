# CLAUDE.md - Application topo (PWA personnelle)

Ce fichier est lu par Claude Code au début de chaque session. Il décrit le projet, la personne avec qui tu travailles et tes règles de travail. Le cahier des charges complet est dans le document « Cahier des charges - Application topo V1 (volumes de stocks) » ; ce fichier en reprend l'essentiel.

## 1. Qui est l'utilisateur et comment travailler avec lui

- Géomètre topo / projeteur dans une entreprise de gros œuvre (bâtiment / génie civil), en Suisse. Il construit cette application seul, pour son usage personnel.
- **Il est débutant en développement.** Explique simplement, sans jargon, par petites étapes. Si un terme technique est nécessaire, définis-le en une phrase.
- **Tout se fait sur le web**, rien n'est installé sur son ordinateur (Windows). Le code est écrit et testé par Claude Code dans le cloud, gardé sur GitHub et publié par GitHub Pages. L'utilisateur n'utilise que son navigateur (ordinateur ou téléphone).
- Réponds toujours **en français**. L'interface de l'appli est aussi en français.
- **Pose-lui des questions avant de décider** d'un point important ou ambigu.
- Propose des solutions **simples et très répandues**. Pas de technologie exotique.
- **Ne devine jamais une formule ou une norme de topographie.** Si tu n'es pas sûr, dis-le et demande-lui de valider.
- Une seule fonctionnalité à la fois. Après chaque fonctionnalité : lance les tests, explique ce qui marche, dis-lui comment l'essayer lui-même, puis attends son accord avant la suivante.

## 2. But de l'application

Calculer le volume de stocks de terre à partir de points levés au GNSS, sur téléphone et ordinateur. Version 1 = « volumes de stocks ». Rien d'autre en V1.

Matériel et logiciels de l'utilisateur : GNSS Emlid RX2 et RS4 (levé avec Emlid Flow), station totale Leica iCON 70, Mensura, Excel.

## 3. Données et conventions

- Tout est en **MN95** (système suisse), en mètres. **Aucune conversion** de coordonnées ni d'altitude en V1.
- Système d'altitude (RAN95 ou NF02) : **non confirmé**. Ne rien supposer, demander si cela devient utile.
- Les noms de points ne suivent **aucune règle fixe** (« b », « h » ou autre). Ne jamais déduire le rôle d'un point de son nom : c'est l'utilisateur qui choisit.

Formats à lire :

| Format | Contenu | Ordre des coordonnées |
| --- | --- | --- |
| CSV Emlid | 41 colonnes par point. Utiliser au minimum : Name, Easting, Northing, Elevation | Est, Nord, altitude |
| TXT | Séparé par tabulations : nom, Est, Nord, altitude | Est, Nord, altitude |
| LandXML 1.1 (export Mensura) | Surface TIN : points, triangles, lignes de rupture, contour | **Nord, Est, altitude** |

Pièges du LandXML :
- Les triangles (`<F>`) désignent les points par leur **numéro interne `id`**, pas par leur position dans la liste.
- Un fichier peut contenir plusieurs surfaces : l'utilisateur choisit.
- Ne prendre que les surfaces de type TIN.
- Attention à l'inversion Nord/Est entre le LandXML et les fichiers CSV/TXT. Toujours convertir vers « Est, Nord, altitude » à l'import.

## 4. Fonctionnalités de la V1

1. **Importer** les points (CSV Emlid ou TXT). Afficher le nombre de points lus et signaler les lignes illisibles avec leur numéro. Accepter plusieurs stocks dans un fichier.
2. **Choisir les points et leurs rôles**, par stock, sans règle de nom :
   - *Contour* : points du bord du stock, dans un ordre choisi, polygone fermé automatiquement.
   - *Surface de base* : points du pied.
   - *Lignes de rupture* : points du haut et des arêtes.
   - Trois méthodes de sélection : plage de noms (ex. « b100 à b116 »), cases à cocher, toucher les points sur le plan.
3. **Calculer le volume**, à l'intérieur du contour, y compris pour les formes concaves (en « L ») :
   - *Mode A, base mesurée* : surface de base (points du pied) comparée à la surface formée par tous les points, lignes de rupture comprises.
   - *Mode B, base LandXML* : une surface importée remplace la surface de base.
   - Résultat par stock : surface en plan, volume de remblai et volume de déblai (séparés). Afficher aussi des valeurs intermédiaires : nombre de triangles, volume au-dessus et au-dessous.
   - Si le LandXML ne couvre pas tout le contour : avertir et indiquer la surface non couverte.
4. **Importer un LandXML** (voir pièges ci-dessus).
5. **Afficher le plan** : points avec leur nom, contour, triangles, zoom et déplacement au doigt.
6. **Exporter** : un CSV (stock, surface, remblai, déblai) et un PDF (plan + volumes + cartouche simple : affaire, date, dessiné par).

Hors V1 (ne pas construire sans demande) : Google Drive, levé direct avec l'Emlid, contrôle de qualité des points, profils, implantation.

## 5. Vérification : cas de référence

L'utilisateur compare lui-même avec Mensura. Tolérance : **0,5 %**. Fichiers d'exemple à placer dans le dossier `exemples/` : `stock.csv`, `stock_export.txt`, le PDF Mensura et un LandXML.

Levé du 20/05/2026 (affaire 10 203), 115 points, 3 stocks, volumes de remblai Mensura :

| Stock | Points (dans stock_export.txt) | Volume Mensura (m³) | Écart accepté (± m³) |
| --- | --- | --- | --- |
| Stock 1 | b1 à b17 et h1 à h31 | 1636.197 | 8,2 |
| Stock 2 | b100 à b116 et h100 à h114 | 648.979 | 3,2 |
| Stock 3 | b200 à b217 et h200 à h216 | 372.201 | 1,9 |

Dans cet exemple, le contour et la surface de base sont les points « b » du stock. Ce n'est pas une règle de l'appli.

- Le LandXML d'exemple « 3D SUR Tapis AC11 » ne recouvre pas ces stocks (altitudes 474 à 484 m contre environ 427 m). Il sert à tester la **lecture** du format. Pour tester le mode B, il faut un LandXML qui recouvre un stock : le demander.
- **Méthode de calcul du volume** : ne pas choisir seul. Présenter les options en mots simples, recommander une méthode, et la faire valider par l'utilisateur sur ce cas de référence avant d'aller plus loin. La triangulation doit respecter le contour et les lignes de rupture (stocks 1 et 3 en forme de « L »).
- Écrire des tests automatiques sur ce cas de référence dès que la méthode est validée.

## 6. Choix techniques (par défaut, à valider avec l'utilisateur)

Rester sur des outils très répandus :

- Application web en **JavaScript**, avec **Vite**, sans framework lourd au début.
- **PWA** (installable sur téléphone et ordinateur) : plugin `vite-plugin-pwa`.
- Calculs de topo dans des fichiers séparés de l'interface, faciles à tester.
- Tests avec **Vitest**.
- Plan dessiné en SVG ou canvas, sans carte de fond en V1.
- PDF avec une bibliothèque courante (ex. jsPDF).
- Triangulation avec contraintes (contour, lignes de rupture) : proposer une bibliothèque existante plutôt que l'écrire soi-même, et expliquer le choix.
- Les données de l'utilisateur **restent sur son appareil** (pas de serveur, pas de compte).
- Hébergement gratuit avec **GitHub Pages**, pour ouvrir l'appli sur le téléphone et l'installer.

Avant d'ajouter une bibliothèque : dire ce qu'elle fait, pourquoi elle est nécessaire, et demander l'accord.

## 7. Git et GitHub

L'utilisateur n'a pas l'habitude de Git ni de GitHub. Explique chaque notion en une phrase la première fois :
- **Git** : un historique du projet, pour pouvoir revenir en arrière.
- **GitHub** : un site qui garde une copie du projet et peut le publier gratuitement sur une adresse web.

Guide-le pas à pas pour : activer GitHub Pages, valider les modifications (pull request) sur github.com, puis installer l'appli sur son téléphone. Ne fais jamais de publication ni d'envoi vers GitHub sans qu'il l'ait demandé. Ne lui demande jamais son mot de passe ni de jeton dans le chat : il les saisit lui-même.

Fais un « commit » (une sauvegarde dans l'historique) après chaque fonctionnalité qui marche, avec un message clair en français.

## 8. Règles de code

- Code et commentaires simples, en français, pour qu'un débutant puisse relire.
- Noms de variables clairs (`estPoint`, `nordPoint`, `altitude`...). Toujours écrire les coordonnées dans l'ordre Est, Nord, altitude dans le code, sauf à la lecture du LandXML.
- Chaque calcul de topo : une fonction courte, avec un commentaire qui dit ce qu'elle fait, ses unités (mètres, m², m³) et un test.
- Afficher les nombres avec 3 décimales pour les coordonnées et les volumes, comme dans Mensura. Séparateur décimal : le point.
- Messages d'erreur compréhensibles pour l'utilisateur (« ligne 12 illisible »), jamais de plantage silencieux.
- Ne pas modifier ni supprimer les fichiers du dossier `exemples/`.
- En fin de tâche : dire en deux ou trois phrases ce qui a été fait, comment le tester, et proposer la suite.
