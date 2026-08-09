export class RegisteredSubtitleRefreshError extends Error {
  public readonly cause?: unknown;

  constructor(cause?: unknown) {
    super('Registered subtitle refresh failed');
    this.name = 'RegisteredSubtitleRefreshError';
    this.cause = cause;
  }
}
