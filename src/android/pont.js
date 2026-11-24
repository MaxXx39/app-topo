// Pont entre l'appli web et l'appli Android (APK « Topo », dossier android/).
// Dans l'APK, la page tourne dans une fenêtre de navigateur intégrée (WebView) qui ne sait pas
// tout faire seule : l'appli Android lui donne l'objet window.AppliAndroid, avec des fonctions
// écrites en Kotlin (android/app/src/main/java/ch/apptopo/PontAndroid.kt).
// Dans un navigateur normal, cet objet n'existe pas et rien ne change.
// Plus tard, c'est aussi par ici que passera la position du récepteur Emlid (Bluetooth).
import { correctionsTropAnciennes, LIMITE_AGE_CORRECTIONS_S } from '../topo/age-corrections.js';

/** Vrai si la page tourne dans l'APK Android. */
export function estDansAppliAndroid() {
  return typeof window !== 'undefined' && Boolean(window.AppliAndroid);
}

/**
 * Vrai si la page tourne dans l'appli Windows (Topo.exe, dossier windows/Topo) : elle a le même objet
 * window.AppliAndroid que l'APK (fabriqué par windows/Topo/pont-windows.js), donc tout le reste marche pareil.
 */
export function estDansAppliWindows() {
  return estDansAppliAndroid() && window.AppliAndroid.estWindows === true;
}

/**
 * Vrai si la page tourne dans Topo Bureau (0.277.0, windows/TopoBureau : le PC du bureau). Il a aussi window.AppliAndroid
 * (fichiers, Drive, mise à jour) mais ni récepteur ni boutons de tablette : l'appli s'y comporte comme le site PC
 * (applications « site seulement » comme Matériel, main Drive rendue après 5 minutes sans activité…).
 */
export function estDansAppliBureau() {
  return estDansAppliAndroid() && window.AppliAndroid.estBureau === true;
}

/** Windows : télécharge le nouveau Topo.exe, le met à la place de celui qui tourne et relance l'appli. */
export const installerMiseAJourWindows = (adresse) => window.AppliAndroid.installerMiseAJour(adresse);

/** Octets -> texte base64 (pour passer un fichier à Kotlin, qui ne reçoit que du texte). */
export function enBase64(octets) {
  let binaire = '';
  // Par morceaux, pour ne pas dépasser le nombre d'arguments permis par String.fromCharCode.
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000));
  }
  return btoa(binaire);
}

/**
 * Enregistre un fichier par l'appli Android : elle demande où l'enregistrer
 * (Téléchargements, Google Drive…), comme Emlid Stock.
 */
export async function enregistrerDansAndroid(blob, nom) {
  try {
    const octets = new Uint8Array(await blob.arrayBuffer());
    window.AppliAndroid.enregistrerFichier(nom, blob.type || 'application/octet-stream', enBase64(octets));
  } catch (erreur) {
    alert(`Export de « ${nom} » impossible : ${erreur.message ?? erreur}.`);
  }
}

// --- Récepteur Emlid (Bluetooth), lu par l'appli Android ---

/** Vrai si l'appli Android sait lire le récepteur (APK assez récent). */
export function recepteurDisponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.prendrePoint === 'function';
}

/**
 * Appelle "fonction(etat)" à chaque état reçu du récepteur (5 fois par seconde), voir
 * EtatRecepteur.enJson côté Kotlin : { connecte, bluetooth, dernierRecepteur, recu, qualite,
 * libelleQualite, nbSatellites, hdop, ageCorrections, etatInclinaison, inclinaisonPrete,
 * inclinaison, cap (°, orientation du RX2, à confirmer), position: { est, nord, altitude } ou null,
 * precisionH, precisionV (m, message GST du RX2, ou null), pdop (message GSA, 0.220.0, ou null),
 * erreurConversion, autorise, raison }.
 */
export function ecouterRecepteur(fonction) {
  window.recevoirEtatRecepteur = fonction;
}

export const choisirRecepteur = () => window.AppliAndroid.choisirRecepteur();

// --- Laser Leica DISTO en Bluetooth basse consommation (Test laser, 0.270.0) ---

/** Vrai si l'APK sait se connecter au laser (APK 0.270.0 et plus). */
export function laserDisponible() {
  return estDansAppliAndroid() && !window.AppliAndroid.estWindows && typeof window.AppliAndroid.choisirLaser === 'function';
}

