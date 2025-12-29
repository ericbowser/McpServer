# 🚀 LaserTags MCP Server

**AI-Powered Business Management for LaserTags Pet ID E-commerce**

Transform your LaserTags backend into an intelligent business automation system using Claude AI!

## 🎯 What This Does

This MCP (Model Context Protocol) server connects your LaserTags backend to Claude, giving you:

- ✅ **Contact Management** - Add, update, and search customer contacts
- ✅ **Order Tracking** - Monitor LaserTag orders in real-time
- ✅ **Revenue Analytics** - Track earnings and business growth
- ✅ **Progress Dashboard** - Monitor milestones toward launch goals
- ✅ **AI-Powered Insights** - Let Claude analyze your business data

## 📋 Prerequisites

- Node.js 18+ installed
- LaserTags backend running (default: http://localhost:3003)
- PostgreSQL database with `lasertg` schema
- Claude Desktop app installed

## 🛠️ Installation

### Step 1: Install Dependencies

```bash
cd C:\Projects\McpServer\mcp
npm install
```

### Step 2: Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
LASER_BACKEND_URL=http://localhost:3003
DB_USER=postgres
DB_HOST=localhost
DB_NAME=postgres
DB_PASSWORD=your_actual_password
DB_PORT=5432
```

### Step 3: Verify Database Schema

Make sure your PostgreSQL database has these tables:

```sql
-- Contact table
CREATE TABLE IF NOT EXISTS lasertg.contact (
    contactid SERIAL PRIMARY KEY,
    firstname VARCHAR(100),
    lastname VARCHAR(100),
    petname VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS lasertg.orders (
    orderid SERIAL PRIMARY KEY,
    contactid INTEGER REFERENCES lasertg.contact(contactid),
    amount INTEGER,  -- in cents
    status VARCHAR(50),
    stripe_payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Step 4: Configure Claude Desktop

Add this to your Claude Desktop config:

**Location:** `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "lasertags": {
      "command": "node",
      "args": ["C:\\Projects\\McpServer\\mcp\\index.js"],
      "env": {
        "LASER_BACKEND_URL": "http://localhost:3003",
        "DB_USER": "postgres",
        "DB_HOST": "localhost",
        "DB_NAME": "postgres",
        "DB_PASSWORD": "your_password",
        "DB_PORT": "5432"
      }
    }
  }
}
```

### Step 5: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Reopen Claude Desktop
3. Look for the 🔌 MCP icon in the bottom right

## 🎯 Quick Start - Test Your Connection

Open Claude Desktop and try these commands:

```
1. Check setup status:
   "Track my LaserTags setup progress"

2. Get revenue stats:
   "What's my current revenue and order count?"

3. View contacts:
   "Show me all my LaserTag contacts"

4. Add a test contact:
   "Save a new contact: John Doe, pet name Max, phone 555-1234"
```

## 🔧 Available Tools

### 1. **get_contact**
Retrieve contact information by ID
```javascript
get_contact({ contactid: 123 })
```

### 2. **save_contact**
Create a new customer contact
```javascript
save_contact({
  firstname: "John",
  lastname: "Doe",
  petname: "Max",
  phone: "555-1234",
  address: "123 Main St"
})
```

### 3. **update_contact**
Update existing contact information
```javascript
update_contact({
  contactid: 123,
  phone: "555-5678"
})
```

### 4. **get_all_contacts**
Retrieve all contacts (with optional limit)
```javascript
get_all_contacts({ limit: 50 })
```

### 5. **search_contacts**
Search contacts by name, pet name, or phone
```javascript
search_contacts({ search_term: "Max" })
```

### 6. **get_revenue_stats**
Get revenue and order statistics
```javascript
get_revenue_stats({
  start_date: "2024-01-01",
  end_date: "2024-12-31"
})
```

### 7. **get_recent_orders**
View recent orders with contact info
```javascript
get_recent_orders({ limit: 10 })
```

### 8. **track_progress**
Monitor business milestones
```javascript
track_progress({ metric: "revenue" })
// Options: contacts, orders, revenue, setup
```

## 📊 Example Conversations with Claude

**Business Dashboard:**
```
"Give me a complete business overview - how many contacts, orders, and total revenue?"
```

**Customer Management:**
```
"Search for customers with pets named Max"
"Update contact 45's phone number to 555-9999"
```

**Progress Tracking:**
```
"How close am I to my first $1000 in revenue?"
"Track my order progress"
```

**Analysis:**
```
"Show me all orders from the last 30 days with customer details"
"What's my average order value?"
```

## 🚨 Troubleshooting

### MCP Server Not Showing in Claude

1. Check Claude Desktop config location:
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

2. Verify the path is correct (use double backslashes `\\`)

3. Check logs in Claude Desktop:
   - View → Developer → Toggle Developer Tools
   - Look for errors in Console tab

### Database Connection Errors

1. Verify PostgreSQL is running:
   ```bash
   psql -U postgres -d postgres -c "SELECT 1"
   ```

2. Check database credentials in `.env`

3. Ensure `lasertg` schema exists:
   ```bash
   npm run db:setup
   ```

### Backend Not Responding

1. Ensure LaserTags backend is running:
   ```bash
   cd C:\Projects\McpServer
   npm start
   ```

2. Verify backend URL in `.env` matches where it's running

3. Test backend directly:
   ```bash
   curl http://localhost:3003/api/health
   ```

## 📈 Business Milestones

Track your progress with these built-in milestones:

### Contacts
- ✓ 1st customer enrolled
- ✓ 10 customers
- ✓ 50 customers

### Orders
- ✓ 1st sale
- ✓ 10 orders
- ✓ 100 orders

### Revenue
- ✓ First $100
- ✓ First $1,000
- ✓ First $10,000

## 🎓 Next Steps

1. **Start taking orders** - Your system is ready to process LaserTag sales!

2. **Automate workflows** - Ask Claude to help with:
   - Email confirmations
   - Order status updates
   - Revenue reporting

3. **Scale operations** - Use Claude to:
   - Identify popular pet names
   - Analyze customer patterns
   - Optimize pricing

4. **Build dashboards** - Have Claude create:
   - Daily sales reports
   - Customer insights
   - Growth projections

## 💡 Pro Tips

- Use natural language - Claude understands conversational requests
- Ask for summaries - "Give me a weekly business summary"
- Automate reporting - "Send me daily revenue updates"
- Get insights - "What trends do you see in my orders?"

## 🏆 Why This Matters

You're now positioned as an **early MCP adopter** - a technology being adopted by OpenAI, Google, and Microsoft. This gives you:

- ✅ **Career advantage** - Experience with emerging AI integration standards
- ✅ **Business automation** - AI-powered management of your LaserTags business
- ✅ **Rapid iteration** - Test and improve with AI assistance
- ✅ **Market positioning** - Ready to scale when demand grows

## 📝 License

MIT - Built for LaserTags by Eric

---

**Ready to launch?** Ask Claude: *"Help me get my first LaserTag order!"*
