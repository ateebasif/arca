export type ArcaErrorCode =
  | 'ROOT_FOLDER' // tried to rename, move or delete a browser root folder
  | 'INVALID_MOVE' // folder into itself/descendant, or target is not a folder
  | 'NOT_FOUND' // id does not exist
  | 'NOT_A_FOLDER' // parent for create/move is a bookmark, not a folder
  | 'BLOCKED_URL' // javascript:, data: and other schemes Arca never opens
  | 'API'; // the browser API rejected the call

/** Error thrown by the src/lib wrappers. `code` is stable; `message` is for logs. */
export class ArcaError extends Error {
  readonly code: ArcaErrorCode;

  constructor(code: ArcaErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ArcaError';
    this.code = code;
  }
}

/** Runs a browser API call and wraps any rejection in an ArcaError('API'). */
export async function callApi<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ArcaError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new ArcaError('API', `${label} failed: ${detail}`, { cause: error });
  }
}
