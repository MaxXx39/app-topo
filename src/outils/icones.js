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
};
