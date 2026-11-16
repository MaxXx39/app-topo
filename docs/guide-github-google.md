# Guide : GitHub et Google pour l'appli Topo

Écrit le 16.11.2026 (version 0.249.0), pour toi, géomètre, sans connaissance en développement.
Ce guide dit **ce qui est branché aujourd'hui**, **comment le paramétrer**, et **comment déménager le dépôt GitHub vers un compte pro** sans casser l'appli.

> Les noms de menus de GitHub et de Google changent de temps en temps : si un bouton n'est pas exactement là où c'est écrit, cherche son nom dans la page. Les adresses écrites dans le code, elles, sont vérifiées.

## 1. Les trois services, en deux phrases chacun

- **GitHub** : garde le code de l'appli (le « dépôt » `MaxXx39/app-topo`), met le site en ligne (GitHub Pages), et fabrique tout seul l'APK Android et le `Topo.exe` Windows (GitHub Actions) qu'il range dans « Releases ».
- **Google Cloud** : donne à l'appli le droit de parler à ton Google Drive (partage de projets). Il ne garde aucune donnée : il fournit seulement un « identifiant d'application » (client OAuth).
- **Cloudflare** (petit relais du cadastre Vaud) : il passe les demandes du site internet vers le service de Vaud. Il est indépendant de GitHub et de Google ; tu n'as rien à y changer en déménageant.

## 2. Où l'adresse GitHub est écrite dans l'appli

Si le dépôt change de compte, ces endroits doivent suivre (voir la partie 5) :

| Où | Quoi | Pourquoi |
|---|---|---|
| `src/outils/mise-a-jour.js` | 4 adresses `github.com/MaxXx39/app-topo/...` (APK, EXE, et leurs « releases ») | « Chercher une mise à jour » dans Réglages |
| `windows/Topo/MiseAJour.cs` | `DEBUT_AUTORISE` | l'appli Windows n'accepte de télécharger que depuis cette adresse (sécurité) |
| `windows/Topo.Tests/Tests.cs` | 2 adresses d'essai | tests de ce qui précède |
| `src/partage/connexion.js` | commentaire sur l'origine Google | seulement un rappel |
| `vite.config.js` | `base: '/app-topo/'` | **le nom du dépôt** doit rester `app-topo`, sinon changer cette ligne |
| `.github/workflows/*.yml` | adresses dans les commentaires | seulement un rappel |
| `public/confidentialite.html` | page de confidentialité demandée par Google | son adresse est donnée dans Google Cloud |

L'adresse `https://topo.appli/app-topo/` de l'appli Windows est **fictive et interne** : ne la change jamais.

## 3. Paramétrer GitHub (état actuel)

