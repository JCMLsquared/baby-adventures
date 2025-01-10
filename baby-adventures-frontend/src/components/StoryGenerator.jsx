import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FaShare, FaStar, FaChartBar, FaVolumeUp } from 'react-icons/fa';
import { audioManager } from '../utils/audio';
import './StoryGenerator.css';

// Define a constant for the default page structure
const DEFAULT_PAGE = {
  pageNumber: 0,  // Start from 0 to match array indexing
  text: '',
  image: '',
  isDefault: true // Flag to identify default pages
};

function StoryGenerator({ 
  ageGroup, 
  theme, 
  characterName, 
  currentStory, 
  username, 
  onLogout, 
  onStoryComplete, 
  setAgeGroup, 
  setTheme, 
  setCharacterName, 
  characterType, 
  setting, 
  setCharacterType, 
  setSetting 
}) {
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [storyId, setStoryId] = useState(null);
  const [isGeneratingNext, setIsGeneratingNext] = useState(false);
  const [error, setError] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [readingMode, setReadingMode] = useState('self'); // 'self' or 'ai'
  const [selectedVoice, setSelectedVoice] = useState('alloy'); // Default OpenAI voice
  const currentPageAudioPlayed = useRef(false);  // Add this ref

  // Improved text cleaning function
  const cleanText = (text) => {
    if (!text) return '';
    
    // First, remove any undefined occurrences
    let cleaned = text
      .replace(/\bundefined\b/g, '')  // Remove standalone undefined words
      .replace(/undefined$/, '')      // Remove undefined at the end
      .replace(/([.!?])\s*undefined/g, '$1')  // Remove undefined after punctuation
      .trim();
    
    // Then remove any unwanted prefixes
    cleaned = cleaned
      .replace(/^[Hh]ere'?s? (?:is )?(?:a )?(?:story for )?(?:toddlers )?(?:aged )?(?:\d-\d|\d\+)?[:]\s*/i, '')
      .replace(/^\s*Chapter \d+[:.]\s*/i, '')
      .trim();
    
    // Ensure the first character is preserved and capitalized
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned;
  };

  const getCurrentPage = (chapters, currentChapter) => {
    const page = chapters[currentChapter];
    
    if (!page) {
      return DEFAULT_PAGE;
    }

    // Validate page structure
    if (!('pageNumber' in page) || 
        !('text' in page) || 
        !('image' in page)) {
      console.warn('Invalid page structure detected');
      return DEFAULT_PAGE;
    }

    return page;
  };

  const currentPage = getCurrentPage(chapters, currentChapter);

  useEffect(() => {
    if (currentStory) {
      setStoryId(currentStory.storyId || currentStory._id);
      setChapters(currentStory.pages || []);
      setCurrentChapter(currentStory.currentPage - 1 || 0);
      setAgeGroup(currentStory.ageGroup);
      setTheme(currentStory.theme);
      setCharacterName(currentStory.characterName);
      setCharacterType(currentStory.characterType);
      setSetting(currentStory.setting || '');
    }
  }, [currentStory, setAgeGroup, setTheme, setCharacterName, setCharacterType, setSetting]);

  useEffect(() => {
    if (currentPage && currentPage.text) {
      setIsTyping(true);
      setDisplayText('');
      currentPageAudioPlayed.current = false;  // Reset the flag for new page
      let index = 0;
      
      // Clean and prepare the text
      let cleanedText = cleanText(currentPage.text);
      
      // Ensure the first character is capitalized
      if (cleanedText.length > 0) {
        cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
      }
      
      const typingInterval = setInterval(() => {
        if (index < cleanedText.length) {
          setDisplayText(cleanedText.substring(0, index + 1));
          index++;
        } else {
          setIsTyping(false);
          clearInterval(typingInterval);
          setDisplayText(cleanedText);
        }
      }, 50);

      // Cleanup function
      return () => {
        clearInterval(typingInterval);
        setIsTyping(false);
      };
    }
  }, [currentPage]);

  // Modify the audio playback effect
  useEffect(() => {
    let audioElement = null;

    const playAudio = async () => {
      try {
        // Only play if we're in AI mode, have text, typing is complete, and haven't played for this page yet
        if (readingMode === 'ai' && currentPage?.text && !isTyping && !currentPageAudioPlayed.current) {
          currentPageAudioPlayed.current = true;  // Mark as played immediately
          const token = localStorage.getItem('token');
          const response = await fetch('http://localhost:3001/api/text_to_speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: cleanText(currentPage.text),
              voice: selectedVoice
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to generate speech');
          }

          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          audioElement = new Audio(audioUrl);
          
          audioElement.onended = () => {
            URL.revokeObjectURL(audioUrl);
          };
          
          await audioElement.play();
        }
      } catch (error) {
        console.error('Error playing audio:', error);
        setError('Failed to play audio');
        currentPageAudioPlayed.current = false;  // Reset on error to allow retry
      }
    };

    // Only trigger audio when typing is complete
    if (!isTyping) {
      playAudio();
    }

    // Cleanup function to stop audio when component updates
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [currentPage?.text, readingMode, selectedVoice, isTyping]);

  const handleShare = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/stories/${storyId}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      navigator.clipboard.writeText(data.shareUrl);
      alert('Share link copied to clipboard!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRating = async () => {
    try {
      // Check if a rating has been selected
      if (!rating || rating < 1 || rating > 5) {
        setError('Please select a rating (1-5 stars) before submitting');
        return;
      }

      // Get the correct story ID
      const actualStoryId = currentStory?._id || storyId;
      if (!actualStoryId) {
        setError('Story not found. Please try again.');
        return;
      }

      console.log('Submitting rating for story:', actualStoryId);
      console.log('Rating value:', rating);
      console.log('Comment:', comment);
      
      const token = localStorage.getItem('token');
      console.log('Using token:', token ? 'Token exists' : 'No token found');
      
      const response = await fetch(`http://localhost:3001/api/stories/${actualStoryId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comment
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Rating submission failed:', errorData);
        throw new Error(errorData.error || 'Failed to submit rating');
      }

      setRating(0);
      setComment('');
      alert('Thank you for rating this story!');
      
      // After successful rating, navigate back to stories view
      if (typeof onStoryComplete === 'function') {
        onStoryComplete();
      }
    } catch (err) {
      console.error('Error in handleRating:', err);
      setError(err.message);
    }
  };

  const handleViewAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:3001/api/stories/${storyId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalyticsData(data);
      setShowAnalytics(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const startStory = async () => {
    if (!ageGroup || !theme || !characterName || !characterType || !setting) {
      audioManager.playSound('ERROR');
      setError('Please fill in all fields: age group, genre, character name, character type, and setting');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      audioManager.playSound('ERROR');
      setError('Please log in to create a story');
      onLogout();
      return;
    }

    audioManager.playSound('BUTTON_CLICK');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/start_story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          age_group: ageGroup,
          theme,
          character_name: characterName,
          character_type: characterType,
          setting,
          username,
          voice: selectedVoice,
          reading_mode: readingMode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start story');
      }

      const data = await response.json();
      setStoryId(data.story_id);
      
      setChapters([{
        pageNumber: data.page_number,
        text: cleanText(data.story_text),
        image: data.image
      }]);
      setCurrentChapter(0);
      audioManager.playSound('SUCCESS');
    } catch (error) {
      audioManager.playSound('ERROR');
      console.error('Error starting story:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateNextChapter = async () => {
    if (!storyId) return;

    setIsGeneratingNext(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/next_page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          story_id: storyId,
          current_page: currentChapter,
          age_group: ageGroup,
          theme,
          character_name: characterName,
          character_type: characterType,
          setting
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate next chapter');
      }

      const data = await response.json();
      setChapters(prev => [...prev, {
        pageNumber: prev.length + 1,  // Calculate page number based on current chapters length
        text: data.story_text,
        image: data.image
      }]);
      setCurrentChapter(prev => prev + 1);
      audioManager.playSound('SUCCESS');
    } catch (error) {
      audioManager.playSound('ERROR');
      console.error('Error generating next chapter:', error);
      setError(error.message);
    } finally {
      setIsGeneratingNext(false);
    }
  };

  // Add the handleEndStory function near the other handlers
  const handleEndStory = () => {
    // Save any pending changes before ending
    if (storyId) {
      const token = localStorage.getItem('token');
      fetch(`http://localhost:3001/api/stories/${storyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          pages: chapters,
          currentPage: currentChapter + 1
        }),
      }).catch(error => console.error('Error saving story state:', error));
    }

    // Reset story state
    setChapters([]);
    setCurrentChapter(0);
    setStoryId(null);
    setRating(0);
    setComment('');
    setDisplayText('');
    
    // Play success sound
    audioManager.playSound('SUCCESS');
    
    // Navigate back to stories view
    if (typeof onStoryComplete === 'function') {
      onStoryComplete();
    }
  };

  // Render the story text with proper className
  const storyTextClassName = `story-text ${isTyping ? 'typing' : ''}`;

  if (!currentStory && !chapters.length) {
    return (
      <div className="story-setup">
        <h2 className="form-group full-width">Create Your Story Character</h2>
        {error && <div className="error-message form-group full-width">{error}</div>}
        
        {/* Left Column */}
        <div className="form-group">
          <label>Age Group:</label>
          <select value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="">Select Age Group</option>
            <option value="0-2">0-2 years</option>
            <option value="3-5">3-5 years</option>
            <option value="6-8">6-8 years</option>
          </select>
        </div>
        
        {/* Right Column */}
        <div className="form-group">
          <label>Theme:</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="">Select Theme</option>
            <option value="adventure">Adventure</option>
            <option value="friendship">Friendship</option>
            <option value="learning">Learning</option>
            <option value="nature">Nature</option>
          </select>
        </div>
        
        {/* Left Column */}
        <div className="form-group">
          <label>Character Name:</label>
          <input
            type="text"
            value={characterName}
            onChange={(e) => setCharacterName(e.target.value)}
            placeholder="Enter character name"
          />
        </div>
        
        {/* Right Column */}
        <div className="form-group">
          <label>Setting:</label>
          <select value={setting} onChange={(e) => setSetting(e.target.value)}>
            <option value="">Select Setting</option>
            <option value="magical forest">Magical Forest</option>
            <option value="enchanted castle">Enchanted Castle</option>
            <option value="secret garden">Secret Garden</option>
            <option value="underwater kingdom">Underwater Kingdom</option>
          </select>
        </div>
        
        {/* Left Column */}
        <div className="form-group">
          <label>Character Type:</label>
          <select value={characterType} onChange={(e) => setCharacterType(e.target.value)}>
            <option value="">Select Character Type</option>
            <option value="dinosaur">Dinosaur</option>
            <option value="unicorn">Unicorn</option>
            <option value="dragon">Dragon</option>
            <option value="bunny">Bunny</option>
          </select>
        </div>
        
        {/* Right Column */}
        <div className="form-group">
          <label>Reading Mode:</label>
          <select 
            value={readingMode} 
            onChange={(e) => setReadingMode(e.target.value)}
            className="reading-mode-select"
          >
            <option value="self">Read it Myself</option>
            <option value="ai">AI Text-to-Speech</option>
          </select>
          {readingMode === 'ai' && (
            <div className="voice-selection">
              <label>Select Voice:</label>
              <select 
                value={selectedVoice} 
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="voice-select"
              >
                <option value="alloy">Alloy - Neutral & Clear</option>
                <option value="echo">Echo - Warm & Friendly</option>
                <option value="fable">Fable - British & Whimsical</option>
                <option value="onyx">Onyx - Deep & Engaging</option>
                <option value="nova">Nova - Energetic & Young</option>
                <option value="shimmer">Shimmer - Gentle & Soothing</option>
              </select>
              <div className="voice-preview">
                Click to preview voice
                <button 
                  onClick={() => {
                    const audio = new Audio(`http://localhost:3001/assets/sounds/voices/${selectedVoice}_preview.mp3`);
                    audio.play();
                  }} 
                  className="preview-button"
                >
                  <FaVolumeUp />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Full Width */}
        <div className="form-group full-width">
          <button 
            onClick={startStory} 
            disabled={loading}
            className="start-button"
          >
            {loading ? 'Creating Story...' : 'Start Story'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="story-display">
      <div className="story-controls">
        <button onClick={handleShare} className="control-button">
          <FaShare /> Share Story
        </button>
        <button onClick={handleViewAnalytics} className="control-button">
          <FaChartBar /> View Analytics
        </button>
      </div>

      {showAnalytics && analyticsData && (
        <div className="analytics-overlay">
          <div className="analytics-content">
            <h3>Story Analytics</h3>
            <p>Total Views: {analyticsData.totalViews}</p>
            <p>Average Rating: {analyticsData.averageRating.toFixed(1)}</p>
            <div className="ratings-list">
              {analyticsData.ratings.map((r, i) => (
                <div key={i} className="rating-item">
                  <div className="stars">
                    {[...Array(5)].map((_, i) => (
                      <FaStar key={i} className={i < r.rating ? 'star active' : 'star'} />
                    ))}
                  </div>
                  {r.comment && <p className="comment">{r.comment}</p>}
                  <small>{new Date(r.date).toLocaleDateString()}</small>
                </div>
              ))}
            </div>
            <button onClick={() => setShowAnalytics(false)}>Close</button>
          </div>
        </div>
      )}

      <div className="story-content">
        {currentPage && (
          <>
            <h2>Chapter {currentPage.pageNumber}</h2>
            <div className="story-image">
              {currentPage.image && (
                <img 
                  src={`data:image/png;base64,${currentPage.image}`} 
                  alt={`Chapter ${currentPage.pageNumber}`} 
                />
              )}
            </div>
            <div className="story-text-container">
              <p className={storyTextClassName}>
                {displayText || cleanText(currentPage.text)}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="story-navigation">
        {currentChapter > 0 && (
          <button 
            onClick={() => setCurrentChapter(prev => prev - 1)}
            className="nav-button"
          >
            Previous Page
          </button>
        )}
        {currentChapter < chapters.length - 1 ? (
          <button 
            onClick={() => setCurrentChapter(prev => prev + 1)}
            className="nav-button"
          >
            Next Page
          </button>
        ) : currentChapter < 4 ? (
          <button 
            onClick={generateNextChapter}
            disabled={isGeneratingNext}
            className="nav-button"
          >
            {isGeneratingNext ? 'Generating...' : 'Generate Next Page'}
          </button>
        ) : (
          <div className="story-ending">
            <h3>Rate this Story</h3>
            <div className="story-rating">
              <div className="rating-container">
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FaStar
                      key={star}
                      className={`star ${star <= rating ? 'active' : ''}`}
                      onClick={() => setRating(star)}
                    />
                  ))}
                </div>
                <p className="rating-label">Select 1-5 stars</p>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Leave a comment..."
                className="rating-comment"
              />
              <div className="ending-buttons">
                <button onClick={handleRating} className="submit-rating">
                  Submit Rating
                </button>
                <button onClick={handleEndStory} className="end-story-button">
                  End Story
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

StoryGenerator.propTypes = {
  ageGroup: PropTypes.string.isRequired,
  theme: PropTypes.string.isRequired,
  characterName: PropTypes.string.isRequired,
  characterType: PropTypes.string.isRequired,
  setting: PropTypes.string.isRequired,
  currentStory: PropTypes.object,
  username: PropTypes.string.isRequired,
  onLogout: PropTypes.func.isRequired,
  onStoryComplete: PropTypes.func.isRequired,
  setAgeGroup: PropTypes.func.isRequired,
  setTheme: PropTypes.func.isRequired,
  setCharacterName: PropTypes.func.isRequired,
  setCharacterType: PropTypes.func.isRequired,
  setSetting: PropTypes.func.isRequired,
};

export default StoryGenerator;