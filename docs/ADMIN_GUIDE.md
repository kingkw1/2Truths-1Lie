# 2Truths-1Lie Admin Tools

This guide covers comprehensive admin tools for managing the 2Truths-1Lie application, including challenge moderation, system cleanup, and user management.

## 🛠️ Available Admin Tools

### 1. CLI Admin Tool (`admin_cli.py`)
A powerful command-line interface for remote production management.

#### Features:
- **Search Challenges**: Find challenges by ID, creator, title, or content
- **Delete Challenges**: Remove challenges with force deletion for published content
- **View Reports**: See all reported challenges with moderation details
- **System Stats**: Get comprehensive system statistics
- **Interactive Mode**: Full interactive session for complex operations

#### Usage:
```bash
# Basic search
python admin_cli.py search "search_term" --api-url https://your-api.com

# Delete a specific challenge
python admin_cli.py delete challenge_id --force --api-url https://your-api.com

# View all reports
python admin_cli.py reports --api-url https://your-api.com

# Get system statistics
python admin_cli.py stats --api-url https://your-api.com

# Interactive mode
python admin_cli.py interactive --api-url https://your-api.com
```

#### Authentication:
- Prompts for email/password for admin users
- Supports guest access for read-only operations
- Stores auth token for session duration

### 2. Web Admin Panel (`admin_panel.html`)
A browser-based interface for challenge management.

#### Features:
- **Visual Search Interface**: Easy-to-use search with results display
- **One-Click Deletion**: Delete challenges directly from search results
- **Real-Time Logging**: See all operations in a live log display
- **Quick Actions**: Access reports, stats, and cleanup functions
- **Responsive Design**: Works on desktop and mobile devices

#### Usage:
1. Open `admin_panel.html` in any modern web browser
2. Enter your API URL (defaults to production Railway URL)
3. Login with admin credentials or use guest access
4. Use the interface to search and manage challenges

### 3. Admin API Endpoints
RESTful API endpoints for programmatic access.

#### Key Endpoints:

**Challenge Management:**
- `GET /api/v1/admin/challenges/search/{search_term}` - Search challenges
- `DELETE /api/v1/admin/challenges/{challenge_id}` - Delete challenge
- `GET /api/v1/admin/moderation/reports` - Get reported challenges
- `POST /api/v1/admin/moderation/challenges/{challenge_id}/review` - Review challenge

**System Management:**
- `GET /api/v1/admin/moderation/stats` - Get system statistics
- `POST /api/v1/admin/cleanup` - Clean up expired sessions
- `POST /api/v1/admin/cleanup/rate-limits` - Clean up rate limits
- `POST /api/v1/admin/rate-limit/{user_id}/reset` - Reset user rate limit

## 🔐 Authentication & Security

### Admin Permissions
Admin endpoints require either:
1. **Admin User**: Login with admin email/password
2. **Guest Access**: Limited read-only access for some operations

### Audit Logging
All admin actions are logged with:
- **Timestamp**: When the action occurred
- **Admin User**: Who performed the action
- **Action Type**: What operation was performed
- **Details**: Challenge IDs, parameters, results
- **Success/Failure**: Operation outcome

Example log entry:
```json
{
  "timestamp": "2024-01-15T14:30:25.123456",
  "action": "challenge_deletion",
  "user_id": "admin@example.com",
  "success": true,
  "details": {
    "challenge_id": "abc123",
    "force": true,
    "database_records_deleted": {"challenges": 1, "reports": 3},
    "media_files_deleted": 2
  }
}
```

## 🚀 Quick Start for Production

### 1. Emergency Challenge Deletion
If you need to quickly delete inappropriate content:

```bash
# Using CLI tool
python admin_cli.py delete CHALLENGE_ID --force --api-url https://2truths-1lie-production.up.railway.app

# Using web interface
# Open admin_panel.html, search for the challenge, click Delete
```

### 2. Check System Health
```bash
# Get comprehensive stats
python admin_cli.py stats --api-url https://2truths-1lie-production.up.railway.app

# Check for reported content
python admin_cli.py reports --api-url https://2truths-1lie-production.up.railway.app
```

### 3. Routine Maintenance
```bash
# Interactive mode for multiple operations
python admin_cli.py interactive --api-url https://2truths-1lie-production.up.railway.app
```

## 🔧 Configuration

