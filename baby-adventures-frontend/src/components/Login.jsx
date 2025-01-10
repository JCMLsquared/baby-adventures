import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import backgroundImage from '../assets/background.png';
import googleIcon from '../assets/icons/google.svg';
import facebookIcon from '../assets/icons/facebook.svg';
import './Login.css';

const SocialButton = ({ onClick, icon, label }) => (
  <button type="button" className="social-button" onClick={onClick}>
    <img src={icon} alt={`${label} icon`} />
    <span>Continue with {label}</span>
  </button>
);

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize Facebook SDK
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: import.meta.env.VITE_FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v12.0'
      });
    };

    // Initialize Google Sign-In
    const handleGoogleSignIn = async (response) => {
      try {
        setIsLoading(true);
        setError('');

        const apiResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            token: response.credential 
          }),
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
          throw new Error(data.error || 'Authentication failed');
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        onLogin(data.username);
      } catch (error) {
        console.error('Google sign-in error:', error);
        setError('Google sign-in failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    const initializeGoogleSignIn = () => {
      if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn
          });
        } catch (error) {
          console.error('Error initializing Google Sign-In:', error);
        }
      } else {
        setTimeout(initializeGoogleSignIn, 100);
      }
    };

    initializeGoogleSignIn();
  }, [onLogin]);

  const handleSocialLogin = async (provider) => {
    try {
      setIsLoading(true);
      setError('');

      if (provider === 'google') {
        window.google.accounts.id.prompt();
      } else if (provider === 'facebook') {
        const response = await new Promise((resolve) => {
          window.FB.login((result) => resolve(result), { scope: 'email' });
        });
        
        if (response.status === 'connected') {
          const token = response.authResponse.accessToken;
          const apiResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/facebook`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token }),
          });

          const data = await apiResponse.json();

          if (!apiResponse.ok) {
            throw new Error(data.error || 'Authentication failed');
          }

          localStorage.setItem('token', data.token);
          localStorage.setItem('username', data.username);
          onLogin(data.username);
        } else {
          throw new Error('Facebook login failed');
        }
      }
    } catch (error) {
      console.error(`${provider} login error:`, error);
      setError(`${provider} login failed. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (isRegistering && password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isRegistering ? 'register' : 'login';
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
          ...(isRegistering && { email }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `${isRegistering ? 'Registration' : 'Login'} failed`);
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);
      onLogin(username);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
  };

  return (
    <div className="background-container" style={{ backgroundImage: `url(${backgroundImage})` }}>
      <div className="login-container">
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}
          <h2>{isRegistering ? 'Create Account' : 'Welcome Back!'}</h2>
          
          <div className="auth-options">
            <SocialButton
              onClick={() => handleSocialLogin('google')}
              icon={googleIcon}
              label="Google"
            />
            <SocialButton
              onClick={() => handleSocialLogin('facebook')}
              icon={facebookIcon}
              label="Facebook"
            />
          </div>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <input
            id="username"
            name="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          {isRegistering && (
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {isRegistering && (
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          )}
          <button id="submitButton" name="submitButton" type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Loading...' : (isRegistering ? 'Register' : 'Login')}
          </button>

          <div className="toggle-auth">
            {isRegistering ? (
              <>
                Already have an account?{' '}
                <button type="button" onClick={toggleAuthMode}>
                  Login
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" onClick={toggleAuthMode}>
                  Register
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

SocialButton.propTypes = {
  onClick: PropTypes.func.isRequired,
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired
};

Login.propTypes = {
  onLogin: PropTypes.func.isRequired
};

export default Login; 