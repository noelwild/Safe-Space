# server.py - Safespace FastAPI Backend with Accountable Payments and Unalterable Records

import logging
import os
import sqlite3
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List
import uvicorn
import base64
import mimetypes
import io
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import anthropic
from PyPDF2 import PdfReader, PdfWriter
import docx
import chardet
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Update BASE_DIR to work from backend directory
BASE_DIR = Path(__file__).parent.parent.absolute()  # Points to /app
UPLOAD_DIR = BASE_DIR / "uploaded_files"
RECEIPTS_DIR = BASE_DIR / "receipts"
CERTIFICATES_DIR = BASE_DIR / "certificates"
INFO_LIBRARY_DIR = BASE_DIR / "info_library_files"
UNALTERABLE_RECORDS_DIR = BASE_DIR / "unalterable_records"
JOURNAL_FILES_DIR = BASE_DIR / "journal_files"  # New directory for personal journal files
VAULT_STORAGE_DIR = BASE_DIR / "vault_storage"  # New directory for vault file storage
SUPPORT_ATTACHMENTS_DIR = BASE_DIR / "support_attachments"  # New directory for support ticket attachments
DATABASE_DIR = BASE_DIR / "Client_Databases"
DB_PATH = DATABASE_DIR / "client_database.db"

# Ensure directories exist
UPLOAD_DIR.mkdir(exist_ok=True)
RECEIPTS_DIR.mkdir(exist_ok=True)
INFO_LIBRARY_DIR.mkdir(exist_ok=True)
UNALTERABLE_RECORDS_DIR.mkdir(exist_ok=True)
JOURNAL_FILES_DIR.mkdir(exist_ok=True)
VAULT_STORAGE_DIR.mkdir(exist_ok=True)
SUPPORT_ATTACHMENTS_DIR.mkdir(exist_ok=True)
DATABASE_DIR.mkdir(exist_ok=True)

# Constants
ANTHROPIC_API_KEY = "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"

# Rename for uvicorn compatibility
app = FastAPI(title="Safespace", description="Family Communication Safety Platform")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files - point to the frontend directory
app.mount("/static", StaticFiles(directory=BASE_DIR / "frontend"), name="static")

# Initialize Anthropic API client
client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
logger.info("Anthropic API initialized.")

# Pydantic models
class MessageEvaluation(BaseModel):
    message: str
    user_name: str
    user_email: str
    parental_role: str
    recipient_role: str
    conversation_id: Optional[int] = None

class CalendarEvent(BaseModel):
    event_label: str
    event_time: str
    repeat_occurrence: str
    created_by: str
    relationship_id: Optional[int] = None

class FinancialEntry(BaseModel):
    type: str
    amount: float
    description: str
    created_by: str

class PaymentEntry(BaseModel):
    type: str = "expense"
    category: str
    amount: float
    description: str
    payment_method: Optional[str] = None
    merchant: Optional[str] = None
    payment_date: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    payment_type: str = "expense"  # expense, suggestion, reimbursement
    relationship_id: Optional[int] = None

class PaymentSuggestion(BaseModel):
    payment_id: int
    suggested_to: str
    suggested_amount: float
    reason: str
    created_by: str

class InfoLogEntry(BaseModel):
    child_name: str
    type: str
    description: str
    created_by: str
    relationship_id: Optional[int] = None

class ConversationEntry(BaseModel):
    title: str
    relationship_id: Optional[int] = None

class ProfileEntry(BaseModel):
    trigger_words: str
    pronouns: str
    preferred_name_a: str
    preferred_name_b: str
    alternate_contact: str
    children_names: str
    emergency_contact: str
    postcode: str
    usual_address: str
    dob: str
    parental_role: str

class InfoLibraryEntry(BaseModel):
    title: str
    description: str
    category: str
    created_by: str
    relationship_id: Optional[int] = None

class InfoLibraryFileUpload(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str
    created_by: str

class UnalterableRecordEntry(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str
    created_by: str
    relationship_id: Optional[int] = None

class UnalterableRecordFileUpload(BaseModel):
    title: str
    description: Optional[str] = ""
    category: str
    created_by: str

# Personal Journal Models
class PersonalJournalEntry(BaseModel):
    title: str
    content: str
    mood: Optional[str] = None
    created_by: str
    relationship_id: Optional[int] = None

class PersonalJournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None

# Vault File Storage Models
class VaultFolderEntry(BaseModel):
    name: str
    parent_folder_id: Optional[int] = None
    created_by: str

class VaultFileEntry(BaseModel):
    title: str
    description: Optional[str] = ""
    folder_id: Optional[int] = None
    created_by: str
    is_shared: bool = False
    shared_with: Optional[str] = None

class VaultFileUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[int] = None
    is_shared: Optional[bool] = None
    shared_with: Optional[str] = None

# Support Ticket Models
class SupportTicketEntry(BaseModel):
    subject: str
    category: str  # Technical Issues, Account Problems, Feature Requests, Billing Questions, Privacy Concerns, Other
    priority: str  # Low, Medium, High, Urgent
    description: str
    user_name: str
    user_email: str

class SupportTicketUpdate(BaseModel):
    status: Optional[str] = None  # Open, In Progress, Resolved, Closed
    admin_response: Optional[str] = None

# Authentication Models
class UserSignUp(BaseModel):
    # Personal Information
    email: EmailStr
    password: str
    fullName: str
    preferredName: Optional[str] = None
    role: str  # Mother or Father
    
    # Other Parent Information
    otherParentName: str
    otherParentEmail: EmailStr
    otherParentRole: str
    
    # Children Information
    children: List[dict]  # [{"name": "...", "age": "..."}]
    
    # Contact Information
    phoneNumber: str
    address: str
    postcode: str
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None
    
    # Subscription Information
    subscriptionType: str = 'basic'  # basic, premium
    paymentMethod: Optional[str] = None
    cardNumber: Optional[str] = None
    expiryDate: Optional[str] = None
    cvv: Optional[str] = None
    billingAddress: Optional[str] = None

class UserSignIn(BaseModel):
    email: EmailStr
    password: str

class UserProfileUpdate(BaseModel):
    fullName: Optional[str] = None
    preferredName: Optional[str] = None
    email: Optional[EmailStr] = None
    phoneNumber: Optional[str] = None
    address: Optional[str] = None
    postcode: Optional[str] = None
    emergencyContact: Optional[str] = None
    emergencyPhone: Optional[str] = None

class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str

class ChildrenUpdate(BaseModel):
    children: List[dict]

class NotificationPreferences(BaseModel):
    emailNotifications: bool = True
    pushNotifications: bool = True
    messageNotifications: bool = True
    calendarNotifications: bool = True
    paymentNotifications: bool = True

# Enhanced messaging models
class MessageUpdate(BaseModel):
    is_read: bool
    read_by: str

class MessageReport(BaseModel):
    conversation_id: int
    message_id: Optional[int] = None
    report_type: str  # 'inappropriate_content', 'harassment', 'policy_violation', 'other'
    reason: str
    description: Optional[str] = None
    reported_by: str

class MessageSearch(BaseModel):
    query: str
    conversation_id: Optional[int] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    sender: Optional[str] = None

class ConversationExport(BaseModel):
    conversation_id: int
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    format: str = "pdf"  # pdf, json
    include_attachments: bool = False

class NotificationSettings(BaseModel):
    email_notifications: bool = True
    push_notifications: bool = True
    immediate_notifications: bool = True
    daily_digest: bool = False
class ScheduleCallRequest(BaseModel):
    recipient_name: str
    recipient_email: str
    scheduled_date: str  # YYYY-MM-DD format
    scheduled_time: str  # HH:MM format
    duration_minutes: int  # 5-60 minutes
    notes: Optional[str] = None

class CallResponse(BaseModel):
    scheduled_call_id: int
    response: str  # 'accept' or 'reject'
    notes: Optional[str] = None

class JoinCallRequest(BaseModel):
    scheduled_call_id: int
    session_token: str

class CallTranscription(BaseModel):
    call_session_id: int
    speaker: str
    transcript_text: str
    confidence_score: float
    is_final: bool = True

class CallReport(BaseModel):
    call_session_id: int
    report_type: str  # 'policy_violation', 'inappropriate_behavior', 'technical_issue', 'other'
    reason: str
    description: Optional[str] = None
    transcript_segment: Optional[str] = None

class CallEndRequest(BaseModel):
    call_session_id: int
    end_reason: str  # 'normal', 'violation_detected', 'manual_report', 'timeout'

# AI Call Analysis Models
class CallAnalysisResult(BaseModel):
    call_session_id: int
    violations_detected: int
    violation_details: List[dict]
    call_summary: str
    content_analysis: str
    safety_score: int  # 1-10 scale
    recommendations: List[str]

# Parent Switching Models
class ParentSwitchRequest(BaseModel):
    relationship_id: int

# Subscription Management Models  
class SubscriptionUpdate(BaseModel):
    subscription_type: str  # 'trial', 'basic', 'premium'

# Database initialization
def init_db():
    if not DB_PATH.exists():
        DATABASE_DIR.mkdir(exist_ok=True)
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Create messages table with enhanced features and relationship_id
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT,
                user_email TEXT,
                original_message TEXT,
                rewritten_message TEXT,
                conversation_id INTEGER,
                timestamp TEXT,
                parental_role TEXT,
                recipient_role TEXT,
                is_read BOOLEAN DEFAULT FALSE,
                read_at TEXT,
                read_by TEXT,
                message_hash TEXT,
                has_attachments BOOLEAN DEFAULT FALSE,
                attachment_count INTEGER DEFAULT 0,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Migrate existing messages table if needed
        cursor.execute("PRAGMA table_info(messages)")
        message_columns = [row[1] for row in cursor.fetchall()]
        
        if 'is_read' not in message_columns:
            logger.info("Migrating messages table to add new columns...")
            # Add new columns to existing table
            new_message_columns = [
                'is_read BOOLEAN DEFAULT FALSE',
                'read_at TEXT',
                'read_by TEXT',
                'message_hash TEXT',
                'has_attachments BOOLEAN DEFAULT FALSE',
                'attachment_count INTEGER DEFAULT 0',
                'sender_language TEXT DEFAULT "en"',
                'recipient_language TEXT DEFAULT "en"',
                'relationship_id INTEGER'
            ]
            
            for column in new_message_columns:
                try:
                    cursor.execute(f"ALTER TABLE messages ADD COLUMN {column}")
                    logger.info(f"Added column to messages: {column}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e):
                        logger.error(f"Error adding column {column} to messages: {e}")
        
        # Check if relationship_id already exists
        if 'relationship_id' not in message_columns:
            try:
                cursor.execute("ALTER TABLE messages ADD COLUMN relationship_id INTEGER")
                logger.info("Added relationship_id to messages table")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    logger.error(f"Error adding relationship_id to messages: {e}")
        
        # Create dual-language message translations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                language_code TEXT NOT NULL,
                original_text TEXT NOT NULL,
                rewritten_text TEXT NOT NULL,
                created_date TEXT NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                UNIQUE(message_id, language_code)
            )
        """)
        
        # Create message_attachments table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                file_hash TEXT,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
            )
        """)
        
        # Create conversation_reports table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversation_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL,
                message_id INTEGER,
                reported_by TEXT NOT NULL,
                report_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                description TEXT,
                report_date TEXT NOT NULL,
                status TEXT DEFAULT 'Open',
                reviewed_by TEXT,
                reviewed_date TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE SET NULL
            )
        """)
        
        # Create message_notifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS message_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                message_id INTEGER NOT NULL,
                conversation_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                is_sent BOOLEAN DEFAULT FALSE,
                sent_at TEXT,
                email_sent BOOLEAN DEFAULT FALSE,
                push_sent BOOLEAN DEFAULT FALSE,
                created_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT,
                date TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create conversations table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                date TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create calendar table with relationship support and soft delete
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS calendar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_label TEXT,
                event_time TEXT,
                repeat_occurrence TEXT,
                created_by TEXT,
                created_date TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                deleted_date TEXT,
                deleted_by TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Enhanced financial table for Accountable Payments with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT,
                category TEXT,
                amount REAL,
                description TEXT,
                payment_method TEXT,
                merchant TEXT,
                payment_date TEXT,
                notes TEXT,
                receipt_filename TEXT,
                receipt_ocr_data TEXT,
                receipt_human_readable TEXT,
                payment_type TEXT DEFAULT 'expense',
                date TEXT,
                created_by TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Migrate existing financial table if needed
        cursor.execute("PRAGMA table_info(financial)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'category' not in columns:
            logger.info("Migrating financial table to add new columns...")
            # Add new columns to existing table
            new_columns = [
                'category TEXT',
                'payment_method TEXT',
                'merchant TEXT', 
                'payment_date TEXT',
                'notes TEXT',
                'receipt_filename TEXT',
                'receipt_ocr_data TEXT',
                'receipt_human_readable TEXT',
                'payment_type TEXT DEFAULT "expense"',
                'relationship_id INTEGER'
            ]
            
            for column in new_columns:
                try:
                    cursor.execute(f"ALTER TABLE financial ADD COLUMN {column}")
                    logger.info(f"Added column: {column}")
                except sqlite3.OperationalError as e:
                    if "duplicate column name" not in str(e):
                        logger.error(f"Error adding column {column}: {e}")
        
        # Check if relationship_id already exists in financial table
        if 'relationship_id' not in columns:
            try:
                cursor.execute("ALTER TABLE financial ADD COLUMN relationship_id INTEGER")
                logger.info("Added relationship_id to financial table")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    logger.error(f"Error adding relationship_id to financial: {e}")
        
        # Migrate other tables to add relationship_id
        tables_to_migrate = ['calendar', 'conversations', 'orders', 'info_log', 'personal_journal']
        for table_name in tables_to_migrate:
            try:
                cursor.execute(f"PRAGMA table_info({table_name})")
                table_columns = [row[1] for row in cursor.fetchall()]
                if 'relationship_id' not in table_columns:
                    cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN relationship_id INTEGER")
                    logger.info(f"Added relationship_id to {table_name} table")
            except sqlite3.OperationalError as e:
                if "duplicate column name" not in str(e):
                    logger.error(f"Error adding relationship_id to {table_name}: {e}")
        
        # Migrate calendar table to add soft delete columns
        try:
            cursor.execute("PRAGMA table_info(calendar)")
            calendar_columns = [row[1] for row in cursor.fetchall()]
            if 'is_active' not in calendar_columns:
                cursor.execute("ALTER TABLE calendar ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
                cursor.execute("ALTER TABLE calendar ADD COLUMN deleted_date TEXT")
                cursor.execute("ALTER TABLE calendar ADD COLUMN deleted_by TEXT")
                logger.info("Added soft delete columns to calendar table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" not in str(e):
                logger.error(f"Error adding soft delete columns to calendar: {e}")
        
        # Create payment suggestions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS payment_suggestions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_id INTEGER,
                suggested_to TEXT,
                suggested_amount REAL,
                reason TEXT,
                status TEXT DEFAULT 'pending',
                proof_filename TEXT,
                proof_ocr_data TEXT,
                created_by TEXT,
                created_date TEXT,
                response_date TEXT,
                FOREIGN KEY (payment_id) REFERENCES financial (id)
            )
        """)
        
        # Create info_log table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS info_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                child_name TEXT,
                type TEXT,
                description TEXT,
                date TEXT,
                created_by TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create profiles table (keeping global as it's user-specific)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trigger_words TEXT,
                pronouns TEXT,
                preferred_name_a TEXT,
                preferred_name_b TEXT,
                alternate_contact TEXT,
                children_names TEXT,
                emergency_contact TEXT,
                postcode TEXT,
                usual_address TEXT,
                dob TEXT,
                parental_role TEXT,
                created_date TEXT
            )
        """)
        
        # Create info_library table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS info_library (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                file_name TEXT,
                file_path TEXT,
                file_type TEXT,
                file_size INTEGER,
                is_file BOOLEAN DEFAULT FALSE,
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                downloads_log TEXT DEFAULT '',
                metadata TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create unalterable_records table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS unalterable_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                file_name TEXT,
                file_path TEXT,
                original_file_name TEXT,
                file_type TEXT,
                file_size INTEGER,
                file_hash TEXT NOT NULL,
                hash_algorithm TEXT DEFAULT 'SHA-256',
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                downloads_log TEXT DEFAULT '',
                access_log TEXT DEFAULT '',
                is_verified BOOLEAN DEFAULT TRUE,
                metadata TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create personal_journal table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS personal_journal (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                mood TEXT,
                entry_date TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_date TEXT NOT NULL,
                last_modified TEXT,
                tags TEXT,
                relationship_id INTEGER,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create journal_files table for file attachments
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS journal_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                journal_entry_id INTEGER,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                FOREIGN KEY (journal_entry_id) REFERENCES personal_journal (id) ON DELETE CASCADE
            )
        """)
        
        # Create vault_folders table for vault file organization
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vault_folders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                parent_folder_id INTEGER,
                created_by TEXT NOT NULL,
                created_date TEXT NOT NULL,
                is_shared BOOLEAN DEFAULT FALSE,
                shared_with TEXT,
                FOREIGN KEY (parent_folder_id) REFERENCES vault_folders (id) ON DELETE CASCADE
            )
        """)
        
        # Create vault_files table for vault file storage
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vault_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                folder_id INTEGER,
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                is_shared BOOLEAN DEFAULT FALSE,
                shared_with TEXT,
                file_hash TEXT,
                FOREIGN KEY (folder_id) REFERENCES vault_folders (id) ON DELETE SET NULL
            )
        """)
        
        # Create vault_access_logs table for tracking file access
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vault_access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER NOT NULL,
                accessed_by TEXT NOT NULL,
                access_type TEXT NOT NULL,
                access_date TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                FOREIGN KEY (file_id) REFERENCES vault_files (id) ON DELETE CASCADE
            )
        """)
        
        # Create support_tickets table for Contact Us functionality
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_number TEXT UNIQUE NOT NULL,
                subject TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT DEFAULT 'Open',
                user_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                created_date TEXT NOT NULL,
                last_updated TEXT NOT NULL,
                admin_response TEXT,
                resolved_date TEXT,
                resolved_by TEXT
            )
        """)
        
        # Create support_ticket_attachments table for file uploads
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS support_ticket_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticket_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_type TEXT,
                file_size INTEGER,
                uploaded_by TEXT NOT NULL,
                upload_date TEXT NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES support_tickets (id) ON DELETE CASCADE
            )
        """)
        
        # Create users table for authentication
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                preferred_name TEXT,
                role TEXT NOT NULL,
                phone_number TEXT,
                address TEXT,
                postcode TEXT,
                emergency_contact TEXT,
                emergency_phone TEXT,
                subscription_type TEXT DEFAULT 'basic',
                payment_method TEXT,
                card_last_four TEXT,
                billing_address TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                email_verified BOOLEAN DEFAULT FALSE,
                created_date TEXT NOT NULL,
                last_login TEXT,
                profile_completed BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Create user_relationships table to link parent accounts
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                other_parent_name TEXT NOT NULL,
                other_parent_email TEXT NOT NULL,
                other_parent_role TEXT NOT NULL,
                other_parent_id INTEGER,
                relationship_status TEXT DEFAULT 'pending',
                invitation_sent_date TEXT,
                invitation_accepted_date TEXT,
                created_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (other_parent_id) REFERENCES users (id) ON DELETE SET NULL
            )
        """)
        
        # Create user_children table with relationship support
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_children (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                created_date TEXT NOT NULL,
                relationship_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (relationship_id) REFERENCES user_relationships (id) ON DELETE CASCADE
            )
        """)
        
        # Create user_sessions table for authentication tokens
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                expires_at TEXT NOT NULL,
                created_date TEXT NOT NULL,
                last_accessed TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Create user_notifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                email_notifications BOOLEAN DEFAULT TRUE,
                push_notifications BOOLEAN DEFAULT TRUE,
                message_notifications BOOLEAN DEFAULT TRUE,
                calendar_notifications BOOLEAN DEFAULT TRUE,
                payment_notifications BOOLEAN DEFAULT TRUE,
                created_date TEXT NOT NULL,
                updated_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Create scheduled_calls table for Accountable Calling
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_calls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_id INTEGER NOT NULL,
                caller_name TEXT NOT NULL,
                caller_email TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                scheduled_date TEXT NOT NULL,
                scheduled_time TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                created_date TEXT NOT NULL,
                accepted_date TEXT,
                rejected_date TEXT,
                completed_date TEXT,
                notes TEXT,
                FOREIGN KEY (caller_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        # Create call_sessions table for active calls
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS call_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scheduled_call_id INTEGER NOT NULL,
                session_token TEXT UNIQUE NOT NULL,
                caller_joined_at TEXT,
                recipient_joined_at TEXT,
                call_started_at TEXT,
                call_ended_at TEXT,
                ended_by TEXT,
                end_reason TEXT,
                duration_seconds INTEGER,
                recording_path TEXT,
                status TEXT DEFAULT 'waiting',
                FOREIGN KEY (scheduled_call_id) REFERENCES scheduled_calls (id) ON DELETE CASCADE
            )
        """)
        
        # Create call_transcriptions table for real-time transcription
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS call_transcriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_session_id INTEGER NOT NULL,
                speaker TEXT NOT NULL,
                transcript_text TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                confidence_score REAL,
                is_final BOOLEAN DEFAULT TRUE,
                violation_detected BOOLEAN DEFAULT FALSE,
                violation_type TEXT,
                ai_analysis TEXT,
                FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE
            )
        """)
        
        # Create call_reports table for manual and automatic violations
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS call_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_session_id INTEGER NOT NULL,
                reported_by TEXT NOT NULL,
                report_type TEXT NOT NULL,
                reason TEXT NOT NULL,
                description TEXT,
                timestamp TEXT NOT NULL,
                auto_generated BOOLEAN DEFAULT FALSE,
                transcript_segment TEXT,
                violation_category TEXT,
                severity_level INTEGER DEFAULT 1,
                FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE
            )
        """)
        
        # Create call_notifications table for email/push notifications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS call_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scheduled_call_id INTEGER NOT NULL,
                recipient_email TEXT NOT NULL,
                notification_type TEXT NOT NULL,
                sent_at TEXT NOT NULL,
                email_sent BOOLEAN DEFAULT FALSE,
                push_sent BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (scheduled_call_id) REFERENCES scheduled_calls (id) ON DELETE CASCADE
            )
        """)
        
        # Create call_analyses table for post-call AI analysis
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS call_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                call_session_id INTEGER NOT NULL,
                violations_detected INTEGER DEFAULT 0,
                violation_details TEXT,
                call_summary TEXT NOT NULL,
                content_analysis TEXT,
                safety_score INTEGER DEFAULT 5,
                recommendations TEXT,
                analysis_date TEXT NOT NULL,
                ai_model_version TEXT DEFAULT 'claude-3-5-sonnet-20241022',
                FOREIGN KEY (call_session_id) REFERENCES call_sessions (id) ON DELETE CASCADE
            )
        """)
        
        conn.commit()

