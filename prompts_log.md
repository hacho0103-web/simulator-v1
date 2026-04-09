# 바이브 코딩 프롬프트 기록
## 저층부 형태 시뮬레이션 프로그램 개발 일지

논문 5장 1차 자료 — 모든 Claude 프롬프트와 결과를 기록한다.

---

## 형식

```
## YYYY-MM-DD

**작업 목표:**
> 이 세션에서 달성하려는 것

**프롬프트:**
> Claude에게 준 자연어 지시 (그대로 복사)

**결과:** 성공 / 부분 성공 / 실패

**수정 횟수:** N회

**수정 내용:**
- 1차 시도: ...
- 2차 시도: ...

**최종 코드 파일:** src/components/XXX.jsx

**메모:**
연구적으로 주목할 점 (AI의 한계, 예상치 못한 동작 등)
```

---

## 2026-04-03 | 세션 1

**작업 목표:**
> 프로젝트 초기 구조 구축 (Phase 0~1)

**프롬프트 1:**
> React + Vite로 새 프로젝트를 만들어줘. 이름은 ground-floor-simulator야.
> Three.js, @react-three/fiber, @react-three/drei, recharts, tailwindcss를 설치하고,
> 앱을 실행하면 "저층부 시뮬레이터" 텍스트가 화면에 뜨도록 해줘.

**결과:** 성공

**수정 횟수:** 0회

**최종 코드 파일:**
- vite.config.js (Tailwind v4 플러그인 설정)
- src/index.css (Tailwind import)

---

**프롬프트 2:**
> 서울·도쿄 마루노우치·하펜시티 세 도시의 저층부 가이드라인 파라미터를
> src/data/rulesets.js에 JSON 형태로 정의해줘.
> 파라미터는 논문의 P = {건폐율, 용적률, 높이제한, 전면후퇴, 측면후퇴,
> 공개공지비율, 보행통로폭, 입면투명도, 상업연속성, 저층부층고} 10개야.
> 각 파라미터에 min/max/step/설명도 포함해줘.

**결과:** 성공

**수정 횟수:** 0회

**최종 코드 파일:** src/data/rulesets.js

**메모:**
⚠️ 수치는 사례 조사 완료 후 업데이트 필요.
현재 서울 값은 일반상업지역 법정 기준 추정치이며,
도쿄·하펜시티는 문헌 기반 추정치. 3장 사례 분석 완료 후 수정할 것.

---

**프롬프트 3:**
> 파라미터 슬라이더 UI 컴포넌트(ParameterPanel)와
> 6개 분석 축 점수 계산 함수(scoring.js)를 만들어줘.
> [상세 로직 포함]

**결과:** 성공

**수정 횟수:** 0회

**최종 코드 파일:**
- src/components/ParameterPanel.jsx
- src/utils/scoring.js

---

**프롬프트 4:**
> @react-three/fiber로 파라미터 값에 따라 자동으로 3D 건물 매스를 생성하는
> BuildingMass 컴포넌트를 만들어줘. [계산 로직 포함]

**결과:** 성공

**수정 횟수:** 0회

**최종 코드 파일:** src/components/BuildingMass.jsx

---

**프롬프트 5:**
> recharts로 레이더 차트(AnalysisRadar), 산점도(ScatterPlot), 내보내기(ExportButtons),
> 전체 레이아웃(App.jsx)을 만들어줘.

**결과:** 성공

**수정 횟수:** 0회

**최종 코드 파일:**
- src/components/AnalysisRadar.jsx
- src/components/ScatterPlot.jsx
- src/components/ExportButtons.jsx
- src/App.jsx

---

<!-- 이후 세션은 아래에 추가 -->
