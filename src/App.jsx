import { useState, useRef } from 'react';
import ParameterPanel from './components/ParameterPanel';
import BuildingMass from './components/BuildingMass';
import ExportButtons from './components/ExportButtons';
import GeminiRender from './components/GeminiRender';
import FacadeProposalPanel, { FACADE_PROPOSALS } from './components/FacadeProposalPanel';
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
  const [facadePreset, setFacadePreset] = useState(null);
  const [selectedProposalId, setSelectedProposalId] = useState(null);

  const handleDistrictChange = (districtId) => {
    setActiveDistrict(districtId);
    setCustomParcels([]);
    if (districtId !== null) setFacadePreset(null); // 지구 모드에서는 프리셋 해제
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
  const handleProposalSelect = (proposal) => {
    setSelectedProposalId(proposal.id);
    setArchitectStyleId(proposal.architectStyleId);
    setFacadePreset(proposal.facadePreset);
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

          {/* 파사드 프리셋 — 단일 건물 모드에서만 표시 */}
          {activeDistrict === null && (
            <button
              onClick={() => setFacadePreset(p => p === 'hafencity' ? null : 'hafencity')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                facadePreset === 'hafencity'
                  ? 'bg-red-800 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="하펜시티 붉은 벽돌 + 수직 창 파사드 적용"
            >
              {facadePreset === 'hafencity' ? '✓ 하펜시티 파사드' : '하펜시티 파사드'}
            </button>
          )}

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
              { id: 'yongsan',      label: '용산정비창' },
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

          <GeminiRender canvasRef={canvasRef} />
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

        {/* 오른쪽: 3D 뷰어 + 파사드 제안 */}
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
              facadePreset={facadePreset}
            />
          </div>

          {/* 파사드 제안 패널 */}
          <FacadeProposalPanel
            params={params}
            activeRuleSet={activeRuleSet}
            selectedId={selectedProposalId}
            onSelect={handleProposalSelect}
          />
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
