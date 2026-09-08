import type { Note, NoteFieldKey, FieldVersions } from '../domain/types';
import { noteVersion } from '../domain/types';

export interface RemoteRow {
  id: string;
  note: Note;
  fieldVersions: FieldVersions;
  tombstone: boolean;
}

export interface MergeResult {
  next: Note | null;
  changedFields: NoteFieldKey[];
  remoteFieldVersions: FieldVersions;
}

const FIELDS: NoteFieldKey[] = ['title', 'content', 'tags', 'isPinned', 'isArchived', 'isDeleted', 'deletedAt'];

export function mergeLocalAndRemote(local: Note | undefined, remote: RemoteRow): MergeResult {
  if (remote.tombstone) {
    const localV = local ? noteVersion(local) : 0;
    const tombV = Math.max(0, ...Object.values(remote.fieldVersions));
    if (tombV >= localV) {
      return { next: null, changedFields: [], remoteFieldVersions: remote.fieldVersions };
    }
    return { next: local!, changedFields: [], remoteFieldVersions: remote.fieldVersions };
  }

  const lv = local?.fieldVersions ?? {};
  const rv = remote.fieldVersions;
  const merged: Note = local ? { ...local } : { ...remote.note, fieldVersions: {} };
  const changed: NoteFieldKey[] = [];

  for (const f of FIELDS) {
    if (!(f in rv)) continue;
    const a = lv[f] ?? 0;
    const b = rv[f] ?? 0;
    if (b > a) {
      (merged as unknown as Record<NoteFieldKey, unknown>)[f] = (remote.note as unknown as Record<NoteFieldKey, unknown>)[f];
      merged.fieldVersions = { ...(merged.fieldVersions ?? {}), [f]: b };
      changed.push(f);
    }
  }

  merged.updatedAt = Math.max(local?.updatedAt ?? 0, remote.note.updatedAt ?? 0);
  return { next: merged, changedFields: changed, remoteFieldVersions: rv };
}
