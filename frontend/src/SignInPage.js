import React, { useState } from 'react';
import './AuthPages.css';

function SignInPage({ onNavigate, onSignIn }) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          remember_me: formData.rememberMe
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Successfully signed in
        onSignIn(data.user, data.token);
      } else {
        setErrors({ submit: data.detail || 'Invalid email or password' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail) {
      setForgotPasswordMessage('Please enter your email address');
      return;
    }
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: forgotPasswordEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setForgotPasswordMessage('Password reset instructions have been sent to your email');
      } else {
        setForgotPasswordMessage(data.detail || 'Error sending reset email');
      }
    } catch (error) {
      setForgotPasswordMessage('Network error. Please try again.');
    }
  };

  const handleContactSupport = () => {
    // Open contact support modal or navigate to support page
    window.open('mailto:support@safespace.com?subject=Sign In Help Request', '_blank');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container sign-in">
        <div className="auth-header">
          <button className="back-btn" onClick={() => onNavigate('landing')}>
            ← Back to Home
          </button>
          <div className="logo">
            <div className="logo-icon">🛡️</div>
            <span className="logo-text">Safespace</span>
          </div>
        </div>
        
        <div className="auth-content">
          <div className="form-container">
            <div className="step-content">
              <h2>Welcome Back</h2>
              <p className="step-description">Sign in to your Safespace account</p>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={errors.email ? 'error' : ''}
                    placeholder="your.email@example.com"
                    autoComplete="email"
                  />
                  {errors.email && <span className="error-message">{errors.email}</span>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className={errors.password ? 'error' : ''}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  {errors.password && <span className="error-message">{errors.password}</span>}
                </div>
                
                <div className="form-options">
                  <label className="checkbox-group">
                    <input 
                      type="checkbox" 
                      checked={formData.rememberMe}
                      onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Remember me
                  </label>
                  <button 
                    type="button" 
                    className="link-btn forgot-password"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                
                {errors.submit && (
                  <div className="error-message submit-error">{errors.submit}</div>
                )}
                
                <button 
                  type="submit" 
                  className="btn btn-primary btn-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        </div>
        
        <div className="auth-footer">
          <p>Don't have an account? <button className="link-btn" onClick={() => onNavigate('signup')}>Sign Up</button></p>
          <div className="help-text">
            <p>Need help? <button className="link-btn" onClick={handleContactSupport}>Contact Support</button></p>
          </div>
        </div>
        
        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Reset Password</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowForgotPassword(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleForgotPassword}>
                <div className="modal-body">
                  <p>Enter your email address and we'll send you instructions to reset your password.</p>
                  <div className="form-group">
                    <label htmlFor="forgot-email">Email Address</label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                  {forgotPasswordMessage && (
                    <div className={`message ${forgotPasswordMessage.includes('sent') ? 'success' : 'error'}`}>
                      {forgotPasswordMessage}
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                  >
                    Send Reset Instructions
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SignInPage;