import { useState, useEffect } from 'react'
import './App.css'
import StoryGenerator from './components/StoryGenerator'
import Login from './components/Login'
import SavedStories from './components/SavedStories'
import Background from './components/Background'

function App() {
  const [user, setUser] = useState(null);
  const [ageGroup, setAgeGroup] = useState('');
  const [theme, setTheme] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterType, setCharacterType] = useState('');
  const [setting, setSetting] = useState('');
  const [currentStory, setCurrentStory] = useState(null);
  const [view, setView] = useState('login');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    if (token && username) {
      setUser(username);
      setView('stories');
    }
  }, []);

  const handleLogin = (username) => {
    setUser(username);
    setView('stories');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setUser(null);
    setCurrentStory(null);
    setView('login');
    setAgeGroup('');
    setTheme('');
    setCharacterName('');
    setCharacterType('');
    setSetting('');
  };

  const handleSelectStory = (story) => {
    setCurrentStory(story);
    setAgeGroup(story.ageGroup);
    setTheme(story.theme);
    setCharacterName(story.characterName);
    setCharacterType(story.characterType || '');
    setSetting(story.setting || '');
    setView('generator');
  };

  const handleStartNewStory = () => {
    setCurrentStory(null);
    setAgeGroup('');
    setTheme('');
    setCharacterName('');
    setCharacterType('');
    setSetting('');
    setView('generator');
  };

  if (!user || view === 'login') {
    return (
      <>
        <Background />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <Background />
      <div className="app-container">
        <header>
          <h1>Baby Adventures</h1>
          <div className="user-controls">
            <span>Welcome, {user}!</span>
            {view === 'generator' && (
              <button onClick={() => setView('stories')}>My Stories</button>
            )}
            <button onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {view === 'stories' ? (
          <SavedStories
            onSelectStory={handleSelectStory}
            onStartNewStory={handleStartNewStory}
          />
        ) : (
          <StoryGenerator
            ageGroup={ageGroup}
            theme={theme}
            characterName={characterName}
            characterType={characterType}
            setting={setting}
            currentStory={currentStory}
            username={user}
            onLogout={handleLogout}
            onStoryComplete={() => setView('stories')}
            setAgeGroup={setAgeGroup}
            setTheme={setTheme}
            setCharacterName={setCharacterName}
            setCharacterType={setCharacterType}
            setSetting={setSetting}
          />
        )}
      </div>
    </>
  );
}

export default App;
