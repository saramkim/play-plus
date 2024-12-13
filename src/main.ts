import './style.css';
import App from './App';

async function init() {
  await loadTemplates();
  new App(document.getElementById('app')!);
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

document.addEventListener('DOMContentLoaded', init);