export const choisirLaser = () => window.AppliAndroid.choisirLaser();
export const deconnecterLaser = () => window.AppliAndroid.deconnecterLaser();
/** Déclenche une mesure depuis la tablette : vrai si la commande est partie. */
export const mesurerLaser = () => Boolean(window.AppliAndroid.mesurerLaser?.());

/**
 * surEtat({ etat: 'deconnecte' | 'recherche' | 'connexion' | 'connecte', nom, peutMesurer, message }) ;
 * surMesure({ quoi: 'distance' (m) | 'inclinaison' (valeur brute), valeur, heure }).
 */
export function ecouterLaser(surEtat, surMesure) {
  window.recevoirEtatLaser = surEtat;
  window.recevoirMesureLaser = surMesure;
}

// --- Essai à 2 récepteurs (demande du 26.10.2026, mode Expert) : un 2e RX2, même état que le 1er ---

/** Journal NMEA (0.82.0) : vrai si l'APK sait enregistrer tout ce que le RX2 envoie. */
export function journalNmeaDisponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.demarrerJournalNmea === 'function';
}

/** Commence un journal NMEA de "secondes" secondes. */
export const demarrerJournalNmea = (secondes) => window.AppliAndroid.demarrerJournalNmea(secondes);

/** Texte du journal NMEA (une ligne reçue du RX2 par ligne). */
export const lireJournalNmea = () => String(window.AppliAndroid.lireJournalNmea() ?? '');

/** Vrai si l'APK sait connecter un 2e récepteur. */
export function recepteur2Disponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.choisirRecepteur2 === 'function';
}

/**
 * Appelle "fonction(etat, mode)" à chaque état du 2e récepteur (même forme que ecouterRecepteur) ;
 * mode : façon dont il reçoit ses corrections ('copie' ou 'ntrip', retenue sur la tablette).
 */
export function ecouterRecepteur2(fonction) {
  window.recevoirEtatRecepteur2 = fonction;
}

/**
 * Appelle "fonction(position)" avec la position du GPS de la tablette quand aucun RX2 n'est
 * connecté (environ 5 fois par seconde) : { est, nord, precision (m) } en MN95, ou null.
 * Seulement pour se localiser sur le plan (jamais pour un point, une implantation ou un guidage).
 */
export function ecouterPositionTablette(fonction) {
  window.recevoirPositionTablette = fonction;
}

export const choisirRecepteur2 = () => window.AppliAndroid.choisirRecepteur2();
export const deconnecterRecepteur2 = () => window.AppliAndroid.deconnecterRecepteur2();

/** Corrections du 2e récepteur : 'copie' (copie de celles du 1er) ou 'ntrip' (sa propre connexion). */
export const choisirModeCorrections2 = (mode) => window.AppliAndroid.choisirModeCorrections2(mode);

/** Réglages NTRIP du 2e récepteur (même forme que lireReglagesCorrections), ou null. */
export function lireReglagesCorrections2() {
  try {
    return JSON.parse(window.AppliAndroid.lireReglagesCorrections2());
  } catch {
    return null;
  }
}

export const demarrerCorrections2 = (reglages) => window.AppliAndroid.demarrerCorrections2(JSON.stringify(reglages));
export const arreterCorrections2 = () => window.AppliAndroid.arreterCorrections2();
export const reconnecterRecepteur = () => window.AppliAndroid.reconnecterRecepteur();
export const deconnecterRecepteur = () => window.AppliAndroid.deconnecterRecepteur();

/**
 * Point à prendre maintenant (MN95 / RAN95), vérifié par l'appli Android : RTK fixe et
 * inclinaison prête. Renvoie { ok: true, point } ou { ok: false, raison }.
 */
let pointPrepare = null; // 0.214.0 : point moyen d'une mesure de durée, remis une seule fois au prochain « prendre un point »

/** Range le point moyen d'une mesure de durée : le prochain prendrePointRecepteur() le rend (une fois, 3 s au plus). */
export function preparerPointMoyenne(point) {
  pointPrepare = { point, jusqua: Date.now() + 3000 };
}

/** Vrai si un point moyen est prêt (le clic qui suit la mesure doit passer sans relancer une mesure). */
export function pointMoyenPret() {
  return Boolean(pointPrepare && Date.now() <= pointPrepare.jusqua);
}

