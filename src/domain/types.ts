export type ID = string;

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
