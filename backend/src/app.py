import json
import os
import uuid
import time
import base64
import boto3
from botocore.config import Config

# AWS Clients with extended timeouts for Bedrock generation
config = Config(read_timeout=120)
bedrock_client = boto3.client('bedrock-runtime', config=config)
s3_client = boto3.client('s3')
dynamodb_client = boto3.resource('dynamodb')

# Environment Variables
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME')
DYNAMODB_TABLE_NAME = os.environ.get('DYNAMODB_TABLE_NAME')

# Model IDs
TEXT_MODEL_IDS = ['amazon.nova-lite-v1:0', 'amazon.nova-micro-v1:0', 'us.amazon.nova-lite-v1:0', 'us.amazon.nova-micro-v1:0']
IMAGE_MODEL_IDS = ['amazon.nova-canvas-v1:0', 'us.amazon.nova-canvas-v1:0']

import decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        return super(DecimalEncoder, self).default(o)

def respond(status_code, body_data):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body_data, cls=DecimalEncoder)
    }

def handle_generate_story(body):
    prompt = body.get('prompt', '').strip()
    style = body.get('style', 'Comic Book').strip()
    
    if not prompt:
        return respond(400, {"error": "Prompt is required"})
        
    prompt_content = f"""You are a creative writer and comic book script creator. Create a fun, engaging, and creative 3-panel comic strip or short story script based on the following idea: "{prompt}".
    The visual style of the illustrations will be: "{style}".

    You MUST respond with a valid, clean JSON object ONLY. Do not include any markdown formatting like ```json or any other text before or after the JSON.
    The JSON structure must match this schema exactly:
    {{
      "title": "A catchy title for the comic",
      "panels": [
        {{
          "panel_number": 1,
          "narration": "Narration text describing the context or setting.",
          "dialogue": "Character dialogue or speech bubbles (or 'No dialogue' if none).",
          "image_prompt": "A highly detailed, descriptive image generation prompt (1-2 sentences) for an AI image generator. Incorporate the style '{style}' and describe characters, colors, background, and action clearly so there is visual consistency. Do not mention text in the image prompt."
        }},
        {{
          "panel_number": 2,
          "narration": "Narration text for the second panel.",
          "dialogue": "Dialogue/caption for the second panel.",
          "image_prompt": "A highly detailed, descriptive image generation prompt for the second panel in the style '{style}'. Focus on consistency of characters and actions."
        }},
        {{
          "panel_number": 3,
          "narration": "Narration text for the third panel.",
          "dialogue": "Dialogue/caption for the third panel.",
          "image_prompt": "A highly detailed, descriptive image generation prompt for the final panel in the style '{style}'. Provide a satisfying resolution."
        }}
      ]
    }}
    """

    messages = [
        {"role": "user", "content": [{"text": prompt_content}]}
    ]

    output_text = None
    last_error = None
    
    # Attempt real Bedrock text generation
    for model_id in TEXT_MODEL_IDS:
        try:
            print(f"Calling Bedrock Converse API with model {model_id}...")
            response = bedrock_client.converse(
                modelId=model_id,
                messages=messages,
                inferenceConfig={
                    "maxTokens": 1000,
                    "temperature": 0.8,
                    "topP": 0.9,
                }
            )
            output_text = response['output']['message']['content'][0]['text']
            break
        except Exception as e:
            print(f"Error calling text model {model_id}: {e}")
            last_error = e

    # Fallback to local story generation if Bedrock fails
    if not output_text:
        print("Bedrock text generation failed. Activating local smart fallback generator...")
        title = f"The Quest of {prompt[:20]}"
        if len(prompt) > 20:
            title += "..."
            
        comic_data = {
            "title": title.upper(),
            "panels": [
                {
                    "panel_number": 1,
                    "narration": f"Our story begins with the spark of an idea: '{prompt}'. We set the stage in {style} style.",
                    "dialogue": "We are on the verge of something amazing!",
                    "image_prompt": f"Panel 1 illustration: {prompt}, intro scene, style: {style}"
                },
                {
                    "panel_number": 2,
                    "narration": "As the quest deepens, unexpected forces shape the journey.",
                    "dialogue": "Look closer... the magic is real!",
                    "image_prompt": f"Panel 2 illustration: {prompt}, action phase, style: {style}"
                },
                {
                    "panel_number": 3,
                    "narration": "With vision and courage, a creative breakthrough concludes our brief tale.",
                    "dialogue": "The adventure is complete!",
                    "image_prompt": f"Panel 3 illustration: {prompt}, triumphant resolution, style: {style}"
                }
            ],
            "fallback": True
        }
        return respond(200, comic_data)

    # Clean up output response to extract JSON if model included markdown fences
    cleaned_text = output_text.strip()
    if cleaned_text.startswith("```"):
        lines = cleaned_text.splitlines()
        if lines[0].startswith("```json") or lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned_text = "\n".join(lines).strip()

    try:
        comic_data = json.loads(cleaned_text)
        return respond(200, comic_data)
    except Exception as e:
        print(f"Failed to parse model output as JSON: {cleaned_text}")
        return respond(500, {
            "error": "Failed to parse comic script JSON from model output",
            "raw_output": output_text
        })

