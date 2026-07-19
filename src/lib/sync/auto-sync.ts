export interface AutoSyncContext {
  enabled: boolean;
  authenticated: boolean;
  online: boolean;
  dirty: boolean;
  hasConflict: boolean;
}

export const shouldAutoSync = (context: AutoSyncContext) =>
  context.enabled &&
  context.authenticated &&
  context.online &&
  context.dirty &&
  !context.hasConflict;
