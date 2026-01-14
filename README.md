# Play Plus

**Play Plus**는 Coupang Play 경험을 향상시키는 Chrome 확장 프로그램입니다. 이중 자막, 자막 업로드, 반복 재생 등 언어 학습을 위한 다양한 기능을 제공합니다.

## 주요 기능

### 자막 기능
- **이중 자막 지원**: 원본 자막과 번역 자막을 동시에 표시
- **자막 업로드**: 자막 파일을 업로드하여 사용
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
- **Node.js**: 최신 LTS 버전 권장
- **Yarn**: 패키지 매니저 (v4.9.1)

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

자세한 개발 환경 설정은 [`.cursor/rules/development-setup.mdc`](.cursor/rules/development-setup.mdc)를 참고하세요.

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
├── .cursor/              # Cursor IDE 설정 및 룰
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

자세한 프로젝트 구조는 [`.cursor/rules/project-structure.mdc`](.cursor/rules/project-structure.mdc)를 참고하세요.

## 아키텍처

Play Plus는 **Chrome 확장 프로그램 Manifest V3**를 기반으로 하며, 세 가지 주요 진입점으로 구성됩니다:

1. **UI 앱** (`src/ui/`): 사이드 패널에서 실행되는 React 앱
2. **백그라운드 스크립트** (`src/background/`): 서비스 워커
3. **콘텐츠 스크립트** (`src/content/`): 웹 페이지에 주입되는 스크립트

자세한 아키텍처 설명은 [`.cursor/rules/source-code-structure.mdc`](.cursor/rules/source-code-structure.mdc)를 참고하세요.

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

자세한 커밋 컨벤션은 [`.cursor/rules/commit-conventions.mdc`](.cursor/rules/commit-conventions.mdc)를 참고하세요.

## 라이선스

ISC

## 기여하기

기여를 환영합니다! 이슈를 등록하거나 Pull Request를 제출해주세요.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat(scope): add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 버전

현재 버전: **v1.9.3**

## 문의

이슈나 문의사항이 있으시면 GitHub Issues를 이용해주세요.