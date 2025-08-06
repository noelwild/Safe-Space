import React, { useState, useEffect } from 'react';
import './ContactUs.css';

function ContactUs({ currentUser }) {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // New ticket form state
  const [newTicket, setNewTicket] = useState({
    subject: '',
    category: '',
    priority: 'Medium',
    description: '',
    attachments: []
  });

  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    loadCategories();
    loadUserTickets();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/support/categories`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
        setPriorities(data.priorities);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadUserTickets = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/support/tickets?user_email=${encodeURIComponent(currentUser.email)}`
      );
      if (response.ok) {
        const data = await response.json();
        setTickets(data);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
    }
  };

  const loadTicketDetails = async (ticketId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/support/tickets/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data);
      }
    } catch (error) {
      console.error('Error loading ticket details:', error);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
  };

  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    
    if (!newTicket.subject.trim() || !newTicket.category || !newTicket.description.trim()) {
      setMessage({ text: 'Please fill in all required fields.', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: '', type: '' });

    try {
      // Create the ticket first
      const ticketResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/support/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: newTicket.subject,
          category: newTicket.category,
          priority: newTicket.priority,
          description: newTicket.description,
          user_name: currentUser.name,
          user_email: currentUser.email
        })
      });

      if (!ticketResponse.ok) {
        throw new Error('Failed to create ticket');
      }

      const ticketData = await ticketResponse.json();
      const ticketId = ticketData.ticket_id;

      // Upload attachments if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('uploaded_by', currentUser.name);

          const uploadResponse = await fetch(
            `${process.env.REACT_APP_BACKEND_URL}/api/support/tickets/${ticketId}/attachments`,
            {
              method: 'POST',
              body: formData
            }
          );

          if (!uploadResponse.ok) {
            console.error(`Failed to upload ${file.name}`);
          }
        }
      }

      setMessage({ 
        text: `Support ticket created successfully! Ticket number: ${ticketData.ticket_number}`, 
        type: 'success' 
      });

      // Reset form
      setNewTicket({
        subject: '',
        category: '',
        priority: 'Medium',
        description: '',
        attachments: []
      });
      setSelectedFiles([]);
      setShowNewTicketForm(false);

      // Reload tickets
      loadUserTickets();

    } catch (error) {
      console.error('Error creating ticket:', error);
      setMessage({ text: 'Failed to create support ticket. Please try again.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNewTicket(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getPriorityClass = (priority) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'priority-urgent';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'open': return 'status-open';
      case 'in progress': return 'status-progress';
      case 'resolved': return 'status-resolved';
      case 'closed': return 'status-closed';
      default: return 'status-open';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="contact-us">
      <div className="contact-us-header">
        <h1>📧 Contact Us</h1>
        <p>Get help from the Safespace support team. We're here to make your family communication easier and stress-free.</p>
        <button 
          className="new-ticket-btn"
          onClick={() => setShowNewTicketForm(true)}
        >
          Create New Ticket
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="contact-us-content">
        {/* Ticket List */}
        <div className="tickets-section">
          <h2>Your Support Tickets</h2>
          
          {tickets.length === 0 ? (
            <div className="no-tickets">
              <div className="empty-state">
                <div className="empty-icon">🎫</div>
                <h3>No support tickets yet</h3>
                <p>When you need help, create a support ticket and our team will assist you promptly.</p>
                <button 
                  className="create-first-ticket-btn"
                  onClick={() => setShowNewTicketForm(true)}
                >
                  Create Your First Ticket
                </button>
              </div>
            </div>
          ) : (
            <div className="tickets-list">
              {tickets.map(ticket => (
                <div 
                  key={ticket.id}
                  className={`ticket-item ${selectedTicket?.id === ticket.id ? 'selected' : ''}`}
                  onClick={() => loadTicketDetails(ticket.id)}
                >
                  <div className="ticket-header">
                    <div className="ticket-number">#{ticket.ticket_number}</div>
                    <div className={`ticket-status ${getStatusClass(ticket.status)}`}>
                      {ticket.status}
                    </div>
                  </div>
                  <h3 className="ticket-subject">{ticket.subject}</h3>
                  <div className="ticket-meta">
                    <span className="ticket-category">{ticket.category}</span>
                    <span className={`ticket-priority ${getPriorityClass(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                    <span className="ticket-date">
                      Created: {formatDate(ticket.created_date)}
                    </span>
                  </div>
                  {ticket.admin_response && (
                    <div className="has-response">💬 Response available</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Details */}
        {selectedTicket && (
          <div className="ticket-details">
            <div className="ticket-details-header">
              <h3>Ticket Details</h3>
              <button 
                className="close-details-btn"
                onClick={() => setSelectedTicket(null)}
              >
                ×
              </button>
            </div>

            <div className="ticket-info">
              <div className="ticket-info-row">
                <span className="label">Ticket Number:</span>
                <span className="value">#{selectedTicket.ticket_number}</span>
              </div>
              <div className="ticket-info-row">
                <span className="label">Subject:</span>
                <span className="value">{selectedTicket.subject}</span>
              </div>
              <div className="ticket-info-row">
                <span className="label">Category:</span>
                <span className="value">{selectedTicket.category}</span>
              </div>
              <div className="ticket-info-row">
                <span className="label">Priority:</span>
                <span className={`value ${getPriorityClass(selectedTicket.priority)}`}>
                  {selectedTicket.priority}
                </span>
              </div>
              <div className="ticket-info-row">
                <span className="label">Status:</span>
                <span className={`value ${getStatusClass(selectedTicket.status)}`}>
                  {selectedTicket.status}
                </span>
              </div>
              <div className="ticket-info-row">
                <span className="label">Created:</span>
                <span className="value">{formatDate(selectedTicket.created_date)}</span>
              </div>
              {selectedTicket.last_updated !== selectedTicket.created_date && (
                <div className="ticket-info-row">
                  <span className="label">Last Updated:</span>
                  <span className="value">{formatDate(selectedTicket.last_updated)}</span>
                </div>
              )}
            </div>

            <div className="ticket-description">
              <h4>Description:</h4>
              <div className="description-text">{selectedTicket.description}</div>
            </div>

            {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
              <div className="ticket-attachments">
                <h4>Attachments:</h4>
                <div className="attachments-list">
                  {selectedTicket.attachments.map(attachment => (
                    <div key={attachment.id} className="attachment-item">
                      <div className="attachment-icon">
                        {attachment.file_type?.includes('image') ? '🖼️' : 
                         attachment.file_type?.includes('pdf') ? '📄' : '📎'}
                      </div>
                      <div className="attachment-info">
                        <div className="attachment-name">{attachment.original_filename}</div>
                        <div className="attachment-meta">
                          {Math.round(attachment.file_size / 1024)} KB • 
                          Uploaded {formatDate(attachment.upload_date)}
                        </div>
                      </div>
                      <a 
                        href={`${process.env.REACT_APP_BACKEND_URL}/api/support/tickets/${selectedTicket.id}/attachments/${attachment.id}/download`}
                        className="download-btn"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTicket.admin_response && (
              <div className="admin-response">
                <h4>Support Team Response:</h4>
                <div className="response-text">{selectedTicket.admin_response}</div>
                {selectedTicket.resolved_date && (
                  <div className="response-meta">
                    Resolved on {formatDate(selectedTicket.resolved_date)}
                    {selectedTicket.resolved_by && ` by ${selectedTicket.resolved_by}`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketForm && (
        <div className="modal-overlay" onClick={() => setShowNewTicketForm(false)}>
          <div className="modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Support Ticket</h3>
              <button 
                className="close-btn"
                onClick={() => setShowNewTicketForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitTicket} className="ticket-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <input
                    id="subject"
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) => handleInputChange('subject', e.target.value)}
                    placeholder="Brief description of your issue"
                    maxLength={100}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    value={newTicket.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="priority">Priority</label>
                  <select
                    id="priority"
                    value={newTicket.priority}
                    onChange={(e) => handleInputChange('priority', e.target.value)}
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="description">Description *</label>
                  <textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Please provide detailed information about your issue or request. The more details you provide, the better we can help you."
                    rows={6}
                    maxLength={2000}
                    required
                  />
                  <div className="character-count">
                    {newTicket.description.length}/2000 characters
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="attachments">Attachments (Optional)</label>
                  <input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip"
                  />
                  <div className="file-help">
                    You can upload images, documents, or other files (max 10MB each)
                  </div>
                  {selectedFiles.length > 0 && (
                    <div className="selected-files">
                      <h5>Selected files:</h5>
                      {selectedFiles.map((file, index) => (
                        <div key={index} className="selected-file">
                          📎 {file.name} ({Math.round(file.size / 1024)} KB)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => setShowNewTicketForm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactUs;