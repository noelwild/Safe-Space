import React, { useState, useEffect } from 'react';
import './VaultFileStorage.css';

function VaultFileStorage({ currentUser }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showFileDetailsModal, setShowFileDetailsModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [stats, setStats] = useState({});
  const [accessLogs, setAccessLogs] = useState([]);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null,
    title: '',
    description: ''
  });

  // New folder form state
  const [newFolderForm, setNewFolderForm] = useState({
    name: ''
  });

  useEffect(() => {
    loadFiles();
    loadFolders();
    loadStats();
  }, [currentFolder]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const folderParam = currentFolder ? `?folder_id=${currentFolder.id}&user=${currentUser.name}` : `?user=${currentUser.name}`;
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/files${folderParam}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/folders`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/stats?user=${currentUser.name}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.title) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('created_by', currentUser.name);
      formData.append('is_shared', 'true'); // Always shared between parents
      formData.append('shared_with', 'Elizabeth Zilm'); // Default other parent
      if (currentFolder) {
        formData.append('folder_id', currentFolder.id);
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setShowUploadModal(false);
        setUploadForm({ file: null, title: '', description: '' });
        loadFiles();
        loadStats();
      } else {
        const error = await response.json();
        alert(`Upload failed: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderForm.name) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newFolderForm.name,
          parent_folder_id: currentFolder?.id || null,
          created_by: currentUser.name
        })
      });

      if (response.ok) {
        setShowNewFolderModal(false);
        setNewFolderForm({ name: '' });
        loadFolders();
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/file/${file.id}?accessed_by=${currentUser.name}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Reload files to update access stats
        loadFiles();
      }
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/file/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleted_by: currentUser.name })
      });

      if (response.ok) {
        loadFiles();
        loadStats();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleFileDetails = async (file) => {
    setSelectedFile(file);
    
    // Load access logs if user owns the file
    if (file.uploaded_by === currentUser.name) {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/vault/file/${file.id}/access-logs?requested_by=${currentUser.name}`);
        if (response.ok) {
          const logs = await response.json();
          setAccessLogs(logs);
        }
      } catch (error) {
        console.error('Error loading access logs:', error);
        setAccessLogs([]);
      }
    } else {
      setAccessLogs([]);
    }
    
    setShowFileDetailsModal(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setUploadForm(prev => ({
        ...prev,
        file: droppedFiles[0],
        title: droppedFiles[0].name.split('.')[0]
      }));
      setShowUploadModal(true);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType) => {
    const type = fileType?.toLowerCase() || '';
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(type)) return '🖼️';
    if (['.pdf'].includes(type)) return '📄';
    if (['.doc', '.docx'].includes(type)) return '📝';
    if (['.xls', '.xlsx'].includes(type)) return '📊';
    if (['.ppt', '.pptx'].includes(type)) return '📽️';
    if (['.mp4', '.avi', '.mov'].includes(type)) return '🎥';
    if (['.mp3', '.wav'].includes(type)) return '🎵';
    if (['.zip', '.rar'].includes(type)) return '📦';
    return '📄';
  };

  const getBreadcrumb = () => {
    let breadcrumb = [{ name: 'Vault', folder: null }];
    if (currentFolder) {
      // In a real app, you'd build the full path
      breadcrumb.push({ name: currentFolder.name, folder: currentFolder });
    }
    return breadcrumb;
  };

  const currentFolderFolders = folders.filter(f => 
    currentFolder ? f.parent_folder_id === currentFolder.id : f.parent_folder_id === null
  );

  return (
    <div className="vault-file-storage">
      <div className="vault-header">
        <div className="vault-title">
          <h2>🗄️ Vault File Storage</h2>
          <p>Secure storage for family documents, photos, and important files</p>
        </div>
        
        <div className="vault-stats">
          <div className="stat-item">
            <span className="stat-label">Files</span>
            <span className="stat-value">{stats.files_count || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Storage Used</span>
            <span className="stat-value">{formatFileSize(stats.storage_used || 0)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Shared</span>
            <span className="stat-value">{stats.shared_count || 0}</span>
          </div>
        </div>
      </div>

      <div className="vault-controls">
        <div className="breadcrumb">
          {getBreadcrumb().map((item, index) => (
            <span key={index}>
              <button 
                className="breadcrumb-item"
                onClick={() => setCurrentFolder(item.folder)}
              >
                {item.name}
              </button>
              {index < getBreadcrumb().length - 1 && <span className="breadcrumb-separator">›</span>}
            </span>
          ))}
        </div>

        <div className="vault-actions">
          <button 
            className="action-btn primary"
            onClick={() => setShowNewFolderModal(true)}
          >
            📁 New Folder
          </button>
          <button 
            className="action-btn primary"
            onClick={() => setShowUploadModal(true)}
          >
            📤 Upload File
          </button>
        </div>
      </div>

      <div 
        className={`vault-content ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading vault contents...</p>
          </div>
        ) : (
          <>
            {/* Folders */}
            {currentFolderFolders.length > 0 && (
              <div className="folders-section">
                <h3>📁 Folders</h3>
                <div className="folders-list">
                  {currentFolderFolders.map(folder => (
                    <div 
                      key={folder.id}
                      className="folder-item"
                      onClick={() => setCurrentFolder(folder)}
                    >
                      <div className="folder-icon">📁</div>
                      <div className="folder-info">
                        <h4>{folder.name}</h4>
                        <p>Created by {folder.created_by} on {new Date(folder.created_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            <div className="files-section">
              <h3>📄 Files {currentFolder && `in ${currentFolder.name}`}</h3>
              {files.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📄</div>
                  <h4>No files in this location</h4>
                  <p>Upload your first file to get started</p>
                  <button 
                    className="action-btn primary"
                    onClick={() => setShowUploadModal(true)}
                  >
                    📤 Upload File
                  </button>
                </div>
              ) : (
                <div className="files-list">
                  {files.map(file => (
                    <div key={file.id} className="file-item">
                      <div className="file-icon">
                        {getFileIcon(file.file_type)}
                      </div>
                      <div className="file-info">
                        <div className="file-header">
                          <h4>{file.title}</h4>
                          <div className="file-actions">
                            <button 
                              className="action-btn small"
                              onClick={() => handleDownloadFile(file)}
                              title="Download file"
                            >
                              📥
                            </button>
                            <button 
                              className="action-btn small"
                              onClick={() => handleFileDetails(file)}
                              title="View details"
                            >
                              ℹ️
                            </button>
                            {file.uploaded_by === currentUser.name && (
                              <button 
                                className="action-btn small danger"
                                onClick={() => handleDeleteFile(file.id)}
                                title="Delete file"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="file-name">{file.filename}</p>
                        <div className="file-meta">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>Uploaded by {file.uploaded_by}</span>
                          <span>•</span>
                          <span>{new Date(file.upload_date).toLocaleDateString()}</span>
                        </div>
                        {file.description && (
                          <p className="file-description">{file.description}</p>
                        )}
                        {file.access_stats && (Object.keys(file.access_stats).length > 0) && (
                          <div className="access-stats">
                            {file.access_stats.download && (
                              <span className="stat">📥 {file.access_stats.download} downloads</span>
                            )}
                            {file.access_stats.preview && (
                              <span className="stat">👁 {file.access_stats.preview} views</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {dragOver && (
          <div className="drag-overlay">
            <div className="drag-content">
              <div className="drag-icon">📤</div>
              <h3>Drop your file here</h3>
              <p>Release to start uploading</p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📤 Upload File to Vault</h3>
              <button 
                className="close-btn"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleFileUpload} className="modal-body">
              <div className="form-group">
                <label>Select File:</label>
                <input
                  type="file"
                  onChange={(e) => setUploadForm(prev => ({
                    ...prev,
                    file: e.target.files[0],
                    title: e.target.files[0]?.name?.split('.')[0] || ''
                  }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Title:</label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter file title"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Description:</label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              
              <div className="sharing-info">
                <p>📤 Files uploaded to the vault are automatically accessible to both parents for secure document sharing.</p>
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowUploadModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="upload-btn"
                  disabled={!uploadForm.file || !uploadForm.title || loading}
                >
                  {loading ? 'Uploading...' : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNewFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📁 Create New Folder</h3>
              <button 
                className="close-btn"
                onClick={() => setShowNewFolderModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="modal-body">
              <div className="form-group">
                <label>Folder Name:</label>
                <input
                  type="text"
                  value={newFolderForm.name}
                  onChange={(e) => setNewFolderForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter folder name"
                  required
                />
              </div>
              
              <div className="modal-footer">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowNewFolderModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="create-btn"
                  disabled={!newFolderForm.name}
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Details Modal */}
      {showFileDetailsModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowFileDetailsModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📄 File Details</h3>
              <button 
                className="close-btn"
                onClick={() => setShowFileDetailsModal(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="file-details">
                <div className="detail-section">
                  <h4>File Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Title:</label>
                      <span>{selectedFile.title}</span>
                    </div>
                    <div className="detail-item">
                      <label>Filename:</label>
                      <span>{selectedFile.filename}</span>
                    </div>
                    <div className="detail-item">
                      <label>Size:</label>
                      <span>{formatFileSize(selectedFile.file_size)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Type:</label>
                      <span>{selectedFile.file_type}</span>
                    </div>
                    <div className="detail-item">
                      <label>Uploaded by:</label>
                      <span>{selectedFile.uploaded_by}</span>
                    </div>
                    <div className="detail-item">
                      <label>Upload date:</label>
                      <span>{new Date(selectedFile.upload_date).toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <label>Shared:</label>
                      <span>{selectedFile.is_shared ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  {selectedFile.description && (
                    <div className="detail-item full-width">
                      <label>Description:</label>
                      <p>{selectedFile.description}</p>
                    </div>
                  )}
                </div>

                {selectedFile.uploaded_by === currentUser.name && accessLogs.length > 0 && (
                  <div className="detail-section">
                    <h4>Access History</h4>
                    <div className="access-logs">
                      {accessLogs.map((log, index) => (
                        <div key={index} className="access-log-item">
                          <div className="log-info">
                            <span className="log-user">{log.accessed_by}</span>
                            <span className="log-action">{log.access_type}</span>
                          </div>
                          <span className="log-date">{new Date(log.access_date).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="modal-footer">
                <button 
                  className="action-btn"
                  onClick={() => handleDownloadFile(selectedFile)}
                >
                  📥 Download
                </button>
                <button 
                  className="cancel-btn"
                  onClick={() => setShowFileDetailsModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VaultFileStorage;