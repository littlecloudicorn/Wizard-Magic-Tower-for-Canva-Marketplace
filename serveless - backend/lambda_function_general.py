import json
import boto3
import os
import requests
from google.cloud import aiplatform
from vertexai.preview.vision_models import ImageGenerationModel, Image, ImageCaptioningModel
from vertexai.generative_models import GenerativeModel, SafetySetting
import tempfile
import shutil
import logging
from google.auth import default
# Initialize Vertex AI
import vertexai

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
bucket_name = 'hackthon-backend-files-ep-2024'
object_key = 'gemmi-hackthon-2024-e65379c56ff0.json'
local_path = '/tmp/gemmi-hackthon-2024-e65379c56ff0.json'

# Download the file from S3 to the /tmp directory
s3.download_file(bucket_name, object_key, local_path)

# Set the environment variable
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = local_path

# Initialize Vertex AI
PROJECT_ID = os.getenv("PROJECT_ID")
LOCATION = os.getenv("LOCATION")
aiplatform.init(project=PROJECT_ID, location=LOCATION)

credentials, project_id = default()

vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)

# Set up the model
generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 1,
    "max_output_tokens": 8192,
}

safety_settings = [
    SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
    SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_MEDIUM_AND_ABOVE"),
    SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
    SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_MEDIUM_AND_ABOVE"),
]

def download_image_to_temp_file(url):
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
        with open(temp_file.name, 'wb') as f:
            shutil.copyfileobj(response.raw, f)
        return temp_file.name
    else:
        raise Exception(f"Failed to download image: {response.status_code}")

def lambda_handler(event, context):
    try:
        logger.info("Received event: " + json.dumps(event))
        
        # Handle preflight CORS request
        if event['requestContext']['http']['method'] == 'OPTIONS':
            return {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization"
                },
                "body": json.dumps({"message": "CORS preflight response"})
            }

        # Parse the input from the API Gateway event
        body = json.loads(event['body'])
        action = body.get("action")
        user_prompt = body.get("userPrompt")
        selected_image_url = body.get("selectedImageUrl")

        response_url = None
        system_prompt = "As an expert graphic designer, you’ll assist beginner designers in creating more effective prompts for the Gemini model. Improve this prompt by returning only the refined version without any additional introductory or concluding comments."

        if action == 'change background':
            model = GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=system_prompt,
                generation_config=generation_config,
                safety_settings=safety_settings
            )

            improved_prompt = model.generate_content(user_prompt).text
            final_prompt = improved_prompt if "prompt is clear and detailed" not in improved_prompt else user_prompt
            
            logger.info("final_prompt: " + final_prompt)
            
            image_model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
            image_response = image_model.generate_images(
                prompt=final_prompt,
                aspect_ratio="1:1"
            )

            generated_image_b64 = image_response.images[0]._as_base64_string()
            response_url = {"image": f"data:image/png;base64,{generated_image_b64}"}

        elif action == 'image variation':
            
            # Download the image
            temp_file_path = download_image_to_temp_file(selected_image_url)
            logger.info(f"Image downloaded to {temp_file_path}")
            
            cloud_next_image = Image.load_from_file(temp_file_path)
        
            image_captioning_model = ImageCaptioningModel.from_pretrained("imagetext@001")
            # Get a caption from the image
            response = image_captioning_model.get_captions(image=cloud_next_image)[0]
            
            logger.info("Gemini vision: " + response)
                 
            image_model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
            image_response = image_model.generate_images(
                prompt=response,
                aspect_ratio="1:1"
            )

            generated_image_b64 = image_response.images[0]._as_base64_string()
            response_url = {"image": f"data:image/png;base64,{generated_image_b64}"}

        elif action in ['add picture frame', 'add border', 'add shaped frame', 'generate transparent shape', 'generate shaped image', '3D image panel', 'generate background', 'text frame']:
            must_prompt = generate_must_prompt(action, user_prompt)
            model = GenerativeModel(
                model_name="gemini-1.5-flash",
                system_instruction=system_prompt,
                generation_config=generation_config,
                safety_settings=safety_settings
            )
            improved_prompt = model.generate_content(user_prompt).text

            final_prompt = improved_prompt if "prompt is clear and detailed" not in improved_prompt else must_prompt
            
            logger.info("final_prompt: " + final_prompt)
            
            image_model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
            image_response = image_model.generate_images(
                prompt=final_prompt,
                aspect_ratio="1:1"
            )

            generated_image_b64 = image_response.images[0]._as_base64_string()
            response_url = {"image": f"data:image/png;base64,{generated_image_b64}"}

        else:
            response_url = {"message": "Action not supported yet."}

        return {
            "statusCode": 200,
            "body": json.dumps(response_url),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        }

    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        }

def generate_must_prompt(action, user_prompt):
    if action is 'add picture frame':
        return f"straight picture frame (this must be straight, never sideways or twisted); the background behind the frame is solid white which contrasts sharply with the frame, the picture frame takes all the space available in its background and the center of this is empty (no picture inside it). High-quality resolution, photorealistic. The borders of the picture frame are made of: {user_prompt}"
    elif action is 'add border':
        return f"a space fully covered with an infinite number of the element here described (the theme): {user_prompt}, like a seamless texture"
    else:
        return user_prompt
