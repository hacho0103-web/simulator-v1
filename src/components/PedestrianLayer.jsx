/**
 * PedestrianLayer — 보행자 시뮬레이션
 *
 * 파라미터 연동:
 *   publicness   → 보행자 수  (3 ~ 40명)
 *   walkability  → 이동 속도  (0.8 ~ 2.5 m/s)
 *   dwellability → 정지 확률 + 정지 시간
 *   facadeOpenness → 건물 입면 쪽으로 몰리는 경향
 */
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { calculateScores } from '../utils/scoring';

const MAX_AGENTS = 50;

function rnd(min, max) {
  return min + Math.random() * (max - min);
}

function getZone(mass, lot) {
  const hw = lot.width / 2;
  const hd = lot.depth / 2;
  // 건물 전면부터 대지 전면(+가로) 까지가 보행 구역
  const zMin = hd - mass.openSpaceDepth - mass.frontSetback;
  return {
    xMin: -hw + 0.8,
    xMax:  hw - 0.8,
    zMin,          // 건물 전면
    zMax:  hd + 4, // 대지 경계 + 가로 4m
  };
}

export default function PedestrianLayer({ params, mass, lot }) {
  const meshRef = useRef();
  const dummy  = useMemo(() => new THREE.Object3D(), []);

  // useFrame 안에서 최신값을 참조하기 위한 ref
  const scoresRef = useRef(calculateScores(params));
  const massRef   = useRef(mass);
  const lotRef    = useRef(lot);

  useEffect(() => { scoresRef.current = calculateScores(params); }, [params]);
  useEffect(() => { massRef.current = mass; }, [mass]);
  useEffect(() => { lotRef.current  = lot;  }, [lot]);

  // 에이전트 상태 — 렌더링 외부에서 관리
  const agents = useRef(null);
  if (!agents.current) {
    const zone = getZone(mass, lot);
    agents.current = Array.from({ length: MAX_AGENTS }, () => ({
      pos:        new THREE.Vector3(rnd(zone.xMin, zone.xMax), 0, rnd(zone.zMin, zone.zMax)),
      target:     new THREE.Vector3(rnd(zone.xMin, zone.xMax), 0, rnd(zone.zMin, zone.zMax)),
      pauseTimer: rnd(0, 3),
      speedMul:   rnd(0.7, 1.3),  // 개인별 속도 편차
      facing:     rnd(0, Math.PI * 2),
    }));
  }

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    const scores = scoresRef.current;
    const m      = massRef.current;
    const l      = lotRef.current;
    const zone   = getZone(m, l);

    const activeCount  = Math.max(3, Math.round(3 + (scores.publicness / 100) * 37));
    const baseSpeed    = 0.8 + (scores.walkability / 100) * 1.7;
    const pauseProb    = 0.05 + (scores.dwellability / 100) * 0.50;
    const maxPauseDur  = 1.0  + scores.dwellability / 20;
    // 높은 입면개방성 → 보행자가 입면(건물 앞) 쪽으로 더 자주 이동
    const facadeProb   = (scores.facadeOpenness / 100) * 0.45;

    for (let i = 0; i < MAX_AGENTS; i++) {
      const a = agents.current[i];

      if (i >= activeCount) {
        dummy.position.set(0, -100, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // 구역 밖으로 나갔을 때 클램핑
      a.pos.x = Math.max(zone.xMin, Math.min(zone.xMax, a.pos.x));
      a.pos.z = Math.max(zone.zMin, Math.min(zone.zMax, a.pos.z));

      if (a.pauseTimer > 0) {
        // 정지 중 — 제자리에서 서있음
        a.pauseTimer -= delta;
      } else {
        const dx   = a.target.x - a.pos.x;
        const dz   = a.target.z - a.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 0.4) {
          // 목적지 도달 → 다음 목적지 설정 or 잠시 정지
          if (Math.random() < pauseProb) {
            a.pauseTimer = rnd(0.5, maxPauseDur);
          }
          const usesFacade = Math.random() < facadeProb;
          const nextZ = usesFacade
            ? rnd(zone.zMin, zone.zMin + (zone.zMax - zone.zMin) * 0.35)  // 건물 앞쪽
            : rnd(zone.zMin, zone.zMax);
          a.target.set(rnd(zone.xMin, zone.xMax), 0, nextZ);
        } else {
          // 이동
          const spd = baseSpeed * a.speedMul * delta;
          a.pos.x += (dx / dist) * Math.min(spd, dist);
          a.pos.z += (dz / dist) * Math.min(spd, dist);
          a.facing = Math.atan2(dx, dz); // 이동 방향으로 회전
        }
      }

      dummy.position.set(a.pos.x, 0.85, a.pos.z);
      dummy.rotation.set(0, a.facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, MAX_AGENTS]} castShadow>
      {/* radius=0.2, length=1.3 → 총 키 1.7m */}
      <capsuleGeometry args={[0.2, 1.3, 4, 8]} />
      <meshStandardMaterial color="#FCD34D" roughness={0.6} />
    </instancedMesh>
  );
}
