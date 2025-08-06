import React, { useState, useEffect } from 'react';
import './AccountablePayments.css';

function AccountablePayments({ currentUser }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [payments, setPayments] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Sorting and filtering states
  const [sortBy, setSortBy] = useState('date'); // date, amount, type
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterBy, setFilterBy] = useState('all'); // all, expense, request, reimbursement
  const [filteredPayments, setFilteredPayments] = useState([]);
  
  // Form states
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showReceiptUploadModal, setShowReceiptUploadModal] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  
  // Payment form with clearer payment types
  const [paymentForm, setPaymentForm] = useState({
    payment_type: 'expense', // expense, request, reimbursement
    category: 'other',
    amount: '',
    description: '',
    payment_method: '',
    merchant: '',
    payment_date: '',
    notes: '',
    created_by: currentUser?.name || 'Unknown User'
  });
  
  // Receipt upload form
  const [receiptForm, setReceiptForm] = useState({
    file: null,
    category: 'other',
    amount: '',
    description: '',
    notes: '',
    created_by: currentUser?.name || 'Unknown User'
  });
  
  // Suggestion form
  const [suggestionForm, setSuggestionForm] = useState({
    suggested_to: '',
    suggested_amount: '',
    reason: '',
    created_by: currentUser?.name || 'Unknown User'
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, suggestionsRes, categoriesRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/suggestions`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/categories`)
      ]);
      
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
      }
      
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        setSuggestions(suggestionsData);
      }
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error loading payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getCategoryIcon = (category) => {
    const icons = {
      child_support: '👶',
      medical: '🏥',
      education: '🎓',
      food: '🍽️',
      clothing: '👕',
      activities: '⚽',
      transportation: '🚗',
      housing: '🏠',
      utilities: '💡',
      legal: '⚖️',
      childcare: '🧸',
      extracurricular: '🎨',
      school_supplies: '📚',
      toys_entertainment: '🎮',
      other: '📋'
    };
    return icons[category] || '📋';
  };

  const getCategoryLabel = (category) => {
    return category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Sorting and filtering functions
  const sortPayments = (paymentsToSort, sortField, order) => {
    return [...paymentsToSort].sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'date':
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case 'amount':
          aValue = parseFloat(a.amount);
          bValue = parseFloat(b.amount);
          break;
        case 'type':
          aValue = a.payment_type || a.type;
          bValue = b.payment_type || b.type;
          break;
        default:
          return 0;
      }
      
      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  };

  const filterPayments = (paymentsToFilter) => {
    if (filterBy === 'all') return paymentsToFilter;
    return paymentsToFilter.filter(payment => 
      (payment.payment_type || payment.type) === filterBy
    );
  };

  const applyFiltersAndSort = () => {
    let processed = filterPayments(payments);
    processed = sortPayments(processed, sortBy, sortOrder);
    setFilteredPayments(processed);
  };

  // Apply filters when payments or filter criteria change
  useEffect(() => {
    applyFiltersAndSort();
  }, [payments, sortBy, sortOrder, filterBy]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getPaymentTypeLabel = (type) => {
    switch (type) {
      case 'expense':
        return '💳 I Paid (Expense)';
      case 'request':
        return '💰 Requesting Money';
      case 'reimbursement':
        return '🔄 Reimbursement';
      default:
        return '📋 Other';
    }
  };

  const getPaymentTypeDescription = (type) => {
    switch (type) {
      case 'expense':
        return 'Record a payment you made (with proof)';
      case 'request':
        return 'Request money from the other parent';
      case 'reimbursement':
        return 'Request reimbursement for shared expenses';
      default:
        return 'Other payment type';
    }
  };

  // Form handlers
  const handleAddPayment = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentForm)
      });

      if (response.ok) {
        setSuccess('Payment added successfully!');
        setShowAddPaymentModal(false);
        resetPaymentForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error adding payment');
      }
    } catch (error) {
      console.error('Error adding payment:', error);
      setError('Error adding payment');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReceipt = async () => {
    try {
      if (!receiptForm.file) {
        setError('Please select a file to upload');
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('file', receiptForm.file);
      formData.append('category', receiptForm.category);
      formData.append('amount', receiptForm.amount || '0');
      formData.append('description', receiptForm.description);
      formData.append('notes', receiptForm.notes);
      formData.append('created_by', receiptForm.created_by);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/upload-receipt`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Receipt uploaded successfully! ${result.ocr_success ? 'Receipt details extracted automatically.' : ''}`);
        setShowReceiptUploadModal(false);
        resetReceiptForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error uploading receipt');
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      setError('Error uploading receipt');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuggestion = async () => {
    try {
      if (!selectedPayment) return;

      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/${selectedPayment.id}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(suggestionForm)
      });

      if (response.ok) {
        setSuccess('Payment suggestion sent successfully!');
        setShowSuggestionModal(false);
        resetSuggestionForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error creating suggestion');
      }
    } catch (error) {
      console.error('Error creating suggestion:', error);
      setError('Error creating suggestion');
    } finally {
      setLoading(false);
    }
  };

  const handleRespondToSuggestion = async (suggestionId, status, proofFile = null) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('status', status);
      formData.append('responded_by', currentUser?.name || 'Unknown User');
      if (proofFile) {
        formData.append('file', proofFile);
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/payments/suggestions/${suggestionId}/respond`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setSuccess(`Suggestion ${status} successfully!`);
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error responding to suggestion');
      }
    } catch (error) {
      console.error('Error responding to suggestion:', error);
      setError('Error responding to suggestion');
    } finally {
      setLoading(false);
    }
  };

  // Reset forms
  const resetPaymentForm = () => {
    setPaymentForm({
      category: 'other',
      amount: '',
      description: '',
      payment_method: '',
      merchant: '',
      payment_date: '',
      notes: '',
      created_by: currentUser?.name || 'Unknown User'
    });
  };

  const resetReceiptForm = () => {
    setReceiptForm({
      file: null,
      category: 'other',
      amount: '',
      description: '',
      notes: '',
      created_by: currentUser?.name || 'Unknown User'
    });
  };

  const resetSuggestionForm = () => {
    setSuggestionForm({
      suggested_to: '',
      suggested_amount: '',
      reason: '',
      created_by: currentUser?.name || 'Unknown User'
    });
    setSelectedPayment(null);
  };

  // Calculate statistics
  const getStatistics = () => {
    const totalPaid = payments
      .filter(p => p.created_by === currentUser?.name)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    const totalSuggested = suggestions
      .filter(s => s.created_by === currentUser?.name && s.status === 'pending')
      .reduce((sum, s) => sum + (s.suggested_amount || 0), 0);
    
    const reimbursements = suggestions
      .filter(s => s.suggested_to === currentUser?.name && s.status === 'approved')
      .reduce((sum, s) => sum + (s.suggested_amount || 0), 0);

    return { totalPaid, totalSuggested, reimbursements };
  };

  const stats = getStatistics();

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="accountable-payments">
      <div className="payments-header">
        <div className="payments-title">
          <h2>💳 Responsible Finances</h2>
          <p>Track child support, shared expenses, and payment history with proof</p>
        </div>
        
        <div className="payments-actions">
          <button 
            className="action-btn primary"
            onClick={() => setShowReceiptUploadModal(true)}
          >
            📷 Upload Receipt
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => setShowAddPaymentModal(true)}
          >
            ➕ Add Payment
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <h3>{formatCurrency(stats.totalPaid)}</h3>
            <p>Total Paid by You</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📤</div>
          <div className="stat-content">
            <h3>{formatCurrency(stats.totalSuggested)}</h3>
            <p>Pending Suggestions</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📥</div>
          <div className="stat-content">
            <h3>{formatCurrency(stats.reimbursements)}</h3>
            <p>Approved Reimbursements</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="payments-tabs">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => setActiveTab('payments')}
        >
          💳 Payments
        </button>
        <button 
          className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suggestions')}
        >
          💡 Suggestions
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          ❌ {error}
        </div>
      )}
      
      {success && (
        <div className="message success">
          ✅ {success}
        </div>
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            <div className="recent-payments">
              <h3>Recent Payments</h3>
              <div className="payments-list">
                {payments.slice(0, 5).map(payment => (
                  <div key={payment.id} className="payment-item">
                    <div className="payment-icon">
                      {getCategoryIcon(payment.category)}
                    </div>
                    <div className="payment-details">
                      <h4>{payment.description || getCategoryLabel(payment.category)}</h4>
                      <p>{payment.merchant && `${payment.merchant} • `}{formatDate(payment.date)}</p>
                      {payment.receipt_summary && (
                        <div className="receipt-summary">
                          <small>📄 Receipt details available</small>
                        </div>
                      )}
                    </div>
                    <div className="payment-amount">
                      {formatCurrency(payment.amount)}
                    </div>
                    <div className="payment-actions">
                      <button 
                        className="suggest-btn"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowSuggestionModal(true);
                        }}
                      >
                        💡
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="payments-content">
            {/* Sorting and Filtering Controls */}
            <div className="payments-controls">
              <div className="controls-group">
                <label>Sort by:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="control-select"
                >
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="type">Type</option>
                </select>
                
                <button 
                  className="sort-order-btn"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
              
              <div className="controls-group">
                <label>Filter by type:</label>
                <select 
                  value={filterBy} 
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="control-select"
                >
                  <option value="all">All Types</option>
                  <option value="expense">I Paid (Expenses)</option>
                  <option value="request">Money Requests</option>
                  <option value="reimbursement">Reimbursements</option>
                </select>
              </div>
              
              <div className="controls-group">
                <span className="results-count">
                  {filteredPayments.length} of {payments.length} payments
                </span>
              </div>
            </div>
            
            <div className="payments-list">
              {filteredPayments.map(payment => (
                <div key={payment.id} className="payment-card">
                  <div className="payment-header">
                    <div className="payment-type-badge">
                      {getPaymentTypeLabel(payment.payment_type || payment.type)}
                    </div>
                    <div className="payment-amount">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                  
                  <div className="payment-body">
                    <div className="payment-category">
                      <span className="category-icon">{getCategoryIcon(payment.category)}</span>
                      <span className="category-name">{getCategoryLabel(payment.category)}</span>
                    </div>
                    
                    <h4 className="payment-description">
                      {payment.description || 'No description provided'}
                    </h4>
                    
                    {payment.merchant && (
                      <p className="payment-merchant">
                        <strong>Merchant:</strong> {payment.merchant}
                      </p>
                    )}
                    
                    <div className="payment-meta">
                      <span className="payment-date">
                        📅 {formatDate(payment.date)}
                      </span>
                      <span className="payment-creator">
                        👤 {payment.created_by}
                      </span>
                    </div>
                    
                    {payment.notes && (
                      <div className="payment-notes">
                        <strong>Notes:</strong> {payment.notes}
                      </div>
                    )}
                    
                    {payment.receipt_summary && (
                      <div className="receipt-summary">
                        <strong>📄 Receipt Details:</strong>
                        <p>{payment.receipt_summary}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="payment-actions">
                    <button 
                      className="suggest-btn"
                      onClick={() => {
                        setSelectedPayment(payment);
                        setShowSuggestionModal(true);
                      }}
                      title="Suggest reimbursement"
                    >
                      💡 Suggest
                    </button>
                  </div>
                </div>
              ))}
              
              {filteredPayments.length === 0 && (
                <div className="no-payments">
                  <p>No payments found matching your filters.</p>
                  <button 
                    className="clear-filters-btn"
                    onClick={() => {
                      setSortBy('date');
                      setSortOrder('desc');
                      setFilterBy('all');
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="suggestions-content">
            <div className="suggestions-list">
              {suggestions.map(suggestion => (
                <div key={suggestion.id} className="suggestion-card">
                  <div className="suggestion-header">
                    <div className="suggestion-status">
                      <span className={`status-badge ${suggestion.status}`}>
                        {suggestion.status}
                      </span>
                    </div>
                    <div className="suggestion-amount">
                      {formatCurrency(suggestion.suggested_amount)}
                    </div>
                  </div>
                  
                  <div className="suggestion-body">
                    <h4>Payment Suggestion</h4>
                    <p><strong>Original Payment:</strong> {suggestion.original_description}</p>
                    <p><strong>Original Amount:</strong> {formatCurrency(suggestion.original_amount)}</p>
                    <p><strong>Suggested To:</strong> {suggestion.suggested_to}</p>
                    <p><strong>Reason:</strong> {suggestion.reason}</p>
                  </div>
                  
                  <div className="suggestion-footer">
                    <span className="suggestion-date">
                      Created {formatDate(suggestion.created_date)} by {suggestion.created_by}
                    </span>
                    
                    {suggestion.status === 'pending' && suggestion.suggested_to === currentUser?.name && (
                      <div className="suggestion-actions">
                        <button 
                          className="approve-btn"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'approved')}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => handleRespondToSuggestion(suggestion.id, 'rejected')}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {showAddPaymentModal && (
        <div className="modal-overlay" onClick={() => setShowAddPaymentModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Payment</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAddPaymentModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-type-selection">
                <h4>What type of entry is this?</h4>
                <div className="payment-type-options">
                  <div 
                    className={`payment-type-option ${paymentForm.payment_type === 'expense' ? 'selected' : ''}`}
                    onClick={() => setPaymentForm({...paymentForm, payment_type: 'expense'})}
                  >
                    <div className="option-icon">💳</div>
                    <div className="option-content">
                      <h5>I Paid (Expense)</h5>
                      <p>Record a payment you made with proof/receipt</p>
                    </div>
                  </div>
                  
                  <div 
                    className={`payment-type-option ${paymentForm.payment_type === 'request' ? 'selected' : ''}`}
                    onClick={() => setPaymentForm({...paymentForm, payment_type: 'request'})}
                  >
                    <div className="option-icon">💰</div>
                    <div className="option-content">
                      <h5>Requesting Money</h5>
                      <p>Request money from the other parent</p>
                    </div>
                  </div>
                  
                  <div 
                    className={`payment-type-option ${paymentForm.payment_type === 'reimbursement' ? 'selected' : ''}`}
                    onClick={() => setPaymentForm({...paymentForm, payment_type: 'reimbursement'})}
                  >
                    <div className="option-icon">🔄</div>
                    <div className="option-content">
                      <h5>Reimbursement</h5>
                      <p>Request reimbursement for shared expenses</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="form-group">
                <label>Category:</label>
                <select
                  value={paymentForm.category}
                  onChange={(e) => setPaymentForm({...paymentForm, category: e.target.value})}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  placeholder="Enter amount"
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <input
                  type="text"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                  placeholder="What was this payment for?"
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Payment Method:</label>
                  <input
                    type="text"
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({...paymentForm, payment_method: e.target.value})}
                    placeholder="e.g., Credit Card, Cash"
                  />
                </div>
                
                <div className="form-group">
                  <label>Merchant:</label>
                  <input
                    type="text"
                    value={paymentForm.merchant}
                    onChange={(e) => setPaymentForm({...paymentForm, merchant: e.target.value})}
                    placeholder="Store or service provider"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Payment Date:</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({...paymentForm, payment_date: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Notes:</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({...paymentForm, notes: e.target.value})}
                  placeholder="Additional notes or details"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowAddPaymentModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleAddPayment}
                disabled={!paymentForm.amount || loading}
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Receipt Modal */}
      {showReceiptUploadModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Receipt</h3>
              <button 
                className="close-btn"
                onClick={() => setShowReceiptUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-info">
                <p>📷 Upload a receipt image or PDF and we'll automatically extract the details using AI!</p>
                <p><small>Supported formats: JPG, PNG, GIF, BMP, TIFF, PDF</small></p>
              </div>
              
              <div className="form-group">
                <label>Receipt File:</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptForm({...receiptForm, file: e.target.files[0]})}
                />
              </div>
              
              <div className="form-group">
                <label>Category:</label>
                <select
                  value={receiptForm.category}
                  onChange={(e) => setReceiptForm({...receiptForm, category: e.target.value})}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Amount (optional - will be extracted from receipt):</label>
                <input
                  type="number"
                  step="0.01"
                  value={receiptForm.amount}
                  onChange={(e) => setReceiptForm({...receiptForm, amount: e.target.value})}
                  placeholder="Leave blank for auto-extraction"
                />
              </div>
              
              <div className="form-group">
                <label>Description (optional):</label>
                <input
                  type="text"
                  value={receiptForm.description}
                  onChange={(e) => setReceiptForm({...receiptForm, description: e.target.value})}
                  placeholder="Additional description if needed"
                />
              </div>
              
              <div className="form-group">
                <label>Notes:</label>
                <textarea
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({...receiptForm, notes: e.target.value})}
                  placeholder="Any additional notes about this receipt"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowReceiptUploadModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleUploadReceipt}
                disabled={!receiptForm.file || loading}
              >
                {loading ? 'Processing...' : 'Upload & Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Modal */}
      {showSuggestionModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowSuggestionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Suggest Payment Split</h3>
              <button 
                className="close-btn"
                onClick={() => setShowSuggestionModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-summary">
                <h4>Original Payment:</h4>
                <p><strong>Description:</strong> {selectedPayment.description}</p>
                <p><strong>Amount:</strong> {formatCurrency(selectedPayment.amount)}</p>
                <p><strong>Category:</strong> {getCategoryLabel(selectedPayment.category)}</p>
              </div>
              
              <div className="form-group">
                <label>Suggest To:</label>
                <select
                  value={suggestionForm.suggested_to}
                  onChange={(e) => setSuggestionForm({...suggestionForm, suggested_to: e.target.value})}
                >
                  <option value="">Select parent...</option>
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Suggested Amount:</label>
                <input
                  type="number"
                  step="0.01"
                  value={suggestionForm.suggested_amount}
                  onChange={(e) => setSuggestionForm({...suggestionForm, suggested_amount: e.target.value})}
                  placeholder="Amount they should contribute"
                />
              </div>
              
              <div className="form-group">
                <label>Reason:</label>
                <textarea
                  value={suggestionForm.reason}
                  onChange={(e) => setSuggestionForm({...suggestionForm, reason: e.target.value})}
                  placeholder="Explain why they should contribute to this expense"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowSuggestionModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleCreateSuggestion}
                disabled={!suggestionForm.suggested_to || !suggestionForm.suggested_amount || !suggestionForm.reason || loading}
              >
                Send Suggestion
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
}

export default AccountablePayments;