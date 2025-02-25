from flask import Flask,jsonify,request
from flask_cors import CORS
import os
from dotenv import load_dotenv
from sense_hat import SenseHat
from datetime import datetime,timedelta,timezone
from pymongo import MongoClient
import logging
import boto3
import pandas as pd
from cloud_services.cognito.cognito_service import verify_token
import json
from io import StringIO
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.arima.model import ARIMA
#logging setup for debugging and operational visibility
load_dotenv()
logging.basicConfig(level=logging.DEBUG)
app = Flask(__name__)
CORS(app)

dynamodb = boto3.resource("dynamodb", region_name="eu-west-1")
sns_client = boto3.client("sns", region_name="eu-west-1")
ses_client = boto3.client("ses",region_name="eu-west-1")
s3_client = boto3.client('s3', region_name='eu-west-1')
bedrock_client = boto3.client('bedrock-runtime', region_name='eu-west-1')
SENSOR_TABLE = os.getenv("SENSOR_TABLE", "WaterFlowData")
THRESHOLD_TABLE = os.getenv("THRESHOLD_TABLE","Thresholds")
sensor_table = dynamodb.Table(SENSOR_TABLE)
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
sns_client = boto3.client('sns',region_name='eu-west-1')
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
        return df if not df.empty else pd.DataFrame()
    except Exception as e:
        print(f"Error fetching S3 bucket{bucket_name}:{e}")
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

def trigger_humidity_alert(humidity_value):
    """Send a humidity alert to AWS SNS subscribers. references to AWS SNS are within the requirements document"""
    message = f"Humidity Alert: Current level is {humidity_value}%. Check you environment heating"
    sns_client.publish(
        TopicArn =SNS_TOPIC_ARN,
        Message=message,
        Subject="Humidity Alert"
    )
    #logs alert to the database
    alert_history_collection._insert_one({
        "message": message,
        "type": "critical" if humidity_value < HUMIDITY_THRESHOLD_LOW or humidity_value > HUMIDITY_THRESHOLD_HIGH else "warning",
        "date": datetime.now()
    })
#recieves sensor data from the secondary pi
@app.route('/api/sensor-data', methods=['POST'])
def recieve_sensor_data():
    global latest_co2_data, latest_flow_data
    try:
        raw_data = request.json
        normalized_data = normalize_sensor_data(raw_data)
        #add time stamp
        normalized_data['timestamp'] = datetime.now()
        
        sensor_data_collection._insert_one(normalized_data)
        return jsonify({"message": "Data recieved and normalized", "data": normalized_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

#monitor humidity to trigger alerts   
@app.route('/api/humidity',methods=['POST'])
def monitor_humidity():
    """Monitor and alert humidity levels which will return a JSON response of the alert status"""
    try:
        data = request.get_json()
        humidity = data.get('humidity')
        if humidity is None:
            return jsonify({"error": "No humidity value provided"}), 400
        
        if humidity < HUMIDITY_THRESHOLD_LOW or humidity > HUMIDITY_THRESHOLD_HIGH:
            trigger_humidity_alert(humidity)
        return jsonify({"status": "Humidity check completed","humidity": humidity})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
#API to fetch alert history      
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """Fetches all recorded alerts from the database"""
    try:
        alerts = list(alert_history_collection.find({}, {"_id": 0}).sort("date",-1))
        return jsonify(alerts)
    except Exception as e:
        logging.error(f"Error in /api/alerts: {str(e)}")
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
        response = sensor_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('device_id').eq('WaterSensor'),
            ScanIndexForward=False,
            Limit=1
        )
        
        if not response['Items']:
            return jsonify({"message": "No water usage data found "}), 404
        
        latest_item = response['Items'][0]
        payload = latest_item.get('payload', {}).get('M', {})
        
        flow_rate = float(payload.get('flow_rate', {}).get('N', 0))
        timestamp = payload.get('timestamp', {}).get('S', "")
        unit = payload.get('unit', {}).get('S', "L/min")
        
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
        response =sensor_table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('device_id').eq(device_id),
            Limit=10,
            ScanIndexForward=False
        )
        
        if not response['Items']:
            logging.warning(f"No sensor readings found for device_id: {device_id}")
            return []
        
        for item in response['Items']:
            if 'timestamp' in item:
                item['timestamp'] = pd.to_datetime(item['timestamp'])        
        return response['Items']
    
    except Exception as e:
        logging.error(f"Error fetching DynamoDB data: {e}", exc_info=True)
        return []

