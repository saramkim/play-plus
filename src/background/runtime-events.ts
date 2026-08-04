export const registerRuntimeEvents = () => {
  chrome.runtime.getPlatformInfo((info) => {
    const isAndroid = info.os === 'android';

    void chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: !isAndroid })
      .catch(() => console.error('Unable to set side panel behavior'));

    if (!isAndroid) return;
    chrome.action.onClicked.addListener((tab) => {
      if (tab.id === undefined) return;
      void chrome.tabs
        .create({ url: chrome.runtime.getURL('index.html'), active: true })
        .catch(() => console.error('Unable to open the extension page'));
    });
  });
};