1. **Le dépôt** : `MaxXx39/app-topo`. La branche `main` = ce qui est publié. La branche de travail (`claude/…`) = ce qui est en cours d'essai.
2. **GitHub Pages** (le site web) : dépôt › *Settings* › *Pages* › *Source* = **GitHub Actions**. Le site est alors à `https://maxxx39.github.io/app-topo/`. Il est reconstruit à chaque fusion dans `main` (fichier `.github/workflows/publier.yml`).
3. **Droits des Actions** : les fichiers de fabrication demandent déjà eux-mêmes le droit d'écrire dans « Releases ». Si une fabrication échoue avec une erreur de droits (surtout sur un compte d'organisation), vérifier dépôt › *Settings* › *Actions* › *General* › *Workflow permissions* = **Read and write permissions**.
4. **Secrets** (dépôt › *Settings* › *Secrets and variables* › *Actions*) : seulement pour l'appli Windows, deux secrets que **toi seul** crées : `GOOGLE_BUREAU_ID` et `GOOGLE_BUREAU_SECRET` (voir la partie 4, client « Bureau »). Sans eux, `Topo.exe` se fabrique quand même, mais sans la connexion à Drive.
5. **Releases** : créées automatiquement. `apk-derniere-version` (fichier `Topo.apk`, lien fixe), `windows-derniere-version` (fichier `Topo.exe`), `exe-test-derniere-version` (petit programme d'essai du récepteur).
6. **Clé de signature de l'APK** : le fichier `android/app/cle-signature.jks` est dans le dépôt. **Ne le perds jamais et ne le change pas** : Android refuse de mettre à jour une appli signée avec une autre clé (il faudrait la désinstaller, donc perdre les projets de la tablette).

## 4. Paramétrer Google (état actuel)

Tout se fait sur <https://console.cloud.google.com/>, avec le compte Google de l'appli, dans le projet **« Topo Perrin »**.

1. **API activée** : *APIs et services* › *Bibliothèque* › « Google Drive API » doit être **activée**.
2. **Écran de consentement OAuth** (*Google Auth Platform* ou *APIs et services* › *Écran de consentement*) :
   - type d'utilisateurs : *Externe* ;
   - champ d'accès demandé : un seul, `.../auth/drive.file` (seulement les fichiers créés par l'appli) ;
   - lien de la politique de confidentialité : `https://maxxx39.github.io/app-topo/confidentialite.html` ;
   - **« Publier l'application »** : tant qu'elle est en mode *Test*, Google oblige à se reconnecter environ tous les 7 jours. Publier supprime cette contrainte (à ma connaissance, `drive.file` n'impose pas de vérification lourde par Google : à confirmer dans la console).
3. **Identifiants** (*Identifiants* › *Créer des identifiants* › *ID client OAuth*), trois clients :
   - **Application Web** (le site et la PWA) : *Origines JavaScript autorisées* = `https://maxxx39.github.io` (sans `/app-topo`). Son identifiant est écrit dans `src/partage/connexion.js` (`ID_CLIENT_WEB`) ; ce n'est **pas un secret**.
   - **Android** (l'APK) : nom du package de l'appli + **empreinte SHA-1** de `cle-signature.jks` (la même pour toujours, puisque la clé ne change pas).
   - **Application de bureau** (Windows) : donne l'ID et le secret à mettre dans les deux secrets GitHub `GOOGLE_BUREAU_ID` et `GOOGLE_BUREAU_SECRET` (partie 3, point 4). **Ne les écris jamais dans le chat ni dans le code.**

## 5. Déménager le dépôt vers un autre compte GitHub (pro)

### Avant de commencer (5 minutes, indispensable)

- **Sauvegarde** : dans l'appli, exporte tes projets importants en « Fichier projet (.topo.json) » ou assure-toi qu'ils sont sur Drive.
- **Ce qui est lié à l'adresse du site** : la PWA (le site installé comme une appli) garde ses projets *dans le navigateur, par adresse*. Si l'adresse passe de `maxxx39.github.io` à `nouveau-compte.github.io`, **les projets de la PWA ne suivent pas** : il faut les exporter (ou les avoir sur Drive) et les rouvrir sur la nouvelle adresse. **L'APK Android et `Topo.exe` ne sont pas touchés** (leur adresse interne ne change pas).

### Étape 1 : déplacer le dépôt

Deux façons. **La première est recommandée.**

- **A. Transférer le dépôt** (garde l'historique, les releases et met des redirections automatiques) : ancien compte › dépôt › *Settings* › tout en bas *Danger Zone* › *Transfer ownership*, puis nom du nouveau compte ou de l'organisation. Le nouveau compte doit accepter.
- **B. Copier le dépôt** (l'ancien reste en place) : sur le nouveau compte, créer un dépôt vide `app-topo`, puis depuis un terminal : `git clone --mirror https://github.com/MaxXx39/app-topo.git`, entrer dans le dossier, `git push --mirror https://github.com/NOUVEAU/app-topo.git`. Les « Releases » ne sont **pas** copiées : elles se recréent à la première fabrication.

Garde **le même nom de dépôt : `app-topo`**. Sinon il faut aussi changer `base` dans `vite.config.js`.

### Étape 2 : réparamétrer le nouveau dépôt (partie 3)

Pages › Source *GitHub Actions* ; droits des Actions si besoin ; recréer les deux secrets Windows. Puis lancer à la main (onglet *Actions*) « Publier sur GitHub Pages » et « Fabriquer l'APK » pour vérifier que tout est vert.

### Étape 3 : changer les adresses dans le code

Dans les fichiers du tableau de la partie 2, remplacer `MaxXx39` par le nouveau compte, et `maxxx39.github.io` par `nouveau-compte.github.io`. **Demande-le-moi** : je le fais en une version, avec les tests, et je te dis quoi essayer.

### Étape 4 : mettre Google Cloud à jour

- Client **Web** : ajouter l'origine `https://nouveau-compte.github.io` (on peut garder l'ancienne quelques semaines).
- Écran de consentement : changer le lien de la politique de confidentialité.
- Les clients **Android** et **Bureau** ne changent pas (même clé, mêmes secrets à recréer dans GitHub).
- Si tu changes aussi de **compte Google** (un compte pro) : il faut recréer un projet Google Cloud avec les trois clients ci-dessus, puis me donner le nouvel ID client Web et, pour le bureau, recréer les deux secrets GitHub. Les fichiers déjà sur l'ancien Drive ne suivent pas tout seuls : ouvre le dossier « App Topo » de l'ancien compte et partage-le avec le nouveau, ou ré-exporte les projets.

### Étape 5 : les appareils déjà installés

- **APK** : « Chercher une mise à jour » interroge l'ancienne adresse GitHub. Avec le *transfer* (A), GitHub redirige : ça marche encore. Avec la copie (B), installe la première APK du nouveau dépôt **à la main** une fois (même clé de signature = les projets restent).
- **Windows** : pareil (`Topo.exe` d'abord récupéré à la main une fois).
- **PWA** : réinstaller à la nouvelle adresse (voir « Avant de commencer »).

### Liste de contrôle finale

- [ ] le site s'ouvre à la nouvelle adresse ;
- [ ] l'onglet *Actions* est vert (tests, site, APK) ;
- [ ] `Topo.apk` se télécharge depuis les nouvelles *Releases* ;
- [ ] Réglages › Drive : connexion possible depuis le site, l'APK et Windows ;
- [ ] « Chercher une mise à jour » trouve la bonne version ;
- [ ] un projet exporté s'ouvre dans la nouvelle PWA.

## 6. Ce que je ne peux pas faire à ta place

Je n'ai pas accès à tes comptes GitHub ni Google : je ne peux ni les créer, ni cliquer dans leurs réglages, ni voir leurs secrets. Je peux préparer les modifications du code, vérifier les listes ci-dessus et te dire quoi cliquer. Ne me donne jamais un mot de passe ni un jeton dans le chat.
