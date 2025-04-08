from flask import Flask,jsonify,request
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
from cloud_services.cognito.cognito_service import verify_token
import json
from io import StringIO
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.arima.model import ARIMA
import time
#logging setup for debugging and operational visibility
load_dotenv()
logging.basicConfig(level=logging.DEBUG)
app = Flask(__name__)
CORS(app)
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

# create alert service

alert_service= AlertService(
    sns_client=sns_client,
    ses_client=ses_client,
    dynamodb=dynamodb,
    mongo_db=db
)
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
    
    temperature = data.get('temperature')
    cpu_temperature = get_cpu_temperature()
    if temperature and cpu_temperature:
        normalized_data['temperature'] = round(temperature  - ((cpu_temperature - temperature) / 5.466), 2)
    else:
        normalized_data['temperature'] = temperature
        
    humidity = data.get('humidity')
    if humidity:
        HUMIDITY_CALIBRATION = 1.05
        normalized_data['humidity'] = round(humidity * HUMIDITY_CALIBRATION, 2)
        
    pressure = data.get('pressure')
    if pressure:
        normalized_data['pressure'] = round(pressure, 2)
        normalized_data['altitude'] = round(44330 * (1 - (pressure / 1013.25) ** 0.1903), 2)
        
    imu = data.get('imu', {})
    normalized_data['imu'] = {
        "acceleration": [round(val, 2) for val in imu.get('acceleration',[])],
        "gyroscope": [round(val, 2) for val in imu.get('gyroscope', [])],
        "magnetometer": [round(val, 2) for val in imu.get('magnetometer', [])]
    }
    
    return normalized_data

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
            return jsonify({"error": "Empty request body"}), 400
        
        required_keys = ["temperature", "humidity", "pressure"]
        missing_keys = [key for key in required_keys if key not in raw_data]
        if missing_keys:
            return jsonify({"error": f"Missing required keys: {missing_keys}"}), 400
        
        normalized_data = normalize_sensor_data(raw_data)
        #add time stamp
        normalized_data['timestamp'] = datetime.now()
        normalized_data['location'] = raw_data.get('location', 'Secondary System')
        
        logging.debug(f"Normalised Data: {normalized_data}")
        
        try:
            result = sensor_data_collection.insert_one(normalized_data)
            if not result.inserted_id:
                raise Exception("Failed to insert data into MongoDB")

            exceeded_thresholds = alert_service.check_thresholds(normalized_data)
            if exceeded_thresholds:
                logging.info(f"Thresholds exceeded: {exceeded_thresholds}")
                
        except Exception as e:
            logging.error(f"MongoDB insertion error: {str(e)}")
            return jsonify({"error": "Failed to insert sensor data"}), 500
        
        return jsonify({"message": "Data recieved and normalized", "data": normalized_data, "exceeded_thresholds": exceeded_thresholds}), 200
    except Exception as e:
        logging.error(f"Error in /api/sensor-data: {str(e)}")
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

