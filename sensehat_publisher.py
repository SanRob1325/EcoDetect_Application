import json
import time
import boto3
from sense_hat import SenseHat
from datetime import datetime, timezone
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
import os
import logging
import statistics
from dotenv import load_dotenv

load_dotenv()
prev_imu = {
    "acceleration": {"x": 0, "y": 0, "z":0},
    "gyroscope": {"x": 0, "y": 0, "z": 0},
    "magnetometer": {"x": 0, "y": 0, "z": 0},
}

IOT_ENDPOINT2 = os.getenv("IOT_ENDPOINT2")
THING_NAME2 = os.getenv("THING_NAME2")
IOT_TOPIC2 = os.getenv("IOT_TOPIC2")

CERTIFICATE_PATH2 = os.getenv("CERTIFICATE_PATH2")
PRIVATE_KEY_PATH2 = os.getenv("PRIVATE_KEY_PATH2")
ROOT_CA_PATH2 = os.getenv("ROOT_CA_PATH2")

TEMP_THRESHOLD_HIGH = float(os.getenv("TEMP_THRESHOLD_HIGH", "30"))
TEMP_THRESHOLD_LOW = float(os.getenv("TEMP_THRESHOLD_LOW", "10"))
HUMIDITY_THRESHOLD_HIGH = float(os.getenv("HUMIDITY_THRESHOLD_HIGH", "70"))
HUMIDITY_THRESHOLD_LOW = float(os.getenv("HUMIDITY_THRESHOLD_LOW", "30"))

ALERT_CACHE = {}
ALERT_CACHE_TTL = 15 * 60
logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(levelname)s - %(message)s",handlers=[logging.FileHandler("sensor_readings.log"),logging.StreamHandler()])
logger = logging.getLogger(__name__)

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
TEMP_CORRECTION_FACTOR = -5.4
HUMIDITY_CALIBRATION = 1.05
PRESSURE_CALIBRATION = 1.0
ALPHA = 0.2 #Normalises factor for IMU data


def get_cpu_temperature():
    """Getting CPU temperature that compensates for SenseHAT heat"""
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            return float(f.read()) / 1000.0
    except Exception as e:
        logger.warning(f"Could not read CPU temperature: {e}")
        return None
    
def calibrate_temperature(raw_temp):
    """Apply dynamic temperature calibration based on CPU temperature"""
    cpu_temp = get_cpu_temperature()
    if cpu_temp is None:
        return raw_temp - TEMP_CORRECTION_FACTOR
    
    # Dynamic calibration formula based on CPU and SenseHat temperature difference
    factor = (cpu_temp - raw_temp) / 5.466
    return raw_temp - factor

def low_pass_filter(new_value, prev_value):
    """Applies low pass filter to smooth sensor readings"""
    return(ALPHA * new_value) + ((1 - ALPHA) * prev_value)

def remove_outliers(values, threshold=2.0):
    """Remove outlier values using standard deviation"""
    if len(values) < 4:
        return values
    
    mean = statistics.mean(values)
    standev = statistics.stdev(values) if len(values) > 1 else 0
    
    if standev == 0:
        return values
    
    return [x for x in values if abs(x - mean) <= threshold * standev]

def check_thresholds(sensor_data):
    """Check if sensor data exceeds thresholds"""
    exceeded_thresholds = []
    
    if "temperature" in sensor_data and sensor_data["temperature"] is not None:
        if sensor_data["temperature"] > TEMP_THRESHOLD_HIGH:
            exceeded_thresholds.append("temperature_high")
        elif sensor_data["temperature"] < TEMP_THRESHOLD_LOW:
            exceeded_thresholds.append("temperature_low")
            
    # Humidity thresholds
    if "humidity" in sensor_data and sensor_data["humidity"] is not None:
        if sensor_data["humidity"] > HUMIDITY_THRESHOLD_HIGH:
            exceeded_thresholds.append("humidity_high")
        elif sensor_data["humidity"] < HUMIDITY_THRESHOLD_LOW:
            exceeded_thresholds.append("humidity_low")
            
    # Check cache to avoid sending repeated alerts
    now = time.time()
    if exceeded_thresholds:
        cache_key = ",".join(exceeded_thresholds)
        if cache_key in ALERT_CACHE:
            # If alert is in cache and not expired, don't report again
            if now - ALERT_CACHE[cache_key] < ALERT_CACHE_TTL:
                logger.debug(f"Alert {cache_key} still in cache, not reporting again")
                return []
        # Update cahce with current time
        ALERT_CACHE[cache_key] = now
        
        # Clean up expired cahce entries
        for k in list(ALERT_CACHE.keys()):
            if now - ALERT_CACHE[k] > ALERT_CACHE_TTL:
                del ALERT_CACHE[k]
    
    return exceeded_thresholds
            
