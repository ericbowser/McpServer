# CloudPrepper MCP Server

High-quality certification exam question generation and analysis server for CloudPrepper platform.

## 🎯 Purpose

This MCP server provides AI-powered tools for creating and managing CloudPrepper's certification exam questions. It ensures copyright safety, maintains quality standards, and aligns with official exam specifications.

## 🚀 Quick Start

### Installation

```bash
cd C:\Projects\McpServer\cloudprepper_mcp
npm install
```

### Build

```bash
npm run build
```

### Run

```bash
npm start
```

### Test with MCP Inspector

```bash
npm run inspect
```

📖 **Full Setup Guide:** See [docs/QUICK_START.md](./docs/QUICK_START.md)

## 🛠️ Available Tools

### 1. cloudprepper_generate_question

Generate copyright-safe, scenario-based exam questions.

**Example:**
```json
{
  "certification_type": "CV0-004",
  "domain_name": "Cloud Architecture and Design",
  "cognitive_level": "apply",
  "skill_level": "intermediate",
  "count": 3,
  "scenario_context": "Multi-cloud migration with cost constraints"
}
```

### 2. cloudprepper_analyze_quality

Analyze questions for quality and copyright safety.

**Example:**
```json
{
  "question_text": "A company is migrating...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "explanation": "The correct answer is...",
  "correct_answers": [1]
}
```

### 3. cloudprepper_check_coverage

Check domain coverage against exam specifications.

**Example:**
```json
{
  "certification_type": "SAA-C03",
  "total_questions_target": 200
}
```

## 📁 Project Structure

```
cloudprepper-mcp/
├── src/
│   ├── index.ts              # Main server entry
│   ├── constants.ts          # Domain weights, thresholds
│   ├── types/
│   │   └── index.ts         # TypeScript definitions
│   └── tools/
│       ├── questionGenerator.ts
│       ├── questionQuality.ts
│       └── domainCoverage.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 🎓 Supported Certifications

### CompTIA Cloud+ (CV0-004)
- Cloud Architecture and Design (20%)
- Security (25%)
- Deployment (20%)
- Operations and Support (20%)
- Troubleshooting (15%)

### AWS Solutions Architect Associate (SAA-C03)
- Design Secure Architectures (30%)
- Design Resilient Architectures (26%)
- Design High-Performing Architectures (24%)
- Design Cost-Optimized Architectures (20%)

## 🔧 Configuration

### Claude Desktop Integration

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cloudprepper": {
      "command": "node",
      "args": ["C:\\Projects\\McpServer\\cloudprepper-mcp\\dist\\index.js"]
    }
  }
}
```

### Environment Variables (Future)

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cloudprepper
DB_USER=postgres
DB_PASSWORD=your_password
ANTHROPIC_API_KEY=your_api_key
```

## 📊 Quality Standards

Questions are analyzed across 5 dimensions:

1. **Copyright Safety (25%)** - Ensures original content
2. **Scenario Depth (20%)** - Real-world business context
3. **Distractor Quality (20%)** - Plausible wrong answers
4. **Explanation Completeness (20%)** - Technical depth
5. **2025 Relevance (15%)** - Current best practices

**Minimum Overall Score:** 70/100

## 🚧 Development Roadmap

### Phase 1 (Current)
- ✅ Core question generation
- ✅ Quality analysis
- ✅ Domain coverage checking

### Phase 2 (Next)
- [ ] PostgreSQL database integration
- [ ] Claude API integration for real generation
- [ ] Batch question import/export

### Phase 3 (Future)
- [ ] Competitor analysis tool
- [ ] Certification trends monitoring
- [ ] Architecture validation
- [ ] Monetization advisor

## 🧪 Testing

```bash
# Run MCP Inspector
npm run inspect

# Test question generation
# In Claude Desktop with this MCP enabled:
"Generate 3 CV0-004 questions about Kubernetes at advanced level"

# Test quality analysis
"Analyze the quality of this question: [paste question]"

# Test coverage check
"Check my current CV0-004 domain coverage"
```

## 🤝 Contributing

This is part of the CloudPrepper project by Execute & Engrave LLC.

## 📝 License

MIT License - See LICENSE file for details

## 🔗 Related Projects

- **CloudPrepper**: https://github.com/ericbowser/CloudPrepper
- **cloud_prepper_api**: https://github.com/ericbowser/cloud_prepper_api

---

Built with ❤️ for certification exam preparation
