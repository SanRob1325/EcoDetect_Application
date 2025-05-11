import json
import boto3
import os
from datetime import datetime
import uuid

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
#Load S3 bucket names from environment variables
SENSEHAT_BUCKET = os.getenv('SENSEHAT_S3_BUCKET',"sensehat-longterm-storage")
WATERFLOW_BUCKET = os.getenv('WATERFLOW_S3_BUCKET', "waterflow-longterm-storage")
THRESHOLD_TABLE = os.getenv('THRESHOLD_TABLE', "Thresholds")
SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN')
BEDROOM2_BUCKET = os.getenv('BEDROOM2_BUCKET', "bedroom2-longterm-storage")
BEDROOM1_BUCKET = os.getenv('BEDROOM1_BUCKET', "bedroom1-longterm-storage")
threshold_table = dynamodb.Table(THRESHOLD_TABLE)

def check_thresholds(data, device_type):
    """Checks if sensor data exceeds thresholds and sends SNS notification if so"""

    try:
        # Get current thresholds
        threshold_response = threshold_table.scan()
        if not threshold_response.get('Items'):
            print("No thresholds found in database")
            return []
        
        thresholds = threshold_response['Items'][0]
        exceeded_thresholds = []
        alert_message = f"Alert from {data['device_id']} at {data['timestamp']}:\n"

        # Check for explicity provided thresholds in data
        if "exceeded_thresholds" in data and isinstance(data['exceeded_thresholds'], list):
            print(f"Using pre detected threshold violations: {data['exceeded_thresholds']}")
            return data['exceeded_thresholds']
        
        # Check thresholds based on device type
        if device_type == "SenseHatData" and data['temperature'] is not None:
            temp_range = thresholds.get('temperature_range', [20, 25])
            if data['temperature'] < temp_range[0]:
                exceeded_thresholds.append('temperature_low')
                alert_message += f"Temperature is too low: {data['temperature']}C Threshold: {temp_range[0]}C\n"
            elif data['temperature'] > temp_range[1]:
                exceeded_thresholds.append('temperature_high')
                alert_message += f"Temperature is too high: {data['temperature']}C Threshold: {temp_range[1]}C\n"

            if data['humidity'] is not None:
                humidity_range = thresholds.get('humidity_range', [30, 50])
                if data['humidity'] < humidity_range[0]:
                    exceeded_thresholds.append('humidity_low')
                    alert_message += f"Humidity is too low: {data['humidity']}% Threshold: {humidity_range[0]}%\n"
                elif data['humidity'] > humidity_range[1]:
                    exceeded_thresholds.append('humidity_high')
                    alert_message += f"Humidity is too high: {data['humidity']}% Threshold: {humidity_range[1]}%\n"

        elif device_type == "WaterFlow" and data['flow_rate'] is not None:
            flow_threshold = thresholds.get('flow_rate_range', 10)
            if data['flow_rate'] > flow_threshold:
                exceeded_thresholds.append('water_usage_high')
                alert_message += f"Flow rate is too high: {data['flow_rate']} {data['unit']} Threshold: {flow_threshold} {data['unit']}\n"
        
        elif device_type == "BedRoom1Table" and data['temperature'] is not None:
            temp_range = thresholds.get('temperature_range', [20, 25])
            if data['temperature'] < temp_range[0]:
                exceeded_thresholds.append('temperature_low')
                alert_message += f"Temperature is too low: {data['temperature']}C Threshold: {temp_range[0]}C\n"
            elif data['temperature'] > temp_range[1]:
                exceeded_thresholds.append('temperature_high')
                alert_message += f"Temperature is too high: {data['temperature']}C Threshold: {temp_range[1]}C\n"

            if data['humidity'] is not None:
                humidity_range = thresholds.get('humidity_range', [30, 50])
                if data['humidity'] < humidity_range[0]:
                    exceeded_thresholds.append('humidity_low')
                    alert_message += f"Humidity is too low: {data['humidity']}% Threshold: {humidity_range[0]}%\n"
                elif data['humidity'] > humidity_range[1]:
                    exceeded_thresholds.append('humidity_high')
                    alert_message += f"Humidity is too high: {data['humidity']}% Threshold: {humidity_range[1]}%\n"

        elif device_type == "BedRoom2Table" and data['temperature'] is not None:
            temp_range = thresholds.get('temperature_range', [20, 25])
            if data['temperature'] < temp_range[0]:
                exceeded_thresholds.append('temperature_low')
                alert_message += f"Temperature is too low: {data['temperature']}C Threshold: {temp_range[0]}C\n"
            elif data['temperature'] > temp_range[1]:
                exceeded_thresholds.append('temperature_high')
                alert_message += f"Temperature is too high: {data['temperature']}C Threshold: {temp_range[1]}C\n"

            if data['humidity'] is not None:
                humidity_range = thresholds.get('humidity_range', [30, 50])
                if data['humidity'] < humidity_range[0]:
                    exceeded_thresholds.append('humidity_low')
                    alert_message += f"Humidity is too low: {data['humidity']}% Threshold: {humidity_range[0]}%\n"
                elif data['humidity'] > humidity_range[1]:
                    exceeded_thresholds.append('humidity_high')
                    alert_message += f"Humidity is too high: {data['humidity']}% Threshold: {humidity_range[1]}%\n"

        if exceeded_thresholds and SNS_TOPIC_ARN:
            # Format alert message
            alert_message += f"Thresholds exceeded: {exceeded_thresholds}\n"

            # Senses SNS notification
            sns.publish(
                TopicArn=SNS_TOPIC_ARN,
                Message=alert_message,
                Subject=f"Environmental Alert:{', '.join(exceeded_thresholds)}"
            )
            print(f"Alert sent through SNS: {', '.join(exceeded_thresholds)}")
        return exceeded_thresholds
    except Exception as e:
        print(f"Error checking thresholds: {e}")
        return []

