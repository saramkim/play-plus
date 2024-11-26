import './style.css';

async function init() {
  await loadTemplates();
  await loadContent('setting');
}

async function loadTemplates() {
  const response = await fetch('template.html');
  const text = await response.text();
  document.body.insertAdjacentHTML('beforeend', text);
}

async function loadContent(name: string) {
  const response = await fetch(`${name}.html`);
  const html = await response.text();

  document.getElementById('content-container')!.innerHTML = html;
  initializeI18n();

  const existingScript = document.getElementById('dynamic-script');
  if (existingScript) existingScript.remove();

  const script = document.createElement('script');
  script.src = `${name}.js`;
  script.id = 'dynamic-script';
  document.body.appendChild(script);
}

function initializeI18n() {
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const messageKey = element.getAttribute('data-i18n') as string;
    const message = chrome.i18n.getMessage(messageKey);
    if (element.tagName === 'TITLE') document.title = message;
    else element.textContent = message;
  });
}

document.addEventListener('DOMContentLoaded', init);
