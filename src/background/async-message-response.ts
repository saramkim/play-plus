import { AsyncMessageResponse } from '@utils/message';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

interface ErrorDetails<E> {
  code: E;
  message: string;
}

export const respondToAsyncMessage = <T, E = never>(
  sendResponse: (response: AsyncMessageResponse<T, E>) => void,
  task: () => Promise<T>,
  getErrorDetails?: (error: unknown) => ErrorDetails<E>
) => {
  void Promise.resolve()
    .then(task)
    .then((data) => {
      const response = data === undefined ? { success: true } : { success: true, data };
      sendResponse(response as AsyncMessageResponse<T, E>);
    })
    .catch((error: unknown) => {
      const details = getErrorDetails?.(error);
      const response = details
        ? { success: false, message: details.message, code: details.code }
        : { success: false, message: getErrorMessage(error) };
      sendResponse(response as AsyncMessageResponse<T, E>);
    });

  return true as const;
};
