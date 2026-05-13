import { calculateScores } from '../utils/scoring';
import { calculateMass } from '../utils/scoring';
import { RULE_SETS, DEFAULT_LOT, PARAM_META } from '../data/rulesets';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';

export function exportScreenshot(canvasRef, cityName) {
  const canvas = canvasRef?.current?.querySelector('canvas');
  if (!canvas) { alert('3D 뷰어를 찾을 수 없습니다.'); return; }
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const now = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  link.download = `simulator_${cityName}_${now}.png`;
  link.href = dataUrl;
  link.click();
}

export function exportCSV(currentParams, activeRuleSet) {
  const allSets = {
    ...Object.fromEntries(Object.entries(RULE_SETS).map(([id, rs]) => [id, rs.params])),
    custom: currentParams,
  };
  const labels = {
    ...Object.fromEntries(Object.entries(RULE_SETS).map(([id, rs]) => [id, rs.name])),
    custom: '현재 설정값',
  };

  const paramRows = Object.entries(PARAM_META).map(([key, meta]) => {
    const vals = Object.entries(allSets).map(([id, p]) => p[key] ?? '').join(',');
    return `${meta.label} (${meta.unit}),${vals}`;
  });

  const scoreRows = ['publicness', 'walkability', 'setback', 'dwellability', 'facadeOpenness', 'developability', 'pIndex', 'dIndex']
    .map((sk) => {
      const sLabel = {
        publicness: '공개성', walkability: '보행성', setback: '전면공간',
        dwellability: '체류성', facadeOpenness: '입면개방성', developability: '사업성',
        pIndex: 'P-index', dIndex: 'D-index',
      }[sk];
      const vals = Object.entries(allSets).map(([id, p]) => calculateScores(p)[sk]).join(',');
      return `[점수] ${sLabel},${vals}`;
    });

  const header = `항목,${Object.values(labels).join(',')}`;
  const csv = [header, ...paramRows, ...scoreRows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const now = new Date().toISOString().slice(0, 10);
  link.download = `ground_floor_params_${now}.csv`;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function exportOBJ(sceneRef, cityName) {
  const scene = sceneRef?.current;
  if (!scene) { alert('3D 씬을 찾을 수 없습니다. 잠시 후 다시 시도해주세요.'); return; }
  const exporter = new OBJExporter();
  const obj = exporter.parse(scene);
  const blob = new Blob([obj], { type: 'text/plain' });
  const link = document.createElement('a');
  const now = new Date().toISOString().slice(0, 16).replace('T', '_').replace(/:/g, '');
  link.download = `ground_floor_${cityName}_${now}.obj`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

const btnBase = 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer rounded';

export default function ExportButtons({ canvasRef, sceneRef, params, activeRuleSet }) {
  const cityName = RULE_SETS[activeRuleSet]?.nameEn ?? 'custom';

  return (
    <div className="flex gap-1.5">
      <button
        onClick={() => exportScreenshot(canvasRef, cityName)}
        className={`${btnBase} bg-white text-[#555550] border-[#d8d8d4] hover:bg-[#f0f0ed]`}
      >
        PNG
      </button>
      <button
        onClick={() => exportCSV(params, activeRuleSet)}
        className={`${btnBase} bg-white text-[#555550] border-[#d8d8d4] hover:bg-[#f0f0ed]`}
      >
        CSV
      </button>
      <button
        onClick={() => exportOBJ(sceneRef, cityName)}
        className={`${btnBase} bg-[#1a1a1a] text-white border-[#1a1a1a] hover:bg-[#333]`}
      >
        OBJ
      </button>
    </div>
  );
}
