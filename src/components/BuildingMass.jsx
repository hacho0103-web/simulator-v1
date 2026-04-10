import { useEffect, useState, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { calculateMass } from '../utils/scoring';
import { DEFAULT_LOT, RULE_SETS } from '../data/rulesets';
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
}) {
  // 캐노피: 전면 상단 돌출
  const canopyW = width * (canopyContinuity / 100);

  // 필로티: 전면 하단 기둥 (4m 간격)
  const pilotisW = width * (pilotisRatio / 100);
  const numCols = pilotisRatio > 0 ? Math.max(Math.floor(pilotisW / 4), 1) : 0;
  const colSpacing = numCols > 0 ? pilotisW / numCols : 0;
  const colStartX = -(pilotisW / 2) + colSpacing / 2;

  // 출입구: 전면 입면에 어두운 세로 슬릿
  const numEntrances = Math.max(Math.round((width / 100) * entranceFrequency), 1);
  const entrSpacing = width / (numEntrances + 1);

  return (
    <group position={[0, posY, posZ]}>
      {/* 메인 매스 */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} transparent opacity={0.55} />
      </mesh>

      {/* 파사드 투명도 레이어 */}
      <mesh position={[0, 0, depth / 2 + 0.05]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#93C5FD" transparent opacity={transparency / 100 * 0.6 + 0.1} />
      </mesh>

      {/* 상업 연속성 */}
      {retailContinuity > 0 && (
        <mesh position={[(-width / 2) + (width * retailContinuity / 100 / 2), 0, depth / 2 + 0.1]}>
          <planeGeometry args={[width * retailContinuity / 100, height * 0.6]} />
          <meshStandardMaterial color="#F97316" transparent opacity={0.7} />
        </mesh>
      )}

      {/* 캐노피 */}
      {canopyDepth > 0 && canopyContinuity > 0 && (
        <mesh position={[0, height / 2 - 0.15, depth / 2 + canopyDepth / 2]}>
          <boxGeometry args={[canopyW, 0.3, canopyDepth]} />
          <meshStandardMaterial color="#CBD5E1" transparent opacity={0.9} />
        </mesh>
      )}

      {/* 필로티 기둥 */}
      {numCols > 0 && Array.from({ length: numCols }).map((_, i) => (
        <mesh key={i} position={[colStartX + colSpacing * i, 0, depth / 2 + 0.25]}>
          <boxGeometry args={[0.5, height, 0.5]} />
          <meshStandardMaterial color="#475569" transparent opacity={0.95} />
        </mesh>
      ))}

      {/* 출입구 */}
      {Array.from({ length: numEntrances }).map((_, i) => (
        <mesh key={i} position={[-width / 2 + entrSpacing * (i + 1), -height / 2 + 1.5, depth / 2 + 0.12]}>
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

// 광화문 일대 중심좌표 및 범위 (좁은 범위로 고정)
const GWANGHWAMUN = {
  centerLon: 126.9769,
  centerLat: 37.5740,
  bbox: '37.572,126.974,37.577,126.981', // 남위,서경,북위,동경
};

function parseGeoJSONFeatures(data, centerLon, centerLat) {
  const cosLat = Math.cos(centerLat * Math.PI / 180);
  const toLocal = ([lon, lat]) => [
    (lon - centerLon) * 111000 * cosLat,
    (lat - centerLat) * 111000,
  ];

  const getRings = f =>
    f.geometry.type === 'Polygon'
      ? [f.geometry.coordinates[0]]
      : f.geometry.coordinates.map(p => p[0]);

  const buildings = data.features
    .filter(f => f.properties?.building &&
      (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'))
    .map(f => ({
      rings: getRings(f).map(ring => ring.map(toLocal)),
      name: f.properties?.name || '',
    }));

  const roads = data.features
    .filter(f => f.properties?.highway &&
      (f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'))
    .map(f => {
      const hw = f.properties.highway;
      const lines = f.geometry.type === 'LineString'
        ? [f.geometry.coordinates]
        : f.geometry.coordinates;
      return {
        lines: lines.map(line => line.map(toLocal)),
        width: ROAD_WIDTH[hw] ?? 2,
        color: ROAD_COLOR[hw] ?? '#94A3B8',
      };
    });

  return { buildings, roads };
}

function useGeoJSONScene(buildingUrl, enabled) {
  const [buildings, setBuildings] = useState([]);
  const [roads, setRoads] = useState([]);
  const [sceneSize, setSceneSize] = useState(200);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);

    const { centerLon, centerLat, bbox } = GWANGHWAMUN;

    // 건물: 기존 로컬 GeoJSON
    const buildingPromise = fetch(buildingUrl)
      .then(r => r.json())
      .then(data => {
        const { buildings } = parseGeoJSONFeatures(data, centerLon, centerLat);
        return buildings;
      });

    // 도로: Overpass API (다중 서버 + 로컬 캐시)
    const cosLat = Math.cos(centerLat * Math.PI / 180);
    const toLocal = ([lon, lat]) => [
      (lon - centerLon) * 111000 * cosLat,
      (lat - centerLat) * 111000,
    ];
    const query = `[out:json][timeout:30];way["highway"](${bbox});out geom;`;
    const CACHE_KEY = `roads_cache_${bbox}`;
    const OVERPASS_SERVERS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];

    const parseRoads = (data) =>
      data.elements
        .filter(el => el.type === 'way' && el.geometry)
        .map(el => {
          const hw = el.tags?.highway ?? 'residential';
          return {
            lines: [el.geometry.map(pt => toLocal([pt.lon, pt.lat]))],
            width: ROAD_WIDTH[hw] ?? 2,
            color: ROAD_COLOR[hw] ?? '#94A3B8',
          };
        });

    const roadPromise = (async () => {
      // 캐시 확인
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) return JSON.parse(cached);
      } catch (e) {}

      // 다중 서버 순차 시도
      for (const server of OVERPASS_SERVERS) {
        try {
          const r = await fetch(`${server}?data=${encodeURIComponent(query)}`);
          if (!r.ok) continue;
          const data = await r.json();
          const roads = parseRoads(data);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify(roads)); } catch (e) {}
          return roads;
        } catch (e) {
          continue;
        }
      }
      console.warn('모든 Overpass 서버 실패 — 도로 데이터 없음');
      return [];
    })();

    Promise.all([buildingPromise, roadPromise])
      .then(([buildings, roads]) => {
        // 씬 크기: 건물 기준
        const cosLat = Math.cos(centerLat * Math.PI / 180);
        const [s, w, n, e] = bbox.split(',').map(Number); // south,west,north,east
        const width = (e - w) * 111000 * cosLat;
        const height = (n - s) * 111000;
        setBuildings(buildings);
        setRoads(roads);
        setSceneSize(Math.max(width, height, 200));
        setLoading(false);
      })
      .catch(err => {
        console.error('씬 로드 오류:', err);
        setLoading(false);
      });
  }, [buildingUrl, enabled]);

  return { buildings, roads, sceneSize, loading };
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

function GeoJSONBuilding({ lotCoords, params, color }) {
  const groundFloorH = params.ground_floor_height;

  // 필지별 개발 단계 (0=저개발 ~ 1=고개발), 현실적 분포로 낮은 쪽 가중
  const v = buildingVariance(lotCoords);
  const devStage = Math.pow(v, 0.65); // 0~1, 저개발 필지가 더 많도록

  // 파라미터 = 정책 기준값, devStage에 따라 20~100% 범위에서 실현
  const effectiveFAR = params.floor_area_ratio * (0.2 + devStage * 0.8);
  const effectiveLCR = Math.min(params.lot_coverage_ratio * (0.4 + devStage * 0.6), 90);

  const footprintScale = Math.sqrt(Math.min(effectiveLCR, 100) / 100);
  const buildingCoords = useMemo(
    () => scaleCoordsFromCentroid(lotCoords, footprintScale),
    [lotCoords, footprintScale]
  );

  // 층수 = 유효 용적률 / 유효 건폐율, 높이제한도 개발단계에 비례
  const floorCount = Math.max(Math.round(effectiveFAR / Math.max(effectiveLCR, 1)), 1);
  const heightCap = params.height_limit * (0.25 + devStage * 0.75);
  const totalHeight = Math.min(groundFloorH + (floorCount - 1) * 4, heightCap);
  const upperH = Math.max(totalHeight - groundFloorH, 0);

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
      {/* 저층부 — 개발단계 낮을수록 연한 회색, 높을수록 규칙셋 색상 */}
      <mesh geometry={groundGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={devStage > 0.5 ? color : '#94A3B8'} transparent opacity={0.55 + devStage * 0.3} />
      </mesh>
      {/* 상층부 */}
      {upperH > 0 && (
        <mesh geometry={upperGeo} rotation={[-Math.PI / 2, 0, 0]} position={[0, groundFloorH, 0]}>
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

function GeoJSONScene({ params, activeRuleSet, buildings, roads, sceneSize }) {
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

export default function BuildingMass({ params, activeRuleSet, canvasRef, geoJSONMode, sceneRef, showPedestrians }) {
  const mass = calculateMass(params, DEFAULT_LOT);
  const { buildings, roads, sceneSize, loading } = useGeoJSONScene('/gwanghwamun.geojson', geoJSONMode);

  const camDist = geoJSONMode ? sceneSize * 0.9 : 120;
  const camPos = geoJSONMode ? [camDist * 0.6, camDist * 0.8, camDist] : [80, 90, 120];
  const camFov = geoJSONMode ? 50 : 40;

  return (
    <div className="relative w-full h-full bg-slate-950">

      {/* 직사각형 모드: 건물 정보 오버레이 */}
      {!geoJSONMode && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          <div className="text-slate-400">건물 규모</div>
          <div className="text-white font-mono">{Math.round(mass.buildingWidth)}m × {Math.round(mass.buildingDepth)}m</div>
          <div className="text-cyan-400 font-mono">{mass.floorCount}층 / {Math.round(mass.totalHeight)}m</div>
          <div className="text-green-400 font-mono">공개공지 {Math.round(mass.openSpaceDepth * DEFAULT_LOT.width)}m²</div>
        </div>
      )}

      {/* GeoJSON 모드: 로딩 표시 */}
      {geoJSONMode && loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60">
          <span className="text-slate-300 text-sm animate-pulse">광화문 지도 불러오는 중...</span>
        </div>
      )}

      {/* GeoJSON 모드: 정보 오버레이 */}
      {geoJSONMode && !loading && (
        <div className="absolute top-3 left-3 z-10 bg-slate-900/80 rounded-lg px-3 py-2 text-xs space-y-1 backdrop-blur">
          <div className="text-emerald-400 font-medium">광화문 실제 대지 모드</div>
          <div className="text-slate-300">건물 수: <span className="font-mono text-white">{buildings.length}동</span></div>
          <div className="text-slate-300">범위: <span className="font-mono text-white">~{Math.round(sceneSize)}m</span></div>
          <div className="text-slate-400 mt-1">저층부 파라미터 적용 중</div>
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
        {geoJSONMode ? (
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
        key={geoJSONMode ? 'geojson' : 'rect'}
        ref={canvasRef}
        camera={{ position: camPos, fov: camFov }}
        shadows
        gl={{ preserveDrawingBuffer: true }}
      >
        {geoJSONMode
          ? <GeoJSONScene params={params} activeRuleSet={activeRuleSet} buildings={buildings} roads={roads} sceneSize={sceneSize} />
          : <Scene params={params} activeRuleSet={activeRuleSet} showPedestrians={showPedestrians} />
        }
        <SceneExporter sceneRef={sceneRef} />
        <OrbitControls enablePan={true} enableZoom={true} target={[0, 20, 0]} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>
    </div>
  );
}
