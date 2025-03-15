import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [cssCode, setCssCode] = useState(`#user-shape {
  /* Write your CSS here */
}`);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [resultHTML, setResultHTML] = useState('<div id="user-shape"></div>');

  useEffect(() => {
    // Set initial character count
    setCharCount(cssCode.length);
  }, []);

  const handleSubmit = () => {
    // Update character count
    setCharCount(cssCode.length);
    
    // Reset HTML with updated CSS
    setResultHTML(`<div id="user-shape"></div><style>${cssCode}</style>`);
    
    // Calculate match percentage (simplified version)
    const userCss = cssCode.toLowerCase();
    let score = 0;
    
    if (userCss.includes('width: 100px') || userCss.includes('width:100px')) score += 25;
    if (userCss.includes('height: 100px') || userCss.includes('height:100px')) score += 25;
    if (userCss.includes('border-radius: 50') || userCss.includes('border-radius:50')) score += 25;
    if (userCss.includes('#fd4c56') || userCss.includes('var(--accent)')) score += 25;
    
    setMatchPercentage(score);
  };
  useEffect(()=>{handleSubmit()}, [cssCode])

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
            value={cssCode}
            onChange={(e) => setCssCode(e.target.value)}
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
                dangerouslySetInnerHTML={{ __html: resultHTML }}
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
