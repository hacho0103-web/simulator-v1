# 저층부 형태 시뮬레이터 — Codex 인계 문서

> 이 문서는 Claude Code에서 개발 중인 시뮬레이터의 현재 상태를 정리한 것입니다.
> 코덱스에서 새 규칙셋을 작성한 뒤 이 프로젝트에 다시 통합할 예정입니다.

---

## 프로젝트 개요

도시 설계 가이드라인의 파라미터를 조작해 건물 매스를 실시간 3D로 시뮬레이션하는 리서치 프로토타입.
각 도시·지구별 가이드라인을 **규칙셋(RULE_SETS)** 으로 정의하고, 동일한 파라미터 체계로 비교 분석한다.

**스택:** React 19 + Vite / Three.js + @react-three/fiber / Recharts / Tailwind CSS v4

---

## 파라미터 체계 (PARAM_META)

규칙셋은 아래 16개 파라미터로 정의된다. 모든 수치는 숫자형.

| key | label | unit | min | max | 그룹 |
|-----|-------|------|-----|-----|------|
| `lot_coverage_ratio` | 건폐율 | % | 10 | 100 | 법적 규제 |
| `floor_area_ratio` | 용적률 | % | 100 | 1500 | 법적 규제 |
| `height_limit` | 높이 제한 | m | 15 | 300 | 법적 규제 |
| `front_setback` | 전면 후퇴 | m | 0 | 15 | 전면공간 |
| `side_setback` | 측면 후퇴 | m | 0 | 10 | 전면공간 |
| `public_open_space_ratio` | 공개공지 | % | 0 | 30 | 전면공간 |
| `pedestrian_path_width` | 보행통로 폭 | m | 1 | 10 | 전면공간 |
| `ground_floor_height` | 저층부 층고 | m | 3 | 10 | 저층부 형태 |
| `facade_transparency` | 입면 투명도 | % | 0 | 100 | 저층부 형태 |
| `retail_continuity` | 상업 연속성 | % | 0 | 100 | 저층부 형태 |
| `canopy_depth` | 캐노피 깊이 | m | 0 | 4 | 저층부 형태 |
| `canopy_continuity` | 캐노피 연속성 | % | 0 | 100 | 저층부 형태 |
| `pilotis_ratio` | 필로티 기둥 밀도 | % | 0 | 100 | 저층부 형태 |
| `pilotis_depth` | 필로티 깊이 | m | 0 | 8 | 저층부 형태 |
| `passage_width` | 공용통로 폭 | m | 0 | 8 | 저층부 형태 |
| `entrance_frequency` | 출입구 빈도 | 개/100m | 1 | 20 | 가로 활성도 |
| `inactive_frontage_ratio` | 비활성 전면 비율 | % | 0 | 100 | 가로 활성도 |
| `night_activity` | 야간 활성화 지수 | % | 0 | 100 | 가로 활성도 |

### 핵심 파라미터 설명

- **pilotis_depth** (NEW): 저층부 전면을 실제로 개방하는 깊이. 0이면 폐쇄형, 2~4m이면 기둥+천장 슬래브 구조가 3D로 표현됨.
- **passage_width** (NEW): 건물 중앙을 관통하는 공용 보행통로. 0이면 없음, 3m 이상이면 건물이 좌/우 블록+브릿지 슬래브로 분리됨.
- **pilotis_ratio**: `pilotis_depth > 0`일 때 필로티 구간 내 기둥 밀도.
- **inactive_frontage_ratio**: 낮을수록 좋음 (비활성 전면이 적을수록 가로가 활성화).

---

## 3D 시각화 로직

### 직사각형 단일 건물 모드 (기본)

대지: 50m × 80m 고정 (`DEFAULT_LOT`)

저층부는 파라미터에 따라 실제 형태가 달라진다:

| 조건 | 형태 변화 |
|------|----------|
| `passage_width > 0` | 저층부를 좌/우 블록으로 분리 + 브릿지 슬래브 + 녹색 통로 바닥 |
| `pilotis_depth > 0` | 전면 일정 깊이 개방 → 기둥 + 하늘색 바닥 + 천장 슬래브 |
| `canopy_depth > 0` | 전면 상단 캐노피 돌출 |
| `facade_transparency` | 파사드 투명도 레이어 |
| `retail_continuity` | 주황색 상업 연속 구간 오버레이 |

### 광화문 실제 지도 모드

- 건물 데이터: **브이월드 WFS** (`lt_c_uq011`) → 실제 층수(`grnd_flr`) + 높이(`bld_hgt`) 반영
- 도로 데이터: Overpass API
- 건물 클릭 시 **브이월드 data API** (`LT_C_UD001`)로 용도지역 조회
- 조회된 용도지역 → 서울시 조례 법적 한도 테이블로 매핑
- **서울 현행 규칙셋 선택 시**: 법적 한도가 슬라이더에 자동 반영
- **다른 규칙셋 선택 시**: 용도지역 정보만 표시, 슬라이더 미변경 (규칙셋 우선)