/** Rend le point moyen préparé (une seule fois), ou null : pour les écrans qui lisent la position en direct (Mesure rapide, Annotation). */
export function consommerPointMoyen() {
  if (!pointMoyenPret()) return null;
  const { point } = pointPrepare;
  pointPrepare = null;
  return point;
}

/** Oublie le point moyen préparé (s'il n'a pas servi). */
export function viderPointPrepare() {
  pointPrepare = null;
}

export function prendrePointRecepteur() {
  if (pointMoyenPret()) {
    const { point } = pointPrepare;
    pointPrepare = null;
    return { ok: true, point };
  }
  pointPrepare = null;
  return lirePointRecepteur();
}

/** Une lecture du récepteur, vérifiée (RTK fixe, inclinaison prête, corrections de moins de 2 s) : { ok, point } ou { ok: false, raison }. */
export function lirePointRecepteur() {
  try {
    const reponse = JSON.parse(window.AppliAndroid.prendrePoint());
    // 0.213.0 : corrections NTRIP de plus de 2 s : le point est refusé (partout : Lever, Implanter, Contrôle, Annotation…).
    const age = reponse?.point?.ageCorrections;
    if (reponse?.ok && correctionsTropAnciennes(age)) {
      return { ok: false, raison: `corrections trop anciennes (${Math.round(age)} s, ${LIMITE_AGE_CORRECTIONS_S} s au plus)` };
    }
    return reponse;
  } catch (erreur) {
    return { ok: false, raison: `réponse illisible du récepteur (${erreur.message})` };
  }
}

/**
 * Touche « volume − » de la tablette : si "actif", elle appelle "fonction()" au lieu de baisser
 * le volume (onglet Terrain, mode Lever). Sans effet avec un APK plus ancien.
 */
export function regleToucheVolume(actif, fonction) {
  window.toucheVolumeBas = fonction;
  if (typeof window.AppliAndroid?.activerToucheVolume === 'function') window.AppliAndroid.activerToucheVolume(Boolean(actif));
}

// --- Corrections RTK par internet (swipos), sans Emlid Flow ---

/** Vrai si l'appli Android sait recevoir les corrections elle-même (APK assez récent). */
export function correctionsDisponibles() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.demarrerCorrections === 'function';
}

/**
 * Réglages enregistrés sur la tablette : { hote, port, pointDeMontage, utilisateur,
 * motDePasseEnregistre, actives } (le mot de passe ne revient jamais dans la page), ou null.
 */
export function lireReglagesCorrections() {
  try {
    return JSON.parse(window.AppliAndroid.lireReglagesCorrections());
  } catch {
    return null;
  }
}

/** Démarre les corrections : { hote, port, pointDeMontage, utilisateur, motDePasse ('' = garder l'ancien) }. */
export const demarrerCorrections = (reglages) => window.AppliAndroid.demarrerCorrections(JSON.stringify(reglages));
export const arreterCorrections = () => window.AppliAndroid.arreterCorrections();

// --- Lecture d'une adresse par l'appli Android (0.112.5, cadastre) : sans la protection CORS du
// navigateur (le service RDPPF de Vaud n'autorise pas les autres sites). Côté Android :
// PontAndroid.lireAdresse, seulement vers rdppf.vd.ch et geodienste.ch.
let numeroDemande = 0;
const demandesEnCours = new Map();

/** Vrai si l'appli Android sait lire une adresse elle-même. */
export function lectureAndroidDisponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.lireAdresse === 'function';
}

/**
 * Comme fetch(adresse), mais par l'appli Android : promesse d'un objet { ok, status, text() }.
 * Échec (réseau, adresse refusée, 60 s sans réponse) : erreur comme fetch.
 */
export function lireParAndroid(adresse) {
  if (!window.recevoirAdresse) {
    window.recevoirAdresse = (numero, reponse) => {
      const demande = demandesEnCours.get(numero);
      if (!demande) return;
      demandesEnCours.delete(numero);
      clearTimeout(demande.minuterie);
      if (reponse?.erreur) demande.rater(new Error(reponse.erreur));
      else demande.tenir({ ok: Boolean(reponse.ok), status: reponse.statut, text: async () => String(reponse.texte ?? '') });
    };
  }
  return new Promise((tenir, rater) => {
    const numero = ++numeroDemande;
    const minuterie = setTimeout(() => {
      demandesEnCours.delete(numero);
      rater(new Error('pas de réponse en 60 s'));
    }, 60000);
    demandesEnCours.set(numero, { tenir, rater, minuterie });
    window.AppliAndroid.lireAdresse(numero, adresse);
  });
}

