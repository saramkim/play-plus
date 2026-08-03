# Play Plus

**Play Plus**는 Coupang Play 경험을 향상시키는 Chrome 확장 프로그램입니다. 이중 자막, 파일·온라인 자막 추가, 반복 재생 등 언어 학습을 위한 다양한 기능을 제공합니다.

> 현재 배포 버전은 v1.11.0입니다. 언어 학습 중심으로 재구성하는 Play Plus 2.0 작업은 반드시 [`docs/play-plus-2.0.md`](docs/play-plus-2.0.md)의 승인된 제품·데이터·마이그레이션 계약을 기준으로 진행합니다. 이 문서는 현재 배포 기능 설명이 아니라 이후 2.0 구현의 canonical contract입니다.

## 주요 기능

### 자막 기능
- **이중 자막 지원**: 원본 자막과 번역 자막을 동시에 표시
- **자막 추가**: 로컬 SRT, VTT, SMI 파일을 추가하거나 OpenSubtitles에서 검색·다운로드하여 사용
- **자막 분석**: 전체 자막을 시간 순으로 표시
- **자막 커스터마이징**: 자막 스타일, 위치, 크기, 색상 등 세부 조정
- **자막 저장**: 다시 보고 싶은 자막을 저장

### 비디오 제어 기능
- **재생 속도 조절**: 0.1x 단위 재생 속도 조절
- **루프 재생**: 특정 구간 반복 재생 (전체/자막 단위)
- **스킵 기능**: 자막/시간 단위 영상 이동 기능
- **포커스 모드**: 몰입 학습을 위해 이전/다음 자막도 함께 표시
- **키보드 단축키**: 빠른 비디오 제어

### 학습 최적화
- **학습 프리셋**: 언어 학습에 최적화된 설정 프리셋 제공
- **자막 복습**: 저장된 자막을 다시 확인하며 학습
- **다국어 지원**: 영어, 한국어 지원


## 설치 방법

