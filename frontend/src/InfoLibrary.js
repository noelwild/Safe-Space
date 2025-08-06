import React, { useState, useEffect } from 'react';
import './InfoLibrary.css';

function InfoLibrary({ currentUser }) {
  const [entries, setEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Form states
  const [uploadForm, setUploadForm] = useState({
    file: null,
    title: '',
    description: '',
    category: 'other',
    created_by: currentUser?.name || 'Unknown User'
  });
  
  const [infoForm, setInfoForm] = useState({
    title: '',
    description: '',
    category: 'other',
    created_by: currentUser?.name || 'Unknown User'
  });

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [entriesRes, categoriesRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/info-library`),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/info-library/categories`)
      ]);
      
      if (entriesRes.ok) {
        const entriesData = await entriesRes.json();
        setEntries(entriesData);
      }
      
      if (categoriesRes.ok) {
        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Error loading info library data');
    } finally {
      setLoading(false);
    }
  };

  // Search functionality
  const searchEntries = async () => {
    if (!searchQuery && selectedCategory === 'all') {
      loadData();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/info-library/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Error searching entries:', error);
      setError('Error searching entries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchEntries();
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
      medical: '🏥',
      legal: '⚖️',
      school_records: '🎓',
      emergency_contacts: '🚨',
      custody_documents: '📋',
      insurance: '🛡️',
      financial_records: '💰',
      activities: '⚽',
      other: '📄'
    };
    return icons[category] || '📄';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      medical: 'Medical',
      legal: 'Legal',
      school_records: 'School Records',
      emergency_contacts: 'Emergency Contacts',
      custody_documents: 'Custody Documents',
      insurance: 'Insurance',
      financial_records: 'Financial Records',
      activities: 'Activities',
      other: 'Other'
    };
    return labels[category] || category;
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

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/info-library/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess('File uploaded successfully to Info Library!');
        setShowUploadModal(false);
        resetUploadForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error uploading file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  const handleInfoSubmit = async () => {
    try {
      if (!infoForm.title || !infoForm.description) {
        setError('Please enter both title and description');
        return;
      }

      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/info-library/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(infoForm)
      });

      if (response.ok) {
        setSuccess('Information added successfully to Info Library!');
        setShowInfoModal(false);
        resetInfoForm();
        loadData();
      } else {
        const error = await response.json();
        setError(error.detail || 'Error adding information');
      }
    } catch (error) {
      console.error('Error adding information:', error);
      setError('Error adding information');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (entryId, fileName) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/info-library/download/${entryId}?downloaded_by=${encodeURIComponent(currentUser?.name || 'Unknown User')}`,
        { method: 'GET' }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        setSuccess(`Downloaded: ${fileName}`);
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

  // Reset forms
  const resetUploadForm = () => {
    setUploadForm({
      file: null,
      title: '',
      description: '',
      category: 'other',
      created_by: currentUser?.name || 'Unknown User'
    });
  };

  const resetInfoForm = () => {
    setInfoForm({
      title: '',
      description: '',
      category: 'other',
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
    <div className="info-library">
      <div className="info-library-header">
        <div className="info-library-title">
          <h2>📚 Info Library</h2>
          <p>Centralized repository for important family documents and information</p>
        </div>
        
        <div className="info-library-actions">
          <button 
            className="action-btn primary"
            onClick={() => setShowUploadModal(true)}
          >
            📁 Upload Document
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => setShowInfoModal(true)}
          >
            ➕ Add Information
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

      {/* Entries List */}
      <div className="entries-list">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading entries...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <h3>No entries found</h3>
            <p>Start building your Info Library by uploading documents or adding information.</p>
            <div className="empty-actions">
              <button 
                className="create-btn"
                onClick={() => setShowUploadModal(true)}
              >
                Upload First Document
              </button>
              <button 
                className="create-btn secondary"
                onClick={() => setShowInfoModal(true)}
              >
                Add Information
              </button>
            </div>
          </div>
        ) : (
          entries.map(entry => (
            <div key={entry.id} className="entry-card">
              <div className="entry-header">
                <div className="entry-category">
                  <span className="category-icon">{getCategoryIcon(entry.category)}</span>
                  <span className="category-name">{getCategoryLabel(entry.category)}</span>
                </div>
                <div className="entry-type">
                  {entry.is_file ? '📁 File' : '📝 Information'}
                </div>
              </div>
              
              <div className="entry-body">
                <h4>{entry.title}</h4>
                {entry.description && <p className="entry-description">{entry.description}</p>}
                
                {entry.is_file && (
                  <div className="file-details">
                    <p><strong>File:</strong> {entry.file_name}</p>
                    <p><strong>Type:</strong> {entry.file_type?.toUpperCase()}</p>
                    {entry.file_size && <p><strong>Size:</strong> {formatFileSize(entry.file_size)}</p>}
                  </div>
                )}
              </div>
              
              <div className="entry-footer">
                <div className="entry-meta">
                  <span>Added {formatDate(entry.upload_date)} by {entry.uploaded_by}</span>
                  {entry.downloads_log && (
                    <details className="download-history">
                      <summary>Download History</summary>
                      <div className="download-log">
                        {entry.downloads_log.split('\n').filter(log => log.trim()).map((log, index) => (
                          <div key={index} className="download-entry">{log}</div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                
                {entry.is_file && (
                  <button 
                    className="download-btn"
                    onClick={() => handleDownload(entry.id, entry.file_name)}
                  >
                    📥 Download
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Upload File Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Upload Document</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-info">
                <p>📁 Upload important family documents to the Info Library</p>
                <p><small>Supported: PDF, DOC, DOCX, TXT, Images (Max 10MB)</small></p>
                <p><strong>Note:</strong> Documents cannot be deleted once uploaded - they are permanent for safety.</p>
              </div>
              
              <div className="form-group">
                <label>Document File:</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff"
                  onChange={(e) => setUploadForm({...uploadForm, file: e.target.files[0]})}
                />
              </div>
              
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({...uploadForm, title: e.target.value})}
                  placeholder="Enter document title (e.g., 'Medical Records - Dr. Smith')"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Category:</label>
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
                  placeholder="Additional details about this document"
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
                {loading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Information Modal */}
      {showInfoModal && (
        <div className="modal-overlay" onClick={() => setShowInfoModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Information</h3>
              <button 
                className="close-btn"
                onClick={() => setShowInfoModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="info-notice">
                <p>📝 Add important information that doesn't require a file</p>
                <p><small>Examples: Doctor contact details, emergency procedures, custody schedules</small></p>
              </div>
              
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={infoForm.title}
                  onChange={(e) => setInfoForm({...infoForm, title: e.target.value})}
                  placeholder="Enter information title (e.g., 'Dr. Johnson Contact Info')"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label>Category:</label>
                <select
                  value={infoForm.category}
                  onChange={(e) => setInfoForm({...infoForm, category: e.target.value})}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {getCategoryIcon(cat)} {getCategoryLabel(cat)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Information:</label>
                <textarea
                  value={infoForm.description}
                  onChange={(e) => setInfoForm({...infoForm, description: e.target.value})}
                  placeholder="Enter the information details here..."
                  rows="6"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowInfoModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={handleInfoSubmit}
                disabled={!infoForm.title || !infoForm.description || loading}
              >
                Add Information
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

export default InfoLibrary;