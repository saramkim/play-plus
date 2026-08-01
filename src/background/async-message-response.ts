type BackgroundMessageResponse = { success: true } | { success: false; message: string };

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

export const respondToAsyncMessage = (
  sendResponse: (response: BackgroundMessageResponse) => void,
  task: () => Promise<void>
) => {
  void Promise.resolve()
    .then(task)
    .then(() => sendResponse({ success: true }))
    .catch((error: unknown) => sendResponse({ success: false, message: getErrorMessage(error) }));

  return true as const;
};
