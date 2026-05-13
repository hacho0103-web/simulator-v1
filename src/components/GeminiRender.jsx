import { useState } from 'react';

const DEFAULT_PROMPT =
  'Transform this 3D architectural mass model into a photorealistic exterior architectural render. ' +
  'Preserve the exact building form, facade rhythm, and proportions. ' +
  'Apply photorealistic red brick texture, reflective glass windows with steel frames, natural sunlight with crisp shadows. ' +
  'Urban street scene: paving stones, street trees, a few pedestrians. Overcast-blue sky. ' +
  'High-end architectural visualization, ultra-detailed.';

const MODEL = 'google/gemini-3.1-flash-image-preview';

function captureCanvas(canvasRef) {
  const canvas = canvasRef?.current?.querySelector('canvas');
  if (!canvas) throw new Error('3D 뷰어 캔버스를 찾을 수 없습니다');
  const dataUrl = canvas.toDataURL('image/png');
  return dataUrl.split(',')[1]; // base64만
}

async function callOpenRouter(apiKey, prompt, base64Image) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': '저층부 형태 시뮬레이터',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `API 오류 ${res.status}`);
  }

  const data = await res.json();

  // Gemini Flash Image: content is array of parts
  const parts = data.choices?.[0]?.message?.content;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part.type === 'image_url') return part.image_url.url;
      if (part.image_url?.url) return part.image_url.url;
      // inline base64
      if (part.type === 'image' && part.source?.data)
        return `data:image/png;base64,${part.source.data}`;
    }
  }

  // FLUX / OpenAI images format
  if (data.data?.[0]?.url) return data.data[0].url;
  if (data.data?.[0]?.b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;

  throw new Error('응답에서 이미지를 찾지 못했습니다');
}

export default function GeminiRender({ canvasRef }) {
  const envKey = import.meta.env.VITE_OPENROUTER_KEY ?? '';
  const [step, setStep] = useState('idle'); // idle | prompt | loading | result
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [apiKey, setApiKey] = useState(envKey);
  const [imageUrl, setImageUrl] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [error, setError] = useState(null);

  const handleOpen = () => { setStep('prompt'); setError(null); };
  const handleClose = () => { setStep('idle'); setImageUrl(null); setImgLoaded(false); setError(null); };

  const handleRender = async () => {
    if (!apiKey.trim()) { setError('OpenRouter API 키를 입력해주세요'); return; }
    setStep('loading');
    setError(null);
    try {
      const b64 = captureCanvas(canvasRef);
      const url = await callOpenRouter(apiKey.trim(), prompt, b64);
      setImageUrl(url);
      setStep('result');
    } catch (e) {
      setError(e.message);
      setStep('prompt');
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded text-xs text-white font-medium transition-colors"
      >
        AI 렌더
      </button>

      {step !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={handleClose}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl p-5 w-full mx-4 shadow-2xl"
            style={{ maxWidth: step === 'result' ? 860 : 540 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-white font-semibold text-sm">AI 렌더링 — Gemini Flash Image</h2>
              <button onClick={handleClose} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>

            {step === 'prompt' && (
              <>
                {!envKey && (
                  <div className="mb-3">
                    <label className="text-slate-400 text-xs block mb-1">OpenRouter API Key</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-sm text-white font-mono focus:outline-none focus:border-violet-500"
                    />
                    <p className="text-slate-500 text-xs mt-1">
                      또는 프로젝트 루트에{' '}
                      <code className="text-violet-400">VITE_OPENROUTER_KEY=sk-or-...</code>
                      {' '}를 .env 파일에 저장하면 자동 로드됩니다.
                    </p>
                  </div>
                )}

                <label className="text-slate-400 text-xs block mb-1">렌더링 프롬프트</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  rows={5}
                  className="w-full bg-slate-800 border border-slate-600 rounded p-3 text-xs text-white resize-none focus:outline-none focus:border-violet-500 leading-relaxed"
                />
                <p className="text-slate-500 text-xs mt-1 mb-3">
                  현재 3D 뷰어 화면을 캡처해 이미지로 함께 전송합니다.
                </p>

                {error && (
                  <p className="text-red-400 text-xs mb-3 bg-red-900/20 border border-red-800 rounded p-2">{error}</p>
                )}

                <button
                  onClick={handleRender}
                  disabled={!prompt.trim() || !apiKey.trim()}
                  className="w-full py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded text-white text-sm font-medium transition-colors"
                >
                  렌더링 시작
                </button>
              </>
            )}

            {step === 'loading' && (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="w-9 h-9 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-300 text-sm">이미지 생성 중… (30~60초)</p>
                <p className="text-slate-500 text-xs">3D 뷰어 캡처 → Gemini Flash Image 처리 중</p>
              </div>
            )}

            {step === 'result' && (
              <>
                {!imgLoaded && (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="AI 렌더링 결과"
                    className={`w-full rounded-lg ${imgLoaded ? 'block' : 'hidden'}`}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => { setError('이미지 로드 실패'); setStep('prompt'); }}
                  />
                )}
                {imgLoaded && (
                  <div className="flex gap-2 mt-3">
                    <a
                      href={imageUrl}
                      download="ai_render.png"
                      className="flex-1 flex items-center justify-center py-2 bg-violet-700 hover:bg-violet-600 rounded text-white text-sm font-medium"
                    >
                      PNG 저장
                    </a>
                    <button
                      onClick={() => { setStep('prompt'); setImgLoaded(false); setError(null); setImageUrl(null); }}
                      className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 text-sm"
                    >
                      다시 시도
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
