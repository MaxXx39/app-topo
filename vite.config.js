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
      manifest: {
        name: 'Topo - Volumes de stocks',
        short_name: 'Topo',
        description: 'Calcul de volumes de stocks à partir de points GNSS',
        lang: 'fr',
        theme_color: '#14532d',
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
