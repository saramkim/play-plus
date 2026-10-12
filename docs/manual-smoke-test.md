# Play Plus Manual Release Smoke Test

Run this checklist against the production `dist/` directory before publishing a release.

## Test environment

- Extension version: `1.12.0`
- Source: `c344953be3b0d2ba65542b407e125b49d1af027d` plus the four-file release version/documentation change.
- Build command: `yarn build`
- Runtime: Node.js 24.18.0, Yarn 4.9.1
- Browser: Chrome 154.0.0.0, Windows, dedicated `chrome-devtools-kr` profile
- Tester/date: Codex, 2026-10-13 Pacific/Auckland (2026-10-12 UTC)
- Service: signed-in Coupang Play, isolated Korean proxy; Windows host routing unchanged.
- Routes: `/play/<video-id>/episode` and `/en/play/<video-id>/episode`
- Actual extension side panel opened through the extension action; no ordinary extension tab substituted.

## Production bundle gate

| Asset | Minified bytes | 1 MiB gate |
| --- | ---: | --- |
| `dist/index.js` | 713680 | PASS |
| `dist/content.js` | 409389 | PASS |
| `dist/background.js` | 5758 | PASS |

Type check, lint, all 20 test files / 98 tests, and production build passed. Webpack retains three bundle-size/performance warnings; all entry bundles remain below 1 MiB.

## Smoke matrix

Record `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN` for every row. For failures, include the route, exact action, visible result, and relevant console error. The evidence below is executor-observed, not an independent browser replay.

| Area | Route(s) | Check | Result | Notes / console errors |
| --- | --- | --- | --- | --- |
| Install | N/A | Load `dist/`; actual side panel opens without errors | PASS | Installed unpacked candidate reloaded to manifest 1.12.0; panel console had no errors/warnings. |
| Fresh state | Both | Default settings and active-video detection | PASS | Empty-sync fixture: default sliders 6/4/2/0 and 4/2/2/0; video detection recovered. This checks fresh settings, not a new Chrome profile/store installation. |
| Upgrade | Both | Existing sync settings and local uploads remain intact | PASS | Legacy fixture omitted both shadow fields; default 2 restored while other style values and uploaded cues/title/delay remained. Extension/page reload exercised. Not a Web Store update test. |
| Route support | `/play` | Detection, connection and controls initialize | PASS | Korean locale selected through service UI; actual URL retained `/play`, video readyState 4, bilingual cues. |
| Route support | `/en/play` | Detection, connection and controls initialize | PASS | Actual English route, video readyState 4, bilingual cues. |
| Primary subtitle | Both | Select, display, hide/show and seek | PASS | Platform and uploaded cues displayed; T hid/restored; analysis text click sought to uploaded cue start. |
| Secondary subtitle | Both | Select, display, hide/show and seek | PASS | Platform and uploaded secondary displayed; Y hid/restored; uploaded analysis seek at 302 s (KO route) and 1.5 s (EN route). |
| Upload | Both | Upload, delay, edit and reload | PASS | Actual SRT file chooser/upload; titles edited; delays 1.5 s / 2 s persisted with both cue arrays across reload. Selection may reset on reload; uploaded data remains. |
| Copy | Both | Configured primary/secondary shortcuts | PASS | Foreground E/R produced successful copy toasts with the corresponding text. Clipboard write success observed through product feedback, not host clipboard readback. |
| Save | Both | Save primary/secondary and review | PASS | Q/W produced stored lines; Review panel displayed saved records. Duplicate existing line was rejected as expected. |
| Navigation | Both | Subtitle and fixed-time forward/backward | PASS | D/S moved +/-5 s. Arrow navigation followed subtitle starts, including uploaded start 0 and platform 41.033/42.9 s. |
| Loop | Both | A/B, current subtitle and clear | PASS | A/B interval wrapped; C used current cue interval; stopping/disabling loop removed loop status/markers. |
| Speed | Both | Increase, decrease and reset | PASS | 1.0 -> 1.1 -> 1.0; reset also tested from 1.1. |
| Reconnect | Both | Close/reopen actual side panel | PASS | Action toggle created a new panel surface; Connected/Detected recovered. |
| Reload | Both | Player reload recovers subtitles/controls | PASS | After service loading/ads, actual video readyState 4 and bilingual cues recovered. |
| SPA navigation | Both | Away/back without full reload; new player detected | PASS | Profile/watch-history -> player -> back -> forward, unchanged performance.timeOrigin 1791810320094.6; new video and cues recovered. |
| Saved subtitle | Existing tab | Open saved line in matching tab | PASS | Existing English player sought to 41.033 s. |
| Saved subtitle | New tab | Open saved line with no matching tab | PASS | Closed owned player; Review play opened a new matching player and resumed near saved cue. |

## Evidence limits and cleanup

- Fresh-state and upgrade rows use controlled storage fixtures in the real extension. They do not claim a clean Chrome profile, pristine 1.11.0 binary upgrade, or Chrome Web Store delivery.
- Several navigation calls exceeded a 10-second tool timeout; subsequent live DOM/video checks established recovery. During ads the panel temporarily reported Not detected/Detecting.
- Two test player tabs triggered service concurrency error `USR-2103`. Closing the redundant owned tab and retrying SPA navigation restored playback. This was a service limitation, not a product failure.
- Service console warned about DRM robustness and route timing. No extension error was observed in the checked panel/player consoles.
- User previously accepted the final shadow appearance at 2 versus 10. The release changes only versions and this report; runtime source is unchanged from that accepted commit.
- Original sync/local data were backed up and restored exactly. Only named test subtitle/config keys were removed. Service language restored to English, owned test tabs closed, Korean gateway stopped.

## Historical execution

The v1.11.0 matrix was reported PASS by the user on 2026-07-12 in signed-in desktop Chrome. That historical result is not used as evidence for the current release.

## Release decision

Do not release while any row is `FAIL`, `BLOCKED`, or `NOT RUN`. Keep this completed matrix with the release commit. Store submission remains the user's responsibility.
