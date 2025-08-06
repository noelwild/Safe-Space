import React, { useState, useEffect } from 'react';
import './AccountSettings.css';

function AccountSettings({ currentUser, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
  // Personal Information
    fullName: '',
    preferredName: '',
    email: '',
    phoneNumber: '',
    countryCode: '+61', // Default to Australia
    address: '',
    postcode: '',
    emergencyContact: '',
    emergencyPhone: '',
    
    // Language Preference
    languageCode: 'en',
    
    // Password Change
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    
    // Other Parent Information
    otherParentName: '',
    otherParentEmail: '',
    otherParentRole: '',
    
    // Children Information
    children: [],
    
    // Subscription Information
    subscriptionType: 'basic',
    paymentMethod: '',
    cardLastFour: '',
    
    // Notification Preferences
    emailNotifications: true,
    pushNotifications: true,
    messageNotifications: true,
    calendarNotifications: true,
    paymentNotifications: true
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState([]);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);

  // Country codes for phone number dropdown
  const countryCodes = [
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+1', country: 'United States', flag: '🇺🇸' },
    { code: '+1', country: 'Canada', flag: '🇨🇦' },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+55', country: 'Brazil', flag: '🇧🇷' }
  ];

  // Load supported languages
  const loadSupportedLanguages = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/languages`);
      if (response.ok) {
        const data = await response.json();
        setSupportedLanguages(data.languages);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  // Update user language preference
  const updateUserLanguage = async (languageCode) => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/${currentUser?.id || 1}/language`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          language_code: languageCode
        })
      });
      
      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          languageCode: languageCode
        }));
        setSuccessMessage('Language preference updated successfully! All messages will now be displayed in your chosen language.');
      } else {
        const data = await response.json();
        setErrors({ submit: data.detail || 'Failed to update language preference' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Load user profile data on component mount
  useEffect(() => {
    // Load supported languages
    loadSupportedLanguages();
    
    // Load subscription information
    loadSubscriptionInfo();
    
    // If currentUser is provided, use it to populate the form
    if (currentUser) {
      setFormData(prevData => ({
        ...prevData,
        fullName: currentUser.fullName || '',
        preferredName: currentUser.preferredName || '',
        email: currentUser.email || '',
        phoneNumber: currentUser.phoneNumber || '',
        countryCode: currentUser.countryCode || '+61',
        address: currentUser.address || '',
        postcode: currentUser.postcode || '',
        emergencyContact: currentUser.emergencyContact || '',
        emergencyPhone: currentUser.emergencyPhone || '',
        subscriptionType: currentUser.subscriptionType || 'basic',
        paymentMethod: currentUser.paymentMethod || '',
        cardLastFour: currentUser.cardLastFour || '',
        otherParentName: currentUser.otherParentName || '',
        otherParentEmail: currentUser.otherParentEmail || '',
        otherParentRole: currentUser.otherParentRole || '',
        children: currentUser.children || [],
        emailNotifications: currentUser.emailNotifications ?? true,
        pushNotifications: currentUser.pushNotifications ?? true,
        messageNotifications: currentUser.messageNotifications ?? true,
        calendarNotifications: currentUser.calendarNotifications ?? true,
        paymentNotifications: currentUser.paymentNotifications ?? true
      }));
    } else {
      // Fallback to loading from API if no currentUser provided
      loadUserProfile();
    }
  }, [currentUser]);

  const loadUserProfile = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setFormData(prevData => ({
          ...prevData,
          ...userData
        }));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

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
    
    // Clear success message when user makes changes
    if (successMessage) {
      setSuccessMessage('');
    }
  };

  const handleChildChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      children: prev.children.map((child, i) => 
        i === index ? { ...child, [field]: value } : child
      )
    }));
  };

  const addChild = () => {
    setFormData(prev => ({
      ...prev,
      children: [...prev.children, { name: '', age: '' }]
    }));
  };

  const removeChild = (index) => {
    if (formData.children.length > 1) {
      setFormData(prev => ({
        ...prev,
        children: prev.children.filter((_, i) => i !== index)
      }));
    }
  };

  const validateProfile = () => {
    const newErrors = {};
    
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.email.includes('@')) newErrors.email = 'Please enter a valid email';
    if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.address) newErrors.address = 'Address is required';
    if (!formData.postcode) newErrors.postcode = 'Postcode is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors = {};
    
    if (!formData.currentPassword) newErrors.currentPassword = 'Current password is required';
    if (!formData.newPassword) newErrors.newPassword = 'New password is required';
    if (formData.newPassword.length < 8) newErrors.newPassword = 'Password must be at least 8 characters';
    if (formData.newPassword !== formData.confirmNewPassword) {
      newErrors.confirmNewPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateChildren = () => {
    const newErrors = {};
    
    formData.children.forEach((child, index) => {
      if (!child.name) newErrors[`child_${index}_name`] = 'Child name is required';
      if (!child.age) newErrors[`child_${index}_age`] = 'Child age is required';
      if (isNaN(child.age) || child.age < 0 || child.age > 25) {
        newErrors[`child_${index}_age`] = 'Please enter a valid age (0-25)';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!validateProfile()) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          preferredName: formData.preferredName,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          address: formData.address,
          postcode: formData.postcode,
          emergencyContact: formData.emergencyContact,
          emergencyPhone: formData.emergencyPhone
        })
      });
      
      if (response.ok) {
        setSuccessMessage('Profile updated successfully!');
        if (onUpdateUser) {
          onUpdateUser(formData);
        }
      } else {
        const data = await response.json();
        setErrors({ submit: data.detail || 'Failed to update profile' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (!validatePassword()) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      });
      
      if (response.ok) {
        setSuccessMessage('Password changed successfully!');
        setFormData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        }));
      } else {
        const data = await response.json();
        setErrors({ submit: data.detail || 'Failed to change password' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveChildren = async () => {
    if (!validateChildren()) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/children`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          children: formData.children
        })
      });
      
      if (response.ok) {
        setSuccessMessage('Children information updated successfully!');
      } else {
        const data = await response.json();
        setErrors({ submit: data.detail || 'Failed to update children information' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const saveNotifications = async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/notifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          emailNotifications: formData.emailNotifications,
          pushNotifications: formData.pushNotifications,
          messageNotifications: formData.messageNotifications,
          calendarNotifications: formData.calendarNotifications,
          paymentNotifications: formData.paymentNotifications
        })
      });
      
      if (response.ok) {
        setSuccessMessage('Notification preferences updated successfully!');
      } else {
        const data = await response.json();
        setErrors({ submit: data.detail || 'Failed to update notification preferences' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscriptionInfo = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/subscription`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSubscriptionInfo(data);
        setFormData(prev => ({
          ...prev,
          subscriptionType: data.current_subscription
        }));
      }
    } catch (error) {
      console.error('Error loading subscription info:', error);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/subscription/unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (response.ok) {
        setSuccessMessage('Successfully unsubscribed. Downgraded to Basic plan.');
        setShowUnsubscribeModal(false);
        loadSubscriptionInfo(); // Reload subscription info
      } else {
        const data = await response.json();
        setErrors({ unsubscribe: data.detail || 'Error unsubscribing' });
      }
    } catch (error) {
      setErrors({ unsubscribe: 'Network error. Please try again.' });
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦' },
    { id: 'subscription', label: 'Subscription', icon: '💳' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' }
  ];

  return (
    <div className="account-settings">
      <div className="settings-header">
        <h1>⚙️ Account Settings</h1>
        <p>Manage your profile, security, and preferences</p>
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="settings-content">
          {successMessage && (
            <div className="success-message">
              ✅ {successMessage}
            </div>
          )}

          {errors.submit && (
            <div className="error-message">
              ❌ {errors.submit}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="settings-section">
              <h2>Personal Information</h2>
              <p className="section-description">Update your personal details and contact information</p>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name *</label>
                  <input
                    id="fullName"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className={errors.fullName ? 'error' : ''}
                  />
                  {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="preferredName">Preferred Name</label>
                  <input
                    id="preferredName"
                    type="text"
                    value={formData.preferredName}
                    onChange={(e) => handleInputChange('preferredName', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={errors.email ? 'error' : ''}
                  />
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="phoneNumber">Phone Number *</label>
                  <div className="phone-input-container">
                    <select
                      value={formData.countryCode}
                      onChange={(e) => handleInputChange('countryCode', e.target.value)}
                      className="country-code-select"
                    >
                      {countryCodes.map(country => (
                        <option key={`${country.code}-${country.country}`} value={country.code}>
                          {country.flag} {country.code} {country.country}
                        </option>
                      ))}
                    </select>
                    <input
                      id="phoneNumber"
                      type="tel"
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      className={errors.phoneNumber ? 'error' : ''}
                      placeholder="Phone number"
                    />
                  </div>
                  {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                </div>

                <div className="form-group full-width">
                  <label htmlFor="address">Address *</label>
                  <textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className={errors.address ? 'error' : ''}
                    rows={3}
                  />
                  {errors.address && <span className="error-text">{errors.address}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="postcode">Postcode *</label>
                  <input
                    id="postcode"
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => handleInputChange('postcode', e.target.value)}
                    className={errors.postcode ? 'error' : ''}
                  />
                  {errors.postcode && <span className="error-text">{errors.postcode}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="emergencyContact">Emergency Contact</label>
                  <input
                    id="emergencyContact"
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="emergencyPhone">Emergency Phone</label>
                  <input
                    id="emergencyPhone"
                    type="tel"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                  />
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn btn-primary"
                  onClick={saveProfile}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>

              {/* Language Preference Section */}
              <div className="settings-subsection">
                <h3>🌍 Language Preference</h3>
                <p className="section-description">
                  Choose your preferred language. All messages will be displayed in your selected language, 
                  regardless of the original language they were written in.
                </p>

                <div className="language-selection">
                  <div className="current-language">
                    <label>Current Language:</label>
                    <div className="language-display">
                      {supportedLanguages.find(lang => lang.code === formData.languageCode)?.native || 'English'}
                      <span className="language-english">
                        ({supportedLanguages.find(lang => lang.code === formData.languageCode)?.name || 'English'})
                      </span>
                    </div>
                  </div>

                  <div className="language-grid">
                    {supportedLanguages.map(lang => (
                      <div 
                        key={lang.code}
                        className={`language-option ${formData.languageCode === lang.code ? 'selected' : ''}`}
                        onClick={() => updateUserLanguage(lang.code)}
                      >
                        <div className="language-native">{lang.native}</div>
                        <div className="language-english">{lang.name}</div>
                        {formData.languageCode === lang.code && (
                          <div className="selected-indicator">✓</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="language-info">
                    <div className="info-box">
                      <strong>How it works:</strong>
                      <ul>
                        <li>All messages you send and receive will be displayed in your chosen language</li>
                        <li>AI safety processing will also respond in your language</li>
                        <li>The other parent can choose their own language independently</li>
                        <li>This ensures clear communication regardless of language barriers</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>Security Settings</h2>
              <p className="section-description">Change your password and manage account security</p>

              <div className="form-grid security-grid">
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password *</label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                    className={errors.currentPassword ? 'error' : ''}
                  />
                  {errors.currentPassword && <span className="error-text">{errors.currentPassword}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password *</label>
                  <input
                    id="newPassword"
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => handleInputChange('newPassword', e.target.value)}
                    className={errors.newPassword ? 'error' : ''}
                  />
                  {errors.newPassword && <span className="error-text">{errors.newPassword}</span>}
                  <small className="form-hint">At least 8 characters</small>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword">Confirm New Password *</label>
                  <input
                    id="confirmNewPassword"
                    type="password"
                    value={formData.confirmNewPassword}
                    onChange={(e) => handleInputChange('confirmNewPassword', e.target.value)}
                    className={errors.confirmNewPassword ? 'error' : ''}
                  />
                  {errors.confirmNewPassword && <span className="error-text">{errors.confirmNewPassword}</span>}
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn btn-primary"
                  onClick={changePassword}
                  disabled={isLoading}
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'family' && (
            <div className="settings-section">
              <h2>Family Information</h2>
              <p className="section-description">Manage information about your children and co-parent</p>

              <div className="subsection">
                <h3>Other Parent</h3>
                <div className="other-parent-info">
                  <div className="info-item">
                    <label>Name:</label>
                    <span>{formData.otherParentName || 'Not set'}</span>
                  </div>
                  <div className="info-item">
                    <label>Email:</label>
                    <span>{formData.otherParentEmail || 'Not set'}</span>
                  </div>
                  <div className="info-item">
                    <label>Role:</label>
                    <span>{formData.otherParentRole || 'Not set'}</span>
                  </div>
                </div>
                <p className="info-note">
                  🔒 Other parent information can only be changed by contacting support for security reasons.
                </p>
              </div>

              <div className="subsection">
                <h3>Children</h3>
                {formData.children && formData.children.length > 0 ? (
                  <>
                    {formData.children.map((child, index) => (
                      <div key={index} className="child-group">
                        <div className="child-header">
                          <h4>Child {index + 1}</h4>
                          {formData.children.length > 1 && (
                            <button 
                              type="button" 
                              className="remove-child-btn"
                              onClick={() => removeChild(index)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        
                        <div className="child-fields">
                          <div className="form-group">
                            <label htmlFor={`child_${index}_name`}>Name *</label>
                            <input
                              id={`child_${index}_name`}
                              type="text"
                              value={child.name || ''}
                              onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                              className={errors[`child_${index}_name`] ? 'error' : ''}
                            />
                            {errors[`child_${index}_name`] && (
                              <span className="error-text">{errors[`child_${index}_name`]}</span>
                            )}
                          </div>
                          
                          <div className="form-group">
                            <label htmlFor={`child_${index}_age`}>Age *</label>
                            <input
                              id={`child_${index}_age`}
                              type="number"
                              min="0"
                              max="25"
                              value={child.age || ''}
                              onChange={(e) => handleChildChange(index, 'age', e.target.value)}
                              className={errors[`child_${index}_age`] ? 'error' : ''}
                            />
                            {errors[`child_${index}_age`] && (
                              <span className="error-text">{errors[`child_${index}_age`]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button type="button" className="add-child-btn" onClick={addChild}>
                      + Add Another Child
                    </button>
                  </>
                ) : (
                  <div className="no-children">
                    <p>No children added yet.</p>
                    <button type="button" className="add-child-btn" onClick={addChild}>
                      + Add Child
                    </button>
                  </div>
                )}
              </div>

              <div className="section-actions">
                <button 
                  className="btn btn-primary"
                  onClick={saveChildren}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Children Information'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="settings-section">
              <h2>Subscription & Billing</h2>
              <p className="section-description">Manage your subscription and payment methods</p>

              {/* Current Subscription Status */}
              <div className="subscription-status">
                <h3>Current Subscription</h3>
                {subscriptionInfo && (
                  <div className="subscription-info">
                    <div className="current-plan-details">
                      <h4>{subscriptionInfo.subscription_details.name}</h4>
                      <p className="plan-price">
                        ${subscriptionInfo.subscription_details.price}/month
                      </p>
                      {subscriptionInfo.is_trial && (
                        <div className="trial-badge">
                          {subscriptionInfo.trial_days_remaining} days remaining in free trial
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Subscription Plans */}
              <div className="subscription-plans">
                <h3>Available Plans</h3>
                <div className="plans-comparison">
                  <div className={`plan-card ${formData.subscriptionType === 'basic' ? 'active' : ''}`}>
                    <div className="plan-header">
                      <div className="plan-checkbox">
                        {formData.subscriptionType === 'basic' && <span className="checkmark">✓</span>}
                      </div>
                      <div className="plan-info">
                        <h4>Basic Plan</h4>
                        <p className="plan-price">$19.99/month</p>
                      </div>
                    </div>
                    <ul className="plan-features">
                      <li>✓ Messages</li>
                      <li>✓ Max 1x5min call per day</li>
                      <li>✓ Calendar</li>
                      <li>✓ Basic support</li>
                    </ul>
                  </div>

                  <div className={`plan-card ${formData.subscriptionType === 'premium' ? 'active' : ''}`}>
                    <div className="plan-header">
                      <div className="plan-checkbox">
                        {formData.subscriptionType === 'premium' && <span className="checkmark">✓</span>}
                      </div>
                      <div className="plan-info">
                        <h4>Premium Plan</h4>
                        <p className="plan-price">$29.99/month</p>
                      </div>
                    </div>
                    <ul className="plan-features">
                      <li>✓ Everything in Basic</li>
                      <li>✓ Unlimited calling</li>
                      <li>✓ Records Vault</li>
                      <li>✓ Personal journal</li>
                      <li>✓ Advanced features</li>
                      <li>✓ Priority support</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div className="payment-method">
                <h3>Payment Method</h3>
                <div className="payment-card">
                  <div className="payment-info">
                    <div className="card-icon">💳</div>
                    <div className="card-details">
                      <p>{formData.paymentMethod || 'No payment method on file'}</p>
                      {formData.cardLastFour && (
                        <span className="card-number">**** **** **** {formData.cardLastFour}</span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-secondary">Update Payment Method</button>
                </div>
              </div>

              {/* Subscription Actions */}
              <div className="subscription-actions">
                {formData.subscriptionType !== 'basic' && (
                  <button 
                    className="btn btn-danger unsubscribe-btn"
                    onClick={() => setShowUnsubscribeModal(true)}
                  >
                    Unsubscribe
                  </button>
                )}
                {formData.subscriptionType === 'basic' && (
                  <button className="btn btn-primary">
                    Upgrade to Premium
                  </button>
                )}
              </div>

              {errors.unsubscribe && (
                <div className="error-message">{errors.unsubscribe}</div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h2>Notification Preferences</h2>
              <p className="section-description">Choose how you want to receive notifications</p>

              <div className="notification-groups">
                <div className="notification-group">
                  <h3>General Notifications</h3>
                  
                  <div className="notification-item">
                    <div className="notification-info">
                      <label>Email Notifications</label>
                      <p>Receive notifications via email</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={formData.emailNotifications}
                        onChange={(e) => handleInputChange('emailNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="notification-item">
                    <div className="notification-info">
                      <label>Push Notifications</label>
                      <p>Receive push notifications in your browser</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={formData.pushNotifications}
                        onChange={(e) => handleInputChange('pushNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>

                <div className="notification-group">
                  <h3>Activity Notifications</h3>
                  
                  <div className="notification-item">
                    <div className="notification-info">
                      <label>New Messages</label>
                      <p>Get notified when you receive new messages</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={formData.messageNotifications}
                        onChange={(e) => handleInputChange('messageNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="notification-item">
                    <div className="notification-info">
                      <label>Calendar Events</label>
                      <p>Reminders for upcoming calendar events</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={formData.calendarNotifications}
                        onChange={(e) => handleInputChange('calendarNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="notification-item">
                    <div className="notification-info">
                      <label>Payment Updates</label>
                      <p>Notifications about payments and expenses</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={formData.paymentNotifications}
                        onChange={(e) => handleInputChange('paymentNotifications', e.target.checked)}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="section-actions">
                <button 
                  className="btn btn-primary"
                  onClick={saveNotifications}
                  disabled={isLoading}
                >
                  {isLoading ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unsubscribe Confirmation Modal */}
      {showUnsubscribeModal && (
        <div className="modal-overlay" onClick={() => setShowUnsubscribeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirm Unsubscribe</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUnsubscribeModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to unsubscribe from your current plan?</p>
              <p><strong>This will:</strong></p>
              <ul>
                <li>Downgrade your account to the Basic plan</li>
                <li>Remove access to premium features</li>
                <li>Take effect immediately</li>
              </ul>
              <p>You can resubscribe at any time.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowUnsubscribeModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleUnsubscribe}
              >
                Confirm Unsubscribe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountSettings;