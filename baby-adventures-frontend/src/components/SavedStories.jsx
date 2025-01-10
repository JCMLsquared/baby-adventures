import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import './SavedStories.css';

function SavedStories({ onSelectStory, onStartNewStory }) {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3001/api/stories', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stories');
        }

        const data = await response.json();
        setStories(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, []);

  const deleteStory = async (storyId) => {
    try {
      const token = localStorage.getItem('token');
      console.log('Deleting story:', storyId);
      
      const response = await fetch(`http://localhost:3001/api/stories/${storyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete story');
      }

      setStories(stories.filter(story => story._id !== storyId));
    } catch (err) {
      console.error('Error deleting story:', err);
      setError(err.message);
    }
  };

  if (loading) {
    return <div>Loading your stories...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="saved-stories">
      <h2>Your Stories</h2>
      
      <div className="stories-grid">
        {stories.map(story => (
          <div key={story._id} className="story-card">
            <h3>{story.title || `${story.characterName}'s Adventure`}</h3>
            <p>Created: {new Date(story.createdAt).toLocaleDateString()}</p>
            <div className="story-card-buttons">
              <button onClick={() => onSelectStory(story)}>Continue Reading</button>
              <button 
                className="delete-button"
                onClick={() => deleteStory(story._id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {stories.length < 10 && (
          <div className="new-story-card">
            <button onClick={onStartNewStory}>
              Create New Story
              <span className="stories-remaining">
                ({10 - stories.length} remaining)
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

SavedStories.propTypes = {
  onSelectStory: PropTypes.func.isRequired,
  onStartNewStory: PropTypes.func.isRequired,
};

export default SavedStories; 