### Environment Variables
Make sure these are set in your environment:
- `AWS_ACCESS_KEY_ID`: For S3 media deletion
- `AWS_SECRET_ACCESS_KEY`: For S3 media deletion
- `AWS_S3_BUCKET_NAME`: Target S3 bucket
- `AWS_S3_REGION`: S3 region

### API URLs
- **Production**: `https://2truths-1lie-production.up.railway.app`
- **Development**: `http://localhost:8000`

## 📊 Admin Operations

### Challenge Lifecycle Management
1. **Search**: Find challenges by various criteria
2. **Review**: Moderate reported or flagged content
3. **Delete**: Remove inappropriate content (with full cleanup)
4. **Monitor**: Track system health and user reports

### System Maintenance
1. **Cleanup**: Remove expired upload sessions
2. **Rate Limits**: Reset user limits and clean expired data
3. **Monitoring**: Track system performance and usage

## 🛡️ Best Practices

### Security
- Always use HTTPS in production
- Rotate admin credentials regularly
- Monitor admin action logs for unusual activity
- Use force deletion sparingly and document reasons

### Operations
- Search before deleting to ensure you have the right challenge
- Review challenge content before deletion when possible
- Keep admin action logs for compliance and auditing
- Test operations in development before production use

### Performance
- Use interactive mode for bulk operations
- Clean up expired data regularly
- Monitor S3 storage usage and costs

## 🐛 Troubleshooting

### Common Issues

**Authentication Failures:**
- Verify API URL is correct and accessible
- Check admin credentials are valid
- Ensure user has admin permissions

**Challenge Not Found:**
- Challenges may exist in production but not locally
- Use the search function to verify challenge exists
- Check challenge ID format (UUID)

**Deletion Failures:**
- Published challenges require `--force` flag
- Verify AWS credentials for media deletion
- Check admin permissions

**Connection Issues:**
- Verify API server is running
- Check network connectivity
- Confirm API URL and ports

### Support
For technical issues or questions:
1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test with development environment first
4. Review audit logs for operation history

## 💾 Database Persistence & Data Recovery

### Railway Deployment Data Persistence
The application now uses **PostgreSQL** for production persistence on Railway to prevent data loss during deployments.

#### Database Setup on Railway:
1. **Add PostgreSQL Service**: In Railway dashboard, click "Add Service" → "Database" → "PostgreSQL"
2. **Automatic Configuration**: Railway automatically sets `DATABASE_URL` environment variable
3. **Initialize Database**: Run the setup script after deployment:
   ```bash
   python backend/setup_production_db.py
   ```

#### Database Architecture:
- **Production (Railway)**: PostgreSQL with persistent storage
- **Development (Local)**: SQLite for easy local testing
- **Automatic Detection**: Application automatically uses the correct database based on `DATABASE_URL`

#### Verifying Persistence:
```bash
# Check current database type and connection
python backend/setup_production_db.py

# View database configuration
python -c "from backend.config import settings; print(f'Database: {settings.database_url[:50]}...')"
```

#### Recovery from Data Loss:
If you experience data loss (challenges disappearing), it means the application reverted to SQLite:
1. Ensure PostgreSQL addon is added to Railway project
2. Verify `DATABASE_URL` environment variable is set
3. Redeploy the application
4. Run database setup script

#### Migration Notes:
- All existing SQLite data will be preserved during PostgreSQL migration
- Challenge IDs and user data maintain consistency across database types
- Media files in S3 remain unchanged

---

## 📝 Change Log

### v1.1.0 (Latest) - Persistent Storage Fix
- ✅ **PostgreSQL Integration**: Added production-ready PostgreSQL support
- ✅ **Railway Persistence**: Challenges now survive deployments on Railway
- ✅ **Dual Database Support**: Automatic SQLite (dev) / PostgreSQL (prod) switching
- ✅ **Data Migration Tools**: Setup scripts for database initialization
- ✅ **Zero Data Loss**: Eliminates challenge disappearance on deployment

### v1.0.0
- ✅ CLI admin tool with full CRUD operations
- ✅ Web admin panel with visual interface
- ✅ Comprehensive API endpoints
- ✅ Complete audit logging system
- ✅ Force deletion for published challenges
- ✅ AWS S3 media cleanup integration
- ✅ Interactive mode for complex operations

---

*This admin system provides a complete solution for managing the 2Truths-1Lie application with persistent data storage and comprehensive administrative capabilities.*