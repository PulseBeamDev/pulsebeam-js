import { useState, useEffect } from 'react'
import './App.css'

const DEFAULT_CODE = `<div id="user-shape"></div>
<style>
    #user-shape {
      width: 100px;
      height: 100px;
      background: #dd6b4d;    
    }
</style>`

function App() {
  const [userCode, setUserCode] = useState(DEFAULT_CODE);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    // Set initial character count
    setCharCount(userCode.length);
  }, []);

  const handleSubmit = () => {
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
  useEffect(()=>{handleSubmit()}, [userCode])

  return (
    <div className="app">
      <header className="header">
        <div className="logo">CSS Battle Clone</div>
      </header>
      
      <main>
        <section className="editor-section">
          <h2>Your CSS</h2>
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
                className="result-frame" 
                dangerouslySetInnerHTML={{ __html: userCode }}
              />
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

export default App
