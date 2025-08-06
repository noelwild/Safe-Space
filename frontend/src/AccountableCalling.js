import React, { useState, useEffect, useRef } from 'react';
import './AccountableCalling.css';

function AccountableCalling({ currentUser }) {
  const [activeTab, setActiveTab] = useState('schedule');
  const [pendingCalls, setPendingCalls] = useState([]);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
  const [currentCall, setCurrentCall] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callTranscription, setCallTranscription] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [callAnalysis, setCallAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  
  // Call scheduling form state
  const [scheduleForm, setScheduleForm] = useState({
    recipient_name: currentUser?.otherParentName || '',
    recipient_email: currentUser?.otherParentEmail || '',
    scheduled_date: '',
    scheduled_time: '',
    duration_minutes: 30,
    notes: ''
  });

  // WebRTC and Speech Recognition refs
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const transcriptionIntervalRef = useRef(null);

  // Initialize component
  useEffect(() => {
    loadPendingCalls();
    loadScheduledCalls();
    loadCallHistory();
    
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleForm(prev => ({
      ...prev,
      scheduled_date: tomorrow.toISOString().split('T')[0]
    }));
  }, []);

  // Load data functions
  const loadPendingCalls = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingCalls(data);
      }
    } catch (error) {
      console.error('Error loading pending calls:', error);
    }
  };

  const loadScheduledCalls = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/scheduled`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setScheduledCalls(data);
      }
    } catch (error) {
      console.error('Error loading scheduled calls:', error);
    }
  };

  const loadCallHistory = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCallHistory(data);
      }
    } catch (error) {
      console.error('Error loading call history:', error);
    }
  };

  // Schedule a new call
  const handleScheduleCall = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(scheduleForm)
      });

      if (response.ok) {
        const data = await response.json();
        alert('Call scheduled successfully! The other parent will receive an email notification.');
        
        // Reset form
        setScheduleForm({
          recipient_name: currentUser?.otherParentName || '',
          recipient_email: currentUser?.otherParentEmail || '',
          scheduled_date: '',
          scheduled_time: '',
          duration_minutes: 30,
          notes: ''
        });
        
        // Reload data
        loadScheduledCalls();
        setActiveTab('manage');
      } else {
        const error = await response.json();
        alert(`Error scheduling call: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error scheduling call:', error);
      alert('An error occurred while scheduling the call');
    }
  };

  // Respond to call invitation
  const handleCallResponse = async (callId, response) => {
    try {
      const result = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/${callId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          scheduled_call_id: callId, 
          response: response 
        })
      });

      if (result.ok) {
        alert(response === 'accept' ? 'Call accepted!' : 'Call rejected');
        loadPendingCalls();
        loadScheduledCalls();
      } else {
        const error = await result.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error responding to call:', error);
      alert('An error occurred while responding to the call');
    }
  };

  // Join a call
  const handleJoinCall = async (callId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/${callId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentCall(data);
        
        if (data.both_joined && data.call_active) {
          startCall(data);
        } else {
          setIsInCall(true);  // Waiting for other party
        }
      } else {
        const error = await response.json();
        alert(`Error joining call: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error joining call:', error);
      alert('An error occurred while joining the call');
    }
  };

  // Start WebRTC call
  const startCall = async (callData) => {
    try {
      setIsInCall(true);
      
      // Get user media (audio only)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      
      localStreamRef.current = stream;
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      // Initialize speech recognition
      initializeSpeechRecognition();
      
      // Start transcription monitoring
      setIsRecording(true);
      
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Could not access microphone. Please check your permissions.');
      setIsInCall(false);
    }
  };

  // Initialize Web Speech API
  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = 0; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          const transcriptionData = {
            call_session_id: currentCall.session_id,
            speaker: currentUser.fullName,
            transcript_text: finalTranscript,
            confidence_score: event.results[event.results.length - 1][0].confidence || 0.9,
            is_final: true
          };
          
          // Send to backend for AI analysis
          sendTranscription(transcriptionData);
          
          // Add to local transcription display
          setCallTranscription(prev => [...prev, {
            speaker: currentUser.fullName,
            text: finalTranscript,
            timestamp: new Date().toLocaleTimeString(),
            isCurrentUser: true
          }]);
        }
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
      };
      
      speechRecognitionRef.current = recognition;
      recognition.start();
    } else {
      console.warn('Speech recognition not supported in this browser');
      alert('Speech recognition is not supported in your browser. The call will continue without transcription.');
    }
  };

  // Send transcription to backend for AI analysis
  const sendTranscription = async (transcriptionData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/sessions/${currentCall.session_id}/transcription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(transcriptionData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Log violation but continue call (no automatic termination)
        if (result.violation_detected) {
          console.warn('Policy concern detected:', result.message);
          // Could show a subtle warning in UI if desired
        }
      }
    } catch (error) {
      console.error('Error sending transcription:', error);
    }
  };

  // Report a violation
  const handleReportViolation = async (reportData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/sessions/${currentCall.session_id}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(reportData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Report submitted successfully at ${result.timestamp}. Call continues for documentation purposes.`);
        
        // Add the report to the transcription display
        setCallTranscription(prev => [...prev, {
          speaker: 'SYSTEM',
          text: `[MANUAL REPORT] ${reportData.reason}: ${reportData.description}`,
          timestamp: new Date(result.timestamp).toLocaleTimeString(),
          isCurrentUser: false,
          isReport: true
        }]);
      } else {
        const error = await response.json();
        alert(`Error submitting report: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error reporting violation:', error);
      alert('An error occurred while submitting the report');
    }
    
    setShowReportModal(false);
  };

  // End call
  const endCall = async (reason = 'normal') => {
    try {
      // Stop speech recognition
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      
      // Stop local media
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // End call on backend
      if (currentCall && currentCall.session_id) {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/sessions/${currentCall.session_id}/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            call_session_id: currentCall.session_id,
            end_reason: reason
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Show analysis results if available
          if (result.analysis_completed && result.call_summary) {
            setCallAnalysis({
              summary: result.call_summary,
              safety_score: result.safety_score,
              violations_detected: result.violations_detected,
              session_id: currentCall.session_id
            });
            setShowAnalysisModal(true);
          } else {
            alert('Call ended successfully.');
          }
        }
      }
      
      // Reset state
      setIsInCall(false);
      setCurrentCall(null);
      setCallTranscription([]);
      setIsRecording(false);
      
      // Reload data
      loadScheduledCalls();
      loadCallHistory();
      
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // View detailed call analysis
  const viewCallAnalysis = async (sessionId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calls/sessions/${sessionId}/analysis`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (response.ok) {
        const analysisData = await response.json();
        if (analysisData.analysis_available) {
          setCallAnalysis({
            summary: analysisData.call_summary,
            content_analysis: analysisData.content_analysis,
            safety_score: analysisData.safety_score,
            violations_detected: analysisData.violations_detected,
            violation_details: analysisData.violation_details,
            recommendations: analysisData.recommendations,
            analysis_date: analysisData.analysis_date,
            session_id: sessionId
          });
          setShowAnalysisModal(true);
        } else {
          alert('Analysis not yet available for this call.');
        }
      } else {
        const error = await response.json();
        alert(`Error loading analysis: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error loading call analysis:', error);
      alert('An error occurred while loading the call analysis');
    }
  };

  return (
    <div className="accountable-calling">
      <div className="calling-header">
        <h1>📞 Accountable Calling</h1>
        <p>Schedule secure voice calls with live transcription and safety monitoring</p>
      </div>

      {!isInCall ? (
        <>
          <div className="calling-tabs">
            <button 
              className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              Schedule Call
            </button>
            <button 
              className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Invitations ({pendingCalls.length})
            </button>
            <button 
              className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('manage')}
            >
              Scheduled Calls
            </button>
            <button 
              className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Call History
            </button>
          </div>

          <div className="calling-content">
            {activeTab === 'schedule' && (
              <div className="schedule-call-section">
                <h2>Schedule a New Call</h2>
                <form onSubmit={handleScheduleCall} className="schedule-form">
                  <div className="form-group">
                    <label htmlFor="recipient_name">Other Parent Name:</label>
                    <input
                      type="text"
                      id="recipient_name"
                      value={scheduleForm.recipient_name}
                      onChange={(e) => setScheduleForm(prev => ({...prev, recipient_name: e.target.value}))}
                      required
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="recipient_email">Other Parent Email:</label>
                    <input
                      type="email"
                      id="recipient_email"
                      value={scheduleForm.recipient_email}
                      onChange={(e) => setScheduleForm(prev => ({...prev, recipient_email: e.target.value}))}
                      required
                      disabled
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="scheduled_date">Date:</label>
                      <input
                        type="date"
                        id="scheduled_date"
                        value={scheduleForm.scheduled_date}
                        onChange={(e) => setScheduleForm(prev => ({...prev, scheduled_date: e.target.value}))}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="scheduled_time">Time:</label>
                      <input
                        type="time"
                        id="scheduled_time"
                        value={scheduleForm.scheduled_time}
                        onChange={(e) => setScheduleForm(prev => ({...prev, scheduled_time: e.target.value}))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="duration_minutes">Duration (minutes):</label>
                    <select
                      id="duration_minutes"
                      value={scheduleForm.duration_minutes}
                      onChange={(e) => setScheduleForm(prev => ({...prev, duration_minutes: parseInt(e.target.value)}))}
                      required
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={25}>25 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={35}>35 minutes</option>
                      <option value={40}>40 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={50}>50 minutes</option>
                      <option value={55}>55 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="notes">Notes (optional):</label>
                    <textarea
                      id="notes"
                      value={scheduleForm.notes}
                      onChange={(e) => setScheduleForm(prev => ({...prev, notes: e.target.value}))}
                      placeholder="Add any notes about the call topic or agenda..."
                      rows={3}
                    />
                  </div>

                  <button type="submit" className="schedule-btn">
                    Schedule Call
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="pending-calls-section">
                <h2>Pending Call Invitations</h2>
                {pendingCalls.length === 0 ? (
                  <div className="no-calls">
                    <p>No pending call invitations</p>
                  </div>
                ) : (
                  <div className="calls-list">
                    {pendingCalls.map(call => (
                      <div key={call.id} className="call-item pending">
                        <div className="call-info">
                          <h3>Call from {call.caller_name}</h3>
                          <p><strong>Date:</strong> {call.scheduled_date}</p>
                          <p><strong>Time:</strong> {call.scheduled_time}</p>
                          <p><strong>Duration:</strong> {call.duration_minutes} minutes</p>
                          {call.notes && <p><strong>Notes:</strong> {call.notes}</p>}
                        </div>
                        <div className="call-actions">
                          <button 
                            className="accept-btn"
                            onClick={() => handleCallResponse(call.id, 'accept')}
                          >
                            Accept
                          </button>
                          <button 
                            className="reject-btn"
                            onClick={() => handleCallResponse(call.id, 'reject')}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'manage' && (
              <div className="scheduled-calls-section">
                <h2>Scheduled Calls</h2>
                {scheduledCalls.length === 0 ? (
                  <div className="no-calls">
                    <p>No scheduled calls</p>
                  </div>
                ) : (
                  <div className="calls-list">
                    {scheduledCalls.map(call => (
                      <div key={call.id} className={`call-item ${call.status}`}>
                        <div className="call-info">
                          <h3>
                            {call.is_caller ? `Call with ${call.recipient_name}` : `Call from ${call.caller_name}`}
                          </h3>
                          <p><strong>Date:</strong> {call.scheduled_date}</p>
                          <p><strong>Time:</strong> {call.scheduled_time}</p>
                          <p><strong>Duration:</strong> {call.duration_minutes} minutes</p>
                          <p><strong>Status:</strong> <span className={`status ${call.status}`}>{call.status}</span></p>
                          {call.notes && <p><strong>Notes:</strong> {call.notes}</p>}
                        </div>
                        <div className="call-actions">
                          {call.status === 'accepted' && call.can_join && (
                            <button 
                              className="join-btn"
                              onClick={() => handleJoinCall(call.id)}
                            >
                              {call.is_live ? '🔴 Join Live Call' : 'Join Call'}
                            </button>
                          )}
                          {call.status === 'accepted' && !call.can_join && (
                            <span className="join-info">
                              {call.is_live ? 'Call is live - you can join now' : 'Call not ready yet'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="call-history-section">
                <h2>Call History</h2>
                {callHistory.length === 0 ? (
                  <div className="no-calls">
                    <p>No call history yet</p>
                  </div>
                ) : (
                  <div className="calls-list">
                    {callHistory.map(call => (
                      <div key={call.id} className={`call-item history ${call.status}`}>
                        <div className="call-info">
                          <h3>
                            {call.is_caller ? `Call with ${call.recipient_name}` : `Call from ${call.caller_name}`}
                          </h3>
                          <p><strong>Date:</strong> {call.scheduled_date} at {call.scheduled_time}</p>
                          <p><strong>Duration:</strong> {call.duration_minutes} minutes scheduled</p>
                          {call.actual_duration_seconds && (
                            <p><strong>Actual Duration:</strong> {Math.floor(call.actual_duration_seconds / 60)} minutes</p>
                          )}
                          <p><strong>Status:</strong> <span className={`status ${call.status}`}>{call.status}</span></p>
                          {call.end_reason && (
                            <p><strong>End Reason:</strong> {call.end_reason.replace('_', ' ')}</p>
                          )}
                          
                          {/* AI Analysis Summary */}
                          {call.has_analysis && call.call_summary && (
                            <div className="ai-summary">
                              <p><strong>📋 Call Summary:</strong> {call.call_summary}</p>
                              {call.safety_score && (
                                <p><strong>🛡️ Safety Score:</strong> 
                                  <span className={`safety-score score-${Math.floor(call.safety_score / 2)}`}>
                                    {call.safety_score}/10
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                          
                          {call.report_count > 0 && (
                            <p className="warning"><strong>Reports:</strong> {call.report_count}</p>
                          )}
                          {call.ai_violations_detected > 0 && (
                            <p className="warning"><strong>AI Violations Detected:</strong> {call.ai_violations_detected}</p>
                          )}
                        </div>
                        
                        {/* Analysis Button */}
                        {call.has_analysis && call.session_id && (
                          <div className="call-actions">
                            <button 
                              className="analysis-btn"
                              onClick={() => viewCallAnalysis(call.session_id)}
                            >
                              📊 View Full Analysis
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        // In-call interface
        <div className="in-call-interface">
          <div className="call-header">
            <h2>🔴 Call in Progress</h2>
            <p>
              {currentCall?.is_caller 
                ? `Calling ${currentCall?.recipient_name || 'Other Parent'}` 
                : `Call with ${currentCall?.caller_name || 'Other Parent'}`
              }
            </p>
            {currentCall && (
              <p>Scheduled for {currentCall.duration_minutes} minutes</p>
            )}
          </div>

          <div className="call-content">
            {/* Audio elements (hidden) */}
            <audio ref={localAudioRef} autoPlay muted style={{display: 'none'}} />
            <audio ref={remoteAudioRef} autoPlay style={{display: 'none'}} />

            {/* Transcription display */}
            <div className="transcription-section">
              <h3>Live Transcription {isRecording && <span className="recording-indicator">🔴 Recording</span>}</h3>
              <div className="transcription-display">
                {callTranscription.length === 0 ? (
                  <p className="no-transcription">Transcription will appear here as you speak...</p>
                ) : (
                  callTranscription.map((item, index) => (
                    <div key={index} className={`transcription-item ${item.isCurrentUser ? 'current-user' : 'other-user'} ${item.isReport ? 'report-item' : ''}`}>
                      <span className="speaker">{item.speaker}:</span>
                      <span className="text">{item.text}</span>
                      <span className="timestamp">{item.timestamp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Call controls */}
            <div className="call-controls">
              <button 
                className="end-call-btn"
                onClick={() => endCall('normal')}
              >
                🔚 Hang Up
              </button>
              <button 
                className="report-btn"
                onClick={() => setShowReportModal(true)}
              >
                ⚠️ Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal 
          onSubmit={handleReportViolation}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Call Analysis Modal */}
      {showAnalysisModal && callAnalysis && (
        <CallAnalysisModal 
          analysis={callAnalysis}
          onClose={() => {
            setShowAnalysisModal(false);
            setCallAnalysis(null);
          }}
        />
      )}
    </div>
  );
}

// Report Modal Component
function ReportModal({ onSubmit, onClose }) {
  const [reportData, setReportData] = useState({
    report_type: 'policy_violation',
    reason: '',
    description: '',
    transcript_segment: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reportData.reason.trim()) {
      alert('Please provide a reason for the report');
      return;
    }
    onSubmit(reportData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Report Call Violation</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label htmlFor="report_type">Report Type:</label>
            <select
              id="report_type"
              value={reportData.report_type}
              onChange={(e) => setReportData(prev => ({...prev, report_type: e.target.value}))}
              required
            >
              <option value="policy_violation">Policy Violation</option>
              <option value="inappropriate_behavior">Inappropriate Behavior</option>
              <option value="threatening_language">Threatening Language</option>
              <option value="harassment">Harassment</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason:</label>
            <input
              type="text"
              id="reason"
              value={reportData.reason}
              onChange={(e) => setReportData(prev => ({...prev, reason: e.target.value}))}
              placeholder="Brief description of the violation"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Detailed Description:</label>
            <textarea
              id="description"
              value={reportData.description}
              onChange={(e) => setReportData(prev => ({...prev, description: e.target.value}))}
              placeholder="Provide more details about what happened..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label htmlFor="transcript_segment">Relevant Quote (if applicable):</label>
            <textarea
              id="transcript_segment"
              value={reportData.transcript_segment}
              onChange={(e) => setReportData(prev => ({...prev, transcript_segment: e.target.value}))}
              placeholder="Quote the specific words that violated policy..."
              rows={2}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-report-btn">
              Submit Report & End Call
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Call Analysis Modal Component
function CallAnalysisModal({ analysis, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal analysis-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📊 Call Analysis Results</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body analysis-content">
          {/* Safety Score */}
          <div className="analysis-section">
            <h4>🛡️ Safety Assessment</h4>
            <div className="safety-score-display">
              <span className={`safety-score-large score-${Math.floor(analysis.safety_score / 2)}`}>
                {analysis.safety_score}/10
              </span>
              <span className="safety-description">
                {analysis.safety_score >= 8 ? 'Excellent Communication' :
                 analysis.safety_score >= 6 ? 'Good Communication' :
                 analysis.safety_score >= 4 ? 'Acceptable Communication' :
                 'Communication Concerns'}
              </span>
            </div>
          </div>

          {/* Call Summary */}
          <div className="analysis-section">
            <h4>📋 Call Summary</h4>
            <p>{analysis.summary}</p>
          </div>

          {/* Detailed Analysis */}
          {analysis.content_analysis && (
            <div className="analysis-section">
              <h4>🔍 Content Analysis</h4>
              <p>{analysis.content_analysis}</p>
            </div>
          )}

          {/* Violations */}
          {analysis.violations_detected > 0 && (
            <div className="analysis-section violations">
              <h4>⚠️ Policy Concerns ({analysis.violations_detected})</h4>
              {analysis.violation_details && analysis.violation_details.map((violation, index) => (
                <div key={index} className="violation-item">
                  <strong>{violation.timestamp || 'During call'}:</strong> {violation.reason || violation.text}
                  {violation.type === 'manual_report' && (
                    <span className="violation-type">Manual Report by {violation.reported_by}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <div className="analysis-section">
              <h4>💡 Recommendations</h4>
              <ul>
                {analysis.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Analysis Date */}
          {analysis.analysis_date && (
            <div className="analysis-footer">
              <small>Analysis completed on {new Date(analysis.analysis_date).toLocaleString()}</small>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-analysis-btn" onClick={onClose}>
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
}

export default AccountableCalling;