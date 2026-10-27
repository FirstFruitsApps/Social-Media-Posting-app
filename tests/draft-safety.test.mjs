import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSavedDraft, savedDraftIsUnchanged, uploadTargetsCurrentDraft } from '../public/draft-safety.js';

test('save response supplies revision without replacing edits made while saving', () => {
  const target = { title: 'Before', caption: '', mediaIds: [], revision: 2 };
  const submitted = JSON.stringify(target);
  target.caption = 'Typed while request was pending';
  const state = mergeSavedDraft(target, target, submitted, {
    id: 'post-1', revision: 3, title: 'Before', caption: '', mediaIds: [],
    created_at: '2026-10-26T12:00:00Z', updated_at: '2026-10-26T12:00:00Z',
  });
  assert.equal(state.draft, target);
  assert.equal(target.caption, 'Typed while request was pending');
  assert.equal(target.id, 'post-1');
  assert.equal(target.revision, 3);
  assert.equal(state.dirty, true);
  assert.equal(state.unchanged, false);
});

test('unchanged save response adopts normalized server data and clears dirty state', () => {
  const target = { title: 'Post', caption: 'Copy', mediaIds: [], revision: 2 };
  const submitted = JSON.stringify(target);
  const result = { ...target, title: 'Post', id: 'post-1', revision: 3 };
  const state = mergeSavedDraft(target, target, submitted, result);
  assert.equal(state.draft.id, 'post-1');
  assert.equal(state.draft.revision, 3);
  assert.equal(state.dirty, false);
  assert.equal(state.unchanged, true);
});

test('save completion for an old draft cannot replace the current draft', () => {
  const oldDraft = { title: 'Old' };
  const newDraft = { title: 'New' };
  const state = mergeSavedDraft(newDraft, oldDraft, JSON.stringify(oldDraft), { id: 'old-1' });
  assert.equal(state.draft, newDraft);
  assert.equal(state.dirty, null);
  assert.equal(oldDraft.id, undefined);
});

test('an upload attaches only to the draft that started it', () => {
  const original = { title: 'Original' };
  assert.equal(uploadTargetsCurrentDraft(original, original), true);
  assert.equal(uploadTargetsCurrentDraft(original, { title: 'New' }), false);
  assert.equal(uploadTargetsCurrentDraft(null, original), false);
});

test('review proceeds only while the exact saved draft remains unchanged', () => {
  const saved = { title: 'Post', caption: 'Reviewed copy' };
  const snapshot = JSON.stringify(saved);
  assert.equal(savedDraftIsUnchanged(saved, saved, snapshot, false), true);
  saved.caption = 'Edited during refresh';
  assert.equal(savedDraftIsUnchanged(saved, saved, snapshot, true), false);
  assert.equal(savedDraftIsUnchanged({ ...saved }, saved, snapshot, false), false);
});
