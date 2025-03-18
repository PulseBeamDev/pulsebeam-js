import { useState, useEffect, useRef } from 'react'
import { toSvg } from "html-to-image";
import { Stats, usePeerStore } from './peer';

const DEFAULT_CODE = `<div id="user-shape"></div>
<style>
    #user-shape {
      width: 20px;
      height: 20px;
      background: #dd6b4d;    
    }
</style>`

export const WIDTH = 400;
export const HEIGHT = 300;

export function Battle(props: {canvasRef: React.RefObject<HTMLCanvasElement | null>}) {
  const peer = usePeerStore();
  const remoteStreams = Object.entries(peer.sessions);
  const [userCode, setUserCode] = useState(DEFAULT_CODE);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [charCount, setCharCount] = useState(userCode.length);
  const exportRef = useRef<HTMLDivElement | null>(null);

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
    if (!props.canvasRef.current) return;
    await drawCanvas(props.canvasRef.current, exportRef.current)
  }

  // issue with renderer not rendering on connection
  setInterval(()=>{
    updateCanvas()
  }, 1000)

  useEffect(()=>{
    updateScore()
    updateCanvas()
  }, [userCode])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">CSS Battle Clone</div>
        <button
          style={{background:"white", color: "black"}}
          data-testid="btn-endBattle"
          onClick={() => peer.disconnect()}
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
          <h2 className="target-title">Your Result{remoteStreams.length>1 && 's'}</h2>
          <div className="target-container" style={{ marginTop: '1rem' }}>
            <div className="target-header">Design</div>
            <div className="target-display">
              <div 
                ref={exportRef}
                className="result-frame" 
                dangerouslySetInnerHTML={{ __html: userCode }}
              />
            </div>
          </div>
          <RenderStats matchPercentage={matchPercentage} charCount={charCount} />

          <h2 className="target-title">Remote Player{remoteStreams.length>1 && 's'}</h2>
          {remoteStreams.map(([_, s]) => (
            <PlayerContainer
              key={s.key}
              className="no-padding"
              title={s.sess.other.peerId}
              stream={s.remoteStream}
              loading={s.loading}
              stats={s.remoteStats}
            />
          ))}
        </section>

        <section>
          <h2 className="target-title">Target #1: Simple Circle</h2>
          <div className="target-container">
            <div className="target-header">Target Design</div>
            <div className="target-display">
              <div className="target-frame">
                <div className="target-design"></div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

interface PlayerContainerProps {
  title: string;
  stream: MediaStream | null;
  loading: boolean;
  className: string;
  stats: Stats | null;
}

function PlayerContainer(props: PlayerContainerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.stream;
    }
  }, [props.stream]);

  return (
    <>
      <div className="target-container">
        <div className="target-header">User: {props.title}</div>
          <div className="target-display">
            <article className={props.className}>
              {(props.stream === null || props.loading) && (
                <progress className="absolute top left circle"></progress>
              )}
              <video
                data-testid={props.title}
                className={props.loading ? "responsive large-opacity" : "responsive"}
                ref={videoRef}
                autoPlay
                width={WIDTH}
                height={HEIGHT}
              />
          </article>
        </div>
      </div>
      {props.stats ? <RenderStats charCount={props.stats.charCount} matchPercentage={props.stats.matchPercentage}/> : <></>}
    </>
  );
}

export function RenderStats(props: Stats){
  return <div className="stats">
      <div className="stats-row">
        <span>Match Percentage:</span>
        <span 
          className="match-percentage"
          style={{ 
            color: props.matchPercentage >= 90 ? 'var(--success)' : 
                    props.matchPercentage >= 50 ? '#ffc107' : 
                    'var(--accent)' 
          }}
        >
          {props.matchPercentage}%
        </span>
      </div>
      <div className="stats-row">
        <span>Characters:</span>
        <span className="char-count">{props.charCount}</span>
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