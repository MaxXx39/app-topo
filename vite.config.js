// Configuration de Vite (l'outil qui assemble l'application web).
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Adresse du site sur GitHub Pages : https://maxxx39.github.io/app-topo/
  base: '/app-topo/',
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
        name: 'Topo - Volumes de stocks',
        short_name: 'Topo',
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
