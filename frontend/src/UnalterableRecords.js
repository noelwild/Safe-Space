import React, { useState, useEffect } from 'react';
import './UnalterableRecords.css';

function UnalterableRecords({ currentUser }) {
  const [records, setRecords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Form states
  const [uploadForm, setUploadForm] = useState({
    file: null,
    title: '',
    description: '',
    category: 'other_legal',
    created_by: currentUser?.name || 'Unknown User'
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [recordsRes, categoriesRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/unalterable-records`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/unalterable-records/categories`)
      ]);
      
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setRecords(recordsData);
      }
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error loading unalterable records data');
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const searchRecords = async () => {
    if (!searchQuery && selectedCategory === 'all') {
      loadData();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/unalterable-records/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Error searching records:', error);
      setError('Error searching records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchRecords();
    }, 300);
    
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedCategory]);

  // Helper functions
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 10) / 10 + ' ' + sizes[i];
  };

  const getCategoryIcon = (category) => {
    const icons = {
      legal_agreements: '📋',
      court_orders: '⚖️',
      custody_documents: '👨‍👩‍👧‍👦',
      parenting_plans: '📝',
      financial_agreements: '💰',
      medical_decisions: '🏥',
      education_decisions: '🎓',
      legal_correspondence: '📬',
      official_documents: '📜',
      other_legal: '📄'
    };
    return icons[category] || '📄';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      legal_agreements: 'Legal Agreements',
      court_orders: 'Court Orders',
      custody_documents: 'Custody Documents',
      parenting_plans: 'Parenting Plans',
      financial_agreements: 'Financial Agreements',
      medical_decisions: 'Medical Decisions',
      education_decisions: 'Education Decisions',
      legal_correspondence: 'Legal Correspondence',
      official_documents: 'Official Documents',
      other_legal: 'Other Legal'
    };
    return labels[category] || category.replace('_', ' ');
  };

  // Form handlers
  const handleFileUpload = async () => {
    try {
      if (!uploadForm.file || !uploadForm.title) {
        setError('Please select a file and enter a title');
        return;
      }

      setLoading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('category', uploadForm.category);
      formData.append('created_by', uploadForm.created_by);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/unalterable-records/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Legal document uploaded successfully! File hash: ${result.file_hash.substring(0, 16)}...`);
        setShowUploadModal(false);
        resetUploadForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error uploading document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Error uploading document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (recordId, fileName, withVerification = false) => {
    try {
      const endpoint = withVerification 
        ? `/api/unalterable-records/download-with-verification/${recordId}`
        : `/api/unalterable-records/download/${recordId}`;
      
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?downloaded_by=${encodeURIComponent(currentUser?.name || 'Unknown User')}`,
        { method: 'GET' }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        if (withVerification) {
          a.download = `VERIFIED_${fileName}_verification.pdf`;
          setSuccess(`Downloaded with court verification certificate: ${fileName}`);
        } else {
          a.download = fileName;
          setSuccess(`Downloaded: ${fileName}`);
        }
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        // Reload data to update download logs
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error downloading file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Error downloading file');
    }
  };

  const handleVerifyIntegrity = async (recordId) => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/unalterable-records/verify/${recordId}`);
      
      if (response.ok) {
        const result = await response.json();
        setSelectedRecord({...selectedRecord, verification: result});
        setShowVerificationModal(true);
        
        if (result.verified) {
          setSuccess('Document integrity verified - file is authentic and unaltered');
        } else {
          setError('Document integrity check failed - file may be corrupted or tampered with');
        }
        
        // Reload to update verification status
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error verifying document');
      }
    } catch (error) {
      console.error('Error verifying document:', error);
      setError('Error verifying document');
    } finally {
      setLoading(false);
    }
  };

  // Reset forms
  const resetUploadForm = () => {
    setUploadForm({
      file: null,
      title: '',
      description: '',
      category: 'other_legal',
      created_by: currentUser?.name || 'Unknown User'
    });
  };

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
    <div className="unalterable-records">
      <div className="records-header">
        <div className="records-title">
          <h2>📋 Unalterable Records</h2>
          <p>Permanent legal document storage with cryptographic verification for court use</p>
          <div className="security-notice">
            <span className="security-icon">🔒</span>
            <span>Documents uploaded here cannot be deleted or modified - they are permanently preserved for legal integrity</span>
          </div>
        </div>
        
        <div className="records-actions">
          <button 
            className="action-btn primary"
            onClick={() => setShowUploadModal(true)}
          >
            📁 Upload Legal Document
          </button>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="search-filter-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-section">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {getCategoryIcon(category)} {getCategoryLabel(category)}
              </option>
            ))}
          </select>
        </div>
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

      {/* Records List */}
      <div className="records-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <h3>No legal documents found</h3>
            <p>Start building your legal document archive by uploading important agreements, court orders, and other legal documents.</p>
            <div className="empty-actions">
              <button 
                className="create-btn"
                onClick={() => setShowUploadModal(true)}
              >
                Upload First Document
              </button>
            </div>
          </div>
        ) : (
          records.map(record => (
            <div key={record.id} className="record-card">
              <div className="record-header">
                <div className="record-category">
                  <span className="category-icon">{getCategoryIcon(record.category)}</span>
                  <span className="category-name">{getCategoryLabel(record.category)}</span>
                </div>
                <div className="record-status">
                  <span className={`verification-badge ${record.is_verified ? 'verified' : 'unverified'}`}>
                    {record.is_verified ? '✅ Verified' : '⚠️ Unverified'}
                  </span>
                </div>
              </div>
              
              <div className="record-body">
                <h4>{record.title}</h4>
                {record.description && <p className="record-description">{record.description}</p>}
                
                <div className="file-details">
                  <p><strong>Original File:</strong> {record.original_file_name}</p>
                  <p><strong>Type:</strong> {record.file_type?.toUpperCase()}</p>
                  {record.file_size && <p><strong>Size:</strong> {formatFileSize(record.file_size)}</p>}
                  <p><strong>Hash ({record.hash_algorithm}):</strong> <code className="hash-display">{record.file_hash}</code></p>
                </div>
              </div>
              
              <div className="record-footer">
                <div className="record-meta">
                  <span>Uploaded {formatDate(record.upload_date)} by {record.uploaded_by}</span>
                  {record.downloads_log && (
                    <details className="download-history">
                      <summary>Access History</summary>
                      <div className="access-log">
                        {record.downloads_log.split('\n').filter(log => log.trim()).map((log, index) => (
                          <div key={index} className="access-entry">{log}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                
                <div className="record-actions">
                  <button 
                    className="verify-btn"
                    onClick={() => handleVerifyIntegrity(record.id)}
                    title="Verify document integrity"
                  >
                    🔍 Verify
                  </button>
                  <button 
                    className="download-btn"
                    onClick={() => handleDownload(record.id, record.original_file_name)}
                    title="Download original document"
                  >
                    📥 Download
                  </button>
                  <button 
                    className="court-download-btn"
                    onClick={() => handleDownload(record.id, record.original_file_name, true)}
                    title="Download with court verification certificate"
                  >
                    ⚖️ Court Download
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Legal Document</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-info">
                <p>📁 Upload important legal documents to permanent, unalterable storage</p>
                <p><small>Supported: PDF, DOC, DOCX, TXT, Images (Max 25MB)</small></p>
                <div className="warning-box">
                  <strong>⚠️ IMPORTANT:</strong> Documents uploaded here are PERMANENT and cannot be deleted or modified. 
                  They will be cryptographically secured and can be used for legal proceedings.
                </div>
              </div>
              
              <div className="form-group">
                <label>Legal Document File:</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff"
                  onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})}
                />
                {uploadForm.file && (
                  <div className="file-preview">
                    <span>📄 {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})</span>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label>Document Title:</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                  placeholder="Enter document title (e.g., 'Custody Agreement - Smith vs. Johnson')"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Document Category:</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm({...uploadForm, category: e.target.value})}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Description (optional):</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})}
                  placeholder="Additional details about this legal document"
                  rows="3"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleFileUpload}
                disabled={!uploadForm.file || !uploadForm.title || loading}
              >
                {loading ? 'Uploading...' : 'Upload Document Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowVerificationModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Document Verification Result</h3>
              <button 
                className="close-btn"
                onClick={() => setShowVerificationModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className={`verification-result ${selectedRecord.verification?.verified ? 'verified' : 'failed'}`}>
                <div className="verification-icon">
                  {selectedRecord.verification?.verified ? '✅' : '❌'}
                </div>
                <h4>
                  {selectedRecord.verification?.verified 
                    ? 'Document Integrity Verified' 
                    : 'Document Integrity Check Failed'}
                </h4>
                <p>
                  {selectedRecord.verification?.verified 
                    ? 'This document has not been altered since upload and is authentic.'
                    : 'This document may have been corrupted or tampered with.'}
                </p>
              </div>
              
              <div className="verification-details">
                <p><strong>Document:</strong> {selectedRecord.verification?.title}</p>
                <p><strong>Hash Algorithm:</strong> {selectedRecord.verification?.hash_algorithm}</p>
                <p><strong>Stored Hash:</strong> <code>{selectedRecord.verification?.stored_hash}</code></p>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="create-btn"
                onClick={() => setShowVerificationModal(false)}
              >
                Close
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

export default UnalterableRecords;