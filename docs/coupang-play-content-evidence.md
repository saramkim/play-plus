# Coupang Play Content and Runtime Evidence

상태: **2026-08-14 시점의 비규범적 조사 기록**

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

## 9. 구현 가능성 후보

아래 순서는 이후 논의를 위한 Codex 권고이며 승인된 2.0 roadmap이 아니다. 각 항목은 구현 지시 전에 ChatGPT 검토, 사용자 승인과 canonical contract 개정 여부를 판단한다.

| 우선순위 후보 | 사용자 결과 | 이용 가능한 근거 | 기술 판단 | 아직 필요한 결정 |
| --- | --- | --- | --- | --- |
| P0 Content and Runtime Spine | 현재 콘텐츠가 영화·에피소드·트레일러·라이브·하이라이트인지 알고 관찰 가능한 runtime에서만 안전한 기능을 활성화 | route suffix, playback `titleType`, lifecycle | kind와 runtime 축은 높음. 새 metadata request 없이 시작 가능하지만 공개 예정·entitlement 판정은 별도 POC 필요 | 지원 kind, unknown과 UI 문구, fail-closed 동작 |
| P1 Playback Markers | intro 경계와 다음 화·추천 화면 전에 반복·Mission을 안전하게 끝냄 | 기존 playback replay의 `cue_points` | 높음. optional parser 가능 | marker별 의미, missing/drift fallback, 자동 행동 여부 |
| P2 Subtitle Variant Compatibility | `ko sdh` 같은 실제 provider track을 잃지 않고 명시적으로 선택 | playback `text_tracks` | 높음. 현재 gap이 구체적 | normalization, SDH 표시, 동일 언어 복수 track 우선순위 |
| P3 Explicit Content Descriptor | 사용자 요청 때 작품명·연도·시즌·회차를 보여 주거나 검색 입력 후보로 사용 | title/episode/clip/event response | 데이터는 충분하지만 획득 POC 필요 | explicit action, 전송·보존 범위, locale, private API failure UX |
| Later Content Library | artwork, synopsis, 영상별 grouping/search | discover metadata | 기술적으로 가능하나 범위·유지비 큼 | 자동 수집·영속 schema·refresh·privacy 전체 계약 |
| Later Live/Sports Learning | live DVR와 스포츠에 학습 기능 제공 | event/playback/runtime | 현재 표본으로는 부족 | entitlement, live seek window, subtitles, end/restore semantics |

### P0 POC에서 우선 검증할 proposed state inventory

아래 값은 구현 계약이 아니라 POC와 후속 논의에서 반례를 찾기 위한 working vocabulary다.

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

세 축을 한 enum으로 합치지 않는 것이 현재 권고다. 예를 들어 `episode + advertisement + no-compatible-subtitle`처럼 서로 독립적으로 바뀔 수 있다.

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

## 12. 현재 결론

1. Coupang Play에는 콘텐츠 종류, localized title, 시즌·회차, 공개 상태, 언어, artwork와 live/event를 설명하는 충분한 구조화 데이터가 있다.
2. 기존 playback replay에는 intro/end marker, 실제 subtitle track variant와 source capability가 있어 추가 permission 없이 확장 가능한 좁은 seam이 있다.
3. metadata 설정만으로 광고, preview, live와 실제 자막 가용성을 판정할 수 없다. route identity, playback response와 runtime video/DOM을 함께 사용해야 한다.
4. Codex가 후속 논의에 먼저 제안하는 후보는 자동 metadata 수집이 아니라 content kind, lifecycle와 capability를 분리하는 transient safety spine이다.
5. 제목·시즌·회차 descriptor는 기술적으로 가능하지만 실제 extension 획득 POC, explicit initiation, non-persistence와 private API failure 계약을 먼저 정해야 한다.
