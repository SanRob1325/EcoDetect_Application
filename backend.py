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

logging.basicConfig(level=logging.DEBUG)
load_dotenv()

app = Flask(__name__)
CORS(app)

client = MongoClient("mongodb://localhost:27017")
db = client.ecodetect
sensor_data_collection = db.sensor_data
thresholds_collection = db.thresholds

thresholds = thresholds_collection.find_one()
print(thresholds)
sensor = SenseHat()
openai.api_key = os.getenv('OPENAI_API_KEY')

default_temperature_range = [20,25]
default_humidity_range =[30,60]

@app.route('/api/ai-assistant',methods=['POST'])
def ai_assistant():
    try:
        user_query = request.json.get('query', '')
        if not user_query:
            return jsonify({"error": "No query provided"}),400
        response = openai.Completion.create(
            model="text-davinci-003",
            prompt=f"Suggest eco-friendly matierals for: {user_query}",
            temperature=0.7,
            max_tokens=150
        )
        answer = response.choices[0].text.strip()
        return jsonify({"answer":answer})
    except Exception as e:
        return jsonify({"error": str(e)}),500
    
def get_default_thresholds():
    thresholds = thresholds_collection.find_one({}, {"_id":0})
    if thresholds is None:
        thresholds ={
            "temperature_range":default_temperature_range,
            "humidity_range": default_humidity_range
        }
    return thresholds

@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    try:
        temperature = round(sensor.get_temperature(),2)
        humidity = round(sensor.get_humidity())
        timestamp = datetime.now()
        sensor_data = {
            "temperature":temperature,
            "humidity": humidity,
            "timestamp": timestamp
        }
        try:
            
            sensor_data_collection.insert_one(sensor_data)
        except Exception as e:
            logging.error(f"Error in /api/sensor-data: {str(e)}")
            return jsonify({"error":"Failed to inser sensor data"})
            
        sensor_data["_id"] = str(sensor_data["_id"])
        return jsonify(sensor_data)
    
    except Exception as e:
        logging.error(f"Error in /api/sensor-data: {str(e)}")
        return jsonify({"error": str(e)}),500

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

        trends = [
            {"time":trend["timestamp"].isoformat(),"temperature":trend["temperature"]}
            for trend in sensor_data_collection.find({"timestamp":{"$gte": cutoff_time}})
        ]
        return jsonify(trends)
    except Exception as e:
        logging.error(f"Error in /api/temperature-trends {str(e)}")
        return jsonify({"error": str(e)}),500
    
@app.route('/api/set-thresholds',methods=['POST'])
def set_thresholds():
    try:
        data = request.json
        thresholds ={
            "temperature_range": data.get('temperature_range',default_temperature_range),
            "humidity_range": data.get('humidity_range',default_humidity_range)
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