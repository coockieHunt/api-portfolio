// authorized redis keys
export const AUTHORIZED_REDIS_KEYS = {
    GLOBAL_STATUS: 'portfolio:global:call_api',
    GUESTBOOK_ENTRIES: 'portfolio:guestbook:entries',
    ASSET_LIST: 'portfolio:assets:list',
    OG_META: 'portfolio:og:meta',
} as const;

// authorized redis prefixes (authorized dynamic keys)
export const AUTHORIZED_REDIS_PREFIXES = {
    BLOG_POST: 'portfolio:blog:post:',
    BLOG_VER: 'portfolio:blog:version:',
    AUTH_TOKEN: 'portfolio:auth:token:',
    THEME_COUNTER: 'portfolio:theme:counter:',
} as const;

