export function mergeSavedDraft(current, target, submitted, result) {
  if (current !== target) return { draft: current, dirty: null, unchanged: false };
  if (JSON.stringify(target) === submitted) {
    return { draft: { ...result }, dirty: false, unchanged: true };
  }
  for (const key of ['id', 'revision', 'created_at', 'updated_at']) {
    if (result[key] !== undefined) target[key] = result[key];
  }
  return { draft: target, dirty: true, unchanged: false };
}

export function uploadTargetsCurrentDraft(target, currentDraft) {
  return target !== null && target === currentDraft;
}

export function savedDraftIsUnchanged(current, savedDraft, savedSnapshot, dirty) {
  return current === savedDraft && JSON.stringify(current) === savedSnapshot && !dirty;
}