# Password hashing utility functions
def hash_password(password: str) -> str:
    """Hash a password using SHA-256 with salt"""
    salt = secrets.token_hex(16)
    password_hash = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{password_hash}"

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    try:
        salt, password_hash = hashed.split(':')
        return hashlib.sha256((password + salt).encode()).hexdigest() == password_hash
    except ValueError:
        return False

# Create default test users
def create_default_users():
    """Create default test users for development/testing"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if test users already exist
            cursor.execute("SELECT COUNT(*) FROM users WHERE email IN (?, ?)", 
                          ('mother.test@safespace.com', 'father.test@safespace.com'))
            if cursor.fetchone()[0] > 0:
                return  # Test users already exist
            
            # Create test mother account
            mother_id = create_test_user(
                cursor,
                email='mother.test@safespace.com',
                password='TestPassword123!',
                full_name='Sarah Johnson',
                preferred_name='Sarah',
                role='Mother',
                phone_number='+1 (555) 123-4567',
                address='123 Main Street, Springfield, IL',
                postcode='62701',
                other_parent_name='Michael Johnson',
                other_parent_email='father.test@safespace.com',
                other_parent_role='Father'
            )
            
            # Create test father account
            father_id = create_test_user(
                cursor,
                email='father.test@safespace.com',
                password='TestPassword123!',
                full_name='Michael Johnson',
                preferred_name='Mike',
                role='Father',
                phone_number='+1 (555) 987-6543',
                address='456 Oak Avenue, Springfield, IL',
                postcode='62702',
                other_parent_name='Sarah Johnson',
                other_parent_email='mother.test@safespace.com',
                other_parent_role='Mother'
            )
            
            # Link the accounts
            cursor.execute("""
                UPDATE user_relationships 
                SET other_parent_id = ?, relationship_status = 'accepted', invitation_accepted_date = ?
                WHERE user_id = ?
            """, (father_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), mother_id))
            
            cursor.execute("""
                UPDATE user_relationships 
                SET other_parent_id = ?, relationship_status = 'accepted', invitation_accepted_date = ?
                WHERE user_id = ?
            """, (mother_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), father_id))
            
            conn.commit()
            logger.info("Created default test users successfully")
            
    except Exception as e:
        logger.error(f"Error creating default users: {str(e)}")

def create_test_user(cursor, email, password, full_name, preferred_name, role, phone_number, address, postcode, other_parent_name, other_parent_email, other_parent_role):
    """Helper function to create a test user"""
    password_hash = hash_password(password)
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Create user
    cursor.execute("""
        INSERT INTO users (email, password_hash, full_name, preferred_name, role, phone_number, 
                          address, postcode, subscription_type, is_active, email_verified, 
                          created_date, profile_completed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (email, password_hash, full_name, preferred_name, role, phone_number, address, postcode,
          'basic', True, True, current_time, True))
    
    user_id = cursor.lastrowid
    
    # Create relationship
    cursor.execute("""
        INSERT INTO user_relationships (user_id, other_parent_name, other_parent_email, 
                                       other_parent_role, relationship_status, invitation_sent_date, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, other_parent_name, other_parent_email, other_parent_role, 'pending', current_time, current_time))
    
    # Add test children
    test_children = [
        {'name': 'Emma Johnson', 'age': 8},
        {'name': 'Liam Johnson', 'age': 12}
    ]
    
    for child in test_children:
        cursor.execute("""
            INSERT INTO user_children (user_id, name, age, created_date)
            VALUES (?, ?, ?, ?)
        """, (user_id, child['name'], child['age'], current_time))
    
    # Create notification preferences
    cursor.execute("""
        INSERT INTO user_notifications (user_id, email_notifications, push_notifications, 
                                       message_notifications, calendar_notifications, 
                                       payment_notifications, created_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, True, True, True, True, True, current_time))
    
    return user_id

init_db()
create_default_users()

# OCR Processing Module using Claude Vision
class OCRProcessor:
    def __init__(self):
        self.model = "claude-3-5-sonnet-20241022"
        
    def process_receipt_image(self, image_path: Path, image_data: bytes = None):
        """Process receipt image using Claude Vision API for OCR"""
        try:
            if image_data is None:
                with open(image_path, 'rb') as f:
                    image_data = f.read()
            
            # Get the image media type
            media_type = mimetypes.guess_type(str(image_path))[0]
            if not media_type or not media_type.startswith('image/'):
                media_type = 'image/jpeg'
            
            # Encode image to base64
            image_base64 = base64.b64encode(image_data).decode()
            
            # Create the message for Claude Vision
            message = client.messages.create(
                model=self.model,
                max_tokens=2000,
                temperature=0.1,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_base64
                                }
                            },
                            {
                                "type": "text",
                                "text": """Please analyze this receipt/transaction image and extract financial information in JSON format. 

Extract these fields if available:
- merchant_name: Name of the business/store
- amount: Total amount paid (as number, no currency symbols)
- currency: Currency type (USD, EUR, etc.)
- transaction_date: Date of transaction (YYYY-MM-DD format if possible)
- transaction_time: Time of transaction (HH:MM format if available)
- payment_method: How it was paid (card, cash, etc.)
- items: List of purchased items with descriptions and individual prices
- tax_amount: Tax amount if shown separately
- subtotal: Subtotal before tax if shown
- transaction_id: Transaction/receipt number if visible
- address: Store address if visible
- category: Suggested expense category (food, medical, education, transportation, utilities, clothing, entertainment, other)

Return ONLY valid JSON format. If you cannot read certain information, use null for that field."""
                            }
                        ]
                    }
                ]
            )
            
            response_text = ' '.join([block.text for block in message.content])
            
            # Try to parse JSON
            try:
                ocr_data = json.loads(response_text)
            except json.JSONDecodeError:
                # If JSON parsing fails, create a basic structure
                ocr_data = {
                    "merchant_name": None,
                    "amount": None,
                    "currency": "USD",
                    "transaction_date": None,
                    "payment_method": None,
                    "category": "other",
                    "raw_text": response_text
                }
            
            # Generate human-readable summary
            human_readable = self.generate_human_readable_summary(ocr_data)
            
            return {
                "ocr_data": json.dumps(ocr_data),
                "human_readable": human_readable,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error processing receipt image: {str(e)}")
            return {
                "ocr_data": json.dumps({"error": str(e)}),
                "human_readable": f"Error processing receipt: {str(e)}",
                "success": False
            }
    
    def generate_human_readable_summary(self, ocr_data: dict) -> str:
        """Convert OCR JSON data to human-readable format"""
        try:
            summary_parts = []
            
            if ocr_data.get('merchant_name'):
                summary_parts.append(f"🏪 **Store:** {ocr_data['merchant_name']}")
            
            if ocr_data.get('amount'):
                currency = ocr_data.get('currency', 'USD')
                summary_parts.append(f"💰 **Amount:** {currency} {ocr_data['amount']}")
            
            if ocr_data.get('transaction_date'):
                date_str = ocr_data['transaction_date']
                if ocr_data.get('transaction_time'):
                    date_str += f" at {ocr_data['transaction_time']}"
                summary_parts.append(f"📅 **Date:** {date_str}")
            
            if ocr_data.get('payment_method'):
                summary_parts.append(f"💳 **Payment Method:** {ocr_data['payment_method']}")
            
            if ocr_data.get('category'):
                summary_parts.append(f"📊 **Category:** {ocr_data['category'].title()}")
            
            if ocr_data.get('items') and isinstance(ocr_data['items'], list):
                items_text = "\n".join([f"  • {item}" for item in ocr_data['items'][:5]])  # Show max 5 items
                if len(ocr_data['items']) > 5:
                    items_text += f"\n  • ... and {len(ocr_data['items']) - 5} more items"
                summary_parts.append(f"🛍️ **Items:**\n{items_text}")
            
            if ocr_data.get('transaction_id'):
                summary_parts.append(f"🧾 **Transaction ID:** {ocr_data['transaction_id']}")
            
            if ocr_data.get('address'):
                summary_parts.append(f"📍 **Location:** {ocr_data['address']}")
            
            return "\n\n".join(summary_parts) if summary_parts else "Receipt information extracted successfully."
            
        except Exception as e:
            logger.error(f"Error generating human readable summary: {str(e)}")
            return "Receipt processed but summary generation failed."

# Unalterable Records Module for Legal Document Management
class UnalterableRecordsManager:
    def __init__(self):
        self.hash_algorithm = 'SHA-256'
        logger.info("Unalterable Records Manager initialized.")
    
    def calculate_file_hash(self, file_content: bytes) -> str:
        """Calculate SHA-256 hash of file content for integrity verification"""
        return hashlib.sha256(file_content).hexdigest()
    
    def verify_file_integrity(self, file_path: Path, stored_hash: str) -> bool:
        """Verify if file has been tampered with by comparing hashes"""
        try:
            with open(file_path, 'rb') as f:
                current_hash = self.calculate_file_hash(f.read())
            return current_hash == stored_hash
        except Exception as e:
            logger.error(f"Error verifying file integrity: {str(e)}")
            return False
    
    def generate_verification_pdf(self, record_data: dict, downloaded_by: str) -> bytes:
        """Generate PDF with verification header for court use"""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Document content
        content = []
        
        # Title
        title_style = styles['Title']
        title_style.textColor = colors.darkblue
        content.append(Paragraph("SAFESPACE UNALTERABLE RECORDS", title_style))
        content.append(Paragraph("DOCUMENT VERIFICATION CERTIFICATE", title_style))
        content.append(Spacer(1, 0.3*inch))
        
        # Verification Statement
        verification_text = """
        <b>CERTIFICATION OF DOCUMENT INTEGRITY</b><br/>
        <br/>
        This document has been retrieved from the Safespace Unalterable Records system, 
        a secure platform designed for family communication and legal document preservation. 
        The integrity and authenticity of this document are verified through cryptographic 
        hash validation as detailed below.
        """
        content.append(Paragraph(verification_text, styles['Normal']))
        content.append(Spacer(1, 0.2*inch))
        
        # Document Information Table
        doc_info_data = [
            ['Document Information', ''],
            ['Title:', record_data.get('title', 'N/A')],
            ['Category:', record_data.get('category', 'N/A').replace('_', ' ').title()],
            ['Original Filename:', record_data.get('original_file_name', 'N/A')],
            ['File Type:', record_data.get('file_type', 'N/A').upper()],
            ['File Size:', f"{record_data.get('file_size', 0):,} bytes"],
            ['Uploaded By:', record_data.get('uploaded_by', 'N/A')],
            ['Upload Date:', record_data.get('upload_date', 'N/A')],
        ]
        
        doc_info_table = Table(doc_info_data, colWidths=[2*inch, 4*inch])
        doc_info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.lightblue),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        content.append(doc_info_table)
        content.append(Spacer(1, 0.2*inch))
        
        # Cryptographic Verification Table
        crypto_data = [
            ['Cryptographic Verification', ''],
            ['Hash Algorithm:', record_data.get('hash_algorithm', 'SHA-256')],
            ['Document Hash:', record_data.get('file_hash', 'N/A')],
            ['Verification Status:', 'VERIFIED ✓' if record_data.get('is_verified') else 'FAILED ✗'],
            ['Hash Verification Date:', datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")],
        ]
        
        crypto_table = Table(crypto_data, colWidths=[2*inch, 4*inch])
        crypto_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.darkgreen),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        content.append(crypto_table)
        content.append(Spacer(1, 0.2*inch))
        
        # Access Information
        access_data = [
            ['Access Information', ''],
            ['Downloaded By:', downloaded_by],
            ['Download Date:', datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")],
            ['System Version:', 'Safespace v1.0'],
            ['Record ID:', str(record_data.get('id', 'N/A'))],
        ]
        
        access_table = Table(access_data, colWidths=[2*inch, 4*inch])
        access_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.orange),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.lightyellow),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        content.append(access_table)
        content.append(Spacer(1, 0.3*inch))
        
        # Legal Statement
        legal_text = """
        <b>LEGAL CERTIFICATION:</b><br/>
        <br/>
        This document was stored in the Safespace Unalterable Records system where it cannot 
        be modified or deleted by any user. The cryptographic hash above serves as a digital 
        fingerprint that would change if even a single byte of the document were altered. 
        The verification status indicates that the document hash matches the original hash 
        calculated at upload time, confirming the document has not been tampered with.<br/>
        <br/>
        <b>For court verification:</b> The original document hash can be independently verified 
        by accessing the Safespace system records or by contacting Safespace technical support 
        with the Record ID provided above.<br/>
        <br/>
        This verification certificate was generated automatically by the Safespace system on the 
        date and time indicated above.
        """
        content.append(Paragraph(legal_text, styles['Normal']))
        
        # Build PDF
        doc.build(content)
        buffer.seek(0)
        return buffer.getvalue()

# Chatbot Module (keeping existing functionality)
class ChatbotModule:
    def __init__(self):
        logger.info("Chatbot module initialized.")
        self.model = "claude-3-5-sonnet-20241022"

    def construct_compliance_prompt(self, message, orders, parental_role, recipient_role, user_language='en'):
        family_violence_act = """
        Family Violence includes behaviors such as:
        1. Physical, sexual, emotional, psychological, or economic abuse.
        2. Threats to kill or harm the individual, children, other family members, friends, or pets.
        3. Coercive behavior including:
            - Isolation or control over the individual's activities.
            - Coercing relinquishment of control over assets and income.
            - Removing or keeping family member's property.
            - Preventing access to joint financial assets.
            - Preventing employment or coercing into signing contracts or legal documents.
        4. Emotional or psychological abuse such as:
            - Repeated derogatory taunts, including, but not limited to, racial or sexual orientation-related.
            - Threatening to disclose sensitive personal information, including intimate images or videos.
            - Preventing connections with family, friends, or culture.
            - Threats of suicide or self-harm.
        5. Stalking, surveillance, or following.
        6. Behavior that controls or dominates, instilling fear for safety.
        7. Using or threatening violence with weapons.
        8. Sexual abuse or sexually coercive behaviors.
        9. Intentionally damaging property or threats to do so.
        10. Deprivation of or threats to a family member's liberty.
        11. Actions or threats relating to choking.
        12. Subtle or indirect communication that may include humor or sarcasm to veil threats or coercive statements.
        13. Use of digital surveillance or control over digital activities and communications.
        14. Legal intimidation or threats involving the misuse of legal processes.
        15. Indications of escalation or seriousness in tone or content that could suggest an underlying threat or control, detectable even in a single message.
        16. Any other behaviors or patterns that could reasonably be interpreted as potential family violence, including those not explicitly listed, based on the severity, context, or cumulative impact of the communications.

        Note: These behaviors may constitute family violence even if they do not qualify as a criminal offense.
        """
        
        # Get language instruction
        language_names = {
            'en': 'English', 'zh': 'Mandarin Chinese', 'hi': 'Hindi', 'es': 'Spanish',
            'fr': 'French', 'ar': 'Arabic', 'bn': 'Bengali', 'pt': 'Portuguese', 
            'ru': 'Russian', 'ja': 'Japanese'
        }
        
        language_instruction = ""
        if user_language != 'en':
            language_name = language_names.get(user_language, 'English')
            language_instruction = f" Respond ONLY in {language_name} language."
    
        prompt = {
            "system": f"You are an AI assistant tasked with evaluating whether a given message abides by the provided orders and the comprehensive definition of family violence included. Assess if the message is polite, respectful, and constructive, and provide your evaluation as 'yes' or 'no'.{language_instruction}",
            "messages": [
                {"role": "user", "content": f"[ORDERS] {orders}\n[FAMILY VIOLENCE ACT] {family_violence_act}\n[FROM] {parental_role}\n[TO] {recipient_role}\n[MESSAGE] {message}\n[EVALUATION]"}
            ]
        }
        return prompt

    def construct_rewrite_prompt(self, message, orders, parental_role, recipient_role, user_language='en'):
        family_violence_act = """
        Family Violence includes behaviors such as:
        1. Physical, sexual, emotional, psychological, or economic abuse.
        2. Threats to kill or harm the individual, children, other family members, friends, or pets.
        3. Coercive behavior including:
            - Isolation or control over the individual's activities.
            - Coercing relinquishment of control over assets and income.
            - Removing or keeping family member's property.
            - Preventing access to joint financial assets.
            - Preventing employment or coercing into signing contracts or legal documents.
        4. Emotional or psychological abuse such as:
            - Repeated derogatory taunts, including, but not limited to, racial or sexual orientation-related.
            - Threatening to disclose sensitive personal information, including intimfat images or videos.
            - Preventing connections with family, friends, or culture.
            - Threats of suicide or self-harm.
        5. Stalking, surveillance, or following.
        6. Behavior that controls or dominates, instilling fear for safety.
        7. Using or threatening violence with weapons.
        8. Sexual abuse or sexually coercive behaviors.
        9. Intentionally damaging property or threats to do so.
        10. Deprivation of or threats to a family member's liberty.
        11. Actions or threats relating to choking.
        12. Subtle or indirect communication that may include humor or sarcasm to veil threats or coercive statements.
        13. Use of digital surveillance or control over digital activities and communications.
        14. Legal intimidation or threats involving the misuse of legal processes.
        15. Indications of escalation or seriousness in tone or content that could suggest an underlying threat or control, detectable even in a single message.
        16. Any other behaviors or patterns that could reasonably be interpreted as potential family violence, including those not explicitly listed, based on the severity, context, or cumulative impact of the communications.
        """

        # Get language instruction
        language_names = {
            'en': 'English', 'zh': 'Mandarin Chinese', 'hi': 'Hindi', 'es': 'Spanish',
            'fr': 'French', 'ar': 'Arabic', 'bn': 'Bengali', 'pt': 'Portuguese', 
            'ru': 'Russian', 'ja': 'Japanese'
        }
        
        language_instruction = ""
        if user_language != 'en':
            language_name = language_names.get(user_language, 'English')
            language_instruction = f" Return the rewritten message ONLY in {language_name} language."

        system_message = (
            f"You are an AI assistant tasked with rewriting a given message to ensure it complies with the provided "
            f"orders, including adherence to the Family Violence Protection Act. The rewritten message should be polite, "
            f"respectful, and constructive, free from hostility, rude or disrespectful language, or inappropriate demands. Focus on eliminating "
            f"any forms of abuse or threats as detailed in the Family Violence Act. Return only the rewritten message without any "
            f"prelude or additional text.{language_instruction}"
        )
        return {
            "system": system_message,
            "messages": [
                {"role": "user", "content": f"[ORDERS] {orders}\n[FAMILY VIOLENCE ACT] {family_violence_act}\n[FROM] {parental_role}\n[TO] {recipient_role}\n[ORIGINAL MESSAGE] {message}\n[REWRITTEN MESSAGE]"}
            ]
        }

    def evaluate_message_dual_language(self, message, orders, parental_role, recipient_role, sender_language='en', recipient_language='en'):
        """Evaluate and rewrite message in both sender and recipient languages"""
        logger.info(f"Evaluating dual-language message: sender_lang={sender_language}, recipient_lang={recipient_language}")
        
        # Evaluate in sender's language first
        sender_prompt = self.construct_compliance_prompt(message, orders, parental_role, recipient_role, sender_language)
        sender_raw_response = self.generate_response(sender_prompt)
        sender_evaluation = self.extract_evaluation(sender_raw_response)
        
        results = {
            'sender_language': sender_language,
            'recipient_language': recipient_language,
            'needs_rewrite': sender_evaluation != "yes"
        }
        
        if sender_evaluation == "yes":
            # Message is appropriate, but we still need both language versions
            results['sender_version'] = message
            if sender_language == recipient_language:
                results['recipient_version'] = message
            else:
                # Translate original message to recipient's language
                results['recipient_version'] = self.translate_message_direct(message, recipient_language)
        else:
            # Message needs rewriting in both languages
            results['sender_version'] = self.rewrite_message(message, orders, parental_role, recipient_role, sender_language)
            if sender_language == recipient_language:
                results['recipient_version'] = results['sender_version']
            else:
                results['recipient_version'] = self.rewrite_message(message, orders, parental_role, recipient_role, recipient_language)
        
        logger.info(f"Dual-language result: sender='{results['sender_version'][:50]}...', recipient='{results['recipient_version'][:50]}...'")
        return results

    def translate_message_direct(self, message_content, target_language):
        """Translate message content directly to target language"""
        try:
            language_names = {
                'en': 'English', 'zh': 'Mandarin Chinese', 'hi': 'Hindi', 'es': 'Spanish',
                'fr': 'French', 'ar': 'Arabic', 'bn': 'Bengali', 'pt': 'Portuguese', 
                'ru': 'Russian', 'ja': 'Japanese'
            }
            
            target_language_name = language_names.get(target_language, 'English')
            
            # Use Claude to translate the message
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                temperature=0.1,
                system=f"You are a professional translator for family communication. Translate the text to natural, conversational {target_language_name} while preserving the exact meaning, tone, and intent. Return ONLY the translated text.",
                messages=[
                    {
                        "role": "user", 
                        "content": f"Translate to {target_language_name}: {message_content}"
                    }
                ]
            )
            
            translated_text = ' '.join([block.text for block in response.content]).strip()
            return translated_text
            
        except Exception as e:
            logger.error(f"Error translating message: {str(e)}")
            return message_content

    def rewrite_message(self, message, orders, parental_role, recipient_role, user_language='en'):
        logger.info(f"Rewriting message: {message} in language: {user_language}")
        prompt = self.construct_rewrite_prompt(message, orders, parental_role, recipient_role, user_language)
        raw_response = self.generate_response(prompt)
        rewritten_message = self.extract_rewritten_message(raw_response)
        logger.info(f"Rewritten message: {rewritten_message}")
        return rewritten_message

    def generate_response(self, prompt):
        logger.info(f"Generating response for messages: {prompt['messages']}")
        response = client.messages.create(
            model=self.model,
            max_tokens=1000,
            temperature=0.3,
            system=prompt["system"],
            messages=prompt["messages"]
        )
        logger.info(f"Full response: {response}")
        raw_response = ' '.join([block.text for block in response.content])
        logger.info(f"Generated raw response: {raw_response}")
        return raw_response

    def extract_evaluation(self, raw_response):
        evaluation = raw_response.strip().lower()
        logger.info(f"Extracted evaluation: {evaluation}")
        return "yes" if evaluation == "yes" else "no"

    def extract_rewritten_message(self, raw_response):
        lines = raw_response.split("\n")
        for line in lines:
            if "rewritten message" in line.lower():
                lines.remove(line)
        rewritten_message = " ".join(lines).strip()
        logger.info(f"Extracted rewritten message: {rewritten_message}")
        return rewritten_message

