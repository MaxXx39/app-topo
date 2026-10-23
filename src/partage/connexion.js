// Connexion au compte Google réservé à l'appli, pour Google Drive (décision du 23.10.2026 :
// outils officiels de Google).
// - Dans l'APK : c'est l'appli Android qui demande l'autorisation (bibliothèque Google « Play
//   services », compte ajouté dans les réglages Android de la tablette) ; elle renvoie un jeton
//   à la page par window.recevoirJetonDrive.
// - Dans un navigateur : script de connexion de Google (« Google Identity Services »), chargé
//   seulement au moment de se connecter ; une petite fenêtre Google s'ouvre.
// On ne demande que l'accès aux fichiers créés par l'appli (« drive.file »).
import { estDansAppliAndroid } from '../android/pont.js';

export const PORTEE_DRIVE = 'https://www.googleapis.com/auth/drive.file';

// Identifiant « client Web » du projet Google Cloud « Topo Perrin » (compte Google de l'appli).
// Ce n'est pas un secret : il est visible dans toute page web qui se connecte à Google.
// Origine autorisée dans Google Cloud : https://maxxx39.github.io (l'appli publiée sur GitHub Pages).
export const ID_CLIENT_WEB = '903433626898-10vnjo1l45nvpmffo6jj6v6091tlbh2o.apps.googleusercontent.com';

/** Vrai si la connexion à Drive est possible ici (APK assez récent, ou navigateur configuré). */
export function connexionPossible() {
  if (estDansAppliAndroid()) return typeof window.AppliAndroid.demanderJetonDrive === 'function';
  return Boolean(ID_CLIENT_WEB);
}

/**
 * Crée la connexion. Renvoie { obtenirJeton(renouveler) } : promesse d'un jeton d'accès à Drive
 * (gardé tant qu'il est valable, environ 1 heure), ou une erreur lisible.
 */
export function creerConnexion() {
  let jeton = null;
  let finValidite = 0;
  let enCours = null;

  async function obtenirJeton(renouveler = false) {
    if (!renouveler && jeton && Date.now() < finValidite) return jeton;
    enCours ??= (estDansAppliAndroid() ? jetonAndroid(renouveler) : jetonNavigateur())
      .then((nouveau) => {
        jeton = nouveau;
        // Jeton Google : valable 1 heure ; on le renouvelle un peu avant.
        finValidite = Date.now() + 50 * 60 * 1000;
        return jeton;
      })
      .finally(() => {
        enCours = null;
      });
    return enCours;
  }

  return { obtenirJeton, oublier: () => (jeton = null) };
}

/** Jeton demandé à l'appli Android (réponse par window.recevoirJetonDrive). */
function jetonAndroid(renouveler) {
  return new Promise((resoudre, rejeter) => {
    window.recevoirJetonDrive = (reponse) => {
      window.recevoirJetonDrive = null;
      if (reponse?.ok && reponse.jeton) resoudre(reponse.jeton);
      else rejeter(new Error(reponse?.raison ?? 'connexion Google impossible'));
    };
    window.AppliAndroid.demanderJetonDrive(Boolean(renouveler));
  });
}

let clientGoogle = null;

/** Jeton demandé dans le navigateur (fenêtre de connexion Google). */
async function jetonNavigateur() {
  if (!ID_CLIENT_WEB) throw new Error('connexion à Google Drive pas encore réglée pour le navigateur');
  await chargerScriptGoogle();
  return new Promise((resoudre, rejeter) => {
    clientGoogle ??= window.google.accounts.oauth2.initTokenClient({ client_id: ID_CLIENT_WEB, scope: PORTEE_DRIVE, callback: () => {} });
    clientGoogle.callback = (reponse) => {
      if (reponse?.access_token) resoudre(reponse.access_token);
      else rejeter(new Error(reponse?.error_description ?? reponse?.error ?? 'connexion Google refusée'));
    };
    clientGoogle.error_callback = (erreur) => rejeter(new Error(erreur?.type === 'popup_closed' ? 'fenêtre de connexion fermée' : 'connexion Google impossible'));
    clientGoogle.requestAccessToken({ prompt: '' });
  });
}

/** Charge le script de connexion de Google (une seule fois). */
function chargerScriptGoogle() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resoudre, rejeter) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resoudre();
    script.onerror = () => rejeter(new Error('script de connexion Google introuvable (internet ?)'));
    document.head.append(script);
  });
}
