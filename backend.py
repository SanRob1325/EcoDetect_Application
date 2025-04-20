import pytest
from flask import Flask,jsonify,request,g
from flask_cors import CORS
import os
from dotenv import load_dotenv
from sense_hat import SenseHat
from datetime import datetime,timedelta,timezone
from pymongo import MongoClient
import logging
from alert_service import AlertService
from reports import report_routes
import boto3
from boto3.dynamodb.conditions import Key
import pandas as pd
import numpy as np
import random
import json
import math
import requests
from jose import jwt, jwk
from jose.utils import base64url_decode
from io import StringIO
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.arima.model import ARIMA
import time
import uuid
import sys
#logging setup for debugging and operational visibility
load_dotenv()
logging.basicConfig(level=logging.DEBUG)
app = Flask(__name__)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
CORS(app, resources={r"/api/*": {"origins": allowed_origins, "supports_credentials": True}}, expose_headers=["Authorization"])
app.register_blueprint(report_routes)
dynamodb = boto3.resource("dynamodb", region_name="eu-west-1")
sns_client = boto3.client("sns", region_name="eu-west-1")
ses_client = boto3.client("ses",region_name="eu-west-1")
s3_client = boto3.client('s3', region_name='eu-west-1')
bedrock_client = boto3.client('bedrock-runtime', region_name='eu-west-1')

THRESHOLD_TABLE = os.getenv("THRESHOLD_TABLE","Thresholds")
SENSOR_TABLE = dynamodb.Table(os.getenv("SENSEHAT_TABLE", "SenseHatData"))
WATER_TABLE = dynamodb.Table(os.getenv("WATER_TABLE", "WaterFlowData"))
threshold_table = dynamodb.Table(THRESHOLD_TABLE)

#Database setup in MongoDB for storing sensor data,thresholds and alert history
client = MongoClient(os.getenv("MONGO_URI"))
db = client.ecodetect
sensor_data_collection = db.sensor_data
thresholds_collection = db.thresholds
alert_history_collection = db.alert_history
water_data_collection = db.water_data
query_logs_collection = db.query_logs
CERTIFICATE_PATH = os.getenv("CERTIFICATE_PATH")
PRIVATE_KEY_PATH = os.getenv("PRIVATE_KEY_PATH")
ROOT_CA_PATH = os.getenv("ROOT_CA_PATH")

#AWS SNS setup for sending alerts
SNS_TOPIC_ARN= os.getenv("SNS_TOPIC_ARN")
SES_EMAIL_RECIPIENT = os.getenv("SES_EMAIL_RECIPIENT")
SES_EMAIL_SENDER = os.getenv("SES_EMAIL_SENDER")

# Cognito configuration
REGION = os.getenv("AWS_REGION", "eu-west-1")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
#Retrieve thresholds if the defauls are not set
thresholds = thresholds_collection.find_one()
#Sense Hat temperature, humidity, pressure    
sensor = SenseHat()
#prints thresholds for testing puposes
print(thresholds)
#SENSE-HAT is initailised for sensor readings

#threshold defaults before user adjustment
default_temperature_range = [20,25] #indoor temperature range in celsius
default_humidity_range =[30,60] #indoor ranfe in perentage
HUMIDITY_THRESHOLD_LOW = 30 #low humidity alert threshold
HUMIDITY_THRESHOLD_HIGH = 60 #high humidity alert threshold

#global variables to store latest data 
latest_co2_data = None
latest_flow_data = None
#function to get thresholds,falling back to deafts if non are set

# Fetch JWT jeys from Cognito
jwkeys_url = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
try:
    response = requests.get(jwkeys_url)
    response.raise_for_status()
    jwks = requests.get(jwkeys_url).json()

    if 'keys' not in jwks:
        logging.error("WKS response does not contain 'keys'")
        jwks = {"keys": []}
except Exception as e:
    logging.error(f"Error fetching Cognito JWKS: {str(e)}")
    jwks = {"keys": []}

class APIError(Exception):
    """Base class for API errors"""
    def __init__(self, message, status_code=400):
        self.message = message
        self.status_code = status_code
        self.error_id = f"err-{uuid.uuid4().hex[:8]}"
        super().__init__(self.message)

@app.errorhandler(APIError)
def handle_api_error(error):
    """Handler for API errors"""
    response = jsonify({
        "message": error.message,
        "error_id": error.error_id
    })
    response.status_code = error.status_code
    return response 

@app.errorhandler(Exception)
def handle_generic_exceptions(e):
    """Handler for uncaught exceptions"""
    error_id = f"err-{uuid.uuid4().hex[:8]}"
    logging.error(f"Unhandled exception [{error_id}]: {str(e)}", exc_info=True)

    # Returning a sanistised response
    return jsonify({
        "message": "An internal server error occured",
        "error_id": error_id
    }), 500

@app.after_request
def add_security_headers(response):
    """Add security headers to all responses"""
    # Content Security Policy
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; object-src 'none'"

    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'

    # Control iframe embedding
    response.headers['X-Frame-Options'] = 'DENY'

    # Enable browser XSS protection
    response.headers['X-XSS-Protection'] = '1; mode=block'

    return response 

def verify_token(token):
    """Verify the Cognito JWT token"""
    try:
        # Get the key id from the token header
        headers = jwt.get_unverified_headers(token)
        kid = headers.get('kid')  # Use get() to avoid KeyError
        if not kid:
            logging.error("No 'kid' found in token header")
            return False, None

        # Find the corresponding key in the JWKs
        key = None
        for k in jwks.get('keys', []):
            if k.get('kid') == kid:
                key = k
                break
        
        if not key:
            logging.error(f"No matching key found for kid: {kid}")
            return False, None
        
        # Get the public key
        public_key = jwk.construct(key)

        # Verify the signature
        message, encoded_signature = token.rsplit('.', 1)
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))

        # Verify the signature
        if not public_key.verify(message.encode('utf-8'), decoded_signature):
            logging.error("Token signature verification failed")
            return False, None
        
        # Verify the claims
        claims = jwt.get_unverified_claims(token)

        # Check if the token has expired
        if time.time() > claims.get('exp', 0):
            logging.error("Token has expired")
            return False, None
        
        # Check the client_id/audience - handle multiple attribute names
        client_id = claims.get('client_id') or claims.get('aud')
        if not client_id or client_id != APP_CLIENT_ID:
            logging.error(f"Invalid client_id: {client_id} != {APP_CLIENT_ID}")
            return False, None
            
        # Log successful verification
        logging.debug(f"Token verified successfully for user: {claims.get('email', 'unknown')}")
        return True, claims
    except Exception as e:
        logging.error(f"Token verification error: {str(e)}")
        return False, None

@app.before_request
def auth_middleware():
    """Middleware to verify authentication token"""
    # Log the current request path
    logging.debug(f"Request to: {request.path} with method {request.method}")

    # Skip preflight requests
    if request.method == 'OPTIONS':
        logging.debug("Skipping OPTIONS preflight request")
        return

    # Skip token verification for public endpoints
    if request.path in ['/api/health', '/api/login', '/api/sensor-data-upload', '/api/predictive-analysis','/api/debug/add-test-water-data']:
        logging.debug(f"Skipping auth for public endpoint: {request.path}")
        return
    
    # Get the token from the Authorization header
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logging.warning(f"Missing Authorization header for {request.path}")
        return jsonify({"error": "Unauthorized: Missing token"}), 401
        
    if not auth_header.startswith('Bearer '):
        logging.warning(f"Invalid Authorization format for {request.path}")
        return jsonify({"error": "Unauthorized: Invalid token format"}), 401
    
    token = auth_header.split(' ')[1]
    # Add additional debug logging
    logging.debug(f"Validating token for path: {request.path}")
    
    valid, claims = verify_token(token)

    if not valid:
        logging.warning(f"Invalid token for {request.path}")
        return jsonify({"error": "Unauthorized: Invalid token"}), 401
    
    # Store user info in the request context
    g.user = {
        "user_id": claims.get('sub', 'unknown'),
        "email": claims.get('email', 'unknown'),
        "name": claims.get('name', 'User')
    }
    
    logging.debug(f"User {g.user['email']} authenticated for {request.path}")

