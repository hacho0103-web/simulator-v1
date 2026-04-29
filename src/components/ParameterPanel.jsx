import { PARAM_META, RULE_SETS } from '../data/rulesets';

const GROUP_ORDER = ['법정 한도', '이격 / 공지', '일조사선', '저층부 형태', '가로 활성도'];

const GROUP_COLORS = {
  '법정 한도':   'text-[#888880]',
  '이격 / 공지': 'text-[#0d9488]',
  '일조사선':    'text-[#d97706]',
  '저층부 형태': 'text-[#7c3aed]',
  '가로 활성도': 'text-[#ea580c]',
};

export default function ParameterPanel({ params, onParamsChange, activeRuleSet, onRuleSetChange }) {
  const handleSlider = (key, value) => {
    onParamsChange({ ...params, [key]: Number(value) });
  };

  const handlePreset = (ruleSetId) => {
    onRuleSetChange(ruleSetId);
    onParamsChange({ ...RULE_SETS[ruleSetId].params });
  };

  const grouped = GROUP_ORDER.reduce((acc, g) => {
    acc[g] = Object.entries(PARAM_META).filter(([, meta]) => meta.group === g);
    return acc;
  }, {});

  const ruleSet = RULE_SETS[activeRuleSet];

  return (
    <div className="flex flex-col h-full bg-white border-r border-[#d8d8d4]">
      {/* 도시 프리셋 */}
      <div className="p-4 border-b border-[#d8d8d4] bg-[#f6f6f3]">
        <p className="text-[10px] text-[#888880] mb-2.5 uppercase tracking-widest font-semibold">규칙 세트 선택</p>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(RULE_SETS).map((rs) => (
            <button
              key={rs.id}
              onClick={() => handlePreset(rs.id)}
              className={`py-1.5 px-3 text-xs font-medium transition-all border rounded ${
                activeRuleSet === rs.id
                  ? 'text-white border-transparent'
                  : 'bg-white text-[#555550] border-[#d8d8d4] hover:bg-[#f0f0ed]'
              }`}
              style={activeRuleSet === rs.id ? { backgroundColor: rs.color } : {}}
            >
              {rs.name}
            </button>
          ))}
        </div>
        {ruleSet?.notes && (
          <p className="mt-2.5 text-[10px] text-[#d97706] leading-tight">{ruleSet.notes}</p>
        )}
      </div>

      {/* 그룹별 슬라이더 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {GROUP_ORDER.map((groupName) => (
          <div key={groupName}>
            <p className={`text-[10px] font-semibold uppercase tracking-widest mb-3 pb-1.5 border-b border-[#d8d8d4] ${GROUP_COLORS[groupName]}`}>
              {groupName}
            </p>
            <div className="space-y-4">
              {grouped[groupName].map(([key, meta]) => {
                const value = params[key] ?? meta.min;
                const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;
                const accentColor = ruleSet?.color ?? '#2563eb';
                return (
                  <div key={key}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <label className="text-xs text-[#1a1a1a] font-medium">
                        {meta.label}
                      </label>
                      <span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>
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
                      style={{
                        background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${pct}%, #e8e8e5 ${pct}%, #e8e8e5 100%)`,
                      }}
                    />
                    <p className="text-[10px] text-[#888880] mt-0.5 leading-snug">{meta.description}</p>
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
