import { useEffect, useRef, useState } from "react";
import { toSvg } from "html-to-image";
import { Stats, usePeerStore } from "./peer";

// html-to-image default impl. with opts passed skips the html body, so there
// is no background rendered on canvas w/out background: white set here
const DEFAULT_CODE = `
<html>
  <head>
    <style>
      body {margin: 0;background:white;}
      #user-shape {
        width: 20px;
        height: 20px;
        background: #dd6b4d;    
      }

    </style>
  </head>
  <body>
    <div id="user-shape"></div>
  </body>
</html>
`;

export const WIDTH = 400;
export const HEIGHT = 300;

export function Battle(
  props: { canvasRef: React.RefObject<HTMLCanvasElement | null> },
) {
  const peer = usePeerStore();
  const remoteStreams = Object.entries(peer.sessions);
  const [userCode, setUserCode] = useState(DEFAULT_CODE);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [charCount, setCharCount] = useState(userCode.length);
  const exportRef = useRef<HTMLIFrameElement | null>(null);

  const updateScore = async () => {
    // Update character count
    setCharCount(userCode.length);

    // Calculate match percentage (simplified version)
    const userCss = userCode.toLowerCase();
    let score = 0;

    if (userCss.includes("width: 100px") || userCss.includes("width:100px")) {
      score += 25;
    }
    if (userCss.includes("height: 100px") || userCss.includes("height:100px")) {
      score += 25;
    }
    if (
      userCss.includes("border-radius: 50") ||
      userCss.includes("border-radius:50")
    ) score += 25;
    if (userCss.includes("#fd4c56") || userCss.includes("var(--accent)")) {
      score += 25;
    }

    setMatchPercentage(score);

    // Send updates
    peer.broadcastStats({
      charCount: userCode.length,
      matchPercentage: score,
    });
  };

  async function updateCanvas() {
    if (!exportRef.current) return;
    if (!props.canvasRef.current) return;
    await drawCanvas(
      props.canvasRef.current,
      // We should theoretically just pass the iframe (exportRef.current)
      // but there is a bug in their implementation where there is dom
      // duplication in rendered html-to-image, where elements in iframe
      // are rendered twice, this is a workaround to have iframe children
      // rendered once
      // see PR https://github.com/bubkoo/html-to-image/pull/434
      exportRef.current.contentDocument!.body,
    );
  }

  useEffect(() => {
    updateScore();
    updateCanvas();
  }, [userCode, updateCanvas, updateScore]);

  // issue with renderer not rendering on connection
  // setInterval(() => {
  //   updateCanvas();
  // }, 1000);

  // useEffect(() => {
  //   updateScore();
  //   updateCanvas();
  // }, [userCode]);

  return (
    <div className="app">
      <header className="header">
        <div className="logo">CSS Battle Clone</div>
        <button
          style={{ background: "white", color: "black" }}
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
          <h2 className="target-title">
            Your Result{remoteStreams.length > 1 && "s"}
          </h2>
          <div className="target-container" style={{ marginTop: "1rem" }}>
            <div className="target-header">Design</div>
            <div className="target-display">
              <iframe
                id="testIframe"
                ref={exportRef}
                className="result-frame"
                srcDoc={userCode}
                style={{
                  "background": "white",
                  "width": WIDTH,
                  "height": HEIGHT,
                  "border": "0px",
                  "outline": "0px",
                }}
                sandbox="allow-same-origin"
                title="Preview"
                onClick={(ev) => {ev.preventDefault();}}
                onLoad={()=>{
                  updateScore();
                  updateCanvas();
                }}
              />
            </div>
          </div>
          <RenderStats
            matchPercentage={matchPercentage}
            charCount={charCount}
          />

          <h2 className="target-title">
            Remote Player{remoteStreams.length > 1 && "s"}
          </h2>
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
            <div className="target-header">Target Design - Color: #fd4c56</div>
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
            <video disablePictureInPicture
              data-testid={props.title}
              className={props.loading
                ? "responsive large-opacity"
                : "responsive"}
              ref={videoRef}
              autoPlay
              width={WIDTH}
              height={HEIGHT}
            />
          </article>
        </div>
      </div>
      {props.stats
        ? (
          <RenderStats
            charCount={props.stats.charCount}
            matchPercentage={props.stats.matchPercentage}
          />
        )
        : <></>}
    </>
  );
}

export function RenderStats(props: Stats) {
  return (
    <div className="stats">
      <div className="stats-row">
        <span>Match Percentage:</span>
        <span
          className="match-percentage"
          style={{
            color: props.matchPercentage >= 90
              ? "var(--success)"
              : props.matchPercentage >= 50
              ? "#ffc107"
              : "var(--accent)",
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
  );
}

// From https://github.com/bubkoo/html-to-image/blob/master/src/util.ts
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      img.decode().then(() => {
        resolve(img);
      });
    };
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
  });
}

// Writes to passed in canvas element
// Adapted from https://github.com/bubkoo/html-to-image/blob/master/src/index.ts
async function drawCanvas<T extends HTMLElement>(
  canvas: HTMLCanvasElement,
  node: T,
): Promise<void> {
  const toSvgErr = (err: string | Event) =>{console.log(`Error with toSvg: ${err}`)}
  // not correct for iframe
  const svg = await toSvg(node, {width: WIDTH, height: HEIGHT, canvasHeight: HEIGHT, canvasWidth: WIDTH, pixelRatio: .5, skipAutoScale: true, onImageErrorHandler: toSvgErr});
  // console.log(svg)
  const img = await createImage(svg);
  // console.log(img)
  const context = canvas.getContext("2d")!;

  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  canvas.style.width = `${WIDTH}`;
  canvas.style.height = `${HEIGHT}`;

  context.drawImage(img, 0, 0, canvas.width, canvas.height);
}
