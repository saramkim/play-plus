import './content.css';

import { migrationStateSchema } from '@storage/v2/schema';

import { contentRuntime } from './content-runtime';

const start = () => {
  void contentRuntime.start().catch(() => {
    console.error('Content runtime is waiting for Play Plus data');
  });
};

start();

chrome.storage.local.onChanged.addListener((changes) => {
  const state = changes.migrationState?.newValue;
  if (!state) return;
  const parsed = migrationStateSchema.safeParse(state);
  if (parsed.success && parsed.data.status === 'complete') start();
});
