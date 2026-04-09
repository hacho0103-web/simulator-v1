import { useState } from 'react';

const DEFAULT_PROMPT =
  'photorealistic architectural exterior render, mixed-use building with active ground floor retail, glass facade, canopy, pedestrians, street trees, urban daytime scene, perspective view';

export default function GeminiRender() {
  const [step, setStep] = useState('idle'); // idle | prompt | result
  const [userPrompt, setUserPrompt] = useState(DEFAULT_PROMPT);
  const [imageUrl, setImageUrl] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [error, setError] = useState(null);

  const handleOpenPrompt = () => {
    setStep('prompt');
    setError(null);
  };

  const handleRender = () => {
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(userPrompt)}?width=1280&height=720&nologo=true&seed=${Date.now()}`;
    setImageUrl(url);
    setImgLoaded(false);
    setError(null);
    setStep('result');
  };

  const handleClose = () => {
    setStep('idle');
    setImageUrl(null);
    setImgLoaded(false);
    setError(null);
  };

  return (
    <>
      <button
        onClick={handleOpenPrompt}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded text-xs text-white transition-colors"
      >
        ✨ AI 렌더
      </button>

      {step !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75" onClick={handleClose}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-2xl w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold text-sm">✨ AI 렌더링</h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            {/* 프롬프트 입력 */}
            {step === 'prompt' && (
              <>
                <p className="text-slate-400 text-xs mb-2">렌더링할 장면을 영어로 설명해주세요.</p>
                <textarea
                  value={userPrompt}
                  onChange={e => setUserPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-sm text-white resize-none focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={handleRender}
                  disabled={!userPrompt.trim()}
                  className="mt-3 w-full py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded text-white text-sm transition-colors"
                >
                  렌더링 시작
                </button>
              </>
            )}

            {/* 결과 */}
            {step === 'result' && (
              <>
                {/* 로딩 중일 때 */}
                {!imgLoaded && !error && (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <span className="text-3xl animate-spin inline-block">⟳</span>
                    <p className="text-slate-300 text-sm">이미지 생성 중... (20~40초 소요)</p>
                  </div>
                )}

                {/* 이미지 (로드 완료 후 표시) */}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="렌더링 결과"
                    className={`w-full rounded-lg ${imgLoaded ? 'block' : 'hidden'}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setError('이미지 로드 실패. 다시 시도해주세요.')}
                  />
                )}

                {/* 에러 */}
                {error && (
                  <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{error}</p>
                )}

                {/* 저장 버튼 */}
                {imgLoaded && (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 flex items-center justify-center px-4 py-2 bg-violet-700 hover:bg-violet-600 rounded text-white text-sm transition-colors"
                  >
                    이미지 저장
                  </a>
                )}

                <button
                  onClick={() => { setStep('prompt'); setImgLoaded(false); setError(null); }}
                  className="mt-2 w-full py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm transition-colors"
                >
                  다시 시도
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
