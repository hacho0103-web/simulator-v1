/**
 * 도시별 저층부 가이드라인 파라미터 집합 (논문 3단계: 규칙 파라미터화)
 *
 * ⚠️ 중요: 아래 수치는 사례 조사(논문 3장)에서 가이드라인 원문을 확인한 후
 * 실제 값으로 업데이트해야 합니다.
 * 현재 값은 참고용 추정치입니다.
 */

export const PARAM_META = {
  // ── 법적 규제 ────────────────────────────────
  lot_coverage_ratio: {
    label: '건폐율',
    unit: '%',
    min: 10, max: 100, step: 1,
    group: '법적 규제',
    description: '대지면적 대비 건물 바닥면적 비율',
  },
  floor_area_ratio: {
    label: '용적률',
    unit: '%',
    min: 100, max: 1500, step: 50,
    group: '법적 규제',
    description: '대지면적 대비 건물 연면적 비율',
  },
  height_limit: {
    label: '높이 제한',
    unit: 'm',
    min: 15, max: 300, step: 5,
    group: '법적 규제',
    description: '건물 최고 높이 제한',
  },

  // ── 전면공간 ─────────────────────────────────
  front_setback: {
    label: '전면 후퇴',
    unit: 'm',
    min: 0, max: 15, step: 0.5,
    group: '전면공간',
    description: '도로 경계선으로부터 건물까지의 후퇴 거리',
  },
  side_setback: {
    label: '측면 후퇴',
    unit: 'm',
    min: 0, max: 10, step: 0.5,
    group: '전면공간',
    description: '인접 대지 경계선으로부터의 후퇴 거리',
  },
  public_open_space_ratio: {
    label: '공개공지',
    unit: '%',
    min: 0, max: 30, step: 1,
    group: '전면공간',
    description: '대지면적 대비 공개공지 최소 비율',
  },
  pedestrian_path_width: {
    label: '보행통로 폭',
    unit: 'm',
    min: 1, max: 10, step: 0.5,
    group: '전면공간',
    description: '저층부 전면 보행통로 최소 폭',
  },

  // ── 저층부 형태 ───────────────────────────────
  ground_floor_height: {
    label: '저층부 층고',
    unit: 'm',
    min: 3, max: 10, step: 0.5,
    group: '저층부 형태',
    description: '1층 바닥에서 2층 바닥까지의 높이',
  },
  facade_transparency: {
    label: '입면 투명도',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '저층부 형태',
    description: '저층부 전면 입면 중 투명 재료 비율',
  },
  retail_continuity: {
    label: '상업 연속성',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '저층부 형태',
    description: '저층부 전면 입면 중 상업 활성 구간 비율',
  },
  canopy_depth: {
    label: '캐노피 깊이',
    unit: 'm',
    min: 0, max: 4, step: 0.5,
    group: '저층부 형태',
    description: '저층부 전면에서 돌출된 캐노피/처마 깊이',
  },
  canopy_continuity: {
    label: '캐노피 연속성',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '저층부 형태',
    description: '전면 폭 대비 캐노피가 연속되는 비율',
  },
  pilotis_ratio: {
    label: '필로티 비율',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '저층부 형태',
    description: '저층부 전면 폭 중 기둥+개방 구간 비율',
  },

  // ── 가로 활성도 ───────────────────────────────
  entrance_frequency: {
    label: '출입구 빈도',
    unit: '개/100m',
    min: 1, max: 20, step: 1,
    group: '가로 활성도',
    description: '전면 가로 100m당 건물 출입구 수',
  },
  inactive_frontage_ratio: {
    label: '비활성 전면 비율',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '가로 활성도',
    description: '전면 입면 중 블라인드 월·주차장·설비 등 비활성 구간 비율 (낮을수록 좋음)',
  },
  night_activity: {
    label: '야간 활성화 지수',
    unit: '%',
    min: 0, max: 100, step: 5,
    group: '가로 활성도',
    description: '야간(18시 이후) 저층부 용도 운영 비율',
  },
};

export const RULE_SETS = {
  seoul: {
    id: 'seoul',
    name: '서울 (현행)',
    nameEn: 'Seoul',
    color: '#3B82F6',
    params: {
      lot_coverage_ratio: 60,
      floor_area_ratio: 800,
      height_limit: 100,
      front_setback: 1,
      side_setback: 0,
      public_open_space_ratio: 10,
      pedestrian_path_width: 1.5,
      ground_floor_height: 4,
      facade_transparency: 30,
      retail_continuity: 40,
      canopy_depth: 0,
      canopy_continuity: 10,
      pilotis_ratio: 5,
      entrance_frequency: 3,
      inactive_frontage_ratio: 45,
      night_activity: 35,
    },
    notes: '⚠️ 실제 수치는 서울특별시 건축 조례, 공개공지 설치 기준, 지구단위계획 지침 원문 확인 필요',
  },
  tokyo: {
    id: 'tokyo',
    name: '도쿄 마루노우치',
    nameEn: 'Tokyo Marunouchi',
    color: '#EF4444',
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
      entrance_frequency: 8,
      inactive_frontage_ratio: 10,
      night_activity: 65,
    },
    notes: '⚠️ 실제 수치는 도쿄 도시재생특별지구 지침, 마루노우치 도시정비 가이드라인 원문 확인 필요',
  },
  hafencity: {
    id: 'hafencity',
    name: '함부르크 하펜시티',
    nameEn: 'Hamburg HafenCity',
    color: '#10B981',
    params: {
      lot_coverage_ratio: 70,
      floor_area_ratio: 500,
      height_limit: 40,
      front_setback: 4,
      side_setback: 2,
      public_open_space_ratio: 20,
      pedestrian_path_width: 4,
      ground_floor_height: 5,
      facade_transparency: 70,
      retail_continuity: 75,
      canopy_depth: 1.5,
      canopy_continuity: 70,
      pilotis_ratio: 20,
      entrance_frequency: 10,
      inactive_frontage_ratio: 8,
      night_activity: 70,
    },
    notes: '⚠️ 실제 수치는 HafenCity Hamburg Development Guidelines 원문 확인 필요',
  },
  hybrid: {
    id: 'hybrid',
    name: '혼합 (서울+해외)',
    nameEn: 'Hybrid',
    color: '#F59E0B',
    params: {
      lot_coverage_ratio: 65,
      floor_area_ratio: 900,
      height_limit: 120,
      front_setback: 3,
      side_setback: 1,
      public_open_space_ratio: 15,
      pedestrian_path_width: 3,
      ground_floor_height: 5,
      facade_transparency: 50,
      retail_continuity: 60,
      canopy_depth: 1,
      canopy_continuity: 50,
      pilotis_ratio: 10,
      entrance_frequency: 6,
      inactive_frontage_ratio: 25,
      night_activity: 50,
    },
    notes: '서울 법·제도 기반에 마루노우치·하펜시티 저층부 가이드라인 일부 적용한 실험 세트',
  },
};

export const DEFAULT_LOT = {
  width: 50,
  depth: 80,
};