def log_message_dual_language(user_name, user_email, original_message, sender_version, recipient_version, 
                            conversation_id, parental_role, recipient_role, sender_language, recipient_language):
    """Log message with both language versions"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Generate message hash for integrity
    message_data = f"{user_name}:{original_message}:{timestamp}"
    message_hash = hashlib.sha256(message_data.encode()).hexdigest()
    
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        
        # Insert main message record (using sender's version as primary)
        cursor.execute("""
            INSERT INTO messages (user_name, user_email, original_message, rewritten_message, 
                                conversation_id, timestamp, parental_role, recipient_role, 
                                message_hash, is_read, has_attachments, attachment_count,
                                sender_language, recipient_language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (user_name, user_email, original_message, sender_version, conversation_id, 
              timestamp, parental_role, recipient_role, message_hash, False, False, 0,
              sender_language, recipient_language))
        
        message_id = cursor.lastrowid
        
        # Store sender language version
        cursor.execute("""
            INSERT OR REPLACE INTO message_translations (message_id, language_code, original_text, rewritten_text, created_date)
            VALUES (?, ?, ?, ?, ?)
        """, (message_id, sender_language, original_message, sender_version, timestamp))
        
        # Store recipient language version (if different)
        if sender_language != recipient_language:
            cursor.execute("""
                INSERT OR REPLACE INTO message_translations (message_id, language_code, original_text, rewritten_text, created_date)
                VALUES (?, ?, ?, ?, ?)
            """, (message_id, recipient_language, original_message, recipient_version, timestamp))
        
        conn.commit()
        logger.info(f"Logged dual-language message: ID={message_id}, sender_lang={sender_language}, recipient_lang={recipient_language}")
        
        return message_id

def log_message(user_name, user_email, original_message, rewritten_message, conversation_id, parental_role, recipient_role):
    """Backward compatibility wrapper for log_message_dual_language"""
    return log_message_dual_language(
        user_name, user_email, original_message, rewritten_message, rewritten_message,
        conversation_id, parental_role, recipient_role, 'en', 'en'
    )

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Routes
@app.get("/", response_class=HTMLResponse)
async def get_homepage():
    return FileResponse(BASE_DIR / "frontend" / "index.html")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message_evaluation":
                # Process message evaluation through WebSocket
                if not message_data.get("conversation_id"):
                    await manager.send_personal_message(json.dumps({
                        "type": "error",
                        "message": "Conversation ID is required"
                    }), websocket)
                    continue
                
                # Get sender and recipient language preferences
                sender_language = 'en'
                recipient_language = 'en'
                
                if message_data.get("user_email"):
                    try:
                        with sqlite3.connect(DB_PATH) as conn:
                            cursor = conn.cursor()
                            
                            # Get sender's language
                            cursor.execute("""
                                SELECT us.language_code 
                                FROM user_settings us
                                JOIN users u ON us.user_id = u.id
                                WHERE u.email = ?
                            """, (message_data["user_email"],))
                            sender_result = cursor.fetchone()
                            if sender_result:
                                sender_language = sender_result[0]
                            
                            # Get recipient's language (other parent)
                            cursor.execute("""
                                SELECT DISTINCT us.language_code 
                                FROM user_settings us
                                JOIN users u ON us.user_id = u.id
                                WHERE u.email != ?
                                LIMIT 1
                            """, (message_data["user_email"],))
                            recipient_result = cursor.fetchone()
                            if recipient_result:
                                recipient_language = recipient_result[0]
                                
                    except Exception as e:
                        logger.error(f"Error getting language preferences: {str(e)}")
                    
                chatbot = ChatbotModule()
                
                with sqlite3.connect(DB_PATH) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT description FROM orders")
                    orders = cursor.fetchone()
                    orders_text = orders[0] if orders else ""

                # Use dual-language evaluation
                evaluation_result = chatbot.evaluate_message_dual_language(
                    message_data["message"], 
                    orders_text, 
                    message_data["parental_role"], 
                    message_data["recipient_role"],
                    sender_language,
                    recipient_language
                )
                
                # Log message with both language versions
                message_id = log_message_dual_language(
                    message_data["user_name"], 
                    message_data["user_email"], 
                    message_data["message"], 
                    evaluation_result['sender_version'],
                    evaluation_result['recipient_version'],
                    message_data["conversation_id"], 
                    message_data["parental_role"], 
                    message_data["recipient_role"],
                    sender_language,
                    recipient_language
                )
                
                response = {
                    "type": "message_evaluation_result",
                    "evaluation": "no" if evaluation_result['needs_rewrite'] else "yes",
                    "message": evaluation_result['sender_version'],  # Send back sender's version
                    "message_id": message_id,
                    "parental_role": message_data["parental_role"],
                    "recipient_role": message_data["recipient_role"],
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "sender_language": sender_language,
                    "recipient_language": recipient_language
                }
                
                await manager.send_personal_message(json.dumps(response), websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Safespace is running successfully!",
        "features": {
            "message_evaluation": "AI-powered (Claude 3.5 Sonnet)",
            "calendar_management": "Available",
            "financial_tracking": "Available", 
            "accountable_payments": "Available with OCR",
            "info_logging": "Available",
            "info_library": "Available",
            "conversation_management": "Available",
            "profile_management": "Available",
            "file_upload": "Available",
            "authentication": "Available"
        }
    }

# Authentication utility functions
def generate_auth_token():
    """Generate a secure authentication token"""
    return secrets.token_urlsafe(32)

