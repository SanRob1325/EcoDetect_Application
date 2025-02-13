import json
import boto3
import csv
from io import StringIO
import pandas as pd
import uuid

s3 = boto3.client('s3')

SENSEHAT_BUCKET =  "sensehat-longterm-storage"
WATERFLOW_BUCKET = "waterflow-longterm-storage"
SENSEHAT_CSV_FILENAME = "carbon_footprint_training_sensehat.csv"
WATERFLOW_CSV_FILENAME = "carbon_footprint_training_waterflow.csv"

def lambda_handler(event, context):
    """Lambda function to process DynamoDB Streams and append any formatted data"""

    try:
        print(f"Recieved event: {json.dumps(event, indent=2)}")

        new_sensehat_rows = []
        new_waterflow_rows = []

        for record in event.get("Records", []):
            if record["eventName"] not in ["INSERT", "MODIFY"]:
                continue
            
            new_data = record["dynamodb"]["NewImage"]
            timestamp = new_data.get("timestamp", {}).get("S", "")
            device_id = new_data.get("device_id", {}).get("S", "")

            payload = new_data.get("payload", {}).get("M", {})         
            if "Main_Pi" in device_id:
                table_name = "SenseHatData"
                S3_BUCKET = SENSEHAT_BUCKET
                CSV_FILENAME = SENSEHAT_CSV_FILENAME

                temperature = float(payload.get("temperature", {}).get("N", 0))
                humidity = float(payload.get("humidity", {}).get("N", 0))
                pressure = float(payload.get("pressure", {}).get("N", 0))
                flow_rate = float(payload.get("flow_rate", {}).get("N", 0)) if "flow_rate" in payload else None 
                unit = payload.get("unit", {}).get("S", "N/A")
                
                imu_data = payload.get("imu", {}).get("M", {})
                acceleration = imu_data.get("acceleration", {}).get("M", {})
                imu_distance = (
                    (float(acceleration.get("x", {}).get("N", 0)) **2 +
                    float(acceleration.get("y", {}).get("N", 0)) **2 +
                    float(acceleration.get("z", {}).get("N", 0)) **2) 
                ) ** 0.5 if acceleration else None

                new_row = {
                    "timestamp": timestamp,
                    "device_id": device_id,
                    "temperature": temperature,
                    "humidity": humidity,
                    "pressure": pressure,
                    "imu_distance": imu_distance
                }
                new_sensehat_rows.append(new_row)
            elif "WaterSensor" in device_id:
                table_name = "WaterFlowData"
                S3_BUCKET = WATERFLOW_BUCKET
                CSV_FILENAME = WATERFLOW_CSV_FILENAME

                flow_rate = float(payload.get("flow_rate", {}).get("N", 0))
                unit = payload.get("unit", {}).get("S", "L/min")

                new_row = {
                    "timestamp": timestamp,
                    "device_id": device_id,
                    "flow_rate": flow_rate,
                    "unit": unit
                }
                new_waterflow_rows.append(new_row)

        def update_csv(bucket, filename, new_data):
            if not new_data:
                return
            try:
                response = s3.get_object(Bucket=bucket, Key=filename)
                existing_data = response["Body"].read().decode("utf-8")
                df = pd.read_csv(StringIO(existing_data))
                print("Existing CSV found {bucket}, appending new data")

            except Exception:
                print(f"No existing CSV found in {bucket}, creating new one")
                df = pd.DataFrame(columns=new_data[0].keys() if new_data else [])
                

            df = pd.concat([df, pd.DataFrame(new_data)], ignore_index=True)

            csv_buffer = StringIO()
            df.to_csv(csv_buffer, index=False)
            s3.put_object(
                Bucket=bucket,
                Key=filename,
                Body=csv_buffer.getvalue(),
                ContentType='text/csv'
            )

            print(f"Sensor data appended to CSV in S3: s3://{bucket}/{filename}")
        if new_sensehat_rows:
            update_csv(SENSEHAT_BUCKET, SENSEHAT_CSV_FILENAME, new_sensehat_rows)
        if new_waterflow_rows:
            update_csv(WATERFLOW_BUCKET, WATERFLOW_CSV_FILENAME, new_waterflow_rows)

        return {
            "statusCode": 200,
            "body": json.dumps("Training data updated and appended to CSV in S3")
        }
    except Exception as e:
        print(f"Error processing event: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps(f"Error processing event: {e}")
        }
   
        
     