// --- Partage d'écran (0.136.1) : ouvre AnyDesk (installé sur la tablette) pour que le bureau voie
// l'écran et prenne la main. Côté Android : PontAndroid.ouvrirAnydesk.

/** Vrai si cet APK sait ouvrir AnyDesk (un ancien APK n'a pas la fonction). */
export function anydeskDisponible() {
  return estDansAppliAndroid() && typeof window.AppliAndroid.ouvrirAnydesk === 'function';
}

/** Ouvre AnyDesk ; s'il n'est pas installé, Android propose de l'installer. */
export const ouvrirAnydesk = () => window.AppliAndroid.ouvrirAnydesk();

// --- Boutons + / − de la tablette Windows (0.266.0) : changer de programme (Alt+Tab), voir windows/Topo/BoutonsTablette.cs ---

/** Vrai si l'appli Windows sait écouter les boutons de la tablette. */
export const boutonsTabletteDisponibles = () => estDansAppliWindows() && typeof window.AppliAndroid.apprendreBouton === 'function';

/** 'plus' ou 'moins' : le prochain bouton appuyé est retenu ; 'oublier' : plus aucun ; 'annuler' : arrête d'apprendre. */
export const apprendreBoutonTablette = (quoi) => window.AppliAndroid.apprendreBouton(quoi);

/** État des boutons : { plus (code ou 0), moins, apprend ('plus' / 'moins' / ''), erreur }. */
export function etatBoutonsTablette() {
  try {
    return JSON.parse(window.AppliAndroid.lireBoutonsTablette() || '{}');
  } catch {
    return {};
  }
}

/** Appelle "fonction(etat)" à chaque changement (bouton appris, erreur). */
export function ecouterBoutonsTablette(fonction) {
  window.recevoirBoutonsTablette = fonction;
}

// --- Topo Bureau : plans DWG par ODA File Converter (0.280.0, calage de plans) ---

/** Vrai dans Topo Bureau quand le programme sait convertir des DWG (ODA File Converter, installé sur le PC). */
export function peutConvertirDwg() {
  // 0.308.0 : Topo Bureau et Topo Tablette (calage complet sur la tablette Windows).
  return (estDansAppliBureau() || estDansAppliWindows()) && typeof window.AppliAndroid.choisirDwg === 'function';
}

let numeroDwg = 0;
const conversionsEnCours = new Map();

/**
 * Topo Bureau : ouvre la fenêtre Windows « Plan DWG / DXF et ses xrefs », convertit les DWG en DXF par ODA File
 * Converter (les xrefs trouvés à côté du plan sont convertis aussi) et renvoie [{ nom, octets (Uint8Array, DXF) }].
 * [] si l'utilisateur ferme la fenêtre ; erreur compréhensible sinon (ODA introuvable, conversion ratée…).
 */
export function choisirDwgBureau() {
  if (!window.recevoirConversionDwg) {
    window.recevoirConversionDwg = (numero, reponse) => {
      const demande = conversionsEnCours.get(numero);
      if (!demande) return;
      conversionsEnCours.delete(numero);
      demande(reponse);
    };
  }
  return new Promise((tenir, rater) => {
    const numero = ++numeroDwg;
    conversionsEnCours.set(numero, async (reponse) => {
      try {
        if (reponse?.erreur) throw new Error(reponse.erreur);
        // Les DXF convertis sont servis par le programme à une adresse à part (pas de gros texte dans un message).
        const fichiers = [];
        for (const f of reponse?.fichiers ?? []) {
          const recu = await fetch(f.adresse);
          if (!recu.ok) throw new Error(`fichier converti illisible : ${f.nom}`);
          fichiers.push({ nom: f.nom, octets: new Uint8Array(await recu.arrayBuffer()), xrefTrouve: Boolean(f.xrefTrouve) });
        }
        tenir(fichiers);
      } catch (erreur) {
        rater(erreur);
      }
    });
    window.AppliAndroid.choisirDwg(numero);
  });
}
