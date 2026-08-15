# Coupang Play Content and Runtime Evidence

상태: **2026-08-14 조사와 2026-08-15 Issue #79·#80·#83 qualification의 비규범적 기록**

이 문서는 Play Plus가 Coupang Play의 현재 콘텐츠와 재생 상태를 어느 정도 이해할 수 있는지 판단하기 위해 실제 서비스에서 관찰한 데이터 surface를 기록한다. Coupang Play의 공개·버전 고정 API 계약, Play Plus 2.0 기능 승인, 구현 계획 또는 릴리스 smoke 결과가 아니다.

비공개 endpoint, field, enum, DOM과 route 형태는 예고 없이 바뀔 수 있다. 아래의 `확인`은 표본에서 직접 관찰했다는 뜻이며 장기 안정성을 뜻하지 않는다. 제품 범위는 계속 [Play Plus 2.0 canonical contract](./play-plus-2.0.md)가 결정한다.

## 1. 조사 목적

다음 질문에 답하는 것이 목적이다.

1. 현재 route가 영화, 에피소드, 트레일러, 라이브 채널 또는 하이라이트인지 구분할 수 있는가?
2. 작품명, 연도, 시즌·회차, 공개 상태, 언어와 artwork 같은 콘텐츠 설명을 얻을 수 있는가?
3. 광고, 본편, 라이브와 전환 중 상태를 실제 재생 순간에 구분할 수 있는가?
4. 인트로와 다음 화·추천 화면 경계를 재생 응답에서 얻을 수 있는가?
5. 기존 Play Plus MV3 경계에서 각 값을 추가 권한·추가 요청 없이 얻을 수 있는가?
6. 자동 제목 수집, OpenSubtitles 입력 보조와 콘텐츠별 capability에 대한 이후 제품 결정을 뒷받침할 증거가 충분한가?

## 2. 조사 환경과 범위

| 항목 | 기록 |
| --- | --- |
| 관찰일 | 2026-08-14 |
| 저장소 기준 | `origin/main`의 `4636731` |
| 서비스 | 실제 `www.coupangplay.com` production site, page version `1.74.2` |
| 지역 | Windows host routing은 유지하고 전용 gateway의 KR egress만 사용 |
| 인증 | 기존 signed-in persistent Chrome profile 사용. credential은 직접 입력하지 않았고 인증 관련 값은 제품 근거로 사용하거나 기록하지 않음 |
| 표본 | 영화 상세·재생, 시리즈 상세·에피소드 목록·재생, 트레일러 재생, 뉴스 라이브 채널, 뉴스 하이라이트 metadata, Sports 진입 gate. 대부분 종류별 제한된 단일 표본 중심이므로 field의 존재·부재를 일반화하지 않음 |
| locale | English route를 실제 탐색하고 일부 title response의 `locale=en`과 `locale=ko`를 비교 |
| 확장 프로그램 | 이 profile에는 Play Plus가 설치되어 있지 않았음. 확장 획득 경로와 Side Panel 동작은 `NOT RUN` |
| 종료 상태 | 재생을 일시 정지하고 조사 전용 KR gateway를 종료함 |

다음 값은 제품 판단 근거로 사용하지 않았다. DevTools 화면이나 도구 출력에 일시 노출된 경우에도 별도 조사 artifact·문서·저장소에 전사하거나 복제하지 않았다.

- cookie, authorization, CSRF, access/refresh token과 전체 request header
- 실제 콘텐츠·episode·asset·account·profile UUID
- signed media, subtitle, manifest와 license URL
- DRM/session/device 식별자와 광고 session body
- 프로필 이름, Continue Watching, 시청기록과 개인화 추천
- 실제 자막 문장, cue body, 등록 자막과 typed answer
- 전체 watched URL과 DevTools request ID

API와 route 예시는 항상 `<content-id>`처럼 정제한다.

## 3. 증거 등급

### A — route에 결합된 first-party 구조화 응답

활성 document의 route ID로 요청됐거나 별도 교차 확인으로 route에 결합된 title, episode, clip, event 또는 playback first-party response의 명시적 field다. 현재 표본의 콘텐츠 설명에는 가장 강하지만, 각 response 내부 ID의 상호 동일성과 비공개 API field 안정성은 별도 검증 대상이다.

### B — 현재 video runtime

정확히 분류한 `video[data-cy="main-video"]`의 `currentTime`, `duration`, `paused`, `ended`, `readyState`, source 종류와 media event다. 현재 재생 상태에는 강하지만 작품명이나 콘텐츠 종류의 근거는 아니다.

### C — 표시 DOM과 route shape

상세 화면의 heading, badge, episode link, URL suffix와 광고 overlay다. 현재 UX와 runtime을 설명하는 보조 증거지만 locale, A/B test, CSS hash와 화면 개편에 취약하다.

### D — 추론 전용

짧은 duration, direct media URL, `document.title`, 빈번히 바뀌는 class, 제목 문자열 또는 poster만 보고 콘텐츠 종류·광고·언어를 추측하는 방식이다. 단독 제품 판단 근거로 사용하지 않는다.

## 4. 관찰한 데이터 surface

### 4.1 Route와 document

실제 play route에서 다음 suffix를 확인했다.

```text
/en/play/<content-id>/movie
/en/play/<content-id>/episode
/en/play/<content-id>/trailer
/en/play/<content-id>/channel
/en/play/<content-id>/highlight
```

관찰 결과:

- route UUID는 현재 playable object의 가장 저렴한 identity 후보다.
- suffix는 표본에서 `titleType`과 일치했지만 공개 route 계약은 아니다.
- `window.__NEXT_DATA__`는 play page 이름과 `titleId`, `type` 같은 query key는 노출했지만 작품 metadata는 제공하지 않았다.
- `document.title`은 작품과 관계없이 `Coupang Play`였다.
- play page에서 작품용 Open Graph metadata는 없었고 JSON-LD는 Organization 정보뿐이었다.
- title detail 화면 DOM은 제목, 유형, 연도, 러닝타임, 줄거리, 출연진, 감독, 언어와 에피소드 목록을 표시했지만 play page의 안정적인 metadata source로 사용할 수 없었다.

현재 Play Plus의 [UUID parser](../src/utils/coupang-play.ts)는 host와 UUID만 검증하며 suffix를 콘텐츠 종류로 모델링하지 않는다.

### 4.2 Title detail

페이지가 사용하는 다음 형태의 first-party response를 관찰했다.

```text
GET /api-discover/v1/discover/titles/<content-id>?...
```

영화, 시리즈와 에피소드 표본에서 확인한 주요 field는 다음과 같다.

| 영역 | 관찰한 field 또는 값 |
| --- | --- |
| Identity | `id`, `asset_id`, `parent_id`, `deal_id` |
| Kind | `as = MOVIE | TVSHOW | EPISODE`, `subType`, `stream_type = VOD` |
| Copy | `title`, `title_canonical`, `description`, `short_description` |
| Release | `published_at`, `vod_start_at`, `expires_on`, `meta.releaseYear` |
| Playback eligibility | `streamable`, `playState = WATCHNOW | COMINGSOON`, `availability`, `nonWowAvailability` |
| Episode | `season`, `episode`, `order`, `parent_id`, `nextEpisodeId` |
| Series catalog | `seasons`, `seasonList`, `defaultSeason`, `total_running_time` |
| Runtime | `running_time`, `running_time_friendly`, `meta.display_runtime` |
| Language | `languages`, `audios` |
| Presentation | rating, age rating, people/cast, tags, `videoMaxQuality`, `is_hdr` |
| Ads | `advertisementConfig.is_auto`, `is_pre_roll`, `is_mid_roll`, `is_post_roll` |
| Live-adjacent | `support_live`, `assetIdLive`, `live_start_at`, `live_end_at`, `nextLiveEpisodeId` |

Artwork container도 구조화되어 있었다.

- 영화·시리즈: `background`, `hero`, `hero-largescreen`, `hero-v2`, `poster`, `story-art`, `title-card`, `title-treatment`, `title-treatment-v2`
- 에피소드: `story-art`

주의할 점:

