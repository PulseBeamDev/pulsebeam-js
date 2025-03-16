import { useState, useEffect, useRef } from 'react'
import { toSvg } from "html-to-image";
import { Stats, usePeerStore } from './peer';

const DEFAULT_CODE = `<div id="user-shape"></div>
<style>
    #user-shape {
      width: 100px;
      height: 100px;
      background: #dd6b4d;    
    }
</style>`

const WIDTH = 400;
const HEIGHT = 300;

export function Battle() {
  const peer = usePeerStore();
  const [userCode, setUserCode] = useState(DEFAULT_CODE);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [charCount, setCharCount] = useState(userCode.length);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const updateScore = async () => {
    // Update character count
    setCharCount(userCode.length);
    
    // Calculate match percentage (simplified version)
    const userCss = userCode.toLowerCase();
    let score = 0;

    if (userCss.includes('width: 100px') || userCss.includes('width:100px')) score += 25;
    if (userCss.includes('height: 100px') || userCss.includes('height:100px')) score += 25;
    if (userCss.includes('border-radius: 50') || userCss.includes('border-radius:50')) score += 25;
    if (userCss.includes('#fd4c56') || userCss.includes('var(--accent)')) score += 25;
    
    setMatchPercentage(score);

    // Send updates
    peer.broadcastStats({
      charCount: userCode.length,
      matchPercentage: score
    });
  };

  async function updateCanvas(){
    if (!exportRef.current) return;
    if (!canvasRef.current) return;
    await drawCanvas(canvasRef.current, exportRef.current)
  }

  useEffect(()=>{
    updateScore()
    updateCanvas()
  }, [userCode])

  useEffect(()=>{
    if (!canvasRef.current) return;
    console.log("Setting Local Stream to canvas")
    peer.setLocalStream(canvasRef.current.captureStream())
  }, [canvasRef.current])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">CSS Battle Clone</div>
      </header>
      
      <main>
        <section className="editor-section">
          <h2>Editor</h2>
          <textarea 
            className="editor" 
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            placeholder="Write your CSS here..."
          />
        </section>
        
        <section className="target-section">
          <h2 className="target-title">Target #1: Simple Circle</h2>
          <div className="target-container">
            <div className="target-header">Target Design</div>
            <div className="target-display">
              <div className="target-frame">
                <div className="target-design"></div>
              </div>
            </div>
          </div>

          <div className="target-container" style={{ marginTop: '1rem' }}>
            <div className="target-header">Your Result</div>
            <div className="target-display">
              <div 
                ref={exportRef}
                className="result-frame" 
                dangerouslySetInnerHTML={{ __html: userCode }}
              />
            </div>
          </div>
          
          {/* For debugging, nice to see the local canvas 
            * Becuase it becomes the local stream */}
          <div className="target-container" style={{ marginTop: '1rem' }}>
            <div className="target-header">Canvas</div>
            <div className="target-display">
              <div >
                <canvas ref={canvasRef} width={WIDTH} height={HEIGHT}></canvas>
              </div>
            </div>
          </div>
          <RenderStats {...{matchPercentage: matchPercentage, charCount: charCount}} />
        </section>
      </main>
            <nav className="footer">
        <button
          style={{background:"white", color: "black"}}
          data-testid="btn-endBattle"
          onClick={() => peer.stop()}
        >
          End Battle
        </button>

        <a
          target="_blank"
          className="button secondary-container secondary-text small-round"
          href="https://github.com/PulseBeamDev/pulsebeam-js/tree/main/multiplayer-games/cssbattles-demo"
        >
          Source Code
        </a>
      </nav>
    </div>
  );
}

export function RenderStats(stats: Stats){
return <div className="stats">
    <div className="stats-row">
      <span>Match Percentage:</span>
      <span 
        className="match-percentage"
        style={{ 
          color: stats.matchPercentage >= 90 ? 'var(--success)' : 
                  stats.matchPercentage >= 50 ? '#ffc107' : 
                  'var(--accent)' 
        }}
      >
        {stats.matchPercentage}%
      </span>
    </div>
    <div className="stats-row">
      <span>Characters:</span>
      <span className="char-count">{stats.charCount}</span>
    </div>
  </div>
}

// From https://github.com/bubkoo/html-to-image/blob/master/src/util.ts
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      img.decode().then(() => {
        requestAnimationFrame(() => resolve(img))
      })
    }
    img.onerror = reject
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
  })
}

// Adapted from https://github.com/bubkoo/html-to-image/blob/master/src/index.ts
async function drawCanvas<T extends HTMLElement>(
  canvas: HTMLCanvasElement,
  node: T,
): Promise<HTMLCanvasElement> {
  const svg = await toSvg(node)
  const img = await createImage(svg)

  const context = canvas.getContext('2d')!

  canvas.width = WIDTH
  canvas.height = HEIGHT

  canvas.style.width = `${WIDTH}`
  canvas.style.height = `${HEIGHT}`

  context.drawImage(img, 0, 0, canvas.width, canvas.height)

  return canvas
}