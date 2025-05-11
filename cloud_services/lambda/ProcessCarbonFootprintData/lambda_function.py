import json
import boto3
import pandas as pd
from io import StringIO

s3 = boto3.client('s3')

SENSEHAT_BUCKET = "sensehat-longterm-storage"
WATERFLOW_BUCKET = "waterflow-longterm-storage"
TRAINING_BUCKET = "training-ecodetect"
BEDROOM2_BUCKET = "bedroom2-longterm-storage"
SENSEHAT_CSV_FILENAME = "carbon_footprint_training_sensehat.csv"
WATERFLOW_CSV_FILENAME = "carbon_footprint_training_waterflow.csv"
COMBINED_CSV_FILENAME = "carbon_footprint_training_combined.csv"

def lambda_handler(event, context):
    """"Lambda function to fetch CSV data an merge,updates whenever the seperate datasets update"""
    try:
        print(f"Recieved event: {json.dumps(event, indent=2)}")

        #Loading existing data from the combined dataset CSV
        try:
            combined_response = s3.get_object(Bucket=TRAINING_BUCKET, Key=COMBINED_CSV_FILENAME)
            df_combined_existing = pd.read_csv(StringIO(combined_response['Body'].read().decode('utf-8')))
            print(f"Successfully retrieved existing combined CSV from {TRAINING_BUCKET}")
        except Exception as e:
            print(f"Failed to retrieve existing combined CSV: {e}")
            df_combined_existing = pd.DataFrame()

        try:
            sensehat_response = s3.get_object(Bucket=SENSEHAT_BUCKET, Key=SENSEHAT_CSV_FILENAME)
            df_sensehat = pd.read_csv(StringIO(sensehat_response['Body'].read().decode('utf-8')))
            print(f"Successfully retrieved SenseHat CSV from {SENSEHAT_BUCKET}")
        except Exception as e:
            print(f"Failed to retrieve SenseHat CSV: {e}")
            df_sensehat = pd.DataFrame()

        try:
            waterflow_response = s3.get_object(Bucket=WATERFLOW_BUCKET, Key=WATERFLOW_CSV_FILENAME)
            df_waterflow = pd.read_csv(StringIO(waterflow_response['Body'].read().decode('utf-8')))
            print(f"Successfully retrieved WaterFlow CSV from {WATERFLOW_BUCKET}")
        except Exception as e:
            print(f"Failed to retrieve WaterFlow CSV: {e}")
            df_waterflow = pd.DataFrame()
        
        if "timestamp" not in df_sensehat.columns:
            df_sensehat["timestamp"] = None
        if "timestamp" not in df_waterflow.columns:
            df_waterflow["timestamp"] = None
        
        if not df_sensehat.empty or not df_waterflow.empty:
            df_combined_new = pd.merge(df_sensehat, df_waterflow, on='timestamp', how='outer')
        else:
            df_combined_new = pd.DataFrame()

        if df_combined_new.empty:
            print("No new data to merge.Combined CSV is not updated")
            return {
                'statusCode': 400,
                'body': json.dumps("No new data to merge")
            }
        
        # fills missing values
        df_combined_new.fillna({
            "temperature": 0.0,
            "humidity": 0.0,
            "pressure": 0.0,
            "imu_distance": 0.0,
            "flow_rate": 0.0,
            "unit": "N/A"
        },inplace=True)

        print("Successfully merged SenseHat and Water Flow data")

        if not df_combined_existing.empty:
            df_combined = pd.concat([df_combined_existing, df_combined_new], ignore_index=True)
            df_combined.drop_duplicates(subset=['timestamp'], keep='last', inplace=True)
            print("Successfully combined with existing data")
        else:
            df_combined = df_combined_new
            print("No existing data found, using new data as is")

        csv_buffer = StringIO()
        df_combined.to_csv(csv_buffer, index=False)

        s3.put_object(
            Bucket=TRAINING_BUCKET,
            Key=COMBINED_CSV_FILENAME,
            Body=csv_buffer.getvalue(),
            ContentType='text/csv'
        )
        
        print(f"Successfully updated combined CSV to S3: s3://{TRAINING_BUCKET}/{COMBINED_CSV_FILENAME}")

        return {
            'statusCode': 200,
            'body': json.dumps("Successfully updated combined CSV to S3")
        }
    except Exception as e:
        print(f"Failed to update combined CSV: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps(f"Failed to combine CSV: {e}")
        }