### Chrome 웹 스토어
[Chrome 웹 스토어에서 설치하기](https://chromewebstore.google.com/detail/dmpmihmopccgeieooepklikeacdhkbki?utm_source=item-share-cb)


### 개발 빌드 설치
1. 저장소를 클론합니다:
   ```bash
   git clone <repository-url>
   cd play-plus
   ```

2. 의존성을 설치합니다:
   ```bash
   yarn install
   ```

3. 프로덕션 빌드를 실행합니다:
   ```bash
   yarn build
   ```

4. Chrome에서 확장 프로그램을 로드합니다:
   - Chrome에서 `chrome://extensions/` 접속
   - "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - `dist/` 디렉토리 선택

## 개발 환경 설정

### 필수 요구사항
- **Node.js**: 22–24
- **Yarn**: 패키지 매니저 (v4.9.1)

### OpenSubtitles 개발 설정

온라인 자막 검색을 개발할 때는 `.env.example`을 Git에서 제외되는 `.env.local`로 복사한 뒤 다음 값을 설정합니다.

```dotenv
OPENSUBTITLES_API_KEY=your-dedicated-play-plus-consumer-key
```

`OPENSUBTITLES_API_KEY`는 Play Plus 전용 consumer key를 사용합니다. 이 값은 배포 번들에 포함되어 사용자가 추출할 수 있는 공개 credential이며 비밀 정보로 간주할 수 없지만, 실제 키를 저장소에 커밋하지는 않습니다. `OPENSUBTITLES_USER_AGENT`는 선택 사항이며 설정하지 않으면 현재 패키지 버전에서 기본값을 생성합니다. 공유 consumer 배포에 대한 OpenSubtitles 승인과 로그인/JWT 없이 동작하는 실제 검색·다운로드 및 허용 호스트 확인은 릴리스 전 필수 검증 항목입니다.

온라인 검색은 사용자가 **검색**을 실행한 뒤에만 입력한 제목, 언어와 선택 필터를 OpenSubtitles로 전송합니다. 결과 카드에는 영상 적합성을 판단할 release·작품·FPS·CD 정보와 OpenSubtitles가 제공한 번역 특성·평점·다운로드·신뢰 출처 신호가 조건부로 표시됩니다. 이 신호는 안전이나 품질을 보증하지 않습니다. 선택한 자막은 Play Plus의 로컬 저장소에 추가되며 자동으로 메인 또는 서브 자막을 덮어쓰지 않습니다. OpenSubtitles 접근은 선택적 Chrome 권한이고, 거부해도 로컬 파일 추가는 계속 사용할 수 있습니다. 온라인 자막은 [OpenSubtitles](https://www.opensubtitles.com/)에서 제공합니다.

### 개발 서버 실행
```bash
# 개발 모드로 빌드 및 파일 변경 감지
yarn dev
```

### 빌드 명령어
```bash
# 프로덕션 빌드
yarn build

# 개발 빌드
yarn build:dev

# 타입 체크
yarn type-check

# 린트 검사
yarn lint

# 린트 자동 수정
yarn lint:fix
```

개발 환경과 작업 규칙은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## 기술 스택

### 핵심 기술
- **React 19**: UI 라이브러리
- **TypeScript 5.8**: 정적 타입 체크
- **Zustand 5**: 상태 관리
- **React Hook Form 7**: 폼 관리
- **Zod 3**: 스키마 검증

### 빌드 도구
- **Webpack 5**: 모듈 번들링
- **Babel**: TypeScript/React 트랜스파일링
- **PostCSS**: CSS 후처리

### 스타일링
- **Tailwind CSS 4**: 유틸리티 기반 CSS 프레임워크
- **Radix UI**: 접근성 우선 UI 컴포넌트
- **shadcn/ui**: 컴포넌트 라이브러리

### 코드 품질
- **ESLint 9**: 코드 품질 관리
- **TypeScript**: 엄격 모드 활성화

## 프로젝트 구조

```
play-plus/
├── dist/                # 빌드 결과물
├── public/              # 정적 파일 (manifest.json, icons, locales)
├── src/                 # 소스 코드
│   ├── assets/         # 정적 자산
│   ├── background/     # 백그라운드 서비스 워커
│   ├── content/        # 콘텐츠 스크립트
│   ├── storage/        # Chrome Storage 관리
│   ├── ui/             # React 기반 UI 앱
│   ├── utils/          # 유틸리티 함수
│   └── type.d.ts       # 전역 타입 정의
├── components.json      # shadcn/ui 설정
├── eslint.config.mjs   # ESLint 설정
├── package.json        # 프로젝트 의존성
├── postcss.config.js   # PostCSS 설정
├── tsconfig.json       # TypeScript 설정
└── webpack.config.js   # Webpack 빌드 설정
```

프로젝트 구조와 작업 규칙은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## 아키텍처

Play Plus는 **Chrome 확장 프로그램 Manifest V3**를 기반으로 하며, 세 가지 주요 진입점으로 구성됩니다:

1. **UI 앱** (`src/ui/`): 사이드 패널에서 실행되는 React 앱
2. **백그라운드 스크립트** (`src/background/`): 서비스 워커
3. **콘텐츠 스크립트** (`src/content/`): 웹 페이지에 주입되는 스크립트

아키텍처와 컨텍스트별 역할은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## 커밋 컨벤션

이 프로젝트는 [Conventional Commits](https://www.conventionalcommits.org/) 형식을 따릅니다.

### 형식
```
<type>(<scope>): <subject>

<body>
```

### 주요 타입
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링
- `chore`: 빌드, 설정, 도구 관련 변경
- `docs`: 문서 변경

커밋 규칙은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## 라이선스

ISC

## 기여하기

기여를 환영합니다. Play Plus는 `main`을 통합 브랜치로 사용합니다. 제품·UX·아키텍처·공개 동작처럼 결정이 필요한 작업은 먼저 Issue로 범위를 확정하고, 최신 `main`에서 작업 브랜치를 만든 뒤 `main` 대상 Pull Request를 제출해주세요. 명확한 단순 수정은 Issue 없이 Pull Request를 제출할 수 있습니다. 실제 릴리스는 릴리스 커밋과 `v<version>` 태그로 구분합니다.

Play Plus 2.0의 승인된 제품·마이그레이션 범위는 [`docs/play-plus-2.0.md`](docs/play-plus-2.0.md), 자세한 Issue, ChatGPT 협업과 Pull Request 절차는 [`docs/development-workflow.md`](docs/development-workflow.md), 사람이 명시적으로 활성화하는 선택적 다중 Issue 실행·검토·병합 workflow는 [`docs/batch-relay.md`](docs/batch-relay.md), 개발·Git·검증 규칙은 [`AGENTS.md`](AGENTS.md)를 참고하세요.

## 버전

현재 버전: **v1.11.0**

## 문의

이슈나 문의사항이 있으시면 GitHub Issues를 이용해주세요.
