import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import SignUpPage from './SignUpPage';
import SignInPage from './SignInPage';
import MessagingApp from './MessagingApp';
import SupportPage from './SupportPage';

function App() {
  const [currentPage, setCurrentPage] = useState('landing');
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on app load
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setAuthToken(token);
        setCurrentPage('app');
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
      }
    }
    
    setIsLoading(false);
  }, []);

  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const handleSignUp = (userData, token) => {
    setUser(userData);
    setAuthToken(token);
    
    // Store in localStorage for persistence
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    setCurrentPage('app');
  };

  const handleSignIn = (userData, token) => {
    setUser(userData);
    setAuthToken(token);
    
    // Store in localStorage for persistence
    localStorage.setItem('authToken', token);
    localStorage.setItem('userData', JSON.stringify(userData));
    
    setCurrentPage('app');
  };

  const handleSignOut = () => {
    setUser(null);
    setAuthToken(null);
    
    // Clear localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
    setCurrentPage('landing');
  };

  const handleUpdateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData };
    setUser(newUserData);
    localStorage.setItem('userData', JSON.stringify(newUserData));
  };

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '50px', 
            height: '50px', 
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          Loading Safespace...
        </div>
      </div>
    );
  }

  // Render appropriate page based on current state
  switch (currentPage) {
    case 'landing':
      return <LandingPage onNavigate={handleNavigate} />;
    
    case 'signup':
      return (
        <SignUpPage 
          onNavigate={handleNavigate} 
          onSignUp={handleSignUp}
        />
      );
    
    case 'signin':
      return (
        <SignInPage 
          onNavigate={handleNavigate} 
          onSignIn={handleSignIn}
        />
      );
    
    case 'app':
      return (
        <MessagingApp 
          user={user}
          authToken={authToken}
          onSignOut={handleSignOut}
          onUpdateUser={handleUpdateUser}
        />
      );
    
    case 'support':
      return <SupportPage onNavigate={handleNavigate} />;
    
    default:
      return <LandingPage onNavigate={handleNavigate} />;
  }
}

export default App;