export type AvatarCollection =
  | 'vibrent'
  | '3d'
  | 'memo'
  | 'toon'
  | 'teams'
  | 'notion'
  | 'upstream'
  | 'bluey';

export type AvatarOption = {
  id: string;
  collection: AvatarCollection;
  label: string;
  url: string;
};

export const AVATAR_COLLECTIONS: Array<{
  key: AvatarCollection;
  label: string;
  count: number;
}> = [
  { key: 'vibrent', label: 'Vibrent', count: 27 },
  { key: '3d', label: '3D', count: 5 },
  { key: 'memo', label: 'Memo', count: 35 },
  { key: 'toon', label: 'Toon', count: 10 },
  { key: 'teams', label: 'Teams', count: 9 },
  { key: 'notion', label: 'Notion', count: 15 },
  { key: 'upstream', label: 'Upstream', count: 22 },
  { key: 'bluey', label: 'Bluey', count: 10 },
];

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/alohe/avatars@main/png';

export const ALOHE_AVATARS: AvatarOption[] = AVATAR_COLLECTIONS.flatMap((col) =>
  Array.from({ length: col.count }, (_, idx) => {
    const num = idx + 1;
    const filename = `${col.key}_${num}.png`;
    return {
      id: `${col.key}_${num}`,
      collection: col.key,
      label: `${col.label} ${num}`,
      url: `${CDN_BASE}/${filename}`,
    };
  }),
);
