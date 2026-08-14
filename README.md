# ComicNova: AI-Powered Comic Book & Story Generator

Welcome to **ComicNova**, a serverless web application that turns any creative story idea into a custom 3-panel visual comic strip! Built for the AWS Build a Creative App Weekend Challenge, this project demonstrates how to combine AWS serverless features—including AWS Lambda, Amazon Bedrock, Amazon S3, and Amazon DynamoDB—to build high-performance creative applications.

----

## 💡 Features & Highlights

- **Story Script Generation**: Takes user premises and generates structured 3-panel comic scripts (title, narrator text, speech bubble dialogues, and detailed visual prompts).
- **Multi-Style Artwork Canvas**: Offers curated visual styles including Superhero Comic, Chibi Anime, Neon Cyberpunk, Watercolor, Retro Pixel Art, and 3D Claymation.
- **Interactive Comic Reader**: Renders custom comic panels with retro-paper backgrounds, cream-colored narration blocks, and stylized speech bubbles.
- **Public Gallery**: Saves finalized comics to Amazon DynamoDB and Amazon S3, displaying them on a public showcase page.

---

## 🏗️ Technical Architecture

```
[ React/Vite SPA ] (http://localhost:5173)
       │
       ▼ (HTTPS POST / Fetch)
[ AWS Lambda Function URL ] (CORS enabled)
       │
       ├───► [ Amazon Bedrock (Nova Lite & Canvas) ] (Text & Image AI Generation)
       ├───► [ Amazon S3 Bucket ] (Stores generated panel illustrations)
       └───► [ Amazon DynamoDB Table ] (Saves comic metadata & public gallery)
```

1. **Frontend**: Vite + React single-page app with dynamic HSL dark mode styling and responsive card views.
2. **Backend**: AWS Lambda function running Python 3.13, exposed via a public CORS-enabled Lambda Function URL.
3. **AI Core**: Amazon Bedrock Nova models (`amazon.nova-lite-v1:0` for text and `amazon.nova-canvas-v1:0` for images) with graceful local fallback generation.
4. **Storage & DB**: Amazon S3 for hosting generated image assets and Amazon DynamoDB for maintaining gallery records.

---

## 🚀 Getting Started

### Prerequisites
* Node.js & npm
* AWS CLI & AWS SAM CLI configured with access permissions

### 1. Deploy Backend
```bash
cd backend
sam build
sam deploy
```
Copy the `BackendFunctionUrl` from the output.

### 2. Run Frontend
```bash
cd ../frontend
npm install
npm run dev
```
Update `BACKEND_URL` in `src/App.jsx` with your deployed Lambda Function URL.

---

## 📄 Article Write-up
For full implementation details, architectural insights, and solutions to AWS engineering challenges (such as CORS header collisions and DynamoDB Decimal serialization), refer to [article.md](./article.md).