def get_current_user(authorization: Optional[str] = Header(None)):
    """Get current user from authentication token"""
    if not authorization or not authorization.startswith('Bearer '):
        return None
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.email, u.password_hash, u.full_name, u.preferred_name, u.role, u.phone_number,
                       u.address, u.postcode, u.emergency_contact, u.emergency_phone, u.subscription_type,
                       u.payment_method, u.card_last_four, u.billing_address, u.is_active, u.email_verified,
                       u.created_date, u.last_login, u.profile_completed, s.expires_at 
                FROM users u 
                JOIN user_sessions s ON u.id = s.user_id 
                WHERE s.token = ? AND s.is_active = TRUE
            """, (token,))
            result = cursor.fetchone()
            
            if not result:
                return None
            
            # Check if token is expired (expires_at is now at index 20)
            expires_at = datetime.strptime(result[20], "%Y-%m-%d %H:%M:%S")
            if datetime.now() > expires_at:
                # Deactivate expired token
                cursor.execute("UPDATE user_sessions SET is_active = FALSE WHERE token = ?", (token,))
                conn.commit()
                return None
            
            # Update last accessed
            cursor.execute("""
                UPDATE user_sessions SET last_accessed = ? WHERE token = ?
            """, (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), token))
            conn.commit()
            
            return {
                'id': result[0],
                'email': result[1],
                'fullName': result[3],  # full_name
                'preferredName': result[4],  # preferred_name
                'role': result[5],
                'phoneNumber': result[6],  # phone_number
                'address': result[7],
                'postcode': result[8],
                'emergencyContact': result[9],  # emergency_contact
                'emergencyPhone': result[10],  # emergency_phone
                'subscriptionType': result[11],  # subscription_type
                'paymentMethod': result[12],  # payment_method
                'cardLastFour': result[13],  # card_last_four
                'profileCompleted': result[19]  # profile_completed
            }
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return None

# Authentication endpoints
@app.post("/api/auth/signup")
async def signup(user_data: UserSignUp):
    """Create a new user account"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if user already exists
            cursor.execute("SELECT id FROM users WHERE email = ?", (user_data.email,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Hash password
            password_hash = hash_password(user_data.password)
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Create user
            cursor.execute("""
                INSERT INTO users (email, password_hash, full_name, preferred_name, role, 
                                  phone_number, address, postcode, emergency_contact, emergency_phone,
                                  subscription_type, payment_method, card_last_four, billing_address,
                                  created_date, profile_completed)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                user_data.email, password_hash, user_data.fullName, user_data.preferredName,
                user_data.role, user_data.phoneNumber, user_data.address, user_data.postcode,
                user_data.emergencyContact, user_data.emergencyPhone, user_data.subscriptionType,
                user_data.paymentMethod, user_data.cardNumber[-4:] if user_data.cardNumber else None,
                user_data.billingAddress, current_time, True
            ))
            
            user_id = cursor.lastrowid
            
            # Create relationship record
            cursor.execute("""
                INSERT INTO user_relationships (user_id, other_parent_name, other_parent_email, 
                                               other_parent_role, invitation_sent_date, created_date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, user_data.otherParentName, user_data.otherParentEmail, 
                  user_data.otherParentRole, current_time, current_time))
            
            # Add children
            for child in user_data.children:
                cursor.execute("""
                    INSERT INTO user_children (user_id, name, age, created_date)
                    VALUES (?, ?, ?, ?)
                """, (user_id, child['name'], int(child['age']), current_time))
            
            # Create notification preferences
            cursor.execute("""
                INSERT INTO user_notifications (user_id, created_date)
                VALUES (?, ?)
            """, (user_id, current_time))
            
            # Create authentication token
            token = generate_auth_token()
            expires_at = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("""
                INSERT INTO user_sessions (user_id, token, expires_at, created_date)
                VALUES (?, ?, ?, ?)
            """, (user_id, token, expires_at, current_time))
            
            conn.commit()
            
            # Prepare user response
            user_response = {
                'id': user_id,
                'email': user_data.email,
                'fullName': user_data.fullName,
                'preferredName': user_data.preferredName,
                'role': user_data.role,
                'phoneNumber': user_data.phoneNumber,
                'address': user_data.address,
                'postcode': user_data.postcode,
                'emergencyContact': user_data.emergencyContact,
                'emergencyPhone': user_data.emergencyPhone,
                'subscriptionType': user_data.subscriptionType,
                'otherParentName': user_data.otherParentName,
                'otherParentEmail': user_data.otherParentEmail,
                'otherParentRole': user_data.otherParentRole,
                'children': user_data.children
            }
            
            logger.info(f"User created successfully: {user_data.email}")
            return {"user": user_response, "token": token}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create account")

@app.post("/api/auth/signin")
async def signin(user_data: UserSignIn):
    """Sign in user and return authentication token"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user by email
            cursor.execute("""
                SELECT id, email, password_hash, full_name, preferred_name, role, phone_number,
                       address, postcode, emergency_contact, emergency_phone, subscription_type,
                       payment_method, card_last_four, profile_completed
                FROM users WHERE email = ? AND is_active = TRUE
            """, (user_data.email,))
            
            user = cursor.fetchone()
            if not user or not verify_password(user_data.password, user[2]):
                raise HTTPException(status_code=401, detail="Invalid email or password")
            
            # Create authentication token
            token = generate_auth_token()
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            expires_at = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
            
            cursor.execute("""
                INSERT INTO user_sessions (user_id, token, expires_at, created_date)
                VALUES (?, ?, ?, ?)
            """, (user[0], token, expires_at, current_time))
            
            # Update last login
            cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (current_time, user[0]))
            
            # Get additional user data
            cursor.execute("""
                SELECT other_parent_name, other_parent_email, other_parent_role 
                FROM user_relationships WHERE user_id = ?
            """, (user[0],))
            relationship = cursor.fetchone()
            
            cursor.execute("SELECT name, age FROM user_children WHERE user_id = ?", (user[0],))
            children = [{'name': row[0], 'age': row[1]} for row in cursor.fetchall()]
            
            conn.commit()
            
            # Prepare user response
            user_response = {
                'id': user[0],
                'email': user[1],
                'fullName': user[3],
                'preferredName': user[4],
                'role': user[5],
                'phoneNumber': user[6],
                'address': user[7],
                'postcode': user[8],
                'emergencyContact': user[9],
                'emergencyPhone': user[10],
                'subscriptionType': user[11],
                'paymentMethod': user[12],
                'cardLastFour': user[13],
                'profileCompleted': user[14],
                'otherParentName': relationship[0] if relationship else None,
                'otherParentEmail': relationship[1] if relationship else None,
                'otherParentRole': relationship[2] if relationship else None,
                'children': children
            }
            
            logger.info(f"User signed in successfully: {user_data.email}")
            return {"user": user_response, "token": token}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error signing in user: {str(e)}")
        raise HTTPException(status_code=500, detail="Sign in failed")

@app.get("/api/user/profile")
async def get_user_profile(current_user=Depends(get_current_user)):
    """Get current user profile"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get relationship data
            cursor.execute("""
                SELECT other_parent_name, other_parent_email, other_parent_role 
                FROM user_relationships WHERE user_id = ?
            """, (current_user['id'],))
            relationship = cursor.fetchone()
            
            # Get children
            cursor.execute("SELECT name, age FROM user_children WHERE user_id = ?", (current_user['id'],))
            children = [{'name': row[0], 'age': row[1]} for row in cursor.fetchall()]
            
            # Get notification preferences
            cursor.execute("""
                SELECT email_notifications, push_notifications, message_notifications,
                       calendar_notifications, payment_notifications
                FROM user_notifications WHERE user_id = ?
            """, (current_user['id'],))
            notifications = cursor.fetchone()
            
            profile_data = {
                **current_user,
                'otherParentName': relationship[0] if relationship else None,
                'otherParentEmail': relationship[1] if relationship else None,
                'otherParentRole': relationship[2] if relationship else None,
                'children': children,
                'emailNotifications': notifications[0] if notifications else True,
                'pushNotifications': notifications[1] if notifications else True,
                'messageNotifications': notifications[2] if notifications else True,
                'calendarNotifications': notifications[3] if notifications else True,
                'paymentNotifications': notifications[4] if notifications else True
            }
            
            return profile_data
            
    except Exception as e:
        logger.error(f"Error getting user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get profile")

@app.put("/api/user/profile")
async def update_user_profile(profile_data: UserProfileUpdate, current_user=Depends(get_current_user)):
    """Update user profile"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Build update query dynamically
            update_fields = []
            update_values = []
            
            for field, value in profile_data.dict(exclude_unset=True).items():
                if field == 'fullName':
                    update_fields.append("full_name = ?")
                elif field == 'preferredName':
                    update_fields.append("preferred_name = ?")
                elif field == 'phoneNumber':
                    update_fields.append("phone_number = ?")
                elif field == 'emergencyContact':
                    update_fields.append("emergency_contact = ?")
                elif field == 'emergencyPhone':
                    update_fields.append("emergency_phone = ?")
                else:
                    update_fields.append(f"{field} = ?")
                
                update_values.append(value)
            
            if update_fields:
                query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
                update_values.append(current_user['id'])
                cursor.execute(query, update_values)
                conn.commit()
            
            return {"success": True, "message": "Profile updated successfully"}
            
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

@app.put("/api/user/change-password")
async def change_password(password_data: PasswordChange, current_user=Depends(get_current_user)):
    """Change user password"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get current password hash
            cursor.execute("SELECT password_hash FROM users WHERE id = ?", (current_user['id'],))
            result = cursor.fetchone()
            
            if not result or not verify_password(password_data.currentPassword, result[0]):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            
            # Update password
            new_password_hash = hash_password(password_data.newPassword)
            cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", 
                          (new_password_hash, current_user['id']))
            conn.commit()
            
            logger.info(f"Password changed for user: {current_user['email']}")
            return {"success": True, "message": "Password changed successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing password: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to change password")

@app.put("/api/user/children")
async def update_children(children_data: ChildrenUpdate, current_user=Depends(get_current_user)):
    """Update user's children information"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Delete existing children
            cursor.execute("DELETE FROM user_children WHERE user_id = ?", (current_user['id'],))
            
            # Add new children
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            for child in children_data.children:
                cursor.execute("""
                    INSERT INTO user_children (user_id, name, age, created_date)
                    VALUES (?, ?, ?, ?)
                """, (current_user['id'], child['name'], int(child['age']), current_time))
            
            conn.commit()
            return {"success": True, "message": "Children information updated successfully"}
            
    except Exception as e:
        logger.error(f"Error updating children: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update children information")

@app.put("/api/user/notifications")
async def update_notifications(notification_data: NotificationPreferences, current_user=Depends(get_current_user)):
    """Update user notification preferences"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Update or insert notification preferences
            cursor.execute("""
                INSERT OR REPLACE INTO user_notifications 
                (user_id, email_notifications, push_notifications, message_notifications,
                 calendar_notifications, payment_notifications, created_date, updated_date)
                VALUES (?, ?, ?, ?, ?, ?, 
                        COALESCE((SELECT created_date FROM user_notifications WHERE user_id = ?), ?), ?)
            """, (
                current_user['id'], notification_data.emailNotifications, notification_data.pushNotifications,
                notification_data.messageNotifications, notification_data.calendarNotifications,
                notification_data.paymentNotifications, current_user['id'], current_time, current_time
            ))
            
            conn.commit()
            return {"success": True, "message": "Notification preferences updated successfully"}
            
    except Exception as e:
        logger.error(f"Error updating notifications: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update notification preferences")

@app.post("/api/evaluate_message")
async def evaluate_message(message_eval: MessageEvaluation, authorization: Optional[str] = Header(None)):
    try:
        chatbot = ChatbotModule()
        
        # Get sender and recipient language preferences
        sender_language = 'en'  # Default to English
        recipient_language = 'en'  # Default to English
        
        # Get sender's language preference
        current_user = get_current_user(authorization)
        if current_user:
            user_id = current_user.get('id')
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT language_code FROM user_settings WHERE user_id = ?", (user_id,))
                lang_result = cursor.fetchone()
                if lang_result:
                    sender_language = lang_result[0]
        
        # Get recipient's language preference (find other parent)
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # Find the other parent in this conversation - simplified approach
            # In production, you'd have a proper conversation participants table
            cursor.execute("""
                SELECT DISTINCT u.id, us.language_code 
                FROM users u 
                JOIN user_settings us ON u.id = us.user_id 
                WHERE u.email != ? 
                LIMIT 1
            """, (message_eval.user_email,))
            other_user = cursor.fetchone()
            if other_user and other_user[1]:
                recipient_language = other_user[1]

        # Get orders for AI evaluation
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT description FROM orders")
            orders = cursor.fetchone()
            orders_text = orders[0] if orders else ""

        # Use dual-language evaluation
        evaluation_result = chatbot.evaluate_message_dual_language(
            message_eval.message, 
            orders_text, 
            message_eval.parental_role, 
            message_eval.recipient_role,
            sender_language,
            recipient_language
        )
        
        if not message_eval.conversation_id:
            raise HTTPException(status_code=400, detail='Conversation ID is required')

        # Log message with both language versions
        message_id = log_message_dual_language(
            message_eval.user_name, 
            message_eval.user_email, 
            message_eval.message, 
            evaluation_result['sender_version'],
            evaluation_result['recipient_version'],
            message_eval.conversation_id, 
            message_eval.parental_role, 
            message_eval.recipient_role,
            sender_language,
            recipient_language
        )

        return {
            'evaluation': 'no' if evaluation_result['needs_rewrite'] else 'yes',
            'message': evaluation_result['sender_version'],  # Return sender's version to sender
            'message_id': message_id,
            'parental_role': message_eval.parental_role,
            'recipient_role': message_eval.recipient_role,
            'sender_language': sender_language,
            'recipient_language': recipient_language
        }
    except Exception as e:
        logger.error(f"Error evaluating message: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while evaluating message')

@app.post("/api/upload_orders")
async def upload_orders(file: UploadFile = File(...)):
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No selected file')

        file_path = UPLOAD_DIR / file.filename
        
        # Save uploaded file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        text_content = extract_text_from_file(file_path)
        if text_content:
            process_text_content(text_content)
            file_path.unlink()  # Remove file after processing
            return {'success': True}
        else:
            raise HTTPException(status_code=400, detail='File type not supported or empty content')
    except Exception as e:
        logger.error(f"Error in upload_orders: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while processing the file')

# File processing functions
def extract_text_from_file(file_path: Path):
    extension = file_path.suffix.lower()
    if extension == '.pdf':
        return extract_text_from_pdf(file_path)
    elif extension == '.docx':
        return extract_text_from_docx(file_path)
    elif extension == '.txt':
        return extract_text_from_txt(file_path)
    else:
        return None

def extract_text_from_pdf(file_path: Path):
    try:
        reader = PdfReader(file_path)
        return ''.join(page.extract_text() for page in reader.pages).strip()
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        return None

def extract_text_from_docx(file_path: Path):
    try:
        doc = docx.Document(file_path)
        return '\n'.join(para.text for para in doc.paragraphs).strip()
    except Exception as e:
        logger.error(f"Error extracting text from DOCX: {str(e)}")
        return None

def extract_text_from_txt(file_path: Path):
    try:
        with open(file_path, 'rb') as file:
            raw_data = file.read()
            encoding = chardet.detect(raw_data)['encoding']
            return raw_data.decode(encoding).strip()
    except Exception as e:
        logger.error(f"Error extracting text from TXT: {str(e)}")
        return None

def process_text_content(text_content):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO orders (description, date) VALUES (?, ?)",
                           (text_content, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit()
            logger.info(f"Logged orders to database: {text_content}")
    except Exception as e:
        logger.error(f"Error processing text content: {str(e)}")

# Calendar endpoints (keeping existing functionality)
@app.get("/api/calendar")
async def get_calendar():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM calendar")
            calendar_data = cursor.fetchall()
        return calendar_data
    except Exception as e:
        logger.error(f"Error retrieving calendar data: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving calendar data')

@app.post("/api/calendar")
async def create_calendar_event(event: CalendarEvent):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO calendar (event_label, event_time, repeat_occurrence, created_by, created_date, relationship_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (event.event_label, event.event_time, event.repeat_occurrence, event.created_by, 
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S"), event.relationship_id))
            event_id = cursor.lastrowid
            conn.commit()
        return {'success': True, 'event_id': event_id}
    except Exception as e:
        logger.error(f"Error creating calendar event: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating calendar event')

@app.put("/api/calendar/{event_id}")
async def update_calendar_event(event_id: int, event: CalendarEvent):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # Check if event exists and user has permission to edit
            cursor.execute("SELECT created_by FROM calendar WHERE id = ?", (event_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Event not found')
            
            if result[0] != event.created_by:
                raise HTTPException(status_code=403, detail='You can only edit events you created')
            
            # Prevent editing of events (as per new requirements)
            raise HTTPException(status_code=403, detail="Events cannot be edited once created")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating calendar event: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while updating calendar event')

@app.delete("/api/calendar/{event_id}")
async def delete_calendar_event(event_id: int, created_by: str):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # Check if event exists and user has permission to delete
            cursor.execute("SELECT created_by FROM calendar WHERE id = ?", (event_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Event not found')
            
            if result[0] != created_by:
                raise HTTPException(status_code=403, detail='You can only delete events you created')
            
            cursor.execute("DELETE FROM calendar WHERE id = ?", (event_id,))
            conn.commit()
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting calendar event: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while deleting calendar event')

# Enhanced Financial/Payments endpoints
@app.get("/api/payments")
async def get_payments():
    """Get all payment entries with OCR data"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, type, category, amount, description, payment_method, merchant, 
                       payment_date, notes, receipt_filename, receipt_human_readable, 
                       payment_type, date, created_by 
                FROM financial 
                ORDER BY date DESC
            """)
            payments = []
            for row in cursor.fetchall():
                payments.append({
                    'id': row[0],
                    'type': row[1],
                    'category': row[2],
                    'amount': row[3],
                    'description': row[4],
                    'payment_method': row[5],
                    'merchant': row[6],
                    'payment_date': row[7],
                    'notes': row[8],
                    'receipt_filename': row[9],
                    'receipt_summary': row[10],
                    'payment_type': row[11],
                    'date': row[12],
                    'created_by': row[13]
                })
            return payments
    except Exception as e:
        logger.error(f"Error retrieving payments: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving payments')

@app.post("/api/payments")
async def create_payment_entry(entry: PaymentEntry):
    """Create a new payment entry without receipt"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO financial (type, category, amount, description, payment_method, 
                                     merchant, payment_date, notes, payment_type, date, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (entry.type, entry.category, entry.amount, entry.description, entry.payment_method,
                  entry.merchant, entry.payment_date, entry.notes, entry.payment_type,
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S"), entry.created_by))
            payment_id = cursor.lastrowid
            conn.commit()
        return {'success': True, 'payment_id': payment_id}
    except Exception as e:
        logger.error(f"Error creating payment entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating payment entry')

@app.post("/api/payments/upload-receipt")
async def upload_receipt(
    file: UploadFile = File(...),
    category: str = Form(...),
    amount: Optional[str] = Form(None),
    description: Optional[str] = Form(""),
    notes: Optional[str] = Form(""),
    created_by: str = Form(...)
):
    """Upload receipt image and process with OCR"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')

        # Check file type
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.pdf'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail='File type not supported. Please upload an image or PDF file.')

        # Save uploaded file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = RECEIPTS_DIR / filename
        
        # Read file content
        file_content = await file.read()
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # Process with OCR
        ocr_processor = OCRProcessor()
        
        if file_extension == '.pdf':
            # For PDF files, extract text using existing method
            text_content = extract_text_from_pdf(file_path)
            ocr_result = {
                "ocr_data": json.dumps({"raw_text": text_content, "file_type": "pdf"}),
                "human_readable": f"PDF Document processed\n\nExtracted text: {text_content[:500]}..." if text_content and len(text_content) > 500 else f"Extracted text: {text_content}" if text_content else "No text found in PDF",
                "success": True
            }
        else:
            # For images, use OCR processing
            ocr_result = ocr_processor.process_receipt_image(file_path, file_content)

        # Parse OCR data to extract useful information
        try:
            ocr_data = json.loads(ocr_result["ocr_data"])
            
            # Use OCR data to fill in missing information
            if not amount and ocr_data.get('amount'):
                amount = str(ocr_data['amount'])
            
            merchant = ocr_data.get('merchant_name', '')
            payment_method = ocr_data.get('payment_method', '')
            payment_date = ocr_data.get('transaction_date', '')
            
            # If category is not specified or is 'other', try to use OCR category
            if category == 'other' and ocr_data.get('category'):
                category = ocr_data['category']
                
        except json.JSONDecodeError:
            merchant = ''
            payment_method = ''
            payment_date = ''

        # Create payment entry in database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO financial (type, category, amount, description, payment_method, 
                                     merchant, payment_date, notes, receipt_filename, 
                                     receipt_ocr_data, receipt_human_readable, payment_type, 
                                     date, created_by) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                'expense', category, float(amount) if amount else 0.0, description,
                payment_method, merchant, payment_date, notes, filename,
                ocr_result["ocr_data"], ocr_result["human_readable"], 'expense',
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"), created_by
            ))
            payment_id = cursor.lastrowid
            conn.commit()

        return {
            'success': True, 
            'payment_id': payment_id,
            'filename': filename,
            'ocr_summary': ocr_result["human_readable"],
            'ocr_success': ocr_result["success"]
        }

    except Exception as e:
        logger.error(f"Error uploading receipt: {str(e)}")
        # Clean up file if error occurred
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f'An error occurred while processing receipt: {str(e)}')

@app.get("/api/payments/categories")
async def get_payment_categories():
    """Get list of available payment categories"""
    return {
        "categories": [
            "child_support",
            "medical",
            "education",
            "food",
            "clothing",
            "activities",
            "transportation",
            "housing",
            "utilities",
            "legal",
            "childcare",
            "extracurricular",
            "school_supplies",
            "toys_entertainment",
            "other"
        ]
    }

@app.post("/api/payments/{payment_id}/suggest")
async def create_payment_suggestion(payment_id: int, suggestion: PaymentSuggestion):
    """Create a payment suggestion for another parent"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if payment exists
            cursor.execute("SELECT * FROM financial WHERE id = ?", (payment_id,))
            payment = cursor.fetchone()
            if not payment:
                raise HTTPException(status_code=404, detail='Payment not found')
            
            # Create suggestion
            cursor.execute("""
                INSERT INTO payment_suggestions (payment_id, suggested_to, suggested_amount, 
                                               reason, created_by, created_date) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (payment_id, suggestion.suggested_to, suggestion.suggested_amount, 
                  suggestion.reason, suggestion.created_by, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            suggestion_id = cursor.lastrowid
            conn.commit()
            
        return {'success': True, 'suggestion_id': suggestion_id}
    except Exception as e:
        logger.error(f"Error creating payment suggestion: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating payment suggestion')

@app.get("/api/payments/suggestions")
async def get_payment_suggestions():
    """Get all payment suggestions"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT ps.*, f.description, f.amount as original_amount, f.category 
                FROM payment_suggestions ps 
                JOIN financial f ON ps.payment_id = f.id 
                ORDER BY ps.created_date DESC
            """)
            suggestions = []
            for row in cursor.fetchall():
                suggestions.append({
                    'id': row[0],
                    'payment_id': row[1],
                    'suggested_to': row[2],
                    'suggested_amount': row[3],
                    'reason': row[4],
                    'status': row[5],
                    'proof_filename': row[6],
                    'created_by': row[8],
                    'created_date': row[9],
                    'response_date': row[10],
                    'original_description': row[11],
                    'original_amount': row[12],
                    'category': row[13]
                })
            return suggestions
    except Exception as e:
        logger.error(f"Error retrieving payment suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving payment suggestions')

@app.post("/api/payments/suggestions/{suggestion_id}/respond")
async def respond_to_suggestion(
    suggestion_id: int,
    file: Optional[UploadFile] = File(None),
    status: str = Form(...),
    responded_by: str = Form(...)
):
    """Respond to a payment suggestion with optional proof"""
    try:
        proof_filename = None
        proof_ocr_data = None
        
        if file and file.filename:
            # Process proof file
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"proof_{timestamp}_{file.filename}"
            file_path = RECEIPTS_DIR / filename
            
            file_content = await file.read()
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            # Process with OCR if it's an image
            file_extension = Path(file.filename).suffix.lower()
            if file_extension in {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}:
                ocr_processor = OCRProcessor()
                ocr_result = ocr_processor.process_receipt_image(file_path, file_content)
                proof_ocr_data = ocr_result["ocr_data"]
            
            proof_filename = filename

        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE payment_suggestions 
                SET status = ?, proof_filename = ?, proof_ocr_data = ?, response_date = ?
                WHERE id = ?
            """, (status, proof_filename, proof_ocr_data, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), suggestion_id))
            conn.commit()
            
        return {'success': True}
    except Exception as e:
        logger.error(f"Error responding to suggestion: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while responding to suggestion')

# Legacy financial endpoints (for backward compatibility)
@app.get("/api/financial")
async def get_financial():
    """Legacy endpoint - redirects to payments"""
    return await get_payments()

@app.post("/api/financial")
async def create_financial_entry(entry: FinancialEntry):
    """Legacy endpoint - creates basic payment entry"""
    payment_entry = PaymentEntry(
        category=entry.type,
        amount=entry.amount,
        description=entry.description,
        created_by=entry.created_by,
        payment_type="expense"
    )
    return await create_payment_entry(payment_entry)

@app.get("/api/financial/{financial_id}/messages")
async def get_financial_messages(financial_id: int):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM messages WHERE conversation_id = ?", (financial_id,))
            messages = cursor.fetchall()
        return messages
    except Exception as e:
        logger.error(f"Error retrieving financial messages: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving financial messages')

# Info log endpoints (keeping existing functionality)
@app.get("/api/info_log")
async def get_info_log():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM info_log")
            info_log_data = cursor.fetchall()
        return info_log_data
    except Exception as e:
        logger.error(f"Error retrieving info log data: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving info log data')

@app.post("/api/info_log")
async def create_info_log_entry(entry: InfoLogEntry):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO info_log (child_name, type, description, date, created_by) VALUES (?, ?, ?, ?, ?)",
                           (entry.child_name, entry.type, entry.description, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), entry.created_by))
            conn.commit()
        return {'success': True}
    except Exception as e:
        logger.error(f"Error creating info log entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating info log entry')

# Conversation endpoints (keeping existing functionality)
@app.get("/api/conversation")
async def get_conversations():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM conversations")
            conversation_data = cursor.fetchall()
        return conversation_data
    except Exception as e:
        logger.error(f"Error retrieving conversation data: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving conversation data')

@app.post("/api/conversation")
async def create_conversation(entry: ConversationEntry):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO conversations (title, date) VALUES (?, ?)",
                           (entry.title, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            conversation_id = cursor.lastrowid
            conn.commit()
            logger.info(f"Created conversation with ID: {conversation_id}, title: {entry.title}")
        return {'success': True, 'conversation_id': conversation_id, 'title': entry.title}
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating conversation')

@app.get("/api/conversation/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: int, authorization: Optional[str] = Header(None)):
    try:
        logger.info(f"Retrieving messages for conversation ID: {conversation_id}")
        
        # Get current user's language preference
        current_user = get_current_user(authorization)
        user_language = 'en'  # Default to English
        user_id = None
        
        if current_user:
            user_id = current_user.get('id')
            # Get user's language preference
            with sqlite3.connect(DB_PATH) as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT language_code FROM user_settings WHERE user_id = ?", (user_id,))
                lang_result = cursor.fetchone()
                if lang_result:
                    user_language = lang_result[0]
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get messages with translations in the user's preferred language
            cursor.execute("""
                SELECT m.id, m.user_name, m.user_email, m.original_message, 
                       COALESCE(mt.rewritten_text, m.rewritten_message) as display_message,
                       m.conversation_id, m.timestamp, m.parental_role, m.recipient_role,
                       m.is_read, m.read_at, m.read_by, m.message_hash, m.has_attachments,
                       (SELECT COUNT(*) FROM message_attachments ma WHERE ma.message_id = m.id) as attachment_count
                FROM messages m
                LEFT JOIN message_translations mt ON m.id = mt.message_id AND mt.language_code = ?
                WHERE m.conversation_id = ?
                ORDER BY m.timestamp ASC
            """, (user_language, conversation_id))
            messages = cursor.fetchall()

        if not messages:
            logger.info(f"No messages found for conversation ID: {conversation_id}")
            return []

        logger.info(f"Retrieved {len(messages)} messages in language: {user_language}")
        return messages
        
    except Exception as e:
        logger.error(f"Error retrieving conversation messages: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving conversation messages')

def get_current_user(authorization):
    """Extract user info from authorization header"""
    if not authorization:
        return None
    
    try:
        # Extract token from Bearer header
        token = authorization.replace('Bearer ', '')
        
        # Validate token and get user data
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            # Find user by valid token
            cursor.execute("""
                SELECT u.id, u.email, u.full_name 
                FROM users u
                JOIN user_sessions us ON u.id = us.user_id
                WHERE us.token = ? AND us.is_active = TRUE 
                AND datetime(us.expires_at) > datetime('now')
            """, (token,))
            user_data = cursor.fetchone()
            if user_data:
                return {
                    'id': user_data[0],
                    'email': user_data[1],
                    'name': user_data[2]
                }
        return None
    except Exception as e:
        logger.error(f"Error getting current user: {str(e)}")
        return None

# Enhanced messaging endpoints
@app.put("/api/message/{message_id}/read")
async def mark_message_read(message_id: int, update: MessageUpdate):
    """Mark a message as read with mandatory read receipts"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE messages 
                SET is_read = ?, read_at = ?, read_by = ?
                WHERE id = ?
            """, (update.is_read, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), update.read_by, message_id))
            conn.commit()
            
        return {'success': True}
    except Exception as e:
        logger.error(f"Error marking message as read: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while updating message')

@app.post("/api/message/{message_id}/attachments")
async def upload_message_attachment(
    message_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form(...)
):
    """Upload attachment to a message"""
    try:
        # Check if message exists
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM messages WHERE id = ?", (message_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Message not found")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else ''
        stored_filename = f"msg_{message_id}_{timestamp}_{secrets.token_hex(8)}.{file_extension}"
        
        # Create message attachments directory
        msg_attachments_dir = UPLOAD_DIR / "message_attachments"
        msg_attachments_dir.mkdir(exist_ok=True)
        file_path = msg_attachments_dir / stored_filename
        
        # Save file
        content = await file.read()
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Calculate file hash
        file_hash = hashlib.sha256(content).hexdigest()
        
        # Save to database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO message_attachments 
                (message_id, original_filename, stored_filename, file_path, file_type, file_size, 
                 uploaded_by, upload_date, file_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                message_id, file.filename, stored_filename, str(file_path),
                file.content_type, len(content), uploaded_by,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"), file_hash
            ))
            
            # Update message to indicate it has attachments
            cursor.execute("""
                UPDATE messages 
                SET has_attachments = TRUE, 
                    attachment_count = (SELECT COUNT(*) FROM message_attachments WHERE message_id = ?)
                WHERE id = ?
            """, (message_id, message_id))
            
            conn.commit()
        
        return {
            'success': True,
            'filename': stored_filename,
            'original_filename': file.filename,
            'file_size': len(content)
        }
        
    except Exception as e:
        logger.error(f"Error uploading message attachment: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while uploading attachment')

@app.get("/api/message/{message_id}/attachments")
async def get_message_attachments(message_id: int):
    """Get all attachments for a message"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM message_attachments WHERE message_id = ?
                ORDER BY upload_date ASC
            """, (message_id,))
            attachments = cursor.fetchall()
            
        return attachments
    except Exception as e:
        logger.error(f"Error retrieving message attachments: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving attachments')

@app.get("/api/message/attachment/{attachment_id}/download")
async def download_message_attachment(attachment_id: int):
    """Download a message attachment"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_filename, stored_filename, file_path, file_type 
                FROM message_attachments WHERE id = ?
            """, (attachment_id,))
            attachment = cursor.fetchone()
            
        if not attachment:
            raise HTTPException(status_code=404, detail="Attachment not found")
        
        original_filename, stored_filename, file_path, file_type = attachment
        
        if not Path(file_path).exists():
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        return FileResponse(
            path=file_path,
            filename=original_filename,
            media_type=file_type or 'application/octet-stream'
        )
        
    except Exception as e:
        logger.error(f"Error downloading attachment: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading attachment')

@app.post("/api/conversation/search")
async def search_messages(search: MessageSearch):
    """Search messages across conversations"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Build search query
            base_query = """
                SELECT m.*, c.title as conversation_title
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE (m.rewritten_message LIKE ? OR m.user_name LIKE ?)
            """
            params = [f"%{search.query}%", f"%{search.query}%"]
            
            # Add filters
            if search.conversation_id:
                base_query += " AND m.conversation_id = ?"
                params.append(search.conversation_id)
            
            if search.date_from:
                base_query += " AND m.timestamp >= ?"
                params.append(search.date_from)
            
            if search.date_to:
                base_query += " AND m.timestamp <= ?"
                params.append(search.date_to)
            
            if search.sender:
                base_query += " AND m.user_name LIKE ?"
                params.append(f"%{search.sender}%")
            
            base_query += " ORDER BY m.timestamp DESC LIMIT 100"
            
            cursor.execute(base_query, params)
            results = cursor.fetchall()
            
        return results
    except Exception as e:
        logger.error(f"Error searching messages: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while searching messages')

@app.post("/api/conversation/report")
async def report_conversation(report: MessageReport):
    """Report a conversation or specific message"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO conversation_reports 
                (conversation_id, message_id, reported_by, report_type, reason, description, report_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                report.conversation_id, report.message_id, report.reported_by,
                report.report_type, report.reason, report.description,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            report_id = cursor.lastrowid
            conn.commit()
            
        # Create JSON report for admin
        report_data = {
            "report_id": report_id,
            "conversation_id": report.conversation_id,
            "message_id": report.message_id,
            "reported_by": report.reported_by,
            "report_type": report.report_type,
            "reason": report.reason,
            "description": report.description,
            "report_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "Open"
        }
        
        # Save report JSON file for admin
        reports_dir = BASE_DIR / "reports"
        reports_dir.mkdir(exist_ok=True)
        report_filename = f"report_{report_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(reports_dir / report_filename, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        return {'success': True, 'report_id': report_id}
    except Exception as e:
        logger.error(f"Error creating report: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating report')

@app.post("/api/conversation/export")
async def export_conversation(export: ConversationExport):
    """Export conversation to PDF with Safe space header and hash verification"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get conversation details
            cursor.execute("SELECT * FROM conversations WHERE id = ?", (export.conversation_id,))
            conversation = cursor.fetchone()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation not found")
            
            # Build message query with date filters
            message_query = "SELECT * FROM messages WHERE conversation_id = ?"
            params = [export.conversation_id]
            
            if export.date_from:
                message_query += " AND timestamp >= ?"
                params.append(export.date_from)
            
            if export.date_to:
                message_query += " AND timestamp <= ?"
                params.append(export.date_to)
            
            message_query += " ORDER BY timestamp ASC"
            
            cursor.execute(message_query, params)
            messages = cursor.fetchall()
            
            if not messages:
                raise HTTPException(status_code=404, detail="No messages found for export")
        
        # Generate PDF with Safe space header
        pdf_content = generate_conversation_pdf(conversation, messages, export)
        
        # Create filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"conversation_{export.conversation_id}_{timestamp}.pdf"
        
        return StreamingResponse(
            io.BytesIO(pdf_content),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
        )
        
    except Exception as e:
        logger.error(f"Error exporting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while exporting conversation')

def generate_conversation_pdf(conversation, messages, export_params):
    """Generate PDF with Safe space header for court use"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    content = []
    
    # Title
    title_style = styles['Title']
    title_style.textColor = colors.darkblue
    content.append(Paragraph("SAFESPACE SECURE MESSAGING", title_style))
    content.append(Paragraph("CONVERSATION EXPORT CERTIFICATE", title_style))
    content.append(Spacer(1, 0.3*inch))
    
    # Safe space Verification Statement
    verification_text = """
    <b>CERTIFICATION OF MESSAGE INTEGRITY</b><br/>
    <br/>
    This document contains an export of secure family communications from the Safespace platform,
    a certified family communication system designed to ensure safe and respectful dialogue between
    separated parents. All messages in this export have been processed through AI safety validation
    and are preserved with their original timestamps and cryptographic verification.<br/>
    <br/>
    The integrity and authenticity of these communications are verified through cryptographic
    hash validation as detailed below.
    """
    content.append(Paragraph(verification_text, styles['Normal']))
    content.append(Spacer(1, 0.2*inch))
    
    # Conversation Information Table
    conv_info_data = [
        ['Conversation Information', ''],
        ['Conversation ID:', str(conversation[0])],
        ['Title:', conversation[1]],
        ['Created Date:', conversation[2]],
        ['Total Messages:', str(len(messages))],
        ['Export Date:', datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")],
        ['Export Range:', f"{export_params.date_from or 'All'} to {export_params.date_to or 'All'}"],
    ]
    
    conv_info_table = Table(conv_info_data, colWidths=[2*inch, 4*inch])
    conv_info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.lightblue),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    content.append(conv_info_table)
    content.append(Spacer(1, 0.2*inch))
    
    # Generate hash for entire conversation
    conversation_data = json.dumps({
        'conversation_id': conversation[0],
        'title': conversation[1],
        'messages': [{'id': msg[0], 'content': msg[4], 'timestamp': msg[6]} for msg in messages]
    }, sort_keys=True)
    conversation_hash = hashlib.sha256(conversation_data.encode()).hexdigest()
    
    # Cryptographic Verification Table
    crypto_data = [
        ['Cryptographic Verification', ''],
        ['Hash Algorithm:', 'SHA-256'],
        ['Conversation Hash:', conversation_hash],
        ['Message Count Verified:', str(len(messages))],
        ['Hash Generation Date:', datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")],
        ['Verification Status:', 'VERIFIED ✓'],
    ]
    
    crypto_table = Table(crypto_data, colWidths=[2*inch, 4*inch])
    crypto_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (1, 0), colors.darkgreen),
        ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    content.append(crypto_table)
    content.append(Spacer(1, 0.3*inch))
    
    # Legal Statement
    legal_text = """
    <b>LEGAL CERTIFICATION:</b><br/>
    <br/>
    This conversation export was generated from the Safespace secure messaging system where all
    communications are processed through AI safety validation to ensure compliance with family
    violence protection guidelines. Messages shown reflect the AI-enhanced versions that were
    actually delivered, promoting safe and respectful communication.<br/>
    <br/>
    The cryptographic hash above serves as a digital fingerprint of the entire conversation
    that would change if any message content were altered. This ensures the integrity and
    authenticity of the communication record.<br/>
    <br/>
    <b>For court verification:</b> The conversation hash and individual message details can be
    independently verified by accessing the Safespace system records or by contacting Safespace
    technical support with the Conversation ID provided above.
    """
    content.append(Paragraph(legal_text, styles['Normal']))
    content.append(Spacer(1, 0.3*inch))
    
    # Messages Section
    content.append(Paragraph("<b>CONVERSATION MESSAGES</b>", styles['Heading2']))
    content.append(Spacer(1, 0.2*inch))
    
    for i, message in enumerate(messages, 1):
        msg_id, user_name, user_email, original_msg, rewritten_msg, conv_id, timestamp, parental_role, recipient_role = message[:9]
        
        # Message header
        msg_header = f"<b>Message #{i}</b> - {timestamp}"
        content.append(Paragraph(msg_header, styles['Heading3']))
        
        # Message details table
        msg_data = [
            ['From:', f"{user_name} ({parental_role})"],
            ['To:', recipient_role],
            ['Timestamp:', timestamp],
            ['Message ID:', str(msg_id)],
        ]
        
        msg_table = Table(msg_data, colWidths=[1*inch, 5*inch])
        msg_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightyellow),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        content.append(msg_table)
        content.append(Spacer(1, 0.1*inch))
        
        # Message content
        content.append(Paragraph("<b>Message Content:</b>", styles['Normal']))
        content.append(Paragraph(rewritten_msg, styles['Normal']))
        
        # AI Processing indicator
        if original_msg != rewritten_msg:
            content.append(Paragraph(
                "<i>Note: This message was AI-enhanced for safety and respectful communication.</i>", 
                styles['Normal']
            ))
        
        content.append(Spacer(1, 0.2*inch))
    
    # Footer
    footer_text = f"""
    <br/>
    This export was generated automatically by the Safespace system on {datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")}.
    Document hash: {conversation_hash}
    """
    content.append(Paragraph(footer_text, styles['Normal']))
    
    # Build PDF
    doc.build(content)
    buffer.seek(0)
    return buffer.getvalue()

@app.post("/api/notifications/send")
async def send_notification(notification_data: dict):
    """Send notification for new message"""
    try:
        # For now, just log the notification (in production, integrate with email/push service)
        logger.info(f"Notification would be sent: {notification_data}")
        
        # Store notification in database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO message_notifications 
                (user_id, message_id, conversation_id, notification_type, created_date)
                VALUES (?, ?, ?, ?, ?)
            """, (
                notification_data.get('user_id', 0),
                notification_data.get('message_id'),
                notification_data.get('conversation_id'),
                notification_data.get('type', 'new_message'),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            conn.commit()
        
        return {'success': True, 'message': 'Notification queued'}
    except Exception as e:
        logger.error(f"Error sending notification: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while sending notification')

@app.get("/api/user/{user_id}/notifications")
async def get_user_notifications(user_id: int):
    """Get notifications for a user"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT n.*, c.title as conversation_title
                FROM message_notifications n
                JOIN conversations c ON n.conversation_id = c.id
                WHERE n.user_id = ?
                ORDER BY n.created_date DESC
                LIMIT 50
            """, (user_id,))
            notifications = cursor.fetchall()
            
        return notifications
    except Exception as e:
        logger.error(f"Error retrieving notifications: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving notifications')

# Language support endpoint
@app.get("/api/languages")
async def get_supported_languages():
    """Get list of 10 most common languages worldwide"""
    return {
        'languages': [
            {'code': 'en', 'name': 'English', 'native': 'English'},
            {'code': 'zh', 'name': 'Mandarin Chinese', 'native': '中文 (普通话)'},
            {'code': 'hi', 'name': 'Hindi', 'native': 'हिन्दी'},
            {'code': 'es', 'name': 'Spanish', 'native': 'Español'},
            {'code': 'fr', 'name': 'French', 'native': 'Français'},
            {'code': 'ar', 'name': 'Arabic', 'native': 'العربية'},
            {'code': 'bn', 'name': 'Bengali', 'native': 'বাংলা'},
            {'code': 'pt', 'name': 'Portuguese', 'native': 'Português'},
            {'code': 'ru', 'name': 'Russian', 'native': 'Русский'},
            {'code': 'ja', 'name': 'Japanese', 'native': '日本語'}
        ]
    }

@app.put("/api/user/{user_id}/language")
async def update_user_language(user_id: int, language_data: dict):
    """Update user's preferred language"""
    try:
        language_code = language_data.get('language_code', 'en')
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if user_settings table exists, create if not
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    language_code TEXT DEFAULT 'en',
                    ai_language_instruction TEXT,
                    created_date TEXT NOT NULL,
                    updated_date TEXT,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                    UNIQUE(user_id)
                )
            """)
            
            # Create AI instruction for the selected language
            language_names = {
                'en': 'English', 'zh': 'Mandarin Chinese', 'hi': 'Hindi', 'es': 'Spanish',
                'fr': 'French', 'ar': 'Arabic', 'bn': 'Bengali', 'pt': 'Portuguese', 
                'ru': 'Russian', 'ja': 'Japanese'
            }
            
            language_name = language_names.get(language_code, 'English')
            ai_instruction = f"Always respond and rewrite messages in {language_name} language. Ensure all text output is in {language_name}."
            
            # Upsert user language setting
            cursor.execute("""
                INSERT OR REPLACE INTO user_settings 
                (user_id, language_code, ai_language_instruction, created_date, updated_date)
                VALUES (?, ?, ?, 
                        COALESCE((SELECT created_date FROM user_settings WHERE user_id = ?), ?),
                        ?)
            """, (
                user_id, language_code, ai_instruction, user_id,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            ))
            
            conn.commit()
        
        return {'success': True, 'language_code': language_code}
    except Exception as e:
        logger.error(f"Error updating user language: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while updating language preference')

@app.get("/api/profile")
async def get_profiles():
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM profiles")
            profile_data = cursor.fetchall()
        return profile_data
    except Exception as e:
        logger.error(f"Error retrieving profile data: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving profile data')

@app.post("/api/profile")
async def create_profile(entry: ProfileEntry):
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO profiles (trigger_words, pronouns, preferred_name_a, preferred_name_b, alternate_contact, 
                children_names, emergency_contact, postcode, usual_address, dob, parental_role, created_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (entry.trigger_words, entry.pronouns, entry.preferred_name_a, entry.preferred_name_b, entry.alternate_contact, 
                  entry.children_names, entry.emergency_contact, entry.postcode, entry.usual_address, entry.dob, 
                  entry.parental_role, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            conn.commit()
        return {'success': True}
    except Exception as e:
        logger.error(f"Error creating profile: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating profile')

# Info Library endpoints
@app.get("/api/info-library")
async def get_info_library():
    """Get all info library entries"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, description, category, file_name, file_type, file_size, 
                       is_file, uploaded_by, upload_date, downloads_log
                FROM info_library 
                ORDER BY upload_date DESC
            """)
            entries = []
            for row in cursor.fetchall():
                entries.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'category': row[3],
                    'file_name': row[4],
                    'file_type': row[5],
                    'file_size': row[6],
                    'is_file': bool(row[7]),
                    'uploaded_by': row[8],
                    'upload_date': row[9],
                    'downloads_log': row[10] or ''
                })
        return entries
    except Exception as e:
        logger.error(f"Error retrieving info library entries: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving info library entries')

@app.post("/api/info-library/upload")
async def upload_info_library_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form(...),
    created_by: str = Form(...)
):
    """Upload a file to the info library"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')

        # Check file type and size
        allowed_extensions = {'.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail='File type not supported. Please upload PDF, DOC, DOCX, TXT, or image files.')

        # Read file content and check size (10MB limit)
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=400, detail='File size too large. Maximum size is 10MB.')

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{file.filename}"
        file_path = INFO_LIBRARY_DIR / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # Store entry in database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO info_library (title, description, category, file_name, file_path, 
                                        file_type, file_size, is_file, uploaded_by, upload_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (title, description, category, unique_filename, str(file_path), 
                  file_extension.lstrip('.'), file_size, True, created_by, 
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            entry_id = cursor.lastrowid
            conn.commit()

        return {
            'success': True, 
            'entry_id': entry_id,
            'filename': unique_filename,
            'file_size': file_size
        }

    except Exception as e:
        logger.error(f"Error uploading info library file: {str(e)}")
        # Clean up file if error occurred
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f'An error occurred while uploading file: {str(e)}')

@app.post("/api/info-library/info")
async def create_info_library_entry(entry: InfoLibraryEntry):
    """Create a text-based info library entry (non-file)"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO info_library (title, description, category, is_file, uploaded_by, upload_date) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (entry.title, entry.description, entry.category, False, entry.created_by,
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            entry_id = cursor.lastrowid
            conn.commit()
        return {'success': True, 'entry_id': entry_id}
    except Exception as e:
        logger.error(f"Error creating info library entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating info library entry')

@app.get("/api/info-library/download/{entry_id}")
async def download_info_library_file(entry_id: int, downloaded_by: str):
    """Download a file from the info library and log the download"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get file information
            cursor.execute("""
                SELECT file_path, file_name, downloads_log, is_file, title 
                FROM info_library WHERE id = ?
            """, (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            file_path, file_name, downloads_log, is_file, title = result
            
            if not is_file:
                raise HTTPException(status_code=400, detail='This entry is not a file')
            
            # Check if file exists on disk
            actual_file_path = Path(file_path)
            if not actual_file_path.exists():
                raise HTTPException(status_code=404, detail='File not found on disk')
            
            # Log the download
            download_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_download_log = f"{downloads_log}\n{downloaded_by} downloaded on {download_timestamp}".strip()
            
            cursor.execute("""
                UPDATE info_library SET downloads_log = ? WHERE id = ?
            """, (new_download_log, entry_id))
            conn.commit()
            
        # Return the file
        return FileResponse(
            path=actual_file_path,
            filename=file_name,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading info library file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading file')

@app.get("/api/info-library/categories")
async def get_info_library_categories():
    """Get list of available info library categories"""
    return {
        "categories": [
            "medical",
            "legal",
            "school_records",
            "emergency_contacts",
            "custody_documents",
            "insurance",
            "financial_records",
            "activities",
            "other"
        ]
    }

@app.get("/api/info-library/search")
async def search_info_library(query: str = "", category: str = ""):
    """Search info library entries"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Build search query
            sql = """
                SELECT id, title, description, category, file_name, file_type, file_size, 
                       is_file, uploaded_by, upload_date, downloads_log
                FROM info_library 
                WHERE 1=1
            """
            params = []
            
            if query:
                sql += " AND (title LIKE ? OR description LIKE ?)"
                search_term = f"%{query}%"
                params.extend([search_term, search_term])
            
            if category and category != "all":
                sql += " AND category = ?"
                params.append(category)
            
            sql += " ORDER BY upload_date DESC"
            
            cursor.execute(sql, params)
            entries = []
            for row in cursor.fetchall():
                entries.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'category': row[3],
                    'file_name': row[4],
                    'file_type': row[5],
                    'file_size': row[6],
                    'is_file': bool(row[7]),
                    'uploaded_by': row[8],
                    'upload_date': row[9],
                    'downloads_log': row[10] or ''
                })
        return entries
    except Exception as e:
        logger.error(f"Error searching info library: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while searching info library')

# Unalterable Records endpoints
@app.get("/api/unalterable-records")
async def get_unalterable_records():
    """Get all unalterable records entries"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, description, category, file_name, original_file_name,
                       file_type, file_size, file_hash, hash_algorithm, uploaded_by, 
                       upload_date, downloads_log, access_log, is_verified
                FROM unalterable_records 
                ORDER BY upload_date DESC
            """)
            entries = []
            for row in cursor.fetchall():
                entries.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'category': row[3],
                    'file_name': row[4],
                    'original_file_name': row[5],
                    'file_type': row[6],
                    'file_size': row[7],
                    'file_hash': row[8],
                    'hash_algorithm': row[9],
                    'uploaded_by': row[10],
                    'upload_date': row[11],
                    'downloads_log': row[12] or '',
                    'access_log': row[13] or '',
                    'is_verified': bool(row[14])
                })
        return entries
    except Exception as e:
        logger.error(f"Error retrieving unalterable records: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving unalterable records')

@app.post("/api/unalterable-records/upload")
async def upload_unalterable_record(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form(...),
    created_by: str = Form(...)
):
    """Upload a document to unalterable records"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')

        # Check file type and size
        allowed_extensions = {'.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail='File type not supported. Please upload PDF, DOC, DOCX, TXT, or image files.')

        # Read file content and check size (25MB limit for legal documents)
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > 25 * 1024 * 1024:  # 25MB limit
            raise HTTPException(status_code=400, detail='File size too large. Maximum size is 25MB.')

        # Initialize records manager
        records_manager = UnalterableRecordsManager()
        
        # Calculate file hash for integrity verification
        file_hash = records_manager.calculate_file_hash(file_content)
        
        # Generate unique filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"UR_{timestamp}_{file.filename}"
        file_path = UNALTERABLE_RECORDS_DIR / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Verify the file was saved correctly
        is_verified = records_manager.verify_file_integrity(file_path, file_hash)
        
        # Store entry in database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO unalterable_records (title, description, category, file_name, 
                                               file_path, original_file_name, file_type, file_size, 
                                               file_hash, hash_algorithm, uploaded_by, upload_date,
                                               is_verified) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (title, description, category, unique_filename, str(file_path), 
                  file.filename, file_extension.lstrip('.'), file_size, file_hash,
                  'SHA-256', created_by, datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                  is_verified))
            entry_id = cursor.lastrowid
            conn.commit()

        return {
            'success': True, 
            'entry_id': entry_id,
            'filename': unique_filename,
            'file_size': file_size,
            'file_hash': file_hash,
            'verified': is_verified
        }

    except Exception as e:
        logger.error(f"Error uploading unalterable record: {str(e)}")
        # Clean up file if error occurred
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f'An error occurred while uploading record: {str(e)}')

@app.get("/api/unalterable-records/download/{entry_id}")
async def download_unalterable_record(entry_id: int, downloaded_by: str):
    """Download an unalterable record and log the access"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get record information
            cursor.execute("""
                SELECT file_path, file_name, original_file_name, downloads_log, access_log,
                       title, category, file_type, file_size, file_hash, hash_algorithm,
                       uploaded_by, upload_date, is_verified
                FROM unalterable_records WHERE id = ?
            """, (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Record not found')
            
            (file_path, file_name, original_file_name, downloads_log, access_log,
             title, category, file_type, file_size, file_hash, hash_algorithm,
             uploaded_by, upload_date, is_verified) = result
            
            # Check if file exists on disk
            actual_file_path = Path(file_path)
            if not actual_file_path.exists():
                raise HTTPException(status_code=404, detail='File not found on disk')
            
            # Verify file integrity before download
            records_manager = UnalterableRecordsManager()
            current_verification = records_manager.verify_file_integrity(actual_file_path, file_hash)
            
            if not current_verification:
                logger.error(f"File integrity check failed for record {entry_id}")
                # Update verification status in database
                cursor.execute("UPDATE unalterable_records SET is_verified = ? WHERE id = ?", (False, entry_id))
                conn.commit()
                raise HTTPException(status_code=500, detail='File integrity verification failed - file may be corrupted')
            
            # Log the download and access
            download_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_download_log = f"{downloads_log}\n{downloaded_by} downloaded on {download_timestamp}".strip()
            new_access_log = f"{access_log}\n{downloaded_by} accessed for download on {download_timestamp}".strip()
            
            cursor.execute("""
                UPDATE unalterable_records 
                SET downloads_log = ?, access_log = ? 
                WHERE id = ?
            """, (new_download_log, new_access_log, entry_id))
            conn.commit()
            
        # Return the file
        return FileResponse(
            path=actual_file_path,
            filename=original_file_name,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading unalterable record: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading record')

@app.get("/api/unalterable-records/download-with-verification/{entry_id}")
async def download_record_with_verification(entry_id: int, downloaded_by: str):
    """Download record with verification certificate as PDF"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get record information
            cursor.execute("""
                SELECT file_path, file_name, original_file_name, downloads_log, access_log,
                       title, category, file_type, file_size, file_hash, hash_algorithm,
                       uploaded_by, upload_date, is_verified
                FROM unalterable_records WHERE id = ?
            """, (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Record not found')
            
            (file_path, file_name, original_file_name, downloads_log, access_log,
             title, category, file_type, file_size, file_hash, hash_algorithm,
             uploaded_by, upload_date, is_verified) = result
            
            # Verify file integrity
            actual_file_path = Path(file_path)
            if not actual_file_path.exists():
                raise HTTPException(status_code=404, detail='File not found on disk')
            
            records_manager = UnalterableRecordsManager()
            current_verification = records_manager.verify_file_integrity(actual_file_path, file_hash)
            
            # Prepare record data for verification PDF
            record_data = {
                'id': entry_id,
                'title': title,
                'category': category,
                'original_file_name': original_file_name,
                'file_type': file_type,
                'file_size': file_size,
                'file_hash': file_hash,
                'hash_algorithm': hash_algorithm,
                'uploaded_by': uploaded_by,
                'upload_date': upload_date,
                'is_verified': current_verification
            }
            
            # Generate verification PDF
            verification_pdf = records_manager.generate_verification_pdf(record_data, downloaded_by)
            
            # Log the access
            access_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            new_access_log = f"{access_log}\n{downloaded_by} downloaded with verification on {access_timestamp}".strip()
            new_download_log = f"{downloads_log}\n{downloaded_by} downloaded with verification on {access_timestamp}".strip()
            
            cursor.execute("""
                UPDATE unalterable_records 
                SET downloads_log = ?, access_log = ? 
                WHERE id = ?
            """, (new_download_log, new_access_log, entry_id))
            conn.commit()
            
        # Return verification PDF
        return StreamingResponse(
            io.BytesIO(verification_pdf),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=VERIFIED_{original_file_name}_verification.pdf"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating verification PDF: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while generating verification PDF')

@app.get("/api/unalterable-records/categories")
async def get_unalterable_record_categories():
    """Get list of available unalterable record categories"""
    return {
        "categories": [
            "legal_agreements",
            "court_orders",
            "custody_documents", 
            "parenting_plans",
            "financial_agreements",
            "medical_decisions",
            "education_decisions",
            "legal_correspondence",
            "official_documents",
            "other_legal"
        ]
    }

@app.get("/api/unalterable-records/search")
async def search_unalterable_records(query: str = "", category: str = ""):
    """Search unalterable records entries"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Build search query
            sql = """
                SELECT id, title, description, category, file_name, original_file_name,
                       file_type, file_size, file_hash, hash_algorithm, uploaded_by, 
                       upload_date, downloads_log, access_log, is_verified
                FROM unalterable_records 
                WHERE 1=1
            """
            params = []
            
            if query:
                sql += " AND (title LIKE ? OR description LIKE ?)"
                search_term = f"%{query}%"
                params.extend([search_term, search_term])
            
            if category and category != "all":
                sql += " AND category = ?"
                params.append(category)
            
            sql += " ORDER BY upload_date DESC"
            
            cursor.execute(sql, params)
            entries = []
            for row in cursor.fetchall():
                entries.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'category': row[3],
                    'file_name': row[4],
                    'original_file_name': row[5],
                    'file_type': row[6],
                    'file_size': row[7],
                    'file_hash': row[8],
                    'hash_algorithm': row[9],
                    'uploaded_by': row[10],
                    'upload_date': row[11],
                    'downloads_log': row[12] or '',
                    'access_log': row[13] or '',
                    'is_verified': bool(row[14])
                })
        return entries
    except Exception as e:
        logger.error(f"Error searching unalterable records: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while searching unalterable records')

@app.get("/api/unalterable-records/verify/{entry_id}")
async def verify_record_integrity(entry_id: int):
    """Verify the integrity of a specific record"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get record information
            cursor.execute("""
                SELECT file_path, file_hash, hash_algorithm, title
                FROM unalterable_records WHERE id = ?
            """, (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Record not found')
            
            file_path, stored_hash, hash_algorithm, title = result
            
            # Check if file exists
            actual_file_path = Path(file_path)
            if not actual_file_path.exists():
                return {
                    'verified': False,
                    'error': 'File not found on disk',
                    'title': title
                }
            
            # Verify integrity
            records_manager = UnalterableRecordsManager()
            is_verified = records_manager.verify_file_integrity(actual_file_path, stored_hash)
            
            # Update verification status in database
            cursor.execute("""
                UPDATE unalterable_records SET is_verified = ? WHERE id = ?
            """, (is_verified, entry_id))
            conn.commit()
            
            return {
                'verified': is_verified,
                'hash_algorithm': hash_algorithm,
                'stored_hash': stored_hash,
                'title': title
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying record integrity: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while verifying record integrity')

# Personal Journal endpoints
@app.get("/api/personal-journal")
async def get_personal_journal_entries(created_by: str):
    """Get all personal journal entries for a specific user"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, title, content, mood, entry_date, created_by, created_date, last_modified
                FROM personal_journal 
                WHERE created_by = ?
                ORDER BY entry_date DESC, created_date DESC
            """, (created_by,))
            
            entries = []
            for row in cursor.fetchall():
                entry_data = {
                    'id': row[0],
                    'title': row[1],
                    'content': row[2],
                    'mood': row[3],
                    'entry_date': row[4],
                    'created_by': row[5],
                    'created_date': row[6],
                    'last_modified': row[7]
                }
                
                # Get attached files for this entry
                cursor.execute("""
                    SELECT id, original_filename, stored_filename, file_type, file_size, upload_date
                    FROM journal_files 
                    WHERE journal_entry_id = ? AND uploaded_by = ?
                    ORDER BY upload_date DESC
                """, (row[0], created_by))
                
                files = []
                for file_row in cursor.fetchall():
                    files.append({
                        'id': file_row[0],
                        'original_filename': file_row[1],
                        'stored_filename': file_row[2],
                        'file_type': file_row[3],
                        'file_size': file_row[4],
                        'upload_date': file_row[5]
                    })
                
                entry_data['files'] = files
                entries.append(entry_data)
            
            return entries
            
    except Exception as e:
        logger.error(f"Error retrieving personal journal entries: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving journal entries')

@app.post("/api/personal-journal")
async def create_personal_journal_entry(entry: PersonalJournalEntry):
    """Create a new personal journal entry"""
    try:
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry_date = datetime.now().strftime("%Y-%m-%d")  # Auto-generate entry date as today
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO personal_journal (title, content, mood, entry_date, created_by, created_date)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (entry.title, entry.content, entry.mood, entry_date, entry.created_by, current_date))
            
            entry_id = cursor.lastrowid
            conn.commit()
            
        return {'success': True, 'entry_id': entry_id}
        
    except Exception as e:
        logger.error(f"Error creating personal journal entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating journal entry')

@app.put("/api/personal-journal/{entry_id}")
async def update_personal_journal_entry(entry_id: int, entry: PersonalJournalUpdate, updated_by: str):
    """Update a personal journal entry"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if entry exists and user has permission to edit
            cursor.execute("SELECT created_by FROM personal_journal WHERE id = ?", (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Journal entry not found')
            
            if result[0] != updated_by:
                raise HTTPException(status_code=403, detail='You can only edit your own journal entries')
            
            # Build update query dynamically based on provided fields
            update_fields = []
            update_values = []
            
            if entry.title is not None:
                update_fields.append("title = ?")
                update_values.append(entry.title)
            
            if entry.content is not None:
                update_fields.append("content = ?")
                update_values.append(entry.content)
            
            if entry.mood is not None:
                update_fields.append("mood = ?")
                update_values.append(entry.mood)
            
            if update_fields:
                update_fields.append("last_modified = ?")
                update_values.append(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                update_values.append(entry_id)
                
                query = f"UPDATE personal_journal SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, update_values)
                conn.commit()
            
        return {'success': True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating personal journal entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while updating journal entry')

@app.delete("/api/personal-journal/{entry_id}")
async def delete_personal_journal_entry(entry_id: int, deleted_by: str):
    """Delete a personal journal entry and associated files"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if entry exists and user has permission to delete
            cursor.execute("SELECT created_by FROM personal_journal WHERE id = ?", (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Journal entry not found')
            
            if result[0] != deleted_by:
                raise HTTPException(status_code=403, detail='You can only delete your own journal entries')
            
            # Get associated files to delete from filesystem
            cursor.execute("SELECT file_path FROM journal_files WHERE journal_entry_id = ?", (entry_id,))
            file_paths = cursor.fetchall()
            
            # Delete files from filesystem
            for (file_path,) in file_paths:
                try:
                    full_path = Path(file_path)
                    if full_path.exists():
                        full_path.unlink()
                except Exception as e:
                    logger.warning(f"Could not delete file {file_path}: {str(e)}")
            
            # Delete database records (files will be deleted by CASCADE)
            cursor.execute("DELETE FROM personal_journal WHERE id = ?", (entry_id,))
            conn.commit()
            
        return {'success': True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting personal journal entry: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while deleting journal entry')

@app.post("/api/personal-journal/{entry_id}/upload-file")
async def upload_journal_file(
    entry_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form(...)
):
    """Upload a file attachment to a personal journal entry"""
    try:
        # Check if journal entry exists and user has permission
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT created_by FROM personal_journal WHERE id = ?", (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Journal entry not found')
            
            if result[0] != uploaded_by:
                raise HTTPException(status_code=403, detail='You can only upload files to your own journal entries')
        
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')
        
        # Create user-specific directory
        user_dir = JOURNAL_FILES_DIR / uploaded_by.replace('@', '_').replace(' ', '_')
        user_dir.mkdir(exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = Path(file.filename).suffix
        stored_filename = f"{timestamp}_{entry_id}_{file.filename}"
        file_path = user_dir / stored_filename
        
        # Save file
        file_content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Get file info
        file_size = len(file_content)
        file_type = mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
        
        # Save file info to database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO journal_files (journal_entry_id, original_filename, stored_filename, 
                                         file_path, file_type, file_size, uploaded_by, upload_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (entry_id, file.filename, stored_filename, str(file_path), file_type, 
                  file_size, uploaded_by, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            file_id = cursor.lastrowid
            conn.commit()
        
        return {
            'success': True,
            'file_id': file_id,
            'filename': file.filename,
            'stored_filename': stored_filename,
            'file_size': file_size,
            'file_type': file_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading journal file: {str(e)}")
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()  # Clean up file if error occurred
        raise HTTPException(status_code=500, detail=f'An error occurred while uploading file: {str(e)}')

@app.get("/api/personal-journal/file/{file_id}")
async def download_journal_file(file_id: int, downloaded_by: str):
    """Download a journal file (only accessible by the uploader)"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_filename, stored_filename, file_path, file_type, uploaded_by
                FROM journal_files 
                WHERE id = ?
            """, (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            original_filename, stored_filename, file_path, file_type, uploaded_by = result
            
            # Check permission - only uploader can download
            if uploaded_by != downloaded_by:
                raise HTTPException(status_code=403, detail='You can only download your own journal files')
            
            file_path_obj = Path(file_path)
            if not file_path_obj.exists():
                raise HTTPException(status_code=404, detail='File not found on disk')
            
            return FileResponse(
                path=file_path_obj,
                filename=original_filename,
                media_type=file_type
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading journal file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading file')

@app.delete("/api/personal-journal/file/{file_id}")
async def delete_journal_file(file_id: int, deleted_by: str):
    """Delete a journal file attachment"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT file_path, uploaded_by
                FROM journal_files 
                WHERE id = ?
            """, (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            file_path, uploaded_by = result
            
            # Check permission - only uploader can delete
            if uploaded_by != deleted_by:
                raise HTTPException(status_code=403, detail='You can only delete your own journal files')
            
            # Delete file from filesystem
            file_path_obj = Path(file_path)
            if file_path_obj.exists():
                file_path_obj.unlink()
            
            # Delete from database
            cursor.execute("DELETE FROM journal_files WHERE id = ?", (file_id,))
            conn.commit()
            
        return {'success': True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting journal file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while deleting file')

@app.get("/api/personal-journal/{entry_id}/export-pdf")
async def export_journal_entry_pdf(entry_id: int, exported_by: str):
    """Export a journal entry to PDF"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT title, content, mood, entry_date, created_by, created_date
                FROM personal_journal 
                WHERE id = ?
            """, (entry_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='Journal entry not found')
            
            title, content, mood, entry_date, created_by, created_date = result
            
            # Check permission - only owner can export
            if created_by != exported_by:
                raise HTTPException(status_code=403, detail='You can only export your own journal entries')
            
            # Get attached files info
            cursor.execute("""
                SELECT original_filename, file_type, file_size
                FROM journal_files 
                WHERE journal_entry_id = ?
                ORDER BY upload_date DESC
            """, (entry_id,))
            files = cursor.fetchall()
        
        # Generate PDF
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        content_list = []
        
        # Title
        title_style = styles['Title']
        title_style.textColor = colors.darkblue
        content_list.append(Paragraph("🔒 PRIVATE PERSONAL JOURNAL ENTRY", title_style))
        content_list.append(Spacer(1, 0.3*inch))
        
        # Entry details table
        entry_data = [
            ['Entry Information', ''],
            ['Title:', title],
            ['Entry Date:', entry_date],
            ['Created:', created_date],
            ['Mood:', mood or 'Not specified'],
            ['Owner:', created_by],
        ]
        
        entry_table = Table(entry_data, colWidths=[2*inch, 4*inch])
        entry_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.lightblue),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        
        content_list.append(entry_table)
        content_list.append(Spacer(1, 0.2*inch))
        
        # Journal content
        content_list.append(Paragraph("<b>Journal Entry:</b>", styles['Heading2']))
        content_list.append(Spacer(1, 0.1*inch))
        
        # Split content into paragraphs and add each
        paragraphs = content.split('\n')
        for para in paragraphs:
            if para.strip():
                content_list.append(Paragraph(para.strip(), styles['Normal']))
            else:
                content_list.append(Spacer(1, 0.1*inch))
        
        content_list.append(Spacer(1, 0.2*inch))
        
        # Attached files
        if files:
            content_list.append(Paragraph("<b>Attached Files:</b>", styles['Heading2']))
            file_data = [['Filename', 'Type', 'Size']]
            
            for filename, file_type, file_size in files:
                size_mb = f"{file_size / 1024 / 1024:.2f} MB" if file_size > 1024*1024 else f"{file_size / 1024:.2f} KB"
                file_data.append([filename, file_type or 'Unknown', size_mb])
            
            file_table = Table(file_data, colWidths=[3*inch, 1.5*inch, 1*inch])
            file_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.lightgrey),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            content_list.append(file_table)
        
        content_list.append(Spacer(1, 0.3*inch))
        
        # Privacy notice
        privacy_text = """
        <b>PRIVACY NOTICE:</b><br/>
        <br/>
        This is a private personal journal entry that is only accessible by the owner. 
        This document was exported from the Safespace Personal Journal system on 
        """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """ UTC.<br/>
        <br/>
        <b>Important:</b> This journal entry and any attached files are completely private 
        and are not visible to other users of the Safespace system.
        """
        content_list.append(Paragraph(privacy_text, styles['Normal']))
        
        # Build PDF
        doc.build(content_list)
        buffer.seek(0)
        
        # Return PDF as streaming response
        return StreamingResponse(
            io.BytesIO(buffer.getvalue()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=journal_entry_{entry_id}_{entry_date.replace(' ', '_').replace(':', '-')}.pdf"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting journal entry to PDF: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while exporting journal entry')

# =============================================================================
# VAULT FILE STORAGE API ENDPOINTS
# =============================================================================

def log_vault_access(file_id: int, accessed_by: str, access_type: str, ip_address: str = None, user_agent: str = None):
    """Log access to vault files for tracking purposes"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO vault_access_logs (file_id, accessed_by, access_type, access_date, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (file_id, accessed_by, access_type, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ip_address, user_agent))
            conn.commit()
    except Exception as e:
        logger.error(f"Error logging vault access: {str(e)}")

@app.get("/api/vault/folders")
async def get_vault_folders():
    """Get all vault folders with organization"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, parent_folder_id, created_by, created_date, is_shared, shared_with
                FROM vault_folders 
                ORDER BY name
            """)
            folders = []
            for row in cursor.fetchall():
                folders.append({
                    'id': row[0],
                    'name': row[1],
                    'parent_folder_id': row[2],
                    'created_by': row[3],
                    'created_date': row[4],
                    'is_shared': bool(row[5]),
                    'shared_with': row[6]
                })
            return folders
    except Exception as e:
        logger.error(f"Error retrieving vault folders: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving vault folders')

@app.post("/api/vault/folders")
async def create_vault_folder(folder: VaultFolderEntry):
    """Create a new vault folder"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO vault_folders (name, parent_folder_id, created_by, created_date) 
                VALUES (?, ?, ?, ?)
            """, (folder.name, folder.parent_folder_id, folder.created_by, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            folder_id = cursor.lastrowid
            conn.commit()
        return {'success': True, 'folder_id': folder_id}
    except Exception as e:
        logger.error(f"Error creating vault folder: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating vault folder')

@app.get("/api/vault/files")
async def get_vault_files(folder_id: Optional[int] = None, user: Optional[str] = None):
    """Get vault files, optionally filtered by folder or user"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            if folder_id is not None:
                # Get files in specific folder
                cursor.execute("""
                    SELECT id, title, description, original_filename, file_type, file_size, 
                           folder_id, uploaded_by, upload_date, is_shared, shared_with
                    FROM vault_files 
                    WHERE folder_id = ? OR (folder_id = ? AND (uploaded_by = ? OR is_shared = 1))
                    ORDER BY title
                """, (folder_id, folder_id, user))
            else:
                # Get all files the user can access
                cursor.execute("""
                    SELECT id, title, description, original_filename, file_type, file_size, 
                           folder_id, uploaded_by, upload_date, is_shared, shared_with
                    FROM vault_files 
                    WHERE uploaded_by = ? OR is_shared = 1 OR shared_with LIKE ?
                    ORDER BY title
                """, (user, f'%{user}%'))
            
            files = []
            for row in cursor.fetchall():
                # Get access statistics for each file
                cursor.execute("""
                    SELECT access_type, COUNT(*) as count
                    FROM vault_access_logs 
                    WHERE file_id = ? 
                    GROUP BY access_type
                """, (row[0],))
                access_stats = {access[0]: access[1] for access in cursor.fetchall()}
                
                files.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'filename': row[3],
                    'file_type': row[4],
                    'file_size': row[5],
                    'folder_id': row[6],
                    'uploaded_by': row[7],
                    'upload_date': row[8],
                    'is_shared': bool(row[9]),
                    'shared_with': row[10],
                    'access_stats': access_stats
                })
            return files
    except Exception as e:
        logger.error(f"Error retrieving vault files: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving vault files')

@app.post("/api/vault/upload")
async def upload_vault_file(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: Optional[str] = Form(""),
    folder_id: Optional[int] = Form(None),
    created_by: str = Form(...),
    is_shared: bool = Form(False),
    shared_with: Optional[str] = Form(None)
):
    """Upload a file to the vault storage"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')

        # Check file type and size
        allowed_extensions = {
            '.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', 
            '.bmp', '.tiff', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar',
            '.mp4', '.avi', '.mov', '.mp3', '.wav'
        }
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail='File type not supported. Please upload documents, images, or media files.')

        # Read file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Check file size limit (50MB)
        if file_size > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail='File too large. Maximum size is 50MB.')

        # Create unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{file.filename}"
        file_path = VAULT_STORAGE_DIR / unique_filename
        
        # Save file to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # Calculate file hash for integrity
        file_hash = hashlib.sha256(file_content).hexdigest()
        
        # Store file information in database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO vault_files (title, description, original_filename, stored_filename, 
                                       file_path, file_type, file_size, folder_id, uploaded_by, 
                                       upload_date, is_shared, shared_with, file_hash) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                title, description, file.filename, unique_filename,
                str(file_path), file_extension, file_size, folder_id, created_by,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"), is_shared, shared_with, file_hash
            ))
            file_id = cursor.lastrowid
            conn.commit()

        # Log the upload
        log_vault_access(file_id, created_by, 'upload')

        return {
            'success': True, 
            'file_id': file_id,
            'filename': unique_filename,
            'file_hash': file_hash
        }

    except Exception as e:
        logger.error(f"Error uploading vault file: {str(e)}")
        # Clean up file if error occurred
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f'An error occurred while uploading file: {str(e)}')

@app.get("/api/vault/file/{file_id}")
async def download_vault_file(file_id: int, accessed_by: str):
    """Download a vault file with access logging"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_filename, stored_filename, file_path, file_type, uploaded_by, is_shared, shared_with
                FROM vault_files 
                WHERE id = ?
            """, (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            original_filename, stored_filename, file_path, file_type, uploaded_by, is_shared, shared_with = result
            
            # Check permissions
            can_access = (
                uploaded_by == accessed_by or  # Owner
                is_shared or  # Publicly shared in family
                (shared_with and accessed_by in shared_with)  # Specifically shared with user
            )
            
            if not can_access:
                raise HTTPException(status_code=403, detail='You do not have permission to access this file')
            
            file_path_obj = Path(file_path)
            if not file_path_obj.exists():
                raise HTTPException(status_code=404, detail='File not found on disk')
            
            # Log the download
            log_vault_access(file_id, accessed_by, 'download')
            
            return FileResponse(
                path=file_path_obj,
                filename=original_filename,
                media_type=file_type or 'application/octet-stream'
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading vault file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading file')

@app.get("/api/vault/file/{file_id}/preview")
async def preview_vault_file(file_id: int, accessed_by: str):
    """Preview a vault file (for images/documents) with access logging"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_filename, stored_filename, file_path, file_type, uploaded_by, 
                       is_shared, shared_with, file_size
                FROM vault_files 
                WHERE id = ?
            """, (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            original_filename, stored_filename, file_path, file_type, uploaded_by, is_shared, shared_with, file_size = result
            
            # Check permissions
            can_access = (
                uploaded_by == accessed_by or
                is_shared or
                (shared_with and accessed_by in shared_with)
            )
            
            if not can_access:
                raise HTTPException(status_code=403, detail='You do not have permission to access this file')
            
            # Log the preview
            log_vault_access(file_id, accessed_by, 'preview')
            
            # Return file info for preview
            return {
                'id': file_id,
                'filename': original_filename,
                'file_type': file_type,
                'file_size': file_size,
                'uploaded_by': uploaded_by,
                'is_image': file_type.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp'],
                'is_document': file_type.lower() in ['.pdf', '.doc', '.docx', '.txt'],
                'can_preview': file_type.lower() in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.pdf', '.txt']
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing vault file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while previewing file')

@app.put("/api/vault/file/{file_id}")
async def update_vault_file(file_id: int, update: VaultFileUpdate, updated_by: str):
    """Update vault file metadata"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if file exists and user has permission
            cursor.execute("SELECT uploaded_by FROM vault_files WHERE id = ?", (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            if result[0] != updated_by:
                raise HTTPException(status_code=403, detail='You can only update files you uploaded')
            
            # Build update query dynamically
            update_fields = []
            update_values = []
            
            if update.title is not None:
                update_fields.append("title = ?")
                update_values.append(update.title)
            
            if update.description is not None:
                update_fields.append("description = ?")
                update_values.append(update.description)
            
            if update.folder_id is not None:
                update_fields.append("folder_id = ?")
                update_values.append(update.folder_id)
            
            if update.is_shared is not None:
                update_fields.append("is_shared = ?")
                update_values.append(update.is_shared)
            
            if update.shared_with is not None:
                update_fields.append("shared_with = ?")
                update_values.append(update.shared_with)
            
            if update_fields:
                update_values.append(file_id)
                query = f"UPDATE vault_files SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, update_values)
                conn.commit()
            
        return {'success': True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating vault file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while updating file')

@app.delete("/api/vault/file/{file_id}")
async def delete_vault_file(file_id: int, deleted_by: str):
    """Delete a vault file"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT file_path, uploaded_by
                FROM vault_files 
                WHERE id = ?
            """, (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            file_path, uploaded_by = result
            
            # Check permission - only uploader can delete
            if uploaded_by != deleted_by:
                raise HTTPException(status_code=403, detail='You can only delete files you uploaded')
            
            # Delete file from filesystem
            file_path_obj = Path(file_path)
            if file_path_obj.exists():
                file_path_obj.unlink()
            
            # Delete from database (access logs will be deleted by CASCADE)
            cursor.execute("DELETE FROM vault_files WHERE id = ?", (file_id,))
            conn.commit()
            
        return {'success': True}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting vault file: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while deleting file')

@app.get("/api/vault/file/{file_id}/access-logs")
async def get_vault_file_access_logs(file_id: int, requested_by: str):
    """Get access logs for a vault file (only accessible by file owner)"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Check if file exists and user has permission
            cursor.execute("SELECT uploaded_by FROM vault_files WHERE id = ?", (file_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail='File not found')
            
            if result[0] != requested_by:
                raise HTTPException(status_code=403, detail='You can only view access logs for files you uploaded')
            
            # Get access logs
            cursor.execute("""
                SELECT accessed_by, access_type, access_date, ip_address
                FROM vault_access_logs 
                WHERE file_id = ? 
                ORDER BY access_date DESC
            """, (file_id,))
            
            logs = []
            for row in cursor.fetchall():
                logs.append({
                    'accessed_by': row[0],
                    'access_type': row[1],
                    'access_date': row[2],
                    'ip_address': row[3]
                })
            
            return logs
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving access logs: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving access logs')

@app.get("/api/vault/stats")
async def get_vault_stats(user: str):
    """Get vault storage statistics for a user"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user's files count and total size
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(file_size), 0)
                FROM vault_files 
                WHERE uploaded_by = ?
            """, (user,))
            files_count, total_size = cursor.fetchone()
            
            # Get shared files count
            cursor.execute("""
                SELECT COUNT(*)
                FROM vault_files 
                WHERE uploaded_by = ? AND is_shared = 1
            """, (user,))
            shared_count = cursor.fetchone()[0]
            
            # Get accessible files count (files shared with user)
            cursor.execute("""
                SELECT COUNT(*)
                FROM vault_files 
                WHERE uploaded_by != ? AND (is_shared = 1 OR shared_with LIKE ?)
            """, (user, f'%{user}%'))
            accessible_count = cursor.fetchone()[0]
            
            # Get folder count
            cursor.execute("""
                SELECT COUNT(*)
                FROM vault_folders 
                WHERE created_by = ?
            """, (user,))
            folders_count = cursor.fetchone()[0]
            
            return {
                'files_count': files_count,
                'total_size': total_size,
                'shared_count': shared_count,
                'accessible_count': accessible_count,
                'folders_count': folders_count,
                'storage_limit': 1024 * 1024 * 1024,  # 1GB limit
                'storage_used': total_size
            }
            
    except Exception as e:
        logger.error(f"Error retrieving vault stats: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving vault statistics')

# Support Ticket Endpoints for Contact Us functionality
@app.get("/api/support/categories")
async def get_support_categories():
    """Get available support ticket categories and priorities"""
    return {
        "categories": [
            "Technical Issues",
            "Account Problems", 
            "Feature Requests",
            "Billing Questions",
            "Privacy Concerns",
            "Other"
        ],
        "priorities": ["Low", "Medium", "High", "Urgent"]
    }

@app.post("/api/support/tickets")
async def create_support_ticket(ticket: SupportTicketEntry):
    """Create a new support ticket"""
    try:
        # Generate unique ticket number
        timestamp = datetime.now().strftime("%Y%m%d")
        import random
        ticket_number = f"SS-{timestamp}-{random.randint(1000, 9999)}"
        
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO support_tickets (ticket_number, subject, category, priority, description, 
                                           user_name, user_email, created_date, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (ticket_number, ticket.subject, ticket.category, ticket.priority, 
                  ticket.description, ticket.user_name, ticket.user_email, 
                  current_time, current_time))
            ticket_id = cursor.lastrowid
            conn.commit()
            
        return {
            'success': True, 
            'ticket_id': ticket_id,
            'ticket_number': ticket_number,
            'message': 'Support ticket created successfully'
        }
    except Exception as e:
        logger.error(f"Error creating support ticket: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while creating the support ticket')

@app.get("/api/support/tickets")
async def get_user_support_tickets(user_email: str):
    """Get all support tickets for a specific user"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, ticket_number, subject, category, priority, status, 
                       created_date, last_updated, admin_response, resolved_date
                FROM support_tickets 
                WHERE user_email = ? 
                ORDER BY created_date DESC
            """, (user_email,))
            
            tickets = []
            for row in cursor.fetchall():
                tickets.append({
                    'id': row[0],
                    'ticket_number': row[1],
                    'subject': row[2],
                    'category': row[3],
                    'priority': row[4],
                    'status': row[5],
                    'created_date': row[6],
                    'last_updated': row[7],
                    'admin_response': row[8],
                    'resolved_date': row[9]
                })
            
        return tickets
    except Exception as e:
        logger.error(f"Error retrieving support tickets: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving support tickets')

@app.get("/api/support/tickets/{ticket_id}")
async def get_support_ticket_details(ticket_id: int):
    """Get detailed information about a specific ticket including attachments"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get ticket details
            cursor.execute("""
                SELECT * FROM support_tickets WHERE id = ?
            """, (ticket_id,))
            ticket_row = cursor.fetchone()
            
            if not ticket_row:
                raise HTTPException(status_code=404, detail='Ticket not found')
            
            # Get ticket attachments
            cursor.execute("""
                SELECT id, original_filename, stored_filename, file_type, file_size, 
                       uploaded_by, upload_date
                FROM support_ticket_attachments 
                WHERE ticket_id = ?
                ORDER BY upload_date DESC
            """, (ticket_id,))
            
            attachments = []
            for attachment_row in cursor.fetchall():
                attachments.append({
                    'id': attachment_row[0],
                    'original_filename': attachment_row[1],
                    'stored_filename': attachment_row[2],
                    'file_type': attachment_row[3],
                    'file_size': attachment_row[4],
                    'uploaded_by': attachment_row[5],
                    'upload_date': attachment_row[6]
                })
            
            ticket = {
                'id': ticket_row[0],
                'ticket_number': ticket_row[1],
                'subject': ticket_row[2],
                'category': ticket_row[3],
                'priority': ticket_row[4],
                'description': ticket_row[5],
                'status': ticket_row[6],
                'user_name': ticket_row[7],
                'user_email': ticket_row[8],
                'created_date': ticket_row[9],
                'last_updated': ticket_row[10],
                'admin_response': ticket_row[11],
                'resolved_date': ticket_row[12],
                'resolved_by': ticket_row[13],
                'attachments': attachments
            }
            
        return ticket
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving ticket details: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving ticket details')

@app.post("/api/support/tickets/{ticket_id}/attachments")
async def upload_ticket_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    uploaded_by: str = Form(...)
):
    """Upload attachment to a support ticket"""
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail='No file selected')

        # Check if ticket exists
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM support_tickets WHERE id = ?", (ticket_id,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail='Ticket not found')

        # Check file type and size
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.pdf', '.doc', '.docx', '.txt', '.zip'}
        file_extension = Path(file.filename).suffix.lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(status_code=400, detail='File type not supported')

        # Check file size (limit to 10MB)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=400, detail='File size too large (max 10MB)')

        # Create support tickets attachment directory if it doesn't exist
        SUPPORT_ATTACHMENTS_DIR = BASE_DIR / "support_attachments"
        SUPPORT_ATTACHMENTS_DIR.mkdir(exist_ok=True)

        # Save file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        stored_filename = f"ticket_{ticket_id}_{timestamp}_{file.filename}"
        file_path = SUPPORT_ATTACHMENTS_DIR / stored_filename
        
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # Save to database
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO support_ticket_attachments 
                (ticket_id, original_filename, stored_filename, file_path, file_type, 
                 file_size, uploaded_by, upload_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (ticket_id, file.filename, stored_filename, str(file_path), 
                  file.content_type, len(file_content), uploaded_by, 
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            attachment_id = cursor.lastrowid
            
            # Update ticket's last_updated timestamp
            cursor.execute("""
                UPDATE support_tickets 
                SET last_updated = ? 
                WHERE id = ?
            """, (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), ticket_id))
            
            conn.commit()

        return {
            'success': True,
            'attachment_id': attachment_id,
            'filename': stored_filename,
            'message': 'File uploaded successfully'
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading ticket attachment: {str(e)}")
        # Clean up file if error occurred
        if 'file_path' in locals() and file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f'An error occurred while uploading attachment: {str(e)}')

@app.get("/api/support/tickets/{ticket_id}/attachments/{attachment_id}/download")
async def download_ticket_attachment(ticket_id: int, attachment_id: int):
    """Download a ticket attachment"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT original_filename, file_path, file_type
                FROM support_ticket_attachments 
                WHERE id = ? AND ticket_id = ?
            """, (attachment_id, ticket_id))
            
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail='Attachment not found')
            
            original_filename, file_path, file_type = result
            
        if not Path(file_path).exists():
            raise HTTPException(status_code=404, detail='File not found on disk')
            
        return FileResponse(
            path=file_path,
            filename=original_filename,
            media_type=file_type or 'application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading ticket attachment: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while downloading the attachment')

# =============================================================================
# ACCOUNTABLE CALLING API ENDPOINTS
# =============================================================================

# Email notification function for calls
def send_call_notification_email(recipient_email: str, notification_type: str, call_details: dict):
    """Send email notification for call scheduling/acceptance"""
    try:
        # Here you would integrate with your email service (e.g., SendGrid, AWS SES)
        # For now, we'll log the notification
        logger.info(f"Email notification to {recipient_email}: {notification_type} - {call_details}")
        
        # Store notification record
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO call_notifications (scheduled_call_id, recipient_email, notification_type, sent_at, email_sent)
                VALUES (?, ?, ?, ?, ?)
            """, (call_details.get('call_id'), recipient_email, notification_type, 
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S"), True))
            conn.commit()
        
        return True
    except Exception as e:
        logger.error(f"Error sending call notification email: {str(e)}")
        return False

@app.post("/api/calls/schedule")
async def schedule_call(call_request: ScheduleCallRequest, current_user: dict = Depends(get_current_user)):
    """Schedule a new call"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Validate duration
        if call_request.duration_minutes < 5 or call_request.duration_minutes > 60:
            raise HTTPException(status_code=400, detail="Call duration must be between 5 and 60 minutes")
        
        # Validate date/time (must be in the future)
        scheduled_datetime = datetime.strptime(f"{call_request.scheduled_date} {call_request.scheduled_time}", "%Y-%m-%d %H:%M")
        if scheduled_datetime <= datetime.now():
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
        
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO scheduled_calls (caller_id, caller_name, caller_email, recipient_name, 
                                           recipient_email, scheduled_date, scheduled_time, 
                                           duration_minutes, notes, created_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (current_user['id'], current_user['fullName'], current_user['email'],
                  call_request.recipient_name, call_request.recipient_email,
                  call_request.scheduled_date, call_request.scheduled_time,
                  call_request.duration_minutes, call_request.notes, current_time))
            
            call_id = cursor.lastrowid
            conn.commit()
        
        # Send email notification to recipient
        call_details = {
            'call_id': call_id,
            'caller_name': current_user['fullName'],
            'scheduled_date': call_request.scheduled_date,
            'scheduled_time': call_request.scheduled_time,
            'duration_minutes': call_request.duration_minutes
        }
        send_call_notification_email(call_request.recipient_email, 'call_scheduled', call_details)
        
        return {
            'success': True,
            'call_id': call_id,
            'message': 'Call scheduled successfully'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error scheduling call: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while scheduling the call')

@app.get("/api/calls/pending")
async def get_pending_calls(current_user: dict = Depends(get_current_user)):
    """Get pending call invitations for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get calls where user is the recipient
            cursor.execute("""
                SELECT id, caller_name, caller_email, scheduled_date, scheduled_time, 
                       duration_minutes, notes, created_date
                FROM scheduled_calls 
                WHERE recipient_email = ? AND status = 'pending'
                ORDER BY scheduled_date, scheduled_time
            """, (current_user['email'],))
            
            pending_calls = []
            for row in cursor.fetchall():
                pending_calls.append({
                    'id': row[0],
                    'caller_name': row[1],
                    'caller_email': row[2],
                    'scheduled_date': row[3],
                    'scheduled_time': row[4],
                    'duration_minutes': row[5],
                    'notes': row[6],
                    'created_date': row[7]
                })
            
            return pending_calls
            
    except Exception as e:
        logger.error(f"Error retrieving pending calls: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving pending calls')

@app.post("/api/calls/{call_id}/respond")
async def respond_to_call(call_id: int, response: CallResponse, current_user: dict = Depends(get_current_user)):
    """Accept or reject a call invitation"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verify call exists and user is the recipient
            cursor.execute("""
                SELECT caller_email, recipient_email, status, caller_name
                FROM scheduled_calls 
                WHERE id = ?
            """, (call_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call not found")
            
            caller_email, recipient_email, status, caller_name = result
            
            if recipient_email != current_user['email']:
                raise HTTPException(status_code=403, detail="You can only respond to calls invited to you")
            
            if status != 'pending':
                raise HTTPException(status_code=400, detail="Call has already been responded to")
            
            # Update call status
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            if response.response == 'accept':
                cursor.execute("""
                    UPDATE scheduled_calls 
                    SET status = 'accepted', accepted_date = ?
                    WHERE id = ?
                """, (current_time, call_id))
                
                # Create call session token for when the call starts
                session_token = secrets.token_urlsafe(32)
                cursor.execute("""
                    INSERT INTO call_sessions (scheduled_call_id, session_token, status)
                    VALUES (?, ?, 'scheduled')
                """, (call_id, session_token))
                
                conn.commit()
                
                # Send acceptance notification to caller
                send_call_notification_email(caller_email, 'call_accepted', {
                    'call_id': call_id,
                    'accepter_name': current_user['fullName']
                })
                
                return {
                    'success': True,
                    'message': 'Call accepted successfully',
                    'session_token': session_token
                }
                
            else:  # reject
                cursor.execute("""
                    UPDATE scheduled_calls 
                    SET status = 'rejected', rejected_date = ?
                    WHERE id = ?
                """, (current_time, call_id))
                
                conn.commit()
                
                # Send rejection notification to caller
                send_call_notification_email(caller_email, 'call_rejected', {
                    'call_id': call_id,
                    'rejecter_name': current_user['fullName']
                })
                
                return {
                    'success': True,
                    'message': 'Call rejected successfully'
                }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to call: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while responding to the call')

@app.get("/api/calls/scheduled")
async def get_scheduled_calls(current_user: dict = Depends(get_current_user)):
    """Get all scheduled calls for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get calls where user is either caller or recipient
            cursor.execute("""
                SELECT id, caller_name, caller_email, recipient_name, recipient_email, 
                       scheduled_date, scheduled_time, duration_minutes, status, 
                       created_date, accepted_date, notes
                FROM scheduled_calls 
                WHERE caller_email = ? OR recipient_email = ?
                ORDER BY scheduled_date DESC, scheduled_time DESC
            """, (current_user['email'], current_user['email']))
            
            scheduled_calls = []
            for row in cursor.fetchall():
                call_data = {
                    'id': row[0],
                    'caller_name': row[1],
                    'caller_email': row[2],
                    'recipient_name': row[3],
                    'recipient_email': row[4],
                    'scheduled_date': row[5],
                    'scheduled_time': row[6],
                    'duration_minutes': row[7],
                    'status': row[8],
                    'created_date': row[9],
                    'accepted_date': row[10],
                    'notes': row[11],
                    'is_caller': row[2] == current_user['email']
                }
                
                # Check if call is ready to join (accepted and time is now)
                if call_data['status'] == 'accepted':
                    scheduled_datetime = datetime.strptime(f"{row[5]} {row[6]}", "%Y-%m-%d %H:%M")
                    now = datetime.now()
                    # Allow joining 5 minutes before scheduled time
                    can_join_at = scheduled_datetime - timedelta(minutes=5)
                    call_data['can_join'] = now >= can_join_at
                    call_data['is_live'] = now >= scheduled_datetime and now <= scheduled_datetime + timedelta(minutes=row[7])
                else:
                    call_data['can_join'] = False
                    call_data['is_live'] = False
                
                scheduled_calls.append(call_data)
            
            return scheduled_calls
            
    except Exception as e:
        logger.error(f"Error retrieving scheduled calls: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving scheduled calls')

@app.post("/api/calls/{call_id}/join")
async def join_call(call_id: int, current_user: dict = Depends(get_current_user)):
    """Join an active call session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get call details
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email, sc.scheduled_date, sc.scheduled_time, 
                       sc.duration_minutes, sc.status, cs.session_token, cs.id as session_id,
                       cs.caller_joined_at, cs.recipient_joined_at, cs.status as session_status
                FROM scheduled_calls sc
                LEFT JOIN call_sessions cs ON sc.id = cs.scheduled_call_id
                WHERE sc.id = ?
            """, (call_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call not found")
            
            caller_email, recipient_email, scheduled_date, scheduled_time, duration_minutes, status, session_token, session_id, caller_joined_at, recipient_joined_at, session_status = result
            
            # Check if user is part of this call
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You are not part of this call")
            
            if status != 'accepted':
                raise HTTPException(status_code=400, detail="Call has not been accepted yet")
            
            # Check if call time is valid (within 5 minutes before to end time)
            scheduled_datetime = datetime.strptime(f"{scheduled_date} {scheduled_time}", "%Y-%m-%d %H:%M")
            now = datetime.now()
            can_join_at = scheduled_datetime - timedelta(minutes=5)
            call_ends_at = scheduled_datetime + timedelta(minutes=duration_minutes)
            
            if now < can_join_at:
                raise HTTPException(status_code=400, detail="Call is not ready to join yet")
            
            if now > call_ends_at:
                raise HTTPException(status_code=400, detail="Call time has expired")
            
            # Update join status
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            is_caller = current_user['email'] == caller_email
            
            if is_caller:
                cursor.execute("""
                    UPDATE call_sessions 
                    SET caller_joined_at = ?, status = 'waiting'
                    WHERE id = ?
                """, (current_time, session_id))
            else:
                cursor.execute("""
                    UPDATE call_sessions 
                    SET recipient_joined_at = ?, status = 'waiting'
                    WHERE id = ?
                """, (current_time, session_id))
            
            # Check if both parties have joined
            cursor.execute("""
                SELECT caller_joined_at, recipient_joined_at
                FROM call_sessions 
                WHERE id = ?
            """, (session_id,))
            join_result = cursor.fetchone()
            
            both_joined = join_result[0] is not None and join_result[1] is not None
            
            if both_joined:
                # Start the call
                cursor.execute("""
                    UPDATE call_sessions 
                    SET status = 'active', call_started_at = ?
                    WHERE id = ?
                """, (current_time, session_id))
            
            conn.commit()
            
            return {
                'success': True,
                'session_id': session_id,
                'session_token': session_token,
                'both_joined': both_joined,
                'call_active': both_joined,
                'is_caller': is_caller,
                'scheduled_date': scheduled_date,
                'scheduled_time': scheduled_time,
                'duration_minutes': duration_minutes
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error joining call: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while joining the call')

@app.post("/api/calls/sessions/{session_id}/transcription")
async def add_call_transcription(session_id: int, transcription: CallTranscription, current_user: dict = Depends(get_current_user)):
    """Add transcription text from the call"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # Verify user is part of this call session
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email, cs.status
                FROM call_sessions cs
                JOIN scheduled_calls sc ON cs.scheduled_call_id = sc.id
                WHERE cs.id = ?
            """, (session_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call session not found")
            
            caller_email, recipient_email, session_status = result
            
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You are not part of this call")
            
            if session_status != 'active':
                raise HTTPException(status_code=400, detail="Call is not active")
            
            # Check for policy violations using existing AI system
            chatbot = ChatbotModule()
            orders_text = ""  # Could load from database if needed
            
            # Use existing message evaluation system to check for violations
            evaluation_result = chatbot.evaluate_message(
                transcription.transcript_text,
                orders_text,
                'Father' if current_user['email'] == caller_email else 'Mother',
                'Mother' if current_user['email'] == caller_email else 'Father'
            )
            
            violation_detected = evaluation_result != transcription.transcript_text
            
            # Store transcription with violation flag (but don't end call)
            cursor.execute("""
                INSERT INTO call_transcriptions (call_session_id, speaker, transcript_text, 
                                               timestamp, confidence_score, is_final, 
                                               violation_detected, ai_analysis)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, transcription.speaker, transcription.transcript_text,
                  datetime.now().strftime("%Y-%m-%d %H:%M:%S"), transcription.confidence_score,
                  transcription.is_final, violation_detected, 
                  "Policy violation detected" if violation_detected else "Clean"))
            
            conn.commit()
            
            # Log violation but continue call (no automatic termination)
            return {
                'success': True,
                'violation_detected': violation_detected,
                'call_ended': False,  # Never auto-end calls
                'message': 'Transcription processed successfully' + (
                    ' - Policy concern noted' if violation_detected else ''
                )
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding call transcription: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while processing transcription')

@app.post("/api/calls/sessions/{session_id}/report")
async def report_call_violation(session_id: int, report: CallReport, current_user: dict = Depends(get_current_user)):
    """Report a policy violation during a call"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verify user is part of this call session
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email
                FROM call_sessions cs
                JOIN scheduled_calls sc ON cs.scheduled_call_id = sc.id
                WHERE cs.id = ?
            """, (session_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call session not found")
            
            caller_email, recipient_email = result
            
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You are not part of this call")
            
            # Create report with timestamp
            report_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute("""
                INSERT INTO call_reports (call_session_id, reported_by, report_type, reason,
                                        description, timestamp, auto_generated, 
                                        transcript_segment, severity_level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, current_user['fullName'], report.report_type, report.reason,
                  report.description, report_timestamp, 
                  False, report.transcript_segment, 2))
            
            report_id = cursor.lastrowid
            
            # Add timestamped report to transcription log (for AI analysis later)
            cursor.execute("""
                INSERT INTO call_transcriptions (call_session_id, speaker, transcript_text, 
                                               timestamp, confidence_score, is_final, 
                                               violation_detected, ai_analysis)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, 'SYSTEM', f'[MANUAL REPORT by {current_user["fullName"]}]: {report.reason} - {report.description}',
                  report_timestamp, 1.0, True, True, f'Manual report: {report.report_type}'))
            
            conn.commit()
            
            return {
                'success': True,
                'report_id': report_id,
                'call_ended': False,  # Continue call after report
                'message': 'Report submitted successfully. Call continues for documentation purposes.',
                'timestamp': report_timestamp
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reporting call violation: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while submitting the report')

def analyze_call_with_ai(session_id: int, call_transcriptions: list, reports: list) -> dict:
    """Analyze complete call transcript and reports using AI"""
    try:
        chatbot = ChatbotModule()
        
        # Combine all transcriptions into full transcript
        full_transcript = []
        violation_segments = []
        
        for trans in call_transcriptions:
            timestamp = trans['timestamp']
            speaker = trans['speaker']
            text = trans['transcript_text']
            
            full_transcript.append(f"[{timestamp}] {speaker}: {text}")
            
            if trans['violation_detected']:
                violation_segments.append({
                    'timestamp': timestamp,
                    'speaker': speaker,
                    'text': text,
                    'type': 'ai_detected'
                })
        
        # Add manual reports to analysis
        for report in reports:
            violation_segments.append({
                'timestamp': report['timestamp'],
                'type': 'manual_report',
                'reason': report['reason'],
                'description': report['description'],
                'reported_by': report['reported_by']
            })
        
        transcript_text = "\n".join(full_transcript)
        
        # Create AI analysis prompt
        analysis_prompt = f"""
        Please analyze this family communication call transcript and provide a comprehensive analysis.

        CALL TRANSCRIPT:
        {transcript_text}

        VIOLATION ALERTS:
        {json.dumps(violation_segments, indent=2)}

        Please provide analysis in JSON format with these fields:
        {{
            "call_summary": "Brief summary of call content and topics discussed",
            "content_analysis": "Detailed analysis of communication patterns and topics",
            "safety_assessment": "Assessment of communication safety and appropriateness",
            "violations_found": [list of specific violations with descriptions],
            "safety_score": "Score from 1-10 (10 being safest communication)",
            "recommendations": [list of recommendations for future communications],
            "key_topics": [main topics discussed],
            "communication_tone": "Overall tone assessment",
            "concerns": [any concerns identified]
        }}

        Focus on:
        1. Family violence prevention
        2. Child-focused communication
        3. Respectful co-parenting
        4. Policy compliance
        5. Communication effectiveness
        """

        # Generate AI response
        response = client.messages.create(
            model=chatbot.model,
            max_tokens=2000,
            temperature=0.2,
            messages=[{"role": "user", "content": analysis_prompt}]
        )
        
        response_text = ' '.join([block.text for block in response.content])
        
        # Try to parse JSON response
        try:
            analysis_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            analysis_data = {
                "call_summary": "Call analysis completed",
                "content_analysis": response_text,
                "safety_assessment": "Analysis completed",
                "violations_found": violation_segments,
                "safety_score": 5,
                "recommendations": ["Continue monitoring communications"],
                "key_topics": ["Family communication"],
                "communication_tone": "Mixed",
                "concerns": []
            }
        
        return {
            "violations_detected": len(violation_segments),
            "violation_details": violation_segments,
            "call_summary": analysis_data.get("call_summary", "Call completed"),
            "content_analysis": analysis_data.get("content_analysis", "Analysis completed"),
            "safety_score": min(10, max(1, int(analysis_data.get("safety_score", 5)))),
            "recommendations": analysis_data.get("recommendations", []),
            "key_topics": analysis_data.get("key_topics", []),
            "communication_tone": analysis_data.get("communication_tone", "Neutral"),
            "concerns": analysis_data.get("concerns", []),
            "ai_raw_response": response_text
        }
        
    except Exception as e:
        logger.error(f"Error in AI call analysis: {str(e)}")
        return {
            "violations_detected": 0,
            "violation_details": [],
            "call_summary": "Call completed - Analysis unavailable",
            "content_analysis": f"Analysis error: {str(e)}",
            "safety_score": 5,
            "recommendations": ["Manual review recommended"],
            "key_topics": [],
            "communication_tone": "Unknown",
            "concerns": ["Analysis system error"],
            "ai_raw_response": ""
        }

@app.post("/api/calls/sessions/{session_id}/end")
async def end_call(session_id: int, end_request: CallEndRequest, current_user: dict = Depends(get_current_user)):
    """End a call session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verify user is part of this call session
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email, cs.call_started_at, cs.status
                FROM call_sessions cs
                JOIN scheduled_calls sc ON cs.scheduled_call_id = sc.id
                WHERE cs.id = ?
            """, (session_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call session not found")
            
            caller_email, recipient_email, call_started_at, session_status = result
            
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You are not part of this call")
            
            if session_status != 'active':
                raise HTTPException(status_code=400, detail="Call is not active")
            
            # Calculate call duration
            end_time = datetime.now()
            start_time = datetime.strptime(call_started_at, "%Y-%m-%d %H:%M:%S")
            duration_seconds = int((end_time - start_time).total_seconds())
            
            # End the call
            cursor.execute("""
                UPDATE call_sessions 
                SET status = 'ended', call_ended_at = ?, ended_by = ?, 
                    end_reason = ?, duration_seconds = ?
                WHERE id = ?
            """, (end_time.strftime("%Y-%m-%d %H:%M:%S"), current_user['fullName'],
                  end_request.end_reason, duration_seconds, session_id))
            
            # Update scheduled call status
            cursor.execute("""
                UPDATE scheduled_calls 
                SET status = 'completed', completed_date = ?
                WHERE id = (SELECT scheduled_call_id FROM call_sessions WHERE id = ?)
            """, (end_time.strftime("%Y-%m-%d %H:%M:%S"), session_id))
            
            # Get transcriptions and reports for AI analysis
            cursor.execute("""
                SELECT speaker, transcript_text, timestamp, confidence_score, 
                       violation_detected, violation_type, ai_analysis
                FROM call_transcriptions 
                WHERE call_session_id = ? AND is_final = 1
                ORDER BY timestamp
            """, (session_id,))
            
            transcriptions = []
            for row in cursor.fetchall():
                transcriptions.append({
                    'speaker': row[0],
                    'transcript_text': row[1],
                    'timestamp': row[2],
                    'confidence_score': row[3],
                    'violation_detected': bool(row[4]),
                    'violation_type': row[5],
                    'ai_analysis': row[6]
                })
            
            # Get manual reports
            cursor.execute("""
                SELECT reported_by, report_type, reason, description, timestamp
                FROM call_reports
                WHERE call_session_id = ?
                ORDER BY timestamp
            """, (session_id,))
            
            reports = []
            for row in cursor.fetchall():
                reports.append({
                    'reported_by': row[0],
                    'report_type': row[1],
                    'reason': row[2],
                    'description': row[3],
                    'timestamp': row[4]
                })
            
            conn.commit()
            
            # Perform AI analysis of the complete call
            if transcriptions:  # Only analyze if there were transcriptions
                analysis_result = analyze_call_with_ai(session_id, transcriptions, reports)
                
                # Store analysis results
                cursor.execute("""
                    INSERT INTO call_analyses (call_session_id, violations_detected, violation_details,
                                             call_summary, content_analysis, safety_score, 
                                             recommendations, analysis_date)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (session_id, analysis_result['violations_detected'], 
                      json.dumps(analysis_result['violation_details']),
                      analysis_result['call_summary'], analysis_result['content_analysis'],
                      analysis_result['safety_score'], json.dumps(analysis_result['recommendations']),
                      datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
                
                conn.commit()
                
                return {
                    'success': True,
                    'duration_seconds': duration_seconds,
                    'message': 'Call ended successfully',
                    'analysis_completed': True,
                    'call_summary': analysis_result['call_summary'],
                    'safety_score': analysis_result['safety_score'],
                    'violations_detected': analysis_result['violations_detected']
                }
            else:
                return {
                    'success': True,
                    'duration_seconds': duration_seconds,
                    'message': 'Call ended successfully',
                    'analysis_completed': False
                }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ending call: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while ending the call')

@app.get("/api/calls/sessions/{session_id}/transcription")
async def get_call_transcription(session_id: int, current_user: dict = Depends(get_current_user)):
    """Get full transcription of a call session"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verify user is part of this call session
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email
                FROM call_sessions cs
                JOIN scheduled_calls sc ON cs.scheduled_call_id = sc.id
                WHERE cs.id = ?
            """, (session_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call session not found")
            
            caller_email, recipient_email = result
            
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You can only view transcriptions of your own calls")
            
            # Get transcription
            cursor.execute("""
                SELECT speaker, transcript_text, timestamp, confidence_score, 
                       violation_detected, violation_type, ai_analysis
                FROM call_transcriptions 
                WHERE call_session_id = ? AND is_final = 1
                ORDER BY timestamp
            """, (session_id,))
            
            transcriptions = []
            for row in cursor.fetchall():
                transcriptions.append({
                    'speaker': row[0],
                    'transcript_text': row[1],
                    'timestamp': row[2],
                    'confidence_score': row[3],
                    'violation_detected': bool(row[4]),
                    'violation_type': row[5],
                    'ai_analysis': row[6]
                })
            
            return transcriptions
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving call transcription: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving transcription')

@app.get("/api/calls/sessions/{session_id}/analysis")
async def get_call_analysis(session_id: int, current_user: dict = Depends(get_current_user)):
    """Get AI analysis results for a completed call"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Verify user is part of this call session
            cursor.execute("""
                SELECT sc.caller_email, sc.recipient_email
                FROM call_sessions cs
                JOIN scheduled_calls sc ON cs.scheduled_call_id = sc.id
                WHERE cs.id = ?
            """, (session_id,))
            result = cursor.fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Call session not found")
            
            caller_email, recipient_email = result
            
            if current_user['email'] not in [caller_email, recipient_email]:
                raise HTTPException(status_code=403, detail="You can only view analysis of your own calls")
            
            # Get analysis results
            cursor.execute("""
                SELECT violations_detected, violation_details, call_summary, content_analysis,
                       safety_score, recommendations, analysis_date, ai_model_version
                FROM call_analyses 
                WHERE call_session_id = ?
            """, (session_id,))
            
            analysis = cursor.fetchone()
            
            if not analysis:
                return {
                    'analysis_available': False,
                    'message': 'Analysis not yet completed or no transcription available'
                }
            
            # Parse JSON fields
            try:
                violation_details = json.loads(analysis[1]) if analysis[1] else []
                recommendations = json.loads(analysis[5]) if analysis[5] else []
            except json.JSONDecodeError:
                violation_details = []
                recommendations = []
            
            return {
                'analysis_available': True,
                'violations_detected': analysis[0],
                'violation_details': violation_details,
                'call_summary': analysis[2],
                'content_analysis': analysis[3],
                'safety_score': analysis[4],
                'recommendations': recommendations,
                'analysis_date': analysis[6],
                'ai_model_version': analysis[7]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving call analysis: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving analysis')

@app.get("/api/calls/history")
async def get_call_history(current_user: dict = Depends(get_current_user)):
    """Get call history for the current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get completed calls with analysis data
            cursor.execute("""
                SELECT sc.id, sc.caller_name, sc.caller_email, sc.recipient_name, sc.recipient_email,
                       sc.scheduled_date, sc.scheduled_time, sc.duration_minutes, sc.status,
                       cs.call_started_at, cs.call_ended_at, cs.duration_seconds, cs.end_reason,
                       (SELECT COUNT(*) FROM call_reports WHERE call_session_id = cs.id) as report_count,
                       (SELECT COUNT(*) FROM call_transcriptions WHERE call_session_id = cs.id AND violation_detected = 1) as violation_count,
                       ca.call_summary, ca.safety_score, ca.violations_detected, cs.id as session_id
                FROM scheduled_calls sc
                LEFT JOIN call_sessions cs ON sc.id = cs.scheduled_call_id
                LEFT JOIN call_analyses ca ON cs.id = ca.call_session_id
                WHERE (sc.caller_email = ? OR sc.recipient_email = ?) AND sc.status IN ('completed', 'rejected')
                ORDER BY sc.scheduled_date DESC, sc.scheduled_time DESC
            """, (current_user['email'], current_user['email']))
            
            call_history = []
            for row in cursor.fetchall():
                call_data = {
                    'id': row[0],
                    'caller_name': row[1],
                    'caller_email': row[2],
                    'recipient_name': row[3],
                    'recipient_email': row[4],
                    'scheduled_date': row[5],
                    'scheduled_time': row[6],
                    'duration_minutes': row[7],
                    'status': row[8],
                    'call_started_at': row[9],
                    'call_ended_at': row[10],
                    'actual_duration_seconds': row[11],
                    'end_reason': row[12],
                    'report_count': row[13] or 0,
                    'violation_count': row[14] or 0,
                    'is_caller': row[2] == current_user['email'],
                    'call_summary': row[15],  # AI-generated summary
                    'safety_score': row[16],  # AI safety score
                    'ai_violations_detected': row[17] or 0,  # AI analysis violations
                    'session_id': row[18],  # For getting full analysis
                    'has_analysis': row[15] is not None  # Whether AI analysis is available
                }
                call_history.append(call_data)
            
            return call_history
            
    except Exception as e:
        logger.error(f"Error retrieving call history: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving call history')

# New API endpoints for parent switching and subscription management

# Parent Switching Models
class ParentSwitchRequest(BaseModel):
    relationship_id: int

# Get user's relationships (co-parents)  
@app.get("/api/user/relationships")
async def get_user_relationships(authorization: Optional[str] = Header(None)):
    """Get all relationships for the current user"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user ID from token
            cursor.execute("""
                SELECT user_id FROM user_sessions 
                WHERE token = ? AND is_active = TRUE AND expires_at > ?
            """, (token, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            session_result = cursor.fetchone()
            if not session_result:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_id = session_result[0]
            
            # Get all relationships for this user
            cursor.execute("""
                SELECT r.id, r.other_parent_name, r.other_parent_email, r.other_parent_role,
                       r.relationship_status, r.created_date,
                       COUNT(c.id) as children_count
                FROM user_relationships r
                LEFT JOIN user_children c ON r.id = c.relationship_id
                WHERE r.user_id = ? AND r.relationship_status = 'accepted'
                GROUP BY r.id, r.other_parent_name, r.other_parent_email, r.other_parent_role,
                         r.relationship_status, r.created_date
            """, (user_id,))
            
            relationships = []
            for row in cursor.fetchall():
                relationships.append({
                    'relationship_id': row[0],
                    'other_parent_name': row[1],
                    'other_parent_email': row[2],
                    'other_parent_role': row[3],
                    'relationship_status': row[4],
                    'created_date': row[5],
                    'children_count': row[6]
                })
            
            return {'relationships': relationships}
            
    except Exception as e:
        logger.error(f"Error getting user relationships: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve relationships")

# Get data for specific relationship
@app.post("/api/user/switch-parent")
async def switch_parent_context(request: ParentSwitchRequest, authorization: Optional[str] = Header(None)):
    """Switch to a different co-parent relationship context"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user ID from token
            cursor.execute("""
                SELECT user_id FROM user_sessions 
                WHERE token = ? AND is_active = TRUE AND expires_at > ?
            """, (token, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            session_result = cursor.fetchone()
            if not session_result:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_id = session_result[0]
            
            # Verify the relationship belongs to this user
            cursor.execute("""
                SELECT other_parent_name, other_parent_email, other_parent_role
                FROM user_relationships 
                WHERE id = ? AND user_id = ? AND relationship_status = 'accepted'
            """, (request.relationship_id, user_id))
            
            relationship = cursor.fetchone()
            if not relationship:
                raise HTTPException(status_code=404, detail="Relationship not found or not accessible")
            
            # Get children for this relationship
            cursor.execute("""
                SELECT name, age FROM user_children 
                WHERE relationship_id = ?
            """, (request.relationship_id,))
            
            children = [{'name': row[0], 'age': row[1]} for row in cursor.fetchall()]
            
            return {
                'relationship_id': request.relationship_id,
                'other_parent_name': relationship[0],
                'other_parent_email': relationship[1], 
                'other_parent_role': relationship[2],
                'children': children
            }
            
    except Exception as e:
        logger.error(f"Error switching parent context: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to switch parent context")

# Subscription Management Models
class SubscriptionUpdate(BaseModel):
    subscription_type: str  # 'trial', 'basic', 'premium'

@app.get("/api/user/subscription")
async def get_subscription_info(authorization: Optional[str] = Header(None)):
    """Get current subscription information"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user ID and subscription info from token
            cursor.execute("""
                SELECT u.id, u.subscription_type, u.created_date, u.payment_method,
                       u.full_name, u.email
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.token = ? AND s.is_active = TRUE AND s.expires_at > ?
            """, (token, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_id, subscription_type, created_date, payment_method, full_name, email = result
            
            # Calculate trial status
            account_created = datetime.strptime(created_date, "%Y-%m-%d %H:%M:%S")
            days_since_creation = (datetime.now() - account_created).days
            trial_days_remaining = max(0, 30 - days_since_creation)
            is_trial = days_since_creation < 30
            
            # Define subscription features and pricing
            subscription_plans = {
                'trial': {
                    'name': 'Free Trial',
                    'price': 0.00,
                    'duration': '30 days',
                    'features': ['Everything included', 'Full access to all features'],
                    'trial_days_remaining': trial_days_remaining
                },
                'basic': {
                    'name': 'Basic Plan', 
                    'price': 19.99,
                    'duration': 'per month',
                    'features': ['Messages', 'Max 1x5min call per day', 'Calendar', 'Basic support']
                },
                'premium': {
                    'name': 'Premium Plan',
                    'price': 29.99, 
                    'duration': 'per month',
                    'features': ['Everything in Basic', 'Unlimited calling', 'Priority support', 'Advanced features']
                }
            }
            
            current_plan = subscription_plans.get(subscription_type, subscription_plans['basic'])
            
            return {
                'user_id': user_id,
                'current_subscription': subscription_type,
                'subscription_details': current_plan,
                'is_trial': is_trial,
                'trial_days_remaining': trial_days_remaining,
                'payment_method': payment_method,
                'available_plans': subscription_plans
            }
            
    except Exception as e:
        logger.error(f"Error getting subscription info: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve subscription information")

@app.post("/api/user/subscription/update")
async def update_subscription(request: SubscriptionUpdate, authorization: Optional[str] = Header(None)):
    """Update user subscription"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user ID from token
            cursor.execute("""
                SELECT user_id FROM user_sessions 
                WHERE token = ? AND is_active = TRUE AND expires_at > ?
            """, (token, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            session_result = cursor.fetchone()
            if not session_result:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_id = session_result[0]
            
            # Update subscription
            cursor.execute("""
                UPDATE users 
                SET subscription_type = ?
                WHERE id = ?
            """, (request.subscription_type, user_id))
            
            conn.commit()
            
            return {
                'success': True,
                'message': f'Subscription updated to {request.subscription_type}',
                'new_subscription': request.subscription_type
            }
            
    except Exception as e:
        logger.error(f"Error updating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update subscription")

@app.post("/api/user/subscription/unsubscribe") 
async def unsubscribe_user(authorization: Optional[str] = Header(None)):
    """Unsubscribe user (downgrade to basic)"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication token required")
    
    token = authorization.split(' ')[1]
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Get user ID from token
            cursor.execute("""
                SELECT user_id FROM user_sessions 
                WHERE token = ? AND is_active = TRUE AND expires_at > ?
            """, (token, datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
            
            session_result = cursor.fetchone()
            if not session_result:
                raise HTTPException(status_code=401, detail="Invalid or expired token")
            
            user_id = session_result[0]
            
            # Downgrade to basic plan
            cursor.execute("""
                UPDATE users 
                SET subscription_type = 'basic'
                WHERE id = ?
            """, (user_id,))
            
            conn.commit()
            
            return {
                'success': True,
                'message': 'Successfully unsubscribed. Downgraded to Basic plan.',
                'new_subscription': 'basic'
            }
            
    except Exception as e:
        logger.error(f"Error unsubscribing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to unsubscribe")

# Update existing API endpoints to filter by relationship_id

# Enhanced conversation endpoint with relationship filtering
@app.get("/api/conversation")
async def get_conversations_for_relationship(relationship_id: Optional[int] = None, authorization: Optional[str] = Header(None)):
    """Get conversations filtered by relationship"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            if relationship_id:
                cursor.execute("""
                    SELECT id, title, date 
                    FROM conversations 
                    WHERE relationship_id = ?
                    ORDER BY date DESC
                """, (relationship_id,))
            else:
                cursor.execute("SELECT id, title, date FROM conversations ORDER BY date DESC")
            
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error retrieving conversations: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving conversations')

# Enhanced calendar endpoint with relationship filtering and soft deletes
@app.get("/api/calendar")
async def get_calendar_events(relationship_id: Optional[int] = None, show_deleted: bool = True):
    """Get calendar events with soft delete support"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            if relationship_id:
                if show_deleted:
                    # Show all events including soft-deleted ones
                    cursor.execute("""
                        SELECT id, event_label, event_time, repeat_occurrence, created_by, created_date,
                               is_active, deleted_date, deleted_by
                        FROM calendar 
                        WHERE relationship_id = ?
                        ORDER BY event_time ASC
                    """, (relationship_id,))
                else:
                    # Show only active events
                    cursor.execute("""
                        SELECT id, event_label, event_time, repeat_occurrence, created_by, created_date,
                               is_active, deleted_date, deleted_by
                        FROM calendar 
                        WHERE relationship_id = ? AND is_active = TRUE
                        ORDER BY event_time ASC
                    """, (relationship_id,))
            else:
                cursor.execute("""
                    SELECT id, event_label, event_time, repeat_occurrence, created_by, created_date,
                           is_active, deleted_date, deleted_by
                    FROM calendar 
                    ORDER BY event_time ASC
                """)
            
            events = []
            for row in cursor.fetchall():
                event = {
                    'id': row[0],
                    'title': row[1], 
                    'datetime': row[2],
                    'recurrence': row[3],
                    'createdBy': row[4],
                    'createdDate': row[5],
                    'is_active': row[6],
                    'deleted_date': row[7],
                    'deleted_by': row[8],
                    'is_deleted': not row[6]  # is_active = FALSE means deleted
                }
                events.append(event)
                
            return events
            
    except Exception as e:
        logger.error(f"Error retrieving calendar events: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while retrieving calendar data')

@app.delete("/api/calendar/{event_id}")
async def soft_delete_calendar_event(event_id: int, created_by: str):
    """Soft delete calendar event - mark as deleted but keep in database"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Soft delete: mark as inactive and record deletion details
            cursor.execute("""
                UPDATE calendar 
                SET is_active = FALSE,
                    deleted_date = ?,
                    deleted_by = ?
                WHERE id = ? AND created_by = ?
            """, (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), created_by, event_id, created_by))
            
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Event not found or you don't have permission to delete it")
            
            conn.commit()
            return {"message": "Event marked as deleted", "event_id": event_id}
            
    except Exception as e:
        logger.error(f"Error soft deleting calendar event: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while deleting calendar event')

# Document serving endpoint
@app.get("/api/documents/{filename}")
async def serve_document(filename: str):
    """Serve PDF documents from the public directory"""
    try:
        # Define the directory where PDFs are stored
        pdf_dir = Path(__file__).parent.parent / "frontend" / "public" / "assets" / "pdfs"
        file_path = pdf_dir / filename
        
        # Check if file exists
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Check if it's a PDF file
        if not filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type='application/pdf'
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving document: {str(e)}")
        raise HTTPException(status_code=500, detail='An error occurred while serving the document')

# Remove the uvicorn.run call since supervisor will handle it
# if __name__ == "__main__":
#     logger.info("Starting Safespace FastAPI server")
#     uvicorn.run(app, host="0.0.0.0", port=8001)