---

## 6개 분석 축 (점수 계산)

모든 점수는 0~100점.

| 축 | 핵심 파라미터 |
|----|-------------|
| 공개성 (Publicness) | 공개공지 + 캐노피 연속성 + 필로티 비율 |
| 보행성 (Walkability) | 보행통로 폭 + 출입구 빈도 + 캐노피 깊이 |
| 전면공간 (Setback) | 전면 후퇴 |
| 체류성 (Dwellability) | 공개성 + 전면공간 + 야간 활성화 |
| 입면개방성 (FacadeOpenness) | 투명도 + 상업연속성 + 비활성전면(반전) |
| 사업성 (Developability) | 용적률 |

- `pIndex` = 공공성 5개 축 평균
- `dIndex` = 사업성

---

## 현재 규칙셋 목록

`src/data/rulesets.js`에 정의. 현재 4개:

```
seoul      서울 (현행)        — 기본값, 법적 규제 기준
tokyo      도쿄 마루노우치    — 고밀도, 높은 보행성
hafencity  함부르크 하펜시티  — 중밀도, 높은 공개성
hybrid     혼합 (서울+해외)   — 서울 법제 + 해외 저층부 적용
```

> ⚠️ 현재 수치는 모두 추정치. 실제 가이드라인 원문 확인 필요.

---

## 코덱스가 작성해야 할 규칙셋 형식

`RULE_SETS` 객체에 아래 구조로 추가하면 된다:

```js
export const RULE_SETS = {
  // ... 기존 seoul, tokyo, hafencity, hybrid ...

  marunouchi_detailed: {
    id: 'marunouchi_detailed',
    name: '마루노우치 상세',
    nameEn: 'Marunouchi Detailed',
    color: '#EF4444',   // 3D 뷰어에서 저층부 색상
    params: {
      lot_coverage_ratio: 80,
      floor_area_ratio: 1300,
      height_limit: 200,
      front_setback: 5,
      side_setback: 0,
      public_open_space_ratio: 18,
      pedestrian_path_width: 5,
      ground_floor_height: 6,
      facade_transparency: 60,
      retail_continuity: 80,
      canopy_depth: 2,
      canopy_continuity: 75,
      pilotis_ratio: 15,
      pilotis_depth: 2,       // 실제 필로티 공간 깊이
      passage_width: 0,       // 공용통로 없으면 0
      entrance_frequency: 8,
      inactive_frontage_ratio: 10,
      night_activity: 65,
    },
    notes: '출처 및 근거 기재',
  },
};
```

### color 팔레트 (기존과 겹치지 않게)

- 서울: `#3B82F6` (blue)
- 도쿄: `#EF4444` (red)
- 하펜시티: `#10B981` (green)
- 혼합: `#F59E0B` (amber)
- **신규 규칙셋은 다른 색 사용 권장**: `#8B5CF6` (violet), `#06B6D4` (cyan), `#EC4899` (pink) 등

---

## 규칙셋 작성 가이드라인

### pilotis_depth / passage_width 활용

형태적 특성이 강한 가이드라인일수록 이 두 파라미터를 적극 활용:

- **아케이드형** (볼로냐, 도쿄 일부): `pilotis_depth: 3~5`, `pilotis_ratio: 30~50`
- **공용통로형** (홍콩 일부, 서울 일부 지구단위): `passage_width: 3~6`
- **필로티 없는 밀집형** (서울 현행): 둘 다 0

### 주의사항

- `passage_width`는 `width - 4`(최소 양측 날개 2m) 이상이면 무시됨 — 현실적으로 최대 6m
- `pilotis_depth`가 저층부 depth보다 크면 무시됨 — 최대 6m 권장
- `inactive_frontage_ratio`는 낮을수록 좋은 값 (0 = 전면 전체 활성, 100 = 전면 전체 비활성)

---

## 파일 구조 요약

```
src/
  data/
    rulesets.js        ← 규칙셋 추가할 파일 (PARAM_META + RULE_SETS)
  utils/
    scoring.js         ← 점수 계산 로직 (수정 불필요)
  components/
    ParameterPanel.jsx ← 슬라이더 패널 (수정 불필요)
    BuildingMass.jsx   ← 3D 뷰어 (수정 불필요)
    AnalysisRadar.jsx  ← 레이더 차트 (수정 불필요)
    ScatterPlot.jsx    ← 산점도 (수정 불필요)
public/
  gwanghwamun.geojson  ← 광화문 건물 footprint
```

**규칙셋만 추가한다면 `src/data/rulesets.js`만 수정하면 됩니다.**

---

## 작업 흐름 요약

```
코덱스에서 규칙셋 작성
  → rulesets.js의 RULE_SETS에 새 항목 추가
  → Claude Code에 전달
  → 시뮬레이터에서 즉시 확인 가능 (npm run dev)
```
