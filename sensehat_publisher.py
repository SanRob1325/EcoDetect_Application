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

mqtt_client = AWSIoTMQTTClient(THING_NAME2)
mqtt_client.configureEndpoint(IOT_ENDPOINT2, 8883)
mqtt_client.configureCredentials(ROOT_CA_PATH2, PRIVATE_KEY_PATH2, CERTIFICATE_PATH2)

try:
    mqtt_client.connect()
    logging.info("Connected to AWS IoT CORE")
    
except Exception as e: 
    logging.error(f"Failed to connect to AWS IoT Core")
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
        
        return {
            "device_id": THING_NAME2,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temperature": round(temperature, 2),
            "humidity": round(humidity, 2),
            "pressure": round(pressure, 2),
            "imu": {
                "acceleration": {k: round (v, 2) for k,v in imu["acceleration"].items()},
                "gyroscope": {k: round(v, 2) for k,v in imu["acceleration"].items()},
                "magnetometer": {k: round(v, 2) for k,v in imu["magnetometer"].items()}
            },
            "ttl_timestamp": ttl_time
        }
        
    except Exception as e:
        logging.error(f"Error reading sensor data: {str(e)}")
        return None
    
try:
    while True:
        sensor_data = read_sensor_data()
        if sensor_data:
            mqtt_client.publish(IOT_TOPIC2, json.dumps(sensor_data), 1)
            logging.info(f"Published to AWS IoT: {sensor_data}")
        time.sleep(5)
except KeyboardInterrupt:
    logging.info("Stopping publishing")
except Exception as e:
    logging.error(f"Unexpected error: {str(e)}")
finally:
    mqtt_client.disconnect()
    logging.info("Disconnected from AWS IoT Core")