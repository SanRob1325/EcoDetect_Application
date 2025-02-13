import json
import boto3
import os
from datetime import datetime
import uuid

s3 = boto3.client('s3')

#Load S3 bucket names from environment variables
SENSEHAT_BUCKET = os.getenv('SENSEHAT_S3_BUCKET',"sensehat-longterm-storage")
WATERFLOW_BUCKET = os.getenv('WATERFLOW_S3_BUCKET', "waterflow-longterm-storage")

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

            unique_id = uuid.uuid4().hex
            file_name = f"{device_id}_{timestamp}_{unique_id}.json"

            #Uploads object to S3
            try:
                s3.put_object(
                    Bucket=bucket_name,
                    Key=file_name,
                    Body=json.dumps(formatted_data),
                    ContentType="application/json"
                )

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