import { useState, useEffect, useRef } from 'react'
import { toSvg } from "html-to-image";
import { usePeerStore } from './peer';

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
  const [charCount, setCharCount] = useState(0);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Set initial character count
    setCharCount(userCode.length);
  }, []);

  const handleSubmit = async () => {
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
  };

  async function updateCanvas(){
    if (!exportRef.current) return;
    if (!canvasRef.current) return;
    await drawCanvas(canvasRef.current, exportRef.current)
  }

  useEffect(()=>{
    handleSubmit()
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

          <div className="stats">
            <div className="stats-row">
              <span>Match Percentage:</span>
              <span 
                className="match-percentage"
                style={{ 
                  color: matchPercentage >= 90 ? 'var(--success)' : 
                         matchPercentage >= 50 ? '#ffc107' : 
                         'var(--accent)' 
                }}
              >
                {matchPercentage}%
              </span>
            </div>
            <div className="stats-row">
              <span>Characters:</span>
              <span className="char-count">{charCount}</span>
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
