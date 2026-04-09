# simulator-v1

저층부 형태 시뮬레이터 — 도시 가이드라인의 형태 생성 규칙화 바이브 코딩 프로토타입

## 프로젝트 개요

도시 설계 가이드라인 파라미터를 조작해 건물 매스를 실시간 3D로 시뮬레이션하고, 공개성·보행성 등 6개 축으로 분석하는 리서치 프로토타입.

## 스택

- **React 19 + Vite 8**
- **Three.js / @react-three/fiber** — 3D 건물 매스 렌더링
- **Recharts** — 레이더 차트, 산점도
- **Tailwind CSS v4**

## 주요 명령어

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
```

## 핵심 구조

```
src/
  data/rulesets.js       # 도시별 파라미터 세트 (서울·도쿄·하펜시티·혼합)
  utils/scoring.js       # 6개 축 점수 계산 + 건물 매스 치수 계산
  components/
    ParameterPanel.jsx   # 왼쪽 슬라이더 패널
    BuildingMass.jsx     # 3D 뷰어 (일반 매스 + GeoJSON 광화문 모드)
    AnalysisRadar.jsx    # 레이더 차트
    ScatterPlot.jsx      # P-index vs D-index 산점도
    ExportButtons.jsx    # CSV/PNG 내보내기
    GeminiRender.jsx     # AI 렌더링 (Gemini)
public/
  gwanghwamun.geojson    # 광화문 일대 건물 footprint 데이터
```

## 데이터 모델

### PARAM_META (rulesets.js)
파라미터 정의 (label, unit, min, max, step, group, description).  
그룹: `법적 규제` / `전면공간` / `저층부 형태` / `가로 활성도`

### RULE_SETS (rulesets.js)
도시별 파라미터 값 세트. `id`, `name`, `color`, `params`, `notes` 포함.  
⚠️ 현재 수치는 추정치 — 실제 가이드라인 원문으로 업데이트 필요.

### calculateScores (scoring.js)
파라미터 → 6개 점수 (0~100):
- `publicness` 공개성 / `walkability` 보행성 / `setback` 전면공간
- `dwellability` 체류성 / `facadeOpenness` 입면개방성 / `developability` 사업성
- `pIndex` = 공공성 5개 축 평균, `dIndex` = 사업성

## 광화문 지도 모드

헤더의 "광화문 지도" 버튼으로 토글.  
`BuildingMass.jsx`의 `useGeoJSONScene` 훅이:
1. `/gwanghwamun.geojson` (로컬) — 건물 footprint 로드
2. Overpass API (외부) — 도로 데이터 로드

**알려진 문제:** Overpass 공개 서버가 504 타임아웃을 자주 냄.  
해결 방향: 도로 데이터를 로컬 파일로 미리 저장하거나 vWorld API로 교체.

## 주의사항

- `rulesets.js`의 파라미터 수치는 추정치이므로 실제 조례·가이드라인 원문 확인 후 업데이트할 것
- `DEFAULT_LOT`은 50m × 80m 고정 — 변경 시 scoring.js의 정규화 범위도 함께 검토

## AI 협업 규칙

- **git commit, git push는 사용자가 명시적으로 요청할 때만 실행한다. 절대 임의로 커밋하거나 푸시하지 않는다.**
