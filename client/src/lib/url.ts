const SITE_BASE =
  import.meta.env.VITE_SITE_BASE ||
  (import.meta.env.DEV ? 'http://127.0.0.1:3000' : '');

export const buildSiteUrl = (relative?: string) => {
  if (!relative) {
    return undefined;
  }
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  return `${SITE_BASE}${relative}`;
};
