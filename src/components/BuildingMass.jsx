import { useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { calculateMass } from '../utils/scoring';
import { DEFAULT_LOT, RULE_SETS } from '../data/rulesets';
import { DISTRICTS } from '../data/districts';
import PedestrianLayer from './PedestrianLayer';

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
            <meshStandardMaterial color={color} transparent opacity={0.55} />
          </mesh>
          {/* 우측 날개 */}
          <mesh position={[rightX, 0, solidBlockZ]}>
            <boxGeometry args={[wingW, height, solidDepth]} />
            <meshStandardMaterial color={color} transparent opacity={0.55} />
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
          <meshStandardMaterial color={color} transparent opacity={0.55} />
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

function UpperFloors({ width, depth, height, posY, posZ, floorCount }) {
  return (
    <group position={[0, posY, posZ]}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#94A3B8" transparent opacity={0.85} />
      </mesh>
      {Array.from({ length: floorCount - 1 }).map((_, i) => {
        const floorH = height / (floorCount - 1);
        return (
          <mesh key={i} position={[0, -height / 2 + floorH * (i + 1), 0]}>
            <boxGeometry args={[width + 0.1, 0.1, depth + 0.1]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        );
      })}
    </group>
  );
}

function Scene({ params, activeRuleSet, showPedestrians }) {
  const lot = DEFAULT_LOT;
  const mass = calculateMass(params, lot);
  const color = RULE_SETS[activeRuleSet]?.color ?? '#3B82F6';
  const hw = lot.width / 2;
  const hd = lot.depth / 2;
  const openSpaceZ = hd - mass.openSpaceDepth / 2;
  const buildingZ = hd - mass.openSpaceDepth - mass.frontSetback - mass.buildingDepth / 2;
  const upperHeight = mass.totalHeight - mass.groundFloorHeight;
  const groundFloorPosY = mass.groundFloorHeight / 2;
  const upperFloorPosY = mass.groundFloorHeight + upperHeight / 2;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[50, 80, 30]} intensity={1.2} castShadow />
      <directionalLight position={[-30, 40, -20]} intensity={0.4} />
      <Grid args={[200, 200]} cellSize={10} cellThickness={0.5} cellColor="#334155" sectionSize={50} sectionColor="#475569" fadeDistance={200} position={[0, 0, 0]} />
      <LotBoundary width={lot.width} depth={lot.depth} />
      <OpenSpace width={lot.width} depth={mass.openSpaceDepth} posZ={openSpaceZ} />
      <GroundFloor
        width={mass.buildingWidth} depth={mass.buildingDepth}
        height={mass.groundFloorHeight} posY={groundFloorPosY} posZ={buildingZ}
        transparency={params.facade_transparency} retailContinuity={params.retail_continuity}
        color={color}
        canopyDepth={params.canopy_depth ?? 0}
        canopyContinuity={params.canopy_continuity ?? 0}
        pilotisRatio={params.pilotis_ratio ?? 0}
        entranceFrequency={params.entrance_frequency ?? 3}
        pilotisDepth={params.pilotis_depth ?? 0}
        passageWidth={params.passage_width ?? 0}
      />
      {upperHeight > 0 && (
        <UpperFloors width={mass.buildingWidth} depth={mass.buildingDepth} height={upperHeight} posY={upperFloorPosY} posZ={buildingZ} floorCount={mass.floorCount} />
      )}
      <Text position={[0, mass.totalHeight + 3, buildingZ]} fontSize={2} color="white" anchorX="center" anchorY="bottom">
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
  motorway: 8, trunk: 7, primary: 6, secondary: 5,
  tertiary: 4, residential: 3, service: 2,
  footway: 1.5, path: 1, cycleway: 1.5, steps: 1,
};
const ROAD_COLOR = {
  motorway: '#F97316', trunk: '#FB923C', primary: '#FCD34D',
  secondary: '#A3E635', tertiary: '#67E8F9',
  residential: '#CBD5E1', service: '#94A3B8',
  footway: '#86EFAC', path: '#86EFAC', cycleway: '#6EE7B7', steps: '#86EFAC',
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
  const [sceneSize, setSceneSize] = useState(200);
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState('');

  useEffect(() => {
    if (!district) { setBuildings([]); setRoads([]); return; }
    setLoading(true);
    setBuildings([]);
    setRoads([]);

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
          const url = `https://api.vworld.kr/req/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=lt_c_uq011&BBOX=${w},${s},${e},${n},EPSG:4326&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&KEY=${VWORLD_KEY}&COUNT=500`;
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

    const query = `[out:json][timeout:30];way["highway"](${bbox});out geom;`;
    const CACHE_KEY = `roads_cache_${bbox}`;
    const OVERPASS_SERVERS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];
    const parseRoads = (data) =>
      data.elements.filter(el => el.type === 'way' && el.geometry).map(el => {
        const hw = el.tags?.highway ?? 'residential';
        return {
          lines: [el.geometry.map(pt => toLocal([pt.lon, pt.lat]))],
          width: ROAD_WIDTH[hw] ?? 2,
          color: ROAD_COLOR[hw] ?? '#94A3B8',
        };
      });

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
          const roads = parseRoads(data);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(roads)); } catch (e) {}
          return roads;
        } catch (e) { continue; }
      }
      return [];
    })();

    Promise.all([buildingPromise, roadPromise])
      .then(([buildings, roads]) => {
        setBuildings(buildings);
        setRoads(roads);
        setSceneSize(Math.max((e - w) * 111000 * cosLat, (n - s) * 111000, 200));
        setLoading(false);
      })
      .catch(err => { console.error('씬 로드 오류:', err); setLoading(false); });
  }, [district?.id]);

  return { buildings, roads, sceneSize, loading, dataSource };
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
  const segments = useMemo(() => {
    const segs = [];
    const loop = [...coords, coords[0]];
    for (let i = 0; i < loop.length - 1; i++) {
      const [x1, y1] = loop[i];
      const [x2, y2] = loop[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.01) continue;
      const angle = Math.atan2(dy, dx);
      segs.push({ cx: (x1 + x2) / 2, cz: -((y1 + y2) / 2), len, angle });
    }
    return segs;
  }, [coords]);

  return (
    <>
      {segments.map((s, i) => (
        <group key={i} position={[s.cx, 0.1, s.cz]} rotation={[0, s.angle, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[s.len, 0.5]} />
            <meshStandardMaterial color="#FBBF24" transparent opacity={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** 필지 좌표 기반 안정적 0~1 해시 — 리로드해도 동일값 */
function buildingVariance(coords) {
  if (!coords || coords.length === 0) return 0.5;
  const [x, y] = coords[0];
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return v - Math.floor(v);
}

function GeoJSONBuilding({ lotCoords, params, color, actualFloors = null, actualHeightM = null, onParcelClick, districtCenter }) {
  const groundFloorH = params.ground_floor_height;

  const v = buildingVariance(lotCoords);
  const devStage = Math.pow(v, 0.65);

  // VWorld 실제 데이터 우선, 없으면 파라미터 기반 추정
  const hasRealData = actualFloors || actualHeightM;

  let floorCount, totalHeight, footprintScale;
  if (hasRealData) {
    floorCount = actualFloors || Math.max(Math.round((actualHeightM - groundFloorH) / 4 + 1), 1);
    totalHeight = Math.min(
      actualHeightM || (groundFloorH + (floorCount - 1) * 4),
      params.height_limit
    );
    footprintScale = 1.0; // VWorld footprint은 실제 건물 외곽 → 스케일 불필요
  } else {
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
    return () => { lotFloorGeo.dispose(); groundGeo.dispose(); upperGeo.dispose(); };
  }, [lotFloorGeo, groundGeo, upperGeo]);

  return (
    <group>
      {/* 대지 바닥면 (연한 황색) */}
      <mesh geometry={lotFloorGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#F59E0B" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {/* 대지 경계선 */}
      <LotOutline coords={lotCoords} />
      {/* 저층부 */}
      <mesh geometry={groundGeo} rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        <meshStandardMaterial color={devStage > 0.5 ? color : '#94A3B8'} transparent opacity={0.55 + devStage * 0.3} />
      </mesh>
      {/* 상층부 */}
      {upperH > 0 && (
        <mesh geometry={upperGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, groundFloorH, 0]}
          onClick={handleClick}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <meshStandardMaterial color="#94A3B8" transparent opacity={0.7 + devStage * 0.2} />
        </mesh>
      )}
    </group>
  );
}

/** 도로 ribbon — local_y → world -Z (건물과 동일 좌표계) */
function GeoJSONRoad({ lines, color, width }) {
  const segments = useMemo(() => {
    const segs = [];
    for (const line of lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const [x1, y1] = line[i];
        const [x2, y2] = line[i + 1];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.01) continue;
        const angle = Math.atan2(dy, dx);
        segs.push({ cx: (x1 + x2) / 2, cz: -((y1 + y2) / 2), len, angle });
      }
    }
    return segs;
  }, [lines, width]);

  return (
    <>
      {segments.map((s, i) => (
        <group key={i} position={[s.cx, 0.05, s.cz]} rotation={[0, s.angle, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[s.len, width]} />
            <meshStandardMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function GeoJSONScene({ params, activeRuleSet, buildings, roads, sceneSize, onParcelClick, districtCenter }) {
  const color = RULE_SETS[activeRuleSet]?.color ?? '#3B82F6';
  const gridSize = Math.ceil(sceneSize / 100) * 200 + 200;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[sceneSize, sceneSize * 1.5, sceneSize]} intensity={1.2} castShadow />
      <directionalLight position={[-sceneSize * 0.5, sceneSize, -sceneSize * 0.5]} intensity={0.4} />
      <Grid args={[gridSize, gridSize]} cellSize={10} cellThickness={0.3} cellColor="#1E293B" sectionSize={50} sectionColor="#334155" fadeDistance={gridSize} />

      {/* 도로 */}
      {roads.map((road, i) => (
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
          />
        ))
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

export default function BuildingMass({ params, activeRuleSet, canvasRef, activeDistrict, sceneRef, showPedestrians, onZoneLoaded }) {
  const mass = calculateMass(params, DEFAULT_LOT);
  const district = activeDistrict ? DISTRICTS[activeDistrict] : null;
  const isMapMode = !!district;
  const { buildings, roads, sceneSize, loading, dataSource } = useGeoJSONScene(district);

  const [zoningInfo, setZoningInfo] = useState(null);
  const [zoneFetching, setZoneFetching] = useState(false);

  const handleParcelClick = async (lon, lat) => {
    if (!VWORLD_KEY || zoneFetching || district?.country !== 'KR') return;
    setZoneFetching(true);
    setZoningInfo(null);
    try {
      // VWorld data API — POINT 필터 방식 (WFS보다 용도지역 조회에 안정적)
      const url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=LT_C_UD001&key=${VWORLD_KEY}&geomFilter=POINT(${lon}%20${lat})&geometry=false&attribute=true&format=json&crs=EPSG:4326&size=5`;
      const r = await fetch(url);
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch {
        // XML 에러 응답인 경우 — WFS 폴백 시도
        const d = 0.0005;
        const wfsUrl = `https://api.vworld.kr/req/wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=LT_C_UD001&BBOX=${lon - d},${lat - d},${lon + d},${lat + d},EPSG:4326&SRSNAME=EPSG:4326&OUTPUTFORMAT=application/json&KEY=${VWORLD_KEY}&COUNT=5`;
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

  return (
    <div className="relative w-full h-full bg-slate-950">

      {/* 직사각형 모드: 건물 정보 오버레이 */}
      {!isMapMode && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          <div className="text-slate-400">건물 규모</div>
          <div className="text-white font-mono">{Math.round(mass.buildingWidth)}m × {Math.round(mass.buildingDepth)}m</div>
          <div className="text-cyan-400 font-mono">{mass.floorCount}층 / {Math.round(mass.totalHeight)}m</div>
          <div className="text-green-400 font-mono">공개공지 {Math.round(mass.openSpaceDepth * DEFAULT_LOT.width)}m²</div>
        </div>
      )}

      {/* GeoJSON 모드: 로딩 표시 */}
      {isMapMode && loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60">
          <span className="text-slate-300 text-sm animate-pulse">광화문 지도 불러오는 중...</span>
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
          {district?.country === 'KR' && (
            <div className="text-slate-500 mt-1">건물 클릭 → 용도지역 조회</div>
          )}
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
        {isMapMode ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-400 opacity-50" />
              <span className="text-slate-300">대지 경계</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-300" />
              <span className="text-slate-300">주요 도로</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-slate-400" />
              <span className="text-slate-300">이면도로</span>
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
        key={isMapMode ? 'geojson' : 'rect'}
        ref={canvasRef}
        camera={{ position: camPos, fov: camFov }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        {isMapMode
          ? <GeoJSONScene params={params} activeRuleSet={activeRuleSet} buildings={buildings} roads={roads} sceneSize={sceneSize} onParcelClick={handleParcelClick} districtCenter={district?.center} />
          : <Scene params={params} activeRuleSet={activeRuleSet} showPedestrians={showPedestrians} />
        }
        <SceneExporter sceneRef={sceneRef} />
        <OrbitControls enablePan={true} enableZoom={true} target={[0, 20, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