def handle_generate_image(body):
    prompt = body.get('prompt', '').strip()
    panel_number = body.get('panel_number', 1)
    
    if not prompt:
        return respond(400, {"error": "Prompt is required"})

    native_request = {
        "taskType": "TEXT_IMAGE",
        "textToImageParams": {
            "text": prompt
        },
        "imageGenerationConfig": {
            "numberOfImages": 1,
            "height": 512,
            "width": 512,
            "quality": "standard"
        }
    }

    base64_image = None
    last_error = None
    
    # Attempt real Bedrock image generation
    for model_id in IMAGE_MODEL_IDS:
        try:
            print(f"Invoking Bedrock Image model {model_id}...")
            response = bedrock_client.invoke_model(
                modelId=model_id,
                body=json.dumps(native_request),
                contentType="application/json",
                accept="application/json"
            )
            model_response = json.loads(response['body'].read())
            base64_image = model_response['images'][0]
            break
        except Exception as e:
            print(f"Error invoking image model {model_id}: {e}")
            last_error = e

    # Fallback to dynamic SVG generation if Bedrock fails
    if not base64_image:
        print("Bedrock image generation failed. Activating local SVG graphic fallback...")
        
        # Color palettes based on panel index
        colors = [
            {"bg": "#1e293b", "accent": "#6366f1", "bubble": "#312e81"},
            {"bg": "#0f172a", "accent": "#a855f7", "bubble": "#581c87"},
            {"bg": "#18181b", "accent": "#ec4899", "bubble": "#831843"}
        ]
        palette = colors[(panel_number - 1) % len(colors)]
        
        # Crop prompt for preview in SVG
        prompt_preview = prompt
        if len(prompt_preview) > 35:
            prompt_preview = prompt_preview[:35] + "..."
            
        svg = f"""<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'>
            <defs>
                <linearGradient id='grad' x1='0%' y1='0%' x2='100%' y2='100%'>
                    <stop offset='0%' style='stop-color:{palette["bg"]};stop-opacity:1' />
                    <stop offset='100%' style='stop-color:#020617;stop-opacity:1' />
                </linearGradient>
            </defs>
            <rect width='100%' height='100%' fill='url(#grad)'/>
            <circle cx='256' cy='256' r='140' fill='{palette["accent"]}' opacity='0.15'/>
            <circle cx='256' cy='256' r='100' fill='{palette["accent"]}' opacity='0.25'/>
            <text x='50%' y='230' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='32' fill='#ffffff' font-weight='900' letter-spacing='2'>PANEL {panel_number}</text>
            <text x='50%' y='280' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='16' fill='{palette["accent"]}' font-weight='bold' opacity='0.9'>[CREATIVE CANVASfallback]</text>
            <rect x='40' y='360' width='432' height='60' rx='10' fill='{palette["bubble"]}' opacity='0.8' stroke='#000000' stroke-width='2'/>
            <text x='50%' y='390' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='13' fill='#ffffff' font-style='italic'>{prompt_preview}</text>
        </svg>"""
        
        base64_image = base64.b64encode(svg.encode('utf-8')).decode('utf-8')
        image_base64_data = f"data:image/svg+xml;base64,{base64_image}"
        return respond(200, {
            "image_url": "",
            "image_base64": image_base64_data,
            "fallback": True
        })

    # Save to S3 if configured
    image_url = ""
    if S3_BUCKET_NAME:
        try:
            image_bytes = base64.b64decode(base64_image)
            image_key = f"comics/{uuid.uuid4()}_panel_{panel_number}.png"
            
            print(f"Uploading image to S3 bucket {S3_BUCKET_NAME} with key {image_key}...")
            s3_client.put_object(
                Bucket=S3_BUCKET_NAME,
                Key=image_key,
                Body=image_bytes,
                ContentType='image/png'
            )
            
            # Generate pre-signed URL valid for 7 days
            image_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': S3_BUCKET_NAME, 'Key': image_key},
                ExpiresIn=604800
            )
            print(f"Generated pre-signed URL: {image_url}")
        except Exception as e:
            print(f"Failed to upload to S3 or generate presigned URL: {e}")

    return respond(200, {
        "image_url": image_url,
        "image_base64": f"data:image/png;base64,{base64_image}"
    })

