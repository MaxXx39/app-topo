// Point de départ de l'application : ce fichier construit la page.
import './style.css';
import { formaterNombre } from './topo/format.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <p>L'application est en place. Les fonctionnalités arrivent étape par étape.</p>
  <p class="version">Version 0.1.0 - exemple d'affichage : ${formaterNombre(1636.1966)} m³</p>
`;
