import json
import boto3
import os
import requests
from google.cloud import aiplatform
from vertexai.preview.vision_models import ImageGenerationModel
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
        user_prompt = body.get("userPromptVariation")

        logger.info("New Image Variation")

        image_model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-001")
        image_response = image_model.generate_images(
            prompt=user_prompt,
            aspect_ratio="1:1"
        )

        generated_image_b64 = image_response.images[0]._as_base64_string()
        response_url = {"image": f"data:image/png;base64,{generated_image_b64}"}

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
        logger.error('Error processing request: ' + str(e))
        return {
            "statusCode": 500,
            "body": json.dumps({ "error": "Internal Server Error" }),
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        }
