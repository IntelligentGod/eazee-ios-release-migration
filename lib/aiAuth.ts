export const AI_AUTH_REQUIRED_MESSAGE = 'Sign in to use AI features.';

export class AiAuthRequiredError extends Error {
  constructor() {
    super(AI_AUTH_REQUIRED_MESSAGE);
    this.name = 'AiAuthRequiredError';
  }
}

export const createAiAuthRequiredError = () => new AiAuthRequiredError();

export const isAiAuthRequiredError = (error: unknown) => {
  const message = String((error as any)?.message || error || '');
  return error instanceof AiAuthRequiredError ||
    message === AI_AUTH_REQUIRED_MESSAGE ||
    message === 'Authentication required';
};

export const getAiResponseErrorMessage = (
  payload: any,
  status: number,
  fallback?: string
) => status === 401
  ? AI_AUTH_REQUIRED_MESSAGE
  : String(payload?.error || payload?.message || fallback || `HTTP ${status}`);