def read_sensor_data():
    """Reading data from SENSE HAT"""
    global prev_imu
    try:

        # Take mulitple temperature readings and filter outliers
        temp_values = [sensor.get_temperature_from_humidity() for _ in range(10)]
        filtered_temp_values = remove_outliers(temp_values)
        raw_temp = statistics.median(filtered_temp_values) if filtered_temp_values else temp_values[0]
        temperature = calibrate_temperature(raw_temp)
        
        # Take multiple humidity readings and filter outliers
        humidity_values = [sensor.get_humidity() for _ in range(10)]
        filtered_humidity = remove_outliers(humidity_values)
        humidity = round(statistics.median(filtered_humidity) * HUMIDITY_CALIBRATION, 2)
        
        # Take mutiple pressure readings and  filter outliers
        pressure_values = [sensor.get_pressure() for _ in range(10)]
        filtered_pressure = remove_outliers(pressure_values)
        pressure = round(statistics.median(filtered_pressure) * PRESSURE_CALIBRATION, 2)
        
        acceleration = sensor.get_accelerometer_raw()
        gyroscope = sensor.get_gyroscope_raw()
        magnetometer = sensor.get_compass_raw()
        
        filtered_imu = {
            "acceleration": {
                "x": round(low_pass_filter(acceleration["x"], prev_imu["acceleration"]["x"]), 2),
                "y": round(low_pass_filter(acceleration["y"], prev_imu["acceleration"]["y"]), 2),
                "z": round(low_pass_filter(acceleration["z"], prev_imu["acceleration"]["z"]), 2),
            },
            "gyroscope": {
                "x": round(low_pass_filter(gyroscope["x"], prev_imu["gyroscope"]["x"]), 2),
                "y": round(low_pass_filter(gyroscope["y"], prev_imu["gyroscope"]["y"]), 2),
                "z": round(low_pass_filter(gyroscope["z"], prev_imu["gyroscope"]["z"]), 2),
            },
            "magnetometer": {
                "x": round(low_pass_filter(magnetometer["x"], prev_imu["magnetometer"]["x"]), 2),
                "y": round(low_pass_filter(magnetometer["y"], prev_imu["magnetometer"]["y"]), 2),
                "z": round(low_pass_filter(magnetometer["z"], prev_imu["magnetometer"]["z"]), 2),
            },
        }
        # Update previous IMU values for the next iteration
        
        prev_imu.update(filtered_imu)
        # Calculate TTL timestamp
        current_time = int(time.time())
        ttl_time = current_time + (7 * 24 * 60 * 60) # in 7 days
        
        sensor_data = {
            "device_id": THING_NAME2,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "temperature": round(temperature, 2),
            "humidity": humidity,
            "pressure": pressure,
            "imu": filtered_imu,
            "ttl_timestamp": ttl_time,
            "location": os.getenv("SENSOR_LOCATION", "Secondary Pi")
             
        }
        
        logger.debug(f"Tempearature: {sensor_data['temperature']} C, Humidity: {sensor_data['humidity']}%, Pressure: {sensor_data['pressure']} hPa")
                
        return sensor_data
    
    except Exception as e:
        logging.error(f"Error reading sensor data: {str(e)}")
        return None


if __name__ == "__main__":
    try:
        logger.info(f"Starting sensor monitoring thresholds Temp:{TEMP_THRESHOLD_LOW}-{TEMP_THRESHOLD_HIGH}C, Humidity: {HUMIDITY_THRESHOLD_LOW}-{HUMIDITY_THRESHOLD_HIGH}%")
    
        sample_count = 0
        while True:
            sensor_data = read_sensor_data()
            if sensor_data:
                exceeded_thresholds = check_thresholds(sensor_data)
            
                if exceeded_thresholds:
                    sensor_data['exceeded_thresholds'] = exceeded_thresholds
                    logger.warning(f"Thresholds exceeded: {', '.join(exceeded_thresholds)}")
                
                
                payload = json.dumps(sensor_data)
                mqtt_client.publish(IOT_TOPIC2, payload, 1)
            
                # Log details periodically to avoid excessive logging
                sample_count += 1
                if sample_count % 12 == 0 or exceeded_thresholds:
                    if exceeded_thresholds:
                        logger.info(f"ALERT: Published to AWS IOT Temperature:{sensor_data['temperature']}C, Humidity:{sensor_data['humidity']}%, Thresholds:{', '.join(exceeded_thresholds)}")
                    else:
                        logger.info(f"Published to AWS IoT: Temperature:{sensor_data['temperature']}C, Humidity: {sensor_data['humidity']}%")
                logging.info(f"Published to AWS IoT: {payload}")    
            time.sleep(5)
        
    except KeyboardInterrupt:
        logging.info("Stopping publishing")
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}")
    finally:
        mqtt_client.disconnect()
        logging.info("Disconnected from AWS IoT Core")