def handle_save_comic(body):
    comic = body.get('comic')
    if not comic:
        return respond(400, {"error": "Comic details are required"})
        
    if not DYNAMODB_TABLE_NAME:
        return respond(500, {"error": "DynamoDB table is not configured"})

    try:
        table = dynamodb_client.Table(DYNAMODB_TABLE_NAME)
        comic_id = str(uuid.uuid4())
        created_time = str(int(time.time()))
        
        item = {
            'id': comic_id,
            'title': comic.get('title', 'Untitled'),
            'prompt': comic.get('prompt', ''),
            'style': comic.get('style', ''),
            'panels': comic.get('panels', []),
            'created_at': created_time
        }
        
        print(f"Saving comic {comic_id} to DynamoDB Table {DYNAMODB_TABLE_NAME}...")
        table.put_item(Item=item)
        return respond(200, {"success": True, "id": comic_id})
    except Exception as e:
        print(f"Failed to save comic to DynamoDB: {e}")
        return respond(500, {"error": f"Failed to save comic to DynamoDB: {str(e)}"})

def handle_list_comics(body):
    if not DYNAMODB_TABLE_NAME:
        return respond(500, {"error": "DynamoDB table is not configured"})

    try:
        table = dynamodb_client.Table(DYNAMODB_TABLE_NAME)
        print(f"Scanning table {DYNAMODB_TABLE_NAME}...")
        response = table.scan()
        items = response.get('Items', [])
        items = sorted(items, key=lambda x: x.get('created_at', '0'), reverse=True)
        return respond(200, {"comics": items})
    except Exception as e:
        print(f"Failed to scan comics from DynamoDB: {e}")
        return respond(500, {"error": f"Failed to list comics: {str(e)}"})

def lambda_handler(event, context):
    print(f"Lambda trigger event: {json.dumps(event)}")
    
    # Handle CORS preflight request
    http_method = event.get('requestContext', {}).get('http', {}).get('method', '')
    if http_method == 'OPTIONS':
        return respond(200, "")
        
    try:
        body_str = event.get('body', '{}')
        body = json.loads(body_str) if body_str else {}
        action = body.get('action')
        
        print(f"Requested action: {action}")
        
        if action == 'generate_story':
            return handle_generate_story(body)
        elif action == 'generate_image':
            return handle_generate_image(body)
        elif action == 'save_comic':
            return handle_save_comic(body)
        elif action == 'list_comics':
            return handle_list_comics(body)
        else:
            return respond(400, {"error": f"Invalid action: {action}"})
            
    except Exception as e:
        print(f"Global exception in lambda_handler: {e}")
        return respond(500, {"error": f"Internal server error: {str(e)}"})
