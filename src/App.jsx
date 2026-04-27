import { useState, useRef } from 'react';
import ParameterPanel from './components/ParameterPanel';
import BuildingMass from './components/BuildingMass';
import AnalysisRadar from './components/AnalysisRadar';
import ScatterPlot from './components/ScatterPlot';
import ExportButtons from './components/ExportButtons';
import SiteMapPanel from './components/SiteMapPanel';
import { calculateScores } from './utils/scoring';
import { RULE_SETS } from './data/rulesets';
import { DISTRICTS } from './data/districts';
import { ARCH_STYLES } from './data/architectStyles';
import './index.css';

export default function App() {
  const [activeRuleSet, setActiveRuleSet] = useState('seoul');
  const [params, setParams] = useState({ ...RULE_SETS.seoul.params });
  const [compareMode, setCompareMode] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState(null); // null = 단일 건물 모드
  const [showPedestrians, setShowPedestrians] = useState(false);
  const [baselineMode, setBaselineMode] = useState(false); // true = 현황, false = 시뮬레이션
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [customParcels, setCustomParcels] = useState([]);
  const [architectStyleId, setArchitectStyleId] = useState(null); // null = 기본

  const handleDistrictChange = (districtId) => {
    setActiveDistrict(districtId);
    setCustomParcels([]); // 지구 모드로 전환 시 커스텀 필지 초기화
    if (districtId && DISTRICTS[districtId]) {
      const rs = DISTRICTS[districtId].defaultRuleSet;
      setActiveRuleSet(rs);
      setParams({ ...RULE_SETS[rs].params });
      setBaselineMode(true); // 지도 첫 진입 = 현황 모드
    } else {
      setBaselineMode(false);
    }
  };

  const handleParamsChange = (newParams) => {
    setBaselineMode(false); // 파라미터 조작 = 시뮬레이션 모드로 전환
    setParams(newParams);
  };

  const handleParcelsApply = (parcels) => {
    setCustomParcels(parcels);
    setActiveDistrict(null);
    setShowMapPanel(false);
    setBaselineMode(false);
  };
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);

  const scores = calculateScores(params);

  const handleZoneLoaded = (limits) => {
    setParams(prev => ({ ...prev, ...limits }));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-base font-bold text-white">저층부 형태 시뮬레이터</h1>
          <p className="text-xs text-slate-400">도시 가이드라인의 형태 생성 규칙화 — 바이브 코딩 프로토타입</p>
        </div>

        <div className="flex items-center gap-3">
          {/* P-index / D-index 요약 */}
          <div className="flex gap-3 text-xs">
            <div className="bg-blue-900/40 border border-blue-700 rounded px-3 py-1">
              <span className="text-blue-300">P-index</span>
              <span className="text-white font-mono ml-2 text-base font-bold">{scores.pIndex}</span>
            </div>
            <div className="bg-orange-900/40 border border-orange-700 rounded px-3 py-1">
              <span className="text-orange-300">D-index</span>
              <span className="text-white font-mono ml-2 text-base font-bold">{scores.dIndex}</span>
            </div>
          </div>

          {/* 내 대지 선택 */}
          <button
            onClick={() => setShowMapPanel(true)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              customParcels.length > 0
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {customParcels.length > 0 ? `✓ 대지 ${customParcels.length}필지` : '내 대지 선택'}
          </button>

          {/* 보행자 시뮬레이션 토글 */}
          <button
            onClick={() => setShowPedestrians(!showPedestrians)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              showPedestrians
                ? 'bg-yellow-500 text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {showPedestrians ? '✓ 보행자 ON' : '보행자'}
          </button>

          {/* 건축가 스타일 탭 */}
          <div className="flex rounded overflow-hidden border border-slate-600 text-xs">
            {[
              { id: null,   label: '기본' },
              { id: 'ando', label: '안도' },
              { id: 'zaha', label: '자하' },
            ].map(({ id, label }) => (
              <button
                key={id ?? 'default'}
                onClick={() => setArchitectStyleId(id)}
                title={id ? ARCH_STYLES[id]?.nameEn : '기본 스타일'}
                className={`px-3 py-1.5 font-medium transition-all ${
                  architectStyleId === id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 구역 선택 */}
          <div className="flex rounded overflow-hidden border border-slate-600 text-xs">
            {[
              { id: null,           label: '단일 건물' },
              { id: 'gwanghwamun',  label: '광화문' },
              { id: 'marunouchi',   label: '마루노우치' },
              { id: 'hafencity',    label: '하펜시티' },
            ].map(({ id, label }) => (
              <button
                key={id ?? 'simple'}
                onClick={() => handleDistrictChange(id)}
                className={`px-3 py-1.5 font-medium transition-all ${
                  activeDistrict === id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 비교 모드 토글 */}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
              compareMode
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {compareMode ? '✓ 비교 모드 ON' : '비교 모드'}
          </button>

          <ExportButtons canvasRef={canvasRef} sceneRef={sceneRef} params={params} activeRuleSet={activeRuleSet} />
        </div>
      </header>

      {/* 메인 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 파라미터 패널 */}
        <div className="w-72 shrink-0 overflow-hidden flex flex-col">
          <ParameterPanel
            params={params}
            onParamsChange={handleParamsChange}
            activeRuleSet={activeRuleSet}
            onRuleSetChange={setActiveRuleSet}
          />
        </div>

        {/* 오른쪽: 3D 뷰어 + 분석 차트 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 3D 뷰어 */}
          <div className="flex-1 overflow-hidden" ref={canvasRef}>
            <BuildingMass
              params={params}
              activeRuleSet={activeRuleSet}
              canvasRef={canvasRef}
              sceneRef={sceneRef}
              activeDistrict={activeDistrict}
              showPedestrians={showPedestrians}
              onZoneLoaded={handleZoneLoaded}
              baselineMode={baselineMode}
              customParcels={customParcels}
              architectStyle={architectStyleId ? ARCH_STYLES[architectStyleId] : null}
            />
          </div>

          {/* 하단 분석 차트 */}
          <div className="h-80 shrink-0 flex gap-3 p-3 bg-slate-950 border-t border-slate-800">
            <div className="flex-1 min-w-0">
              <AnalysisRadar
                params={params}
                activeRuleSet={activeRuleSet}
                compareMode={compareMode}
              />
            </div>
            <div className="flex-1 min-w-0">
              <ScatterPlot params={params} />
            </div>

            {/* 파라미터 점수 요약 */}
            <div className="w-52 shrink-0 bg-slate-900 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">점수 요약</h3>
              {[
                { key: 'publicness',     label: '공개성',    color: 'bg-blue-500' },
                { key: 'walkability',    label: '보행성',    color: 'bg-teal-500' },
                { key: 'setback',        label: '전면공간',  color: 'bg-violet-500' },
                { key: 'dwellability',   label: '체류성',    color: 'bg-pink-500' },
                { key: 'facadeOpenness', label: '입면개방성',color: 'bg-amber-500' },
                { key: 'developability', label: '사업성',    color: 'bg-orange-500' },
              ].map(({ key, label, color }) => (
                <div key={key} className="mb-2">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-200 font-mono">{scores[key]}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${color} transition-all duration-300`}
                      style={{ width: `${scores[key]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showMapPanel && (
        <SiteMapPanel
          onApply={handleParcelsApply}
          onClose={() => setShowMapPanel(false)}
        />
      )}
    </div>
  );
}
