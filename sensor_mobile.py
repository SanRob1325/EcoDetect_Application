import time
import requests
from sense_hat import SenseHat
from datetime import datetime
import logging
import os
import math
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

            processed_movement = self.process_vehicle_movement(imu_data)

            data = {
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "imu": imu_data,
                "processed_movement": processed_movement,
                "room_id": ROOM_ID,
                "device_id": DEVICE_ID,
                "location": ROOM_ID.capitalize()
            }

            return data
        except Exception as e:
            logging.error(f"Error collecting sensor data: {e}")
            return None
 
    def classify_movement(accel, gyro):
        """Classifying the type of vehicle movement based on IMU data"""
        try:
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
        except Exception as e:
            logging.error(f"Error classifying movement: {e}")
            return "unknown"

    def process_vehicle_movement(self, imu_data):
        """Convert raw IMU data into meaningful vehicle movement metrics"""
        try:
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
            movement_type = self.classify_movement(accel, gyro)

            carbon_impact = self.calculate_vehicle_impact(accel_magnitude, movement_type)
        
            return {
                "accel_magnitude": round(accel_magnitude, 2), # For total G-Force
                "rotation_rate": round(rotation_rate, 2), # degrees per second
                "orientation": {
                    "pitch": round(pitch, 2), # Forward and backward til
                    "roll": round(roll, 2), # Side to side tilt
                    "heading": round(heading, 2) # Compass direction
                },
                "movement_type": movement_type,
                "carbon_impact": round(carbon_impact, 2), # Movement classification
                "raw_data": { # Original reference
                    "acceleration": accel,
                    "gyroscope": gyro,
                    "magnetometer": mag 
                }
            }
        except Exception as e:
            logging.error(f"Error processing vehicle movement: {e}")
            return {
                "accel_magnitude": 0,
                "rotation_rate": 0,
                "orientation": {"pitch": 0, "roll": 0, "heading": 0},
                "movement_type": "unknown",
                "carbon_impact": 0,
                "raw_data": {"acceleration": [0,0,0], "gyroscope": [0,0,0], "magenetometer": [0,0,0]}
            }

    def calculate_vehicle_impact(self, accel_magnitude, movement_type):
        """Calculate carbon impact from vehicle movement patterns"""
        try:
            impact = 0
            impact += accel_magnitude * 1.5
            
            # Additional imapct based on movement type  
            if movement_type == "accelerating":
                impact += 2.0 # Acceleration uses more fuel
            elif movement_type == "braking":
                impact += 1.0 # Frequent breking indicates inefficient driving
            elif movement_type == "rough_road":
                impact += 0.8 # Rough roads can decrease effciency of movement
                
            # Rationalises the impact on the environment at 50%
            return min(impact, 50)
        except Exception as e:
            logging.error(f"Error calculating vehicle impact: {e}")
            return 0

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

                    # Logs for vehicle movement
                    processed_movement = data.get("processed_movement", {})
                    movement_type = processed_movement.get("movement_type", "unknown")
                    if movement_type not in ["stationary", "unknown"]:
                        logging.info(f"Vehicle movement: {movement_type}, G-Force: {processed_movement.get('accel_magnitude', 0)}")
                
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