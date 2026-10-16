/* Wrangler's Text modules expose their contents as a default export. */
/* eslint-disable import/no-default-export */
declare module '*.html' { const text: string; export default text; }
declare module '*.css' { const text: string; export default text; }
declare module '*.js' { const text: string; export default text; }
