import { useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { calculateMass } from '../utils/scoring';
import { DEFAULT_LOT, RULE_SETS } from '../data/rulesets';
import { DISTRICTS } from '../data/districts';
import PedestrianLayer from './PedestrianLayer';

// ─────────────────────────────────────────
// 스타일 헬퍼
// ─────────────────────────────────────────

function lerpColor(hex1, hex2, t) {
  const a = parseInt(hex1.slice(1), 16);
  const b = parseInt(hex2.slice(1), 16);
  const r = Math.round(((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t);
  const g = Math.round(((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t);
  const bl = Math.round((a & 0xff) + ((b & 0xff) - (a & 0xff)) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function GroundPlane({ color = '#EAECEF' }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[50000, 50000]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// ─────────────────────────────────────────
// 직사각형 시뮬레이션 모드 컴포넌트들
// ─────────────────────────────────────────

function LotBoundary({ width, depth }) {
  const hw = width / 2;
  const hd = depth / 2;
  const points = [
    [-hw, 0, -hd], [hw, 0, -hd],
    [hw, 0, hd], [-hw, 0, hd],
    [-hw, 0, -hd],
  ];
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(points.flat()), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#FBBF24" linewidth={2} />
    </line>
  );
}

function OpenSpace({ width, depth, posZ }) {
  if (depth <= 0.1) return null;
  return (
    <mesh position={[0, 0.05, posZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#10B981" transparent opacity={0.5} />
    </mesh>
  );
}

function GroundFloor({
  width, depth, height, posY, posZ,
  transparency, retailContinuity, color,
  canopyDepth = 0, canopyContinuity = 0, pilotisRatio = 0, entranceFrequency = 3,
  pilotisDepth = 0, passageWidth = 0,
}) {
  const canopyW = width * (canopyContinuity / 100);

  // 필로티 깊이: 전면을 실제로 열어 공간 확보
  const hasPilotis = pilotisDepth > 0.1 && pilotisDepth < depth - 2;
  const solidDepth = hasPilotis ? depth - pilotisDepth : depth;
  const solidBlockZ = hasPilotis ? -pilotisDepth / 2 : 0;
  const pilotisZoneZ = hasPilotis ? depth / 2 - pilotisDepth / 2 : 0;

  // 공용통로: 중앙을 관통하는 보행 통로
  const hasPassage = passageWidth > 0.1 && passageWidth < width - 4;
  const wingW = hasPassage ? (width - passageWidth) / 2 : width;
  const leftX = hasPassage ? -(passageWidth / 2 + wingW / 2) : 0;
  const rightX = hasPassage ? passageWidth / 2 + wingW / 2 : 0;

  // 파사드 Z: 솔리드 블록의 전면
  const facadeZ = solidDepth / 2 + solidBlockZ;

  // 출입구 수
  const numEntrances = Math.max(Math.round((width / 100) * entranceFrequency), 1);
  const entrSpacing = width / (numEntrances + 1);

  // 필로티 존 기둥 개수 (4m 간격)
  const numPilotisCols = hasPilotis
    ? Math.max(Math.round(width / 4), 2)
    : 0;

  return (
    <group position={[0, posY, posZ]}>

      {/* ── 솔리드 매스 ── */}
      {hasPassage ? (
        <>
          {/* 좌측 날개 */}
          <mesh position={[leftX, 0, solidBlockZ]}>
            <boxGeometry args={[wingW, height, solidDepth]} />
            <meshStandardMaterial color={color} transparent opacity={0.88} roughness={0.3} metalness={0.05} />
          </mesh>
          {/* 우측 날개 */}
          <mesh position={[rightX, 0, solidBlockZ]}>
            <boxGeometry args={[wingW, height, solidDepth]} />
            <meshStandardMaterial color={color} transparent opacity={0.88} roughness={0.3} metalness={0.05} />
          </mesh>
          {/* 통로 상부 브릿지 슬래브 */}
          <mesh position={[0, height / 2 - 0.2, solidBlockZ]}>
            <boxGeometry args={[passageWidth, 0.4, solidDepth]} />
            <meshStandardMaterial color={color} transparent opacity={0.8} />
          </mesh>
          {/* 통로 바닥 (녹색 표시) */}
          <mesh position={[0, -height / 2 + 0.05, solidBlockZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[passageWidth, solidDepth]} />
            <meshStandardMaterial color="#86EFAC" transparent opacity={0.5} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 0, solidBlockZ]}>
          <boxGeometry args={[width, height, solidDepth]} />
          <meshStandardMaterial color={color} transparent opacity={0.88} roughness={0.3} metalness={0.05} />
        </mesh>
      )}

      {/* ── 필로티 존 (전면 개방 공간) ── */}
      {hasPilotis && (
        <>
          {/* 천장 슬래브 (2F 바닥) */}
          <mesh position={[0, height / 2 - 0.15, pilotisZoneZ]}>
            <boxGeometry args={[width, 0.3, pilotisDepth]} />
            <meshStandardMaterial color={color} transparent opacity={0.85} />
          </mesh>
          {/* 기둥들 */}
          {Array.from({ length: numPilotisCols }).map((_, i) => {
            const spacing = width / (numPilotisCols + 1);
            const x = -width / 2 + spacing * (i + 1);
            return (
              <mesh key={i} position={[x, 0, pilotisZoneZ]}>
                <boxGeometry args={[0.5, height, 0.5]} />
                <meshStandardMaterial color="#334155" transparent opacity={0.95} />
              </mesh>
            );
          })}
          {/* 필로티 바닥 표시 */}
          <mesh position={[0, -height / 2 + 0.05, pilotisZoneZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, pilotisDepth]} />
            <meshStandardMaterial color="#7DD3FC" transparent opacity={0.2} />
          </mesh>
        </>
      )}

      {/* ── 파사드 투명도 레이어 ── */}
      <mesh position={[0, 0, facadeZ + 0.05]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#93C5FD" transparent opacity={transparency / 100 * 0.6 + 0.1} />
      </mesh>

      {/* 상업 연속성 */}
      {retailContinuity > 0 && (
        <mesh position={[(-width / 2) + (width * retailContinuity / 100 / 2), 0, facadeZ + 0.1]}>
          <planeGeometry args={[width * retailContinuity / 100, height * 0.6]} />
          <meshStandardMaterial color="#F97316" transparent opacity={0.7} />
        </mesh>
      )}

      {/* 캐노피 */}
      {canopyDepth > 0 && canopyContinuity > 0 && (
        <mesh position={[0, height / 2 - 0.15, facadeZ + canopyDepth / 2]}>
          <boxGeometry args={[canopyW, 0.3, canopyDepth]} />
          <meshStandardMaterial color="#CBD5E1" transparent opacity={0.9} />
        </mesh>
      )}

      {/* 출입구 */}
      {Array.from({ length: numEntrances }).map((_, i) => (
        <mesh key={i} position={[-width / 2 + entrSpacing * (i + 1), -height / 2 + 1.5, facadeZ + 0.12]}>
          <boxGeometry args={[1.5, 2.8, 0.08]} />
          <meshStandardMaterial color="#0F172A" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function UpperFloors({ width, depth, height, posY, posZ, floorCount, color = '#A8B8C8', roughness = 0.4, metalness = 0.05, opacity = 0.95 }) {
  return (
    <group position={[0, posY, posZ]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} roughness={roughness} metalness={metalness} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#64748B" transparent opacity={0.5} />
      </lineSegments>
      {Array.from({ length: floorCount - 1 }).map((_, i) => {
        const floorH = height / (floorCount - 1);
        return (
          <mesh key={i} position={[0, -height / 2 + floorH * (i + 1), 0]}>
            <boxGeometry args={[width + 0.1, 0.08, depth + 0.1]} />
            <meshStandardMaterial color="#94A3B8" transparent opacity={0.5} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── 안도 다다오: 노출 콘크리트 모놀리스 ───────────────────────────────────
function AndoBuilding({ width, depth, totalHeight, posZ, style }) {
  const jointInterval = style.formworkInterval ?? 0.9;
  const jointH        = style.formworkJointH   ?? 0.10;
  const jointCount    = Math.floor(totalHeight / jointInterval);
  const frontZ = posZ + depth / 2;
  const lowerH = Math.min(12, totalHeight);
  const upperH = totalHeight - lowerH;
  const groundFloorColor = style.groundFloorColor ?? '#2563EB';

  return (
    <group>
      {/* ── 저층부 (1-3F) ── */}
      <mesh position={[0, lowerH / 2, posZ]} castShadow receiveShadow>
        <boxGeometry args={[width, lowerH, depth]} />
        <meshStandardMaterial color={groundFloorColor} roughness={style.roughness} metalness={style.metalness} />
      </mesh>
      {/* ── 상층부 콘크리트 매스 ── */}
      {upperH > 0 && (
        <mesh position={[0, lowerH + upperH / 2, posZ]} castShadow receiveShadow>
          <boxGeometry args={[width, upperH, depth]} />
          <meshStandardMaterial color={style.upperFloorColor} roughness={style.roughness} metalness={style.metalness} />
        </mesh>
      )}

      {/* ── 거푸집 줄눈 (수평 그루브) ── */}
      {Array.from({ length: jointCount }).map((_, i) => (
        <mesh key={i} position={[0, jointInterval * (i + 1), posZ]}>
          <boxGeometry args={[width + 0.06, jointH, depth + 0.06]} />
          <meshStandardMaterial color={style.formworkColor} roughness={1.0} metalness={0} />
        </mesh>
      ))}

      {/* ── 빛의 십자 슬릿 (전면 파사드) ── */}
      {/* 수직 바 */}
      <mesh position={[0, totalHeight * 0.45, frontZ + 0.03]}>
        <planeGeometry args={[0.6, totalHeight * 0.65]} />
        <meshStandardMaterial
          color={style.lightSlitColor}
          emissive={style.lightSlitColor}
          emissiveIntensity={style.lightSlitEmissive ?? 1.8}
          transparent opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 수평 바 */}
      <mesh position={[0, totalHeight * 0.38, frontZ + 0.03]}>
        <planeGeometry args={[width * 0.7, 0.6]} />
        <meshStandardMaterial
          color={style.lightSlitColor}
          emissive={style.lightSlitColor}
          emissiveIntensity={style.lightSlitEmissive ?? 1.8}
          transparent opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ─── 자하 하디드: 파라메트릭 전단(shear) 매스 ──────────────────────────────
function ZahaBuilding({ width, depth, totalHeight, posZ, style }) {
  const LOWER_H  = 12;
  const SLICES   = 28;  // 부드러운 전단을 위한 슬라이스 수
  const sliceH   = totalHeight / SLICES;
  const maxShearX = width  * (style.shearRatio  ?? 0.40);
  const maxShearZ = depth  * (style.shearZRatio ?? 0.14);

  // 플로어 플레이트 간격 (4m)
  const plateInterval = 4.0;
  const plateCount    = Math.floor(totalHeight / plateInterval);
  const maxCant       = style.maxCantilever    ?? 4.0;
  const thickness     = style.floorPlateThickness ?? 0.28;

  // 전단 함수: 아래는 수직에 가깝고, 위로 갈수록 급격히 기울어짐
  const shearX = (t) => maxShearX * Math.pow(t, 1.3);
  const shearZ = (t) => maxShearZ * Math.sin(t * Math.PI * 0.85);

  return (
    <group>
      {/* ── 전단 슬라이스 매스 ── */}
      {Array.from({ length: SLICES }).map((_, i) => {
        const t    = (i + 0.5) / SLICES;
        const xOff = shearX(t);
        const zOff = shearZ(t);
        const scaleX = 1 + t * 0.06; // 상부로 갈수록 약간 넓어짐
        const sliceCenterY = sliceH * (i + 0.5);
        const sliceColor = sliceCenterY < LOWER_H ? (style.groundFloorColor ?? '#2563EB') : style.upperFloorColor;
        return (
          <mesh key={i} position={[xOff, sliceCenterY, posZ + zOff]} castShadow receiveShadow>
            <boxGeometry args={[width * scaleX, sliceH + 0.02, depth]} />
            <meshStandardMaterial
              color={sliceColor}
              roughness={style.roughness}
              metalness={style.metalness}
            />
          </mesh>
        );
      })}

      {/* ── 캔틸레버 슬래브 플레이트 ── */}
      {Array.from({ length: plateCount }).map((_, i) => {
        const yPos  = plateInterval * (i + 1);
        const t     = yPos / totalHeight;
        const xOff  = shearX(t);
        const zOff  = shearZ(t);
        const scaleX = 1 + t * 0.06;

        // 비대칭 캔틸레버: 기울어진 방향(+X)으로 더 돌출
        const rightCant = maxCant * (0.25 + t * 0.75);
        const leftCant  = maxCant * 0.12;
        const frontCant = maxCant * 0.2 * t;
        const plateW    = width * scaleX + rightCant + leftCant;
        const plateD    = depth + frontCant;

        return (
          <mesh
            key={`plate-${i}`}
            position={[xOff + (rightCant - leftCant) / 2, yPos, posZ + zOff - frontCant / 2]}
          >
            <boxGeometry args={[plateW, thickness, plateD]} />
            <meshStandardMaterial
              color={style.floorPlateColor ?? '#F5F6F7'}
              metalness={style.floorPlateMetalness ?? 0.45}
              roughness={0.04}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ params, activeRuleSet, showPedestrians, architectStyle = null }) {
  const lot = DEFAULT_LOT;
  const mass = calculateMass(params, lot);
  const ruleColor = RULE_SETS[activeRuleSet]?.color ?? '#3B82F6';
  const hw = lot.width / 2;
  const hd = lot.depth / 2;
  const openSpaceZ = hd - mass.openSpaceDepth / 2;
  const buildingZ = hd - mass.openSpaceDepth - mass.frontSetback - mass.buildingDepth / 2;
  const upperHeight = mass.totalHeight - mass.groundFloorHeight;
  const groundFloorPosY = mass.groundFloorHeight / 2;
  const upperFloorPosY = mass.groundFloorHeight + upperHeight / 2;

  // 건축가 스타일 기반 재질/조명 파라미터
  const s = architectStyle;
  const bgColor         = s?.bgColor         ?? '#EEF2F7';
  const groundColor     = s?.groundColor      ?? '#EAECEF';
  const groundFloorColor = s?.groundFloorColor ?? '#2563EB';
  const upperFloorColor  = s?.upperFloorColor  ?? '#A8B8C8';
  const roughness        = s?.roughness        ?? 0.4;
  const metalness        = s?.metalness        ?? 0.05;
  const opacity          = s?.opacity          ?? 0.95;
  const ambientIntensity = s?.ambientIntensity ?? 0.85;
  const dirIntensity     = s?.dirIntensity     ?? 0.9;
  const dirColor         = s?.dirColor         ?? '#FFFFFF';
  const fogNear          = s?.fogNear  ?? 300;
  const fogFar           = s?.fogFar   ?? 900;

  return (
    <>
      <color attach="background" args={[bgColor]} />
      <fog attach="fog" args={[bgColor, fogNear, fogFar]} />
      <ambientLight intensity={ambientIntensity} />
      {/* 안도: 강한 사광 (그림자 극대화) / 자하: 부드러운 균등 조명 */}
      <directionalLight
        position={s?.id === 'ando' ? [30, 180, 20] : [80, 140, 60]}
        intensity={dirIntensity}
        color={dirColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {s?.id === 'zaha' && (
        <directionalLight position={[-70, 90, -30]} intensity={0.55} color="#BCD8F0" />
      )}
      {!s && <directionalLight position={[-50, 80, -60]} intensity={0.4} color="#DBEAFE" />}
      <GroundPlane color={groundColor} />
      <LotBoundary width={lot.width} depth={lot.depth} />
      {!s && <OpenSpace width={lot.width} depth={mass.openSpaceDepth} posZ={openSpaceZ} />}

      {/* ── 건물 매스: 스타일에 따라 전용 컴포넌트 ── */}
      {s?.id === 'ando' ? (
        <AndoBuilding
          width={mass.buildingWidth}
          depth={mass.buildingDepth}
          totalHeight={mass.totalHeight}
          posZ={buildingZ}
          style={s}
        />
      ) : s?.id === 'zaha' ? (
        <ZahaBuilding
          width={mass.buildingWidth}
          depth={mass.buildingDepth}
          totalHeight={mass.totalHeight}
          posZ={buildingZ}
          style={s}
        />
      ) : (
        <>
          <GroundFloor
            width={mass.buildingWidth} depth={mass.buildingDepth}
            height={mass.groundFloorHeight} posY={groundFloorPosY} posZ={buildingZ}
            transparency={params.facade_transparency} retailContinuity={params.retail_continuity}
            color={groundFloorColor}
            canopyDepth={params.canopy_depth ?? 0}
            canopyContinuity={params.canopy_continuity ?? 0}
            pilotisRatio={params.pilotis_ratio ?? 0}
            entranceFrequency={params.entrance_frequency ?? 3}
            pilotisDepth={params.pilotis_depth ?? 0}
            passageWidth={params.passage_width ?? 0}
          />
          {upperHeight > 0 && (
            <UpperFloors
              width={mass.buildingWidth} depth={mass.buildingDepth}
              height={upperHeight} posY={upperFloorPosY} posZ={buildingZ}
              floorCount={mass.floorCount}
              color={upperFloorColor}
              roughness={roughness}
              metalness={metalness}
              opacity={opacity}
            />
          )}
        </>
      )}
      <Text position={[0, mass.totalHeight + 3, buildingZ]} fontSize={2} color="#1E293B" anchorX="center" anchorY="bottom">
        {`${mass.floorCount}F / ${Math.round(mass.totalHeight)}m`}
      </Text>
      {showPedestrians && (
        <PedestrianLayer params={params} mass={mass} lot={lot} />
      )}
    </>
  );
}

// ─────────────────────────────────────────
// GeoJSON 실제 지도 모드 컴포넌트들
// ─────────────────────────────────────────

// 도로 두께 분류
const ROAD_WIDTH = {
  motorway: 14, trunk: 12, primary: 10, secondary: 8,
  tertiary:  6, residential: 5, service: 3.5,
  footway:   4, path: 3.5, cycleway: 4, steps: 3,
};
const ROAD_COLOR = {
  // 차도 — 어두운 청회색 계열
  motorway:    '#1A2B3C',
  trunk:       '#2A3C50',
  primary:     '#3A5062',
  secondary:   '#526070',
  tertiary:    '#6A7E8E',
  residential: '#8A9BAC',
  service:     '#9AAAB8',
  // 보행로 — 어두운 앰버
  footway:     '#B8883A',
  path:        '#A87C28',
  steps:       '#C45890',   // 계단 — 딥핑크
  // 자전거도로 — 딥그린
  cycleway:    '#2AA87A',
};


const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY;

// 서울시 도시계획 조례 기준 법정 한도
const SEOUL_ZONING_LIMITS = {
  '제1종전용주거지역': { lot_coverage_ratio: 50, floor_area_ratio: 100,  height_limit: 15 },
  '제2종전용주거지역': { lot_coverage_ratio: 40, floor_area_ratio: 120,  height_limit: 20 },
  '제1종일반주거지역': { lot_coverage_ratio: 60, floor_area_ratio: 200,  height_limit: 20 },
  '제2종일반주거지역': { lot_coverage_ratio: 60, floor_area_ratio: 250,  height_limit: 35 },
  '제3종일반주거지역': { lot_coverage_ratio: 50, floor_area_ratio: 300,  height_limit: 50 },
  '준주거지역':        { lot_coverage_ratio: 60, floor_area_ratio: 400,  height_limit: 80 },
  '중심상업지역':      { lot_coverage_ratio: 60, floor_area_ratio: 800,  height_limit: 200 },
  '일반상업지역':      { lot_coverage_ratio: 60, floor_area_ratio: 600,  height_limit: 150 },
  '근린상업지역':      { lot_coverage_ratio: 60, floor_area_ratio: 600,  height_limit: 100 },
  '유통상업지역':      { lot_coverage_ratio: 60, floor_area_ratio: 600,  height_limit: 100 },
  '전용공업지역':      { lot_coverage_ratio: 70, floor_area_ratio: 300,  height_limit: 80 },
  '일반공업지역':      { lot_coverage_ratio: 70, floor_area_ratio: 350,  height_limit: 80 },
  '준공업지역':        { lot_coverage_ratio: 60, floor_area_ratio: 400,  height_limit: 80 },
  '보전녹지지역':      { lot_coverage_ratio: 20, floor_area_ratio: 80,   height_limit: 20 },
  '생산녹지지역':      { lot_coverage_ratio: 20, floor_area_ratio: 100,  height_limit: 20 },
  '자연녹지지역':      { lot_coverage_ratio: 20, floor_area_ratio: 100,  height_limit: 20 },
};

// district 객체를 받아 건물+도로 데이터 로드
function useGeoJSONScene(district) {
  const [buildings, setBuildings] = useState([]);
  const [roads, setRoads] = useState([]);
  const [greenSpaces, setGreenSpaces] = useState([]);
  const [sceneSize, setSceneSize] = useState(200);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('');

  useEffect(() => {
    if (!district) { setBuildings([]); setRoads([]); setGreenSpaces([]); return; }
    setLoading(true);
    setBuildings([]);
    setRoads([]);
    setGreenSpaces([]);

    const { center, bbox, geojson: geojsonUrl, useVWorld } = district;
    const { lon: centerLon, lat: centerLat } = center;
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const toLocal = ([lon, lat]) => [
      (lon - centerLon) * 111000 * cosLat,
      (lat - centerLat) * 111000,
    ];
    const [s, w, n, e] = bbox.split(',').map(Number);

    const parseVWorldBuildings = (data) =>
      (data.features || [])
        .filter(f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
        .map(f => {
          const getRings = () => f.geometry.type === 'Polygon'
            ? [f.geometry.coordinates[0]]
            : f.geometry.coordinates.map(p => p[0]);
          return {
            rings: getRings().map(ring => ring.map(toLocal)),
            name: f.properties?.bld_nm || '',
            floors: parseInt(f.properties?.grnd_flr) || null,
            heightM: parseFloat(f.properties?.bld_hgt) || null,
          };
        });

    const parseLocalBuildings = (data) =>
      data.features
        .filter(f => f.properties?.building &&
          (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'))
        .map(f => {
          const getRings = () => f.geometry.type === 'Polygon'
            ? [f.geometry.coordinates[0]]
            : f.geometry.coordinates.map(p => p[0]);
          return {
            rings: getRings().map(ring => ring.map(toLocal)),
            name: f.properties?.name || '',
            floors: parseInt(f.properties?.['building:levels']) || null,
            heightM: parseFloat(f.properties?.height) || null,
          };
        });

    const buildingPromise = (async () => {
      if (useVWorld && VWORLD_KEY) {
        try {
          const url = `/vworld/req/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=lt_c_uq011&BBOX=${w},${s},${e},${n},EPSG:4326&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&KEY=${VWORLD_KEY}&COUNT=500`;
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            const parsed = parseVWorldBuildings(data);
            if (parsed.length > 0) { setDataSource('vworld'); return parsed; }
          }
        } catch (e) { console.warn('VWorld 실패, 로컬 폴백:', e); }
      }
      const r = await fetch(geojsonUrl);
      const data = await r.json();
      setDataSource('osm');
      return parseLocalBuildings(data);
    })();

    // 도로 + 녹지 통합 쿼리
    const query = `[out:json][timeout:30];(way["highway"](${bbox});way["landuse"~"grass|park|forest|recreation_ground|garden|meadow|village_green"](${bbox});way["leisure"~"park|garden|recreation_ground|pitch|playground"](${bbox}););out geom;`;
    const CACHE_KEY = `roads_v3_${bbox}`;
    const OVERPASS_SERVERS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];
    const parseRoadsAndGreen = (data) => {
      const roads = [], green = [];
      for (const el of data.elements) {
        if (el.type !== 'way' || !el.geometry) continue;
        if (el.tags?.highway) {
          const hw = el.tags.highway;
          roads.push({ lines: [el.geometry.map(pt => toLocal([pt.lon, pt.lat]))], width: ROAD_WIDTH[hw] ?? 2, color: ROAD_COLOR[hw] ?? '#8A9BAC' });
        } else if ((el.tags?.landuse || el.tags?.leisure) && el.geometry.length >= 3) {
          green.push({ coords: el.geometry.map(pt => toLocal([pt.lon, pt.lat])) });
        }
      }
      return { roads, green };
    };

    const fetchWithTimeout = (url, ms = 8000) => {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
    };

    const roadPromise = (async () => {
      try { const c = localStorage.getItem(CACHE_KEY); if (c) return JSON.parse(c); } catch (e) {}
      for (const server of OVERPASS_SERVERS) {
        try {
          const r = await fetchWithTimeout(`${server}?data=${encodeURIComponent(query)}`);
          if (!r.ok) continue;
          const data = await r.json();
          const result = parseRoadsAndGreen(data);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(result)); } catch (e) {}
          return result;
        } catch (e) { continue; }
      }
      return { roads: [], green: [] };
    })();

    Promise.all([buildingPromise, roadPromise])
      .then(([buildings, { roads, green }]) => {
        setBuildings(buildings);
        setRoads(roads);
        setGreenSpaces(green);
        setSceneSize(Math.max((e - w) * 111000 * cosLat, (n - s) * 111000, 200));
        setLoading(false);
      })
      .catch(err => { console.error('씬 로드 오류:', err); setLoading(false); });
  }, [district?.id]);

  return { buildings, roads, greenSpaces, sceneSize, loading, dataSource };
}

/** 2D 포인트-인-폴리곤 (ray casting) */
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Overpass JSON → buildings 파싱 (gwanghwamun.geojson과 동일한 OSM 소스) */
function parseOverpassBuildings(data, toLocal) {
  const nodes = {};
  for (const el of data.elements || []) {
    if (el.type === 'node') nodes[el.id] = [el.lon, el.lat];
  }
  return (data.elements || [])
    .filter(el => el.type === 'way' && el.tags?.building)
    .map(el => {
      const wgsRing = el.geometry
        ? el.geometry.map(pt => [pt.lon, pt.lat])
        : (el.nodes ?? []).map(id => nodes[id]).filter(Boolean);
      if (wgsRing.length < 3) return null;
      return {
        wgsRing,
        rings:   [wgsRing.map(toLocal)],
        floors:  parseInt(el.tags?.['building:levels']) || null,
        heightM: parseFloat(el.tags?.height)            || null,
        hasBuilding: true,
      };
    })
    .filter(Boolean);
}

// 커스텀 필지 선택 모드 — Overpass OSM 빌딩 geometry (광화문 GeoJSON과 동일 데이터 소스)
function useCustomAreaScene(customParcels) {
  const [buildings,      setBuildings]      = useState([]);
  const [roads,          setRoads]          = useState([]);
  const [parcelOutlines, setParcelOutlines] = useState([]);
  const [loading, setLoading]               = useState(false);
  const [sceneSize, setSceneSize]           = useState(200);

  const parcelKey = customParcels.map(p => p.id).join(',');

  useEffect(() => {
    if (!customParcels.length) { setBuildings([]); return; }

    const allCoords = customParcels.flatMap(p => p.coordinates ?? []);
    if (!allCoords.length) return;

    const lngs = allCoords.map(([lng]) => lng);
    const lats = allCoords.map(([, lat]) => lat);
    const s = Math.min(...lats), n = Math.max(...lats);
    const w = Math.min(...lngs), e = Math.max(...lngs);
    const centerLon = (w + e) / 2;
    const centerLat = (s + n) / 2;
    const cosLat    = Math.cos(centerLat * Math.PI / 180);

    const toLocal = ([lon, lat]) => [
      (lon - centerLon) * 111000 * cosLat,
      (lat - centerLat) * 111000,
    ];

    setSceneSize(Math.max((e - w) * 111000 * cosLat, (n - s) * 111000, 100));
    setLoading(true);
    setBuildings([]);

    // 선택 필지 경계선 (로컬 좌표)
    setParcelOutlines(
      customParcels
        .map(p => (p.coordinates ?? []).map(toLocal))
        .filter(ring => ring.length >= 3)
    );

    const buf = 0.0003;
    const bbox = `${s - buf},${w - buf},${n + buf},${e + buf}`;

    // 도로 쿼리 (광화문과 동일 방식, 캐시 포함)
    const ROAD_CACHE = `custom_roads_v2_${bbox}`;
    const roadQuery  = `[out:json][timeout:20];way["highway"](${bbox});out geom;`;
    const parseRoads = (data) =>
      data.elements.filter(el => el.type === 'way' && el.geometry).map(el => {
        const hw = el.tags?.highway ?? 'residential';
        return {
          lines: [el.geometry.map(pt => toLocal([pt.lon, pt.lat]))],
          width: ROAD_WIDTH[hw] ?? 2,
          color: ROAD_COLOR[hw] ?? '#8A9BAC',
        };
      });

    const roadPromise = (async () => {
      try { const c = localStorage.getItem(ROAD_CACHE); if (c) return JSON.parse(c); } catch {}
      for (const server of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 12000);
          const r = await fetch(`${server}?data=${encodeURIComponent(roadQuery)}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!r.ok) continue;
          const data = await r.json();
          const roads = parseRoads(data);
          try { localStorage.setItem(ROAD_CACHE, JSON.stringify(roads)); } catch {}
          return roads;
        } catch { continue; }
      }
      return [];
    })();

    const query = `[out:json][timeout:15];(way["building"](${bbox}););out body;>;out skel qt;`;
    const OVERPASS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];

    (async () => {
      for (const server of OVERPASS) {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 13000);
          const r = await fetch(`${server}?data=${encodeURIComponent(query)}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!r.ok) continue;

          const data = await r.json();
          const parsed = parseOverpassBuildings(data, toLocal);

          // 선택 필지 안에 centroid가 있는 건물만 표시
          const filtered = parsed.filter(b => {
            const bLng = b.wgsRing.reduce((s, [lng]) => s + lng, 0) / b.wgsRing.length;
            const bLat = b.wgsRing.reduce((s, [, lat]) => s + lat, 0) / b.wgsRing.length;
            return customParcels.some(p => pointInPolygon(bLng, bLat, p.coordinates ?? []));
          });

          if (filtered.length > 0) {
            const resolvedRoads = await roadPromise;
            setRoads(resolvedRoads);
            setBuildings(filtered);
            setLoading(false);
            return;
          }
          break;
        } catch { continue; }
      }

      // 폴백: 건물 없음 → 필지 경계만 표시
      const resolvedRoads = await roadPromise;
      setRoads(resolvedRoads);
      setBuildings(customParcels
        .map(p => ({
          rings: [(p.coordinates ?? []).map(toLocal)],
          name: p.address,
          hasBuilding: false,
          floors: null,
          heightM: null,
        }))
        .filter(b => b.rings[0].length >= 3));
      setLoading(false);
    })();
  }, [parcelKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { buildings, roads, parcelOutlines, loading, sceneSize };
}

// GeoJSON local coords: [x(동서), y(남북)]
// makeShape → XY 평면에 shape 생성, mesh에 rotation=[-PI/2,0,0] 적용하면 XZ(지면)에 눕고 Y축으로 압출됨
// world Z = +local_y 로 통일
function makeShape(coords) {
  const shape = new THREE.Shape();
  if (coords.length < 3) return shape;
  shape.moveTo(coords[0][0], coords[0][1]);
  for (let i = 1; i < coords.length - 1; i++) {
    shape.lineTo(coords[i][0], coords[i][1]);
  }
  shape.closePath();
  return shape;
}

/** 건폐율에 따라 centroid 기준으로 footprint를 축소/확대 */
function scaleCoordsFromCentroid(coords, scale) {
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return coords.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
}

/** 대지 경계선
 * makeShape + rotation[-PI/2,0,0] 기준: local_y → world -Z
 * 따라서 position Z = -local_y, group rotation Y = +angle
 */
function LotOutline({ coords }) {
  const positions = useMemo(() => {
    const loop = [...coords, coords[0]];
    return new Float32Array(loop.flatMap(([x, y]) => [x, 0.4, -y]));
  }, [coords]);

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#F59E0B" />
    </line>
  );
}

/** 안도: 건물 외벽 수평 줄눈 — 층 경계마다 footprint 따라 라인 */
function AndoFormworkRing({ coords, height, color }) {
  const positions = useMemo(() => {
    const loop = [...coords, coords[0]];
    return new Float32Array(loop.flatMap(([x, y]) => [x, height, -y]));
  }, [coords, height]);
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} />
    </line>
  );
}

/** 자하: 돌출 슬래브 플레이트 — footprint를 층마다 바깥으로 확장 */
function ZahaMapFloorPlate({ coords, height, t, style }) {
  const scale = 1.06 + 0.18 * t;  // 상층부일수록 더 많이 돌출
  const plateCoords = useMemo(() => scaleCoordsFromCentroid(coords, scale), [coords, scale]);
  const geo = useMemo(() =>
    new THREE.ExtrudeGeometry(makeShape(plateCoords), { depth: style.floorPlateThickness ?? 0.28, bevelEnabled: false }),
    [plateCoords, style.floorPlateThickness]
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, height, 0]}>
      <meshStandardMaterial
        key={`zplate_${style.id}`}
        color={style.floorPlateColor ?? '#F5F6F7'}
        metalness={style.floorPlateMetalness ?? 0.45}
        roughness={0.04}
      />
    </mesh>
  );
}

/** 필지 좌표 기반 안정적 0~1 해시 — 리로드해도 동일값 */
function buildingVariance(coords) {
  if (!coords || coords.length === 0) return 0.5;
  const [x, y] = coords[0];
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

function GeoJSONBuilding({ lotCoords, params, color, actualFloors = null, actualHeightM = null, onParcelClick, districtCenter, baselineMode = false, showLotFloor = true, architectStyle = null }) {
  const s = architectStyle;
  const groundFloorH = params.ground_floor_height;

  const v = buildingVariance(lotCoords);
  const devStage = Math.pow(v, 0.65);

  let floorCount, totalHeight, footprintScale;

  if (baselineMode) {
    // ── 현황 모드: 실제 데이터 그대로, 파라미터 미적용 ──
    footprintScale = 1.0;
    if (actualHeightM) {
      totalHeight = actualHeightM;
      floorCount = Math.max(Math.round((actualHeightM - groundFloorH) / 4 + 1), 1);
    } else if (actualFloors) {
      floorCount = actualFloors;
      totalHeight = groundFloorH + (floorCount - 1) * 4;
    } else {
      // 데이터 없음 → 3층 디폴트
      floorCount = 3;
      totalHeight = groundFloorH + 8;
    }
  } else if (actualFloors || actualHeightM) {
    // ── 시뮬레이션 모드 + 실측 데이터 있음: 파라미터 높이제한 적용 ──
    floorCount = actualFloors || Math.max(Math.round((actualHeightM - groundFloorH) / 4 + 1), 1);
    totalHeight = Math.min(
      actualHeightM || (groundFloorH + (floorCount - 1) * 4),
      params.height_limit
    );
    footprintScale = 1.0;
  } else {
    // ── 시뮬레이션 모드 + 실측 데이터 없음: 파라미터 기반 추정 ──
    const effectiveFAR = params.floor_area_ratio * (0.2 + devStage * 0.8);
    const effectiveLCR = Math.min(params.lot_coverage_ratio * (0.4 + devStage * 0.6), 90);
    floorCount = Math.max(Math.round(effectiveFAR / Math.max(effectiveLCR, 1)), 1);
    const heightCap = params.height_limit * (0.25 + devStage * 0.75);
    totalHeight = Math.min(groundFloorH + (floorCount - 1) * 4, heightCap);
    footprintScale = Math.sqrt(Math.min(effectiveLCR, 100) / 100);
  }

  const upperH = Math.max(totalHeight - groundFloorH, 0);

  const buildingCoords = useMemo(
    () => footprintScale === 1.0 ? lotCoords : scaleCoordsFromCentroid(lotCoords, footprintScale),
    [lotCoords, footprintScale]
  );

  // 자하: 상층부를 footprint 폭의 10% 만큼 X 방향으로 오프셋 (전단 효과)
  const zahaShiftX = useMemo(() => {
    if (s?.id !== 'zaha' || !buildingCoords.length) return 0;
    const xs = buildingCoords.map(([x]) => x);
    return (Math.max(...xs) - Math.min(...xs)) * 0.10;
  }, [buildingCoords, s?.id]);

  // 자하: 필로티 기둥 위치 (perimeter에서 N개 샘플)
  const zahaColumns = useMemo(() => {
    if (s?.id !== 'zaha' || buildingCoords.length < 3) return [];
    const n = Math.max(Math.min(Math.floor(buildingCoords.length / 2), 8), 4);
    const step = Math.floor(buildingCoords.length / n);
    return buildingCoords.filter((_, i) => i % step === 0).slice(0, n);
  }, [buildingCoords, s?.id]);

  // 자하: 상층부 하단 슬래브 geometry
  const slabGeo = useMemo(() =>
    s?.id === 'zaha' && buildingCoords.length >= 3
      ? new THREE.ExtrudeGeometry(makeShape(scaleCoordsFromCentroid(buildingCoords, 1.05)), { depth: 0.3, bevelEnabled: false })
      : null,
    [buildingCoords, s?.id]
  );

  // 클릭 시 lon/lat 역산 → 용도지역 조회 (KR 구역만 사용)
  const [cLon, cLat] = useMemo(() => {
    if (!districtCenter) return [0, 0];
    const { lon: centerLon, lat: centerLat } = districtCenter;
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const cx = lotCoords.reduce((s, [x]) => s + x, 0) / lotCoords.length;
    const cy = lotCoords.reduce((s, [, y]) => s + y, 0) / lotCoords.length;
    return [centerLon + cx / (111000 * cosLat), centerLat + cy / 111000];
  }, [lotCoords, districtCenter]);

  const handleClick = (e) => {
    e.stopPropagation();
    onParcelClick?.(cLon, cLat);
  };

  const lotFloorGeo = useMemo(() => {
    return new THREE.ShapeGeometry(makeShape(lotCoords));
  }, [lotCoords]);

  const groundGeo = useMemo(() => {
    return new THREE.ExtrudeGeometry(makeShape(buildingCoords), { depth: groundFloorH, bevelEnabled: false });
  }, [buildingCoords, groundFloorH]);

  const upperGeo = useMemo(() => {
    return new THREE.ExtrudeGeometry(makeShape(buildingCoords), { depth: upperH, bevelEnabled: false });
  }, [buildingCoords, upperH]);

  useEffect(() => {
    return () => { lotFloorGeo.dispose(); groundGeo.dispose(); upperGeo.dispose(); slabGeo?.dispose(); };
  }, [lotFloorGeo, groundGeo, upperGeo, slabGeo]);

  return (
    <group>
      {/* 대지 바닥면 (황색) — 커스텀 모드에서는 숨김 */}
      {showLotFloor && (
        <mesh geometry={lotFloorGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <meshStandardMaterial color="#E8C94A" transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* 대지 경계선 */}
      {showLotFloor && <LotOutline coords={lotCoords} />}
      {/* 저층부: 자하=필로티 기둥, 기타=솔리드 매스 */}
      {s?.id === 'zaha' ? (
        <>
          {zahaColumns.map(([cx, cy], i) => (
            <mesh key={`col_${i}`} position={[cx, groundFloorH / 2, -cy]} onClick={handleClick}
              onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            >
              <boxGeometry args={[0.5, groundFloorH, 0.5]} />
              <meshStandardMaterial key={`colmat_${s.id}`} color={s.upperFloorColor} roughness={s.roughness} metalness={s.metalness} />
            </mesh>
          ))}
          {slabGeo && (
            <mesh geometry={slabGeo} rotation={[-Math.PI / 2, 0, 0]} position={[zahaShiftX, groundFloorH - 0.3, 0]}>
              <meshStandardMaterial key={`slab_${s.id}`} color={s.floorPlateColor ?? '#F5F6F7'} metalness={s.floorPlateMetalness ?? 0.45} roughness={0.04} />
            </mesh>
          )}
        </>
      ) : (
        <mesh geometry={groundGeo} rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleClick}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <meshStandardMaterial
            key={`ground_${architectStyle?.id ?? 'default'}`}
            color={architectStyle ? (architectStyle.groundFloorColor ?? architectStyle.upperFloorColor) : (baselineMode ? '#94A3B8' : '#2563EB')}
            roughness={architectStyle?.roughness ?? 0.3}
            metalness={architectStyle?.metalness ?? 0.05}
            transparent={!architectStyle}
            opacity={architectStyle ? 1.0 : 0.85}
          />
        </mesh>
      )}
      {/* 상층부 */}
      {upperH > 0 && (
        <mesh geometry={upperGeo} rotation={[-Math.PI / 2, 0, 0]} position={[zahaShiftX, groundFloorH, 0]}
          onClick={handleClick}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <meshStandardMaterial
            key={`upper_${architectStyle?.id ?? 'default'}`}
            color={architectStyle ? architectStyle.upperFloorColor : (baselineMode ? '#A8B8C8' : '#A8B8C8')}
            roughness={architectStyle?.roughness ?? 0.4}
            metalness={architectStyle?.metalness ?? 0.05}
            transparent={!architectStyle}
            opacity={architectStyle ? 1.0 : 0.93}
          />
        </mesh>
      )}

      {/* ── 기본: 층 경계 수평선 ── */}
      {!s && buildingCoords.length >= 3 && floorCount > 1 &&
        Array.from({ length: Math.floor(totalHeight / 4) }).map((_, i) => {
          const h = 4 * (i + 1);
          return h < totalHeight
            ? <AndoFormworkRing key={`df_${i}`} coords={buildingCoords} height={h} color="#4E6070" />
            : null;
        })
      }

      {/* ── 안도: 900mm 피치 거푸집 줄눈 ── */}
      {s?.id === 'ando' && buildingCoords.length >= 3 &&
        Array.from({ length: Math.floor(totalHeight / (s.formworkInterval ?? 0.9)) }).map((_, i) => {
          const h = (s.formworkInterval ?? 0.9) * (i + 1);
          return h <= totalHeight
            ? <AndoFormworkRing key={`fw_${i}`} coords={buildingCoords} height={h} color={s.formworkColor} />
            : null;
        })
      }

      {/* ── 자하: 돌출 슬래브 플레이트 ── */}
      {s?.id === 'zaha' && buildingCoords.length >= 3 && totalHeight > 4 &&
        Array.from({ length: Math.floor(totalHeight / 4) }).map((_, i) => {
          const h = 4 * (i + 1);
          return h <= totalHeight
            ? <ZahaMapFloorPlate key={`plate_${i}`} coords={buildingCoords} height={h} t={h / totalHeight} style={s} />
            : null;
        })
      }
    </group>
  );
}

/** 녹지 (공원·풀밭) — 지면에 초록 폴리곤 */
function GreenSpaceArea({ coords }) {
  const geo = useMemo(() => {
    if (coords.length < 3) return null;
    return new THREE.ShapeGeometry(makeShape(coords));
  }, [coords]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
      <meshStandardMaterial color="#4ADE80" transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 도로 라인 — local_y → world -Z (건물과 동일 좌표계) */
function GeoJSONRoad({ lines, color }) {
  const positions = useMemo(() => {
    const pts = [];
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [x1, y1] = line[i];
        const [x2, y2] = line[i + 1];
        pts.push(x1, 0.1, -y1, x2, 0.1, -y2);
      }
    }
    return new Float32Array(pts);
  }, [lines]);

  if (positions.length === 0) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}

// ─────────────────────────────────────────
// 타일 지도 배경
// ─────────────────────────────────────────

const TILE_PX = 256;

function latLonToTileXY(lat, lon, zoom) {
  const n = Math.pow(2, zoom);
  const x = (lon + 180) / 360 * n;
  const sinLat = Math.sin(lat * Math.PI / 180);
  const y = (1 - Math.log((1 + sinLat) / (1 - sinLat)) / (2 * Math.PI)) / 2 * n;
  return { x, y };
}

function tileCornerLatLon(tx, ty, zoom) {
  const n = Math.pow(2, zoom);
  const lon = tx / n * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * ty / n)));
  return { lat: latRad * 180 / Math.PI, lon };
}

function TileGroundPlane({ centerLat, centerLon }) {
  const [state, setState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let createdTex = null;

    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const toLocal = (lon, lat) => [
      (lon - centerLon) * 111000 * cosLat,
      (lat - centerLat) * 111000,
    ];

    // zoom 16 고정 + 1400m 마진 — sceneSize 의존 제거로 깜빡임 방지
    const zoom = 16;
    const margin = 1400;
    const dLat = margin / 111000;
    const dLon = margin / (111000 * cosLat);

    const { x: x0f, y: y0f } = latLonToTileXY(centerLat + dLat, centerLon - dLon, zoom);
    const { x: x1f, y: y1f } = latLonToTileXY(centerLat - dLat, centerLon + dLon, zoom);
    const tileX0 = Math.floor(x0f), tileY0 = Math.floor(y0f);
    const tileX1 = Math.floor(x1f), tileY1 = Math.floor(y1f);
    const cols = tileX1 - tileX0 + 1;
    const rows = tileY1 - tileY0 + 1;

    const tl = tileCornerLatLon(tileX0, tileY0, zoom);
    const br = tileCornerLatLon(tileX1 + 1, tileY1 + 1, zoom);
    const [tlX, tlY] = toLocal(tl.lon, tl.lat);
    const [brX, brY] = toLocal(br.lon, br.lat);
    const worldW = brX - tlX;
    const worldD = tlY - brY;
    const planeCX = (tlX + brX) / 2;
    const planeCZ = -((tlY + brY) / 2);

    const canvas = document.createElement('canvas');
    canvas.width  = cols * TILE_PX;
    canvas.height = rows * TILE_PX;
    const ctx = canvas.getContext('2d');

    let loaded = 0;
    const total = cols * rows;

    const done = () => {
      if (cancelled) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.needsUpdate = true;
      createdTex = tex;
      setState({ tex, worldW, worldD, planeCX, planeCZ });
    };

    for (let ty = tileY0; ty <= tileY1; ty++) {
      for (let tx = tileX0; tx <= tileX1; tx++) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const px = (tx - tileX0) * TILE_PX;
        const py = (ty - tileY0) * TILE_PX;
        img.onload  = () => { ctx.filter = 'saturate(160%) contrast(120%)'; ctx.drawImage(img, px, py); ctx.filter = 'none'; if (++loaded === total) done(); };
        img.onerror = () => {                              if (++loaded === total) done(); };
        img.src = `/carto-tiles/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
      }
    }

    return () => {
      cancelled = true;
      createdTex?.dispose();
      createdTex = null;
      setState(null);
    };
  }, [centerLat, centerLon]); // sceneSize 제거 — 센터 변경 시에만 재로드

  if (!state) return <GroundPlane color="#EAECEF" />;
  const { tex, worldW, worldD, planeCX, planeCZ } = state;
  return (
    <>
      <GroundPlane color="#EAECEF" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[planeCX, -0.1, planeCZ]}>
        <planeGeometry args={[worldW, worldD]} />
        <meshBasicMaterial map={tex} />
      </mesh>
    </>
  );
}

function GeoJSONScene({ params, activeRuleSet, buildings, roads, greenSpaces = [], sceneSize, onParcelClick, districtCenter, baselineMode, architectStyle = null, showTiles = false }) {
  const s = architectStyle;
  const color       = RULE_SETS[activeRuleSet]?.color ?? '#3B82F6';
  const bgColor     = s?.bgColor      ?? '#EEF2F7';
  const groundColor = s?.groundColor  ?? '#EAECEF';
  const fogNear     = sceneSize * 2;
  const fogFar      = sceneSize * 6;
  const styleKey    = s?.id ?? 'default';

  return (
    <>
      <color key={`bg_${styleKey}`} attach="background" args={[bgColor]} />
      <fog key={`fog_${styleKey}`} attach="fog" args={[bgColor, fogNear, fogFar]} />
      <ambientLight intensity={s?.ambientIntensity ?? 0.85} />
      <directionalLight
        position={s?.id === 'ando'
          ? [sceneSize * 0.3, sceneSize * 1.8, sceneSize * 0.2]
          : [sceneSize * 0.8, sceneSize * 1.6, sceneSize * 0.5]}
        intensity={s?.dirIntensity ?? 0.9}
        color={s?.dirColor ?? '#FFFFFF'}
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      />
      {s?.id === 'zaha' && (
        <directionalLight position={[-sceneSize * 0.7, sceneSize * 0.9, -sceneSize * 0.3]} intensity={0.55} color="#BCD8F0" />
      )}
      {!s && <directionalLight position={[-sceneSize * 0.4, sceneSize * 0.8, -sceneSize * 0.6]} intensity={0.4} color="#DBEAFE" />}
      {showTiles && districtCenter
        ? <TileGroundPlane centerLat={districtCenter.lat} centerLon={districtCenter.lon} />
        : <GroundPlane color={groundColor} />
      }

      {/* 녹지 */}
      {!showTiles && greenSpaces.map((g, i) => (
        <GreenSpaceArea key={`green_${i}`} coords={g.coords} />
      ))}

      {/* 도로 — 타일 ON 시 숨김 */}
      {!showTiles && roads.map((road, i) => (
        <GeoJSONRoad key={i} lines={road.lines} color={road.color} width={road.width} />
      ))}

      {/* 건물 */}
      {buildings.map((building, i) =>
        building.rings.map((lotCoords, j) => (
          <GeoJSONBuilding
            key={`${i}-${j}`}
            lotCoords={lotCoords}
            params={params}
            color={color}
            actualFloors={building.floors}
            actualHeightM={building.heightM}
            onParcelClick={onParcelClick}
            districtCenter={districtCenter}
            baselineMode={baselineMode}
            architectStyle={s}
          />
        ))
      )}
    </>
  );
}

// ─────────────────────────────────────────
// ─────────────────────────────────────────
// 커스텀 필지 모드 씬
// ─────────────────────────────────────────

function CustomParcelBuilding({ lotCoords, params, color }) {
  const groundFloorH = params.ground_floor_height;
  const effectiveFAR = params.floor_area_ratio;
  const effectiveLCR = Math.min(params.lot_coverage_ratio, 90);
  const floorCount   = Math.max(Math.round(effectiveFAR / Math.max(effectiveLCR, 1)), 1);
  const totalHeight  = Math.min(groundFloorH + (floorCount - 1) * 4, params.height_limit);
  const upperH       = Math.max(totalHeight - groundFloorH, 0);
  const footprintScale = Math.sqrt(Math.min(effectiveLCR, 100) / 100);

  const buildingCoords = useMemo(
    () => scaleCoordsFromCentroid(lotCoords, footprintScale),
    [lotCoords, footprintScale]
  );

  const lotFloorGeo = useMemo(() => new THREE.ShapeGeometry(makeShape(lotCoords)), [lotCoords]);
  const groundGeo   = useMemo(() => new THREE.ExtrudeGeometry(makeShape(buildingCoords), { depth: groundFloorH, bevelEnabled: false }), [buildingCoords, groundFloorH]);
  const upperGeo    = useMemo(() => new THREE.ExtrudeGeometry(makeShape(buildingCoords), { depth: upperH, bevelEnabled: false }), [buildingCoords, upperH]);

  useEffect(() => () => { lotFloorGeo.dispose(); groundGeo.dispose(); upperGeo.dispose(); }, [lotFloorGeo, groundGeo, upperGeo]);

  return (
    <group>
      {/* 대지 바닥 */}
      <mesh geometry={lotFloorGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#E8C94A" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      {/* 대지 경계 */}
      <LotOutline coords={lotCoords} />
      {/* 저층부 */}
      <mesh geometry={groundGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <meshStandardMaterial color="#2563EB" transparent opacity={0.88} roughness={0.3} metalness={0.05} />
      </mesh>
      {/* 상층부 */}
      {upperH > 0 && (
        <mesh geometry={upperGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, groundFloorH, 0]} castShadow>
          <meshStandardMaterial color="#A8B8C8" transparent opacity={0.92} roughness={0.4} metalness={0.05} />
        </mesh>
      )}
    </group>
  );
}

/** 건물 없는 필지 — 경계선 + 바닥만 표시 */
function EmptyLot({ coords }) {
  const geo = useMemo(() => new THREE.ShapeGeometry(makeShape(coords)), [coords]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#CBD5E1" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <LotOutline coords={coords} />
    </group>
  );
}

function CustomParcelScene({ params, activeRuleSet, buildings, roads, parcelOutlines, sceneSize, baselineMode, architectStyle = null, showTiles = false, centerLat = null, centerLon = null }) {
  const s = architectStyle;
  const color       = RULE_SETS[activeRuleSet]?.color ?? '#3B82F6';
  const bgColor     = s?.bgColor      ?? '#EEF2F7';
  const groundColor = s?.groundColor  ?? '#EAECEF';
  const fogNear     = sceneSize * 2;
  const fogFar      = sceneSize * 6;
  const styleKey    = s?.id ?? 'default';

  return (
    <>
      <color key={`bg_${styleKey}`} attach="background" args={[bgColor]} />
      <fog key={`fog_${styleKey}`} attach="fog" args={[bgColor, fogNear, fogFar]} />
      <ambientLight intensity={s?.ambientIntensity ?? 0.85} />
      <directionalLight
        position={s?.id === 'ando'
          ? [sceneSize * 0.3, sceneSize * 1.8, sceneSize * 0.2]
          : [sceneSize * 0.8, sceneSize * 1.6, sceneSize * 0.5]}
        intensity={s?.dirIntensity ?? 0.9}
        color={s?.dirColor ?? '#FFFFFF'}
        castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}
      />
      {s?.id === 'zaha' && (
        <directionalLight position={[-sceneSize * 0.7, sceneSize * 0.9, -sceneSize * 0.3]} intensity={0.55} color="#BCD8F0" />
      )}
      {!s && <directionalLight position={[-sceneSize * 0.4, sceneSize * 0.8, -sceneSize * 0.6]} intensity={0.4} color="#DBEAFE" />}
      {showTiles && centerLat && centerLon
        ? <TileGroundPlane centerLat={centerLat} centerLon={centerLon} sceneSize={sceneSize} />
        : <GroundPlane color={groundColor} />
      }

      {/* 도로 — 타일 ON 시 숨김 */}
      {!showTiles && roads.map((road, i) => (
        <GeoJSONRoad key={i} lines={road.lines} color={road.color} width={road.width} />
      ))}

      {/* 선택 필지 경계선 */}
      {parcelOutlines.map((ring, i) => (
        <LotOutline key={`parcel-${i}`} coords={ring} />
      ))}

      {/* 건물 */}
      {buildings.map((building, i) =>
        building.rings.map((lotCoords, j) =>
          building.hasBuilding
            ? <GeoJSONBuilding
                key={`${i}-${j}`}
                lotCoords={lotCoords}
                params={params}
                color={color}
                actualFloors={building.floors}
                actualHeightM={building.heightM}
                baselineMode={baselineMode}
                showLotFloor={false}
                architectStyle={s}
              />
            : <EmptyLot key={`${i}-${j}`} coords={lotCoords} />
        )
      )}
    </>
  );
}

// ─────────────────────────────────────────
// 씬 참조 노출 (OBJ 내보내기용)
// ─────────────────────────────────────────

function SceneExporter({ sceneRef }) {
  const { scene } = useThree();
  useEffect(() => {
    if (sceneRef) sceneRef.current = scene;
  }, [scene, sceneRef]);
  return null;
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

export default function BuildingMass({ params, activeRuleSet, canvasRef, activeDistrict, sceneRef, showPedestrians, onZoneLoaded, baselineMode = false, customParcels = [], architectStyle = null }) {
  const mass = calculateMass(params, DEFAULT_LOT);
  const district = activeDistrict ? DISTRICTS[activeDistrict] : null;
  const isCustomMode = customParcels.length > 0;
  const isMapMode = !!district && !isCustomMode;
  const { buildings, roads, greenSpaces, sceneSize, loading, dataSource } = useGeoJSONScene(district);
  const { buildings: customBuildings, roads: customRoads, parcelOutlines, loading: customLoading, sceneSize: customSceneSize } = useCustomAreaScene(customParcels);

  const [zoningInfo, setZoningInfo] = useState(null);
  const [zoneFetching, setZoneFetching] = useState(false);
  const [showTiles, setShowTiles] = useState(false);

  // 커스텀 필지 모드 중심 좌표 계산
  const customCenter = useMemo(() => {
    if (!customParcels.length) return null;
    const allCoords = customParcels.flatMap(p => p.coordinates ?? []);
    if (!allCoords.length) return null;
    const lngs = allCoords.map(([lng]) => lng);
    const lats = allCoords.map(([, lat]) => lat);
    return {
      lat: (Math.min(...lats) + Math.max(...lats)) / 2,
      lon: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    };
  }, [customParcels]);

  const handleParcelClick = async (lon, lat) => {
    if (!VWORLD_KEY || zoneFetching || district?.country !== 'KR') return;
    setZoneFetching(true);
    setZoningInfo(null);
    try {
      // VWorld data API — POINT 필터 방식 (WFS보다 용도지역 조회에 안정적)
      const url = `/vworld/req/data?service=data&request=GetFeature&data=LT_C_UD001&key=${VWORLD_KEY}&geomFilter=POINT(${lon}%20${lat})&geometry=false&attribute=true&format=json&crs=EPSG:4326&size=5`;
      const r = await fetch(url);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch {
        // XML 에러 응답인 경우 — WFS 폴백 시도
        const d = 0.0005;
        const wfsUrl = `/vworld/req/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=LT_C_UD001&BBOX=${lon - d},${lat - d},${lon + d},${lat + d},EPSG:4326&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&KEY=${VWORLD_KEY}&COUNT=5`;
        const r2 = await fetch(wfsUrl);
        data = await r2.json();
      }

      // data API 응답 구조: data.response.result.featureCollection.features
      const features =
        data?.response?.result?.featureCollection?.features ||
        data?.features ||
        [];

      if (features.length === 0) {
        setZoningInfo({ error: '용도지역 정보 없음' });
        return;
      }

      const props = features[0]?.properties ?? {};
      const zoneName =
        props.uq_nm || props.UQ_NM ||
        Object.values(props).find(v => typeof v === 'string' && v.includes('지역')) ||
        '알 수 없음';

      const limits = SEOUL_ZONING_LIMITS[zoneName];
      const isSeoulBase = activeRuleSet === 'seoul';
      setZoningInfo({ zoneName, limits, applied: isSeoulBase && !!limits });

      // 서울 현행 규칙셋일 때만 슬라이더에 법적 한도 반영
      if (isSeoulBase && limits) onZoneLoaded?.(limits, zoneName);
    } catch (e) {
      console.error('용도지역 조회 실패:', e);
      setZoningInfo({ error: '조회 실패: ' + e.message });
    } finally {
      setZoneFetching(false);
    }
  };

  const camDist = isMapMode ? sceneSize * 0.9 : 120;
  const camPos = isMapMode ? [camDist * 0.6, camDist * 0.8, camDist] : [80, 90, 120];
  const camFov = isMapMode ? 50 : 40;

  const containerBg = architectStyle?.bgColor ?? '#EEF2F7';

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: containerBg }}>

      {/* 커스텀 필지 모드 오버레이 */}
      {isCustomMode && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          <div className="text-emerald-400 font-medium">내 대지 시뮬레이션</div>
          <div className="text-slate-300">필지 수: <span className="font-mono text-white">{customParcels.length}개</span></div>
          <div className="text-slate-300">총 면적: <span className="font-mono text-white">{customParcels.reduce((s,p)=>s+p.area,0).toFixed(0)}㎡</span></div>
          <button
            onClick={() => setShowTiles(v => !v)}
            className={`mt-1 w-full text-xs px-2 py-1 rounded font-medium transition-colors ${showTiles ? 'bg-sky-700 text-sky-100' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            {showTiles ? '지도 타일 ON' : '지도 타일 OFF'}
          </button>
        </div>
      )}

      {/* 직사각형 모드: 건물 정보 오버레이 */}
      {!isMapMode && !isCustomMode && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          {architectStyle && (
            <div className="text-indigo-300 font-semibold">{architectStyle.name}</div>
          )}
          <div className="text-slate-400">건물 규모</div>
          <div className="text-white font-mono">{Math.round(mass.buildingWidth)}m × {Math.round(mass.buildingDepth)}m</div>
          <div className="text-cyan-400 font-mono">{mass.floorCount}층 / {Math.round(mass.totalHeight)}m</div>
          <div className="text-green-400 font-mono">공개공지 {Math.round(mass.openSpaceDepth * DEFAULT_LOT.width)}m²</div>
        </div>
      )}

      {/* GeoJSON 모드: 로딩 표시 */}
      {isMapMode && loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60">
          <span className="text-slate-300 text-sm animate-pulse">지도 불러오는 중...</span>
        </div>
      )}

      {/* 커스텀 필지 모드: 로딩 표시 */}
      {isCustomMode && customLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60">
          <span className="text-slate-300 text-sm animate-pulse">VWorld 건물 데이터 불러오는 중...</span>
        </div>
      )}

      {/* 구역 모드: 정보 오버레이 */}
      {isMapMode && !loading && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          <div className="text-emerald-400 font-medium">{district?.name} ({district?.nameEn})</div>
          <div className="text-slate-300">건물 수: <span className="font-mono text-white">{buildings.length}동</span></div>
          <div className="text-slate-300">범위: <span className="font-mono text-white">~{Math.round(sceneSize)}m</span></div>
          <div className={`text-xs mt-1 font-medium ${dataSource === 'vworld' ? 'text-emerald-400' : 'text-amber-400'}`}>
            {dataSource === 'vworld' ? '브이월드 실측 데이터' : 'OSM 데이터'}
          </div>
          <div className={`text-xs mt-1.5 font-semibold px-1.5 py-0.5 rounded inline-block ${baselineMode ? 'bg-teal-800 text-teal-200' : 'bg-blue-900 text-blue-200'}`}>
            {baselineMode ? '현황 보기 중' : '시뮬레이션 중'}
          </div>
          {baselineMode && (
            <div className="text-slate-500 mt-0.5">슬라이더 조작 시 시뮬레이션 전환</div>
          )}
          {district?.country === 'KR' && (
            <div className="text-slate-500 mt-1">건물 클릭 → 용도지역 조회</div>
          )}
          <button
            onClick={() => setShowTiles(v => !v)}
            className={`mt-2 w-full text-xs px-2 py-1 rounded font-medium transition-colors ${showTiles ? 'bg-sky-700 text-sky-100' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            {showTiles ? '지도 타일 ON' : '지도 타일 OFF'}
          </button>
        </div>
      )}

      {/* 용도지역 조회 결과 */}
      {isMapMode && (zoneFetching || zoningInfo) && (
        <div className="absolute top-3 right-3 z-10 bg-slate-900/90 rounded-lg px-3 py-2 text-xs backdrop-blur min-w-40">
          {zoneFetching && (
            <div className="text-slate-400 animate-pulse">용도지역 조회 중...</div>
          )}
          {!zoneFetching && zoningInfo?.error && (
            <div className="text-amber-400">{zoningInfo.error}</div>
          )}
          {!zoneFetching && zoningInfo?.zoneName && (
            <>
              <div className="text-emerald-400 font-semibold mb-1">{zoningInfo.zoneName}</div>
              {zoningInfo.limits ? (
                <div className="text-slate-300 space-y-0.5">
                  <div>건폐율 <span className="text-white font-mono">{zoningInfo.limits.lot_coverage_ratio}%</span></div>
                  <div>용적률 <span className="text-white font-mono">{zoningInfo.limits.floor_area_ratio}%</span></div>
                  <div>높이제한 <span className="text-white font-mono">{zoningInfo.limits.height_limit}m</span></div>
                  {zoningInfo.applied ? (
                    <div className="text-emerald-500 pt-1">→ 법적 한도 슬라이더 반영</div>
                  ) : (
                    <div className="text-amber-400 pt-1">
                      → {RULE_SETS[activeRuleSet]?.name} 규칙 우선
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-500">매핑 데이터 없음</div>
              )}
            </>
          )}
        </div>
      )}

      {/* 범례 */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: RULE_SETS[activeRuleSet]?.color, opacity: 0.7 }} />
          <span className="text-slate-300">저층부</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-400" />
          <span className="text-slate-300">상층부</span>
        </div>
        {(isMapMode || isCustomMode) ? (
          <>
            <div className="text-slate-500 mt-0.5 mb-0.5 font-medium">공간 유형</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#526070' }} />
              <span className="text-slate-300">차도</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#E8CF96' }} />
              <span className="text-slate-300">인도·보행로</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#6EE7B7' }} />
              <span className="text-slate-300">자전거도로</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: '#4ADE80', opacity: 0.6 }} />
              <span className="text-slate-300">녹지·공원</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-400 opacity-60" />
              <span className="text-slate-300">대지 경계</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-500 opacity-60" />
              <span className="text-slate-300">공개공지</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-500 opacity-80" />
              <span className="text-slate-300">상업 연속 구간</span>
            </div>
          </>
        )}
      </div>

      <Canvas
        key={isCustomMode ? 'custom' : isMapMode ? 'geojson' : 'rect'}
        ref={canvasRef}
        camera={{ position: camPos, fov: camFov, near: 0.5, far: 20000 }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        {isCustomMode
          ? <CustomParcelScene params={params} activeRuleSet={activeRuleSet} buildings={customBuildings} roads={customRoads} parcelOutlines={parcelOutlines} sceneSize={customSceneSize} baselineMode={baselineMode} architectStyle={architectStyle} showTiles={showTiles} centerLat={customCenter?.lat} centerLon={customCenter?.lon} />
          : isMapMode
          ? <GeoJSONScene params={params} activeRuleSet={activeRuleSet} buildings={buildings} roads={roads} greenSpaces={greenSpaces} sceneSize={sceneSize} onParcelClick={handleParcelClick} districtCenter={district?.center} baselineMode={baselineMode} architectStyle={architectStyle} showTiles={showTiles} />
          : <Scene params={params} activeRuleSet={activeRuleSet} showPedestrians={showPedestrians} architectStyle={architectStyle} />
        }
        <SceneExporter sceneRef={sceneRef} />
        <OrbitControls enablePan={true} enableZoom={true} target={[0, 20, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