- `title_canonical`은 원제를 뜻하지 않았다. direct detail response에서는 요청 locale에 맞춘 `title`과 같은 값이었고, episode-list response와도 일관되지 않은 표본이 있었다.
- `languages`는 사용자에게 보여 주는 언어 목록으로 보였고 실제 playback track catalog와 값·표현이 달랐다.
- `advertisementConfig`는 실제 광고 노출의 truth가 아니었다.
- `running_time`은 표본에서 초였지만 공개 단위 계약으로 간주하지 않는다.
- `streamable`, `playState`, `availability`, `nonWowAvailability`와 entitlement 계열 값은 지역, 시점, profile과 subscription에 따라 달라질 수 있다. 고정 콘텐츠 metadata나 모든 사용자의 playable truth로 저장하지 않는다.

### 4.3 Series와 episode catalog

다음 response를 관찰했다.

```text
GET /api-discover/v1/discover/titles/<series-id>/seasons/<season>/episodes/count
GET /api-discover/v2/discover/titles/<series-id>/episodes?...
GET /api-discover/v1/discover/titles/<series-id>/episodes/groups?...
GET /api-discover/v1/discover/titles/episodes/<episode-id>/location?...
```

episode catalog item에는 title detail field와 함께 `parent_id`, `season`, `episode`, `order`가 있었다. 표본의 같은 시리즈에 다음 상태가 동시에 존재했다.

- 공개된 에피소드: `streamable: true`, `playState: WATCHNOW`, 0이 아닌 `running_time`과 비어 있지 않은 `languages` metadata 존재
- 공개 예정 에피소드: `streamable: false`, `playState: COMINGSOON`, 미래 `vod_start_at`
- 일부 공개 예정 항목은 예상 runtime을 이미 가지고 있었고, 더 먼 항목은 `running_time: 0`, 빈 language 목록이었다.

따라서 `video 없음` 하나로는 재생 준비 중, 공개 예정, 이용 불가와 잘못된 route를 구분할 수 없다.

### 4.4 Clip과 trailer

다음 response를 관찰했다.

```text
GET /api-discover/v1/discover/clips/<clip-id>?...
```

트레일러 표본은 `type: TRAILER`, title, description, runtime과 `story-art`를 제공했다. 그러나 직접 parent series/title ID는 없었다.

playback에서는 다음을 확인했다.

- request `titleType: TRAILER`
- `is_preview: false`
- 약 84초의 HLS source
- 실제 subtitle track 없음
- thumbnail용 `kind: metadata` VTT만 존재
- cue point와 광고 descriptor 없음

따라서 `is_preview`나 짧은 duration으로 trailer를 판정하면 안 된다. 표본에서는 route suffix, request `titleType`과 clip detail `type`이 더 강했다.

### 4.5 Event, live channel과 highlight

뉴스 feed와 event detail에서 다음 형태를 관찰했다.

```text
GET /api-discover/v3/discover/feed?...&category=NEWS
GET /api-discover/v1/discover/events/<event-id>?...
```

feed는 여러 item을 `type: EVENT`로 묶고 다음 field로 구체화했다.

- `media_type = NEWS | NVOD`
- `sub_type = CHANNEL | HIGHLIGHT`
- `streamable`, `is_nvod`, `live_stream_ended`
- `startAt`, `endAt`, `running_time`, `running_time_friendly`

event detail은 표본에서 `type: CHANNEL | HIGHLIGHT`, channel/title, `start_at`, `end_at`, `streamable`, `live_stream_ended`, `is_nvod`, `asset_id`, quality와 artwork를 제공했다.

라이브 채널 playback 표본은 VOD와 달랐다.

- `titleType: CHANNEL`
- `raw.duration`, `cue_points`, `text_tracks`가 없었음
- HLS source와 광고 descriptor가 있었음
- content video duration은 `Infinity`가 아니라 관찰 중 약 `36 → 44 → 48 → 56`초로 증가함
- seekable range도 함께 증가함

따라서 `duration === Infinity`나 고정 duration만으로 live를 판정할 수 없다. live에서 반복·segment end·mission restore를 VOD와 동일하게 다루는 것도 별도 검증 없이는 안전하지 않다.

Sports 진입 표본은 현재 test profile에서 subscription benefits route로 이동했다. 이는 authentication, content metadata, entitlement와 player 접근을 별도 상태로 다뤄야 한다는 증거다. 계정이나 subscription 값은 제품 판단 근거로 사용하거나 기록하지 않았다.

### 4.6 Playback response

실제 page-owned request는 다음 형태였다.

```text
GET /api/playback/play?titleId=<content-id>&titleType=<kind>
```

영화와 에피소드 response에서 관찰한 구조는 다음과 같다.

```text
data
  ad_info
  features
  is_preview
  preferredDrm
  raw
    id
    duration
    cue_points[]
    sources[]
    text_tracks[]
```

`raw.cue_points[]`에는 다음 field가 있었다.

```text
type
name
time
force_stop
metadata
```

표본에서 확인한 marker 이름:

- 에피소드: `skip_intro_start`, `skip_intro_end`, `watch_next`
- 영화: `skip_intro_start`, `skip_intro_end`, `show_recommendations`
- 트레일러와 라이브 채널 표본: 해당 marker 없음

단위도 서로 달랐다.

- title `running_time`: 표본에서 초
- playback `raw.duration`: 표본에서 밀리초
- cue point `time`: 표본에서 초
- content `<video>.duration`: media timeline의 초이며 metadata 값과 정확히 일치하지 않을 수 있음

같은 에피소드 표본에서 title runtime은 `3180`, playback duration은 `3180000`, 광고 뒤 content video duration은 약 `3146`초였다. 어느 값을 다른 값의 fallback으로 조용히 치환하면 안 된다.

`raw.text_tracks[]`에는 `kind`, `srclang`, `label`, `mime_type`, direct `src`와 `sources[]`가 있었다.

- 영화 표본: `ko`, `en`, thumbnail metadata
- 에피소드 표본: `en`, `ko sdh`, thumbnail metadata
- 트레일러 표본: thumbnail metadata만 존재
- 라이브 채널 표본: `text_tracks` 자체가 없었음

영화 source에는 HLS/DASH, codec, HDR와 DRM key-system descriptor가 함께 있었고 source별 광고 descriptor도 존재했다. 이 값은 playback capability와 진단 후보이지 사용자용 콘텐츠 metadata로 저장할 근거는 아니다.

## 5. Runtime 관찰

### 5.1 Episode advertisement to content

같은 play route에서 다음 순서를 직접 관찰했다.

1. `video[data-cy="main-video"]`가 direct MP4를 재생했다.
2. player 안에 `[class*="AdOverlay_"]`와 남은 광고 시간이 표시됐다.
3. 광고 중에는 subtitle text track이 없었다.
4. 광고 종료 뒤 overlay가 사라지고 source가 `blob:` content로 전환됐다.
5. content video는 `readyState: 4`, 진행하는 `currentTime`과 긴 content duration을 가졌다.

title response의 같은 에피소드에는 `advertisementConfig.is_pre_roll: false`가 있었으나 실제 preroll이 노출됐다. metadata ad config는 사전 capability hint로도 과신하지 않고, 현재 순간의 광고 판정은 video와 overlay를 교차 확인해야 한다.

이는 2026-07-11의 [video lifecycle design](./superpowers/specs/2026-07-11-coupang-video-lifecycle-design.md)이 정한 광고 DOM 우선 원칙을 재확인한다. 다만 hashed class도 private DOM이므로 drift 감시가 필요하다.

### 5.2 Live advertisement to content

라이브 채널도 처음에는 짧은 광고 video와 overlay를 보인 뒤 blob-backed content로 전환됐다. event detail에는 `advertisementConfig`가 없었으므로 live에서도 metadata 존재 여부가 광고 없음의 증거가 되지 않는다.

### 5.3 Sports entitlement gate

Sports navigation이 항상 player로 이어지지 않았다. 표본에서는 별도의 benefits route와 가입 action이 나타났다. 현재의 coarse `not_detected`만으로는 다음을 구분할 수 없다.

- player를 아직 기다리는 중
- 공개 예정
- 콘텐츠 종류가 학습 기능 대상이 아님
- entitlement가 필요함
- DRM/player 실패
- 호환 가능한 자막이 없음

이 상태를 사용자에게 구분해 보여 주는 것은 아직 승인되지 않은 후속 제품 결정이다.

## 6. 추출 가능하지만 판정에 단독 사용하면 안 되는 값

