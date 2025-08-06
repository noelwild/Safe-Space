import React, { useState } from 'react';
import './AuthPages.css';

function SignUpPage({ onNavigate, onSignUp }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Information
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    preferredName: '',
    role: '', // Mother or Father
    
    // Other Parent Information
    otherParentName: '',
    otherParentEmail: '',
    otherParentRole: '',
    
    // Children Information
    children: [{ name: '', age: '' }],
    
    // Contact Information
    phoneNumber: '',
    address: '',
    postcode: '',
    emergencyContact: '',
    emergencyPhone: '',
    
    // Subscription Information
    subscriptionType: 'basic', // basic, premium
    paymentMethod: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    billingAddress: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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

  const validateStep = (step) => {
    const newErrors = {};
    
    switch (step) {
      case 1:
        if (!formData.email) newErrors.email = 'Email is required';
        if (!formData.email.includes('@')) newErrors.email = 'Please enter a valid email';
        if (!formData.password) newErrors.password = 'Password is required';
        if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!formData.fullName) newErrors.fullName = 'Full name is required';
        if (!formData.role) newErrors.role = 'Please select your role';
        break;
        
      case 2:
        if (!formData.otherParentName) newErrors.otherParentName = 'Other parent name is required';
        if (!formData.otherParentEmail) newErrors.otherParentEmail = 'Other parent email is required';
        if (!formData.otherParentEmail.includes('@')) newErrors.otherParentEmail = 'Please enter a valid email';
        if (formData.otherParentEmail === formData.email) newErrors.otherParentEmail = 'Cannot be the same as your email';
        if (!formData.otherParentRole) newErrors.otherParentRole = 'Please select other parent role';
        break;
        
      case 3:
        formData.children.forEach((child, index) => {
          if (!child.name) newErrors[`child_${index}_name`] = 'Child name is required';
          if (!child.age) newErrors[`child_${index}_age`] = 'Child age is required';
          if (isNaN(child.age) || child.age < 0 || child.age > 25) {
            newErrors[`child_${index}_age`] = 'Please enter a valid age (0-25)';
          }
        });
        break;
        
      case 4:
        if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
        if (!formData.address) newErrors.address = 'Address is required';
        if (!formData.postcode) newErrors.postcode = 'Postcode is required';
        break;
        
      case 5:
        if (formData.subscriptionType === 'premium') {
          if (!formData.paymentMethod) newErrors.paymentMethod = 'Payment method is required';
          if (formData.paymentMethod === 'card') {
            if (!formData.cardNumber) newErrors.cardNumber = 'Card number is required';
            if (!formData.expiryDate) newErrors.expiryDate = 'Expiry date is required';
            if (!formData.cvv) newErrors.cvv = 'CVV is required';
          }
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Successfully created account
        onSignUp(data.user, data.token);
      } else {
        setErrors({ submit: data.detail || 'Failed to create account' });
      }
    } catch (error) {
      setErrors({ submit: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h2>Create Your Account</h2>
            <p className="step-description">Let's start with your basic information</p>
            
            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={errors.email ? 'error' : ''}
                placeholder="your.email@example.com"
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={errors.password ? 'error' : ''}
                placeholder="At least 8 characters"
              />
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Repeat your password"
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="fullName">Full Name *</label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={errors.fullName ? 'error' : ''}
                placeholder="Your full legal name"
              />
              {errors.fullName && <span className="error-message">{errors.fullName}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="preferredName">Preferred Name (Optional)</label>
              <input
                id="preferredName"
                type="text"
                value={formData.preferredName}
                onChange={(e) => handleInputChange('preferredName', e.target.value)}
                placeholder="What would you like to be called?"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="role">Your Role *</label>
              <select
                id="role"
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className={errors.role ? 'error' : ''}
              >
                <option value="">Select your role</option>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
              </select>
              {errors.role && <span className="error-message">{errors.role}</span>}
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="step-content">
            <h2>Other Parent Information</h2>
            <p className="step-description">Tell us about your co-parent</p>
            
            <div className="form-group">
              <label htmlFor="otherParentName">Other Parent's Full Name *</label>
              <input
                id="otherParentName"
                type="text"
                value={formData.otherParentName}
                onChange={(e) => handleInputChange('otherParentName', e.target.value)}
                className={errors.otherParentName ? 'error' : ''}
                placeholder="Co-parent's full name"
              />
              {errors.otherParentName && <span className="error-message">{errors.otherParentName}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="otherParentEmail">Other Parent's Email *</label>
              <input
                id="otherParentEmail"
                type="email"
                value={formData.otherParentEmail}
                onChange={(e) => handleInputChange('otherParentEmail', e.target.value)}
                className={errors.otherParentEmail ? 'error' : ''}
                placeholder="coparent@example.com"
              />
              {errors.otherParentEmail && <span className="error-message">{errors.otherParentEmail}</span>}
              <small className="form-hint">They will receive an invitation to join Safespace</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="otherParentRole">Other Parent's Role *</label>
              <select
                id="otherParentRole"
                value={formData.otherParentRole}
                onChange={(e) => handleInputChange('otherParentRole', e.target.value)}
                className={errors.otherParentRole ? 'error' : ''}
              >
                <option value="">Select their role</option>
                <option value="Mother">Mother</option>
                <option value="Father">Father</option>
              </select>
              {errors.otherParentRole && <span className="error-message">{errors.otherParentRole}</span>}
            </div>
            
            <div className="privacy-notice">
              <div className="privacy-icon">🔒</div>
              <div className="privacy-text">
                <strong>Privacy Protected:</strong> Your personal information will NOT be shared with the other parent. 
                Only communication relevant to co-parenting will be visible to both parties.
              </div>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="step-content">
            <h2>Your Children</h2>
            <p className="step-description">Add information about your children</p>
            
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
                      value={child.name}
                      onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                      className={errors[`child_${index}_name`] ? 'error' : ''}
                      placeholder="Child's name"
                    />
                    {errors[`child_${index}_name`] && (
                      <span className="error-message">{errors[`child_${index}_name`]}</span>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor={`child_${index}_age`}>Age *</label>
                    <input
                      id={`child_${index}_age`}
                      type="number"
                      min="0"
                      max="25"
                      value={child.age}
                      onChange={(e) => handleChildChange(index, 'age', e.target.value)}
                      className={errors[`child_${index}_age`] ? 'error' : ''}
                      placeholder="Age"
                    />
                    {errors[`child_${index}_age`] && (
                      <span className="error-message">{errors[`child_${index}_age`]}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            <button type="button" className="add-child-btn" onClick={addChild}>
              + Add Another Child
            </button>
          </div>
        );
        
      case 4:
        return (
          <div className="step-content">
            <h2>Contact Information</h2>
            <p className="step-description">How can we reach you?</p>
            
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number *</label>
              <input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className={errors.phoneNumber ? 'error' : ''}
                placeholder="+1 (555) 123-4567"
              />
              {errors.phoneNumber && <span className="error-message">{errors.phoneNumber}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="address">Address *</label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className={errors.address ? 'error' : ''}
                placeholder="Your home address"
                rows={3}
              />
              {errors.address && <span className="error-message">{errors.address}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="postcode">Postcode *</label>
              <input
                id="postcode"
                type="text"
                value={formData.postcode}
                onChange={(e) => handleInputChange('postcode', e.target.value)}
                className={errors.postcode ? 'error' : ''}
                placeholder="12345"
              />
              {errors.postcode && <span className="error-message">{errors.postcode}</span>}
            </div>
            
            <div className="form-group">
              <label htmlFor="emergencyContact">Emergency Contact Name</label>
              <input
                id="emergencyContact"
                type="text"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                placeholder="Emergency contact person"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="emergencyPhone">Emergency Contact Phone</label>
              <input
                id="emergencyPhone"
                type="tel"
                value={formData.emergencyPhone}
                onChange={(e) => handleInputChange('emergencyPhone', e.target.value)}
                placeholder="+1 (555) 987-6543"
              />
            </div>
          </div>
        );
        
      case 5:
        return (
          <div className="step-content">
            <h2>Subscription & Payment</h2>
            <p className="step-description">Choose your plan</p>
            
            <div className="subscription-options">
              <div 
                className={`subscription-card ${formData.subscriptionType === 'basic' ? 'selected' : ''}`}
                onClick={() => handleInputChange('subscriptionType', 'basic')}
              >
                <h3>Basic Plan</h3>
                <div className="price">Free for 30 days</div>
                <div className="price-after">Then $19.99/month</div>
                <ul>
                  <li>✓ Messages</li>
                  <li>✓ Max 1x5min call per day</li>
                  <li>✓ Calendar</li>
                  <li>✓ Basic support</li>
                </ul>
              </div>
              
              <div 
                className={`subscription-card ${formData.subscriptionType === 'premium' ? 'selected' : ''}`}
                onClick={() => handleInputChange('subscriptionType', 'premium')}
              >
                <div className="popular-badge">Most Popular</div>
                <h3>Premium Plan</h3>
                <div className="price">Free for 30 days</div>
                <div className="price-after">Then $29.99/month</div>
                <ul>
                  <li>✓ Everything in Basic</li>
                  <li>✓ Unlimited calling</li>
                  <li>✓ Records Vault</li>
                  <li>✓ Personal journal</li>
                  <li>✓ Advanced features</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>
            </div>
            
            {formData.subscriptionType === 'premium' && (
              <div className="payment-section">
                <h3>Payment Information</h3>
                <p className="payment-note">You won't be charged during your 30-day free trial</p>
                
                <div className="form-group">
                  <label htmlFor="paymentMethod">Payment Method *</label>
                  <select
                    id="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className={errors.paymentMethod ? 'error' : ''}
                  >
                    <option value="">Select payment method</option>
                    <option value="card">Credit/Debit Card</option>
                    <option value="paypal">PayPal</option>
                  </select>
                  {errors.paymentMethod && <span className="error-message">{errors.paymentMethod}</span>}
                </div>
                
                {formData.paymentMethod === 'card' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="cardNumber">Card Number *</label>
                      <input
                        id="cardNumber"
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                        className={errors.cardNumber ? 'error' : ''}
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                      />
                      {errors.cardNumber && <span className="error-message">{errors.cardNumber}</span>}
                    </div>
                    
                    <div className="card-details">
                      <div className="form-group">
                        <label htmlFor="expiryDate">Expiry Date *</label>
                        <input
                          id="expiryDate"
                          type="text"
                          value={formData.expiryDate}
                          onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                          className={errors.expiryDate ? 'error' : ''}
                          placeholder="MM/YY"
                          maxLength={5}
                        />
                        {errors.expiryDate && <span className="error-message">{errors.expiryDate}</span>}
                      </div>
                      
                      <div className="form-group">
                        <label htmlFor="cvv">CVV *</label>
                        <input
                          id="cvv"
                          type="text"
                          value={formData.cvv}
                          onChange={(e) => handleInputChange('cvv', e.target.value)}
                          className={errors.cvv ? 'error' : ''}
                          placeholder="123"
                          maxLength={4}
                        />
                        {errors.cvv && <span className="error-message">{errors.cvv}</span>}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="terms-section">
              <label className="checkbox-group">
                <input type="checkbox" required />
                <span className="checkmark"></span>
                I agree to the <a href="#terms" target="_blank">Terms of Service</a> and <a href="#privacy" target="_blank">Privacy Policy</a>
              </label>
            </div>
            
            {errors.submit && (
              <div className="error-message submit-error">{errors.submit}</div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
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
          <div className="progress-bar">
            <div className="progress-steps">
              {[1, 2, 3, 4, 5].map(step => (
                <div 
                  key={step}
                  className={`progress-step ${currentStep >= step ? 'completed' : ''} ${currentStep === step ? 'active' : ''}`}
                >
                  <div className="step-circle">{step}</div>
                  <div className="step-label">
                    {step === 1 && 'Account'}
                    {step === 2 && 'Co-Parent'}
                    {step === 3 && 'Children'}
                    {step === 4 && 'Contact'}
                    {step === 5 && 'Payment'}
                  </div>
                </div>
              ))}
            </div>
            <div 
              className="progress-fill"
              style={{ width: `${(currentStep - 1) * 25}%` }}
            ></div>
          </div>
          
          <div className="form-container">
            {renderStep()}
            
            <div className="form-actions">
              {currentStep > 1 && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={prevStep}
                >
                  Previous
                </button>
              )}
              
              {currentStep < 5 ? (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={nextStep}
                >
                  Next
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="auth-footer">
          <p>Already have an account? <button className="link-btn" onClick={() => onNavigate('signin')}>Sign In</button></p>
        </div>
      </div>
    </div>
  );
}

export default SignUpPage;