@app.route('/api/login', methods=['POST'])
def login():
    """Simple login endpoint for testing authentication"""
    try:
        data = request.json
        username = data.get('email') or data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({"error": "Missing email/username or password"}), 400
            
        # In a real app, you'd validate with Cognito
        # This is just a mock endpoint for testing
        return jsonify({
            "message": "Login successful",
            "note": "This is a mock endpoint. Real authentication happens client-side with Cognito."
        })
    except Exception as e:
        logging.error(f"Login error: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Near the top of your file, add a function to refresh JWKs
def refresh_jwks():
    global jwks
    jwkeys_url = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
    try:
        logging.info("Fetching Cognito JWKs...")
        response = requests.get(jwkeys_url)
        response.raise_for_status()
        jwks = response.json()

        logging.info(f"JWKs keys fetched: {[key['kid'] for key in jwks.get('keys', [])]}")
        if 'keys' not in jwks:
            logging.error("JWKs response does not contain 'keys'")
            jwks = {"keys": []}
        else:
            logging.info(f"Successfully fetched {len(jwks['keys'])} JWK keys")
    except Exception as e:
        logging.error(f"Error fetching Cognito JWKS: {str(e)}")
        jwks = {"keys": []}

# Call this at startup
refresh_jwks()

# Optional: Set up a background thread to refresh keys periodically
from threading import Thread
import time

def jwks_refresh_thread():
    while True:
        time.sleep(3600)  # Refresh every hour
        refresh_jwks()

# Start the refresh thread
Thread(target=jwks_refresh_thread, daemon=True).start()

@app.route('/api/auth-test', methods=['GET'])
def auth_test():
    """Test endpoint to verify authentication is working"""
    try:
        # This endpoint will only be accessible if auth middleware passes
        return jsonify({
            "authenticated": True,
            "user": {
                "user_id": g.user.get("user_id"),
                "email": g.user.get("email"),
                "name": g.user.get("name")
            },
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logging.error(f"Auth test error: {str(e)}")
        return jsonify({"error": str(e)}), 500
# create alert service
alert_service= AlertService(
    sns_client=sns_client,
    ses_client=ses_client,
    dynamodb=dynamodb,
    mongo_db=db
)

def validate_environment():
    """Validate critical environment variables"""
    required_vars = [
        "COGNITO_USER_POOL_ID",
        "COGNITO_APP_CLIENT_ID",
        "MONGO_URI"
    ]

    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logging.critical(f"Missing required environmen variables: {', '.join(missing)}")
        sys.exit(1)

@app.route('/api/health', methods=['GET'])
def health_check():
    """Simple check for checking enpoint API's are working"""
    return jsonify({"status": "healthy"}), 200

def calculate_carbon_footprint(data):
    """Calcualates carbon footprint"""
    footprint = 0
    if "temperature" in data:
        footprint += data["temperature"] * 0.2
    if "flow_rate" in data:
        footprint += data["flow_rate"] * 0.5
    if "altitude" in data:
        footprint += data["altitude"] * 0.1
    if "pressure" in data:
        footprint += data["pressure"] * 0.05
    
    # Vehicle movement impact
    try:
        movement_data = get_current_vehicle_movement()
        if movement_data:
            vehicle_impact = calculate_vehicle_impact(movement_data)
            footprint += vehicle_impact
    except Exception as e:
        logging.error(f"Error including vehicle data in carbon footprint: {str(e)}")
        
    return min(footprint, 100) # up to 100%

def fetch_s3_csv(bucket_name, file_key):
    "Fetch CSV file from S3 and return pandas dataframe"
    try:
        response =s3_client.get_object(Bucket=bucket_name, Key=file_key)
        content = response['Body'].read().decode('utf-8')
        df = pd.read_csv(StringIO(content))
        
        if df.empty:
            logging.warning(f"No data found in S3 for {file_key}")
        return df
    except Exception as e:
        print(f"Error fetching S3 CSV from bucket{bucket_name}/ {file_key}:{e}")
        return pd.DataFrame()

def get_long_term_sensor_trends():
    try:
        df = fetch_s3_csv('sensehat-longterm-storage', 'carbon_footprint_training_sensehat.csv')
        return df.tail(7) if not df.empty else pd.DataFrame()
    except Exception as e:
        logging.error(f"Errror fetching sensor trends: {str(e)}")
        return pd.DataFrame()

def get_long_term_water_trends():
    try:
        df = fetch_s3_csv('waterflow-longterm-storage', 'carbon_footprint_training_waterflow.csv')
        return df.tail(7) if not df.empty else pd.DataFrame()
    except Exception as e:
        logging.error(f"Errror fetching sensor trends: {str(e)}")
        return pd.DataFrame()

def get_training_data():
    df = fetch_s3_csv('training-ecodetect', 'carbon_footprint_training_combined.csv')
    return df.tail(7)
    
def normalize_sensor_data(data):
    normalized_data = {}
    
    # Handle temperature data, ensuring it's a float value
    temperature = data.get('temperature')
    if temperature is not None:
        try:
            temperature = float(temperature)
            cpu_temperature = get_cpu_temperature()
            if cpu_temperature is not None:
                normalized_data['temperature'] = round(temperature  - ((cpu_temperature - temperature) / 5.466), 2)
            else:
                normalized_data['temperature'] = round(temperature,2)
        except (ValueError, TypeError):
            logging.warning(f"Invalid temperature value: {temperature}")
            normalized_data['temperature'] = temperature
    
    # Handle humidity data, ensuring it's a float value
    humidity = data.get('humidity')
    if humidity is not None:
        try:
            humidity = float(humidity)
            HUMIDITY_CALIBRATION = 1.05
            normalized_data['humidity'] = round(humidity * HUMIDITY_CALIBRATION, 2)
        except (ValueError, TypeError):
            logging.warning(f"Invalid humidity values: {humidity}")
            normalized_data['humidity'] = humidity
    
    # Handle pressure data, ensuring it's a float value
    pressure = data.get('pressure')
    if pressure is not None:
        try:
            pressure = float(pressure)
            normalized_data['pressure'] = round(pressure, 2)
            normalized_data['altitude'] = round(44330 * (1 - (pressure / 1013.25) ** 0.1903), 2)
        except (ValueError, TypeError):
            logging.warning(f"Invalid pressure value: {pressure}")
            normalized_data['pressure'] = pressure
            normalized_data['altitude'] = 0
    # Handle IMU data processing        
    imu = data.get('imu', {})
    normalized_data['imu'] = {
        "acceleration": safely_convert_list_to_float(imu.get('acceleration', [])),
        "gyroscope": safely_convert_list_to_float(imu.get('gyroscope', [])),
        "magnetometer": safely_convert_list_to_float(imu.get('magnetometer', []))
    }
    
    return normalized_data

def safely_convert_list_to_float(data_list):
    result = []
    if isinstance(data_list, list):
        for val in data_list[:3]:# Will only take 3 values (x,y,z)
            try:
                result.append(round(float(val), 2))
            except (ValueError, TypeError):
                result.append(0.0)
        while len(result) < 3:
            result.append(0.0)
    elif isinstance(data_list, dict):
        # Handle IMU data in the case it's in {x: val, y: val, z: val} format
        for key in ['x','y','z']:
                try:
                    result.append(round(float(data_list.get(key, 0)), 2))
                except (ValueError, TypeError):
                    result.append(0.0)
    else:
        # Default to zeros if the dat ais invalid
        result = [0.0, 0.0, 0.0]
    return result

def get_default_thresholds():
    thresholds = thresholds_collection.find_one({}, {"_id":0})
    if thresholds is None:
        thresholds ={
            "temperature_range":default_temperature_range,
            "humidity_range": default_humidity_range
        }
    return thresholds

#recieves sensor data from the secondary pi
@app.route('/api/sensor-data-upload', methods=['POST'])
def receive_sensor_data():
    global latest_co2_data, latest_flow_data
    try:
        raw_data = request.json
        
        if not raw_data:
            raise APIError("Empty request body", 400)
                
        required_keys = ["room_id"]
        missing_keys = [key for key in required_keys if key not in raw_data]
        if missing_keys:
            raise APIError(f"Missing required keys: {', '.join(missing_keys)}", 400)
        
        # Normalise the data
        normalized_data = normalize_sensor_data(raw_data)

        if 'flow_rate' in raw_data:
            normalized_data['flow_rate'] = raw_data['flow_rate']
            latest_flow_data = raw_data['flow_rate']

            if raw_data.get('device_id') == 'water_sensor_pi':
                water_data = {
                    'flow_rate': raw_data['flow_rate'],
                    'room_id': raw_data.get('room_id'),
                    'device_id': raw_data.get('device_id'),
                    'location': raw_data.get('location'),
                    'timestamp': datetime.now()

                }
                water_data_collection.insert_one(water_data)

        #add time stamp and metadata
        normalized_data['timestamp'] = datetime.now()
        normalized_data['location'] = raw_data.get('location', 'Unknown Room')
        normalized_data['room_id'] = raw_data.get('room_id', 'unknown')
        normalized_data['device_id'] = raw_data.get('device_id', 'unknown')
        
        logging.debug(f"Normalised Data: {normalized_data}")
        
        try:
            # this also includes room_id in MongoDB query to allow filtering
            result = sensor_data_collection.insert_one(normalized_data)
            if not result.inserted_id:
                raise Exception("Failed to insert data into MongoDB")

            try:
                exceeded_thresholds = alert_service.check_thresholds(normalized_data)
                if exceeded_thresholds:
                    logging.info(f"Thresholds exceeded in {normalized_data['room_id']}: {exceeded_thresholds}")
            except Exception as threshold_err:
                logging.error(f"Error checking thresholds: {str(threshold_err)}")
                exceeded_thresholds = []

            # Convert MongoDB ObjectId to srting for JSON serialisation
            normalized_data_response = normalized_data.copy()
            if '_id' in normalized_data_response:
                normalized_data_response['_id'] = str(normalized_data_response['_id'])
                
        except Exception as e:
            logging.error(f"MongoDB insertion error: {str(e)}")
            return jsonify({"error": "Failed to insert sensor data"}), 500
        
        return jsonify({"message": "Data recieved and normalized", "data": normalized_data_response, "exceeded_thresholds": exceeded_thresholds}), 200
    
    except APIError:
        raise
    except Exception as e:
        logging.error(f"Error in /api/sensor-data: {str(e)}", exc_info=True)
        raise APIError("Failed to process sensor data", 500)

@app.route('/api/rooms', methods=['GET'])
def get_room_list():
    """Get list of all rooms with sensors"""
    try:
        # Distinct query to find all unique room_ids
        rooms = sensor_data_collection.distinct("room_id")
        return jsonify(rooms)
    except Exception as e:
        logging.error(f"Error getting room list: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/sensor-data/<room_id>', methods=['GET'])
def get_room_sensor_data(room_id):
    """Get sensor data for a specific room"""
    try:
        # Find the latest data for this room
        latest_data = sensor_data_collection.find_one(
            {"room_id": room_id},
            sort=[("timestamp", -1)]
        )
        
        if not latest_data:
            # If no primary collection data is being stored
            latest_data = water_data_collection.find_one(
                {"room_id": room_id},
                sort=[("timestamp", -1)]
            )
        
            if not latest_data:

                return jsonify({"error": f"No data found for room: {room_id}"}), 404
        
        # Conver ObjectId to string for serialisation
        latest_data["_id"] = str(latest_data["_id"])

        if room_id == "bathroom" and "flow_rate" not in latest_data:
            # Tries to find the recent flow rate data in the water collection
            water_data = water_data_collection.find_one(
                {"room_id": room_id},
                sort=[("timestamp", -1)]
            )

            if water_data and 'flow_rate' in water_data:
                latest_data["flow_rate"] = water_data["flow_rate"]        
        return jsonify(latest_data)
    except Exception as e:
        logging.error(f"Error in room sensor data: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
# monitoring thresholds
@app.route('/api/monitor-thresholds', methods=['POST'])
def monitor_thresholds():
    """Monitor sensor data against thresholds and trigger alerts if exceeded"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No sensor data provided"}), 400
        
        if 'location' not in data:
            data['location'] = 'API Request'
        
        exceeded_thresholds = alert_service.check_thresholds(data)
        
        return jsonify({
            "status": "Threshold check completed",
            "data": data,
            "exceeded_thresholds": exceeded_thresholds
        })
    except Exception as e:
        logging.error(f"Error in monitor_thresholds: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
#For the notfication board,for prototype purposes only fixed data is applied,for the final submission this will be integrated with AWS and AI
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    notifications = [
        {"message": "Humidity alert: 75% - It's too high"},
        {"message": "Humidity alert: 25% - It's too low"},
        {"message": "Temperature is within optimal range"},
        {"message": "CO2 levels are approaching a critical threshold"}
    ]
    return jsonify(notifications)

@app.route('/api/water-usage', methods=['GET'])
def get_water_usage():
    """Fetching latests water usage data from DynamoDB"""
    try:
        response = WATER_TABLE.query(
            KeyConditionExpression=Key('device_id').eq('WaterSensor'),
            ScanIndexForward=False,
            Limit=1
        )
        
        if not response.get('Items', []):
            return jsonify({"message": "No water usage data found "}), 404
        
        latest_item = response['Items'][0]
        payload = latest_item.get('payload', {})
        
        # Handle different payload structures
        try:
            if isinstance(payload, dict):
                # Try transformed structure first
                if 'flow_rate' in payload:
                    flow_rate = float(payload.get('flow_rate', 0))
                # Try raw DynamoDB format
                elif 'M' in payload:
                    flow_rate_attr = payload.get('M', {}).get('flow_rate', {})
                    flow_rate = float(flow_rate_attr.get('N', 0))
                else:
                    logging.error(f"Unexpected payload structure: {payload}")
                    flow_rate = 0
                # Extract timestamp and unit similarly
                if 'timestamp' in payload:
                    timestamp = payload.get('timestamp')
                elif 'M' in payload:
                    timestamp = payload.get('M', {}).get('timestamp', {}).get('S', datetime.now().isoformat())
                else:
                    timestamp = datetime.now().isoformat()
                
                if 'unit' in payload:
                    unit = payload.get('unit')
                elif 'M' in payload:
                    unit = payload.get('M', {}).get('unit', {}).get('S', "L/min")
                else:
                    unit = "L/min"
            else:
                logging.error(f"Payload is not a dictionary: {payload}")
                flow_rate = 0
                timestamp = datetime.now().isoformat()
                unit = "L/min"
        except Exception as extraction_error:
            logging.error(f"Error extracting water flow data: {extraction_error}")
            logging.error(f"Payload structure: {payload}")
            flow_rate = 0
            timestamp = datetime.now().isoformat()
            unit = "L/min"      
     
        return jsonify({
            "flow_rate": flow_rate,
            "unit": unit,
            "timestamp": timestamp
        })
    except Exception as e:
        logging.error(f"Error fetching water usage from DynamoDB: {str(e)}")
        return jsonify({"error": str(e)}), 500

def fetch_recent_sensor_data(device_id):
    """Fetch the latest data from sensor tables in dynamodDB"""
    try:
        response =SENSOR_TABLE.query(
            KeyConditionExpression=Key('device_id').eq(device_id),
            Limit=10,
            ScanIndexForward=False
        )
        
        items = response.get('Items', [])
        
        if not items:
            logging.warning(f"No sensor readings found for device_id: {device_id}")
            return []
        
        for item in items:
            item['timestamp'] = pd.to_datetime(item.get('timestamp', datetime.now().isoformat()))       
        return items
    
    except Exception as e:
        logging.error(f"Error fetching DynamoDB data: {e}", exc_info=True)
        return []

def format_sensor_values(data):
    """Format sensor data to be human readable and rounded up data"""
    formatted_data = {}

    # Formatted temperature 
    if 'temperature' in data and data['temperature'] != 'N/A':
        try:
            formatted_data['temperature'] = f"{float(data['temperature']):.1f}°C"
        except (ValueError, TypeError):
            formatted_data['temperature'] = data['temperature']
    else:
        formatted_data['temperature'] = data.get('temperature', 'N/A')

    # Format humidity
    if 'humidity' in data and data['humidity'] != 'N/A':
        try:
            formatted_data['humidity'] = f"{float(data['humidity']):.1f} %"
        except (ValueError, TypeError):
            formatted_data['humidity'] = data['humidity']
    else:
        formatted_data['humidity'] = data.get('humidity', 'N/A')
    # Format pressure
    if 'pressure' in data and data['pressure'] != 'N/A':
        try:
            formatted_data['pressure'] = f"{float(data['pressure']):.1f} hPa"
        except (ValueError, TypeError):
            formatted_data['pressure'] = data['pressure']
    else:
        formatted_data['pressure'] = data.get('pressure', 'N/A')
    # Format water usage
    if 'flow_rate' in data and data['flow_rate'] != 'N/A':
        try:
            formatted_data['flow_rate'] = f"{float(data['flow_rate']):.1f} L/min"
        except (ValueError, TypeError):
            formatted_data['flow_rate'] = data['flow_rate']
    else:
        formatted_data['flow_rate'] = data.get('flow_rate', 'N/A')
    
    return formatted_data

def robust_query_prompt(user_query, temperature_value, humidity_value, pressure_value, imu_text, flow_rate, trend_summary, vehicle_data=None, room_context=""):
    
    formatted_data = format_sensor_values({
        'temperature': temperature_value,
        'humidity': humidity_value,
        'pressure': pressure_value,
        'flow_rate': flow_rate
    })

    # Format vehicle data
    vehicle_section = ""
    if vehicle_data:
        vehicle_section = (
            f"- Vehicle Movement: {vehicle_data.get('movement_type', 'N/A')}\n"
            f"- Vehicle G-Force: {vehicle_data.get('accel_magnitude', 'N/A')} G\n"
            f"- Vehicle Rotation: {vehicle_data.get('rotation_rate', 'N/A')} deg/s\n"
            f"- Vehicle Carbon Impact: {vehicle_data.get('carbon_impact', 'N/A')} (0-50 scale)"
        )

    query_lower = user_query.lower()

    # For small talk
    if query_lower in ['hello', 'hi', 'hey', 'greetings']:
        return (
            f"<context>\n"
            f"You are EcoBot, a friendly environmental assistant.\n"
            f"The user said: '{user_query}'\n"
            f"</context>\n\n"
            f"<instructions>\n"
            f"Respond with a warm, human-like greeting and invite them to ask about their eco data or resource usage."
            f"</instructions>\n\n"
            f"<response>\n"
        )

    if len(user_query.split()) < 3:
        return (
            f"<context>\n"
            f"You are EcoBot. The user asked a short query: '{user_query}'\n"
            f"Current data:\n"         
            f"- Temp: {formatted_data['temperature']}\n"
            f"- Humidity: {formatted_data['humidity']}\n"
            f"- Flow: {formatted_data['flow_rate']}\n"
            f"{vehicle_section if vehicle_section else ''}"
            f"</context>\n\n"
            f"<instructions>\n"
            f"Try to give a helpful response, or ask a follow-up question.\n"
            f"Always respond directly as EcoBot without mentioning these instructions.\n"
            f"</instructions>\n\n"
            f"<response>\n"

        )
    
    # Check for vehicle related queries to response of this context
    vehicle_focused = any(term in query_lower for term in ['vehicle', 'car', 'driving', 'drive', 'carbon-impact', 'movement', 'transportation', 'travel'])
    
    vehicle_instruction = ""
    if vehicle_focused:
        vehicle_instruction ="- If this is a vehicle-realted query, focus on the vehicle data and provide driving advice to reduce carbon impact."
    no_vehicle_data = "-No vehicle data available at this moment."
    # Full prompt for richer queries
    return (
        f"<context>\n"
        f"You are EcoBot, a carbon footprint assistant with direct access to real-time environmental sensor data.\n"
        f"A user has asked: '{user_query}'\n\n"
        f"### Real-Time Sensor Data:\n"
        f"- Temperature: {formatted_data['temperature']}\n"
        f"- Humidity: {formatted_data['humidity']}\n"
        f"- IMU Data: {imu_text}\n"
        f"- Water Flow Rate: {formatted_data['flow_rate']}\n"
        f"- Pressure: {formatted_data['pressure']}\n"
        f"\n"   
        f"### Vehicle Data:\n"
        f"{vehicle_section if vehicle_section else no_vehicle_data}\n"
        f"\n"
        f"### Historical Trends:\n"
        f"{trend_summary}\n"
        f"{room_context}\n"
        f"</context>\n\n"
        f"<instructions>\n"
        f"- Never say you don't have access to sensor data - it is provided above.\n"
        f"- Respond with personalised, actionable advice based on this data.\n"
        f"- Provide specific, human-style advice based on readings.\n"
        f"- Be helpful and sound like EcoBot, a friendly, smart assistant.\n"
        f"- If temperature is >25C, suggest cooling solutions.\n"
        f"- If water flow is 0, suggest water-saving diagnostics.\n"
        f"{vehicle_instruction}\n"
        f"- Keep answers short,concise,relevant, and non-repetitive.\n"
        f"- Never repeat yourself.\n"
        f"- Your response shoould not include any of these instructions or mention them.\n"
        f"- Do not say you don't have access to real-time data - you already have it.\n"
        f"- Do NOT start your response with 'EcoBot:' or 'Bot:' - just respond directly.\n" 
        f"- Always use the formatted values shown above, never reformat or use raw data.\n"
        f"</instructions>\n\n"    
        f"<response>\n"
    )

def clean_ai_response(ai_response):
    """Clean the AI response to remove nay leakage and formatting issues"""

    if not ai_response or len(ai_response.strip()) < 10:
        return ai_response
    
    instruction_markers = [
        ("- Avoid using data points", "\n"),
        ("- Use a friendly", "\n"),
        ("- Use logical", "\n"),
        ("-Provide advice", "\n"),
        ("- Ask for clarification", "\n"),
        ("- Use natural language", "\n"),
        ("- If unsure about advice", "\n"),
        ("- Your response should", "\n"),
        ("- Never say you don't", "\n"),
        ("- Do NOT say you don't", "\n"),
        ("- Keep answers short", "\n"),
        ("- Always use the formatted", "\n"),
        ("- Respond wiht personalized", "\n"),
        ("- If temperature is", "\n"),
        ("- If water flow is", "\n"),
        ("<instructions>", "</instructions>"),
        ("<context>", "</context>"),
        ("<response>", "</response>")
    ]

    cleaned_response = ai_response
    # Remove instruction lines
    for marker_start, marker_end in instruction_markers:
        if marker_start in cleaned_response:
            start_pos = cleaned_response.find(marker_start)
            end_pos = cleaned_response.find(marker_end, start_pos)
            if end_pos > start_pos:
                # Removing instruction line
                cleaned_response = cleaned_response[:start_pos] + cleaned_response[end_pos+len(marker_end):]
    
    # Remove "Bot" or "EcoBot" prefixes
    bot_prefixes = ["Bot:", "EcoBot:", "AI:"]
    for prefix in bot_prefixes:
        if prefix in cleaned_response:
            cleaned_response = cleaned_response.split(prefix, 1)[1].strip()
    
    #Remove extranoeus new lines that could be created
    cleaned_response = cleaned_response.replace("\n\n\n", "\n\n")
    cleaned_response = cleaned_response.strip()

    return cleaned_response

def format_sensor_values(data):
    """Format sensor data to be human readable with proper rounding"""
    formatted_data = {}

    # Format temperature 
    if 'temperature' in data and data['temperature'] != 'N/A':
        try:
            formatted_data['temperature'] = f"{float(data['temperature']):.1f}°C"
        except (ValueError, TypeError):
            formatted_data['temperature'] = data['temperature']
    else:
        formatted_data['temperature'] = data.get('temperature', 'N/A')

    # Format humidity
    if 'humidity' in data and data['humidity'] != 'N/A':
        try:
            formatted_data['humidity'] = f"{float(data['humidity']):.1f}%"
        except (ValueError, TypeError):
            formatted_data['humidity'] = data['humidity']
    else:
        formatted_data['humidity'] = data.get('humidity', 'N/A')
    
    # Format pressure
    if 'pressure' in data and data['pressure'] != 'N/A':
        try:
            formatted_data['pressure'] = f"{float(data['pressure']):.1f} hPa"
        except (ValueError, TypeError):
            formatted_data['pressure'] = data['pressure']
    else:
        formatted_data['pressure'] = data.get('pressure', 'N/A')

    # Format flow_rate
    if 'flow_rate' in data and data['flow_rate'] != 'N/A':
        try:
            formatted_data['flow_rate'] = f"{float(data['flow_rate']):.1f} L/min"
        except (ValueError, TypeError):
            formatted_data['flow_rate'] = data['flow_rate']
    else:
        formatted_data['flow_rate'] = data.get('flow_rate', 'N/A')
    
    return formatted_data

# Using Titan Amazon AI agent
@app.route('/api/ai-assistant', methods=['POST'])
def ai_assistant():
    """Generates suggestions for eco friendly matierals using AWS Bedrock"""
    try:
        # Start performance timer 
        start_time = time.time()
        data = request.json
        logging.debug(f"Recieved user query: {data}")
        user_query = data.get('query', '').strip()
        user_id = data.get('user_id', 'anonymous')
        user_location = data.get('location', 'Unknown')

        # Extract room data if provided
        rooms_data = data.get('rooms', [])
        room_context = ""
        
        if not user_query:
            return jsonify({"error": "Query cannot be empty"}), 400
        
        # Log ueser interaction
        query_log = {
            "user_id": user_id,
            "query": user_query,
            "timestamp": datetime.now(),
            "location": user_location,
            "status": "processing",
            "rooms": [room.get('room_id') for room in rooms_data] if rooms_data else []
        }
        log_id = query_logs_collection.insert_one(query_log).inserted_id

        if rooms_data:
            room_context = "\n### Room-Specific Data:\n"
            for room_item  in rooms_data:
                room_id = room_item.get('room_id', "unknown")
                room_data = room_item.get('data', {})

                if room_data:
                    room_context += f"\n## {room_id.capitalize()} Room:\n" 
                    if 'temperature' in room_data:
                        room_context += f"- Temperature: {format_value(room_data.get('temperature'))}°C\n"
                    if 'humidity' in room_data:
                        room_context += f"- Humidity: {format_value(room_data.get('humidity'))}%\n"
                    if 'flow_rate' in room_data:
                        room_context += f"- Water Flow: {format_value(room_data.get('flow_rate'))} L/min\n"
                    if 'pressure' in room_data:
                        room_context += f"- Pressure: {format_value(room_data.get('pressure'))} hPa\n"

        # Fetch real-time sensor data with error handling
        try:
            sensor_data = sensor_data_collection.find_one(sort=[("timestamp", -1)]) or {}
            # Check data freshness aler if data is mor than an hour old
            if 'timestamp' in sensor_data:
                data_age = datetime.now() - sensor_data['timestamp']
                if data_age > timedelta(hours=1):
                    logging.warning(f"Sensor data is {data_age.total_seconds()/3600:.1f} hours old")
        except Exception as e:
            logging.error(f"Error fetching sensor data: {str(e)}")
            sensor_data = {}
        
        try:
            water_data = water_data_collection.find_one(sort=[("timestamp", -1)]) or {}
            # Also try DynamoDB if MongoDB data if its not available
            if not water_data:
                response = WATER_TABLE.query(
                    KeyConditionExpression=Key('device_id').eq('WaterSensor'),
                    ScanIndexForward=False,
                    Limit=1
                )
                if response.get('Items'):
                    water_data = response['Items'][0]
        except Exception as e:
            logging.error(f"Error fetching water data: {str(e)}")
            water_data = {}
        
        # Fetching vehicle data
        try:
            vehicle_data = get_current_vehicle_movement() or {}
            if vehicle_data:
                # Calculate carbon impact and add to vehicle data
                vehicle_data['carbon_impact'] = calculate_vehicle_impact(vehicle_data)
            else:
                # Try to get the most recent vehicle data from MongoDB database
                vehicle_record = sensor_data_collection.find_one(
                    {"room_id": "vehicle"},
                    sort=[("timestamp", -1)]
                )
                if vehicle_record and "processed_movement" in vehicle_record:
                    vehicle_data = vehicle_record["processed_movement"]
                    vehicle_data['carbon_impact'] = calculate_vehicle_impact(vehicle_data)
        except Exception as e:
            logging.error(f"Error fetching vehicle data: {str(e)}")
            vehicle_data = {}

        #Get trend data for context
        try:
            long_term_sensor = get_long_term_sensor_trends() 
            long_term_water = get_long_term_water_trends() 
            sensor_trends = long_term_sensor.describe().to_dict() if not long_term_sensor.empty else {}
            water_trends = long_term_water.describe().to_dict() if not long_term_water.empty else  {}
        except Exception as e:
            logging.error(f"Error fetching trend data: {str(e)}")
            sensor_trends = {}
            water_trends = {}
        
        # Extract specific values for promptwith error handling
        try:
            temperature_value = sensor_data.get('temperature', 'N/A')
            humidity_value = sensor_data.get('humidity', 'N/A')
            pressure_value = sensor_data.get('pressure', 'N/A')
            # Format IMU data neatly
            imu_data =sensor_data.get('imu', {})
            if isinstance(imu_data, dict):
                accel = imu_data.get('acceleration', [0, 0, 0])
                gyro = imu_data.get('gyroscope', [0, 0, 0])
                mag = imu_data.get('magnetometer', [0, 0, 0])
                imu_text = f"Acceleration: {accel}, Gyroscope: {gyro}, Magnetometer: {mag}"
            else:
                imu_text = "N/A"
            
            if isinstance(water_data, dict):
                # Try different possible structures for water flow data
                payload = water_data.get('payload', {})
                if isinstance(payload, dict):
                    if 'flow_rate' in payload:
                        flow_rate = payload.get('flow_rate', 'N/A')
                    elif 'M' in payload and 'flow_rate' in payload.get('M', {}):
                        flow_rate = payload.get('M', {}).get('flow_rate', {}).get('N', 'N/A')
                    else:
                        flow_rate = 'N/A'
                else:
                    flow_rate = 'N/A'
            else:
                flow_rate = 'N/A'
        
        except Exception as e:
            logging.error(f"Error extracting sensor values: {str(e)}")
            temperature_value = humidity_value = pressure_value = flow_rate = 'N/A'
            imu_text ="N/A"
        
        # Generate more informative trends analysis
        trend_summary = format_trend_summary(sensor_trends)
        
        prompt = robust_query_prompt(
            user_query,
            temperature_value,
            humidity_value,
            pressure_value,
            imu_text,
            flow_rate,
            trend_summary,
            vehicle_data,
            room_context
        
        )
        logging.debug(f"Generated prompt: {prompt}")
        
        # Prepare for AI model fallback
        ai_response = None
        error_message = None
        
        # Try with primary AI model
        try:
            payload = {
                "inputText": prompt,
                "textGenerationConfig": {
                    "maxTokenCount": 300,
                    "stopSequences": ["|"],
                    "temperature": 0.7,
                    "topP": 1
                }
            }
            response = bedrock_client.invoke_model(
                modelId ="amazon.titan-text-lite-v1",
                body=json.dumps(payload),
                contentType='application/json',
                accept='application/json'
            )
            response_body = json.loads(response['body'].read().decode('utf-8'))
            raw_ai_response = response_body.get('results', [{}])[0].get('outputText', '')
            
            ai_response = clean_ai_response(raw_ai_response)
            # Check for empty short responses
            if not ai_response or len(ai_response.strip()) < 20:
                raise Exception("AI returned empty or too short response")
            
        except Exception as e:
            logging.error(f"Primary AI model error: {str(e)}", exc_info=True)
            error_message = str(e)
            
            # Fallback to simpler response generation
            try:
                # Simple rule based fallback
                ai_response = generate_fallback_response(user_query, temperature_value, humidity_value, flow_rate, vehicle_data)
            except Exception as fallback_error:
                logging.error(f"Fallback response generation failed: {str(fallback_error)}")
                ai_response = "I apologise, I'm having trouble processing your request at the moment. Please try again shortly."
        
        # Log completion of the query
        execution_time = time.time() - start_time
        query_logs_collection.update_one(
            {"_id": log_id},
            {"$set":{
                "status": "completed" if ai_response else "failed",
                "response": ai_response,
                "error": error_message,
                "execution_time": execution_time
            }}
        )
        logging.info(f"AI Response generated in {execution_time:.2f}s: {ai_response[:100]}...")
        
        # Return the response with metadata
        return jsonify({
            "answer": ai_response,
            "metadata": {
                "query_id": str(log_id),
                "execution_time": execution_time,
                "data_freshness": {
                    "sensor_data": str(data_age) if 'data_age' in locals() else "unknown",
                    "has_water_data": bool(water_data),
                    "has_vehicle_data": bool(vehicle_data),
                    "has_trends": bool(sensor_trends or water_trends)
                }
            }
        })
    except Exception as e:
        logging.error("Error in AI Assistant endpoint", exc_info=True)
        return jsonify({"error":f"Failed to process request: {str(e)}"}),500

def format_value(value):
    """Format a value with proper rounding if it's a number"""
    if value is None:
        return "N/A"

    try:
        return f"{float(value):.1f}"
    except (ValueError, TypeError):
        return str(value)
    
def format_trend_summary(sensor_trends):
    """Format trend summary with proper rounding"""
    trend_summary = ""
    if sensor_trends:
        try:
            trend_summary += "Temperature trend: "
            if "temperature" in sensor_trends:
                temp_mean = sensor_trends['temperature'].get('mean', 'N/A')
                temp_std = sensor_trends['temperature'].get('std', 'N/A')
                if temp_mean != 'N/A' and temp_std != 'N/A':
                    trend_summary += f"Average {temp_mean:.1f}°C (±{temp_std:.1f}°C). "
                else:
                    trend_summary += "Data unavailable. "
            
            trend_summary += "Humidity trend: "
            if 'humidity' in sensor_trends:
                hum_mean = sensor_trends['humidity'].get('mean', 'N/A')
                hum_std = sensor_trends['humidity'].get('std', 'N/A')
                if hum_mean != 'N/A' and hum_std != 'N/A':
                    trend_summary += f"Average {hum_mean:.1f}% (±{hum_std:.1f}%)"
                else:
                    trend_summary += "Data unavailable."
        except Exception as e:
            trend_summary = "Trend analysis unavailable."
    
    return trend_summary

def generate_fallback_response(query, temperature, humidity, flow_rate, vehicle_data=None):
    """Generate a simple fallback response when AI service fails"""
    query = query.lower()
    
    formatted_data = {}
    if temperature != 'N/A':
        try:
            formatted_data['temperature'] = f"{float(temperature):.1f} °C"
        except (ValueError, TypeError):
            formatted_data['temperature'] = temperature
    else:
        formatted_data['temperature'] = 'N/A'

    #Format humidity
    if humidity != 'N/A':
        try:
            formatted_data['humidity'] = f"{float(humidity):.1f}%"
        except (ValueError, TypeError):
            formatted_data['humidity'] = humidity
    else:
        formatted_data['humidity'] = 'N/A'

    #Format flow_rate
    if flow_rate != 'N/A':
        try:
            formatted_data['flow_rate'] = f"{float(flow_rate):.1f} L/min"
        except (ValueError, TypeError):
            formatted_data['flow_rate'] = flow_rate
    else:
        formatted_data['flow_rate'] = 'N/A'  

    # Simple greeting
    if any(word in query for word in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm EcoBot, your carbon footprint advisor. I can help you with eco-friendly tips and analyse your environmental data. How can I assist you today?"

    # Vehicle data response
    if any(word in query for word in ['vehicle', 'car', 'driving', 'drive', 'transport']):
        if vehicle_data:
            movement_type = vehicle_data.get('movement_type', 'unknown')
            accel_magnitude = vehicle_data.get('accel_magnitude', 0)
            carbon_impact = vehicle_data.get('carbon_impact', 0)

            response = f"Your current vehicle data shows that you are {movement_type}"

            if movement_type == 'accelerating':
                response += f"with {accel_magnitude:.1f}G of force. Gradual acceleration can reduce your carbon footprint, which is currently {carbon_impact:.1f}/50. Try gentler acceleration for better efficiency."
            elif movement_type == "braking":
                response += f"and braking. Frequent braking increases fuel consumption. Try to anticipate stops earlier for smoother driving. Your current carbon impact is {carbon_impact:.1f}/50."
            elif movement_type == "turning_right" or movement_type == "turning_left":
                response += f"while turning. Maintain consistent speed during turns for better efficiency. Your current carbon impact is {carbon_impact:.1f}/50."
            elif movement_type == "rough_road":
                response += f"on a rough road. Rough roads can reduce fuel efficiency. Your current carbon impact is {carbon_impact:.1f}/50."
            elif movement_type == "stationary":
                response += f"with you stationary. Remember to turn off your engine when parked to reduce unnecessary emisisons. Your current carbon is {carbon_impact:.1f}/50."
            else:
                response += f"with steady movement. This is good for efficiency. You current carbon impact is {carbon_impact:.1f}/50"
        else:
            return "I don't gave your current vehicle data available, but I can offer some eco-drving tips: maintain steady speed, avoid rapid acceleration and braking, keep tires properly inflated, and reduce uneccessary idling. These habits can significantly reduce your carbon footprint."
    # Data request
    if any(word in query for word in ['temperature', 'humid', 'water', 'flow', 'sensor']):
        response = "Here are your current environmental readings:\n"
        if formatted_data['temperature'] != 'N/A':
            response += f"- Temperature: {formatted_data['temperature']} Celsius\n"
        if formatted_data['humidity'] != 'N/A':
            response += f"- Humidity: {formatted_data['humidity']} %\n"
        if formatted_data['flow_rate'] != 'N/A':
            response += f"- Water Flow: {formatted_data['flow_rate']} L/min\n"
        return response
    
    # Carbon footprint
    if any(phrase in query for phrase in ['carbon', 'footprint', 'emission', 'reduce']):
        tips = [
            "Consider using energy-efficient appliances to reduce electricity consumption. ",
            "Unplug electronics when not in use to prevent phantom energy usage.",
            "Adjust your thermostat by just 1-2 degrees to save significant energy.",
            "Use LED bulbs which consume up to 90% less energy that incandescent bulbs.",
            "Reduce water heating costs by lowering your water heater temperature."
            "Practice eco-driving by avoiding rapid acceleration and braking."
        ]
        return f"Here are some tips to reduce your carbon footprint:\n- " + "\n- ".join(random.sample(tips, 3))
    
    # Water conservation
    if any(word in query for word in ['water', 'conservation', 'save water']):
        try:
            flow_value = 0
            if flow_rate != 'N/A':
                flow_value = float(flow_rate)

            if flow_value == 0:
                return "I notice your current water flow is 0 L/min. If you're not actively using water, that's good! Here are some water conservation tips:\n- Fix leaky taps and pipes\n- Install water-efficient fixtures\n- Collect and reuse rainwater for plants\n- Run full loads in dishwashers and washing machines"
            else:
                return f"Your current water flow is {formatted_data['flow_rate']}. Here are some water conservation tips:\n- Take shorter showers\n- Install low-flow fixtures\n- Fix leaks promptly\n- Use drought-resistant plants in your garden"
        except:
            return "Here are some water conservation tips:\n- Take short showers\n- Install low-flow fixtures\n- Fix leaks promptly\n- Use drought-resistant plants in your garden"
    
    # Room comfort
    if any(word in query for word in ['comfortable', 'comfort', 'ideal', 'room']):
        try:
            temp_value = float(temperature) if temperature != 'N/A' else None
            humidity_value = float(humidity) if humidity != 'N/A' else None

            if temp_value and humidity_value:
                if temp_value > 25:
                    return f"Your room temperature is {formatted_data['temperature']}, which is a bit warm. For optimal comfort, most people prefer 20-24°C. Your humidity is {formatted_data['humidity']}. Consider opening windows or using a fan to improve comfort"
                elif temp_value < 18:
                    return f"Your room temperature is {formatted_data['temperature']}, which is a bit cool. For optimal comfort, most people prefer 20-24°C. Your humidity is {formatted_data['humidity']}. Consider adjusting you heating for better comfort."

                else:
                    return f"Your room temperature is {formatted_data['temperature']} and humidity is {formatted_data['humidity']}. These are within a comfortable range for most people.Ideal indoor conditions are typically 20-24°C with 30-60% humidity."
            else:
                return "For you optimal comfort, most people prefer room temperatures between 20-24°C with humidity levels between 30-60%"
        except:
            return "For you optimal comfort, most people prefer room temperatures between 20-24°C with humidity levels between 30-60%"
    # Default response
    return "I can help you reduce your environmental impact and monitor your resource usage. Feel free to ask about your sensor readings, carbon footprint reduction tips, or water conservation strategies"

# For getting previous historical data for the predicitve analysis
@app.route('/api/historical-data', methods=['GET'])
def get_historical_data():
    """Fetch historical data sensor data for chart visualisation"""
    try:
        # Get query parameters 
        data_type = request.args.get('data_type', 'temperature')
        days = int(request.args.get('days', 7))

        # Calculate the cutoff time based on requested days
        cutoff_time = datetime.now() - timedelta(days=days)

        # Determine the appropriate collection based on the data type
        if data_type == 'flow_rate':
            collection = water_data_collection
        else:
            collection = sensor_data_collection

        # Query for data points, limiting to reasonable amount for visualisation
        cursor = collection.find(
            {
                data_type: {"$exists": True},
                "timestamp": {"$gte": cutoff_time}
            },
            {
                "timestamp": 1,
                data_type: 1,
                "_id": 0
            }
        ).sort("timestamp", 1)

        # Process the data
        historical_data = []
        for record in cursor:
            if data_type in record and record[data_type] is not None:
                try:
                    value = float(record[data_type])
                    historical_data.append({
                        "timestamp": record["timestamp"].isoformat(),
                        "value": round(value, 2)
                    })
                except (ValueError, TypeError):
                    continue
        
        # If mongDB data is not enough or insufficient, try DynamoDB as a fallback
        if len(historical_data) < 5:
            logging.info(f"Insufficient histroical data in MongoDB, trying DynamoDB")
            # Determine the appropriate table
            if data_type == 'flow_rate':
                table = WATER_TABLE
                device_id = 'WaterSensor'
            else:
                table = SENSOR_TABLE
                device_id = os.getenv('THING_NAME2', "Main_Pi")
            
            # Query DynamoDB
            try:
                response = table.query(
                    KeyConditionExpression=Key('device_id').eq(device_id),
                    ScanIndexForward=True
                )

                for item in response.get('Items', []):
                    timestamp = item.get('timestamp')

                    # Try to extract the value
                    value = None
                    if data_type in item:
                        value = item[data_type]
                    elif 'payload' in item and isinstance(item['payload'], dict):
                        payload = item['payload']
                        if data_type in payload:
                            value = payload[data_type]
                    
                    if timestamp and value is not None:
                        try:
                            float_value = float(value)
                            historical_data.append({
                                "timestamp": timestamp,
                                "value": round(float_value, 2)
                            })
                        except (ValueError, TypeError):
                            continue
            except Exception as e:
                logging.error(f"Error fetching DynamoDB: {str(e)}")

        # Sort data by timestamp to ensure chronological order
        historical_data = sorted(historical_data, key=lambda x:x["timestamp"])

        # Sample data to prevent cahrt overcrowding if theres too many points
        if len(historical_data) > 100:
            # Take very Nth item to get around 100 points
            n = len(historical_data) // 100
            historical_data = historical_data[::n]

        return jsonify({
            "data_type": data_type,
            "historical_data": historical_data,
            "start_date": historical_data[0]["timestamp"] if historical_data else None,
            "end_date": historical_data[-1]["timestamp"] if historical_data else None,
            "point_count": len(historical_data)
        })   
    except Exception as e:
        logging.error(f"Error fetching historical data: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to fetch historical data",
            "message": str(e)
        }),500
         
# Fetch sensor data API
@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    """Read current sensor data (temperature,humidity) from SENSE HAT"""
    try:
        try:
            temperature = sensor.get_temperature()
            if temperature is None or not isinstance(temperature, (int, float)):
                logging.warning("Temperature reading is None.Using fallback values")
                temperature = 22.0
        except Exception as e:
            logging.warning(f"Error reading temperature: {str(e)}. Using fallback value")
            temperature = 22.0

        try:    
            humidity = sensor.get_humidity()
            if humidity is None or not isinstance(humidity, (int, float)):
                logging.warning("Humidity reading is None.Using fallback values")
                humidity = 50.0
        except Exception as e:
            logging.warning(f"Error reading humidity: {str(e)}. Using fallback value")
            humidity = 50.0

        try:
            pressure = sensor.get_pressure()
            if pressure is None or not isinstance(pressure, (int, float)):
                logging.warning("Pressure reading is None or invalid. Usin fallback value")
                pressure = 1013.25
        except Exception as e:
            logging.warning(f"Error reading pressure: {str(e)}. Using fallback value")
            pressure = 1013.25
                 
        # Normalise temperature on based on CPU temperature   
        try:
            cpu_temperature = get_cpu_temperature()
            if cpu_temperature is not None:
                normalized_temperature = temperature -((cpu_temperature - temperature) /5.466)
            else:
                logging.warning("CPU temperature is None.Using raw sensor data")
                normalized_temperature = temperature
        
        except FileNotFoundError:
            logging.warning("CPU temperature unavailable,using raw temperature")
            normalized_temperature = temperature
        
        #Calculate altitude
        try:
            altitude   = round(44330 * (1- (pressure / 1013) ** 0.1903), 2) 
        except Exception as e:
            logging.warning(f"Error calculating altitude: {str(e)}")
            altitude = 0
        
        # Get and format IMU data
        try:
            accel_raw = sensor.get_accelerometer_raw() or {"x": 0, "y": 0, "z": 0}
            gyro_raw = sensor.get_gyroscope_raw() or {"x": 0, "y": 0, "z": 0}
            mag_raw = sensor.get_compass_raw() or {"x": 0, "y": 0, "z": 0}

            # Remove any trailing commas to make this into tuples

            if isinstance(accel_raw, tuple):
                accel_raw = accel_raw[0]
            if isinstance(gyro_raw, tuple):
                gyro_raw = gyro_raw[0]
            if isinstance(mag_raw, tuple):
                mag_raw = mag_raw[0]
            
            # Safely extract the data and round it to 2
            imu_data = {
                "acceleration": [
                    round(float(accel_raw.get("x", 0)), 2),
                    round(float(accel_raw.get("y", 0)), 2),
                    round(float(accel_raw.get("z", 0)), 2)
                ],
                "gyroscope": [
                    round(float(gyro_raw.get("x", 0)), 2),
                    round(float(gyro_raw.get("y", 0)), 2),
                    round(float(gyro_raw.get("z", 0)), 2),
                ],
                "magnetometer": [
                    round(float(mag_raw.get("x", 0)), 2),
                    round(float(mag_raw.get("y", 0)), 2),
                    round(float(mag_raw.get("z", 0)), 2),
                ]
            
            }
        except Exception as e:
            logging.warning(f"Error processing IMU data: {str(e)}")
            imu_data = {
                "acceleration": [0.0, 0.0, 0.0],
                "gyroscope": [0.0, 0.0, 0.0],
                "magnetometer": [0.0, 0.0, 0.0]
            }

        # Ensures the final values are poerly formatted
        normalized_temperature = round(float(normalized_temperature), 2)    
        humidity = round(float(humidity),2)
        pressure = round(float(pressure), 2)
        timestamp = datetime.now()
        sensor_data = {
            "temperature":normalized_temperature,
            "humidity": humidity,
            "pressure": round(pressure, 2),
            "altitude": altitude,
            "imu": imu_data,
            "timestamp": timestamp,
            "location": "Main System"
        }

        # Save to MongoDB
        try:    
            sensor_data_collection.insert_one(sensor_data)
        except Exception as e:
            logging.error(f"Failed to insert sensor data into MongoDB: {str(e)}")
        
        # Check thresholds
        try:
            exceeded_thresholds = alert_service.check_thresholds(sensor_data)
            if exceeded_thresholds:
                logging.info(f"Thresholds exceeded: {exceeded_thresholds}")
        except Exception as e:
            logging.error(f"Error checking thresholds: {str(e)}")
            exceeded_thresholds = []
            
        sensor_data["_id"] = str(sensor_data["_id"])
        return jsonify(sensor_data)
        
    except Exception as e:
        logging.error(f"Error in /api/sensor-data: {str(e)}")
        return jsonify({"Failed to insert sensor data": str(e)}),500

@app.route('/api/carbon-footprint', methods=['GET'])
def get_calculate_footprint():
    """Returns the latests carbon footprint calculations"""        
    try:
        latest_data = sensor_data_collection.find_one(sort=[("timestamp", -1)])  
        if latest_data:
            return jsonify({
                "carbon_footprint": calculate_carbon_footprint(latest_data),
                "timestamp": latest_data["timestamp"].isoformat()
            })
        return jsonify({"message": "No carbon footprint data available"}), 404
    except Exception as e:
        logging.error(f"Error fetching carbon footprint: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
def send_sns_alert(message):
    sns_client.publish(TopicArn=SNS_TOPIC_ARN, Message=message, Subject="Threshold Alert")
        
def send_ses_email(subject, message):
    try:
        ses_client.send_email(
            Source=SES_EMAIL_SENDER,
            Destination={"ToAddresses": [SES_EMAIL_RECIPIENT]},
            Message={
                "Subject": {"Data": subject},
                "Body": {"Text": {"Data": message}}
            }
        )
        logging.info(f"SES Email Sent: {message}")
    except Exception as e:
        logging.error(f"Error sending SES email: {str(e)}")

def get_cpu_temperature():
    """Read from the systems CPU temperature to normalise SENSE-HAT readings Reference:https://www.kernel.org/doc/Documentation/thermal/sysfs-api.txt and https://emlogic.no/2024/09/step-by-step-thermal-management/"""
    file_path = "/sys/class/thermal/thermal_zone0/temp"

    try:
        with open(file_path, "r") as f:
            temp = int(f.read()) / 1000.0
        return temp
    except FileNotFoundError as e:
        logging.error(f"Unexpected error reading CPU temp: {str(e)}")
    except Exception as e:
        logging.error(f"Error reading CPU temperature: {str(e)}")
        return None
    
#Historical trends and the ranges that users can apply if the system has operated within the selcted timeframes
@app.route('/api/temperature-trends', methods=['GET'])
def get_temperature_trends():
    """Fetch temperature trends for 24 hours,7 days, or within 30 days,this supports pagination Reference:https://www.mongodb.com/community/forums/t/pagination-in-mongodb-right-way-to-do-it-vs-common-mistakes/208429"""
    try:
        range_map = {"24h": timedelta(hours=24), "7d": timedelta(days=7),"30d": timedelta(days=30)}
        range_params = request.args.get('range', '24h')
        time_delta =  range_map.get(range_params, timedelta(hours =24))
        cutoff_time = datetime.now() - time_delta
        valid_ranges = {"24h", "7d", "30d"}
        if range_params not in valid_ranges:
            return jsonify({"error": "Invalid range"}), 400
               
        trends_cursor = sensor_data_collection.find({"timestamp": {"$gte": cutoff_time}}).sort("timestamp", -1)
        trends = [{"time": trend["timestamp"].isoformat(), "temperature": trend["temperature"]} for trend in trends_cursor]
        return jsonify(trends)
    
    except Exception as e:
        logging.error(f"Error in temperature-trends {str(e)}")
        return jsonify({"error": str(e)}),500
    
@app.route('/api/set-thresholds',methods=['POST'])
def set_thresholds():
    try:
        data = request.json
        
        if not isinstance(data, dict):
            return jsonify({"error": "Invalid data format"}), 400
        
        temperature_range = data.get('temperature_range')
        humidity_range = data.get('humidity_range')
        flow_rate_threshold =data.get('flow_rate_threshold')
        
        # Validate ranges 
        if temperature_range and (not isinstance(temperature_range, list) or len(temperature_range) !=2):
            return jsonify({"error": "Temperature range must be a list of two values"}), 400
        
        if humidity_range and (not isinstance(humidity_range,list) or len(humidity_range) !=2):
            return jsonify({"error": "Humidity range must be a list of two values"})
        # Consturcting threshold
        thresholds ={}
        
        if temperature_range:
            thresholds["temperature_range"] = temperature_range
        else:
            thresholds["temperature_range"] = default_temperature_range
        
        if humidity_range:
            thresholds["humidity_range"] = humidity_range
            
        else:
            thresholds["humidity_range"] = default_humidity_range
        
        if flow_rate_threshold:
            thresholds["flow_rate_threshold"] = flow_rate_threshold
        
        # Add notiffication preferences if provided 
        if 'notification_preferences' in data:
            thresholds['notification_preferences'] = data['notification_preferences']
            
        # Store in MongoDB
        thresholds_collection.replace_one({}, thresholds,upsert=True)
        
        # Also updating in DynamoDB if used
        try:
            threshold_table.put_item(Item=thresholds)
        except Exception as e:
            logging.warning(f"Failed to update DynamoDB thresholds: {str(e)}")
            
        return jsonify({"message": "Thresholds updated successfully","thresholds":thresholds})
    except Exception as e:
        logging.error(f"Error in set thresholds: {str(e)}")
        return jsonify({"error": str(e)}),500

@app.route('/api/get-thresholds', methods=['GET'])
def get_thresholds():
    try:
        thresholds = get_default_thresholds()
        return jsonify(thresholds)
    except Exception as e:
        logging.error(f"Error in /api/get_thresholds: {str(e)}")
        return jsonify({"error": str(e)}),500
    
@app.route('/api/predictive-analysis', methods=['GET'])
def predictive_analysis():
    """Predicts future trends using ARIMA and detect anomiies with Isolation Forest"""
    try:
        data_type = request.args.get('data_type', 'temperature')
        prediction_days = int(request.args.get('days', 7))
        
        logging.info(f"Predictive anaysis for {data_type} with {prediction_days} days forecast")
        # Define data source based on data type
        if data_type == 'flow_rate':
            table = WATER_TABLE
            device_id = 'WaterSensor'
        else:
            table = SENSOR_TABLE
            device_id = os.getenv('THING_NAME2','Main_Pi')
        
        logging.info(f"Using device_id: {device_id} for {data_type} data")   
        
        # Query DynamoDB for recent data points
        df_records = []
        try:
            logging.info(f"Querying DynamoDB table for {device_id}")
            
            # Query the table for the most recent data points
            response = table.query(
                KeyConditionExpression=Key('device_id').eq(device_id),
                ScanIndexForward=False, # Order in descending order
                Limit=100 # Get more than enough data
            )
            
            items = response.get('Items', [])
            logging.info(f"Retrieved {len(items)} items from DynamoDB")
            
            if items:
                # Process DynamoDB items
                for item in items:
                    timestamp = item.get('timestamp')
                    
                    # Try extract the value directly
                    value = None
                    
                    # Direct access first
                    if data_type in item:
                        value = item[data_type]
                    
                    elif data_type.startswith('imu_') and 'imu' in item:
                        imu_data = item.get('imu')
                        if isinstance(imu_data, dict):
                            # format: imu_acceleration_x ,imu_gyroscope_y etc.
                            parts = data_type.split('_')
                            if len(parts) == 3 and parts[1] in imu_data and parts[2] in imu_data[parts[1]]  :
                                value = imu_data[parts[1]][parts[2]]
                    if timestamp and value is not None:
                        try:
                            float_value = float(value)
                            df_records.append({
                                'timestamp': timestamp,
                                'value': float_value
                            })
                        except (ValueError, TypeError):
                            logging.warning(f"Could not to convert value to float: {value}")
        except Exception as e:
            logging.error(f"DynamoDB query error: {str(e)}", exc_info=True)
        
        if not df_records:
            logging.info(f"No usable data found in DynamoDB, tring MongoDB instead")
            
            try:
                # Query MongoDB for data
                if data_type == 'flow_rate':
                    mongo_data = list(water_data_collection.find().sort("timestamp", -1).limit(100))
                else:
                    mongo_data = list(sensor_data_collection.find().sort("timestamp", -1).limit(100))    
                logging.info(f"Retrieved {len(mongo_data)} records from MongoDB")    
                
                for item in mongo_data:
                    timestamp = item.get('timestamp')
                    
                    # Try extract value
                    value = None
                    
                    # Direct access first
                    if data_type in item:
                        value = item[data_type]
                    
                    # For nested structure in imu data
                    elif data_type.startswith('imu_') and 'imu' in item:
                        imu_data = item.get('imu')
                        if isinstance(imu_data, dict):
                            # Format: imu_acceleration_x etc.
                            parts = data_type.split('_')
                            if len(parts) == 3 and parts[1] in imu_data and parts[2] in imu_data[parts[1]]:
                                value = imu_data[parts[1]][parts[2]]
                    if timestamp and value is not None:
                        try:
                            float_value = float(value)
                            df_records.append({
                                'timestamp': timestamp,
                                'value': float_value
                            })
                        except (ValueError, TypeError):
                            logging.warning(f"Could not convert MongoDB value to float: {value}")
            except Exception as e:
                logging.error(f"MongoDB query error: {str(e)}", exc_info=True)
        
        # Create DataFrame fromrecords
        df = pd.DataFrame(df_records) 
        
        if df.empty:
            return jsonify({"error": f"No {data_type} data found in any database","suggestion": "Check you device ID and that data being published correctly"}), 404
            
        # Process timestamp and sort data 
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        # log a sample of data for debugging
        logging.debug(f"Data for prediction: {df.head(3).to_dict('records')} ... {df.tail(2).to_dict('records')}")
        
        # If we  have limited data, use simple linear regression
        if df.shape[0] < 10:
            logging.warning(f"Limited data available ({df.shape[0]} points) using simple forecasting")
            
            # Add index for regression
            df['index'] = range(len(df))
            
            # Simple linear regression
            from sklearn.linear_model import LinearRegression
            X = df['index'].values.reshape(-1, 1)
            y = df['value'].values
            
            model = LinearRegression()
            model.fit(X, y)
            
            # Generate future predictions
            future_indices = np.array(range(len(df), len(df) + prediction_days)).reshape(-1, 1)
            future_values = model.predict(future_indices)
            
            # Format for response
            predictions = []
            for i, value in enumerate(future_values):
                prediction_date = (datetime.now() + timedelta(days=i+1)).strftime('%Y-%m-%d')
                predictions.append({
                    "date": prediction_date,
                    "predicted_value": round(float(value), 2)
                })
            
            # Simple anomaly detection on standard deviation
            mean_value = df['value'].mean()
            std_value = df['value'].std()
            threshold = 2.0 # 2 standard deviations
            
            anomaly_indices = df[abs(df['value'] - mean_value) > threshold * std_value].index
            
            anomalies = []
            for idx in anomaly_indices:
                anomalies.append({
                    "date": df["timestamp"].iloc[idx].strftime('%Y-%m-%dT%H:%M:%SZ'),
                    "value": round(float(df['value'].iloc[idx]), 2)
                })
        
        else:
            # Use ARIMA for prediction with sufficient data
            try:
                # Use ARIMA model with sufficient data
                arima_model = ARIMA(df['value'].astype(float), order=(1, 1, 0))
                arima_fit = arima_model.fit()
                
                
                # Generate predictions
                forecast = arima_fit.forecast(steps=prediction_days)
                
                # Formatting the response
                predictions = []
                for i, value in enumerate(forecast):
                    prediction_date = (datetime.now() + timedelta(days=i+1)).strftime('%Y-%m-%d') 
                    predictions.append({
                        "date": prediction_date,
                        "predicted_value": round(float(value), 2)
                    })     
            except Exception as e:
                logging.error(f"ARIMA prediction error: {str(e)}", exc_info=True)
                return jsonify({"error": f"Failed to generate predictions: {str(e)}"}), 500
            
            # Use IsolationGForest for anomaly detection
            try:
                # Prepare data for anomaly detection
                X = df['value'].values.reshape(-1, 1)
                
                # Train model
                iso_forest = IsolationForest(contamination=0.1, random_state=42)
                anomaly_predictions = iso_forest.fit_predict(X)
                
                # Extract animalies
                anomaly_indices = np.where(anomaly_predictions == -1)[0]
                
                # Format for response
                anomalies = []
                for idx in anomaly_indices:
                    if idx < len(df):
                        anomalies.append({
                            "date": df['timestamp'].iloc[idx].strftime('%Y-%m-%dT%H:%M:%SZ'),
                            "value": round(float(df['value'].iloc[idx]), 2)
                        })
            except Exception as e:
                logging.error(f"Anomaly detection error: {str(e)}")
                anomalies = []
        
        # Prepare final response
        response_data = {
            "data_type": data_type,
            "predictions": predictions,
            "anomalies": anomalies,
            "data_points_analysed": len(df),
            "time_range": {
                "start": df['timestamp'].min().strftime('%Y-%m-%dT%H:%M:%SZ'),
                "end": df['timestamp'].max().strftime('%Y-%m-%dT%H:%M:%SZ'),
            }
        }
        
        # Add current value
        if not df.empty:
            response_data["current_value"] = round(float(df['value'].iloc[-1]), 2)
        
        return jsonify(response_data)
    
    except Exception as e:
        logging.error(f"Predictive analysis error: {str(e)}", exc_info=True)
        return jsonify({
            "error": "Failed to perform predictive analysis",
            "message": str(e)
        }), 500
                    
@app.route('/api/notification-preferences', methods=['GET'])
def get_notification():
    try:
        # Tries MongoDB first
        thresholds = thresholds_collection.find_one({}, {"_id": 0})
        
        # If not in MongoDB try DynamoDB
        if not thresholds or 'notification_preferences' not in thresholds:
            try:
                response = threshold_table.scan()
                if response.get('Items'):
                    thresholds = response['Items'][0]
            except Exception as e:
                logging.warning(f"failed to get DynamoDB threshold: {str(e)}")
                
        notification_preferences = thresholds.get('notification_preferences', {
            "sms_enabled": True,
            "email_enabled": True,
            "critical_only": False
        })
        
        return jsonify(notification_preferences)
    
    except Exception as e:
        logging.error(f"Error getting notification preferences: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/notification-preferences', methods=['POST'])
def set_notification_preferences():
    try:
        data = request.json
        
        if not isinstance(data, dict):
            return jsonify({"error": "Invalid data foramt"}), 400
        
        # Get current thresholds
        thresholds = thresholds_collection.find_one({}) or {}
        
        # Remove MongoDB ObjectID
        if '_id' in thresholds:
            thresholds_id = thresholds.pop('_id')
        else:
            thresholds_id = None
        
        # Update notification preferences
        thresholds['notification_preferences'] = data
        
        # Update in MongoDB
        if thresholds_id:
            thresholds_collection.replace_one({"_id": thresholds_id}, thresholds)
        else:
            thresholds_collection.insert_one(thresholds)

        # Also try update in DynamoDB
        try:
            # If already in DynamoDB it should update
            threshold_table.update_item(
                Key={"id": "main"},
                UpdateExpression="SET notification_preferences = :np",
                ExpressionAttributeValues={
                    ":np":data
                }
            )
        except Exception as e:
            logging.warning(f"Failed to update DynamoDB notification preferences: {str(e)}")
        
        return jsonify({
            "message": "Notification preferences updated successfully",
            "preferences": data
        })
    except Exception as e:
        logging.error(f"Error setting notification preferences {str(e)}")
        return jsonify({"error": str(e)}), 500
@app.route('/api/create-alerts-table', methods=['GET'])
def create_alerts_table():
    try:
        # Create a new table for alerts
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        
        # Check if table exists
        existing_tables = dynamodb.meta.client.list_tables()['TableNames']
        if alert_table_name in existing_tables:
            return jsonify({
                "message": f"Table {alert_table_name} already exists",
                "status": "exists"
            })
        
        # Create the table
        table = dynamodb.create_table(
            TableName=alert_table_name,
            KeySchema=[
                {
                    'AttributeName': 'id',
                    'KeyType': 'HASH'  # Partition key
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'id',
                    'AttributeType': 'S'
                }
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        
        # Wait until the table exists
        table.meta.client.get_waiter('table_exists').wait(TableName=alert_table_name)
        
        return jsonify({
            "message": f"Table {alert_table_name} created successfully",
            "status": "created",
            "table_status": table.table_status
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#API to fetch alert history      
@app.route('/api/alerts', methods=['GET'])
def get_alerts_history():
    """Fetches all recorded alerts from DynamoDB"""
    try:
        severity = request.args.get('severity')
        
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        
        # Get recent alerts
        response = alert_table.scan(Limit=50)
        alerts = response.get('Items', [])
        
        # Filter by severity if specified
        if severity and severity != 'all':
            alerts = [alert for alert in alerts if alert.get('severity') == severity]
        
        return jsonify(alerts)
    
    except Exception as e:
        logging.error(f"Error in /api/alerts: {str(e)}")
        return jsonify({"error": str(e)}), 500
        
# Add this temporary route to your Flask app:
@app.route('/api/debug-alert-service', methods=['GET'])
def debug_alert_service():
    try:
        # Create test data that should definitely exceed thresholds
        test_data = {
            "temperature": 50,  # Way above normal threshold of 30
            "humidity": 45,
            "location": "Test Debug"
        }
        
        # Get current thresholds
        thresholds = get_default_thresholds()
        
        # Manually check if this exceeds thresholds
        temp_exceeds = test_data["temperature"] > thresholds["temperature_range"][1]
        humidity_high_exceeds = test_data["humidity"] > thresholds["humidity_range"][1]
        humidity_low_exceeds = test_data["humidity"] < thresholds["humidity_range"][0]
        
        # Try the AlertService
        exceeded_thresholds = alert_service.check_thresholds(test_data)
        
        # Force an alert insert
        test_alert = {
            "timestamp": datetime.now(),
            "sensor_data": test_data,
            "exceeded_thresholds": ["temperature_high"],
            "severity": "critical",
            "processed": True
        }
        
        result = alert_history_collection.insert_one(test_alert)
        
        return jsonify({
            "test_data": test_data,
            "thresholds": thresholds,
            "manual_check": {
                "temp_exceeds": temp_exceeds,
                "humidity_high_exceeds": humidity_high_exceeds,
                "humidity_low_exceeds": humidity_low_exceeds
            },
            "alert_service_result": exceeded_thresholds,
            "direct_insert_id": str(result.inserted_id)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
@app.route('/api/force-test-alert-dynamodb', methods=['GET'])
def force_test_alert_dynamodb():
    try:
        # Test data that exceeds temperature threshold
        test_data = {
            "device_id": "TestDevice",
            "timestamp": datetime.now().isoformat(),
            "temperature": 40,  # Exceeds threshold of 30
            "humidity": 45,
            "location": "DynamoDB Alert Test"
        }
        
        # Create an alert item for DynamoDB
        alert_item = {
            "id": f"alert-{datetime.now().timestamp()}",
            "device_id": test_data["device_id"],
            "timestamp": test_data["timestamp"],
            "sensor_data": test_data,
            "exceeded_thresholds": ["temperature_high"],
            "severity": "critical",
            "processed": True
        }
        
        # Create a DynamoDB alerts table if it doesn't exist
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        
        # Store the alert in DynamoDB
        response = alert_table.put_item(Item=alert_item)
        
        return jsonify({
            "success": True,
            "message": "Test alert created in DynamoDB",
            "alert_id": alert_item["id"],
            "dynamodb_response": str(response)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/alerts-dynamodb', methods=['GET'])
def get_alerts_dynamodb():
    try:
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        
        # Query for recent alerts - without ScanIndexForward
        response = alert_table.scan(
            Limit=10
        )
        
        alerts = response.get('Items', [])
        
        # Format alerts for the frontend
        formatted_alerts = []
        for alert in alerts:
            formatted_alert = {
                "id": alert.get("id", ""),
                "timestamp": alert.get("timestamp", ""),
                "device_id": alert.get("device_id", ""),
                "exceeded_thresholds": alert.get("exceeded_thresholds", []),
                "severity": alert.get("severity", "unknown"),
                "sensor_data": alert.get("sensor_data", {})
            }
            formatted_alerts.append(formatted_alert)
            
        return jsonify(formatted_alerts)
    except Exception as e:
        logging.error(f"Error in /api/alerts-dynamodb: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/debug-check-thresholds', methods=['GET'])
def debug_check_thresholds():
    """Debug endpoint to directly test AlertService.check_thresholds"""
    try:
        # Create test data with extreme values
        test_data = {
            "temperature": 5,  # Should trigger temperature_low
            "humidity": 90,    # Should trigger humidity_high
            "location": "Debug Test"
        }
        
        # Get current thresholds
        thresholds = get_default_thresholds()
        
        # This is a direct test of the comparison logic
        test_temp_low = test_data["temperature"] < thresholds["temperature_range"][0]
        test_temp_high = test_data["temperature"] > thresholds["temperature_range"][1]
        test_humidity_low = test_data["humidity"] < thresholds["humidity_range"][0]
        test_humidity_high = test_data["humidity"] > thresholds["humidity_range"][1]
        
        # Test the full method
        exceeded = alert_service.check_thresholds(test_data)
        
        # Print the AlertService method for debugging
        import inspect
        check_thresholds_code = inspect.getsource(alert_service.check_thresholds)
        
        return jsonify({
            "thresholds": thresholds,
            "test_data": test_data,
            "direct_comparison_results": {
                "temperature_low": test_temp_low,
                "temperature_high": test_temp_high,
                "humidity_low": test_humidity_low,
                "humidity_high": test_humidity_high
            },
            "alert_service_result": exceeded,
            "check_thresholds_method": check_thresholds_code
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/force-create-alert', methods=['GET'])
def force_create_alert():
    try:
        # Create test data with extreme values
        test_data = {
            "temperature": 5,  # Should trigger temperature_low
            "humidity": 90,    # Should trigger humidity_high
            "location": "Debug Test"
        }
        
        # Create alert record directly
        alert_record = {
            "id": f"alert-{datetime.now().timestamp()}",
            "timestamp": datetime.now().isoformat(),
            "device_id": "TestDevice",
            "sensor_data": test_data,
            "exceeded_thresholds": ["temperature_low", "humidity_high"],
            "severity": "critical",
            "processed": True
        }
        
        # Store this directly in your database
        # For DynamoDB:
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        response = alert_table.put_item(Item=alert_record)
        
        # For MongoDB (if you're using it):
        if hasattr(db, 'alert_history'):
            db.alert_history.insert_one(alert_record)
        
        return jsonify({
            "message": "Test alert created directly",
            "alert": alert_record
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/force-create-alert-dynamo', methods=['GET'])
def force_create_alert_dynamo():
    try:
        # Create test data with extreme values
        test_data = {
            "temperature": 5,  # Should trigger temperature_low
            "humidity": 90,    # Should trigger humidity_high
            "location": "Debug Test"
        }
        
        # Create alert record directly for DynamoDB
        alert_record = {
            "id": f"alert-{datetime.now().timestamp()}",
            "timestamp": datetime.now().isoformat(),
            "device_id": "TestDevice",
            "sensor_data": test_data,
            "exceeded_thresholds": ["temperature_low", "humidity_high"],
            "severity": "critical",
            "processed": True
        }
        
        # Store this directly in DynamoDB
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        response = alert_table.put_item(Item=alert_record)
        
        return jsonify({
            "message": "Test alert created directly in DynamoDB",
            "alert": alert_record,
            "dynamodb_response": str(response)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/test-sns', methods=['GET'])
def test_sns():
    try:
        message = "This is a test alert notification from your EcoDetect system."
        response = sns_client.publish(
            TopicArn=os.getenv("SNS_TOPIC_ARN"),
            Message=message,
            Subject="EcoDetect Test Alert"
        )
        assert response.get('MessageId') is not None
        assert response.get('ResponseMetadata', {}).get('HTTPStatus') == 200
    except Exception as e:
        pytest.fail(f"SNS test failed: {str(e)}")

@app.route('/api/test-ses', methods=['GET'])
def test_ses():
    try:
        html_body = """
        <html>
        <body>
            <h1>Test Email from EcoDetect</h1>
            <p>This is a test email to verify that SES notifications are working correctly.</p>
            <p style="color: red;">If you're seeing this, email notifications are configured properly!</p>
        </body>
        </html>
        """
        
        response = ses_client.send_email(
            Source=os.getenv("SES_EMAIL_SENDER"),
            Destination={"ToAddresses": [os.getenv("SES_EMAIL_RECIPIENT")]},
            Message={
                "Subject": {"Data": "EcoDetect Test Email Alert"},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": "This is a test alert email from EcoDetect"}
                }
            }
        )
        return jsonify({
            "message": "Test email notification sent",
            "response": str(response),
            "sender": os.getenv("SES_EMAIL_SENDER"),
            "recipient": os.getenv("SES_EMAIL_RECIPIENT")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/force-alert-test', methods=['GET'])
def force_alert_test():
    test_data = {
        "temperature": 2,
        "humidity": 95,
        "location": "Force Test"
    }
    
    # Manually define what thresholds would be exceeded
    exceeded_thresholds = ["temperature_low", "humidity_high"]
    
    # Get thresholds
    thresholds = get_default_thresholds()
    
    # Direct call to alert methods
    alert_service._trigger_alerts(test_data, exceeded_thresholds, thresholds)
    alert_service._store_alert_history_dynamodb(test_data, exceeded_thresholds, thresholds)
    
    # Also create a direct alert in DynamoDB
    alert_id = f"alert-{datetime.now().timestamp()}"
    alert_item = {
        "id": alert_id,
        "device_id": "TestDevice",
        "timestamp": datetime.now().isoformat(),
        "sensor_data": test_data,
        "exceeded_thresholds": exceeded_thresholds,
        "severity": "critical"
    }
    
    alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
    alert_table = dynamodb.Table(alert_table_name)
    response = alert_table.put_item(Item=alert_item)
    
    return jsonify({
        "message": "Alert forcibly created",
        "exceeded_thresholds": exceeded_thresholds,
        "alert_id": alert_id
    })
    
@app.route('/api/simple-alert-test', methods=['GET'])
def simple_alert_test():
    try:
        # Create a simple test alert directly in DynamoDB
        alert_id = f"alert-{datetime.now().timestamp()}"
        alert_item = {
            "id": alert_id,
            "device_id": "TestDevice",
            "timestamp": datetime.now().isoformat(),
            "sensor_data": {
                "temperature": 2,
                "humidity": 95,
                "location": "Simple Test"
            },
            "exceeded_thresholds": ["temperature_low", "humidity_high"],
            "severity": "critical"
        }
        
        # Use the existing Alerts table
        alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
        alert_table = dynamodb.Table(alert_table_name)
        alert_table.put_item(Item=alert_item)
        
        return jsonify({
            "success": True,
            "message": "Simple test alert created",
            "alert_id": alert_id
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/api/test-email-alert', methods=['GET'])
def test_email_alert():
    try:
        # Get your email configuration
        sender = os.getenv("SES_EMAIL_SENDER")
        recipient = os.getenv("SES_EMAIL_RECIPIENT")
        
        if not sender or not recipient:
            return jsonify({
                "error": "Email configuration incomplete",
                "sender": sender,
                "recipient": recipient
            }), 400
        
        # Create test data
        test_data = {
            "temperature": 5,
            "humidity": 90,
            "location": "Email Test",
            "timestamp": datetime.now().isoformat()
        }
        
        # Create test thresholds and alerts
        exceeded_thresholds = ["temperature_low", "humidity_high"]
        thresholds = {
            "temperature_range": [20, 30],
            "humidity_range": [30, 60]
        }
        
        # Generate HTML email content
        html_body = alert_service._generate_html_email(
            test_data,
            exceeded_thresholds,
            thresholds
        )
        
        # Send email using SES
        response = ses_client.send_email(
            Source=sender,
            Destination={"ToAddresses": [recipient]},
            Message={
                "Subject": {"Data": "Environmental Alert: Test Alert"},
                "Body": {
                    "Html": {"Data": html_body},
                    "Text": {"Data": "Environmental alert test: Temperature too low, humidity too high"}
                }
            }
        )
        
        return jsonify({
            "success": True,
            "message": "Test email alert sent",
            "message_id": response.get("MessageId"),
            "sender": sender,
            "recipient": recipient
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/vehicle-movement', methods=['GET'])
def get_vehicle_movement():
    """Get processed vehicle movement data from IMU sensors"""
    try:
        # Read directly from SenseHat
        acceleration = sensor.get_accelerometer_raw()
        gyroscope = sensor.get_gyroscope_raw()
        magnetometer = sensor.get_compass_raw()
        
        # Conver dictionary to list format
        imu_data = {
            "acceleration": [acceleration["x"], acceleration["y"], acceleration["z"]],
            "gyroscope": [gyroscope["x"], gyroscope["y"], gyroscope["z"]],
            "magnetometer": [magnetometer["x"], magnetometer["y"], magnetometer["z"]]
        }
        
        # Processed raw IMU data into meaningful vehicle metrics
        processed_data = process_vehicle_movement(imu_data)
        processed_data["timestamp"] = datetime.now().isoformat()
        
        # Store the processed data for historical purposes
        vehicle_data = {
            "temperature": sensor.get_temperature(),
            "humidity": sensor.get_humidity(),
            "pressure": sensor.get_pressure(),
            "imu": imu_data,
            "timestamp": datetime.now(),
            "room_id": "vehicle",
            "device_id": "main_pi",
            "location": "Vehicle",
            "processed_movement": processed_data
        }
        
        # Save to database
        sensor_data_collection.insert_one(vehicle_data)
        
        return jsonify(processed_data)
    except Exception as e:
        logging.error(f"Error in vehicle movement data: {str(e)}")
        return jsonify({"error": str(e)}), 500

def process_vehicle_movement(imu_data):
    """Convert raw IMU data into meaningful vehicle movement metrics"""
    # Extract values from IMU data
    accel = imu_data.get("acceleration", [0, 0, 0])
    gyro = imu_data.get("gyroscope", [0, 0, 0])
    mag = imu_data.get("magnetometer", [0, 0, 0])
    
    # Calculate acceleration magnitude (G-Force)
    accel_magnitude = math.sqrt(sum(x*x for x in accel))
    
    # Calculate rotation rate (degrees per second)
    rotation_rate = math.sqrt(sum(x*x for x in gyro))
    
    # Determine vehical orientation roughly
    try:
        pitch = math.atan2(accel[0], math.sqrt(accel[1]**2 + accel[2]**2)) * 180 / math.pi
        roll = math.atan2(accel[1], math.sqrt(accel[0]**2 + accel[2]**2)) * 180 / math.pi
    except:
        pitch, roll = 0, 0
        
    # Vehicle heading (compass direction) which requires calibration for accuracy
    try:
        heading = math.atan2(mag[1], mag[0]) * 180 / math.pi
        if heading < 0:
            heading += 360
    except:
        heading = 0
    
    # Classify movement type
    movement_type = classify_movement(accel, gyro)
    
    return {
        "accel_magnitude": round(accel_magnitude, 2), # For total G-Force
        "rotation_rate": round(rotation_rate, 2), # degrees per second
        "orientation": {
            "pitch": round(pitch, 2), # Forward and backward til
            "roll": round(roll, 2), # Side to side tilt
            "heading": round(heading, 2) # Compass direction
        },
        "movement_type": movement_type, # Movement classification
        "raw_data": { # Original reference
            "acceleration": accel,
            "gyroscope": gyro,
            "magnetometer": mag 
        }
    }

def classify_movement(accel, gyro):
    """Classifying the type of vehicle movement based on IMU data"""
    accel_magnitude = math.sqrt(sum(x*x for x in accel))
    gyro_magnitude = math.sqrt(sum(x*x for x in gyro))
    
    # Detect sudden acceleration and breaking
    if accel[0] > 0.5: # Forawrd acceleration
        return "accelerating"
    elif accel[0] < -0.5:
        return "braking"
    
    # Detect turning
    if gyro[2] > 0.3: # Turning right
        return "turning_right"
    elif gyro[2] < -0.3: # Turning left
        return "turning_left"
    
    # Detect bumps on the road
    if abs(accel[1]) > 0.8: # Vertical acceleration
        return "rough_road"
    
    # If none of the above work, the vehicle stopped of is slow
    if accel_magnitude < 0.1:
        return "stationary"
    else:
        return "steady_movement"

@app.route('/api/vehicle-movement-history', methods=['GET'])
def get_vehicle_movement_history():
    """Get historical vehicle movement data for analysis"""
    try:
        # Get time range from query parameters from the last hour
        hours = int(request.args.get('hours', 1))
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # Find all records with IMU data in given time range
        cursor = sensor_data_collection.find(
            {
                
                "room_id": "vehicle",
                "timestamp": {"$gte": cutoff_time}
            }, 
            sort=[("timestamp", 1)]    
        )
        
        # Process and format the data
        movement_history = []
        for record in cursor:
            if "proccessed_movement" in record:
                # Use pre-processed data if available
                processed_data = record["processed_movement"]
                processed_data["timestamp"] = record["timestamp"].isoformat()
                movement_history.append(processed_data)
            elif "imu" in record:
                # Process IMU data if needed
                processed_data = process_vehicle_movement(record["imu"])
                processed_data["timestamp"] = record["timestamp"].isoformat()
                movement_history.append(processed_data)
        
        return jsonify(movement_history)
    except Exception as e:
        logging.error(f"Error in vehicle movement history: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/vehicle-carbon-impact', methods=['GET'])
def get_vehicle_carbon_impact():
    """Get carbon footprint specifically from vehicle movement"""
    try:
        # Get the latest movement data
        latest_movement = get_current_vehicle_movement()
        
        if not latest_movement:
            return jsonify({"impact": 0, "message": "No vehicle data vailable"})
        
        # Calculate impact based on movement data 
        vehicle_impact =  calculate_vehicle_impact(latest_movement)
        
        return jsonify({
            "impact": vehicle_impact,
            "timestamp": datetime.now().isoformat(),
            "movement_data": latest_movement
        })  
    except Exception as e:
        logging.error(f"Error calcualting vehicle carbon impact: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_current_vehicle_movement():
    """Get the current vehicle movement data"""
    try:
        # Read directly from SenseHat
        acceleration = sensor.get_accelerometer_raw()
        gyroscope = sensor.get_gyroscope_raw()
        magnetometer = sensor.get_compass_raw()
        
        # Convert dictionary to list format
        imu_data = {
            "acceleration": [acceleration["x"], acceleration["y"], acceleration["z"]],
            "gyroscope": [gyroscope["x"], gyroscope["y"], gyroscope["z"]],
            "magnetometer": [magnetometer["x"], magnetometer["y"], magnetometer["z"]]
        }
        
        return process_vehicle_movement(imu_data)
    except Exception as e:
        logging.error(f"Error getting current vehicle movement: {str(e)}")
        return None

def calculate_vehicle_impact(movement_data):
    """Calculate carbon impact from vehicle movement patterns"""
    if not movement_data:
        return 0
    
    impact = 0
    
    # Base impact from acceleration
    accel_magnitude = movement_data.get("accel_magnitude", 0)
    impact += accel_magnitude * 1.5
    
    # Additional imapct based on movement type
    movement_type = movement_data.get("movement_type","")
    if movement_type == "accelerating":
        impact += 2.0 # Acceleration uses more fuel
    elif movement_type == "braking":
        impact += 1.0 # Frequent breking indicates inefficient driving
    elif movement_type == "rough_road":
        impact += 0.8 # Rough roads can decrease effciency of movement
        
    # Rationalises the impact on the environment at 50%
    return min(impact, 50)

    
if __name__ == '__main__':
    validate_environment()
    app.run(host='0.0.0.0',port=5000)