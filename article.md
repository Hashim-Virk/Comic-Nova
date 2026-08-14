# ComicNova: Building an AI Comic Book Generator with AWS Serverless and Bedrock

Welcome to **ComicNova**, a serverless web application that turns any creative story idea into a custom 3-panel visual comic strip! Built as a submission for the AWS Build a Creative App Weekend Challenge, this project highlights how developers can leverage AWS serverless technologies—including AWS Lambda, Amazon Bedrock, Amazon S3, and Amazon DynamoDB—to build high-performance, cost-effective, and highly engaging creative applications.

---

## 💡 The Inspiration

Visual storytelling is one of the oldest forms of human communication, but creating comics requires drawing skills, layout design, and narrative scripting. **ComicNova** democratizes this art form. By simply typing a premise (e.g., *"A brave mouse finds a glowing magical golden cheese in a castle basement"*), users receive a complete comic page featuring:
1. A custom, catchy title.
2. A 3-panel narrative script with character dialogues.
3. Custom-generated illustrations matching their chosen artistic style (e.g., Chibi Anime, Superhero Comic, Neon Cyberpunk, or Watercolor).
4. A public gallery to save and share their creations with the world.

---

## 🏗️ Technical Architecture

ComicNova is architected on a fully serverless stack, optimizing for high scalability, rapid deployment, and minimal cost within the AWS Free Tier.

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

1. **Frontend**: A Single Page Application (SPA) built using **Vite + React** and custom CSS. It features a modern HSL-based dark mode theme with glassmorphism effects, progress tracking loaders, and a high-fidelity "retro paper" comic book reader styling.
2. **Backend**: A single **AWS Lambda** function running **Python 3.13**, exposed via a public, CORS-configured **Lambda Function URL**. This acts as a lightweight HTTP API, eliminating the need for an API Gateway.
3. **AI Core (Amazon Bedrock)**:
   - **Amazon Nova Lite (`amazon.nova-lite-v1:0`)**: Used via the Converse API to take the user's premise and generate a structured JSON comic script (title, narration, dialogues, and descriptive image prompts).
   - **Amazon Nova Canvas (`amazon.nova-canvas-v1:0`)**: Used via the `invoke_model` API to generate high-resolution 512x512 panel illustrations based on the script prompts and selected art style.
4. **Asset Hosting (Amazon S3)**: Generated image bytes are uploaded to a public S3 bucket with CORS configuration, returning pre-signed URLs or public URLs to render panels on the frontend.
5. **Database (Amazon DynamoDB)**: A DynamoDB Table stores metadata of saved comics, enabling a dynamic, real-time "Public Gallery" page.

---

## 🛠️ Overcoming Engineering Challenges

During development, we encountered and solved several critical AWS integration challenges:

### 1. CloudFormation Early Validation Hook Error
During backend deployment, CloudFormation rejected our `AllowMethods` configuration under `FunctionUrlConfig`:
* **Problem**: `OPTIONS` was provided in the methods list, failing validation since CloudFormation's property validation schema only supports `[GET, PUT, HEAD, POST, PATCH, DELETE, *]`.
* **Solution**: We replaced the specific methods list with a single wildcard `*`, which safely allows preflight `OPTIONS` and standard `POST`/`GET` requests.

### 2. Duplicate CORS Headers (CORS Collision)
Our first browser test failed with `TypeError: Failed to fetch`.
* **Problem**: In the Python code, we were manually appending standard CORS headers (`Access-Control-Allow-Origin: *`). However, the Lambda Function URL gateway layer was also configured to inject CORS headers based on our SAM template. This resulted in duplicate CORS headers in the HTTP response, which modern browsers reject.
* **Solution**: We removed the manual CORS header responses from the Python `respond()` helper, allowing the Lambda Function URL gateway layer to handle and inject CORS headers cleanly.

### 3. Boto3 DynamoDB Decimal Serialization Error
When attempting to retrieve the public gallery, the API crashed with `TypeError: Object of type Decimal is not JSON serializable`.
* **Problem**: Boto3's DynamoDB serializer automatically converts all numeric values (like our `panel_number`) into Python `Decimal` objects. The standard `json.dumps` library does not know how to serialize `Decimal` types.
* **Solution**: We implemented a custom `DecimalEncoder` class in our Lambda code to convert Decimal values to integers or floats during JSON serialization:
  ```python
  class DecimalEncoder(json.JSONEncoder):
      def default(self, o):
          if isinstance(o, decimal.Decimal):
              return int(o) if o % 1 == 0 else float(o)
          return super(DecimalEncoder, self).default(o)
  ```

### 4. Entitlement & Model Authorization Holds
AWS accounts, especially new ones, occasionally face model entitlement holds, returning `ValidationException: Operation not allowed` when calling Bedrock Converse.
* **Problem**: Preventing the app from loading or functioning if Bedrock access is restricted.
* **Solution**: We engineered a robust, local fallback framework. If Bedrock Converse or Canvas fails, the backend triggers local generators:
  - *Text Fallback*: Dynamically formats a beautiful 3-panel script using templates.
  - *Image Fallback*: Generates and returns a custom, base64-encoded SVG panel containing stylized vector shapes and text descriptions matching the chosen style.
  This ensures the app remains fully functional, responsive, and testable regardless of AWS Bedrock console permissions.

---

## 🚀 How to Run the Project

### Prerequisites
- Node.js & npm installed
- AWS CLI & AWS SAM CLI configured with access credentials

### Backend Deployment
1. Navigate to the backend:
   ```bash
   cd aws-app/backend
   ```
2. Build the serverless resources:
   ```bash
   sam build
   ```
3. Deploy to AWS:
   ```bash
   sam deploy
   ```
4. Copy the `BackendFunctionUrl` from the CloudFormation Outputs.

### Frontend Setup
1. Navigate to the frontend:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Open `src/App.jsx` and replace `BACKEND_URL` with your copied `BackendFunctionUrl`.
4. Launch the local dev server:
   ```bash
   npm run dev
   ```

---

## 🏁 Conclusion

By using AWS Serverless features (Lambda, DynamoDB, S3) and Amazon Bedrock, we built a fully featured, scalable, and responsive creative app. Overcoming early validation and serialization issues provided valuable serverless learnings, demonstrating the absolute importance of proper CORS header scoping and custom type encoding when working with AWS SDKs. 

Enjoy creating your visual stories with **ComicNova**! 🔮🎨
