/**
 * SiteMapPanel.jsx
 * Leaflet + VWorld 지적도 기반 필지 선택 패널
 * (urban-rule-massing/src/components/SiteMapPanel.tsx 포팅 → Tailwind)
 *
 * 두 가지 모드:
 *   "click"  - 필지 클릭 → VWorld Data API로 폴리곤 조회 (다중 선택 가능)
 *   "draw"   - 두 점 클릭으로 사각형 대지 직접 정의
 */

import 'leaflet/dist/leaflet.css';
import { useState, useCallback, useEffect } from 'react';
import {
  MapContainer, TileLayer, Polygon, Polyline, Rectangle, useMapEvents, useMap,
} from 'react-leaflet';
import { queryParcelAtPoint, queryParcelsInPolygon, searchAddress, WMTS_BASE, WMTS_CADAS } from '../utils/vworld';
import { toLocalMeters, mergedBBox } from '../utils/geoUtils';

const SEOUL = [37.5665, 126.9780];

function ClickHandler({ active, onMapClick }) {
  useMapEvents({
    click(e) { if (active) onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 18, { duration: 1.2 });
  }, [target, map]);
  return null;
}

export default function SiteMapPanel({ onApply, onClose }) {
  const [parcels,       setParcels]      = useState(new Map());
  const [loading,       setLoading]      = useState(false);
  const [apiError,      setApiError]     = useState(null);
  const [searchQuery,   setSearchQuery]  = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [flyTarget,     setFlyTarget]    = useState(null);
  const [showCadastral, setShowCadastral] = useState(true);
  const [inputMode,     setInputMode]    = useState('click');
  const [drawCorner1,   setDrawCorner1]  = useState(null);
  const [drawCorner2,   setDrawCorner2]  = useState(null);
  const [polyVertices,  setPolyVertices] = useState([]); // 다각형 선택 모드

  const handlePolygonQuery = useCallback(async () => {
    if (polyVertices.length < 3) return;
    setLoading(true);
    setApiError(null);
    try {
      const results = await queryParcelsInPolygon(polyVertices);
      if (!results.length) {
        setApiError('선택한 영역 내 필지를 찾을 수 없습니다.');
        return;
      }
      const next = new Map();
      for (const parcel of results) {
        const { points, width, depth } = toLocalMeters(parcel.coordinates);
        const leafletCoords = parcel.coordinates.map(([lng, lat]) => [lat, lng]);
        next.set(parcel.id, { ...parcel, leafletCoords, width, depth, localPoints: points });
      }
      setParcels(next);
    } catch {
      setApiError('필지 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [polyVertices]);

  const handleMapClick = useCallback(async (lat, lng) => {
    setApiError(null);

    if (inputMode === 'polygon') {
      setPolyVertices(prev => [...prev, [lat, lng]]);
      return;
    }

    if (inputMode === 'draw') {
      if (!drawCorner1) { setDrawCorner1([lat, lng]); setDrawCorner2(null); }
      else              { setDrawCorner2([lat, lng]); }
      return;
    }

    setLoading(true);
    try {
      const parcel = await queryParcelAtPoint(lat, lng);
      if (!parcel) {
        setApiError('필지 정보를 찾을 수 없습니다. "직접 그리기" 모드를 사용해보세요.');
        return;
      }
      const { points, width, depth } = toLocalMeters(parcel.coordinates);
      const leafletCoords = parcel.coordinates.map(([lng, lat]) => [lat, lng]);
      setParcels((prev) => {
        const next = new Map(prev);
        if (next.has(parcel.id)) next.delete(parcel.id);
        else next.set(parcel.id, { ...parcel, leafletCoords, width, depth, localPoints: points });
        return next;
      });
    } catch {
      setApiError('필지 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [inputMode, drawCorner1]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    const results = await searchAddress(searchQuery);
    if (!results.length) setApiError('검색 결과가 없습니다.');
    setSearchResults(results);
  }, [searchQuery]);

  const resetDraw = useCallback(() => { setDrawCorner1(null); setDrawCorner2(null); }, []);
  const resetPoly = useCallback(() => { setPolyVertices([]); setParcels(new Map()); }, []);

  const handleApply = useCallback(() => {
    if (inputMode === 'draw' && drawCorner1 && drawCorner2) {
      const latDiff = Math.abs(drawCorner1[0] - drawCorner2[0]);
      const lngDiff = Math.abs(drawCorner1[1] - drawCorner2[1]);
      const avgLat  = (drawCorner1[0] + drawCorner2[0]) / 2;
      const depth   = latDiff * 110540;
      const width   = lngDiff * 111320 * Math.cos((avgLat * Math.PI) / 180);
      // 직접 그리기: 사각형 폴리곤 생성
      const hw = width / 2, hd = depth / 2;
      const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      onApply([{
        id: 'drawn',
        address: '직접 그리기',
        area: Math.round(width * depth),
        localPoints: pts,
        width: Math.round(width * 10) / 10,
        depth: Math.round(depth * 10) / 10,
      }]);
      return;
    }
    if (!parcels.size) return;
    const list = [...parcels.values()];
    onApply(list.map(p => ({
      id:          p.id,
      address:     p.address,
      area:        p.area,
      localPoints: p.localPoints,
      width:       p.width,
      depth:       p.depth,
      coordinates: p.coordinates,  // WGS84 [lng,lat][] ring — 3D 세계좌표 배치에 필요
    })));
  }, [inputMode, drawCorner1, drawCorner2, parcels, onApply]);

  const totalArea = [...parcels.values()].reduce((s, p) => s + p.area, 0);
  const canApply  =
    (inputMode === 'click'   && parcels.size > 0) ||
    (inputMode === 'polygon' && parcels.size > 0) ||
    (inputMode === 'draw'    && drawCorner1 && drawCorner2);

  const rectBounds = drawCorner1 && drawCorner2 ? [drawCorner1, drawCorner2] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-[780px] max-w-[95vw] flex flex-col overflow-hidden" style={{ height: '85vh' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <h2 className="text-sm font-semibold text-white">대지 선택</h2>
          <div className="flex items-center gap-2">
            {/* 모드 토글 */}
            <div className="flex rounded overflow-hidden border border-slate-600 text-xs">
              {[['click','필지 선택'], ['polygon','다각형 선택'], ['draw','직접 그리기']].map(([mode, label]) => (
                <button key={mode}
                  onClick={() => { setInputMode(mode); resetDraw(); resetPoly(); setApiError(null); }}
                  className={`px-3 py-1.5 transition-all ${inputMode === mode ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* 지적도 토글 */}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none">
              <input type="checkbox" checked={showCadastral}
                onChange={e => setShowCadastral(e.target.checked)} className="accent-emerald-500" />
              지적도
            </label>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-lg leading-none px-1">×</button>
          </div>
        </div>

        {/* 주소 검색 */}
        <div className="flex gap-2 px-4 py-2 border-b border-slate-700 shrink-0">
          <input
            className="flex-1 bg-slate-800 text-white text-xs rounded px-3 py-1.5 border border-slate-600 outline-none focus:border-emerald-500 placeholder:text-slate-500"
            placeholder="주소 검색 (예: 광화문광장, 세종대로 172)"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setSearchResults([]); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded border border-slate-600">
            검색
          </button>
        </div>

        {/* 검색 결과 드롭다운 */}
        {searchResults.length > 0 && (
          <ul className="absolute z-[1000] bg-slate-800 border border-slate-600 rounded shadow-lg mt-1 text-xs max-h-40 overflow-y-auto"
              style={{ left: 16, right: 16, top: 108 }}>
            {searchResults.map((r, i) => (
              <li key={i}
                className="px-3 py-2 hover:bg-slate-700 cursor-pointer text-slate-200"
                onClick={() => { setFlyTarget([r.lat, r.lng]); setSearchQuery(r.title); setSearchResults([]); }}>
                {r.title}
              </li>
            ))}
          </ul>
        )}

        {/* 다각형 선택 안내 */}
        {inputMode === 'polygon' && (
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs text-slate-300 flex items-center gap-3 shrink-0">
            <span>
              {parcels.size > 0
                ? `${parcels.size}개 필지 선택됨 — 다시 그리려면 초기화`
                : polyVertices.length === 0 ? '지도를 클릭해 영역을 그리세요 (3점 이상)'
                : polyVertices.length < 3   ? `${polyVertices.length}점 추가됨 — 최소 3점 필요`
                : `${polyVertices.length}점 — "필지 조회" 버튼을 눌러 필지를 불러오세요`}
            </span>
            {polyVertices.length > 0 && parcels.size === 0 && (
              <button onClick={resetPoly} className="text-amber-400 hover:text-amber-300 underline">초기화</button>
            )}
            {polyVertices.length >= 3 && parcels.size === 0 && (
              <button
                onClick={handlePolygonQuery}
                disabled={loading}
                className="ml-auto bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >
                {loading ? '조회 중…' : '필지 조회'}
              </button>
            )}
            {parcels.size > 0 && (
              <button onClick={resetPoly} className="ml-auto text-amber-400 hover:text-amber-300 underline">초기화</button>
            )}
          </div>
        )}

        {/* 직접 그리기 안내 */}
        {inputMode === 'draw' && (
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs text-slate-300 flex items-center gap-3 shrink-0">
            <span>
              {!drawCorner1 ? '① 대지의 한쪽 모서리를 클릭하세요'
                : !drawCorner2 ? '② 반대쪽 모서리를 클릭하세요'
                : '사각형 설정 완료. 아래에서 적용하세요.'}
            </span>
            {drawCorner1 && (
              <button onClick={resetDraw} className="text-amber-400 hover:text-amber-300 underline">
                다시 그리기
              </button>
            )}
          </div>
        )}

        {/* 지도 */}
        <div className="flex-1 relative overflow-hidden">
          <MapContainer center={SEOUL} zoom={17} style={{ width: '100%', height: '100%' }} zoomControl>
            <TileLayer url={WMTS_BASE} maxZoom={19} attribution="© V-World (국토지리정보원)" />
            {showCadastral && <TileLayer url={WMTS_CADAS} maxZoom={19} opacity={0.7} />}
            <FlyTo target={flyTarget} />
            <ClickHandler active onMapClick={handleMapClick} />
            {[...parcels.values()].map(p => (
              <Polygon key={p.id} positions={p.leafletCoords}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.22, weight: 2.5 }} />
            ))}
            {rectBounds && (
              <Rectangle bounds={rectBounds}
                pathOptions={{ color: '#16a34a', fillColor: '#22c55e', fillOpacity: 0.18, weight: 2.5, dashArray: '6 3' }} />
            )}
            {polyVertices.length >= 3 && parcels.size === 0 && (
              <Polygon positions={polyVertices}
                pathOptions={{ color: '#f59e0b', fillColor: '#fcd34d', fillOpacity: 0.12, weight: 2, dashArray: '5 4' }} />
            )}
            {polyVertices.length === 2 && (
              <Polyline positions={polyVertices}
                pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '5 4' }} />
            )}
          </MapContainer>
        </div>

        {/* 하단 정보 + 적용 */}
        <div className="px-4 py-2.5 border-t border-slate-700 flex items-center gap-3 shrink-0 min-h-[52px]">
          {loading && <span className="text-xs text-slate-400 animate-pulse">필지 조회 중…</span>}
          {apiError && <span className="text-xs text-red-400">{apiError}</span>}

          {!loading && !apiError && inputMode === 'click' && parcels.size === 0 && (
            <span className="text-xs text-slate-500">지적도에서 필지를 클릭하세요. 여러 필지 선택 가능 (재클릭 시 해제)</span>
          )}

          {inputMode === 'click' && parcels.size > 0 && (
            <div className="flex flex-wrap gap-1.5 flex-1">
              {[...parcels.values()].map(p => (
                <span key={p.id} className="bg-blue-900/60 text-blue-200 text-xs px-2 py-0.5 rounded border border-blue-700">
                  {p.address} <span className="opacity-60">{p.area.toFixed(0)}㎡</span>
                </span>
              ))}
              {parcels.size > 1 && (
                <span className="text-xs text-slate-400">합계 {totalArea.toFixed(0)}㎡</span>
              )}
            </div>
          )}

          {inputMode === 'draw' && drawCorner1 && drawCorner2 && (() => {
            const d = Math.abs(drawCorner1[0] - drawCorner2[0]) * 110540;
            const w = Math.abs(drawCorner1[1] - drawCorner2[1]) * 111320 * Math.cos(((drawCorner1[0] + drawCorner2[0]) / 2 * Math.PI) / 180);
            return <span className="text-xs text-slate-300 flex-1">가로 {w.toFixed(1)}m × 세로 {d.toFixed(1)}m ≈ {(w * d).toFixed(0)}㎡</span>;
          })()}

          <div className="ml-auto flex gap-2">
            <button onClick={onClose}
              className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600">
              취소
            </button>
            {canApply && (
              <button onClick={handleApply}
                className="text-xs px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                시뮬레이션에 적용 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
