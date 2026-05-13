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

export default function AnalysisRadar({ params, activeRuleSet, compareMode = false }) {
  const customScores = calculateScores(params);

  const presetScores = {};
  Object.values(RULE_SETS).forEach((rs) => {
    presetScores[rs.id] = calculateScores(rs.params);
  });

  const scoresMap = compareMode
    ? { ...presetScores, custom: customScores }
    : { [activeRuleSet]: presetScores[activeRuleSet] ?? customScores, custom: customScores };

  const data = buildRadarData(scoresMap);

  return (
    <div className="bg-white border border-[#d8d8d4] rounded h-full p-4">
      <h3 className="text-[10px] font-semibold text-[#888880] uppercase tracking-widest mb-0.5">
        6개 분석 축
      </h3>
      <p className="text-[10px] text-[#888880] mb-2 italic">점수: 0–100</p>

      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="#d8d8d4" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: '#555550', fontSize: 10 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#888880', fontSize: 9 }}
            tickCount={4}
          />

          {compareMode ? (
            Object.values(RULE_SETS).map((rs) => (
              <Radar
                key={rs.id}
                name={rs.name}
                dataKey={rs.id}
                stroke={rs.color}
                fill={rs.color}
                fillOpacity={0.08}
                strokeWidth={1.5}
              />
            ))
          ) : (
            <Radar
              name={RULE_SETS[activeRuleSet]?.name ?? '선택 도시'}
              dataKey={activeRuleSet}
              stroke={RULE_SETS[activeRuleSet]?.color ?? '#2563eb'}
              fill={RULE_SETS[activeRuleSet]?.color ?? '#2563eb'}
              fillOpacity={0.12}
              strokeWidth={1.5}
            />
          )}

          <Radar
            name="현재 설정값"
            dataKey="custom"
            stroke="#1a1a1a"
            fill="#1a1a1a"
            fillOpacity={0.04}
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #d8d8d4',
              borderRadius: '3px',
              fontSize: '11px',
              color: '#1a1a1a',
            }}
            labelStyle={{ color: '#555550', fontWeight: 600 }}
            itemStyle={{ color: '#555550' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '10px', color: '#888880' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
