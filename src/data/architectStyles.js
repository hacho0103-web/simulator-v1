/**
 * architectStyles.js
 * 건축가 스타일 정의
 */

export const ARCH_STYLES = {
  ando: {
    id: 'ando',
    name: '안도다다오',
    nameEn: 'Tadao Ando',
    keywords: ['노출 콘크리트', '빛과 그림자', '기하학적 순수성', '최소주의'],
    description:
      '일본 현대건축의 거장. 정밀하게 타설된 노출 콘크리트(打ち放しコンクリート)와 ' +
      '기하학적 순수 형태로 빛과 그림자를 조각한다. 빛의 교회, 물의 절 등에서 ' +
      '단일 직교 매스에 좁은 슬릿으로 빛을 유입시켜 극적 공간감을 창출한다.',

    // 씬 환경
    bgColor: '#EEF2F7',
    fogNear: 180,
    fogFar: 480,
    groundColor: '#EAECEF',
    ambientIntensity: 0.28,
    dirColor: '#FFE8C0',
    dirIntensity: 1.8,

    // 건물 재질 — 노출 콘크리트
    groundFloorColor: '#2563EB',
    upperFloorColor:  '#4A5058',
    roughness: 0.95,
    metalness: 0.00,
    opacity: 1.00,

    // 거푸집 줄눈
    formworkInterval: 0.9,
    formworkColor: '#2C3035',
    formworkJointH: 0.10,

    // 빛의 십자 슬릿
    lightSlitColor: '#C8E4FF',
    lightSlitEmissive: 1.8,
  },

  zaha: {
    id: 'zaha',
    name: '자하하디드',
    nameEn: 'Zaha Hadid',
    keywords: ['파라메트릭', '유동적 형태', '캔틸레버', '미래적 다이나미즘'],
    description:
      '이라크 출신 영국 건축가. 컴퓨터 파라메트릭 설계로 유동적·비정형 형태를 구현했다. ' +
      'DDP(동대문디자인플라자), 하이다르 알리예프 센터 등에서 수평 레이어가 ' +
      '캔틸레버로 연장되고 예각과 곡면이 역동적으로 교차한다.',

    // 씬 환경
    bgColor: '#EEF2F7',
    fogNear: 320,
    fogFar: 750,
    groundColor: '#EAECEF',
    ambientIntensity: 0.95,
    dirColor: '#D8EEFF',
    dirIntensity: 0.65,

    // 건물 재질 — 알루미늄 패널 / 화이트 스무스
    groundFloorColor: '#2563EB',
    upperFloorColor:  '#EDEEF0',
    roughness: 0.08,
    metalness: 0.32,
    opacity: 1.00,

    // 슬래브 플레이트
    floorPlateColor: '#F5F6F7',
    floorPlateThickness: 0.28,
    floorPlateMetalness: 0.45,
    maxCantilever: 4.0,
    // 전단(shear) 파라미터
    shearRatio: 0.40,    // 전체 폭 대비 최대 기울기
    shearZRatio: 0.14,   // 앞뒤 방향 휨 비율
  },
};
