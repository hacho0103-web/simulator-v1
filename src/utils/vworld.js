/**
 * vworld.js
 * V-World API 유틸리티
 * (urban-rule-massing/src/lib/vworld.ts 포팅)
 *
 * 데이터 API 호출 → Vite 프록시 /vworld (CORS 우회)
 * WMTS 타일 URL → 직접 https://api.vworld.kr (이미지 요청은 CORS 대상 아님)
 */

const API_KEY = import.meta.env.VITE_VWORLD_KEY;

const DATA = '/vworld';
const TILE_ROOT = `https://api.vworld.kr/req/wmts/1.0.0/${API_KEY}`;

export const WMTS_BASE  = `${TILE_ROOT}/Base/{z}/{y}/{x}.png`;
export const WMTS_CADAS = `${TILE_ROOT}/Cadastral/{z}/{y}/{x}.png`;

/**
 * 클릭 좌표(lat, lng)로 해당 필지 폴리곤 조회 (LP_PA_CBND_BUBUN)
 * 반환: { id, address, area, coordinates: [lng, lat][] } | null
 */
export async function queryParcelAtPoint(lat, lng) {
  const params = new URLSearchParams({
    service:     'data',
    request:     'GetFeature',
    data:        'LP_PA_CBND_BUBUN',
    key:         API_KEY,
    geomfilter:  `POINT(${lng} ${lat})`,
    geometry:    'true',
    attribute:   'true',
    crs:         'EPSG:4326',
    format:      'json',
    errorformat: 'json',
    size:        '5',
  });

  try {
    const res = await fetch(`${DATA}/req/data?${params}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.response?.status !== 'OK') return null;

    const features = json.response.result?.featureCollection?.features ?? [];
    if (!features.length) return null;

    const f    = features[0];
    const geom = f.geometry;
    let ring = [];
    if (geom?.type === 'Polygon') {
      ring = geom.coordinates?.[0] ?? [];
    } else if (geom?.type === 'MultiPolygon') {
      ring = geom.coordinates?.[0]?.[0] ?? [];
    }
    if (ring.length < 3) return null;

    return {
      id:          String(f.id ?? `${lng.toFixed(6)}_${lat.toFixed(6)}`),
      address:     f.properties?.addr ?? f.properties?.pnu ?? '주소 정보 없음',
      area:        parseFloat(f.properties?.area ?? '0') || shoelaceArea(ring),
      coordinates: ring,
    };
  } catch {
    return null;
  }
}

/** 주소 검색 → [{ title, lat, lng }] */
export async function searchAddress(query) {
  const params = new URLSearchParams({
    service:  'search',
    request:  'search',
    version:  '2.0',
    crs:      'EPSG:4326',
    size:     '7',
    page:     '1',
    query,
    type:     'address',
    category: 'road',
    key:      API_KEY,
    format:   'json',
  });

  try {
    const res = await fetch(`${DATA}/req/search?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.response?.status !== 'OK') return [];
    return (json.response.result?.items ?? []).map((item) => ({
      title: item.title,
      lat:   parseFloat(item.point?.y ?? '0'),
      lng:   parseFloat(item.point?.x ?? '0'),
    }));
  } catch {
    return [];
  }
}

/**
 * 폴리곤 내 필지 일괄 조회
 * ringLatLng: [[lat, lng], ...] (Leaflet 좌표 순서)
 * 반환: [{ id, address, area, coordinates: [lng, lat][] }]
 */
export async function queryParcelsInPolygon(ringLatLng) {
  if (ringLatLng.length < 3) return [];
  // WKT는 lng lat 순서, 닫힌 링 필요
  const closed = [...ringLatLng, ringLatLng[0]];
  const wkt = `POLYGON((${closed.map(([lat, lng]) => `${lng} ${lat}`).join(',')}))`;

  const params = new URLSearchParams({
    service:     'data',
    request:     'GetFeature',
    data:        'LP_PA_CBND_BUBUN',
    key:         API_KEY,
    geomfilter:  wkt,
    geometry:    'true',
    attribute:   'true',
    crs:         'EPSG:4326',
    format:      'json',
    errorformat: 'json',
    size:        '200',
  });

  try {
    const res = await fetch(`${DATA}/req/data?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    if (json.response?.status !== 'OK') return [];

    const features = json.response.result?.featureCollection?.features ?? [];
    return features.map(f => {
      const geom = f.geometry;
      let ring = [];
      if (geom?.type === 'Polygon') ring = geom.coordinates?.[0] ?? [];
      else if (geom?.type === 'MultiPolygon') ring = geom.coordinates?.[0]?.[0] ?? [];
      if (ring.length < 3) return null;
      return {
        id:          String(f.id ?? `parcel_${Math.random().toString(36).slice(2)}`),
        address:     f.properties?.addr ?? f.properties?.pnu ?? '주소 정보 없음',
        area:        parseFloat(f.properties?.area ?? '0') || shoelaceArea(ring),
        coordinates: ring,
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function shoelaceArea(ring) {
  if (ring.length < 3) return 0;
  const avgLat = ring.reduce((s, [, lat]) => s + lat, 0) / ring.length;
  const lngToM = 111320 * Math.cos((avgLat * Math.PI) / 180);
  const latToM = 110540;
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * lngToM * (ring[i][1] * latToM);
    area -= ring[i][0] * lngToM * (ring[j][1] * latToM);
  }
  return Math.abs(area) / 2;
}
