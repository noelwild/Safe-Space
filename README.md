# Safespace - Family Communication Safety Platform

Safespace is a FastAPI-based family communication platform that uses AI to promote safe and respectful communication between family members. The application evaluates messages for potential family violence indicators and provides constructive alternatives when needed.

## Features

- **Message Safety Check**: Uses Anthropic's Claude AI to evaluate and rewrite messages
- **Family Calendar**: Manage family events and schedules  
- **Financial Management**: Track family financial records
- **Information Log**: Record important information about children
- **Conversations**: Manage family discussions
- **Profile Management**: Maintain family member profiles
- **Document Upload**: Process court orders and important documents

## Technology Stack

- **Backend**: FastAPI with WebSocket support
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Database**: SQLite
- **AI**: Anthropic Claude API
- **File Processing**: PyPDF2, python-docx

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python server.py
```

3. Access the application at http://localhost:8000

## Configuration

The application uses BASE_DIR for all file operations, making it portable across different systems. Key directories:

- `uploaded_files/` - Temporary file storage
- `Client_Databases/` - SQLite database storage
- `static/` - Frontend assets

## API Endpoints

- `GET /` - Main application interface
- `POST /api/evaluate_message` - Message safety evaluation
- `GET/POST /api/calendar` - Calendar management
- `GET/POST /api/financial` - Financial records
- `GET/POST /api/info_log` - Information logging
- `GET/POST /api/conversation` - Conversation management
- `GET/POST /api/profile` - Profile management
- `POST /api/upload_orders` - File upload
- `WS /ws` - WebSocket connection for real-time features

## Security

- Messages are evaluated against comprehensive family violence definitions
- All communications are logged for safety monitoring
- File uploads are processed and cleaned automatically
- WebSocket connections provide real-time message evaluation

## Database Schema

The application automatically creates the following tables:
- `messages` - Message logs and evaluations
- `orders` - Uploaded document content
- `conversations` - Family conversations
- `calendar` - Calendar events
- `financial` - Financial records
- `info_log` - Information logs
- `profiles` - Family member profiles