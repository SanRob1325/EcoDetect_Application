import json
import time
import boto3
from sense_hat import SenseHat
from datetime import datetime, timezone
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
import os
import logging
from dotenv import load_dotenv

load_dotenv()

IOT_ENDPOINT2 = os.getenv("IOT_ENDPOINT2")
THING_NAME2 = os.getenv("THING_NAME2")
IOT_TOPIC2 = os.getenv("IOT_TOPIC2")

CERTIFICATE_PATH2 = os.getenv("CERTIFICATE_PATH2")
PRIVATE_KEY_PATH2 = os.getenv("PRIVATE_KEY_PATH2")
ROOT_CA_PATH2 = os.getenv("ROOT_CA_PATH2")

logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(levelname)s - %(message)s")
mqtt_client = AWSIoTMQTTClient(THING_NAME2)
mqtt_client.configureEndpoint(IOT_ENDPOINT2, 8883)
mqtt_client.configureCredentials(ROOT_CA_PATH2, PRIVATE_KEY_PATH2, CERTIFICATE_PATH2)

#Enables auto reconnect in case of disconnection
mqtt_client.configureAutoReconnectBackoffTime(1, 32, 20)
mqtt_client.configureOfflinePublishQueueing(-1)
mqtt_client.configureConnectDisconnectTimeout(10)
mqtt_client.configureMQTTOperationTimeout(5)
try:
    mqtt_client.connect()
    logging.info("Connected to AWS IoT CORE")
    
except Exception as e: 
    logging.error(f"Failed to connect to AWS IoT Core: {str(e)}")
    exit(1)

sensor = SenseHat()


def read_sensor_data():
    """Reading data from SENSE HAT"""
    try:
        
        temperature = sensor.get_temperature()
        humidity = sensor.get_humidity()
        pressure = sensor.get_pressure()
        
        imu = {
            "acceleration": sensor.get_accelerometer_raw(),
            "gyroscope": sensor.get_gyroscope_raw(),
            "magnetometer": sensor.get_compass_raw()
        }
        
        current_time = int(time.time())
        ttl_time = current_time + (7 * 24 * 60 * 60)
        
        sensor_data = {
            "device_id": THING_NAME2,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temperature": round(temperature, 2),
            "humidity": round(humidity, 2),
            "pressure": round(pressure, 2),
            "imu": {
                "acceleration": {
                    "x": round(imu["acceleration"]["x"], 2),
                    "y": round(imu["acceleration"]["y"], 2),
                    "z": round(imu["acceleration"]["z"], 2),
                },
                "agyroscope": {
                    "x": round(imu["gyroscope"]["x"], 2),
                    "y": round(imu["gyroscope"]["y"], 2),
                    "z": round(imu["gyroscope"]["z"], 2),
                },
                "magnetometer": {
                    "x": round(imu["magnetometer"]["x"], 2),
                    "y": round(imu["magnetometer"]["y"], 2),
                    "z": round(imu["magnetometer"]["z"], 2),
                }, 
            },
            "ttl_timestamp": ttl_time
        }
        
        return sensor_data
    
    except Exception as e:
        logging.error(f"Error reading sensor data: {str(e)}")
        return None
    
try:
    while True:
        sensor_data = read_sensor_data()
        if sensor_data:
            payload = json.dumps(sensor_data)
            mqtt_client.publish(IOT_TOPIC2, payload, 1)
            logging.info(f"Published to AWS IoT: {payload}")
        time.sleep(5)
        
except KeyboardInterrupt:
    logging.info("Stopping publishing")
except Exception as e:
    logging.error(f"Unexpected error: {str(e)}")
finally:
    mqtt_client.disconnect()
    logging.info("Disconnected from AWS IoT Core")