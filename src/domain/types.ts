export type ID = string;

export type NoteFieldKey =
  | 'title'
  | 'content'
  | 'tags'
  | 'isPinned'
  | 'isArchived'
  | 'isDeleted'
  | 'deletedAt';

export type FieldVersions = Partial<Record<NoteFieldKey, number>>;

export interface Note {
  id: ID;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  deletedAt: number | null;
  tags: string[];
  fieldVersions?: FieldVersions;
}

export function noteVersion(n: Note): number {
  const fv = n.fieldVersions ?? {};
  let v = 0;
  for (const k of Object.keys(fv) as NoteFieldKey[]) {
    const f = fv[k] ?? 0;
    if (f > v) v = f;
  }
  return v;
}

export type NoteDraft = Pick<Note, 'title' | 'content' | 'tags'>;

export type SortKey = 'updated' | 'created' | 'alpha' | 'pinned';

export interface NoteFilter {
  query?: string;
  tags?: string[];
  includeArchived?: boolean;
  includeDeleted?: boolean;
  sort?: SortKey;
}
