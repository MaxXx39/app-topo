// Petites icônes dessinées (0.239.0, harmonisation) : à la place des émojis (🔔 👁 📍 ⌖ ☑), qui changeaient d'un appareil à l'autre.
// Même trait que les autres icônes de l'appli (contour fin, couleur du texte). Classe CSS : .ico-ligne (style.css).
const dessin = (contenu) => `<svg class="ico-ligne" viewBox="0 0 24 24" aria-hidden="true">${contenu}</svg>`;

export const ICONES_LIGNE = {
  cloche: dessin('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21h4" />'),
  clocheBarree: dessin('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21h4" /><path d="M3 3l18 18" />'),
  oeil: dessin('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />'),
  repere: dessin('<path d="M12 21s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" />'),
  viseur: dessin('<circle cx="12" cy="12" r="3" /><path d="M12 2v5M12 17v5M2 12h5M17 12h5" />'),
  caseCochee: dessin('<rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12l3 3 5-6" />'),
  caseVide: dessin('<rect x="4" y="4" width="16" height="16" rx="3" />'),
  // 0.247.0 (audit, lot 6) : à la place de 📱 ☁ 📁 🔒 📷.
  tablette: dessin('<rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M11 18.5h2" />'),
  nuage: dessin('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1-.5 7.5z" />'),
  dossier: dessin('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />'),
  cadenas: dessin('<rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />'),
  photo: dessin('<path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />'),
};
