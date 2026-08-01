# Play Plus Manual Release Smoke Test

Run this checklist against the production `dist/` directory before publishing a release.

## Test environment

- Extension version: `1.11.0`
- Build command: `yarn build`
- Supported runtime: Node.js 22–24, Yarn 4.9.1
- Chrome version: record before testing
- Tester and date: record before testing
- Coupang Play account/region: record before testing
- OpenSubtitles shared consumer approval and API key: record before testing
- Korean route URL: `https://www.coupangplay.com/play/<video-id>`
- English route URL: `https://www.coupangplay.com/en/play/<video-id>`

## Production bundle gate

Measured on 2026-07-12 after `yarn build`:

| Asset | Minified size | 1 MiB gate |
| --- | ---: | --- |
| `dist/index.js` | 695.00 KiB | PASS |
| `dist/content.js` | 397.50 KiB | PASS |
| `dist/background.js` | 5.15 KiB | PASS |

The index and content bundles are both below the 1 MiB follow-up threshold. Webpack still reports its default 244 KiB performance warnings; treat optimization as separate work.

## Smoke matrix

Record `PASS`, `FAIL`, or `BLOCKED` for every row. For failures, include the route, exact action, visible result, and relevant extension/page console error.

| Area | Route(s) | Check | Result | Notes / console errors |
| --- | --- | --- | --- | --- |
| Install | N/A | Load `dist/` as an unpacked extension; side panel opens without errors | PASS | |
| Fresh state | Both | Fresh install uses defaults and detects the active video | PASS | |
| Upgrade | Both | Existing sync settings and locally uploaded subtitles remain intact | PASS | |
| Route support | `/play` | Video detection, connection status, and controls initialize | PASS | |
| Route support | `/en/play` | Video detection, connection status, and controls initialize | PASS | |
| Primary subtitle | Both | Select, display, hide/show, and seek from primary subtitles | PASS | |
| Secondary subtitle | Both | Select, display, hide/show, and seek from secondary subtitles | PASS | |
| Subtitle modes | N/A | In the Subtitles tab, verify list/empty mode never renders the add workflow; enter Add Subtitles from the list CTA and both empty-state actions; use Back to restore focus to the originating action; verify list and add modes each have one vertical scroll owner at 320/360/390px | NOT RUN | |
| Subtitle source | N/A | Switch File/Online with mouse and keyboard; preserve each source draft within the current add-mode session; keep the inactive flow out of layout, the accessibility tree, and keyboard focus; leave and re-enter add mode to verify both drafts reset | NOT RUN | |
| Add from file | Both | Add supported SRT/VTT/SMI files, reject unsupported/over-1-MiB/undecodable/empty files, verify Back/source/form controls are disabled while registering, then confirm success returns to and focuses the new list item before adjusting delay, editing, and reloading | NOT RUN | |
| Online permission | N/A | First Search requests only the OpenSubtitles API and temporary-download origins; denial sends no search and leaves File available; granting does not reprompt | NOT RUN | |
| Online search | N/A | Before Search, verify the provider transmission notice and no permission/network activity; keep title/language visible and type/year/season/episode in collapsed Advanced Search with an accurate applied count; verify busy controls, loading, empty, sanitized error, retry, pagination, and immediate result removal after any field changes | NOT RUN | |
| Online result details | N/A | At 320–390px, verify release fallback, work/S/E, FPS, CD n/N, conditional translation/SDH/foreign-only badges, trusted-source explanation, rating+votes, downloads, collapsed filename/rank/date details, keyboard access, and no horizontal overflow | NOT RUN | |
| Online add | Both | Download only the selected result; disable Back/source/results while downloading or registering; keep results on download/quota/size/decode/empty/storage errors; after success return to and focus the new item in the added list and show it in Analysis without automatically applying it; verify long titles wrap without horizontal overflow while the list remains vertically scrollable | NOT RUN | |
| Online cache | N/A | Select the same OpenSubtitles file again in the same browser session and verify the cached text avoids another provider download/quota use | NOT RUN | |
| Online permission revoke | N/A | Revoke OpenSubtitles host access, retry Search, and verify the permission/fallback behavior recovers without affecting locally added subtitles | NOT RUN | |
| Copy | Both | Copy primary and secondary subtitle text using configured shortcuts | PASS | |
| Save | Both | Save primary and secondary subtitle lines and review them in the panel | PASS | |
| Saved card v2 | Both | Migrate legacy lines once; save paired and single-line cards; allow same text at another source/time; reject exact duplicates; search either line; delete/undo by card ID without horizontal overflow | NOT RUN | |
| Review status | Both | Default migrated/new cards to New; move stable-ID cards among New/Learning/Mastered; combine status filter with both-line search and date sort; preserve status through reopen, delete/undo, source/copy, and backup/restore; verify keyboard access and no horizontal overflow | NOT RUN | |
| Navigation | Both | Seek forward/backward by subtitle and by configured time units | PASS | |
| Loop | Both | Set loop points, loop the current subtitle, and clear the loop | PASS | |
| Speed | Both | Increase, decrease, and reset playback speed | PASS | |
| Reconnect | Both | Close/reopen the side panel and verify state reconnects | PASS | |
| Reload | Both | Reload the player; subtitles and controls recover | PASS | |
| SPA navigation | Both | Navigate away and back without a full reload; the new player is detected | PASS | |
| Saved subtitle | Existing tab | Open a saved subtitle in an already-open matching video tab | PASS | |
| Saved subtitle | New tab | Open a saved subtitle when no matching video tab exists | PASS | |
| Backup | N/A | Export settings, saved lines, added-subtitle metadata, and local/online added-subtitle bodies to the existing v1 JSON format | NOT RUN | |
| Restore | Both | Replace current data from a valid backup and verify settings, Review, source seek, analysis, and added-subtitle display | NOT RUN | |
| Restore validation | N/A | Reject malformed or unsupported backups and cancellation without changing existing data | NOT RUN | |

## 2026-07-12 execution record

- Automated build/type/lint/test gate: PASS
- Browser smoke matrix: PASS
- Execution confirmation: completed by the user in a signed-in desktop Chrome profile from a supported Coupang Play region.

## Release decision

Do not release while any row is `FAIL`, `BLOCKED`, or `NOT RUN`. Attach this completed matrix to the release notes or pull request.
