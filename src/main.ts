import './style.css';
import { render } from 'lit-html';
import { Header } from './components/Header';

async function init() {
  const header = new Header('setting');

  await loadTemplates();
  render(header.html(), document.getElementById('header')!);
  await header.init();
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

document.addEventListener('DOMContentLoaded', init);
