import { migrateLegacyStorage } from '@storage/migration';

const handleInstalled = async (details: chrome.runtime.InstalledDetails) => {
  if (details.reason !== chrome.runtime.OnInstalledReason.UPDATE) return;

  console.log('Extension updated. Starting legacy storage migration...');
  try {
    const results = await migrateLegacyStorage();
    if (results.some((result) => result)) console.log('Legacy storage migration completed successfully.');
    else console.log('No legacy storage found.');
  } catch (error) {
    console.error('Error during legacy storage migration:', error);
  }
};

export const registerRuntimeEvents = () => {
  chrome.runtime.onInstalled.addListener((details) => {
    void handleInstalled(details);
  });

  chrome.runtime.getPlatformInfo((info) => {
    const isAndroid = info.os === 'android';

    void chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: !isAndroid })
      .catch((error) => console.error('Error setting panel behavior:', error));

    if (!isAndroid) return;
    chrome.action.onClicked.addListener((tab) => {
      if (tab.id === undefined) return;
      void chrome.tabs
        .create({ url: chrome.runtime.getURL('index.html'), active: true })
        .catch((error) => console.error('Error opening extension page:', error));
    });
  });
};
