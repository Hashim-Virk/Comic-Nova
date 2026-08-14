import { useState, useEffect } from 'react';
import './App.css';

const BACKEND_URL = "https://svncvdmdeipl5n3ai3xsdhekdq0zhdxd.lambda-url.us-east-1.on.aws/";

const ART_STYLES = [
  { id: 'comic-book', name: 'Superhero Comic', prompt: 'classic 90s comic book illustration style, bold outlines, vibrant colors, comic art, high action' },
  { id: 'anime', name: 'Chibi Anime', prompt: 'cute chibi anime style, pastel color palette, soft lighting, detailed characters, manga art' },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', prompt: 'cyberpunk illustration style, glowing neon lights, futuristic cityscape, dark moody atmosphere, highly detailed' },
  { id: 'watercolor', name: 'Watercolor', prompt: 'beautiful watercolor painting style, soft splatters, hand-drawn sketch lines, organic texture, artistic' },
  { id: 'pixel-art', name: 'Retro Pixel Art', prompt: '16-bit pixel art style, vibrant palette, video game screen, crisp pixels, retro aesthetics' },
  { id: 'claymation', name: '3D Claymation', prompt: 'claymation style, plasticine texture, cute character models, 3D render style, clean studio lighting' },
];

function App() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' or 'gallery'
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(ART_STYLES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [currentComic, setCurrentComic] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);
  const [selectedGalleryComic, setSelectedGalleryComic] = useState(null);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error'

  useEffect(() => {
    if (activeTab === 'gallery') {
      fetchGallery();
    }
  }, [activeTab]);

  const fetchGallery = async () => {
    setIsLoadingGallery(true);
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_comics' })
      });
      const data = await response.json();
      if (response.ok && data.comics) {
        setGallery(data.comics);
      } else {
        console.error('Error fetching gallery:', data.error);
      }
    } catch (err) {
      console.error('Error connecting to backend:', err);
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const handleGenerateComic = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setCurrentComic(null);
    setSaveStatus('');
    setGenerationStep('Writing comic script and designing prompts with Amazon Nova...');

    try {
      // Step 1: Generate Comic Story/Script
      const storyResponse = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_story',
          prompt: prompt,
          style: selectedStyle.name
        })
      });

      if (!storyResponse.ok) {
        throw new Error('Failed to generate script. Please try again.');
      }

      const scriptData = await storyResponse.json();
      if (scriptData.error) {
        throw new Error(scriptData.error);
      }

      // Initialize the comic structure
      const comicStructure = {
        title: scriptData.title,
        prompt: prompt,
        style: selectedStyle.name,
        panels: scriptData.panels.map(panel => ({
          ...panel,
          image_base64: '',
          image_url: '',
          loading: true
        }))
      };
      
      setCurrentComic(comicStructure);

      // Step 2: Generate Images Sequentially
      const updatedPanels = [...comicStructure.panels];
      for (let i = 0; i < updatedPanels.length; i++) {
        const panelNum = i + 1;
        setGenerationStep(`Drawing Panel ${panelNum} with Amazon Nova Canvas...`);

        // Enhance the prompt with selected style attributes
        const finalImagePrompt = `${updatedPanels[i].image_prompt}, ${selectedStyle.prompt}`;

        try {
          const imgResponse = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'generate_image',
              prompt: finalImagePrompt,
              panel_number: panelNum
            })
          });

          if (!imgResponse.ok) {
            throw new Error(`Failed to draw Panel ${panelNum}`);
          }

          const imgData = await imgResponse.json();
          updatedPanels[i] = {
            ...updatedPanels[i],
            image_url: imgData.image_url,
            image_base64: imgData.image_base64,
            loading: false
          };

          // Update current comic state after each panel resolves to show progress live!
          setCurrentComic(prev => ({
            ...prev,
            panels: [...updatedPanels]
          }));
        } catch (panelErr) {
          console.error(panelErr);
          updatedPanels[i] = {
            ...updatedPanels[i],
            loading: false,
            error: true
          };
          setCurrentComic(prev => ({
            ...prev,
            panels: [...updatedPanels]
          }));
        }
      }

    } catch (err) {
      alert(`Generation failed: ${err.message}`);
      setCurrentComic(null);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleSaveComic = async () => {
    if (!currentComic) return;
    setSaveStatus('saving');
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_comic',
          comic: {
            title: currentComic.title,
            prompt: currentComic.prompt,
            style: currentComic.style,
            panels: currentComic.panels.map(p => ({
              panel_number: p.panel_number,
              narration: p.narration,
              dialogue: p.dialogue,
              // Store url or base64
              image_url: p.image_url || p.image_base64
            }))
          }
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSaveStatus('saved');
        // Clear message after 3 seconds
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(parseInt(ts) * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <div className="logo-icon">🔮</div>
          <div className="brand-info">
            <h1>ComicNova</h1>
            <p>AI-Powered Comic Book & Story Generator</p>
          </div>
        </div>
        <nav className="app-nav">
          <button 
            className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            🎨 Create Comic
          </button>
          <button 
            className={`nav-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            🏛️ Public Gallery
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'create' ? (
          <section className="create-section">
            <div className="config-grid">
              <div className="glass-panel input-panel">
                <h2>1. Pitch Your Story</h2>
                <form onSubmit={handleGenerateComic}>
                  <div className="form-group">
                    <label htmlFor="story-prompt">Describe the scene or story premise:</label>
                    <textarea
                      id="story-prompt"
                      placeholder="An astronaut discovers a glowing ancient ruins key on Mars and uses it to open a secret portal..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      required
                    />
                  </div>

                  <h2>2. Select Artistic Style</h2>
                  <div className="style-grid">
                    {ART_STYLES.map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        className={`style-card ${selectedStyle.id === style.id ? 'active' : ''}`}
                        onClick={() => setSelectedStyle(style)}
                        disabled={isGenerating}
                      >
                        <div className="style-name">{style.name}</div>
                      </button>
                    ))}
                  </div>

                  <button 
                    type="submit" 
                    className="generate-btn"
                    disabled={isGenerating || !prompt.trim()}
                  >
                    {isGenerating ? 'Generating...' : '⚡ Generate Comic Strip'}
                  </button>
                </form>
              </div>

              {/* Display loading or completed comic */}
              <div className="glass-panel display-panel">
                {isGenerating && !currentComic && (
                  <div className="loading-container">
                    <div className="loader"></div>
                    <p className="loading-step">{generationStep}</p>
                  </div>
                )}

                {!isGenerating && !currentComic && (
                  <div className="empty-state">
                    <div className="empty-icon">📖</div>
                    <h3>Start Your Adventure</h3>
                    <p>Enter a prompt and select an art style to generate a custom 3-panel comic strip using AWS and Bedrock Nova models.</p>
                  </div>
                )}

                {currentComic && (
                  <div className="comic-viewer">
                    {isGenerating && (
                      <div className="inline-loader">
                        <div className="small-loader"></div>
                        <span>{generationStep}</span>
                      </div>
                    )}
                    
                    <div className="comic-book-page">
                      <h2 className="comic-title">{currentComic.title}</h2>
                      <div className="comic-grid-panels">
                        {currentComic.panels.map((panel, idx) => (
                          <div key={idx} className="comic-panel-card">
                            <div className="panel-num">PANEL {panel.panel_number}</div>
                            
                            <div className="comic-image-container">
                              {panel.loading ? (
                                <div className="panel-image-placeholder">
                                  <div className="pulsing-circle"></div>
                                  <p>Drawing...</p>
                                </div>
                              ) : panel.error ? (
                                <div className="panel-image-placeholder error">
                                  <p>⚠️ Failed to load panel</p>
                                </div>
                              ) : (
                                <>
                                  <img 
                                    src={panel.image_url || panel.image_base64} 
                                    alt={`Panel ${panel.panel_number}`}
                                    className="panel-image"
                                  />
                                  {panel.dialogue && panel.dialogue !== 'No dialogue' && (
                                    <div className="speech-bubble">
                                      <p>{panel.dialogue}</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>

                            <div className="panel-narration">
                              <p>{panel.narration}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!isGenerating && (
                      <div className="comic-actions">
                        <button 
                          onClick={handleSaveComic} 
                          className="action-btn save-btn"
                          disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                        >
                          {saveStatus === 'saving' ? 'Saving...' : 
                           saveStatus === 'saved' ? '🎉 Saved to Gallery!' : 
                           '💾 Save to Public Gallery'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="gallery-section">
            <h2 className="section-title">Public AI Comic Gallery</h2>
            {isLoadingGallery ? (
              <div className="loading-container">
                <div className="loader"></div>
                <p>Loading gallery items...</p>
              </div>
            ) : gallery.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>Gallery is Empty</h3>
                <p>Be the first to generate and save a comic to the gallery!</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {gallery.map((comic) => (
                  <div 
                    key={comic.id} 
                    className="gallery-card"
                    onClick={() => setSelectedGalleryComic(comic)}
                  >
                    <div className="gallery-card-preview">
                      {comic.panels && comic.panels[0] && (
                        <img 
                          src={comic.panels[0].image_url} 
                          alt={comic.title}
                          onError={(e) => {
                            // Fallback if URL expired or broke
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="gallery-card-overlay">
                        <span>View Comic</span>
                      </div>
                    </div>
                    <div className="gallery-card-info">
                      <h4>{comic.title}</h4>
                      <p className="gallery-style">{comic.style}</p>
                      <p className="gallery-date">{formatTimestamp(comic.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modal for full comic viewing */}
            {selectedGalleryComic && (
              <div className="modal-backdrop" onClick={() => setSelectedGalleryComic(null)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <button className="modal-close" onClick={() => setSelectedGalleryComic(null)}>×</button>
                  <div className="comic-book-page">
                    <h2 className="comic-title">{selectedGalleryComic.title}</h2>
                    <p className="comic-author-info">Created on {formatTimestamp(selectedGalleryComic.created_at)} | Style: {selectedGalleryComic.style}</p>
                    
                    <div className="comic-grid-panels">
                      {selectedGalleryComic.panels.map((panel, idx) => (
                        <div key={idx} className="comic-panel-card">
                          <div className="panel-num">PANEL {panel.panel_number}</div>
                          
                          <div className="comic-image-container">
                            <img 
                              src={panel.image_url} 
                              alt={`Panel ${panel.panel_number}`}
                              className="panel-image"
                            />
                            {panel.dialogue && panel.dialogue !== 'No dialogue' && (
                              <div className="speech-bubble">
                                <p>{panel.dialogue}</p>
                              </div>
                            )}
                          </div>

                          <div className="panel-narration">
                            <p>{panel.narration}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
