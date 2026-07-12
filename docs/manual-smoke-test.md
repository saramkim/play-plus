# Play Plus Manual Release Smoke Test

Run this checklist against the production `dist/` directory before publishing a release.

## Test environment

- Extension version: `1.11.0`
- Build command: `yarn build`
- Supported runtime: Node.js 22–24, Yarn 4.9.1
- Chrome version: record before testing
- Tester and date: record before testing
- Coupang Play account/region: record before testing
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
| Upload | Both | Upload a subtitle, adjust delay, edit it, and reload the page | PASS | |
| Copy | Both | Copy primary and secondary subtitle text using configured shortcuts | PASS | |
| Save | Both | Save primary and secondary subtitle lines and review them in the panel | PASS | |
| Navigation | Both | Seek forward/backward by subtitle and by configured time units | PASS | |
| Loop | Both | Set loop points, loop the current subtitle, and clear the loop | PASS | |
| Speed | Both | Increase, decrease, and reset playback speed | PASS | |
| Reconnect | Both | Close/reopen the side panel and verify state reconnects | PASS | |
| Reload | Both | Reload the player; subtitles and controls recover | PASS | |
| SPA navigation | Both | Navigate away and back without a full reload; the new player is detected | PASS | |
| Saved subtitle | Existing tab | Open a saved subtitle in an already-open matching video tab | PASS | |
| Saved subtitle | New tab | Open a saved subtitle when no matching video tab exists | PASS | |

## 2026-07-12 execution record

- Automated build/type/lint/test gate: PASS
- Browser smoke matrix: PASS
- Execution confirmation: completed by the user in a signed-in desktop Chrome profile from a supported Coupang Play region.

## Release decision

Do not release while any row is `FAIL`, `BLOCKED`, or `NOT RUN`. Attach this completed matrix to the release notes or pull request.
