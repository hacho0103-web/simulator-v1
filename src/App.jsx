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
  const [activeDistrict, setActiveDistrict] = useState(null);
  const [showPedestrians, setShowPedestrians] = useState(false);
  const [baselineMode, setBaselineMode] = useState(false);
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [customParcels, setCustomParcels] = useState([]);
  const [architectStyleId, setArchitectStyleId] = useState(null);

  const handleDistrictChange = (districtId) => {
    setActiveDistrict(districtId);
    setCustomParcels([]);
    if (districtId && DISTRICTS[districtId]) {
      const rs = DISTRICTS[districtId].defaultRuleSet;
      setActiveRuleSet(rs);
      setParams({ ...RULE_SETS[rs].params });
      setBaselineMode(true);
    } else {
      setBaselineMode(false);
    }
  };

  const handleParamsChange = (newParams) => {
    setBaselineMode(false);
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

  const btnBase = 'px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer';
  const btnOff  = `${btnBase} bg-white text-[#555550] border-[#d8d8d4] hover:bg-[#f0f0ed]`;
  const btnOn   = `${btnBase} bg-[#1a1a1a] text-white border-[#1a1a1a]`;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-[#d8d8d4] shrink-0">
        <div>
          <h1 className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-widest">저층부 형태 시뮬레이터</h1>
          <p className="text-[11px] text-[#888880] tracking-wide mt-0.5">도시 가이드라인의 형태 생성 규칙화 — 바이브 코딩 프로토타입</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* P / D index 뱃지 */}
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-2 bg-[#f0f0ed] border border-[#d8d8d4] rounded px-3 py-1">
              <span className="text-[10px] text-[#888880] uppercase tracking-widest font-semibold">P</span>
              <span className="text-[#1a1a1a] font-mono font-bold text-sm">{scores.pIndex}</span>
            </div>
            <div className="flex items-center gap-2 bg-[#f0f0ed] border border-[#d8d8d4] rounded px-3 py-1">
              <span className="text-[10px] text-[#888880] uppercase tracking-widest font-semibold">D</span>
              <span className="text-[#1a1a1a] font-mono font-bold text-sm">{scores.dIndex}</span>
            </div>
          </div>

          {/* 내 대지 선택 */}
          <button
            onClick={() => setShowMapPanel(true)}
            className={`rounded ${customParcels.length > 0 ? btnOn : btnOff}`}
          >
            {customParcels.length > 0 ? `✓ 대지 ${customParcels.length}필지` : '내 대지 선택'}
          </button>

          {/* 보행자 */}
          <button
            onClick={() => setShowPedestrians(!showPedestrians)}
            className={`rounded ${showPedestrians ? btnOn : btnOff}`}
          >
            {showPedestrians ? '✓ 보행자 ON' : '보행자'}
          </button>

          {/* 건축가 스타일 */}
          <div className="flex overflow-hidden border border-[#d8d8d4] rounded">
            {[
              { id: null,   label: '기본' },
              { id: 'ando', label: '안도' },
              { id: 'zaha', label: '자하' },
            ].map(({ id, label }, i) => (
              <button
                key={id ?? 'default'}
                onClick={() => setArchitectStyleId(id)}
                title={id ? ARCH_STYLES[id]?.nameEn : '기본 스타일'}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${i > 0 ? 'border-l border-[#d8d8d4]' : ''} ${
                  architectStyleId === id
                    ? 'bg-[#1a1a1a] text-white'
                    : 'bg-white text-[#555550] hover:bg-[#f0f0ed]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 구역 선택 */}
          <div className="flex overflow-hidden border border-[#d8d8d4] rounded">
            {[
              { id: null,          label: '단일 건물' },
              { id: 'gwanghwamun', label: '광화문' },
            ].map(({ id, label }, i) => (
              <button
                key={id ?? 'simple'}
                onClick={() => handleDistrictChange(id)}
                className={`px-3 py-1.5 text-xs font-medium transition-all ${i > 0 ? 'border-l border-[#d8d8d4]' : ''} ${
                  activeDistrict === id
                    ? 'bg-[#1a1a1a] text-white'
                    : 'bg-white text-[#555550] hover:bg-[#f0f0ed]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 비교 모드 */}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`rounded ${compareMode ? btnOn : btnOff}`}
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
          <div className="h-80 shrink-0 flex gap-3 p-3 bg-[#f6f6f3] border-t border-[#d8d8d4]">
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

            {/* 점수 요약 */}
            <div className="w-48 shrink-0 bg-white border border-[#d8d8d4] rounded p-4">
              <h3 className="text-[10px] font-semibold text-[#888880] uppercase tracking-widest mb-3 pb-2 border-b border-[#d8d8d4]">
                점수 요약
              </h3>
              {[
                { key: 'publicness',     label: '공개성',    color: '#2563eb' },
                { key: 'walkability',    label: '보행성',    color: '#0d9488' },
                { key: 'setback',        label: '전면공간',  color: '#7c3aed' },
                { key: 'dwellability',   label: '체류성',    color: '#db2777' },
                { key: 'facadeOpenness', label: '입면개방성',color: '#d97706' },
                { key: 'developability', label: '사업성',    color: '#ea580c' },
              ].map(({ key, label, color }) => (
                <div key={key} className="mb-2.5">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-[11px] text-[#888880]">{label}</span>
                    <span className="text-[11px] font-mono font-semibold text-[#1a1a1a]">{scores[key]}</span>
                  </div>
                  <div className="h-1 bg-[#e8e8e5] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${scores[key]}%`, backgroundColor: color }}
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
