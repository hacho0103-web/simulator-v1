/**
 * geoUtils.js
 * WGS84 → 로컬 미터 변환 + 폴리곤 유틸리티
 * (urban-rule-massing/src/lib/geoUtils.ts 포팅)
 */

/** [longitude, latitude] 링 → 로컬 미터 좌표 변환 */
export function toLocalMeters(coords) {
  if (!coords.length) return { points: [], width: 0, depth: 0, area: 0 };

  const cLng = coords.reduce((s, [lng]) => s + lng, 0) / coords.length;
  const cLat = coords.reduce((s, [, lat]) => s + lat, 0) / coords.length;
  const lngToM = 111320 * Math.cos((cLat * Math.PI) / 180);
  const latToM = 110540;

  const raw = coords.map(([lng, lat]) => [
    (lng - cLng) * lngToM,
    (lat - cLat) * latToM,
  ]);

  const xs = raw.map(([x]) => x);
  const zs = raw.map(([, z]) => z);
  const bboxCX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const bboxCZ = (Math.max(...zs) + Math.min(...zs)) / 2;
  const points = raw.map(([x, z]) => [x - bboxCX, z - bboxCZ]);

  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++)
    area += points[j][0] * points[i][1] - points[i][0] * points[j][1];

  return {
    points,
    width: Math.max(...xs) - Math.min(...xs),
    depth: Math.max(...zs) - Math.min(...zs),
    area: Math.abs(area) / 2,
  };
}

/** 여러 필지 bbox 합산 */
export function mergedBBox(parcels) {
  const { width, depth } = toLocalMeters(parcels.flatMap((p) => p.coordinates));
  return { width, depth, totalArea: parcels.reduce((s, p) => s + p.area, 0) };
}

/** Shoelace 면적 (m²) */
export function polygonArea(pts) {
  let a = 0;
  const n = pts.length;
  for (let i = 0, j = n - 1; i < n; j = i++)
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return Math.abs(a) / 2;
}
