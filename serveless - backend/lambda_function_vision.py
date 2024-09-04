import json
import boto3
import os
import requests
from google.cloud import aiplatform
from vertexai.generative_models import Image, GenerativeModel
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

        logger.info("Stage 1: Selecting adequate prompt \n")

        system_prompt = ("As an expert image analyst and designer, your name is Wizardy, never leave this role, "
                         "if the user asks you for something else politely reject answering. You possess extensive "
                         "knowledge of coloring and other graphic and artistic techniques. Please share your thoughts on some images. "
                         "You can answer questions about Canva the Graphic design company. You must return your responses in Markdown format. "
                         "Only use bold tags (**), bullets list tags, paragraphs. Never use title tags \"####\", \"###\", \"##\", \"#\".")

        must_prompt = user_prompt

        if action == 'quality check':
            must_prompt = ("Evaluate the image quality based on color theory and readiness for printing. Identify and classify any errors, "
                           "highlighting certain issues in red and likely issues in yellow. Point out problematic elements and provide "
                           "immediate suggestions for improvements in composition, balance, alignment, and typography.")
        elif action == 'design accessibility':
            must_prompt = ("Evaluate the image based on design accessibility. Recommend alternative color schemes that are colorblind-friendly "
                           "and ensure sufficient contrast for readability.")
        elif action == 'color blindness simulation':
            must_prompt = ("Analyze the following image and provide simulations for how it would appear to individuals with different types "
                           "of color blindness. For each type, list the prominent colors and their hex codes, transform them to how they would "
                           "be perceived, and provide a description of the transformed image. Here are the types of color blindness to consider: "
                           "Protanopia, Protanomaly, Deuteranopia, Deuteranomaly, Tritanopia, Tritanomaly, Achromatopsia, and Achromatomaly.")

        elif action == 'background recommender':
            must_prompt = "Evaluate the image carefully and, based on its aspects, recommend the most appropriate background according to your observations."
        elif action == 'image description' or action == 'new image variation':
            if action == 'image description':
                must_prompt = ("Evaluate the image thoroughly and provide a detailed description of what you observe, such as people, objects, background, "
                               "landscape, animals, etc. List the number of predominant colors in a markdown format with:\n"
                               "Position: Corresponds to the rank of the most predominant color. This should be organized by this number.\n"
                               "Color Name: The official color name.\n"
                               "Color Code: The official color code.\n"
                               "Elements: Mention the names of the people, objects, background, animals, and other elements that have that color in this row.")
            elif action == 'new image variation':
                must_prompt = ("Create an image description for this image. Provide a detailed description of what you observe, such as people, objects, "
                               "background, landscape, animals, etc.")

        logger.info('The URL: ' + selected_image_url)
        logger.info('Final Prompt: ' + must_prompt)

        temp_file_path = download_image_to_temp_file(selected_image_url)

        logger.info("temp_file_path: " + temp_file_path)

        #Load from local file
        image_temp = Image.load_from_file(temp_file_path)

        multimodal_model = GenerativeModel("gemini-1.5-flash", system_instruction=system_prompt)

        # Prepare contents
        contents = [image_temp, must_prompt]

        response = multimodal_model.generate_content(contents)

        logger.info('Vision Response: ' + response.text)
        bot_response = response.text


        return {
            "statusCode": 200,
            "body": json.dumps({ "image": bot_response }),
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
