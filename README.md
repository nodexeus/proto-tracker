# Proto-Tracker

**Modern Blockchain Protocol Monitoring and Analysis Platform**

Proto-Tracker is a comprehensive blockchain protocol monitoring system that automatically tracks protocol updates, provides AI-powered analysis, and delivers intelligent insights about hard forks, breaking changes, and security updates across multiple blockchain protocols.

## 🌟 Key Features

### 📊 **Protocol Monitoring**
- **Automated GitHub Tracking**: Monitor multiple blockchain protocols through their GitHub repositories
- **Release & Tag Detection**: Automatically fetch new releases and tags from configured repositories
- **Real-time Updates**: Background polling service continuously monitors for new protocol updates
- **Client-Protocol Mapping**: Track multiple implementations (clients) for each protocol

### 🤖 **AI-Powered Analysis**
- **Multi-Provider AI Support**: OpenAI (GPT-5), Anthropic (Claude-4), and Local LLMs via Ollama
- **Intelligent Release Analysis**: Automatic summarization of release notes and changelogs
- **Hard Fork Detection**: Advanced pattern matching to identify critical network upgrades
- **Breaking Change Identification**: Automatic detection of backwards incompatible changes
- **Security Update Flagging**: Intelligent identification of security-related patches
- **Risk Assessment**: AI-generated risk analysis for upgrade decisions
- **Confidence Scoring**: AI confidence levels for analysis accuracy

### 🔔 **Smart Notifications**
- **Multi-Channel Support**: Discord, Slack, Telegram, and generic webhooks
- **Selective Notifications**: Configure notifications per client/protocol
- **Hard Fork Alerts**: Priority alerts for critical network upgrades
- **Customizable Filters**: Filter notifications by update type, priority, or client

### 🗄️ **Data Management**
- **Comprehensive Database**: PostgreSQL with optimized indexing for fast queries
- **S3 Integration**: Optional cloud storage for snapshot data and backups
- **API-First Design**: RESTful API with OpenAPI/Swagger documentation
- **Advanced Filtering**: Search and filter updates by date, client, priority, or type

### 👤 **User Management**
- **OAuth Authentication**: Google OAuth integration for secure access
- **API Key Management**: Generate and manage multiple API keys per user
- **Role-Based Access**: Admin and user roles with appropriate permissions
- **User Profiles**: Customizable user profiles with preferences

### 📈 **Analytics & Insights**
- **Protocol Statistics**: Track update frequency, hard fork history, and trends
- **Visual Dashboards**: Interactive charts and graphs for protocol activity
- **Historical Analysis**: Track protocol evolution over time
- **Export Capabilities**: Export data for further analysis

## 🏗️ Architecture

### Backend (FastAPI)
- **Fast & Modern**: Built with FastAPI for high performance and automatic API documentation
- **Async Processing**: Asynchronous background services for efficient monitoring
- **Robust Database**: SQLAlchemy ORM with Alembic migrations
- **Service Architecture**: Modular services for different functionalities

### Frontend (React + TypeScript)
- **Modern UI**: Built with React 19, TypeScript, and Mantine UI components
- **Responsive Design**: Mobile-friendly interface with dark/light theme support
- **Real-time Updates**: Live updates using React Query for optimal user experience
- **Type Safety**: Full TypeScript implementation for robust development

### Infrastructure
- **Containerized**: Docker and Docker Compose for easy deployment
- **Scalable**: Designed for horizontal scaling and cloud deployment
- **Monitoring**: Built-in logging and error tracking
- **Background Processing**: Asynchronous task processing for heavy operations

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git
- (Optional) Google OAuth credentials for authentication

### Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd proto-tracker
   ```

2. **Set Up Environment Variables**
   ```bash
   # Create .env file in project root
   cp .env.example .env
   
   # Edit .env with your configuration
   vim .env
   ```

   Required environment variables:
   ```env
   # Google OAuth (for authentication)
   VITE_GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
   
   # API Configuration
   VITE_API_URL=http://localhost:8001
   
   # AI Configuration (optional)
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

3. **Start the Application**
   ```bash
   docker compose up --build
   ```

4. **Access the Application**
   - **Web Interface**: http://localhost:3000
   - **API Documentation**: http://localhost:8001/docs
   - **API Base URL**: http://localhost:8001

### First-Time Setup

1. **Sign in** using Google OAuth
2. **Configure AI** (Settings → AI Settings) - Optional but recommended
3. **Add GitHub API Key** (Settings → GitHub Integration)
4. **Add Protocols/Clients** (Clients page)
5. **Start Background Polling** (Admin → Update Poller)

## 📖 Usage Guide

### Adding New Protocols

1. Navigate to **Clients** page
2. Click **"Add New Client"**
3. Fill in the form:
   - **Name**: Human-readable name (e.g., "Ethereum")
   - **Client**: Technical identifier (e.g., "geth")
   - **GitHub URL**: Repository URL (e.g., "https://github.com/ethereum/go-ethereum")
   - **Repository Type**: Choose "releases" or "tags"
4. Save the client

### Configuring AI Analysis

1. Go to **Settings → AI Settings**
2. Enable AI Analysis
3. Choose your preferred provider:
   - **OpenAI**: Requires API key, uses GPT-5
   - **Anthropic**: Requires API key, uses Claude-4
   - **Local**: Uses Ollama (free, requires local setup)
4. Configure model and timeout settings
5. Test the configuration

### Setting Up Notifications

1. Navigate to **Settings → Notifications**
2. Enable desired notification channels
3. Configure webhook URLs and credentials
4. Set notification preferences per client
5. Test notifications

### Background Monitoring

1. Go to **Admin → Update Poller**
2. Set your GitHub API key
3. Configure polling interval (default: 5 minutes)
4. Start the background poller
5. Monitor status and recent results

