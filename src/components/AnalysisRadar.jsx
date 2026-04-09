import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend, ResponsiveContainer, Tooltip,
} from 'recharts';
import { calculateScores } from '../utils/scoring';
import { RULE_SETS } from '../data/rulesets';

const AXES = [
  { key: 'publicness',    label: '공개성' },
  { key: 'walkability',   label: '보행성' },
  { key: 'setback',       label: '전면공간' },
  { key: 'dwellability',  label: '체류성' },
  { key: 'facadeOpenness',label: '입면개방성' },
  { key: 'developability',label: '사업성' },
];

function buildRadarData(scoresMap) {
  return AXES.map(({ key, label }) => {
    const entry = { axis: label };
    Object.entries(scoresMap).forEach(([id, scores]) => {
      entry[id] = scores[key];
    });
    return entry;
  });
}

/**
 * 6개 분석 축 레이더 차트
 * @param {{ params: object, activeRuleSet: string, compareMode: boolean }}
 */
export default function AnalysisRadar({ params, activeRuleSet, compareMode = false }) {
  // 현재 커스텀 파라미터 점수
  const customScores = calculateScores(params);

  // 3개 도시 프리셋 점수
  const presetScores = {};
  Object.values(RULE_SETS).forEach((rs) => {
    presetScores[rs.id] = calculateScores(rs.params);
  });

  const scoresMap = compareMode
    ? { ...presetScores, custom: customScores }
    : { [activeRuleSet]: presetScores[activeRuleSet] ?? customScores, custom: customScores };

  const data = buildRadarData(scoresMap);

  return (
    <div className="bg-slate-900 rounded-xl p-4 h-full">
      <h3 className="text-sm font-semibold text-slate-300 mb-1">
        6개 분석 축 레이더 차트
      </h3>
      <p className="text-xs text-slate-500 mb-3">점수: 0~100 (높을수록 해당 특성 강함)</p>

      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#94A3B8', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#475569', fontSize: 9 }}
            tickCount={4}
          />

          {compareMode ? (
            // 비교 모드: 4개 규칙 세트 + 커스텀
            Object.values(RULE_SETS).map((rs) => (
              <Radar
                key={rs.id}
                name={rs.name}
                dataKey={rs.id}
                stroke={rs.color}
                fill={rs.color}
                fillOpacity={0.08}
                strokeWidth={2}
              />
            ))
          ) : (
            // 단일 모드: 선택 도시
            <Radar
              name={RULE_SETS[activeRuleSet]?.name ?? '선택 도시'}
              dataKey={activeRuleSet}
              stroke={RULE_SETS[activeRuleSet]?.color ?? '#3B82F6'}
              fill={RULE_SETS[activeRuleSet]?.color ?? '#3B82F6'}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          )}

          {/* 커스텀 (슬라이더 조정값) - 점선 */}
          <Radar
            name="현재 설정값"
            dataKey="custom"
            stroke="#F59E0B"
            fill="#F59E0B"
            fillOpacity={0.05}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />

          <Tooltip
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            labelStyle={{ color: '#94A3B8' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
