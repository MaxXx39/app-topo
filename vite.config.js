// Configuration de Vite (l'outil qui assemble l'application web).
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Le même code sert à l'appli (projet GitHub « app-topo ») et à la version de test V2
// (projet « app_topo_v2 ») : la publication (.github/workflows/publier.yml) donne l'adresse
// et le titre. Sans rien préciser, ce sont ceux de l'appli habituelle.
const CHEMIN = process.env.CHEMIN_APPLI || '/app-topo/';
process.env.VITE_TITRE_APPLI ||= 'Topo';
const TITRE = process.env.VITE_TITRE_APPLI;

export default defineConfig({
  // Adresse du site sur GitHub Pages : https://maxxx39.github.io/app-topo/ (ou app_topo_v2)
  base: CHEMIN,
  plugins: [
    // Rend l'application installable sur téléphone et ordinateur (PWA),
    // et utilisable sans connexion une fois installée.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone.svg', 'apple-touch-icon.png'],
      workbox: {
        // Fichiers gardés sur l'appareil pour marcher sans connexion (dont le logo Perrin).
        globPatterns: ['**/*.{js,css,html,svg,png,jpg}'],
        // La lecture des photos HEIC (bibliothèque heic-to) pèse environ 3 Mo : on la garde
        // quand même sur l'appareil, pour ajouter des photos sans connexion sur le chantier.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: `${TITRE} - Volumes de stocks`,
        short_name: TITRE,
        description: 'Calcul de volumes de stocks à partir de points GNSS',
        lang: 'fr',
        theme_color: '#1b2b36',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    // Les tests automatiques sont dans le dossier "tests".
    include: ['tests/**/*.test.js'],
  },
});
