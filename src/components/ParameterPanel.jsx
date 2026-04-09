import { PARAM_META, RULE_SETS } from '../data/rulesets';

const GROUP_ORDER = ['법적 규제', '전면공간', '저층부 형태', '가로 활성도'];

const GROUP_COLORS = {
  '법적 규제': 'text-slate-400',
  '전면공간': 'text-teal-400',
  '저층부 형태': 'text-violet-400',
  '가로 활성도': 'text-amber-400',
};

export default function ParameterPanel({ params, onParamsChange, activeRuleSet, onRuleSetChange }) {
  const handleSlider = (key, value) => {
    onParamsChange({ ...params, [key]: Number(value) });
  };

  const handlePreset = (ruleSetId) => {
    onRuleSetChange(ruleSetId);
    onParamsChange({ ...RULE_SETS[ruleSetId].params });
  };

  // PARAM_META를 그룹별로 분류
  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = Object.entries(PARAM_META).filter(([, meta]) => meta.group === g);
    return acc;
  }, {});

  const ruleSet = RULE_SETS[activeRuleSet];

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-700">
      {/* 도시 프리셋 선택 */}
      <div className="p-4 border-b border-slate-700">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">규칙 세트 선택</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.values(RULE_SETS).map((rs) => (
            <button
              key={rs.id}
              onClick={() => handlePreset(rs.id)}
              className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                activeRuleSet === rs.id
                  ? 'text-white shadow-lg scale-[1.02]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              style={activeRuleSet === rs.id ? { backgroundColor: rs.color } : {}}
            >
              {rs.name}
            </button>
          ))}
        </div>
        {ruleSet?.notes && (
          <p className="mt-2 text-xs text-amber-400 leading-tight">{ruleSet.notes}</p>
        )}
      </div>

      {/* 그룹별 파라미터 슬라이더 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {GROUP_ORDER.map((groupName) => (
          <div key={groupName}>
            {/* 그룹 헤더 */}
            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 pb-1 border-b border-slate-700 ${GROUP_COLORS[groupName]}`}>
              {groupName}
            </p>

            <div className="space-y-4">
              {grouped[groupName].map(([key, meta]) => {
                const value = params[key] ?? meta.min;
                const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;
                return (
                  <div key={key}>
                    <div className="flex justify-between items-baseline mb-1">
                      <label className="text-sm text-slate-200 font-medium">
                        {meta.label}
                      </label>
                      <span className="text-sm font-mono text-cyan-400">
                        {value}{meta.unit}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={meta.min}
                      max={meta.max}
                      step={meta.step}
                      value={value}
                      onChange={(e) => handleSlider(key, e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${ruleSet?.color ?? '#3B82F6'} 0%, ${ruleSet?.color ?? '#3B82F6'} ${pct}%, #334155 ${pct}%, #334155 100%)`,
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