## 🛠️ Development

### Project Structure

```
proto-tracker/
├── api/                    # FastAPI Backend
│   ├── main.py            # API entry point
│   ├── models.py          # Database models
│   ├── crud.py            # Database operations
│   ├── schemas.py         # Pydantic schemas
│   ├── services/          # Business logic services
│   │   ├── ai_service.py          # AI analysis
│   │   ├── background_poller.py   # GitHub monitoring
│   │   ├── github_service.py      # GitHub API integration
│   │   └── notification_service.py # Notifications
│   └── utils/            # Utilities and migrations
├── web/                   # React Frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API client services
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   └── types/         # TypeScript type definitions
│   ├── package.json       # Node.js dependencies
│   └── vite.config.ts     # Vite configuration
└── docker-compose.yml     # Container orchestration
```

### Running in Development Mode

**Backend Development:**
```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

**Frontend Development:**
```bash
cd web
npm install
npm run dev
```

**Database Migrations:**
```bash
cd api
alembic upgrade head              # Apply migrations
alembic revision --autogenerate  # Generate new migration
```

### API Documentation

The API provides comprehensive OpenAPI documentation:
- **Interactive Docs**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc

Key API endpoints:
- `GET /protocols` - List all protocols
- `GET /protocol-updates` - List protocol updates
- `POST /admin/poller/poll-now` - Manual poll trigger
- `GET /ai/analysis/{update_id}` - Get AI analysis
- `POST /ai/analyze` - Trigger AI analysis

## 🔧 Configuration

### AI Providers

**OpenAI (Recommended)**
- Sign up at [OpenAI](https://platform.openai.com/)
- Create API key
- Supports GPT-5 and GPT-4 models
- Best for accuracy and reliability

**Anthropic Claude**
- Sign up at [Anthropic](https://console.anthropic.com/)
- Create API key
- Uses Claude-4 Sonnet model
- Good alternative to OpenAI

**Local LLMs (Ollama)**
- Install [Ollama](https://ollama.ai/)
- Pull models: `ollama pull llama2`
- No API key required
- Runs completely offline

### GitHub Integration

1. Create a GitHub Personal Access Token
2. Required scopes: `public_repo` (for public repositories)
3. Add the token in Settings → GitHub Integration
4. Configure polling interval (recommend 5-60 minutes)

### Notification Channels

**Discord**
- Create webhook in Discord server settings
- Copy webhook URL to notification settings

**Slack**
- Create Slack app with incoming webhooks
- Copy webhook URL to notification settings

**Telegram**
- Create bot via @BotFather
- Get bot token and chat IDs
- Configure in notification settings

## 📊 Features Deep Dive

### Hard Fork Detection

The AI system uses advanced pattern matching to identify hard forks:
- Keyword detection ("hard fork", "consensus change", "protocol upgrade")
- Network upgrade names (Ethereum: "Shanghai", "Dencun", etc.)
- EIP implementation tracking
- Activation block/date extraction
- Coordination requirement assessment

### AI Analysis Features

- **Summary Generation**: Concise overview of each release
- **Change Classification**: Categorize changes by type and impact
- **Priority Assessment**: Automatic priority ranking (Critical/High/Medium/Low)
- **Risk Analysis**: Upgrade vs. non-upgrade risk assessment
- **Impact Estimation**: Who is affected (developers, node operators, end users)
- **Technical & Executive Summaries**: Tailored content for different audiences

### Background Processing

- **Intelligent Polling**: Only recent updates get AI analysis
- **Rate Limiting**: Prevents API overuse with configurable limits
- **Error Handling**: Robust error recovery and logging
- **Manual Override**: Force immediate polling when needed
- **Status Monitoring**: Real-time status of background services

## 🐛 Troubleshooting

### Common Issues

**Connection Refused Errors**
- Ensure all services are running: `docker compose ps`
- Check logs: `docker compose logs proto-api`

**AI Analysis Not Working**
- Verify API keys in Settings → AI Settings
- Test configuration using "Test Configuration" button
- Check API provider quotas and billing

**GitHub Polling Issues**
- Verify GitHub API key has correct permissions
- Check rate limits (5000 requests/hour for authenticated requests)
- Ensure repository URLs are public and accessible

**Database Issues**
- Reset database: `docker compose down -v && docker compose up --build`
- Check migrations: `docker compose exec proto-api alembic current`

### Performance Optimization

- Increase polling interval for large numbers of repositories
- Limit AI analysis to recent updates only
- Use local LLMs for high-volume deployments
- Configure appropriate timeouts for your environment

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper tests
4. **Follow code style**: Run `npm run lint` and `npm run format`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- **Python**: Follow PEP 8, use Black formatter
- **TypeScript**: Use ESLint and Prettier configurations
- **Git**: Use conventional commits format

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- **Issues**: [GitHub Issues](https://github.com/your-repo/proto-tracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/proto-tracker/discussions)
- **Documentation**: API docs available at `/docs` endpoint

## 🚀 Roadmap

### Upcoming Features
- **Multi-Network Support**: Cross-chain protocol tracking
- **Advanced Analytics**: Machine learning trend analysis
- **Mobile App**: Native mobile applications
- **Custom Integrations**: Webhook system for third-party tools
- **Historical Data**: Deep historical analysis and trends
- **Alert Automation**: Smart alerting based on AI analysis

### Recent Updates
- ✅ AI-powered release analysis
- ✅ Hard fork detection system
- ✅ Multi-provider AI support
- ✅ Background polling optimization
- ✅ Modern React frontend
- ✅ Comprehensive notification system

---

**Proto-Tracker** - Stay ahead of blockchain protocol changes with intelligent monitoring and AI-powered insights.