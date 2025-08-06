import React, { useState, useEffect } from 'react';
import './SharedCalendar.css';

function SharedCalendar({ currentUser, activeRelationship }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [eventForm, setEventForm] = useState({
    event_label: '',
    event_time: '',
    repeat_occurrence: 'none',
    created_by: currentUser?.name || 'Unknown User',
    relationship_id: null
  });

  // Calendar navigation
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Load events from API with soft delete support
  const loadEvents = async () => {
    setLoading(true);
    try {
      const url = activeRelationship 
        ? `${process.env.REACT_APP_BACKEND_URL}/api/calendar?relationship_id=${activeRelationship.relationship_id}&show_deleted=true`
        : `${process.env.REACT_APP_BACKEND_URL}/api/calendar?show_deleted=true`;
        
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const formattedEvents = data.map(event => ({
          id: event.id,
          title: event.title,
          datetime: event.datetime,
          recurrence: event.recurrence,
          createdBy: event.createdBy,
          createdDate: event.createdDate,
          isActive: event.is_active,
          isDeleted: event.is_deleted,
          deletedDate: event.deleted_date,
          deletedBy: event.deleted_by
        }));
        setEvents(formattedEvents);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create or update event (editing prevented as per requirements)
  const saveEvent = async () => {
    if (!eventForm.event_label || !eventForm.event_time) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      let response;
      
      if (selectedEvent && selectedEvent.createdBy === currentUser?.name) {
        // Prevent editing as per requirements
        alert('Events cannot be edited once created');
        return;
      } else {
        // Create new event
        const eventData = {
          ...eventForm,
          relationship_id: activeRelationship?.relationship_id || null
        };
        
        response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData)
        });
      }

      if (response.ok) {
        await loadEvents();
        setShowEventModal(false);
        resetEventForm();
      } else {
        const error = await response.json();
        alert(error.detail || 'Error saving event');
      }
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event');
    }
  };

  // Soft delete event
  const deleteEvent = async () => {
    if (!selectedEvent) return;
    
    if (selectedEvent.createdBy !== currentUser?.name) {
      alert('You can only delete events you created');
      return;
    }

    if (window.confirm('Are you sure you want to delete this event? It will remain visible but marked as deleted.')) {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/calendar/${selectedEvent.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            created_by: currentUser?.name
          })
        });

        if (response.ok) {
          await loadEvents();
          setShowEventModal(false);
          setSelectedEvent(null);
        } else {
          const error = await response.json();
          alert(error.detail || 'Error deleting event');
        }
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event');
      }
    }
  };

  const resetEventForm = () => {
    setEventForm({
      event_label: '',
      event_time: '',
      repeat_occurrence: 'none',
      created_by: currentUser?.name || 'Unknown User'
    });
    setSelectedEvent(null);
  };

  // Get calendar grid data
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDateObj = new Date(startDate);
    
    // Generate 42 days (6 weeks) for calendar grid
    for (let i = 0; i < 42; i++) {
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.datetime);
        return eventDate.toDateString() === currentDateObj.toDateString();
      });
      
      days.push({
        date: new Date(currentDateObj),
        isCurrentMonth: currentDateObj.getMonth() === month,
        isToday: currentDateObj.toDateString() === new Date().toDateString(),
        events: dayEvents
      });
      
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }
    
    return days;
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Event handlers
  const handleDateClick = (day) => {
    setEventForm({
      ...eventForm,
      event_time: day.date.toISOString().slice(0, 16) // Format for datetime-local input
    });
    setShowEventModal(true);
  };

  const handleEventClick = (event, e) => {
    e.stopPropagation();
    setSelectedEvent(event);
    // Show event details instead of edit modal (as editing is prevented)
    setShowEventDetails(true);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const calendarDays = getCalendarDays();

  return (
    <div className="shared-calendar">
      <div className="calendar-header">
        <div className="calendar-title">
          <h2>📅 Shared Family Calendar</h2>
          <p>Manage custody schedules, school events, and appointments</p>
        </div>
        
        <div className="calendar-controls">
          <button className="today-btn" onClick={goToToday}>
            Today
          </button>
          <button 
            className="new-event-btn"
            onClick={() => {
              setEventForm({
                ...eventForm,
                event_time: new Date().toISOString().slice(0, 16)
              });
              setShowEventModal(true);
            }}
          >
            New Event
          </button>
        </div>
      </div>

      <div className="calendar-navigation">
        <button className="nav-btn" onClick={goToPreviousMonth}>
          ←
        </button>
        <h3 className="current-month">
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h3>
        <button className="nav-btn" onClick={goToNextMonth}>
          →
        </button>
      </div>

      <div className="calendar-grid">
        <div className="calendar-header-row">
          {daysOfWeek.map(day => (
            <div key={day} className="calendar-day-header">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-body">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={`calendar-day ${
                !day.isCurrentMonth ? 'other-month' : ''
              } ${day.isToday ? 'today' : ''}`}
              onClick={() => handleDateClick(day)}
            >
              <div className="day-number">
                {day.date.getDate()}
              </div>
              
              <div className="day-events">
                {day.events.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={`event-item ${
                      event.createdBy === currentUser?.name ? 'my-event' : 'other-event'
                    } ${event.isDeleted ? 'deleted-event' : ''}`}
                    onClick={(e) => handleEventClick(event, e)}
                    title={`${event.title} - ${event.createdBy}${event.isDeleted ? ' (Deleted)' : ''}`}
                  >
                    <span className={event.isDeleted ? 'deleted-text' : ''}>
                      {event.title}
                    </span>
                    {event.isDeleted && <span className="deleted-badge">🗑️</span>}
                  </div>
                ))}
                {day.events.length > 2 && (
                  <div className="more-events">
                    +{day.events.length - 2} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Creation/Edit Modal */}
      {showEventModal && (
        <div className="modal-overlay" onClick={() => {
          setShowEventModal(false);
          resetEventForm();
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedEvent ? 'Edit Event' : 'Create New Event'}</h3>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowEventModal(false);
                  resetEventForm();
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="eventTitle">Event Title:</label>
                <input
                  id="eventTitle"
                  type="text"
                  value={eventForm.event_label}
                  onChange={(e) => setEventForm({...eventForm, event_label: e.target.value})}
                  placeholder="Enter event title (e.g., 'School pickup', 'Doctor appointment')"
                  className="event-input"
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventDateTime">Date & Time:</label>
                <input
                  id="eventDateTime"
                  type="datetime-local"
                  value={eventForm.event_time}
                  onChange={(e) => setEventForm({...eventForm, event_time: e.target.value})}
                  className="event-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventRecurrence">Recurrence:</label>
                <select
                  id="eventRecurrence"
                  value={eventForm.repeat_occurrence}
                  onChange={(e) => setEventForm({...eventForm, repeat_occurrence: e.target.value})}
                  className="event-select"
                >
                  <option value="none">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {selectedEvent && selectedEvent.createdBy !== currentUser?.name && (
                <div className="permission-notice">
                  <p>📝 This event was created by {selectedEvent.createdBy}. You can only view the details.</p>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => {
                  setShowEventModal(false);
                  resetEventForm();
                }}
              >
                Cancel
              </button>
              
              {(!selectedEvent || selectedEvent.createdBy === currentUser?.name) && (
                <>
                  <button 
                    className="create-btn"
                    onClick={saveEvent}
                    disabled={!eventForm.event_label || !eventForm.event_time}
                  >
                    {selectedEvent ? 'Update Event' : 'Create Event'}
                  </button>
                  
                  {selectedEvent && (
                    <button 
                      className="delete-btn"
                      onClick={deleteEvent}
                    >
                      Delete Event
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetails && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowEventDetails(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Event Details</h3>
              <button 
                className="close-btn"
                onClick={() => setShowEventDetails(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="event-details">
                <h4 className={selectedEvent.isDeleted ? 'deleted-text' : ''}>
                  {selectedEvent.title}
                  {selectedEvent.isDeleted && <span className="deleted-badge">🗑️ Deleted</span>}
                </h4>
                
                <div className="event-info">
                  <div className="info-row">
                    <strong>Date & Time:</strong>
                    <span>{new Date(selectedEvent.datetime).toLocaleString('en-AU', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                  
                  <div className="info-row">
                    <strong>Created by:</strong>
                    <span>{selectedEvent.createdBy}</span>
                  </div>
                  
                  <div className="info-row">
                    <strong>Created on:</strong>
                    <span>{new Date(selectedEvent.createdDate).toLocaleDateString('en-AU')}</span>
                  </div>
                  
                  {selectedEvent.recurrence && selectedEvent.recurrence !== 'none' && (
                    <div className="info-row">
                      <strong>Recurring:</strong>
                      <span>{selectedEvent.recurrence}</span>
                    </div>
                  )}
                  
                  {selectedEvent.isDeleted && (
                    <div className="info-row deleted-info">
                      <strong>Deleted by:</strong>
                      <span>{selectedEvent.deletedBy}</span>
                      <strong>Deleted on:</strong>
                      <span>{new Date(selectedEvent.deletedDate).toLocaleDateString('en-AU')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              {!selectedEvent.isDeleted && selectedEvent.createdBy === currentUser?.name && (
                <button 
                  className="delete-btn"
                  onClick={() => {
                    setShowEventDetails(false);
                    deleteEvent();
                  }}
                >
                  Delete Event
                </button>
              )}
              <button 
                className="close-btn-footer"
                onClick={() => setShowEventDetails(false)}
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
          <p>Loading calendar...</p>
        </div>
      )}
    </div>
  );
}

export default SharedCalendar;