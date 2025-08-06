import React from 'react';
import './SupportPage.css';

function SupportPage({ onNavigate }) {
  return (
    <div className="support-page">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo-section">
            <img 
              src="/assets/images/full-logo-transparent.png" 
              alt="SafeSpace Technologies" 
              className="full-logo"
            />
          </div>
          <div className="nav-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => onNavigate('landing')}
            >
              Back to Home
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="support-content">
        <div className="container">
          <div className="support-header">
            <img 
              src="/assets/images/s-logo-transparent.png" 
              alt="SafeSpace" 
              className="support-logo"
            />
            <h1>Contact Support</h1>
            <p>We're here to help with any questions or issues you may have.</p>
          </div>

          <div className="support-options">
            <div className="support-card primary">
              <div className="support-icon">📧</div>
              <h3>Email Support</h3>
              <p>Get in touch with our support team via email for assistance with any questions or issues.</p>
              <a 
                href="mailto:info@safespacetechnologies.com.au?subject=SafeSpace Support Request"
                className="support-btn"
              >
                Email: info@safespacetechnologies.com.au
              </a>
              <small>We typically respond within 24 hours</small>
            </div>

            <div className="support-card">
              <div className="support-icon">❓</div>
              <h3>Common Questions</h3>
              <p>Before contacting us, you might find answers to common questions:</p>
              <ul className="faq-list">
                <li>Account setup and login issues</li>
                <li>Subscription and billing questions</li>
                <li>Feature usage and tutorials</li>
                <li>Technical troubleshooting</li>
                <li>Privacy and security concerns</li>
              </ul>
            </div>

            <div className="support-card">
              <div className="support-icon">🔧</div>
              <h3>Technical Support</h3>
              <p>Having technical issues? Include the following in your email:</p>
              <ul className="tech-list">
                <li>Description of the problem</li>
                <li>Steps you took before the issue occurred</li>
                <li>Device and browser information</li>
                <li>Screenshots if applicable</li>
              </ul>
            </div>
          </div>

          <div className="support-footer">
            <div className="contact-info">
              <h4>SafeSpace Technologies</h4>
              <p>
                <strong>Email:</strong> info@safespacetechnologies.com.au<br/>
                <strong>Website:</strong> www.safespacetechnologies.com.au
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SupportPage;