def lambda_handler(event, context):
    """Triggers DynamoDB Stream and writes data to S3"""

    try:
        print(f"Recieved event: {json.dumps(event, indent=2)}")

        for record in event.get("Records", []):
            if record["eventName"] not in ["INSERT", "MODIFY"]:
                continue

            new_data = record["dynamodb"]["NewImage"]
            timestamp = new_data.get("timestamp", {}).get("S", None)
            device_id = new_data.get("device_id", {}).get("S", "Unknown Device")

            if "Main_Pi" in device_id:
                table_name = "SenseHatData"
                bucket_name = SENSEHAT_BUCKET

            elif "WaterSensor" in device_id:
                table_name = "WaterFlowData"
                bucket_name = WATERFLOW_BUCKET

            elif "bedroom_pi_1" in device_id:
                table_name = "BedRoom1Table"
                bucket_name = BEDROOM1_BUCKET

            elif "bedroom_pi_2" in device_id:
                table_name = "BedRoom2Table"
                bucket_name = BEDROOM2_BUCKET
            else:
                print(f"Unknown device: {device_id}, skipping record")
                continue

            print(f"Extracted Table Name: {table_name}")
            if table_name == "SenseHatData":

                payload_data = new_data.get("payload", {}).get("M", {})
            
                temperature = float(payload_data.get("temperature", {}).get("N", 0))
                humidity = float(payload_data.get("humidity", {}).get("N", 0))
                pressure = float(payload_data.get("pressure", {}).get("N", 0)) 
                flow_rate = None 
                unit = "N/A"
            
                imu_data = payload_data.get("imu", {}).get("M", {})
                acceleration = imu_data.get("acceleration", {}).get("M", {})
                gyroscope = imu_data.get("gyroscope", {}).get("M", {})
                magnetometer = imu_data.get("magnetometer", {}).get("M", {})

            elif table_name == "WaterFlowData":
                payload_data = new_data.get("payload", {}).get("M", {})
                flow_rate = float(payload_data.get("flow_rate", {}).get("N", 0))
                unit = payload_data.get("unit", {}).get("S", "N/A")

                temperature,humidity,pressure = None,None,None
                imu_data, acceleration,gyroscope, magnetometer = None,None,None,None

            elif table_name == "BedRoom1Table":
                payload_data = new_data.get("payload", {}).get("M", {})

                temperature = float(payload_data.get("temperature", {}).get("N", 0))
                humidity = float(payload_data.get("humidity", {}).get("N", 0))
                pressure = float(payload_data.get("pressure", {}).get("N", 0))
                flow_rate = None
                unit = "N/A"

                imu_data = payload_data.get("imu", {}).get("M", {})
                acceleration = imu_data.get("acceleration", {}).get("M", {})
                gyroscope = imu_data.get("gyroscope", {}).get("M", {})
                magnetometer = imu_data.get("magnetometer", {}).get("M", {})

            elif table_name == "BedRoom2Table":
                payload_data = new_data.get("payload", {}).get("M", {})

                temperature = float(payload_data.get("temperature", {}).get("N", 0))
                humidity = float(payload_data.get("humidity", {}).get("N", 0))
                pressure = float(payload_data.get("pressure", {}).get("N", 0))
                flow_rate = None
                unit = "N/A"

                imu_data = payload_data.get("imu", {}).get("M", {})
                acceleration = imu_data.get("acceleration", {}).get("M", {})
                gyroscope = imu_data.get("gyroscope", {}).get("M", {})
                magnetometer = imu_data.get("magnetometer", {}).get("M", {})

            imu = {
                "acceleration": {
                    "x": float(acceleration.get("x", {}).get("N", 0)),
                    "y": float(acceleration.get("y", {}).get("N", 0)),
                    "z": float(acceleration.get("z", {}).get("N", 0))
                } if acceleration else None,
                "gyroscope": {
                    "x": float(gyroscope.get("x", {}).get("N", 0)),
                    "y": float(gyroscope.get("y", {}).get("N", 0)),
                    "z": float(gyroscope.get("z", {}).get("N", 0))
                } if gyroscope else None,
                "magnetometer": {
                    "x": float(magnetometer.get("x", {}).get("N", 0)),
                    "y": float(magnetometer.get("y", {}).get("N", 0)),
                    "z": float(magnetometer.get("z",{}).get("N", 0))
                } if magnetometer else None,
            } if table_name == "SenseHatData" else None

            print(f"Extracted Data :Device ID ={device_id}, Timestamp = {timestamp}")
            print(f"Extracted Data: Temperature = {temperature}, Humidity = {humidity}, Pressure = {pressure}, Flow Rate = {flow_rate}, Unit = {unit}")
            if imu:
                print(f"Extracted Data: IMU = {imu['acceleration']}, Gyroscope = {imu['gyroscope']}, Magnetometer ={imu['magnetometer']}")

            exceeded_thresholds_from_payload = payload_data.get("exceeded_thresholds", {})
            exceeded_thresholds = []

            if exceeded_thresholds_from_payload:
                # Extract predetecct thresholds for payload
                for threshold in exceeded_thresholds_from_payload.get("L", []):
                    threshold_value = threshold.get("S", "")
                    if threshold_value:
                        exceeded_thresholds.append(threshold_value)
                print(f"Found pre detected threshold violations in payload: {exceeded_thresholds}")

            formatted_data = {
                "device_id": device_id,
                "timestamp": timestamp,
                "temperature": temperature,
                "humidity": humidity,
                "pressure": pressure,
                "flow_rate": flow_rate,
                "unit": unit,
                "imu": imu,
            }

            if not exceeded_thresholds:
                exceeded_thresholds = check_thresholds(formatted_data, table_name)

            if exceeded_thresholds:
                formatted_data["exceeded_thresholds"] = exceeded_thresholds
                formatted_data['alert_time'] = datetime.now().isoformat()
                formatted_data['severity'] = 'critical' if any(t in ['temperature_high', 'temperature_low', 'humidity_high', 'humidity_low'] for t in exceeded_thresholds ) else 'warning'


            unique_id = uuid.uuid4().hex
            file_name = f"{device_id}_{timestamp}_{unique_id}.json"

            #Uploads object to S3
            try:
                alert_key = f"alerts/{device_id}_{timestamp}_{unique_id}.json"
                s3.put_object(
                    Bucket=bucket_name,
                    Key=file_name,
                    Body=json.dumps(formatted_data),
                    ContentType="application/json"
                )
                print(f"Alert data save to S3: {file_name} to {bucket_name}")
                print(f"Successfully uploaded data to S3: {file_name} to {bucket_name}")
            except Exception as e:
                print(f"Error uploading data to S3: {str(e)}")

        return {
            'statusCode': 200,
            'body': "successfully proccessed records"
        }
    except Exception as e:
        print(f"Lambda Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error uploading data to S3')
        }