| 값 | 관찰한 반례 | 현재 판단 |
| --- | --- | --- |
| `advertisementConfig` | preroll false이지만 실제 광고 노출; live detail에는 field가 없지만 광고 노출 | runtime 광고 truth로 사용 금지 |
| `is_preview` | trailer도 false | trailer/preview 판정에 사용 금지 |
| `title_canonical` | locale과 endpoint에 따라 의미가 달랐음 | 원제 또는 locale-independent key로 사용 금지 |
| title `languages` | 실제 `text_tracks.srclang`과 표현·가용성이 다름 | 실제 자막 catalog 보장으로 사용 금지 |
| `<video>.duration` | live도 유한하고 증가; VOD metadata와도 차이 | 콘텐츠 종류·공식 runtime 단독 근거로 사용 금지 |
| direct URL 또는 짧은 영상 | trailer와 광고를 모두 포함할 수 있음 | 광고 판정 단독 근거로 사용 금지 |
| document metadata | 작품 정보가 없었음 | title descriptor source로 사용 금지 |
| `streamable` 하나 | profile entitlement와 route gate는 별도 | 실제 playable 보장으로 사용 금지 |

## 7. 현재 Play Plus와의 차이

### 7.1 이미 production path에 있는 것

- [route parser](../src/utils/coupang-play.ts)는 지원 host의 UUID를 video identity로 사용한다.
- [lifecycle classifier](../src/content/video-lifecycle/classifier.ts)는 `waiting | placeholder | advertisement | content`를 구분하고 monitor가 `transitioning`을 추가한다.
- [background capture](../src/background/subtitle-request.ts)는 page-owned `/api/playback/play?...` request의 URL과 header를 잡아 request·tab·document·route·content identity에 묶는다.
- [content adapter](../src/content/coupang-play.ts)는 기존 replay GET의 JSON에서 `data.raw.text_tracks`만 parse한다.
- [message handler](../src/content/message-handler.ts)는 `srclang`을 canonical language schema로 검증한 뒤 native cue store에 넣는다.

### 7.2 현재 소실되는 값

현재 playback Zod projection은 title/episode metadata가 아니라 다음 sibling을 버린다.

- `data.ad_info`, `features`, `is_preview`, `preferredDrm`
- `data.raw.duration`, `cue_points`, `sources`
- `text_tracks`의 label, MIME, default, bandwidth, dimensions와 variant 정보

이번 영화·에피소드 표본의 playback response에는 작품 제목, 시리즈, 시즌과 회차가 없었다. 따라서 기존 replay parser만 확장해도 marker·track·source capability는 얻을 수 있지만 content descriptor는 얻을 수 없다.

### 7.3 실제 compatibility gap

현재 canonical language는 `en`, `ko`, `ja`, `zh-CN`, `zh-TW`, `es`, `fr`, `de`, `pt`, `ru`, `ar`의 exact key다. [language schema](../src/storage/v2/schema.ts)는 exact match만 허용하고 [native track receiver](../src/content/message-handler.ts)는 정규화 없이 실패한 `srclang`을 제외한다.

따라서 이번 한 에피소드 표본에서 관찰한 `ko sdh` track은 현재 코드에서 제외된다. 이것이 모든 한국어 자막 실패를 뜻하지는 않는다. `ko sdh → ko` normalization, 일반/SDH 우선순위와 같은 언어에 여러 track이 있을 때의 선택 정책은 아직 결정되지 않았다.

### 7.4 UI/background 상태 손실

content 내부의 lifecycle 분류는 background/UI로 올라가면서 주로 `hasVideo`와 coarse connection status로 축약된다. 그래서 광고, placeholder, SPA 전환, 지원하지 않는 content kind, 공개 예정과 entitlement gate가 비슷한 `not detected` 경험으로 수렴할 수 있다.

## 8. MV3 획득 가능성

### 8.1 기존 playback snapshot 확장

기술적으로 가장 좁은 seam이다.

- 기존 native-subtitle flow는 page request를 직접 읽는 것이 아니라 background가 포착한 URL/header로 content가 별도 replay GET을 보낸다.
- 이미 성공한 replay response를 한 번 materialize해 subtitle parser와 별도의 strict, optional playback-context parser가 함께 읽을 수 있다.
- 새 Chrome permission이나 기존 replay 외의 추가 GET은 필요하지 않다.
- request URL/header는 현재 `chrome.storage.session`의 replay payload에 있으므로 새 field나 response body를 session/local storage에 추가하지 않는 편이 안전하다.
- marker가 없거나 shape가 바뀌면 기존 subtitle 획득까지 실패시키지 않도록 독립 optional projection이어야 한다.

가능한 transient 후보:

- request `titleType`
- playback duration과 cue point
- 실제 subtitle track language/variant catalog
- source kind, DRM·HDR·resolution capability의 최소 진단값

### 8.2 Discover metadata

페이지 main world에서 title, episode, clip과 event GET은 성공했다. 반면 특별한 request context 없이 `/api/playback/play`를 다시 호출한 표본은 `403`이었다.

현재 extension은 discover response body를 관찰하지 않는다. 다음 선택지는 모두 별도 POC와 제품 승인이 필요하다.

1. **Explicit metadata GET**: 사용자가 `현재 작품 정보 사용` 같은 동작을 실행할 때 route ID와 kind로 한 번 요청한다. 가장 단순하지만 추가 request이며 content/background fetch의 cookie, CORS와 header 동작을 실제 unpacked extension에서 검증해야 한다.
2. **Main-world response observer**: 페이지가 이미 요청한 discover response에서 최소 field만 전달한다. 중복 GET은 없지만 page fetch/XHR를 조기에 감싸야 하고 spoofing, race, page breakage와 private API drift 비용이 크다.
3. **Displayed DOM fallback**: 추가 request가 없지만 play page에는 안정적인 metadata가 없고 localization·A/B test·truncation에 취약하다. 권장하지 않는다.

데이터가 존재한다는 사실은 unpacked Play Plus가 이를 안전하게 획득할 수 있다는 증거가 아니다. 실제 extension POC 전까지 discover 획득 경로는 `NOT RUN`이다.

## 9. 구현 가능성 후보와 P0 승인 상태

