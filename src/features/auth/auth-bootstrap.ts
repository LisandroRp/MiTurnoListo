type BootstrapWorkspaceDecisionInput = {
  bootstrappedUserId: string | null;
  hasPasswordRecoverySession: boolean;
  sessionUserId: string;
};

type BootstrapLoadingDecisionInput = {
  currentStatus: string;
  currentUserId: string | null;
  sessionUserId: string;
};

type WorkspaceRepairDecisionInput = {
  didAttemptWorkspaceRepair: boolean;
  isRecoverableLoadError: boolean;
};

export function shouldBootstrapWorkspaceForSession({
  bootstrappedUserId,
  hasPasswordRecoverySession,
  sessionUserId
}: BootstrapWorkspaceDecisionInput) {
  return !hasPasswordRecoverySession && bootstrappedUserId !== sessionUserId;
}

export function shouldShowBootstrapLoading({
  currentStatus,
  currentUserId,
  sessionUserId
}: BootstrapLoadingDecisionInput) {
  return currentStatus !== "authenticated" || currentUserId !== sessionUserId;
}

export function shouldRepairWorkspaceAfterSnapshotError({
  didAttemptWorkspaceRepair,
  isRecoverableLoadError
}: WorkspaceRepairDecisionInput) {
  return isRecoverableLoadError && !didAttemptWorkspaceRepair;
}