#for prototype purposes the AI assitant uses a chagpt API for responses and queries,for the time being,for the final submission SAgeMaker handles AI processes
@app.route('/api/ai-assistant', methods=['POST'])
def ai_assistant():
    """Generates suggestions for eco friendly matierals using OpenAI"""
    try:
        data = request.json
        logging.debug(f"Recieved user query: {data}")
        user_query = data.get('query', '').strip()
        
        if not user_query:
            return jsonify({"error": "Query cannot be empty"}), 400
        
        sensor_data = sensor_data_collection.find_one(sort=[("timestamp", -1)]) or {}
        water_data = water_data_collection.find_one(sort=[("timestamp", -1)]) or {}
        long_term_sensor = get_long_term_sensor_trends() 
        long_term_water = get_long_term_water_trends() 
        
        imu_data =sensor_data.get('imu', {})
        imu_text = f"Acceleration: {imu_data.get('acceleration', 'N/A')}, Gyroscope: {imu_data.get('gyroscope', 'N/A')}, Magnetometer: {imu_data.get('magnetometer', 'N/A')}"
        
        sensor_trends = json.dumps(long_term_sensor.describe().to_dict(), indent=2) if not long_term_sensor.empty else 'N/A'
        water_trends = json.dumps(long_term_water.describe().to_dict(), indent=2) if not long_term_water.empty else 'N/A'
        
        prompt = (
            f"User Query: {user_query}\n"
            f"Real-Time Sensor Data: Temperature: {sensor_data.get('temperature', 'N/A')} Celsius\n"
            f"Humidity: {sensor_data.get('humidity', 'N/A')}%, IMU: {sensor_data.get('imu', {})}%\n"
            f"IMU Data: {imu_text}\n"
            f"Real-Time Water Flow: {water_data.get('payload', {}).get('flow_rate', {}).get('N', 'N/A')} L/min\n\n"
            f"Long-Term Sensor Trends: {sensor_trends}\n"
            f"Long-Term Water Trends: {water_trends}\n\n"
            "Based on the real-time sensor data and long term trends,provide actionable,personalised advice to reduce the users carbon footprint and improve water efficiency"
            "Avoid generic tips; instead tailor recommendations to the specific environmental conditions provided"
            "If the water flow is 0 L/min, suggest checkin leafs or usage patterns"
            "If the temperature is above 25 degrees Celsius,suggest cooling solutions"
            "If the user asks for temperature,humidity,imu data from the sensor please provide the information"
            "Say Hello to the user if they enter Hello and intoduce yourself as the EcoBot which is a carbon footprint advisor"
        )
        logging.debug(f"Generated prompt: {prompt}")
        
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
        logging.debug(f"Bedrock raw response: {response_body}")
        answer = response_body.get('results',[{}])[0].get('outputText','No response generated.')
        logging.error(f"Validation error response: {response['body'].read().decode('utf-8')}")
       
        logging.info(f"AI Response: {answer}")
        return jsonify({"answer": answer})
    
    except Exception as e:
        logging.error("Error invoking Bedrock model", exc_info=True)
        return jsonify({"error":f"Failed to process request: {str(e)}"}),500

#fetch sensor data API
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
            "timestamp": timestamp
        }
            
        sensor_data_collection.insert_one(sensor_data)
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
        ses_client.email(
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
        temperature_range = data.get('temperature_range',default_temperature_range)
        humidity_range = data.get('humidity_range',default_humidity_range)

        thresholds ={
            "temperature_range": temperature_range,
            "humidity_range": humidity_range
                
        }
    
        thresholds_collection.replace_one({}, thresholds,upsert=True)
        return jsonify({"message": "Thresholds updated successfully"})
    except Exception as e:
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
        
        historical_df = get_long_term_sensor_trends()
        recent_data = fetch_recent_sensor_data('Main_Pi')
        recent_df = pd.DataFrame(recent_data) 

        if 'timestamp' not in historical_df.columns or data_type not in historical_df.columns:
            return jsonify({"error": "Historical data missing required columns"}), 400
        
        if 'timestamp' in recent_df.columns:
            recent_df['timestamp'] = pd.to_datetime(recent_df['timestamo'])
            
        combined_df = pd.concat([historical_df, recent_df], ignore_index=True)
        
        if combined_df.empty or data_type not in combined_df.columns:
            return jsonify({"error": "Insufficient data for analysis"}), 400
        
        combined_df['timestamp'] = pd.to_datetime(combined_df['timestamp'])
        combined_df.sort_values('timestamp', inplace=True)
        
        data_payload = combined_df[['timestamp', data_type]].to_dict(orient='records')
        
        prompt = {
            "inputText": ( f"Predict the next {prediction_days} days of {data_type} trends based on the following historical data : {data_payload}. "
                           f"Also detect anomalies and provide actionable insights and recommendations."),
            "textGenerationConfig": {"maxTokenCount": 300,  "temperature": 0.7, "topP": 1}
        }
        
        response = bedrock_client.invoke_model(
            modelId="amazon.titan-text-lite-v1",
            body=json.dumps(prompt),
            contentType='application/json',
            accept='application/json'
        )
        response_body = json.loads(response['body'].read().decode('utf-8'))        
        predictions = response_body.get('results', [{}])[0].get('predictions', [])  
        anomalies = response_body.get('results', [{}])[0].get('anomalies', [])
        
        return jsonify({
            "predictions": predictions,
            "anomalies": anomalies
        })
        
    except Exception as e:
        logging.error(f"Error in predictive anaysis: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5000)