import React, { useState, useEffect, useRef } from 'react';
import './MessagingApp.css';
import SharedCalendar from './SharedCalendar';
import AccountablePayments from './AccountablePayments';
import InfoLibrary from './InfoLibrary';
import UnalterableRecords from './UnalterableRecords';
import PersonalJournal from './PersonalJournal';
import ContactUs from './ContactUs';
import AccountSettings from './AccountSettings';
import HelpCenter from './HelpCenter';
import AccountableCalling from './AccountableCalling';

function MessagingApp({ user, authToken, onSignOut, onUpdateUser }) {
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [ws, setWs] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [activeView, setActiveView] = useState('messaging');
  
  // Parent switching state
  const [relationships, setRelationships] = useState([]);
  const [activeRelationship, setActiveRelationship] = useState(null);
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  
  // Enhanced messaging state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Use real user data or fallback
  const currentUser = user || {
    fullName: 'John Doe',
    preferredName: 'John',
    email: 'john@example.com',
    role: 'Father'
  };

  // Get display name for user
  const getDisplayName = () => {
    return currentUser.preferredName || currentUser.fullName || currentUser.name || 'User';
  };

  // Get full name for API calls
  const getFullName = () => {
    return currentUser.fullName || currentUser.name || 'User';
  };
  
  // Sidebar navigation items
  const navigationItems = [
    { id: 'messaging', label: 'Secure Messaging', icon: '💬', active: activeView === 'messaging' },
    { id: 'calling', label: 'Accountable Calling', icon: '📞', active: activeView === 'calling' },
    { id: 'calendar', label: 'Shared Calendar', icon: '📅', active: activeView === 'calendar' },
    { id: 'payments', label: 'Responsible Finances', icon: '💳', active: activeView === 'payments' },
    { id: 'info', label: 'Info Library', icon: '📚', active: activeView === 'info' },
    { id: 'records', label: 'Records Vault', icon: '📋', active: activeView === 'records' },
    { id: 'journal', label: 'Personal Journal', icon: '📖', active: activeView === 'journal' },
    { id: 'settings', label: 'Account Settings', icon: '⚙️', active: activeView === 'settings' },
    { id: 'help', label: 'Help Center', icon: '❓', active: activeView === 'help' },
    { id: 'contact', label: 'Contact Us', icon: '📧', active: activeView === 'contact' }
  ];

  // Parent switching functions
  const loadUserRelationships = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/relationships`, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      if (response.ok) {
        const data = await response.json();
        setRelationships(data.relationships);
        // Set first relationship as active if none selected
        if (data.relationships.length > 0 && !activeRelationship) {
          setActiveRelationship(data.relationships[0]);
        }
      }
    } catch (error) {
      console.error('Error loading relationships:', error);
    }
  };

  const switchParentContext = async (relationship) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/user/switch-parent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          relationship_id: relationship.relationship_id
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveRelationship({
          ...relationship,
          children: data.children
        });
        setShowParentDropdown(false);
        
        // Reload data for new relationship context
        loadConversations();
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error switching parent context:', error);
    }
  };

  // Load conversations from API
  const loadConversations = async () => {
    try {
      const url = activeRelationship 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/conversation?relationship_id=${activeRelationship.relationship_id}`
        : `${process.env.REACT_APP_BACKEND_URL}/api/conversation`;
        
      const response = await fetch(url, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      if (response.ok) {
        const data = await response.json();
        const formattedConversations = data.map(conv => ({
          id: conv[0],
          title: conv[1],
          date: new Date(conv[2]).toLocaleDateString('en-AU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          preview: 'Click to view messages...',
          unread: false
        }));
        setConversations(formattedConversations);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Load messages for selected conversation
  const loadMessages = async (conversationId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/conversation/${conversationId}/messages`, {
        headers: authToken ? {
          'Authorization': `Bearer ${authToken}`
        } : {}
      });
      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.map(msg => ({
          id: msg[0],
          sender: msg[1] === getFullName() ? 'You' : msg[1],
          content: msg[3], // rewritten_message
          timestamp: new Date(msg[5]).toLocaleString('en-AU', {
            day: '2-digit',
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          isCurrentUser: msg[1] === getFullName(),
          aiProcessed: msg[2] !== msg[3], // original !== rewritten
          isRead: msg[9] || false, // is_read field
          readAt: msg[10], // read_at field
          readBy: msg[11], // read_by field
          hasAttachments: msg[13] || false, // has_attachments field
          attachmentCount: msg[14] || 0 // attachment_count field
        }));
        setMessages(formattedMessages);
        
        // Mark messages as read
        for (const msg of formattedMessages) {
          if (!msg.isCurrentUser && !msg.isRead) {
            await markMessageAsRead(msg.id);
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  // Mark message as read
  const markMessageAsRead = async (messageId) => {
    try {
      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/message/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          is_read: true,
          read_by: getFullName()
        })
      });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Search messages
  const searchMessages = async () => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/conversation/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          query: searchQuery,
          conversation_id: selectedConversation?.id
        })
      });

      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching messages:', error);
    }
  };

  // Export conversation
  const exportConversation = async (format = 'pdf') => {
    if (!selectedConversation) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/conversation/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          format: format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversation_${selectedConversation.id}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setShowExportModal(false);
      }
    } catch (error) {
      console.error('Error exporting conversation:', error);
    }
  };

  // Report conversation
  const reportConversation = async (reportData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/conversation/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          conversation_id: selectedConversation.id,
          report_type: reportData.type,
          reason: reportData.reason,
          description: reportData.description,
          reported_by: getFullName()
        })
      });

      if (response.ok) {
        setShowReportModal(false);
        alert('Report submitted successfully. Thank you for helping maintain a safe environment.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
    }
  };

  // Handle file selection for attachments
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
    setShowAttachmentModal(true);
  };

  // Upload attachments to message
  const uploadAttachments = async (messageId) => {
    if (selectedFiles.length === 0) return;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', getFullName());

      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/message/${messageId}/attachments`, {
          method: 'POST',
          headers: authToken ? {
            'Authorization': `Bearer ${authToken}`
          } : {},
          body: formData
        });

        if (response.ok) {
          setUploadProgress(((i + 1) / selectedFiles.length) * 100);
        }
      } catch (error) {
        console.error('Error uploading attachment:', error);
      }
    }

    setSelectedFiles([]);
    setUploadProgress(0);
    setShowAttachmentModal(false);
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Create new conversation
  const createConversation = async () => {
    if (!newConversationTitle.trim()) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          title: newConversationTitle
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newConv = {
          id: data.conversation_id,
          title: data.title,
          date: new Date().toLocaleDateString(),
          preview: 'New conversation created',
          unread: false
        };
        
        setConversations(prev => [newConv, ...prev]);
        setSelectedConversation(newConv);
        setMessages([]);
        setNewConversationTitle('');
        setShowNewConversationModal(false);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  useEffect(() => {
    // Initialize WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8001/ws`;
    
    try {
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        setConnectionStatus('Connected');
        console.log('WebSocket connected');
      };
      
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message_evaluation_result') {
          handleMessageProcessed(data);
        }
      };
      
      websocket.onclose = () => {
        setConnectionStatus('Disconnected');
        console.log('WebSocket disconnected');
      };
      
      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Connection Error');
      };
      
      setWs(websocket);
      
      return () => {
        websocket.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Connection Failed');
    }

    // Load initial data
    loadConversations();
  }, [authToken]);

  const handleMessageProcessed = (data) => {
    // Add the processed message to the conversation
    const newMsg = {
      id: data.message_id || Date.now(),
      sender: 'You',
      content: data.message,
      timestamp: data.timestamp || new Date().toLocaleString(),
      isCurrentUser: true,
      aiProcessed: data.evaluation === 'no',
      isRead: false,
      hasAttachments: false,
      attachmentCount: 0
    };
    
    setMessages(prev => [...prev, newMsg]);
    setNewMessage('');

    // Upload attachments if any were selected
    if (selectedFiles.length > 0 && data.message_id) {
      uploadAttachments(data.message_id);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!selectedConversation) {
      alert('Please select or create a conversation first');
      return;
    }

    // Get recipient role from user profile or default
    const recipientRole = currentUser.otherParentRole || (currentUser.role === 'Father' ? 'Mother' : 'Father');

    const messageData = {
      type: 'message_evaluation',
      user_name: getFullName(),
      user_email: currentUser.email,
      parental_role: currentUser.role,
      recipient_role: recipientRole,
      message: newMessage,
      conversation_id: selectedConversation.id
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(messageData));
    } else {
      // Fallback to HTTP API
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/evaluate_message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
          },
          body: JSON.stringify(messageData)
        });

        if (response.ok) {
          const data = await response.json();
          handleMessageProcessed({
            type: 'message_evaluation_result',
            evaluation: data.evaluation,
            message: data.message,
            message_id: data.message_id,
            timestamp: new Date().toLocaleString()
          });
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const selectConversation = (conversation) => {
    setSelectedConversation(conversation);
    loadMessages(conversation.id);
    setShowSearchResults(false);
  };

  // Navigation handler
  const handleNavigation = (itemId) => {
    if (itemId === 'messaging' || itemId === 'calling' || itemId === 'calendar' || itemId === 'payments' || 
        itemId === 'info' || itemId === 'records' || itemId === 'journal' || 
        itemId === 'contact' || itemId === 'settings' || 
        itemId === 'help') {
      setActiveView(itemId);
    }
  };

  // Generate user initials for avatar
  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Get other parent name for messaging header
  const getOtherParentName = () => {
    return activeRelationship ? activeRelationship.other_parent_name : 'Other Parent';
  };

  // Load initial data
  useEffect(() => {
    loadUserRelationships();
  }, [authToken]);

  useEffect(() => {
    loadConversations();
  }, [activeRelationship, authToken]);

  return (
    <div className="messaging-app">
      {/* Left Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="logo-with-dropdown">
            <div className="logo">
              <div className="logo-icon">🛡️</div>
              <span className="logo-text">Safespace</span>
            </div>
            
            {/* Parent Switching Dropdown */}
            {relationships.length > 0 && (
              <div className="parent-dropdown-container">
                <button 
                  className="parent-dropdown-trigger"
                  onClick={() => setShowParentDropdown(!showParentDropdown)}
                >
                  <span className="dropdown-label">
                    {activeRelationship ? activeRelationship.other_parent_name : 'Select Parent'}
                  </span>
                  <span className={`dropdown-arrow ${showParentDropdown ? 'open' : ''}`}>▼</span>
                </button>
                
                {showParentDropdown && (
                  <div className="parent-dropdown-menu">
                    {relationships.map(relationship => (
                      <div 
                        key={relationship.relationship_id}
                        className={`dropdown-item ${activeRelationship?.relationship_id === relationship.relationship_id ? 'active' : ''}`}
                        onClick={() => switchParentContext(relationship)}
                      >
                        <div className="parent-info">
                          <div className="parent-name">{relationship.other_parent_name}</div>
                          <div className="parent-details">
                            {relationship.other_parent_role} • {relationship.children_count} child{relationship.children_count !== 1 ? 'ren' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {navigationItems.map(item => (
            <div 
              key={item.id} 
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => handleNavigation(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">{getUserInitials(getFullName())}</div>
            <div className="user-info">
              <div className="user-name">{getDisplayName()}</div>
              <div className="user-email">{currentUser.email}</div>
            </div>
          </div>
          <div className="connection-status">
            <span className={`status-dot ${connectionStatus.toLowerCase().replace(' ', '-')}`}></span>
            <span className="status-text">{connectionStatus}</span>
          </div>
          
          {onSignOut && (
            <button className="sign-out-btn" onClick={onSignOut}>
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {activeView === 'messaging' && (
          <>
            {/* Conversation List */}
            <div className="conversation-list">
              <div className="conversation-header">
                <h2>💬 Messaging with {getOtherParentName()}</h2>
                <button 
                  className="new-message-btn"
                  onClick={() => setShowNewConversationModal(true)}
                >
                  New conversation
                </button>
              </div>
              
              <div className="filter-section">
                <div className="search-container">
                  <input 
                    type="text" 
                    placeholder="Search conversations and messages..." 
                    className="search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchMessages()}
                  />
                  <button 
                    className="search-btn"
                    onClick={searchMessages}
                    disabled={!searchQuery.trim()}
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* Search Results */}
              {showSearchResults && (
                <div className="search-results">
                  <div className="search-results-header">
                    <h3>Search Results ({searchResults.length})</h3>
                    <button 
                      className="close-search-btn"
                      onClick={() => setShowSearchResults(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="search-results-list">
                    {searchResults.length === 0 ? (
                      <p>No messages found matching your search.</p>
                    ) : (
                      searchResults.map(result => (
                        <div 
                          key={result[0]} 
                          className="search-result-item"
                          onClick={() => {
                            // Find and select the conversation
                            const conv = conversations.find(c => c.id === result[5]);
                            if (conv) {
                              selectConversation(conv);
                            }
                          }}
                        >
                          <div className="result-conversation">{result[10] || 'Unknown Conversation'}</div>
                          <div className="result-content">{result[4]}</div>
                          <div className="result-meta">
                            <span className="result-sender">{result[1]}</span>
                            <span className="result-date">{new Date(result[6]).toLocaleString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="conversations">
                {conversations.length === 0 ? (
                  <div className="no-conversations">
                    <p>No conversations yet</p>
                    <button 
                      className="create-first-conversation"
                      onClick={() => setShowNewConversationModal(true)}
                    >
                      Create your first conversation
                    </button>
                  </div>
                ) : (
                  conversations.map(conversation => (
                    <div 
                      key={conversation.id}
                      className={`conversation-item ${selectedConversation?.id === conversation.id ? 'selected' : ''}`}
                      onClick={() => selectConversation(conversation)}
                    >
                      <div className="conversation-header">
                        <h3 className="conversation-title">{conversation.title}</h3>
                        <span className="conversation-date">{conversation.date}</span>
                      </div>
                      <p className="conversation-preview">{conversation.preview}</p>
                      {conversation.unread && <div className="unread-indicator"></div>}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Message Thread */}
            <div className="message-thread">
              {!selectedConversation ? (
                <div className="no-conversation-selected">
                  <div className="empty-state">
                    <h3>Select a conversation to start messaging</h3>
                    <p>Choose an existing conversation or create a new one to begin secure communication.</p>
                    <button 
                      className="create-conversation-btn"
                      onClick={() => setShowNewConversationModal(true)}
                    >
                      Create New Conversation
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="thread-header">
                    <h3>{selectedConversation.title}</h3>
                    <div className="thread-actions">
                      <div className="more-options-container">
                        <button 
                          className="action-btn more-options-btn"
                          onClick={() => setShowMoreOptions(!showMoreOptions)}
                          title="More Options"
                        >
                          ⋯
                        </button>
                        {showMoreOptions && (
                          <div className="more-options-menu">
                            <button 
                              className="option-btn"
                              onClick={() => {
                                setShowExportModal(true);
                                setShowMoreOptions(false);
                              }}
                            >
                              📤 Export Conversation
                            </button>
                            <button 
                              className="option-btn"
                              onClick={() => {
                                setShowReportModal(true);
                                setShowMoreOptions(false);
                              }}
                            >
                              🚨 Report Conversation
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="messages-container">
                    {messages.length === 0 ? (
                      <div className="no-messages">
                        <p>No messages in this conversation yet.</p>
                        <p>Start a conversation below - all messages are AI-enhanced for safety.</p>
                      </div>
                    ) : (
                      messages.map(message => (
                        <div 
                          key={message.id} 
                          className={`message ${message.isCurrentUser ? 'sent' : 'received'}`}
                        >
                          <div className="message-content">
                            <p>{message.content}</p>
                            {message.hasAttachments && (
                              <div className="message-attachments">
                                📎 {message.attachmentCount} attachment{message.attachmentCount > 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="message-meta">
                            <span className="timestamp">{message.timestamp}</span>
                            {!message.isCurrentUser && message.isRead && (
                              <span className="read-receipt">
                                👁️ Read by {message.readBy} on {new Date(message.readAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="message-input-container">
                    <div className="input-actions">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        multiple
                        style={{ display: 'none' }}
                        accept="image/*,application/pdf,.doc,.docx,.txt"
                      />
                      <button 
                        className="attachment-btn"
                        onClick={() => fileInputRef.current.click()}
                      >
                        📎 Add attachments
                      </button>
                    </div>
                    <div className="message-input-wrapper">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message (AI will enhance for safety)"
                        className="message-input"
                        rows={3}
                      />
                      <button 
                        onClick={sendMessage}
                        className="send-btn"
                        disabled={!newMessage.trim() || !selectedConversation}
                      >
                        Send
                      </button>
                    </div>
                    <div className="character-count">Max 50,000 characters</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeView === 'calling' && (
          <AccountableCalling currentUser={currentUser} />
        )}

        {activeView === 'calendar' && (
          <SharedCalendar currentUser={currentUser} activeRelationship={activeRelationship} />
        )}

        {activeView === 'payments' && (
          <AccountablePayments currentUser={currentUser} />
        )}

        {activeView === 'info' && (
          <InfoLibrary currentUser={currentUser} />
        )}

        {activeView === 'records' && (
          <UnalterableRecords currentUser={currentUser} />
        )}

        {activeView === 'journal' && (
          <PersonalJournal currentUser={currentUser} />
        )}

        {activeView === 'contact' && (
          <ContactUs currentUser={currentUser} />
        )}

        {activeView === 'settings' && (
          <AccountSettings 
            currentUser={currentUser} 
            onUpdateUser={onUpdateUser}
          />
        )}

        {activeView === 'help' && (
          <HelpCenter currentUser={currentUser} />
        )}

        {/* Enhanced Modals */}
        
        {/* New Conversation Modal */}
        {showNewConversationModal && (
          <div className="modal-overlay" onClick={() => setShowNewConversationModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Create New Conversation</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowNewConversationModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <label htmlFor="conversationTitle">Conversation Title:</label>
                <input
                  id="conversationTitle"
                  type="text"
                  value={newConversationTitle}
                  onChange={(e) => setNewConversationTitle(e.target.value)}
                  placeholder="Enter conversation title (e.g., 'School pickup arrangements')"
                  className="conversation-title-input"
                  maxLength={100}
                />
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowNewConversationModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="create-btn"
                  onClick={createConversation}
                  disabled={!newConversationTitle.trim()}
                >
                  Create Conversation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📤 Export Conversation</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowExportModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Export this conversation for legal or backup purposes.</p>
                <div className="export-info">
                  <p><strong>Conversation:</strong> {selectedConversation?.title}</p>
                  <p><strong>Format:</strong> PDF with Safe space verification header</p>
                  <p><strong>Content:</strong> All messages with timestamps and hash verification</p>
                  <p><strong>Legal Use:</strong> Court-ready with cryptographic integrity proof</p>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="export-btn"
                  onClick={() => exportConversation('pdf')}
                >
                  Export as PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {showReportModal && (
          <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🚨 Report Conversation</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowReportModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <ReportForm 
                  onSubmit={reportConversation}
                  onCancel={() => setShowReportModal(false)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Attachment Modal */}
        {showAttachmentModal && (
          <div className="modal-overlay" onClick={() => setShowAttachmentModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>📎 Upload Attachments</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowAttachmentModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Selected files will be uploaded with your message:</p>
                <div className="selected-files">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                    </div>
                  ))}
                </div>
                {uploadProgress > 0 && (
                  <div className="upload-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <span>{Math.round(uploadProgress)}% uploaded</span>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setSelectedFiles([]);
                    setShowAttachmentModal(false);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="upload-btn"
                  onClick={() => {
                    // Files will be uploaded after message is sent
                    setShowAttachmentModal(false);
                  }}
                >
                  Ready to Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Report Form Component
function ReportForm({ onSubmit, onCancel }) {
  const [reportType, setReportType] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const reportTypes = [
    { value: 'inappropriate_content', label: 'Inappropriate Content' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'policy_violation', label: 'Policy Violation' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reportType && reason) {
      onSubmit({
        type: reportType,
        reason: reason,
        description: description
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="report-form">
      <div className="form-group">
        <label htmlFor="reportType">Report Type:</label>
        <select
          id="reportType"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          required
        >
          <option value="">Select report type...</option>
          {reportTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="reason">Reason:</label>
        <input
          id="reason"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Brief reason for reporting..."
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description (Optional):</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details about the issue..."
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button 
          type="submit" 
          className="submit-btn"
          disabled={!reportType || !reason}
        >
          Submit Report
        </button>
      </div>
    </form>
  );
}

export default MessagingApp;