# Using Titan Amazon AI agent
@app.route('/api/ai-assistant', methods=['POST'])
def ai_assistant():
    """Generates suggestions for eco friendly matierals using OpenAI"""
    try:
        # Start performance timer 
        start_time = time.time()
        data = request.json
        logging.debug(f"Recieved user query: {data}")
        user_query = data.get('query', '').strip()
        user_id = data.get('user_id', 'anonymous')
        user_location = data.get('location', 'Unknown')
        
        if not user_query:
            return jsonify({"error": "Query cannot be empty"}), 400
        
        # Log ueser interaction
        query_log = {
            "user_id": user_id,
            "query": user_query,
            "timestamp": datetime.now(),
            "location": user_location,
            "status": "processing"
        }
        log_id = query_logs_collection.insert_one(query_log).inserted_id
        
        # Fetch realtime sensor data with error handling
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
        #Get trend datafor context
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
        trend_summary = ""
        if sensor_trends:
            try:
                trend_summary += "Temperature trend:"
                if 'temperature' in sensor_trends:
                    temp_mean = sensor_trends['temperature'].get('mean', 'N/A')
                    temp_std = sensor_trends['temperature'].get('std', 'N/A')
                    trend_summary += f"Average {temp_mean:.1f} C ({temp_std:.1f} ). C"
                trend_summary += "Humidity trend: "
                if 'humidity' in sensor_trends:
                    hum_mean = sensor_trends['humidity'].get('mean', 'N/A')
                    hum_std = sensor_trends['humidity'].get('std', 'N/A')
                    trend_summary += f"Average {temp_mean:.1f} % ({hum_std:.1f}%)"
            except Exception as e:
                logging.error(f"Error formatting trends: {str(e)}")
                trend_summary = "Trend analysis unavailable."
        
        prompt = (
            f"User Query: {user_query}\n"
            f"Environmental Data Context:\n"
            f"- Temperature: {temperature_value} Celsius\n"
            f"- Humidity: {humidity_value}%\n"
            f"- IMU Data: {imu_text}\n"
            f"- Water Flow Rate: {flow_rate} L/min\n\n"
            f"- Pressure: {pressure_value} hPa\n"
            f"Trend Summary: {trend_summary}\n\n"
            "Instructions:\n"
            "1. Provide personalised advice based on environmental data above. \n"
            "2. Focus on actionable tips to reduce carbon footprint and improve efficiency.\n"
            "3. If the user asks sensor readings, provide the specific values requested"
            "4. Based on the real-time sensor data and long term trends,provide actionable,personalised advice to reduce the users carbon footprint and improve water efficiency. \n"
            "5. Avoid generic tips; instead tailor recommendations to the specific environmental conditions provided. \n"
            "6. If the water flow is 0 L/min, suggest checking leaks or usage patterns. \n"
            "7. If the temperature is above 25 degrees Celsius,suggest cooling solutions. \n"
            "8. If the user asks for temperature,humidity,imu data from the sensor please provide the information. \n"
            "9. If greeting the user, introduce yourseld as EcoBot,a carbon footprint advisor. \n"
            "10. If certain data is unavailable (marked as N/A), focus on general sustainability advice. \n"
            "11. Keep responses focused, actionable, and specfic to the environmental conditions.\n"
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
                    "stopSequences": [],
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
            ai_response = response_body.get('results', [{}])[0].get('outputText', '')
            
            # Check for empty short responses
            if not ai_response or len(ai_response.strip()) < 20:
                raise Exception("AI returned empty or too short response")
        except Exception as e:
            logging.error(f"Primary AI model error: {str(e)}", exc_info=True)
            error_message = str(e)
            
            # Fallback to simpler response generation
            try:
                # Simple rule based fallback
                ai_response = generate_fallback_response(user_query, temperature_value, humidity_value, flow_rate)
            except Exception as fallback_error:
                logging.error(f"Fallback response generation failed: {str(fallback_error)}")
                ai_response = "I aplogise, I'm having trouble processing your request at the moment. Please try again shortly."
        
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
                    "has_trends": bool(sensor_trends or water_trends)
                }
            }
        })
    except Exception as e:
        logging.error("Error in AI Assistant endpoint", exc_info=True)
        return jsonify({"error":f"Failed to process request: {str(e)}"}),500

