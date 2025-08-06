import React, { useState, useEffect } from 'react';
import './HelpCenter.css';

function HelpCenter({ currentUser }) {
  const [selectedCategory, setSelectedCategory] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredContent, setFilteredContent] = useState([]);

  // Help content structure
  const helpContent = {
    'getting-started': {
      title: '🚀 Getting Started',
      articles: [
        {
          id: 'welcome',
          title: 'Welcome to Safespace',
          content: `
            <h3>Welcome to Safespace - Your Secure Family Communication Platform</h3>
            <p>Safespace is designed to make communication between separated parents easy, safe, and stress-free. Our platform ensures all interactions are documented, secure, and focused on what matters most - your children's wellbeing.</p>
            
            <h4>Key Features:</h4>
            <ul>
              <li><strong>🛡️ AI-Enhanced Messaging:</strong> All messages are automatically reviewed for safety and tone</li>
              <li><strong>📅 Shared Calendar:</strong> Coordinate schedules and events together</li>
              <li><strong>💳 Accountable Payments:</strong> Track and manage child-related expenses</li>
              <li><strong>📚 Info Library:</strong> Store and share important information</li>
              <li><strong>📋 Unalterable Records:</strong> Secure legal document storage</li>
              <li><strong>📖 Personal Journal:</strong> Private space for your thoughts</li>
              <li><strong>🗄️ Vault Storage:</strong> Secure file sharing and storage</li>
            </ul>
            
            <h4>Core Principles:</h4>
            <p>• <strong>Child-Focused:</strong> Every feature is designed with your children's best interests in mind</p>
            <p>• <strong>Safety First:</strong> AI monitoring ensures all communication remains respectful</p>
            <p>• <strong>Documentation:</strong> All interactions are logged for transparency</p>
            <p>• <strong>Privacy:</strong> Your personal journal and individual settings remain private</p>
          `
        },
        {
          id: 'language-translation',
          title: '🌍 Multi-Language Communication',
          content: `
            <h3>Breaking Down Language Barriers</h3>
            
            <h4>Universal Communication System</h4>
            <p>Safespace supports communication between parents who speak different languages. Our advanced AI translation system ensures perfect understanding regardless of language preferences.</p>
            
            <h4>How It Works</h4>
            <ol>
              <li><strong>Set Your Language:</strong> Go to Account Settings → Profile and choose from 10 supported languages</li>
              <li><strong>Independent Preferences:</strong> Each parent can select their own language independently</li>
              <li><strong>Automatic Translation:</strong> All messages are displayed in your chosen language</li>
              <li><strong>AI Processing:</strong> Safety processing and message enhancement also happens in your language</li>
            </ol>
            
            <h4>Supported Languages</h4>
            <ul>
              <li><strong>English</strong> - English</li>
              <li><strong>Mandarin Chinese</strong> - 中文 (普通话)</li>
              <li><strong>Hindi</strong> - हिन्दी</li>
              <li><strong>Spanish</strong> - Español</li>
              <li><strong>French</strong> - Français</li>
              <li><strong>Arabic</strong> - العربية</li>
              <li><strong>Bengali</strong> - বাংলা</li>
              <li><strong>Portuguese</strong> - Português</li>
              <li><strong>Russian</strong> - Русский</li>
              <li><strong>Japanese</strong> - 日本語</li>
            </ul>
            
            <h4>Real-World Example</h4>
            <div class="example-box">
              <p><strong>Scenario:</strong> Parent A speaks English, Parent B speaks Spanish</p>
              <ul>
                <li>Parent A writes: "Can you pick up Emma at 3 PM today?"</li>
                <li>Parent B sees: "¿Puedes recoger a Emma a las 3 PM hoy?"</li>
                <li>Parent B responds: "Sí, la recogeré después del trabajo"</li>
                <li>Parent A sees: "Yes, I'll pick her up after work"</li>
              </ul>
            </div>
            
            <h4>Quality and Safety</h4>
            <ul>
              <li><strong>Natural Translation:</strong> AI preserves tone, context, and meaning</li>
              <li><strong>Safety Processing:</strong> Message enhancement works in all languages</li>
              <li><strong>Legal Documentation:</strong> Original and translated messages are both preserved</li>
              <li><strong>Cultural Sensitivity:</strong> Translations respect cultural communication styles</li>
            </ul>
            
            <h4>Setting Your Language Preference</h4>
            <ol>
              <li>Navigate to Account Settings using the sidebar</li>
              <li>Scroll down to the "🌍 Language Preference" section</li>
              <li>Click on your preferred language from the grid</li>
              <li>Your preference is saved automatically</li>
              <li>All future messages will be displayed in your chosen language</li>
            </ol>
            
            <div class="tip-box">
              <strong>💡 Pro Tip:</strong> The language system works for all communication - messages, AI responses, and even safety enhancements. This ensures you always understand exactly what's happening in your co-parenting conversations.
            </div>
            
            <div class="success-box">
              <strong>🌟 Result:</strong> Complete elimination of language barriers in family communication, enabling separated parents from different linguistic backgrounds to communicate effectively about their children's needs.
            </div>
          `
        },
        {
          id: 'first-steps',
          title: 'Your First Steps',
          content: `
            <h3>Getting Started with Safespace</h3>
            
            <h4>Step 1: Complete Your Profile</h4>
            <p>Go to Account Settings to update your profile information, including emergency contacts and notification preferences.</p>
            
            <h4>Step 2: Set Up Your First Conversation</h4>
            <p>Navigate to Secure Messaging and create your first conversation topic. We recommend starting with something neutral like "Weekly Schedule" or "School Updates".</p>
            
            <h4>Step 3: Add Important Information</h4>
            <p>Use the Info Library to add important details about your children - school contacts, medical information, activity schedules.</p>
            
            <h4>Step 4: Upload Important Documents</h4>
            <p>Store custody agreements and legal documents in Unalterable Records for secure, tamper-proof storage.</p>
            
            <h4>Step 5: Set Up Your Calendar</h4>
            <p>Add your children's schedules, custody arrangements, and important dates to the Shared Calendar.</p>
            
            <div class="tip-box">
              <strong>💡 Pro Tip:</strong> Start with one feature at a time. Master messaging first, then gradually explore other features as you become comfortable with the platform.
            </div>
          `
        },
        {
          id: 'navigation',
          title: 'Navigating the Platform',
          content: `
            <h3>Understanding the Safespace Interface</h3>
            
            <h4>Sidebar Navigation</h4>
            <p>The left sidebar contains all main features. Click any icon to switch between different sections:</p>
            <ul>
              <li><strong>💬 Secure Messaging:</strong> AI-enhanced communication</li>
              <li><strong>📅 Shared Calendar:</strong> Schedule coordination</li>
              <li><strong>💳 Accountable Payments:</strong> Expense tracking</li>
              <li><strong>📚 Info Library:</strong> Information management</li>
              <li><strong>📋 Unalterable Records:</strong> Legal document storage</li>
              <li><strong>📖 Personal Journal:</strong> Private journaling</li>
              <li><strong>🗄️ Vault Storage:</strong> File sharing</li>
              <li><strong>⚙️ Account Settings:</strong> Profile management</li>
              <li><strong>❓ Help Center:</strong> This section!</li>
              <li><strong>📧 Contact Us:</strong> Technical support</li>
            </ul>
            
            <h4>User Profile Area</h4>
            <p>At the bottom of the sidebar, you'll see your profile information and connection status. The colored dot indicates your connection to our servers.</p>
            
            <h4>Main Content Area</h4>
            <p>The large area to the right shows the content for your selected feature. Each section has its own layout optimized for that specific functionality.</p>
          `
        }
      ]
    },
    'messaging': {
      title: '💬 Secure Messaging',
      articles: [
        {
          id: 'how-messaging-works',
          title: 'How AI-Enhanced Messaging Works',
          content: `
            <h3>Understanding Safespace Messaging</h3>
            
            <h4>AI Message Processing</h4>
            <p>Every message you send is automatically reviewed by our AI system before delivery. This ensures:</p>
            <ul>
              <li>Respectful and constructive communication</li>
              <li>Compliance with family communication best practices</li>
              <li>Removal of potentially harmful language</li>
              <li>Maintenance of focus on child-related matters</li>
            </ul>
            
            <h4>Message Enhancement</h4>
            <p>If your message needs adjustment, our AI will:</p>
            <ul>
              <li>Rewrite it to be more respectful</li>
              <li>Preserve your original intent</li>
              <li>Ensure clarity and professionalism</li>
              <li>Maintain child-focused communication</li>
            </ul>
            
            <h4>Original vs. Enhanced Messages</h4>
            <p>Your original message is stored securely but only the enhanced version is sent and displayed. This protects both parties while ensuring effective communication.</p>
            
            <div class="warning-box">
              <strong>⚠️ Important:</strong> All messages are logged and can be used as documentation if needed for legal purposes.
            </div>
          `
        },
        {
          id: 'creating-conversations',
          title: 'Creating and Managing Conversations',
          content: `
            <h3>Conversation Management</h3>
            
            <h4>Creating New Conversations</h4>
            <ol>
              <li>Click the "New conversation" button in the messaging section</li>
              <li>Enter a clear, descriptive title (e.g., "Emma's Soccer Schedule", "School Meeting Notes")</li>
              <li>Click "Create Conversation" to begin</li>
            </ol>
            
            <h4>Best Practices for Conversation Topics</h4>
            <ul>
              <li><strong>Be Specific:</strong> "Doctor Appointment - March 15" instead of "Medical stuff"</li>
              <li><strong>Stay Child-Focused:</strong> Keep topics related to your children's needs</li>
              <li><strong>Use Descriptive Names:</strong> Make it easy to find conversations later</li>
              <li><strong>Separate Topics:</strong> Don't mix school issues with custody scheduling</li>
            </ul>
            
            <h4>Conversation Features</h4>
            <ul>
              <li><strong>Search:</strong> Use the search bar to find specific conversations</li>
              <li><strong>Filters:</strong> Filter by subjects, messages, or attachments</li>
              <li><strong>File Sharing:</strong> Insert files from your Vault or upload attachments</li>
              <li><strong>Message Status:</strong> See when messages are delivered and read</li>
            </ul>
            
            <div class="tip-box">
              <strong>💡 Pro Tip:</strong> Create separate conversations for different aspects of co-parenting: one for scheduling, one for school matters, one for medical issues, etc.
            </div>
          `
        },
        {
          id: 'message-status',
          title: 'Understanding Message Status',
          content: `
            <h3>Message Delivery and Read Receipts</h3>
            
            <h4>Message States</h4>
            <ul>
              <li><strong>Sent:</strong> Your message has been processed and delivered</li>
              <li><strong>Delivered:</strong> The other parent's device has received the message</li>
              <li><strong>Read:</strong> The other parent has opened and viewed the message</li>
            </ul>
            
            <h4>Read Receipts</h4>
            <p>Read receipts are mandatory in Safespace for transparency and accountability. Both parents will always know when their messages have been read.</p>
            
            <h4>Response Expectations</h4>
            <p>While read receipts show when messages are viewed, there's no requirement for immediate responses. However, timely communication about child-related matters is encouraged.</p>
            
            <h4>Message History</h4>
            <p>All message history is preserved and can be exported if needed for legal documentation. Messages cannot be deleted or edited once sent.</p>
          `
        }
      ]
    },
    'calendar': {
      title: '📅 Shared Calendar',
      articles: [
        {
          id: 'calendar-basics',
          title: 'Using the Shared Calendar',
          content: `
            <h3>Shared Calendar Overview</h3>
            
            <p>The Shared Calendar helps you coordinate schedules, track custody arrangements, and manage your children's activities together.</p>
            
            <h4>Calendar Features</h4>
            <ul>
              <li><strong>Shared Events:</strong> Both parents can see all calendar entries</li>
              <li><strong>Event Categories:</strong> Different types of events with color coding</li>
              <li><strong>Recurring Events:</strong> Set up weekly or monthly recurring schedules</li>
              <li><strong>Notifications:</strong> Get reminders for upcoming events</li>
            </ul>
            
            <h4>Adding Events</h4>
            <ol>
              <li>Navigate to the Shared Calendar section</li>
              <li>Click "Add Event" or click on a specific date</li>
              <li>Enter event details: title, time, location, description</li>
              <li>Set recurrence if it's a regular event</li>
              <li>Save the event</li>
            </ol>
            
            <h4>Event Types to Track</h4>
            <ul>
              <li>Custody exchanges</li>
              <li>School events and holidays</li>
              <li>Medical appointments</li>
              <li>Extracurricular activities</li>
              <li>Family celebrations</li>
              <li>Parent-teacher conferences</li>
            </ul>
          `
        },
        {
          id: 'custody-scheduling',
          title: 'Managing Custody Schedules',
          content: `
            <h3>Custody Schedule Management</h3>
            
            <h4>Setting Up Regular Custody</h4>
            <ol>
              <li>Create a recurring event for your custody schedule</li>
              <li>Use clear titles like "Emma & Liam - Dad's Time" or "Kids with Mom"</li>
              <li>Include pickup/dropoff times and locations</li>
              <li>Set the event to repeat weekly or bi-weekly as needed</li>
            </ol>
            
            <h4>Schedule Changes</h4>
            <p>When custody schedules need to change:</p>
            <ul>
              <li>Discuss changes through messaging first</li>
              <li>Update the calendar once both parents agree</li>
              <li>Add notes about any special arrangements</li>
              <li>Consider adding makeup time if needed</li>
            </ul>
            
            <h4>Holiday and Special Events</h4>
            <p>For holidays and special occasions:</p>
            <ul>
              <li>Plan ahead and discuss holiday schedules early</li>
              <li>Create special events for birthdays, holidays, school breaks</li>
              <li>Note any special pickup/dropoff arrangements</li>
              <li>Include extended family events when appropriate</li>
            </ul>
            
            <div class="tip-box">
              <strong>💡 Pro Tip:</strong> Use different colors or categories for different types of events to make the calendar easier to read at a glance.
            </div>
          `
        }
      ]
    },
    'payments': {
      title: '💳 Accountable Payments',
      articles: [
        {
          id: 'expense-tracking',
          title: 'Tracking Child-Related Expenses',
          content: `
            <h3>Accountable Payments System</h3>
            
            <p>The Accountable Payments feature helps you track, document, and manage all child-related expenses transparently.</p>
            
            <h4>Types of Expenses to Track</h4>
            <ul>
              <li><strong>Medical:</strong> Doctor visits, prescriptions, dental care</li>
              <li><strong>Education:</strong> School fees, supplies, tutoring</li>
              <li><strong>Activities:</strong> Sports, music lessons, clubs</li>
              <li><strong>Clothing:</strong> Seasonal clothing, uniforms, shoes</li>
              <li><strong>Childcare:</strong> Babysitting, after-school care</li>
              <li><strong>Transportation:</strong> Gas for custody exchanges, plane tickets</li>
            </ul>
            
            <h4>Adding Expenses</h4>
            <ol>
              <li>Go to Accountable Payments section</li>
              <li>Click "Add New Payment"</li>
              <li>Select expense category</li>
              <li>Enter amount and description</li>
              <li>Add payment method and merchant info</li>
              <li>Upload receipt photo if available</li>
              <li>Save the entry</li>
            </ol>
            
            <h4>Receipt OCR Technology</h4>
            <p>When you upload receipt photos, our AI system automatically extracts:</p>
            <ul>
              <li>Merchant name and location</li>
              <li>Purchase amount and date</li>
              <li>Individual items purchased</li>
              <li>Payment method used</li>
            </ul>
          `
        },
        {
          id: 'reimbursements',
          title: 'Managing Reimbursements',
          content: `
            <h3>Reimbursement Requests and Tracking</h3>
            
            <h4>Creating Reimbursement Requests</h4>
            <ol>
              <li>Add the expense as usual</li>
              <li>Mark it as "Reimbursement Request"</li>
              <li>Specify the amount and reason</li>
              <li>Include supporting documentation</li>
              <li>Submit to the other parent</li>
            </ol>
            
            <h4>Handling Reimbursement Requests</h4>
            <p>When you receive a reimbursement request:</p>
            <ul>
              <li>Review the expense details and receipts</li>
              <li>Respond with approval or questions</li>
              <li>If approved, make payment and upload proof</li>
              <li>Mark the request as resolved</li>
            </ul>
            
            <h4>Payment Proof</h4>
            <p>For accountability, include proof of payment:</p>
            <ul>
              <li>Bank transfer screenshots</li>
              <li>Check images</li>
              <li>Payment app confirmations</li>
              <li>Cash receipt acknowledgments</li>
            </ul>
            
            <div class="warning-box">
              <strong>⚠️ Important:</strong> All payment records are stored permanently and can be used for tax purposes or legal documentation.
            </div>
          `
        }
      ]
    },
    'info-library': {
      title: '📚 Info Library',
      articles: [
        {
          id: 'organizing-information',
          title: 'Organizing Important Information',
          content: `
            <h3>Info Library Overview</h3>
            
            <p>The Info Library is your centralized location for storing and sharing important information about your children.</p>
            
            <h4>Information Categories</h4>
            <ul>
              <li><strong>Medical:</strong> Doctor contacts, allergies, medications, insurance info</li>
              <li><strong>School:</strong> Teacher contacts, schedules, grade reports</li>
              <li><strong>Activities:</strong> Coach contacts, practice schedules, team info</li>
              <li><strong>Emergency:</strong> Contact numbers, medical conditions, procedures</li>
              <li><strong>Legal:</strong> Court orders, custody agreements (use Unalterable Records for official documents)</li>
            </ul>
            
            <h4>Adding Information</h4>
            <ol>
              <li>Navigate to Info Library</li>
              <li>Click "Add New Entry"</li>
              <li>Choose appropriate category</li>
              <li>Enter title and detailed description</li>
              <li>Upload related files if needed</li>
              <li>Save the entry</li>
            </ol>
            
            <h4>Best Practices</h4>
            <ul>
              <li>Keep information current and updated</li>
              <li>Use descriptive titles for easy searching</li>
              <li>Include contact information when relevant</li>
              <li>Update insurance or medical changes promptly</li>
              <li>Share access with other parent for transparency</li>
            </ul>
          `
        },
        {
          id: 'file-management',
          title: 'Managing Files and Documents',
          content: `
            <h3>File Management in Info Library</h3>
            
            <h4>Supported File Types</h4>
            <ul>
              <li>PDF documents</li>
              <li>Images (JPEG, PNG)</li>
              <li>Microsoft Word documents</li>
              <li>Text files</li>
              <li>Spreadsheets</li>
            </ul>
            
            <h4>Uploading Files</h4>
            <ol>
              <li>Create or edit an info entry</li>
              <li>Click "Upload File" or drag and drop</li>
              <li>Select files from your device</li>
              <li>Add file description</li>
              <li>Save changes</li>
            </ol>
            
            <h4>File Organization Tips</h4>
            <ul>
              <li>Use clear, descriptive filenames</li>
              <li>Group related files in the same entry</li>
              <li>Keep file sizes reasonable (under 10MB when possible)</li>
              <li>Include dates in filenames when relevant</li>
            </ul>
            
            <h4>Downloading and Sharing</h4>
            <p>Files in the Info Library are automatically shared with both parents. You can download files at any time and all downloads are logged for transparency.</p>
          `
        }
      ]
    },
    'records': {
      title: '📋 Unalterable Records',
      articles: [
        {
          id: 'legal-documents',
          title: 'Storing Legal Documents Securely',
          content: `
            <h3>Unalterable Records System</h3>
            
            <p>Unalterable Records provides secure, tamper-proof storage for legal documents. Once uploaded, documents cannot be modified or deleted, ensuring their integrity for legal purposes.</p>
            
            <h4>What to Store in Unalterable Records</h4>
            <ul>
              <li><strong>Custody Agreements:</strong> Final court orders and custody arrangements</li>
              <li><strong>Child Support Orders:</strong> Official support payment orders</li>
              <li><strong>Parenting Plans:</strong> Detailed parenting schedules and rules</li>
              <li><strong>Medical Authorizations:</strong> Permission forms for medical care</li>
              <li><strong>Court Orders:</strong> Any court-issued documentation</li>
              <li><strong>Legal Correspondence:</strong> Important letters from attorneys</li>
            </ul>
            
            <h4>Document Security Features</h4>
            <ul>
              <li><strong>Cryptographic Hashing:</strong> Each document gets a unique digital fingerprint</li>
              <li><strong>Tamper Detection:</strong> Any changes to files are immediately detected</li>
              <li><strong>Access Logging:</strong> Every document access is recorded</li>
              <li><strong>Legal Certification:</strong> Documents come with verification certificates</li>
            </ul>
            
            <h4>Uploading Documents</h4>
            <ol>
              <li>Go to Unalterable Records section</li>
              <li>Click "Upload New Record"</li>
              <li>Select document category</li>
              <li>Choose file from your device</li>
              <li>Enter document title and description</li>
              <li>Confirm upload (this cannot be undone)</li>
            </ol>
          `
        },
        {
          id: 'verification-certificates',
          title: 'Understanding Verification Certificates',
          content: `
            <h3>Document Verification and Legal Use</h3>
            
            <h4>What is a Verification Certificate?</h4>
            <p>When you download a document from Unalterable Records, you receive a verification certificate that proves the document's authenticity and integrity for legal use.</p>
            
            <h4>Certificate Contents</h4>
            <ul>
              <li>Document information (title, upload date, file size)</li>
              <li>Cryptographic hash value</li>
              <li>Verification status</li>
              <li>Access information (who downloaded when)</li>
              <li>Legal certification statement</li>
            </ul>
            
            <h4>Using Documents in Legal Proceedings</h4>
            <p>Documents from Unalterable Records are court-ready:</p>
            <ul>
              <li>Include the verification certificate with the document</li>
              <li>The certificate proves the document hasn't been tampered with</li>
              <li>Hash values can be independently verified</li>
              <li>Access logs show document history</li>
            </ul>
            
            <div class="warning-box">
              <strong>⚠️ Legal Notice:</strong> While our system provides strong security, always consult with your attorney about specific legal requirements in your jurisdiction.
            </div>
          `
        }
      ]
    },
    'vault': {
      title: '🗄️ Vault File Storage',
      articles: [
        {
          id: 'file-sharing',
          title: 'Secure File Sharing',
          content: `
            <h3>Vault File Storage Overview</h3>
            
            <p>The Vault provides secure file storage and sharing between parents. Unlike Unalterable Records, files in the Vault can be organized, updated, and managed flexibly.</p>
            
            <h4>Vault vs. Other Storage</h4>
            <ul>
              <li><strong>Vault:</strong> Flexible file sharing and organization</li>
              <li><strong>Info Library:</strong> Information with attached files</li>
              <li><strong>Unalterable Records:</strong> Legal documents that cannot be changed</li>
            </ul>
            
            <h4>Creating Folders</h4>
            <ol>
              <li>Go to Vault File Storage</li>
              <li>Click "Create New Folder"</li>
              <li>Enter folder name (e.g., "Emma's School Work", "Medical Records")</li>
              <li>Set sharing permissions</li>
              <li>Save folder</li>
            </ol>
            
            <h4>Uploading Files</h4>
            <ol>
              <li>Navigate to desired folder (or root directory)</li>
              <li>Click "Upload Files"</li>
              <li>Select files from your device</li>
              <li>Add file titles and descriptions</li>
              <li>Set sharing preferences</li>
              <li>Upload files</li>
            </ol>
          `
        },
        {
          id: 'sharing-permissions',
          title: 'Managing Sharing and Permissions',
          content: `
            <h3>File Sharing and Access Control</h3>
            
            <h4>Sharing Options</h4>
            <ul>
              <li><strong>Private:</strong> Only you can see the file</li>
              <li><strong>Shared:</strong> Both parents can access the file</li>
              <li><strong>Folder Inheritance:</strong> Files inherit folder sharing settings</li>
            </ul>
            
            <h4>Access Logging</h4>
            <p>All file access is logged, including:</p>
            <ul>
              <li>Who accessed which files</li>
              <li>When files were viewed or downloaded</li>
              <li>IP addresses of access attempts</li>
              <li>File modification history</li>
            </ul>
            
            <h4>File Organization Best Practices</h4>
            <ul>
              <li>Create folders by child or by category</li>
              <li>Use descriptive file names with dates</li>
              <li>Regularly review and organize files</li>
              <li>Share files that both parents need access to</li>
              <li>Keep private files in non-shared folders</li>
            </ul>
            
            <h4>Using Vault Files in Messages</h4>
            <p>You can reference Vault files in your messages:</p>
            <ol>
              <li>While composing a message, click "Insert files from the Vault"</li>
              <li>Browse your Vault files</li>
              <li>Select the file you want to reference</li>
              <li>The file reference is inserted into your message</li>
            </ol>
          `
        }
      ]
    },
    'journal': {
      title: '📖 Personal Journal',
      articles: [
        {
          id: 'private-journaling',
          title: 'Using Your Private Journal',
          content: `
            <h3>Personal Journal Overview</h3>
            
            <p>Your Personal Journal is a completely private space for your thoughts, feelings, and experiences. No one else can access your journal entries - they are for you alone.</p>
            
            <h4>Privacy Guarantee</h4>
            <ul>
              <li>Only you can see your journal entries</li>
              <li>Entries are not shared with the other parent</li>
              <li>Journal content is not monitored by AI</li>
              <li>You have complete control over your private thoughts</li>
            </ul>
            
            <h4>Creating Journal Entries</h4>
            <ol>
              <li>Navigate to Personal Journal</li>
              <li>Click "New Entry"</li>
              <li>Enter a title for your entry</li>
              <li>Write your thoughts in the content area</li>
              <li>Select a mood if desired</li>
              <li>Save your entry</li>
            </ol>
            
            <h4>Journaling Benefits</h4>
            <ul>
              <li>Process emotions and experiences</li>
              <li>Track patterns in co-parenting challenges</li>
              <li>Record important memories with your children</li>
              <li>Document your personal growth</li>
              <li>Maintain mental health and wellbeing</li>
            </ul>
          `
        },
        {
          id: 'journal-tips',
          title: 'Effective Journaling Tips',
          content: `
            <h3>Making the Most of Your Journal</h3>
            
            <h4>Journaling Ideas</h4>
            <ul>
              <li><strong>Daily Reflections:</strong> How did the day go with the kids?</li>
              <li><strong>Gratitude Lists:</strong> What are you thankful for today?</li>
              <li><strong>Challenge Processing:</strong> Working through difficult situations</li>
              <li><strong>Goal Setting:</strong> Personal and parenting goals</li>
              <li><strong>Memory Keeping:</strong> Special moments with your children</li>
              <li><strong>Emotional Check-ins:</strong> How are you feeling and why?</li>
            </ul>
            
            <h4>Writing Tips</h4>
            <ul>
              <li>Write regularly, even if just a few sentences</li>
              <li>Be honest about your feelings</li>
              <li>Don't worry about perfect grammar or spelling</li>
              <li>Include specific details and examples</li>
              <li>Use your journal to work through problems</li>
            </ul>
            
            <h4>Mood Tracking</h4>
            <p>Use the mood feature to track emotional patterns:</p>
            <ul>
              <li>Happy, Content, Neutral, Frustrated, Sad, Anxious</li>
              <li>Look for patterns over time</li>
              <li>Identify triggers and positive influences</li>
              <li>Share patterns with therapists if helpful</li>
            </ul>
            
            <div class="tip-box">
              <strong>💡 Self-Care Tip:</strong> Regular journaling can improve mental health and help you be a better parent. Even 5 minutes a day can make a difference.
            </div>
          `
        }
      ]
    },
    'account': {
      title: '⚙️ Account & Settings',
      articles: [
        {
          id: 'profile-management',
          title: 'Managing Your Profile',
          content: `
            <h3>Account Settings Overview</h3>
            
            <p>Your account settings control your profile information, notification preferences, and privacy settings.</p>
            
            <h4>Profile Information</h4>
            <ul>
              <li><strong>Personal Details:</strong> Name, email, phone number</li>
              <li><strong>Address Information:</strong> Current address and postcode</li>
              <li><strong>Emergency Contacts:</strong> Who to contact in emergencies</li>
              <li><strong>Children Information:</strong> Names and ages of your children</li>
            </ul>
            
            <h4>Updating Your Profile</h4>
            <ol>
              <li>Go to Account Settings</li>
              <li>Select the section you want to update</li>
              <li>Make your changes</li>
              <li>Click "Save Changes"</li>
              <li>Verify changes were saved successfully</li>
            </ol>
            
            <h4>Important Notes</h4>
            <ul>
              <li>Keep your contact information current</li>
              <li>Update children's information as they grow</li>
              <li>Verify your email address for security</li>
              <li>Strong passwords are required for account security</li>
            </ul>
          `
        },
        {
          id: 'notifications',
          title: 'Notification Settings',
          content: `
            <h3>Managing Notifications</h3>
            
            <h4>Notification Types</h4>
            <ul>
              <li><strong>Message Notifications:</strong> New messages and replies</li>
              <li><strong>Calendar Notifications:</strong> Upcoming events and reminders</li>
              <li><strong>Payment Notifications:</strong> New expenses and reimbursement requests</li>
              <li><strong>System Notifications:</strong> Important account updates</li>
            </ul>
            
            <h4>Delivery Methods</h4>
            <ul>
              <li><strong>Email Notifications:</strong> Sent to your registered email</li>
              <li><strong>In-App Notifications:</strong> Displayed when you're using Safespace</li>
              <li><strong>Push Notifications:</strong> Mobile device notifications (if using mobile app)</li>
            </ul>
            
            <h4>Customizing Notifications</h4>
            <ol>
              <li>Go to Account Settings</li>
              <li>Select "Notification Preferences"</li>
              <li>Toggle notification types on/off</li>
              <li>Choose delivery methods for each type</li>
              <li>Set quiet hours if desired</li>
              <li>Save your preferences</li>
            </ol>
            
            <div class="tip-box">
              <strong>💡 Recommendation:</strong> Keep message and calendar notifications enabled to stay informed about important child-related communications.
            </div>
          `
        },
        {
          id: 'security',
          title: 'Account Security',
          content: `
            <h3>Keeping Your Account Secure</h3>
            
            <h4>Password Security</h4>
            <ul>
              <li>Use a strong, unique password for Safespace</li>
              <li>Include uppercase, lowercase, numbers, and symbols</li>
              <li>Don't reuse passwords from other accounts</li>
              <li>Consider using a password manager</li>
              <li>Change your password if you suspect compromise</li>
            </ul>
            
            <h4>Account Protection</h4>
            <ul>
              <li>Keep your email address up to date</li>
              <li>Don't share your login credentials</li>
              <li>Log out from shared devices</li>
              <li>Report suspicious activity immediately</li>
              <li>Review account activity regularly</li>
            </ul>
            
            <h4>Data Privacy</h4>
            <ul>
              <li>Your personal journal is completely private</li>
              <li>Shared information is only visible to both parents</li>
              <li>All communications are encrypted</li>
              <li>We never share your data with third parties</li>
              <li>You can request data export if needed</li>
            </ul>
            
            <h4>Changing Your Password</h4>
            <ol>
              <li>Go to Account Settings</li>
              <li>Select "Change Password"</li>
              <li>Enter your current password</li>
              <li>Enter your new password twice</li>
              <li>Click "Update Password"</li>
            </ol>
          `
        }
      ]
    },
    'technical': {
      title: '🔧 Technical Support',
      articles: [
        {
          id: 'browser-support',
          title: 'Browser Compatibility',
          content: `
            <h3>Supported Browsers and Devices</h3>
            
            <h4>Recommended Browsers</h4>
            <ul>
              <li><strong>Google Chrome:</strong> Version 90+ (Recommended)</li>
              <li><strong>Mozilla Firefox:</strong> Version 88+</li>
              <li><strong>Safari:</strong> Version 14+ (Mac/iOS)</li>
              <li><strong>Microsoft Edge:</strong> Version 90+</li>
            </ul>
            
            <h4>Mobile Devices</h4>
            <ul>
              <li><strong>iOS:</strong> Safari on iOS 14+</li>
              <li><strong>Android:</strong> Chrome on Android 8+</li>
              <li><strong>Tablets:</strong> Full functionality on iPad and Android tablets</li>
            </ul>
            
            <h4>Browser Settings</h4>
            <p>For the best experience:</p>
            <ul>
              <li>Enable JavaScript</li>
              <li>Allow cookies for safespace.com</li>
              <li>Keep your browser updated</li>
              <li>Disable ad blockers on Safespace</li>
              <li>Clear browser cache if experiencing issues</li>
            </ul>
          `
        },
        {
          id: 'troubleshooting',
          title: 'Common Issues and Solutions',
          content: `
            <h3>Troubleshooting Guide</h3>
            
            <h4>Connection Issues</h4>
            <p><strong>Problem:</strong> "Disconnected" status or messages not sending</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Check your internet connection</li>
              <li>Refresh the browser page</li>
              <li>Try using a different browser</li>
              <li>Disable VPN temporarily</li>
              <li>Contact technical support if issues persist</li>
            </ul>
            
            <h4>File Upload Problems</h4>
            <p><strong>Problem:</strong> Files won't upload or appear corrupted</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Check file size (maximum 50MB per file)</li>
              <li>Ensure file type is supported</li>
              <li>Try uploading one file at a time</li>
              <li>Clear browser cache and cookies</li>
              <li>Try a different browser</li>
            </ul>
            
            <h4>Login Issues</h4>
            <p><strong>Problem:</strong> Can't log in or session expires quickly</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Verify your email and password are correct</li>
              <li>Clear browser cookies and cache</li>
              <li>Try incognito/private browsing mode</li>
              <li>Reset your password if needed</li>
              <li>Check if your account has been suspended</li>
            </ul>
            
            <h4>Mobile Issues</h4>
            <p><strong>Problem:</strong> App doesn't work properly on mobile</p>
            <p><strong>Solutions:</strong></p>
            <ul>
              <li>Use your mobile browser instead of in-app browsers</li>
              <li>Switch to desktop/laptop for complex tasks</li>
              <li>Ensure mobile browser is updated</li>
              <li>Try landscape orientation for better layout</li>
            </ul>
          `
        },
        {
          id: 'performance',
          title: 'Optimizing Performance',
          content: `
            <h3>Getting the Best Performance</h3>
            
            <h4>Browser Optimization</h4>
            <ul>
              <li>Close unnecessary browser tabs</li>
              <li>Clear browser cache regularly</li>
              <li>Disable unnecessary browser extensions</li>
              <li>Keep browser updated to latest version</li>
              <li>Restart browser if it becomes slow</li>
            </ul>
            
            <h4>Internet Connection</h4>
            <ul>
              <li>Use a stable internet connection when possible</li>
              <li>Close other applications using bandwidth</li>
              <li>Test your internet speed (minimum 5 Mbps recommended)</li>
              <li>Use Wi-Fi instead of cellular when available</li>
            </ul>
            
            <h4>File Management</h4>
            <ul>
              <li>Optimize image file sizes before uploading</li>
              <li>Use PDF format for document uploads when possible</li>
              <li>Archive old files regularly</li>
              <li>Don't upload files larger than necessary</li>
            </ul>
            
            <div class="tip-box">
              <strong>💡 Performance Tip:</strong> If you're experiencing slow performance, try using Chrome in incognito mode with all extensions disabled.
            </div>
          `
        }
      ]
    },
    'faq': {
      title: '❓ Frequently Asked Questions',
      articles: [
        {
          id: 'general-faq',
          title: 'General Questions',
          content: `
            <h3>Frequently Asked Questions</h3>
            
            <h4>How does the AI message enhancement work?</h4>
            <p><strong>A:</strong> Every message is analyzed by our AI system before sending. If the message contains inappropriate language, threats, or non-constructive content, it's automatically rewritten to be more respectful while preserving your intended meaning. The enhanced version is what gets sent and displayed.</p>
            
            <h4>Can the other parent see my original messages?</h4>
            <p><strong>A:</strong> No. Only the AI-enhanced version of your messages is sent and displayed. Your original message is stored securely for legal documentation purposes but is never shown to the other parent.</p>
            
            <h4>Is my Personal Journal really private?</h4>
            <p><strong>A:</strong> Yes, absolutely. Your Personal Journal is completely private. No one else, including the other parent, Safespace staff, or AI systems can access your journal entries. It's your private space.</p>
            
            <h4>What happens if I accidentally upload the wrong document to Unalterable Records?</h4>
            <p><strong>A:</strong> Unfortunately, documents uploaded to Unalterable Records cannot be deleted or modified once uploaded. This is by design to ensure legal integrity. Please be careful when uploading and verify you're uploading the correct document.</p>
            
            <h4>Can I use Safespace on my mobile phone?</h4>
            <p><strong>A:</strong> Yes! Safespace works on mobile browsers. For the best experience, use Chrome or Safari on your mobile device. Some complex features work better on desktop/laptop computers.</p>
            
            <h4>How long are my messages and data stored?</h4>
            <p><strong>A:</strong> All your data is stored permanently for legal and accountability purposes. Messages, documents, and activity logs are retained indefinitely to ensure there's always a complete record if needed for legal proceedings.</p>
          `
        },
        {
          id: 'privacy-faq',
          title: 'Privacy and Security',
          content: `
            <h3>Privacy and Security Questions</h3>
            
            <h4>Who can see my information on Safespace?</h4>
            <p><strong>A:</strong> Most information is shared between both parents for transparency. However, your Personal Journal is completely private. Here's the breakdown:</p>
            <ul>
              <li><strong>Shared with other parent:</strong> Messages, calendar events, payments, Info Library, Vault files (if marked as shared), Unalterable Records</li>
              <li><strong>Private to you:</strong> Personal Journal, private Vault files, account settings, notification preferences</li>
            </ul>
            
            <h4>Is my data secure?</h4>
            <p><strong>A:</strong> Yes. We use enterprise-grade security including encryption, secure servers, and regular security audits. All communications are encrypted, and access is logged for accountability.</p>
            
            <h4>Can Safespace staff read my messages?</h4>
            <p><strong>A:</strong> Safespace staff do not routinely read your messages. Access is only granted in extreme circumstances for legal compliance or safety concerns, and all access is logged and audited.</p>
            
            <h4>What happens to my data if I stop using Safespace?</h4>
            <p><strong>A:</strong> Your data remains stored for legal and documentation purposes. You can export your data at any time. If you need data deletion, contact support, though some legal documents may need to be retained.</p>
            
            <h4>Can the other parent see when I'm online?</h4>
            <p><strong>A:</strong> No. Online status and activity times are not shared between parents. However, read receipts for messages are visible to maintain accountability.</p>
          `
        },
        {
          id: 'features-faq',
          title: 'Feature-Specific Questions',
          content: `
            <h3>Feature Questions</h3>
            
            <h4>Why can't I delete messages after sending them?</h4>
            <p><strong>A:</strong> Messages cannot be deleted to ensure accountability and provide a complete record for legal purposes. This protects both parents by maintaining an unalterable communication history.</p>
            
            <h4>How do I know if the other parent has read my message?</h4>
            <p><strong>A:</strong> Read receipts are mandatory in Safespace. You'll see a timestamp showing when your message was read. This ensures transparency and accountability in communication.</p>
            
            <h4>Can I schedule messages to be sent later?</h4>
            <p><strong>A:</strong> Currently, message scheduling is not available. All messages are sent immediately after AI processing. You can save drafts in your Personal Journal if you want to prepare messages in advance.</p>
            
            <h4>How do reimbursement requests work?</h4>
            <p><strong>A:</strong> When you create a reimbursement request, the other parent is notified and can review the expense details and receipts. They can approve, request more information, or discuss through messaging. Once approved, they can upload proof of payment.</p>
            
            <h4>What's the difference between Info Library and Vault Storage?</h4>
            <p><strong>A:</strong> Info Library is for organizing information with descriptions and attached files. Vault Storage is for general file sharing and organization with folder structures. Use Info Library for documented information, Vault for file sharing.</p>
            
            <h4>Can I export my data for court use?</h4>
            <p><strong>A:</strong> Yes. You can export messages, calendar events, payment records, and other data. Documents from Unalterable Records come with verification certificates that are court-ready.</p>
          `
        }
      ]
    }
  };

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContent([]);
      return;
    }

    const results = [];
    Object.keys(helpContent).forEach(categoryKey => {
      const category = helpContent[categoryKey];
      category.articles.forEach(article => {
        const searchableText = `${category.title} ${article.title} ${article.content}`.toLowerCase();
        if (searchableText.includes(searchQuery.toLowerCase())) {
          results.push({
            categoryKey,
            categoryTitle: category.title,
            article
          });
        }
      });
    });

    setFilteredContent(results);
  }, [searchQuery]);

  const categories = Object.keys(helpContent).map(key => ({
    key,
    ...helpContent[key]
  }));

  const currentCategory = helpContent[selectedCategory];

  return (
    <div className="help-center">
      <div className="help-sidebar">
        <div className="help-header">
          <h2>❓ Help Center</h2>
          <p>Find answers and learn how to use Safespace</p>
        </div>

        <div className="help-search">
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {searchQuery ? (
          <div className="search-results">
            <h3>Search Results</h3>
            {filteredContent.length === 0 ? (
              <p className="no-results">No results found for "{searchQuery}"</p>
            ) : (
              <div className="search-results-list">
                {filteredContent.map((result, index) => (
                  <div
                    key={index}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedCategory(result.categoryKey);
                      setSearchQuery('');
                      document.getElementById(result.article.id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <div className="result-category">{result.categoryTitle}</div>
                    <div className="result-title">{result.article.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="help-categories">
            <h3>Categories</h3>
            {categories.map(category => (
              <div
                key={category.key}
                className={`category-item ${selectedCategory === category.key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.key)}
              >
                <span className="category-title">{category.title}</span>
                <span className="article-count">{category.articles.length} articles</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="help-content">
        {currentCategory && (
          <>
            <div className="content-header">
              <h1>{currentCategory.title}</h1>
              <p>{currentCategory.articles.length} articles in this category</p>
            </div>

            <div className="articles-list">
              {currentCategory.articles.map(article => (
                <article key={article.id} id={article.id} className="help-article">
                  <h2>{article.title}</h2>
                  <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default HelpCenter;