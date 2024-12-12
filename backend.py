from flask import Flask,jsonify,request
from flask_cors import CORS
#from flask_mail import Mail,Message
#from twilio.rest import Client
import os
from datetime import datetime
from dotenv import load_dotenv
from sense_hat import SenseHat
import openai
from datetime import datetime,timedelta
from pymongo import MongoClient
import logging
from bson import ObjectId
import boto3
#logging setup
logging.basicConfig(level=logging.DEBUG)
load_dotenv()

app = Flask(__name__)
CORS(app)
#Database setup
client = MongoClient("mongodb://localhost:27017")
db = client.ecodetect
sensor_data_collection = db.sensor_data
thresholds_collection = db.thresholds
alert_history_collection = db.alert_history
#aws SNS setup
sns_client = boto3.client('sns',region_name='eu-west')
SNS_TOPIC_ARN= 'arn:aws:sns:eu-west-1:442042527353:HumidityAlertsTopic'

thresholds = thresholds_collection.find_one()


print(thresholds)
sensor = SenseHat()

#openai setup for prototype and testing purposes
openai.api_key = os.getenv('OPENAI_API_KEY')

#threshold defaults before user adjustment
default_temperature_range = [20,25]
default_humidity_range =[30,60]
HUMIDITY_THRESHOLD_LOW = 30
HUMIDITY_THRESHOLD_HIGH = 60

def get_default_thresholds():
    thresholds = thresholds_collection.find_one({}, {"_id":0})
    if thresholds is None:
        thresholds ={
            "temperature_range":default_temperature_range,
            "humidity_range": default_humidity_range
        }
    return thresholds

def trigger_humidity_alert(humidity_value):
    message = f"Humidity Alert: Current level is {humidity_value}%. Check you environment heating"
    sns_client.publish(
        TopicArn =SNS_TOPIC_ARN,
        Message=message,
        Subject="Humidity Alert"
    )
    alert_history_collection._insert_one({
        "message": message,
        "type": "critical" if humidity_value < HUMIDITY_THRESHOLD_LOW or humidity_value > HUMIDITY_THRESHOLD_HIGH else "warning",
        "date": datetime.now()
    })
    
 #monitor humidity to trigger alerts   
@app.route('/api/humidity',methods=['POST'])
def monitor_humidity():
    try:
        data = request.get_json()
        humidity = data.get('humidity')
        if humidity is None:
            return jsonify({"error": "No humidity value provided"}), 400
        
        if humidity < HUMIDITY_THRESHOLD_LOW or humidity > HUMIDITY_THRESHOLD_HIGH:
            trigger_humidity_alert(humidity)
        return jsonify({"status": "Humidity checl completed","humidity": humidity})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
      
@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    try:
        alerts = list(alert_history_collection.find({}, {"_id": 0}).sort("date",-1))
        return jsonify(alerts)
    except Exception as e:
        logging.error(f"Error in /api/alerts: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
@app.route('/api/notifications', methods=['GET'])
def get_notifications():
    notifications = [
        {"message": "Humidity alert: 75% - It's too high"},
        {"message": "Humidity alert: 25% - It's too low"},
        {"message": "Temperature is within optimal range"},
        {"message": "CO2 levels are approaching a critical threshold"}
    ]
    return jsonify(notifications)

@app.route('/api/ai-assistant',methods=['POST'])
def ai_assistant():
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return jsonify({"error": "Invalid input, 'query' field is required"}),400
        
        user_query = data['query'].strip()
        if not user_query:
            return jsonify({"error": "Query cannot be empty"}),400
        
        response = openai.Completion.create(
            model="text-davinci-003",
            prompt=f"Suggest eco-friendly matierals for: {user_query}",
            temperature=0.7,
            max_tokens=150
        )
        
        answer = response.choices[0].text.strip()
        return jsonify({"answer": answer})
    except openai.error.OpenAIError as e:
        return jsonify({"error": "OpenAI error", "details": str(e)}),500
    except Exception as e:
        return({"error":"Unexpected server error", "details": str(e)}),500

#fetch sensor data
@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    try:
        temperature = sensor.get_temperature()
        humidity = sensor.get_humidity()
        
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
            
        normalized_temperature = round(normalized_temperature, 2)    
        humidity = round(humidity)
        timestamp = datetime.now()
        sensor_data = {
            "temperature":normalized_temperature,
            "humidity": humidity,
            "timestamp": timestamp
        }
            
        sensor_data_collection.insert_one(sensor_data)
        sensor_data["_id"] = str(sensor_data["_id"])
        return jsonify(sensor_data)
        
    except Exception as e:
        logging.error(f"Error in /api/sensor-data: {str(e)}")
        return jsonify({"Failed to insert sensor data": str(e)}),500
        
def get_cpu_temperature():
    """Read from the systems CPU temperature"""
    file_path = "sys/class/thermal/thermal_zone0/temp"

    try:
        with open(file_path, "r") as f:
            temp = int(f.read()) / 1000.0
        return temp
    except FileNotFoundError as e:
        logging.error(f"Unexpected error reading CPU temp: {str(e)}")
    except Exception as e:
        logging.error(f"Error reading CPU temperature: {str(e)}")
        return None
  
@app.route('/api/temperature-trends', methods=['GET'])
def get_temperature_trends():
    try:
        range_map = {
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
            "30d": timedelta(days=30)
        }
        range_param = request.args.get('range','24h')
        time_delta = range_map.get(range_param,timedelta(hours=24))
        cutoff_time = datetime.now() - time_delta

        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
        trends_cursor = sensor_data_collection.find(
            {"timestamp": {"$gte": cutoff_time}}
        ).sort("timestamp", -1).skip((page -1) * page_size).limit(page_size)
        trends = [
            {"time":trend["timestamp"].isoformat(),"temperature":trend["temperature"]}
            for trend in trends_cursor
        ]
        return jsonify(trends)
    except Exception as e:
        logging.error(f"Error in /api/temperature-trends {str(e)}")
        return jsonify({"error": str(e)}),500
    
@app.route('/api/set-thresholds',methods=['POST'])
def set_thresholds():
    try:
        data = request.json
        temperature_range = data.get('temperature_range',default_temperature_range)
        humidity_range = data.get('humidity_range',default_humidity_range)
        
        if len(temperature_range) != 2 or temperature_range[0] >= temperature_range[1]:
            return jsonify({"error": "Invalid temperature"}), 400
        if len(humidity_range) != 2 or humidity_range[0] >= humidity_range[1]:
            return jsonify({"error": "Invalid temperature"}), 400
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
    
if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5000)