아래 순서는 2026-08-14 조사 시점의 Codex 권고로 작성됐으며 그 자체는 승인된 2.0 roadmap이 아니다. 이후 P0의 transient Playback Context와 advertisement safety 경계만 [Play Plus 2.0 canonical contract](./play-plus-2.0.md#transient-playback-context-and-advertisement-safety)로 별도 승인됐다. 이 승인은 P1/P2/P3 또는 Later 후보를 승인하거나 순서를 확정하지 않는다. 각 나머지 항목은 구현 지시 전에 ChatGPT 검토, 사용자 승인과 canonical contract 개정 여부를 다시 판단한다.

| 우선순위 후보 | 사용자 결과 | 이용 가능한 근거 | 기술 판단 | 아직 필요한 결정 |
| --- | --- | --- | --- | --- |
| P0 Content and Runtime Spine — canonical boundary approved | 현재 콘텐츠가 영화·에피소드·트레일러·라이브·하이라이트인지 알고 검증된 movie/episode content runtime에서만 학습 기능을 활성화 | route suffix, playback `titleType`, lifecycle | exact route kind, lifecycle, two-layer identity, fail-closed capability와 advertisement safety만 승인. 새 metadata request 없음 | 후속 implementation Issue는 canonical amendment merge 뒤에만 시작하고 actual extension에서 검증 |
| P1 Playback Markers | intro 경계와 다음 화·추천 화면 전에 반복·Mission을 안전하게 끝냄 | 기존 playback replay의 `cue_points` | [Issue #79 qualification](#14-issue-79-p1-playback-marker-acquisition-qualification--2026-08-15)은 episode intro pair/`watch_next`에 한해 `READY FOR CONTRACT DISCUSSION`; production 계약은 미승인 | 추천 marker 의미, missing/drift fallback, 자동 행동 여부 |
| P2 Subtitle Variant Compatibility | `ko sdh` 같은 실제 provider track을 잃지 않고 명시적으로 선택 | playback `text_tracks` | [Issue #80 qualification](#13-issue-80-p2-native-subtitle-variant-qualification--2026-08-15)은 실제 compatibility risk에 한해 `READY FOR CONTRACT DISCUSSION`; production 계약은 미승인 | normalization, SDH 표시, 동일 언어 복수 track 우선순위 |
| P3 Explicit Content Descriptor | 사용자 요청 때 작품명·연도·시즌·회차를 보여 주거나 검색 입력 후보로 사용 | title/episode/clip/event response | 데이터는 충분하지만 획득 POC 필요 | explicit action, 전송·보존 범위, locale, private API failure UX |
| Later Content Library | artwork, synopsis, 영상별 grouping/search | discover metadata | 기술적으로 가능하나 범위·유지비 큼 | 자동 수집·영속 schema·refresh·privacy 전체 계약 |
| Later Live/Sports Learning | live DVR와 스포츠에 학습 기능 제공 | event/playback/runtime | 현재 표본으로는 부족 | entitlement, live seek window, subtitles, end/restore semantics |

### 조사 당시 P0 POC용 proposed state inventory

아래 값은 조사 당시 POC와 후속 논의에서 반례를 찾기 위한 working vocabulary다. 후속 canonical 승인은 exact `routeKind`와 기존 runtime lifecycle만 채택했으며 아래 `availability/capability` 이름을 public/message enum으로 승격하지 않았다.

기존 route·playback·lifecycle만으로는 `coming-soon`과 `entitlement-required`를 안정적으로 채울 수 없다. 이 값은 discover response와 route gate를 다루는 별도 POC 전까지 `unknown`으로 실패 닫힘 처리하는 후보다.

```text
route kind
  movie | episode | trailer | channel | highlight | unknown

runtime lifecycle
  waiting | placeholder | advertisement | content | transitioning

availability/capability
  learning-ready | no-compatible-subtitle | coming-soon
  entitlement-required | unsupported-kind | player-error | unknown
```

세 축을 한 enum으로 합치지 않는 원칙은 canonical contract에 반영됐다. 다만 예시의 `learning-ready`, `no-compatible-subtitle`, `coming-soon`, `entitlement-required`, `unsupported-kind`, `player-error`, `unknown`은 계속 evidence-only vocabulary이며 승인된 UI copy, schema 또는 message state가 아니다.

## 10. 계약 영향

이번 조사는 데이터 존재와 구현 가능성의 증거만 추가한다. 다음 기존 범위는 자동으로 바뀌지 않는다.

- 카드 `source.title`은 optional이며 초기 acceptance 대상이 아니다.
- 자동 영상 제목 수집·표시, 영상별 grouping/search는 연기 상태다.
- OpenSubtitles에는 사용자가 제출한 title/query, language, 선택한 type·year·season·episode와 page만 보내며 Coupang metadata를 자동 수집해 채우지 않는다.
- 하이라이트를 콘텐츠 종류로 식별하는 것은 제거된 broad highlight feature를 되살리는 승인이 아니다.
- cue point가 있다는 사실은 자동 skip, Mission end 또는 카드 범위 변경을 승인하지 않는다.
- `ko sdh`가 있다는 사실은 normalization·variant storage·UI 정책을 결정하지 않는다.
- 비공개 discover endpoint의 새 direct fetch, 기존 native-subtitle replay 경계를 벗어난 playback fetch, page main-world fetch interception, 새 message·response 전달 경계와 추가 권한은 승인되지 않았다.

후속 제품 결정이 위 경계를 바꾸면 [canonical contract amendment rule](./play-plus-2.0.md#10-explicit-non-goals-and-amendment-rule)에 따라 문서와 Issue를 구현 전에 갱신한다.

## 11. 후속 검증 matrix

### 공통 stability

- movie, episode, trailer, channel, highlight와 unknown route
- `/play`와 `/en/play`
- hard reload와 SPA next-episode transition
- preroll 없음, preroll 있음, content 중 ad 가능 표본
- locale `ko`와 `en`
- route ID, playback raw ID와 discover ID의 일치·불일치
- missing, null, unknown field와 endpoint version drift

### Playback markers

- marker 없음
- intro start만 있거나 end만 있는 malformed pair
- `watch_next`와 `show_recommendations`의 실제 player UI 시점 교차 확인
- cue point가 content duration 밖이거나 순서가 뒤집힌 응답
- ad timeline과 content cue timeline 단위 분리

### Subtitle variants

- `ko`, `ko sdh`, region tag와 case variation
- 일반/SDH가 함께 있는 같은 언어 복수 track
- direct `src`와 `sources[0].src`
- `subtitles`, captions, metadata와 unknown kind
- 한 track fetch 실패가 다른 track까지 실패시키지 않는지

### Discover POC

- content script와 background 각각의 cookie/CORS/header 결과
- 요청 전 사용자 action과 요청 횟수
- tab·document·route·video identity 변경 뒤 stale response 격리
- response body, URL과 credential 비저장·비logging
- 4xx, 5xx, malformed JSON, missing field와 offline fallback

### Actual extension proof

위 기능을 구현한 뒤에는 production `dist`를 설치한 actual Chrome Extension Pages Side Panel에서 검증한다. 이번 사이트 조사나 fixture는 다음을 대신하지 않는다.

- Play Plus가 값을 실제로 획득하는지
- active tab과 exact route/video identity에 묶이는지
- 광고·SPA 전환에서 오래된 값을 버리는지
- Side Panel이 상태를 사실대로 표시하고 키보드·포커스에서 작동하는지
- Storage, message, console과 network에 금지된 값이 남지 않는지

## 12. 2026-08-14 조사 결론

1. Coupang Play에는 콘텐츠 종류, localized title, 시즌·회차, 공개 상태, 언어, artwork와 live/event를 설명하는 충분한 구조화 데이터가 있다.
2. 기존 playback replay에는 intro/end marker, 실제 subtitle track variant와 source capability가 있어 추가 permission 없이 확장 가능한 좁은 seam이 있다.
3. metadata 설정만으로 광고, preview, live와 실제 자막 가용성을 판정할 수 없다. route identity, playback response와 runtime video/DOM을 함께 사용해야 한다.
4. Codex가 후속 논의에 먼저 제안하는 후보는 자동 metadata 수집이 아니라 content kind, lifecycle와 capability를 분리하는 transient safety spine이다.
5. 제목·시즌·회차 descriptor는 기술적으로 가능하지만 실제 extension 획득 POC, explicit initiation, non-persistence와 private API failure 계약을 먼저 정해야 한다.

## 13. Issue #80 P2 Native Subtitle Variant Qualification — 2026-08-15

### 13.1 범위와 기준

이 절은 Issue #80의 **qualification-only** 결과다. P2 구현, canonical 계약 변경, 언어 normalization, SDH/CC 분류 정책, 기본·우선순위, selector UI, source identity 재설계 또는 retry 정책을 승인하지 않는다.

| 항목 | 기록 |
| --- | --- |
| 조사 기준일 | 2026-08-15 |
| latest-main 기준 | `11f1133c55f3b659b39bebe1a3308dcffaf14f6d` — PR #78의 transient Playback Context 포함 |
| tracked 변경 범위 | 이 evidence 절, characterization test와 tests-only helper만 포함. production runtime과 canonical 문서는 변경하지 않음 |
| 실제 표본 제한 | anonymous movie 3개와 episode 2개, 총 5개 attachment를 조사함. movie 2개와 episode 2개가 accepted baseline이며 hard cap 10을 넘지 않음 |
| 실제 값 제한 | title·ID·URL·request/header·raw descriptor/response·cue 본문/수·시각을 기록하지 않고 category, field-presence, URL shape와 boolean outcome만 기록 |

### 13.2 현재 획득과 소실 경로

현재 경로는 다음과 같다.

1. [background capture](../src/background/subtitle-request.ts)가 page-owned playback request를 포착하고 현재 `contentEpoch`, content instance, route change, video identity와 `videoRevision`에 묶어 content에 replay를 전달한다.
2. [content adapter](../src/content/coupang-play.ts)는 replay response의 `raw.text_tracks`를 strict하게 parse하고 exact `kind: subtitles`, truthy `srclang`과 usable URL만 남긴다. direct `src`를 먼저 사용하고 nullish일 때만 `sources[0].src`로 fallback한다.
3. 같은 adapter가 남은 모든 track body를 `Promise.all`로 fetch하고 VTT로 parse한다. 한 track의 fetch/body-read failure가 전체 acquisition을 reject한다.
4. [content receiver](../src/content/message-handler.ts)는 전체 fetch가 끝난 뒤 superseded request, route/video와 P0 identity를 다시 검증한다. 그 다음 raw `srclang`을 exact [language schema](../src/storage/v2/schema.ts)에 통과시키며 실패한 값은 버린다.
5. 통과한 cue는 [subtitle store](../src/content/features/subtitle/subtitle-store.ts)의 `nativeCueCache[language]`에 순서대로 기록된다. 같은 canonical language가 여러 번 나오면 뒤 track이 앞 track을 덮는다.
6. learning과 playback source identity는 variant가 아니라 `native:<language>`이며 global `subtitleRevision`만 함께 검증한다. 따라서 같은 언어 복수 variant는 cache와 source identity 양쪽에서 충돌한다.

이 경로에는 descriptor label, MIME, default, variant identity를 보존하는 production field가 없다. native role 선택도 canonical language만 저장하므로 qualification에서 variant 정책을 정해도 현재 계약에 넣을 위치는 없다.

### 13.3 synthetic characterization matrix

모든 fixture 값은 synthetic이다. 실제 provider 값, URL 또는 cue를 복제하지 않았다.

| Shape | 현재 결과 | characterization |
| --- | --- | --- |
| regular + canonical language + direct source + non-empty parse | fetch·parse 뒤 exact validation과 cache retention 성공 | canonical baseline |
| accessibility-like language identifier | track은 fetch·parse되지만 exact language validation에서 drop | 실제 normalization 정책 미결정 |
| 같은 canonical language track 2개 | 둘 다 fetch·parse되며 cache는 뒤 track 하나만 보존 | `native:<language>`도 동일해 collision risk 확인 |
| case variation | fetch·parse 뒤 exact validation에서 drop | case normalization 미결정 |
| canonical에 없는 region variation | fetch·parse 뒤 exact validation에서 drop | region mapping 미결정 |
| canonical region key | exact validation과 retention 성공 | 기존 key baseline만 확인 |
| metadata, captions와 unknown kind | exact `subtitles`가 아니므로 body fetch 전 제외 | captions 포함 여부는 미결정, metadata exclusion은 feasible |
| missing, null 또는 empty language | body fetch 전 제외 | fail-closed current behavior |
| invalid language type | playback envelope 전체 parse 실패 | sibling isolation 없음 |
| direct source 없음, valid `sources[]` | 첫 fallback source 사용 | existing fallback 확인 |
| direct source와 fallback 모두 있음 | direct source 사용 | current precedence characterization이며 future policy 승인 아님 |
| empty-string direct source와 valid fallback | nullish fallback을 사용하지 않고 track drop | current edge case |
| usable URL 없음 | body fetch 전 track drop | fail-closed current behavior |
| parse-empty | empty cue array를 language cache에 기록하지만 native learning source는 unavailable | empty/failure 표현 정책 미결정 |
| body-read 또는 한 track fetch failure | `Promise.all`이 전체 acquisition reject | 성공한 sibling도 적용되지 않음 |
| tests-only sibling settlement | 실패 track과 성공 track을 분리 가능 | acquisition boundary 변경 없이 기술적 feasibility만 확인; retry/retention 정책 미결정 |
| stale epoch, instance, route, video 또는 attachment | observation reject | P0 identity binding 유지 |
| subtitle source 또는 revision 변경 | observation reject | P2 source binding 유지 |
| non-`content` lifecycle 또는 unsupported route kind | observation reject | advertisement/transition과 unsupported kind 제외 |

### 13.4 actual unpacked-extension sample

표본 label과 실제 콘텐츠 사이의 mapping은 만들거나 저장하지 않는다. `NOT OBSERVED WITHIN SAMPLE`은 부재를 뜻하지 않는다.

| Sample | P0 kind/lifecycle/identity gate | regular path | accessibility-like path | coexistence·case·region | non-subtitle·URL shape | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | UNKNOWN — supported movie attachment 뒤 content player가 진행하지 않아 acceptance 전 중단 | UNKNOWN | UNKNOWN | NOT OBSERVED WITHIN SAMPLE | UNKNOWN | 환경/player stall; variant evidence로 사용하지 않음 |
| M2 | PASS — `movie/content`, route·epoch·instance·video·attachment·source revision bound | NOT OBSERVED WITHIN SAMPLE | NOT OBSERVED WITHIN SAMPLE | same-base·case·region NOT OBSERVED WITHIN SAMPLE | metadata만 관찰·body fetch 전 제외; direct와 fallback field가 함께 있는 shape | accepted negative sample |
| M3 | PASS — `movie/content`, 모든 P0/source binding 유지 | canonical track fetch·non-empty parse·retention PASS | NOT OBSERVED WITHIN SAMPLE | same-base·case·region NOT OBSERVED WITHIN SAMPLE | metadata 제외; canonical descriptor에 direct와 fallback field가 함께 있음 | accepted regular baseline |
| E1 | PASS — `episode/content`, 모든 P0/source binding 유지 | NOT OBSERVED WITHIN SAMPLE | NOT OBSERVED WITHIN SAMPLE | same-base·case·region NOT OBSERVED WITHIN SAMPLE | metadata만 관찰·body fetch 전 제외; direct와 fallback field가 함께 있는 shape | accepted negative sample |
| E2 | PASS — `episode/content`, 모든 P0/source binding 유지 | canonical track fetch·non-empty parse·retention PASS | OBSERVED ONCE — accessibility-like track fetch·non-empty parse 뒤 exact-language drop | canonical/accessibility category pair OBSERVED ONCE; same-base=false, case·region NOT OBSERVED WITHIN SAMPLE | metadata 제외; 두 subtitle descriptor 모두 direct와 fallback field가 함께 있음 | accepted one-off variant sample |

E2의 boolean-only 재관찰은 같은 attachment를 다시 확인한 것이므로 별도 sample로 세지 않았다. 추가 SVOD 후보 2개는 지원 episode가 아닌 `/tvshow` action만 있어 attachment 전에 제외했고, 다음 free-series card는 browser automation target 확인이 거부되어 우회하지 않았다. 이 pre-play 후보도 sample로 세지 않으며, 미관찰 shape가 provider에 없다는 증거로 사용하지 않는다.

### 13.5 검증 gate

자동·정적 결과는 최종 review head에서 다시 실행한다. fixture `PASS`는 actual Chrome `PASS`를 대신하지 않는다.

| Automated/static check | Result | Evidence / notes |
| --- | --- | --- |
| latest-main SHA와 branch 격리 | PASS | `11f1133c55f3b659b39bebe1a3308dcffaf14f6d`; P1 branch·fixture·helper·evidence를 상속하지 않음 |
| Focused characterization/fixture | PASS | tests-only matrix와 production receiver characterization |
| Focused playback-context, Coupang playback, subtitle store/source identity, message handler | PASS | 7 files, 160 tests |
| Type-check | PASS | `yarn type-check` |
| Focused lint | PASS | 변경 code/test 경로 |
| Temporary-instrumentation production build | PASS | `yarn build`; 기존 size warning 3개 |
| Full unit suite | PASS | 100 files, 1007 tests |
| Full lint | PASS | `yarn lint` |
| Clean production build | PASS | 임시 instrumentation 제거와 원본 production blob hash 확인 뒤 `yarn build`; 기존 size warning 3개 |
| `git diff --check` | PASS | 최종 tracked evidence/test diff |
| Production/canonical/schema/Storage/manifest/permission/dependency/network diff audit | PASS | 최종 diff는 이 evidence 절과 tests-only characterization/receiver test뿐 |
| Sensitive-value scan | PASS | 새 diff에 실제 title·ID·URL·request/header·raw descriptor/response·cue content/count/timing·HAR/log dump 없음 |
| GitHub checks | NOT RUN | Draft PR 생성 뒤 확인 예정 |

| Actual Chrome check | Result | Evidence / notes |
| --- | --- | --- |
| Dedicated KR egress와 host unchanged | PASS | explicit volunteer-gateway consent 뒤 KR egress를 확인했고 Windows host는 NZ egress로 유지; IP는 기록하지 않음 |
| Extension installation/reload와 actual Side Panel | PASS | production `dist` 설치, action으로 열린 actual Extension Page Side Panel에서 Connected/Detected 확인; 일반 tab으로 대체하지 않음 |
| Authentication | PASS | 기존 signed-in profile로 catalog와 player 접근; install/region gate와 분리 |
| Regional access | PASS | KR catalog와 supported playback route 접근; auth gate와 분리 |
| DRM/player access | PASS | M2·M3·E1·E2 content video 진행과 media error 없음; M1 stall은 별도 UNKNOWN으로 보존 |
| Native-subtitle acquisition | PASS | M3 canonical, E2 canonical+accessibility-like가 existing replay에서 fetch·parse됨 |
| P0 identity/lifecycle/source/revision binding | PASS | accepted 4개 모두 content lifecycle과 epoch·instance·route·video·attachment·source revision guard 뒤에만 기록 |
| Regular canonical track | PASS | M3와 E2에서 non-empty parse; current cache/source retention 확인 |
| Accessibility-like track | OBSERVED ONCE | 독립 accepted attachment는 E2 1개이며, 같은 attachment 재관찰은 반복 표본으로 세지 않음. descriptor·fetch·non-empty parse와 current exact-language drop을 함께 확인 |
| Bounded variant search | PASS | attachment 5/10; accepted movie 2 + episode 2 baseline. 같은 E2 재관찰과 pre-play skip은 미포함 |
| Same-base, case와 region variation | NOT OBSERVED WITHIN SAMPLE | E2 category pair의 same-base boolean은 false; absence로 일반화하지 않음 |
| Metadata exclusion | PASS | M2·M3·E1·E2에서 metadata descriptor를 관찰하고 subtitle body-fetch 대상에서 제외됨을 확인 |
| Direct/fallback shape | PASS | actual descriptor에는 direct와 fallback field가 함께 있었고 current direct path가 성공; fallback-only actual shape는 NOT OBSERVED WITHIN SAMPLE |
| Console/network/privacy safety | PASS | acceptance 뒤 sanitized category/field/boolean만 확인; raw body·descriptor·ID·URL·header·cue/count/timing·HAR/log dump를 저장하거나 commit하지 않음 |
| Clean-build reload regression | PASS | clean `dist` reload, existing TV listing과 action-opened Side Panel에서 Connected/expected waiting·4개 navigation 확인; P2 instrumentation log 0, console error 0 |
| Gateway shutdown | PASS | validation gateway `ok=true`, `active=false`; shared KR profile release 뒤 종료 |

### 13.6 qualification result

READY FOR CONTRACT DISCUSSION

이 판정은 구현 승인이 아니다. 한 번 관찰된 compatibility risk와 regular acquisition, 현재 충돌·failure 특성, P0 binding을 바탕으로 별도 계약 논의를 시작할 수 있다는 뜻이며 qualified discriminator나 정책 근거로 사용하지 않는다.

### 13.7 현재 한계와 후속 결정 경계

- 2026-08-14 사이트 조사에서 accessibility-like identifier를 한 번 관찰했지만 당시 profile에는 Play Plus가 설치되지 않았다. 이는 Issue #80의 actual unpacked-extension proof가 아니다.
- 같은-base coexistence와 case/region variation은 bounded actual sample에서 관찰되지 않았다. descriptor field와 direct/fallback 분포도 관찰된 `both` shape만 보고하며, 미관찰 값은 존재하지 않는다고 결론내리지 않는다.
- one-track failure isolation은 tests-only helper로 기술적 가능성만 보였다. 어떤 track을 유지하고 언제 retry하거나 사용자에게 어떻게 보여 줄지는 승인되지 않았다.
- language normalization, regular/SDH precedence, selector, default, persistence와 source identity는 이 qualification이 결정하지 않는다.
- 구현을 시작하려면 actual qualification, ChatGPT review, 명시적 사용자 승인, merged canonical amendment와 별도 implementation Issue가 모두 필요하다.

## 14. Issue #79 P1 Playback Marker Acquisition Qualification — 2026-08-15

### 14.1 범위와 판정 규칙

이 절은 최신 `origin/main`의 `11f1133`에 temporary investigator instrumentation을 더한 production-mode `dist/`로 기존 Play Plus native-subtitle replay의 `cue_points`를 일시 관찰한 qualification 기록이다. instrumentation은 commit 전에 완전히 제거했고 clean `11f1133` production `dist/`를 다시 빌드해 Side Panel 회귀를 확인했다. production parser, 동작, schema, Storage, message, manifest, permission, dependency와 [canonical contract](./play-plus-2.0.md)는 바꾸지 않았다. 자동 skip, 자동 종료, 카드 범위 변경 또는 구현 승인이 아니다.

판정은 다음 순서를 사용했다.

1. 추가 request·permission·main-world interception·영속화가 필요하거나 stale/ad/old-route evidence가 실제로 수락되면 `NO-GO`다.
2. 선택한 논의 범위에서 marker category 하나 이상이 독립 positive 2개와 actual UI/time 교차 확인을 갖고 sample, negative, P0 identity, SPA stale, advertisement separation, privacy와 scope gate가 모두 통과할 때만 `READY FOR CONTRACT DISCUSSION`이다.
3. 안전 경계 위반은 없지만 필수 실제 근거가 빠지거나 의미가 불명확하면 `INSUFFICIENT EVIDENCE`다.

### 14.2 환경과 개인정보 경계

| 항목 | 결과 |
| --- | --- |
| 기준 | `origin/main` `11f1133`; qualification diff는 docs/tests only |
| 확장 | 표본 수집은 uncommitted instrumentation이 있는 production-mode `dist/`; 종료 전 instrumentation 제거 후 clean production `dist/` rebuild·reload |
| 지역 | Windows host routing을 바꾸지 않은 전용 KR gateway; region gate `PASS` |
| 인증 | 기존 signed-in 전용 profile; credential·account/profile 값은 읽거나 기록하지 않음 |
| player/DRM | movie와 episode의 실제 content video 재생 가능; `PASS` |
| native subtitle | 실제 Side Panel이 current tab에 연결되고 learning/support catalog를 기존 replay로 획득; `PASS` |
| 표본 | 익명 alias 10개: movie 8, episode 2. 이 상한에서 즉시 중단 |

표본에는 title, content/episode/asset ID, full URL, 정확한 marker time·duration, subtitle/cue text, raw response, header, token, cookie, request ID, extension ID, profile 정보, screenshot, HAR 또는 log dump를 남기지 않았다. 아래 표의 enum, count, field 이름·type과 boolean만 보존했다.

### 14.3 실제 extension 표본

`current`는 exact route/content identity와 media attachment가 관찰 시작·수락 시점에 같고 lifecycle이 `content`였다는 뜻이다. `none`은 target marker가 없다는 뜻이지 subtitle이나 player 실패라는 뜻이 아니다.

| Alias | Kind | 진입 | P0 binding | `cue_points` | 정제된 marker 구조 | Negative | 결과 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | movie | hard reload | current | array | `show_recommendations` 1 | no | PASS |
| M-02 | movie | host feed → play | current | array | `show_recommendations` 1 | no | PASS |
| M-03 | movie | host detail → play | current | array | ordered intro pair + `show_recommendations` | no | PASS |
| M-04 | movie | host detail → play | current; learning source 없음 | array | `show_recommendations` 1 | no | PASS |
| M-05 | movie | host detail → play | current; learning source 없음 | array | `show_recommendations` 1 | no | PASS |
| M-06 | movie | host detail → play | current | array | `show_recommendations` 1 | no | PASS |
| M-07 | movie | host feed → play | current; learning source 없음 | array | `show_recommendations` 1 | no | PASS |
| M-08 | movie | host feed → play | current | empty array | none | yes — empty array | PASS |
| E-01 | episode | host feed → play | current | array | ordered intro pair + `watch_next` | no | PASS |
| E-02 | episode | same-document next episode SPA | current | array | ordered intro pair + `watch_next` | no | PASS |

세 movie에서 configured learning-language source를 얻지 못한 것은 marker shape를 무효화하지 않지만, 학습 기능이 해당 marker를 소비할 수 있다는 근거도 아니다. 실제 candidate 적용 계약은 source identity까지 current인지 별도로 요구해야 한다.

actual negative M-08은 지원되는 current movie route의 shared playback shape에서 empty array를 확인한 경우다. episode marker 부재의 실제 분포까지 증명하지는 않으며, episode missing/empty는 tests-only fail-closed case로만 보완했다. 이 제한은 provider 분포를 일반화하지 않는 조건으로 contract discussion에 전달한다.

### 14.4 교차 표본 구조와 실제 UI 의미

positive entry에서 반복 관찰한 exact field set은 `force_stop`, `id`, `metadata`, `name`, `time`, `type`이었다. field type은 각각 boolean, string, string, string, finite number, string이었고 `type`은 `CODE`, `force_stop`은 `false`였다. ID와 metadata 값은 보존하지 않았다.

- 모든 positive time은 finite·nonnegative였고 source order가 감소하지 않았다.
- 관찰한 intro pair는 start가 end보다 앞섰고 terminal marker와 겹치지 않았다.
- duplicate marker name과 관찰된 content timeline 밖 marker는 없었다.
- episode에서는 marker 근처의 실제 player time으로 이동했을 때 intro와 next-episode UI signal을 각각 확인했다.
- movie의 `show_recommendations` marker 근처에서는 visible recommendation UI signal을 확인하지 못했다. 따라서 field 이름만으로 사용자 의미나 trigger 시점을 확정하지 않으며 이번 contract-discussion candidate에서 제외한다.
- 관찰 표본은 cue time과 raw duration의 서로 다른 단위를 지지했지만, private response 전반의 영구 단위 계약으로 승격하지 않는다. candidate는 actual media duration과도 독립 교차 검증해야 한다.

### 14.5 fail-closed characterization fixture

새 helper는 `*.test.ts` 내부에만 있고 production bundle로 export되지 않는다. observed six-field shape를 synthetic placeholder로 재현하며 다음 경우 candidate를 만들지 않는다.

| 조건 | tests-only 결과 |
| --- | --- |
| `cue_points` missing, null, empty, non-array | marker 없음 |
| unknown name, unqualified `show_recommendations`, unobserved `force_stop: true` 또는 field 누락·추가·type drift | 해당 entry 거부 |
| `time` non-number, non-finite, negative, raw/media duration 밖 | 해당 entry 거부 |
| intro 한쪽만 존재, duplicate, reversed/equal pair | intro interval 없음 |
| source order 감소, terminal-before-intro 또는 intro/terminal overlap | 전체 optional marker projection fail closed |
| raw duration absent·invalid | marker 없음 |
| movie/trailer/channel/highlight/unknown route 또는 waiting/placeholder/advertisement/transition lifecycle | 선택한 episode observation 전체 거부 |
| epoch, content instance, `routeChangedAt`, video ID/revision 또는 media attachment revision 변경 | production P0 identity로 전체 observation 거부 |
| learning/support source 또는 subtitle revision 변경 | proposed marker-consumer guard로 전체 observation 거부 |
| marker sibling null·non-array·mixed malformed, valid `text_tracks` 존재 | 기존 subtitle projection은 계속 성공 |

이 helper는 미래 production parser 설계가 아니다. 특히 duplicate 선택 순서, metadata 해석, provider drift fallback과 자동 행동은 미결정이다.

### 14.6 P0, SPA와 network proof

- positive actual observation은 current movie/episode route, current content identity, current media attachment와 lifecycle `content`에서만 기록했다.
- same-document SPA에서 이미 표본화한 movie로 진입한 뒤 replay가 완료되기 전에 feed로 돌아갔다. 지연된 old response는 expected identity, latest request와 route video guard가 모두 달라 전체 거부됐다. 새 표본이나 persistence는 만들지 않았다.
- 단일 기존 표본에서 network 기준점을 잡은 뒤 host playback request와 기존 extension replay의 동일 endpoint 성공 GET 두 건만 확인했다. 조사 코드는 직접 fetch, response relay, interceptor 또는 추가 request를 만들지 않았다. 기존 replay가 materialize한 response에서는 허용된 field 이름·type·boolean·count만 요약했고 raw body/header를 출력·복제·보존하지 않았다.
- instrumentation을 제거하고 clean production `dist/`를 reload한 같은 tab에서 실제 Side Panel이 `Connected + Advertisement`와 학습 대기 상태를 표시했다. 이후 같은 tab이 `Connected + Detected`와 nonempty native learning catalog로 복귀했다. 광고 request 존재가 아니라 제품의 실제 lifecycle 전환을 기준으로 했으므로 advertisement separation actual gate는 `PASS`다.

### 14.7 acceptance gates

| Gate | 결과 | 근거 |
| --- | --- | --- |
| exact baseline / build isolation | PASS | temporary instrumentation 미commit; 제거 뒤 `11f1133` clean production `dist/` rebuild·reload |
| installation / actual Side Panel | PASS | unpacked extension action으로 실제 Extension Pages Side Panel 확인 |
| authentication | PASS | signed-in service 진입; credential 비관찰 |
| region | PASS | 전용 gateway KR egress와 host routing 불변 |
| DRM/player access | PASS | movie·episode content video ready |
| native subtitle acquisition | PASS | current Side Panel catalog와 기존 replay 확인 |
| coverage | PASS | movie 8 + episode 2, 총 10 |
| actual negative | PASS | current movie의 empty `cue_points` |
| selected-scope positive structure | PASS | 두 독립 episode에서 ordered intro pair + `watch_next` 반복 |
| selected-scope player UI/time cross-check | PASS | 두 episode 표본에서 intro와 next-episode signal 확인 |
| current P0 binding | PASS | exact current identity/attachment/content lifecycle |
| same-document SPA stale rejection | PASS | old response 전체 거부 |
| advertisement separation actual | PASS | clean production Side Panel이 광고 중 학습을 닫고 같은 tab의 content 복귀 뒤 다시 `Detected` |
| replay isolation | PASS | host + existing replay 외 조사 request 없음 |
| subtitle isolation | PASS | marker drift synthetic cases에서 valid subtitle extraction 유지 |
| fail-closed drift | PASS | missing/malformed/unknown/partial/duplicate/order/range/unit/P0 cases |
| privacy | PASS | alias, enum, count, field name/type, boolean만 commit |
| scope | PASS | docs/tests only; production/canonical/schema/storage/manifest/network/dependency 변경 없음 |

### 14.8 최종 qualification 결과

두 독립 episode에서 ordered intro pair와 `watch_next` 구조 및 실제 intro/next UI signal을 반복 확인했고, negative, P0, SPA stale, advertisement, replay isolation, subtitle isolation, privacy와 scope gate가 모두 통과했다. 따라서 discussion candidate는 이 episode 범위로만 제한한다. `show_recommendations`는 구조 관찰만 남기고 의미·trigger가 확인될 때까지 제외한다. 추가 권한·요청·영속화 필요 또는 stale/ad evidence 수락 같은 `NO-GO` 사유는 관찰되지 않았다.

이 판정은 구현, 자동 skip/end, P1 승인, `show_recommendations` 지원 또는 canonical amendment를 허가하지 않는다.

**READY FOR CONTRACT DISCUSSION**

## 15. Issue #83 P3 Explicit Content Descriptor Acquisition Qualification — 2026-08-15

### 15.1 범위와 판정 규칙

이 절은 사용자가 명시적으로 승인한 제3자 자원봉사 KR gateway와 private discover request 경계에서 Issue #83의 **qualification-only** 결과를 기록한다. 기준은 `origin/main` `720dd6b2406392815db7c4d6b7ee29f6c62d69e1`이다. actual 조사에 사용한 Side Panel action, message, fetch와 instrumentation은 제거했고 production blob은 기준과 일치하는지 다시 확인했다. 최종 tracked 변경은 evidence와 tests only이며 production runtime, schema, Storage, manifest, permission, dependency, network 동작과 [canonical contract](./play-plus-2.0.md)는 바꾸지 않는다.

판정은 다음 순서를 사용했다.

1. 응답의 exact top-level identity와 current P0 identity가 먼저 같아야 해당 응답의 descriptor field를 관찰 후보로 받아들인다.
2. identity가 missing, malformed, mismatched이거나 lifecycle이 바뀌면 field value를 표시·비교·저장하지 않고 전체 결과를 폐기한다.
3. strict identity를 통과한 실제 표본이 없으면 field를 `NOT OBSERVED WITHIN SAMPLE`로 남기고, 요청 가능성만으로 contract discussion이나 구현을 승인하지 않는다.

### 15.2 환경, action과 개인정보 경계

| 항목 | 결과 |
| --- | --- |
| KR gateway | `ok=true`, `active=true`, KR egress, Windows host routing 불변과 서로 다른 egress를 확인. IP는 기록하지 않음 |
| KR gateway 종료 | qualification과 clean-build 회귀 뒤 `ok=true`, `active=false` 확인 |
| Coupang Play preflight | signed-in service가 준비된 상태임을 확인 |
| 확장 surface | unpacked production-mode `dist`의 action으로 연 actual Chrome Extension Pages Side Panel; 일반 extension tab으로 대체하지 않음 |
| 독립 gate | authentication, player/DRM, native-subtitle acquisition `PASS` |
| 시작 경계 | 현재 content에서 fixed Side Panel action을 실행한 뒤에만 request를 시작. pre-action GET 0 |
| request 경계 | current route identity로 만든 same-origin locale-only provisional detail target에 action당 GET 최대 1회, 전체 8회 상한, response body 1 MiB 상한 |
| credential 경계 | browser-managed session credential이 포함될 수 있는 request를 사용했지만 cookie·header·token을 열람·복사·기록하지 않음 |
| 응답 경계 | investigator는 response header와 raw body를 열람·출력·저장하지 않음. 임시 코드는 byte cap 안에서 strict JSON/identity 판정만 수행 |
| 금지 경계 | prefetch, retry, fallback, second lookup, redirect follow, other-host request, captured credential 재사용, screenshot, OCR, DOM text 수집, raw response 보존 없음 |

실제 title, content·episode·asset ID, full watched URL, query 전체, account/profile 값, request ID, header, cookie, token과 raw response는 tracked evidence와 commit 대상 파일에 남기지 않았다.

### 15.3 actual action과 GET ledger

네 observation sample은 movie 2개와 episode 2개이며 모두 English route에서 실행했다. alias와 실제 content의 mapping은 만들거나 저장하지 않았다.

| Row | 시작 context | qualification fetch delta | internal attempt | strict outcome | 수락 결과 |
| --- | --- | ---: | ---: | --- | --- |
| pre-action | non-content listing, `routeKind=unknown` | 0 | 0 | action disabled | observation 없음 |
| P3-M1 | movie/content, English route | 1 | 1 | 초기 coarse `identity missing/type/mismatch` status | reject; exact 하위 사유를 소급 적용하지 않음 |
| P3-M2 | movie/content, English route | 1 | 1 | `response-identity-missing` | reject |
| P3-E1 | episode/content, English route | 1 | 1 | `response-identity-missing` | reject |
| P3-E2 | episode/content, English route | 1 | 1 | `response-identity-missing` | reject |
| full-document navigation | 기존 English content에서 request 후 history navigation | 1 | 1 | document/lifecycle 변경 후 결과 미수락 | stale result 0 |
| Korean-route attempt | locale 전환 시도 | 0 | 0 | first-party가 action 전 English route로 복귀 | `ko` coverage `NOT REACHED` |

GET attempt ledger는 총 **5/8**에서 중단했다. 정확한 URL·header를 노출하는 DevTools network export는 만들지 않았으며, 표의 delta는 임시 fetch admission/terminal counter와 action당 단일 fetch 경로가 반환한 sanitized boolean으로 기록했다. P3-E1에서 실제 duplicate double-click을 했을 때 UI action slot은 하나 더 소비됐지만 pending lock으로 internal attempt와 qualification fetch는 각각 1회만 발생했다. 관찰 표본 네 개의 admitted action도 각각 internal attempt 1회였고 retry·fallback·second lookup은 없었다.

### 15.4 response identity와 field 관찰 결과

네 observation attempt에서 exact same-origin target, HTTP success, JSON object와 1 MiB 미만 상한은 만족했다. redirect를 따라가거나 response header·raw body를 investigator가 열람하지 않았다. 그러나 locale-only provisional direct endpoint의 JSON object에는 exact top-level `id`가 반복적으로 없었고, strict response identity gate를 통과한 응답은 0개였다. 따라서 descriptor value를 accepted observation으로 표시하거나 인간이 실제 UI와 비교하는 단계는 시작하지 않았다.

| 항목 | 판정 | 제한 |
| --- | --- | --- |
| top-level response identity | `NOT OBSERVED WITHIN SAMPLE` | provisional response object의 `id` missing; mismatch로 소급하지 않음 |
| title | `NOT OBSERVED WITHIN SAMPLE` | identity 이후 field projection이 0개 |
| release year | `NOT OBSERVED WITHIN SAMPLE` | missing·null·type·의미를 actual로 분류하지 못함 |
| season | `NOT OBSERVED WITHIN SAMPLE` | movie/episode 독립 field 관찰이 identity gate 앞에서 중단됨 |
| episode | `NOT OBSERVED WITHIN SAMPLE` | movie/episode 독립 field 관찰이 identity gate 앞에서 중단됨 |
| episode series/work title | `AMBIGUOUS` / unqualified | parent lookup은 승인 범위가 아니어서 수행하지 않음 |
| human semantic comparison | `NOT RUN` | metadata value가 strict identity 후 accepted/rendered된 적이 없음 |
| Korean locale | `NOT REACHED` | first-party English 복귀 후 request 전에 중단; `ko` GET 0 |

`id`가 없는 이유를 missing query, 다른 wrapper 또는 provider 변경 중 하나로 추정하지 않는다. 이 결과는 필요한 query를 추측하거나 request/header capture·replay, page main-world interception 또는 parent lookup으로 우회할 근거가 아니다.

### 15.5 lifecycle, Storage와 진단 경계

| Gate | 결과 | 근거 |
| --- | --- | --- |
| non-content 사전 차단 | PASS | listing의 `routeKind=unknown`에서 action disabled, GET 0 |
| explicit-initiation / one-shot | PASS | pre-action 0; admitted action당 internal attempt 1와 GET 1 |
| duplicate pending isolation | PASS | P3-E1 double-click이 second GET을 만들지 않음 |
| full-document stale discard | PASS | request 후 history navigation에서 result accepted/rendered 0 |
| same-document SPA stale discard | `NOT RUN` | full-document navigation으로 대체하지 않음 |
| advertisement separation | `NOT RUN` | 광고 상태에서 request/action을 실행하지 않음 |
| Storage non-mutation | PASS | M1·M2·E1·E2 각각에서 값을 읽지 않는 mutation observer가 `chrome.storage.local/sync/session`, Side Panel UI Web Storage와 content Web Storage의 P3 action-window 변경을 보고하지 않음 |
| clean production regression | PASS | 임시 UI·message·fetch·instrumentation 제거 뒤 실제 episode가 재생되고 P0 `content`/attachment binding과 native learning source가 복귀; P3 UI·console marker 0 |
| Side Panel console | PASS | warning 0, error 0 |
| provider-page console | scoped PASS | 기존 warning/error는 있었지만 P3 marker 0, credential marker 0 |
| network/response privacy | PASS | redirect·retry·fallback·second lookup·other-host request 0; header·raw body·credential 열람·기록 0 |

tests-only characterization은 synthetic identity와 placeholder text만 사용해 exact target, one-shot·duplicate·8회 cap, 1 MiB byte cap, HTTP·JSON·redirect 경계, independent field classification과 P0 stale rejection을 fail closed로 고정한다. 이 fixture는 actual descriptor 획득, Korean locale, advertisement, same-document SPA 또는 인간 UI 비교를 `PASS`로 바꾸지 않는다.

### 15.6 최종 qualification 결과와 후속 경계

same-origin private GET을 explicit Side Panel action에서 단 한 번 시작하고 byte·identity·lifecycle 경계를 fail closed로 적용하는 기술적 seam은 actual extension에서 확인했다. Storage는 값에 접근하지 않는 observer로 action window의 non-mutation만 확인했으며 acceptance를 차단하는 runtime gate로 사용하지 않았다. 그러나 관찰한 locale-only provisional response는 exact top-level identity를 제공하지 않아 descriptor field를 하나도 수락·표시·의미 비교하지 못했다. Korean locale, same-document SPA와 advertisement gate도 남아 있다.

**INSUFFICIENT EVIDENCE**

따라서 P3 product contract, implementation, canonical amendment, metadata 표시·저장·자동 수집, card title이나 OpenSubtitles prefill을 제안하거나 시작하지 않는다. request/header capture·replay나 page main-world interception은 후속 방법으로 권하지 않는다. 미래에 exact first-party endpoint와 query의 현재 근거를 같은 explicit-initiation, same-origin, one-shot, no-retention, no-credential-inspection과 P0 fail-closed 경계 안에서 얻는 경우에만 별도 qualification Issue로 다시 판단한다.
