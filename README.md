# Weekend Creative Challenge: ComicNova - AI Comic & Visual Story Generator

**Tag**: `#creative-expression`

----

## 🎨 Vision & What the App Does

Visual storytelling is one of the most powerful forms of creative expression, but turning a story idea into an illustrated comic book usually requires specialized drawing skills, graphic layout design, and narrative scripting experience. 

**ComicNova** is a serverless web application that empowers anyone to turn a single text idea into a custom 3-panel visual comic strip in seconds. 

By entering a premise (such as *"A tiny brave mouse finds a glowing magical golden cheese in a dark castle basement"*), **ComicNova** generates:
- **Custom Comic Title**: A catchy, thematic title for the comic strip.
- **3-Panel Script**: Concise narrative context for each panel along with character dialogues.
- **Custom Illustrations**: Visual art generated in the user's selected style (e.g., *Superhero Comic*, *Chibi Anime*, *Neon Cyberpunk*, *Watercolor*, *Retro Pixel Art*, or *3D Claymation*).
- **Interactive Comic Reader**: Renders the complete story inside a retro-paper comic page complete with thick panel borders, vintage cream narration blocks, and speech bubbles.
- **Public Gallery**: Enables users to save their creations to a shared community showcase powered by Amazon DynamoDB and Amazon S3.

---

## 🛠️ How You Built It

We built **ComicNova** using a modern serverless stack designed for responsiveness, high visual fidelity, and seamless operation within the AWS Free Tier.

### Development Process & Key Decisions
1. **Frontend Architecture**: Built a Single Page Application (SPA) using **Vite + React** with a modern dark theme, glassmorphic control panels, and interactive step-by-step progress tracking loaders.
2. **Serverless API Layer**: Utilized **AWS Lambda** with Python 3.13 and **Lambda Function URLs**. Using a Function URL provided a direct, low-latency HTTPS endpoint with built-in CORS handling without the added complexity of API Gateway.
3. **Generative AI Engine**: Integrated **Amazon Bedrock**:
   - **Amazon Nova Lite (`amazon.nova-lite-v1:0`)** via the Bedrock Converse API to convert user premises into clean, structured JSON comic scripts.
   - **Amazon Nova Canvas (`amazon.nova-canvas-v1:0`)** via `invoke_model` to generate high-resolution panel illustrations.

---

## 🌩️ AWS Services Used & Architecture Overview

```
                        +---------------------------------------+
                        |  React / Vite Single Page Application |
                        |        (http://localhost:5173)        |
                        +---------------------------------------+
                                            |
                                            | (HTTPS POST / Fetch)
                                            v
                        +---------------------------------------+
                        |        AWS Lambda Function URL        |
                        |             (CORS Enabled)            |
                        +---------------------------------------+
                                            |
                  +-------------------------+-------------------------+
                  |                         |                         |
                  v                         v                         v
       +--------------------+    +--------------------+    +--------------------+
       |   Amazon Bedrock   |    |     Amazon S3      |    |  Amazon DynamoDB   |
       |  (Nova Lite &      |    |  (Image Asset      |    |  (Public Gallery   |
       |   Nova Canvas)     |    |   Hosting Bucket)  |    |   NoSQL Table)     |
       +--------------------+    +--------------------+    +--------------------+
```

### AWS Services Breakdown:
- **AWS Lambda**: Executes core backend API actions (`generate_story`, `generate_image`, `save_comic`, `list_comics`).
- **Lambda Function URL**: Provides a secure public HTTPS endpoint configured with cross-origin resource sharing (CORS).
- **Amazon Bedrock**: Powering narrative creation with Amazon Nova Lite and visual artwork with Amazon Nova Canvas.
- **Amazon S3**: Hosts generated PNG panel illustrations with pre-signed URL capabilities for secure browser rendering.
- **Amazon DynamoDB**: A `SimpleTable` storing comic metadata, prompt details, panel structure, and creation timestamps for the public gallery.
- **AWS SAM (Serverless Application Model)**: Infrastructure-as-code tool used to define, build, and deploy the entire backend stack non-interactively.

---

## 🔧 Engineering Challenges Encountered & Overcome

Building an end-to-end serverless AI application involved solving four major technical hurdles:

### 1. CloudFormation Early Validation CORS Enum Error
* **Challenge**: When deploying our `template.yaml`, CloudFormation rejected `Cors.AllowMethods` because `OPTIONS` was included in the array. CloudFormation property validation strictly limits values to `[GET, PUT, HEAD, POST, PATCH, DELETE, *]`.
* **Solution**: We updated `template.yaml` to specify the wildcard `*` under `AllowMethods`, satisfying CloudFormation validation while permitting preflight `OPTIONS` requests.

### 2. Duplicate CORS Headers Collision
* **Challenge**: Browser requests failed with `TypeError: Failed to fetch` during initial testing.
* **Solution**: We discovered that both the AWS Lambda Function URL gateway layer AND our Python code were returning `Access-Control-Allow-Origin: *`. Browsers block requests when duplicate CORS headers exist. We stripped manual CORS headers from Python response helpers and allowed the Lambda Function URL gateway to handle header injection automatically.

### 3. Boto3 DynamoDB Decimal JSON Serialization
* **Challenge**: When querying `list_comics`, the API threw `TypeError: Object of type Decimal is not JSON serializable`. Boto3 automatically parses DynamoDB numeric fields (like `panel_number`) into `decimal.Decimal` objects, which standard Python `json.dumps()` cannot serialize.
* **Solution**: We created a custom `DecimalEncoder` class in Python:
  ```python
  class DecimalEncoder(json.JSONEncoder):
      def default(self, o):
          if isinstance(o, decimal.Decimal):
              return int(o) if o % 1 == 0 else float(o)
          return super(DecimalEncoder, self).default(o)
  ```

### 4. Resilient Architecture via Fallback Generators
* **Challenge**: In accounts where Bedrock Nova model access or authorization is pending, direct calls return `ValidationException: Operation not allowed`.
* **Solution**: We engineered a smart local fallback system. If Bedrock API calls encounter account restrictions:
  - *Text Engine*: Constructs a structured 3-panel script locally.
  - *Visual Engine*: Generates dynamic, custom vector SVG graphics encoded in base64 containing the scene details and selected style.
  This ensures the application remains 100% testable, interactive, and functional on any AWS account.

---

## 💡 What You Learned

Participating in this challenge provided deep technical insights into:
1. **Amazon Bedrock Prompt Engineering**: Crafting strict JSON output prompts to guarantee consistent API contracts between generative models and frontend user interfaces.
2. **Lambda Function URL Architecture**: Understanding the boundary between gateway-managed CORS configuration and application-level headers.
3. **Resilient Serverless Patterns**: Designing fallback paths for generative AI APIs so application UX remains seamless even during downstream rate limits or account holds.
4. **DynamoDB Data Transformation**: Managing type conversions between NoSQL Boto3 types and JSON REST payloads efficiently.

---

## 🔗 Link to App & Public Repository

* **Public GitHub Repository**: [https://github.com/Hashim-Virk/Comic-Nova](https://github.com/Hashim-Virk/Comic-Nova)
* **Live Serverless API Endpoint**: `https://svncvdmdeipl5n3ai3xsdhekdq0zhdxd.lambda-url.us-east-1.on.aws/`

---

*Built with ❤️ for the AWS Build a Creative App Weekend Challenge!*
