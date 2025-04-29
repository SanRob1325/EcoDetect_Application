import time
import requests
from sense_hat import SenseHat
from datetime import datetime
import logging
import os
from dotenv import load_dotenv

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

load_dotenv()
MAIN_PI = os.getenv('EC2_SENSOR_ENDPOINT','http://108.128.180.154:5000/api/sensor-data-upload').strip()
ROOM_ID = "current_area"
DEVICE_ID = "main_pi"

class SensorMonitor:
    def __init__(self):
        self.sensor = SenseHat()

    def collect_data(self):
        try:
            temperature = round(float(self.sensor.get_temperature()), 2)
            cpu_temp = self.get_cpu_temperature()
            if cpu_temp is not None:
                temperature = round(temperature - ((cpu_temp - temperature) / 5.466), 2)
            humidity = round(float(self.sensor.get_humidity()), 2)
            pressure = round(float(self.sensor.get_pressure()), 2)

            imu_data = {
                "acceleration": [self.safely_round(x) for x in self.sensor.get_accelerometer_raw().values()],
                "gyroscope": [self.safely_round(x) for x in self.sensor.get_gyroscope_raw().values()],
                "magnetometer":  [self.safely_round(x) for x in self.sensor.get_compass_raw().values()]
            }

            data = {
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "imu": imu_data,
                "room_id": ROOM_ID,
                "device_id": DEVICE_ID,
                "location": ROOM_ID.capitalize()
            }

            return data
        except Exception as e:
            logging.error(f"Error collecting sensor data: {e}")
            return None
    
    def get_cpu_temperature(self):
        """Read CPU temperature for more accurate sensor readings"""
        try:
            with open("/sys/class/thermal/thermal_zone0/temp", "r") as temp_file:
                return float(temp_file.read().strip()) / 1000.0
        except Exception:
            logging.warning("Could not read CPU temperature")
            return None

    def safely_round(self, value, decimals=2):
        """Safely round avalue that might be a string"""
        try:
            return round(float(value), decimals)
        except (ValueError, TypeError):
            logging.warning(f"Could not round value: {value}, using 0 instead")
            return 0.0

    def main_loop(self):
        logging.info(f"Starting sensor monitoring for {ROOM_ID}...")
        while True:
            try:
                data = self.collect_data()
                if data:
                    response = requests.post(MAIN_PI, json=data, timeout=5)
                    logging.info(f"Sent data: {response.status_code}")
                    logging.info(f"Data: {data}")
                time.sleep(5)
            except requests.RequestException as e:
                logging.error(f"Failed to send data: {e}")
                time.sleep(5) # Sends data every 15 seconds
            except KeyboardInterrupt:
                logging.info("Monitoring stopped")
                break

def main():
    monitor = SensorMonitor()
    monitor.main_loop() 

if __name__ == '__main__':
    main()