def generate_fallback_response(query, temperature, humidity, flow_rate):
    """Generate a simple fallback response when AI service fails"""
    query = query.lower()
    
    # Simple greeting
    if any(word in query for word in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm EcoBot, you carbon footprint advisor. I can help you with eco-friendly tips and analyse your environmental data. How can I assist you today?"

    # Data request 
    if any(word in query for word in ['temperature', 'humid', 'water', 'flow', 'sensor']):
        response = "Here are your current environmental readings:\n"
        if temperature != 'N/A':
            response += f"- Temperature: {temperature} C\n"
        if humidity != 'N/A':
            response += f"- Humidity: {humidity}%\n"
        if flow_rate != 'N/A':
            response += f"- Water Flow: {flow_rate} L/min\n"
        return response
    
    # Carbon footprint
    if any(phrase in query for phrase in ['carbon', 'footprint', 'emission', 'reduce']):
        tips = [
            "Consider using energy-efficient appliances to reduce electricity consumption. ",
            "Unplug electronixs when not in use to prevent phantom energy usage.",
            "Adjust your thermostat by just 1-2 degrees to save significant energy.",
            "Use LED bulbs which consume up to 90% less energy that incadescendent bulbs.",
            "Reduce water heating costs by lowering your water heater temperature."
        ]
        return f"Here are some tips to reduce you carbon footprint:\n- " + "\n- ".join(random.sample(tips, 3))
    
    # Water conservation
    if any(word in query for word in ['water', 'conservation', 'save water']):
        if flow_rate == 0:
            return "I notice your current water flow is 0 L/min. If you're not actively using water, that's good! Here are some water conservation tips:\n- Fix leaky taps and pipes\n- Install water-efficient fixtures\n- Collect and reuse rainwater for plants\n- Run full loads in dishwashers and washing machines"
        else:
            return "Here are some water conservation tips:\n- Take shorter showers\n- Install low-flow fixtures\n- Fix leaks promptly\n- Use drough-resistant plants in your garden"
    
    # Default response
    return "I can help you reduce you environmental impact and monitor you resource usage. Feel free to ask about your sensor readings, carbon footprint reduction tips, or water conservation strategies"

# Fetch sensor data API
@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    """Read current sensor data (temperature,humidity) from SENSE HAT"""
    try:
        temperature = sensor.get_temperature()
        humidity = sensor.get_humidity()
        pressure = sensor.get_pressure()
        
        if temperature is None:
            logging.warning("Temperature reading is None.Using fallback values")
            temperature = 22.0
        
        if humidity is None:
            logging.warning("Humidity reading is None.Using fallback values")
            humidity = 50.0
                 
        
        try:
            cpu_temperature = get_cpu_temperature()
            if cpu_temperature is not None:
                normalized_temperature = temperature -((cpu_temperature - temperature) /5.466)
            else:
                logging.warning("CPU temperature is None.Using raw sensor data")
                normalized_temperature = temperature
        
        except FileNotFoundError:
            logging.warning("CPU temperature unavailable,using raw temperature")
            normalized_temperature = round(temperature,2)
        
        if pressure is None:
            logging.warning("Pressure reading is None,using fallback of 1013.25")
            pressure = 1013.25
            
        altitude   = round(44330 * (1- (pressure / 1013) ** 0.1903), 2) 
        
        imu_data = {
            "acceleration": sensor.get_accelerometer_raw() or {"x": 0, "y": 0, "z": 0},
            "gyroscope": sensor.get_gyroscope_raw() or {"x": 0, "y": 0, "z": 0},
            "magnetometer": sensor.get_compass_raw() or {"x": 0, "y": 0, "z": 0}
        } 
        
        imu_data = {
            "acceleration": [round(imu_data["acceleration"].get(key, 0), 2) for key in ["x", "y", "z"]],
            "gyroscope": [round(imu_data["gyroscope"].get(key, 0), 2) for key in ["x", "y", "z"]],
            "magnetometer": [round(imu_data["magnetometer"].get(key, 0), 2) for key in ["x", "y", "z"]],
            
        }
        normalized_temperature = round(normalized_temperature, 2)    
        humidity = round(humidity,2)
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
            
        sensor_data_collection.insert_one(sensor_data)
        
        exceeded_thresholds = alert_service.check_thresholds(sensor_data)
        if exceeded_thresholds:
            logging.info(f"Thresholds exceeded: {exceeded_thresholds}")
            
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
    
if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5000)