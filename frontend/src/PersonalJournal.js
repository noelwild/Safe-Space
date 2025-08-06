import React, { useState, useEffect } from 'react';
import './PersonalJournal.css';

function PersonalJournal({ currentUser }) {
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form states for the left input form
  const [entryForm, setEntryForm] = useState({
    title: '',
    content: '',
    mood: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [showEditEntryModal, setShowEditEntryModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const moods = [
    { value: '', label: 'Select mood (optional)', emoji: '❓' },
    { value: 'happy', label: 'Happy', emoji: '😊' },
    { value: 'sad', label: 'Sad', emoji: '😢' },
    { value: 'anxious', label: 'Anxious', emoji: '😰' },
    { value: 'angry', label: 'Angry', emoji: '😠' },
    { value: 'frustrated', label: 'Frustrated', emoji: '😤' },
    { value: 'hopeful', label: 'Hopeful', emoji: '🙏' },
    { value: 'grateful', label: 'Grateful', emoji: '🙏' },
    { value: 'worried', label: 'Worried', emoji: '😟' },
    { value: 'peaceful', label: 'Peaceful', emoji: '😌' },
    { value: 'overwhelmed', label: 'Overwhelmed', emoji: '😵' },
  ];

  useEffect(() => {
    loadJournalEntries();
  }, []);

  const loadJournalEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal?created_by=${encodeURIComponent(currentUser.name)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setJournalEntries(data);
      } else {
        setError('Failed to load journal entries');
      }
    } catch (error) {
      console.error('Error loading journal entries:', error);
      setError('Error loading journal entries');
    } finally {
      setLoading(false);
    }
  };

  const createEntry = async (e) => {
    e.preventDefault();
    
    if (!entryForm.title.trim() || !entryForm.content.trim()) {
      setError('Please fill in both title and content');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/personal-journal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: entryForm.title.trim(),
          content: entryForm.content.trim(),
          mood: entryForm.mood,
          created_by: currentUser.name
        })
      });

      if (response.ok) {
        await loadJournalEntries();
        setEntryForm({ title: '', content: '', mood: '' });
        setSuccess('Journal entry created successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to create journal entry');
      }
    } catch (error) {
      console.error('Error creating journal entry:', error);
      setError('Error creating journal entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateEntry = async () => {
    if (!selectedEntry) return;

    try {
      // Prepare update data - only include changed fields
      const updateData = { updated_by: currentUser.name };
      
      if (entryForm.title !== selectedEntry.title) {
        updateData.title = entryForm.title;
      }
      if (entryForm.content !== selectedEntry.content) {
        updateData.content = entryForm.content;
      }
      if (entryForm.mood !== selectedEntry.mood) {
        updateData.mood = entryForm.mood;
      }

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/${selectedEntry.id}?updated_by=${encodeURIComponent(currentUser.name)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        // Upload new files if any
        if (selectedFiles.length > 0) {
          await uploadFilesToEntry(selectedEntry.id);
        }
        
        await loadJournalEntries();
        resetForm();
        setShowEditEntryModal(false);
        setSelectedEntry(null);
      } else {
        alert('Failed to update journal entry');
      }
    } catch (error) {
      console.error('Error updating journal entry:', error);
      alert('Error updating journal entry');
    }
  };

  const deleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/${entryId}?deleted_by=${encodeURIComponent(currentUser.name)}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        await loadJournalEntries();
        if (selectedEntry && selectedEntry.id === entryId) {
          setSelectedEntry(null);
        }
      } else {
        alert('Failed to delete journal entry');
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Error deleting journal entry');
    }
  };

  const uploadFilesToEntry = async (entryId) => {
    if (selectedFiles.length === 0) return;

    setUploadingFiles(true);
    
    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploaded_by', currentUser.name);

        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/${entryId}/upload-file`,
          {
            method: 'POST',
            body: formData
          }
        );

        if (!response.ok) {
          console.error(`Failed to upload file: ${file.name}`);
        }
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
      }
    }
    
    setUploadingFiles(false);
    setSelectedFiles([]);
  };

  const downloadFile = async (fileId, filename) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/file/${fileId}?downloaded_by=${encodeURIComponent(currentUser.name)}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/file/${fileId}?deleted_by=${encodeURIComponent(currentUser.name)}`,
        {
          method: 'DELETE'
        }
      );

      if (response.ok) {
        await loadJournalEntries();
      } else {
        alert('Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error deleting file');
    }
  };

  const exportToPDF = async (entryId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/personal-journal/${entryId}/export-pdf?exported_by=${encodeURIComponent(currentUser.name)}`
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal_entry_${entryId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to export journal entry');
      }
    } catch (error) {
      console.error('Error exporting journal entry:', error);
      alert('Error exporting journal entry');
    }
  };

  const resetForm = () => {
    setEntryForm({
      title: '',
      content: '',
      mood: ''
    });
    setSelectedFiles([]);
  };

  const handleEntryClick = (entry) => {
    setSelectedEntry(entry);
    setShowEntryModal(true);
  };

  const getMoodDisplay = (mood) => {
    const moodObj = moods.find(m => m.value === mood);
    return moodObj ? `${moodObj.emoji} ${moodObj.label}` : '';
  };

  const openEditModal = (entry) => {
    setSelectedEntry(entry);
    setEntryForm({
      title: entry.title,
      content: entry.content,
      mood: entry.mood || ''
    });
    setShowEditEntryModal(true);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMoodEmoji = (mood) => {
    const moodObj = moods.find(m => m.value === mood);
    return moodObj ? moodObj.emoji : '';
  };

  if (loading) {
    return (
      <div className="personal-journal">
        <div className="loading-state">
          <h2>🔒 Loading Your Private Journal...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="personal-journal">
        <div className="error-state">
          <h2>🔒 Personal Journal</h2>
          <p>Error: {error}</p>
          <button onClick={loadJournalEntries} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-journal">
      <div className="journal-container">
        {/* Left Side - Entry Form */}
        <div className="entry-form-section">
          <div className="form-header">
            <h3>📝 Write New Entry</h3>
            <p>Express your thoughts and feelings</p>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={createEntry} className="entry-form">
            <div className="form-group">
              <label htmlFor="title">Title *</label>
              <input
                id="title"
                type="text"
                value={entryForm.title}
                onChange={(e) => setEntryForm({...entryForm, title: e.target.value})}
                placeholder="Give your entry a title..."
                required
                disabled={isSubmitting}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="mood">How are you feeling?</label>
              <select
                id="mood"
                value={entryForm.mood}
                onChange={(e) => setEntryForm({...entryForm, mood: e.target.value})}
                disabled={isSubmitting}
              >
                {moods.map(mood => (
                  <option key={mood.value} value={mood.value}>
                    {mood.emoji} {mood.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label htmlFor="content">Your thoughts *</label>
              <textarea
                id="content"
                value={entryForm.content}
                onChange={(e) => setEntryForm({...entryForm, content: e.target.value})}
                placeholder="Write about your day, feelings, thoughts, or anything that's on your mind..."
                rows="8"
                required
                disabled={isSubmitting}
              />
            </div>
            
            <button 
              type="submit" 
              className="create-entry-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? '📝 Saving...' : '✨ Save Entry'}
            </button>
          </form>
        </div>
        
        {/* Right Side - Entries List */}
        <div className="entries-list-section">
          <div className="list-header">
            <h3>📚 Your Journal Entries</h3>
            <p>{journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}</p>
          </div>
          
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your entries...</p>
            </div>
          ) : journalEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📔</div>
              <h4>No entries yet</h4>
              <p>Start writing your first journal entry using the form on the left.</p>
            </div>
          ) : (
            <div className="entries-list">
              {journalEntries.map(entry => (
                <div 
                  key={entry.id} 
                  className="entry-item"
                  onClick={() => handleEntryClick(entry)}
                >
                  <div className="entry-item-header">
                    <h4>{entry.title}</h4>
                    {entry.mood && (
                      <span className="mood-indicator">
                        {getMoodDisplay(entry.mood)}
                      </span>
                    )}
                  </div>
                  
                  <div className="entry-preview">
                    {entry.content.length > 120 
                      ? `${entry.content.substring(0, 120)}...` 
                      : entry.content
                    }
                  </div>
                  
                  <div className="entry-meta">
                    <span className="entry-date">
                      📅 {formatDate(entry.created_date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Entry Details Modal */}
      {showEntryModal && selectedEntry && (
        <div className="modal-overlay" onClick={() => setShowEntryModal(false)}>
          <div className="modal entry-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedEntry.title}</h3>
              <button 
                className="close-btn"
                onClick={() => setShowEntryModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body entry-details">
              <div className="entry-info">
                <div className="info-row">
                  <span className="label">📅 Created:</span>
                  <span className="value">{formatDate(selectedEntry.created_date)}</span>
                </div>
                
                {selectedEntry.mood && (
                  <div className="info-row">
                    <span className="label">😊 Mood:</span>
                    <span className="value">{getMoodDisplay(selectedEntry.mood)}</span>
                  </div>
                )}
                
                {selectedEntry.last_modified && selectedEntry.last_modified !== selectedEntry.created_date && (
                  <div className="info-row">
                    <span className="label">✏️ Last updated:</span>
                    <span className="value">{formatDate(selectedEntry.last_modified)}</span>
                  </div>
                )}
              </div>
              
              <div className="entry-content">
                <h4>Content:</h4>
                <div className="content-text">
                  {selectedEntry.content.split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <p className="no-delete-note">
                📌 Journal entries cannot be deleted for record-keeping purposes.
              </p>
              <button 
                className="close-modal-btn"
                onClick={() => setShowEntryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PersonalJournal;