/**
 * 저층부 형태 분석 점수 계산 (논문 5단계: 분석 평가)
 * 6개 분석 축 → 0~100점 환산
 */

/** 선형 정규화: value를 [min, max] 범위에서 [0, 100]으로 변환 */
function normalize(value, min, max) {
  const clamped = Math.min(Math.max(value, min), max);
  return Math.round(((clamped - min) / (max - min)) * 100);
}

/**
 * 파라미터 집합으로부터 6개 분석 축 점수를 계산한다.
 * @param {Object} params
 * @returns {{ publicness, walkability, setback, dwellability, facadeOpenness, developability, pIndex, dIndex }}
 */
export function calculateScores(params) {
  // 1. 공개성 (Publicness): 공개공지 + 캐노피 연속성 + 필로티
  const publicness = Math.round(
    normalize(params.public_open_space_ratio, 0, 20) * 0.45 +
    normalize(params.canopy_continuity ?? 0, 0, 100) * 0.30 +
    normalize(params.pilotis_ratio ?? 0, 0, 100) * 0.25
  );

  // 2. 보행성 (Walkability): 보행통로 폭 + 출입구 빈도 + 캐노피 깊이
  const walkability = Math.round(
    normalize(params.pedestrian_path_width, 1, 6) * 0.35 +
    normalize(params.entrance_frequency ?? 1, 1, 20) * 0.40 +
    normalize(params.canopy_depth ?? 0, 0, 4) * 0.25
  );

  // 3. 전면공간 (Setback): 전면 후퇴 거리
  const setback = normalize(params.front_setback, 0, 10);

  // 4. 체류성 (Dwellability): 공개성 + 전면공간 + 야간 활성화
  const dwellability = Math.round(
    publicness * 0.30 +
    setback * 0.30 +
    normalize(params.night_activity ?? 0, 0, 100) * 0.40
  );

  // 5. 입면개방성 (FacadeOpenness): 투명도 + 상업연속성 + 비활성전면(반전)
  const facadeOpenness = Math.round(
    normalize(params.facade_transparency, 0, 100) * 0.35 +
    normalize(params.retail_continuity, 0, 100) * 0.35 +
    normalize(100 - (params.inactive_frontage_ratio ?? 0), 0, 100) * 0.30
  );

  // 6. 사업성 (Developability): 용적률
  const developability = normalize(params.floor_area_ratio, 100, 1500);

  // P-index: 공공성 관련 5개 축 평균
  const pIndex = Math.round(
    (publicness + walkability + setback + dwellability + facadeOpenness) / 5
  );

  // D-index: 사업성
  const dIndex = developability;

  return {
    publicness,
    walkability,
    setback,
    dwellability,
    facadeOpenness,
    developability,
    pIndex,
    dIndex,
  };
}

/**
 * 3D 매스 생성에 필요한 건물 형태 계산
 */
export function calculateMass(params, lot) {
  const lotArea = lot.width * lot.depth;

  const footprintArea = lotArea * (params.lot_coverage_ratio / 100);
  const openSpaceArea = lotArea * (params.public_open_space_ratio / 100);
  const openSpaceDepth = Math.min(openSpaceArea / lot.width, lot.depth * 0.3);
  const effectiveDepth = lot.depth - openSpaceDepth;

  const buildingWidth = lot.width - params.side_setback * 2;
  const buildingDepth = Math.min(
    footprintArea / buildingWidth,
    effectiveDepth - params.front_setback
  );

  const actualFootprint = buildingWidth * buildingDepth;
  const totalFloorArea = lotArea * (params.floor_area_ratio / 100);
  const floorCount = Math.max(Math.round(totalFloorArea / actualFootprint), 2);

  const upperFloorHeight = 4;
  const totalHeight = Math.min(
    params.ground_floor_height + (floorCount - 1) * upperFloorHeight,
    params.height_limit
  );
  const actualFloorCount = Math.floor(
    (totalHeight - params.ground_floor_height) / upperFloorHeight + 1
  );

  return {
    buildingWidth: Math.max(buildingWidth, 5),
    buildingDepth: Math.max(buildingDepth, 5),
    floorCount: Math.max(actualFloorCount, 2),
    totalHeight: Math.max(totalHeight, params.ground_floor_height + upperFloorHeight),
    groundFloorHeight: params.ground_floor_height,
    openSpaceDepth: Math.max(openSpaceDepth, 0),
    frontSetback: params.front_setback,
    sideSetback: params.side_setback,
  };
}
