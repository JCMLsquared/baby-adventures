const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Sound effect URLs
const SOUNDS = {
  BUTTON_CLICK: `${API_BASE_URL}/assets/sounds/click.mp3`,
  PAGE_TURN: `${API_BASE_URL}/assets/sounds/page-turn.mp3`,
  SUCCESS: `${API_BASE_URL}/assets/sounds/success.mp3`,
  ERROR: `${API_BASE_URL}/assets/sounds/error.mp3`,
  BACKGROUND_MUSIC: `${API_BASE_URL}/api/background-music`
};

// Debug the API URL
console.log('API Base URL:', API_BASE_URL);

class AudioManager {
  constructor() {
    this.sounds = new Map();
    this.backgroundMusic = null;
    this.isMuted = false;
    this.isInitialized = false;
  }

  async preloadSounds() {
    try {
      if (this.isInitialized) return;
      
      // Create background music audio element first
      const bgMusic = new Audio();
      bgMusic.loop = true;
      bgMusic.volume = 0.3;
      
      // Add detailed error and state logging
      bgMusic.addEventListener('error', (e) => {
        console.error('Background music error:', {
          error: e.target.error,
          src: bgMusic.src,
          readyState: bgMusic.readyState,
          networkState: bgMusic.networkState,
          error_code: e.target.error ? e.target.error.code : null,
          error_message: e.target.error ? e.target.error.message : null
        });
      });

      // Add loading state listeners
      bgMusic.addEventListener('loadstart', () => {
        console.log('Audio loading started:', {
          src: bgMusic.src,
          readyState: bgMusic.readyState,
          networkState: bgMusic.networkState
        });
      });

      bgMusic.addEventListener('canplay', () => {
        console.log('Audio can start playing:', {
          src: bgMusic.src,
          readyState: bgMusic.readyState,
          networkState: bgMusic.networkState
        });
      });

      // Set source and load
      console.log('Attempting to load audio from:', SOUNDS.BACKGROUND_MUSIC);
      bgMusic.src = SOUNDS.BACKGROUND_MUSIC;
      this.backgroundMusic = bgMusic;
      
      // Load other sounds
      for (const [key, url] of Object.entries(SOUNDS)) {
        if (key !== 'BACKGROUND_MUSIC') {
          const audio = new Audio();
          audio.src = url;
          this.sounds.set(key, audio);
        }
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Error preloading sounds:', error);
    }
  }

  playSound(soundKey) {
    if (this.isMuted) return;
    
    const sound = this.sounds.get(soundKey);
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(err => console.warn('Audio playback prevented:', err));
    }
  }

  async startBackgroundMusic() {
    if (this.isMuted || !this.backgroundMusic) return;
    
    try {
      // Always wait for user interaction
      const playPromise = this.backgroundMusic.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Autoplay prevented:', error);
          // Add click handler only if autoplay fails
          const startAudio = async () => {
            try {
              await this.backgroundMusic.play();
              document.removeEventListener('click', startAudio);
            } catch (err) {
              console.error('Play failed after click:', err);
            }
          };
          document.addEventListener('click', startAudio);
        });
      }
    } catch (err) {
      console.warn('Background music playback error:', err);
    }
  }

  stopBackgroundMusic() {
    if (this.backgroundMusic) {
      this.backgroundMusic.pause();
      this.backgroundMusic.currentTime = 0;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBackgroundMusic();
    } else {
      this.startBackgroundMusic();
    }
    return this.isMuted;
  }
}

export const audioManager = new AudioManager();
export const SOUND_KEYS = Object.keys(SOUNDS); 