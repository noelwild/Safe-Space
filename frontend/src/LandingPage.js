import React from 'react';
import './LandingPage.css';

function LandingPage({ onNavigate }) {
  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo-section">
            <img 
              src="/assets/images/Full_logo_transparent.png" 
              alt="SafeSpace Technologies" 
              className="full-logo"
            />
          </div>
          <div className="nav-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => onNavigate('signin')}
            >
              Sign In
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => onNavigate('signup')}
            >
              Get Started - Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h2 className="hero-title">Stress Free Communication</h2>
          <h3 className="hero-subtitle-header">A Safer Way to Communicate</h3>
          <p className="hero-subtitle">
            AI-powered platform with multi-language support that promotes respectful communication between co-parents, 
            ensuring every interaction is stress-free and child-focused regardless of language barriers.
          </p>
        </div>
        <div className="hero-image">
          <div className="hero-illustration">
            <div className="family-icon">
              <img 
                src="/assets/images/Family.png" 
                alt="Co-parenting family" 
                className="family-image"
              />
            </div>
            <div className="communication-lines">
              <div className="line line-1"></div>
              <div className="line line-2"></div>
              <div className="line line-3"></div>
            </div>
            <div className="ai-shield">
              <img 
                src="/assets/images/S_logo_transparent.png" 
                alt="SafeSpace AI" 
                className="s-logo"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Making Co-Parenting Easier</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>AI-Enhanced Messaging</h3>
              <p>Every message is automatically reviewed and improved by AI to ensure respectful, constructive communication that puts your children first.</p>
            </div>
            <div className="feature-card featured-card">
              <div className="feature-icon">🌍</div>
              <h3>Universal Translation</h3>
              <p>Communicate seamlessly in 10 languages! Each parent sees messages in their preferred language - breaking down language barriers for global families.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📅</div>
              <h3>Shared Calendar</h3>
              <p>Coordinate schedules, events, and important dates seamlessly. Never miss a school event or appointment again.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3>Responsible Finances</h3>
              <p>Track expenses, share costs transparently, and maintain financial accountability with built-in receipt processing.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📋</div>
              <h3>Records Vault</h3>
              <p>Store and share important documents, photos, and files safely with court-ready document storage featuring cryptographic verification for complete accountability and official proceedings.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👨‍👩‍👧‍👦</div>
              <h3>Child-Focused</h3>
              <p>Every feature is designed to keep your children's wellbeing at the center of your co-parenting relationship.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚖️</div>
              <h3>Legal Protection</h3>
              <p>All communications and documents are securely stored with court-ready verification for official proceedings and complete accountability.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Privacy Protected</h3>
              <p>Your personal information stays private. Only communication relevant to co-parenting is shared between accounts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Create Your Account</h3>
                <p>Sign up with your information and set up your profile. Add details about your children and co-parenting arrangement.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>Invite Your Co-Parent</h3>
                <p>Send an invitation to your co-parent's email. They'll create their own account to complete the connection.</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Start Communicating</h3>
                <p>Begin messaging, sharing calendars, and managing expenses. Our AI ensures all communication stays respectful and productive.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <div className="cta-text">
              <h2>Ready to Transform Your Co-Parenting Relationship?</h2>
              <div className="cta-actions">
                <button 
                  className="cta-btn primary"
                  onClick={() => onNavigate('signup')}
                >
                  Start your 30-day free trial
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <img 
                src="/assets/images/S_logo_transparent.png" 
                alt="SafeSpace Logo" 
                className="footer-s-logo"
              />
              <span className="logo-text">Safespace</span>
            </div>
            <div className="footer-links">
              <a href="/api/documents/Privacy_Policy.pdf" download="Privacy_Policy.pdf">Privacy Policy</a>
              <a href="/api/documents/Terms_of_Service.pdf" download="Terms_of_Service.pdf">Terms of Service</a>
              <a href="#contact" onClick={(e) => { e.preventDefault(); onNavigate('support'); }}>Contact</a>
            </div>
            <div className="footer-text">
              <p>&copy; 2024 Safespace. Making co-parenting communication safer and more respectful.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;