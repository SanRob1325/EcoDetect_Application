import os
import json
import pandas as pd
import matplotlib.pyplot as plt
import boto3
import logging
from io import BytesIO, StringIO
from datetime import datetime,timedelta
from flask import jsonify, request, Blueprint
from pymongo import MongoClient
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key
# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

s3_client = boto3.client('s3', region_name='eu-west-1')
ses_client = boto3.client('ses', region_name='eu-west-1')
dynamodb = boto3.resource('dynamodb', region_name='eu-west-1')

# Load environment variables
try:
    load_dotenv = __import__('dotenv').load_dotenv
    load_dotenv()
except ImportError:
    logger.warning("dotenv package not available")
    
# Configure database connections
SENSEHAT_TABLE = os.getenv("SENSEHAT_TABLE", "SenseHatData")
WATER_TABLE = os.getenv("WATER_TABLE", "WaterFlowData")
ALERT_TABLE = os.getenv("ALERT_TABLE","Alerts")
REPORT_BUCKET = os.getenv("REPORT_BUCKET", "reports-ecodetect")
SES_EMAIL_SENDER = os.getenv("SES_EMAIL_SENDER")
THING_NAME = os.getenv("THING_NAME2", "Main_Pi")

# Create DynamoDB table references
sensor_table = dynamodb.Table(SENSEHAT_TABLE)
water_table = dynamodb.Table(WATER_TABLE)
alert_table = dynamodb.Table(ALERT_TABLE)

# Create Flask Blueprint
report_routes = Blueprint('reports', __name__)

# Inspiration for report generation integration: https://vonkunesnewton.medium.com/generating-pdfs-with-reportlab-ced3b04aedef
# Inspiration for report generation integration: https://pythonassets.com/posts/create-pdf-documents-in-python-with-reportlab/
def validate_report_parameters(params):
    """Validate he report genration parameters"""
    errors = []
    
    valid_time_ranges = ['daily', 'weekly', 'monthly', 'custom']
    if params.get('time_range') not in valid_time_ranges:
        errors.append(f"Invalid time range. Must be one of: {', '.join(valid_time_ranges)}")
    
    valid_data_types = ['temperature', 'humidity', 'pressure', 'water_usage', 'all']
    selected_data_types = params.get('data_types', [])
    
    if not selected_data_types:
        errors.append("At least one data type must be selected")
    else:
        for data_type in selected_data_types:
            if data_type not in valid_data_types:
                errors.append(f"Invalid data type: {data_type}")
    
    valid_formats = ['pdf', 'csv', 'json']
    if params.get('format') not in valid_formats:
        errors.append(f"Invalid format. Must be one of: {', '.join(valid_formats)}")
        
    # Validate custom date range if provided
    if params.get('time_range') == 'custom':
        if not params.get('custom_start') or not params.get('custom_end'):
            errors.append("Custom date range requires both start and end dates")
    return errors

def get_date_range(time_range, custom_start=None, custom_end=None):
    """Get start and end dates based on time range parameter"""
    end_date = datetime.now()
    
    if time_range == 'custom' and custom_start and custom_end:
        try:
            start_date = datetime.fromisoformat(custom_start.replace('Z', '+00:00'))
            end_date = datetime.fromisoformat(custom_end.replace('Z', '+00:00'))
        except ValueError:
            logger.error(f"Invalid date format: {custom_start} or {custom_end}")
            # Fallback to default range
            start_date = end_date - timedelta(days=7)
    else:
        if time_range == 'daily':
            start_date = end_date - timedelta(days=1)
        elif time_range == 'weekly':
            start_date = end_date - timedelta(days=7)
        else:
            # Monthly
            start_date = end_date - timedelta(days=30)
            
    return start_date, end_date

def fetch_sensor_data(start_date, end_date, data_types):
    """Fetch sensor data from DynamoDB for the specified period"""
    try:
        # Convert datetime to string format for DynamoDB query
        start_timestamp = start_date.isoformat()
        end_timestamp = end_date.isoformat()
        
        # Query DynamoDB for sensor data 
        response = sensor_table.query(
            KeyConditionExpression=Key('device_id').eq(THING_NAME) &
                                    Key('timestamp').between(start_timestamp, end_timestamp),
            ScanIndexForward=True # ascneding order
        )
        
        logger.debug(f"DynamodDB sensor data response: {response}")
        
        items = response.get('Items', [])
        
        if not items:
            logger.warning(f"No sensor data found in DynamoDB for period {start_date} to {end_date}")
            # Fallback to S3 data
            return fetch_sensor_data_from_s3(start_date, end_date, data_types)
        
        # Process items based on requested data types
        processed_items = []
        for item in items:
            try:
                processed_item = {
                    'timestamp': item.get('timestamp')
                }
                # Safe extract sensor data using get() 
                payload = item.get('payload', {})
                # Include requested fields
                if 'all' in data_types or 'temperature' in data_types:
                    if isinstance(payload, dict):
                        processed_item['temperature'] = float(payload.get('temperature', 0))
                    else:
                        # Handle case where the payload might be string
                        processed_item['temperature'] = float(item.get('temperature', 0))
                        
                if 'all' in data_types or 'humidity' in data_types:
                    if isinstance(payload, dict):
                        processed_item['humidity'] = float(payload.get('humidity', 0))
                    else:
                        processed_item['humidity'] = float(item.get('humidity', 0))
                        
                if 'all' in data_types or 'pressure' in data_types:
                    if isinstance(payload, dict):
                        processed_item['pressure'] = float(payload.get('pressure', 0))
                    else:
                        processed_item['pressure'] = float(item.get('pressure', 0))
                        
                processed_items.append(processed_item)
                
            except (TypeError, ValueError) as e:
                logger.error(f"Error processing sensor data item: {e}")
        
        logger.debug(f"processed sensor items: {processed_items}")
        return processed_items
        
    except Exception as e:
        logger.error(f"Error fetching sensor data from DynamoDB: {str(e)}")
        return []

def fetch_sensor_data_from_s3(start_date, end_date, data_types):
    """Fetch sensor data from S3 Bucket """
    try:
        # Get data from sensehat CSV in S3
        s3_bucket = os.getenv("SENSEHAT_DATA_BUCKET", "sensehat-longterm-storage")
        s3_key = os.getenv("SENSEHAT_DATA_KEY", "carbon_footprint_training_sensehat.csv")
        
        response = s3_client.get_object(
            Bucket=s3_bucket,
            Key=s3_key
        )
        
        content = response['Body'].read().decode('utf-8')
        df = pd.read_csv(StringIO(content))
        
        # Convert timestamp strings to datetime objects
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        start_date_np = pd.to_datetime(start_date)
        end_date_np = pd.to_datetime(end_date)
        # Filter data by date range
        filtered_df = df[(df['timestamp'] >= start_date_np) & (df['timestamp'] <= end_date_np)]
        
        if filtered_df.empty:
            logger.warning(f"No sensor data found in S3 for period {start_date} to {end_date}")
            return []

        # Process data based on requested types
        result = []
        for _, row in filtered_df.iterrows():
            data_point = {
                "timestamp": row['timestamp'].isoformat()
            }
            
            if 'all' in data_types or 'temperature' in data_types:
                data_point['temperature'] = float(row['temperature'])
                
            if 'all' in data_types or 'humidity' in data_types:
                data_point['humidity'] = float(row['humidity'])
            if 'all' in data_types or 'pressure' in data_types:
                data_point['pressure'] = float(row['pressure'])
            
            result.append(data_point)
        
        return result
    except Exception as e:
        logger.error(f"Error fetching sensor data from S3: {str(e)}")
        return []

def fetch_water_data(start_date,end_date):
    """Fetch water data from S3 bucket"""
    try:
        # Get data from waterflow CSV
        s3_bucket = os.getenv("WATERFLOW_DATA_BUCKET", "waterflow-longterm-storage")
        s3_key = os.getenv("WATERFLOW_DATA_KEY", "carbon_footprint_training_waterflow.csv")
        
        response = s3_client.get_object(
            Bucket=s3_bucket,
            Key=s3_key
        )
        
        content = response['Body'].read().decode('utf-8')
        df = pd.read_csv(StringIO(content))
        
        # Validate timestamp column
        if 'timestamp' not in df.columns:
            logger.error("No timestamp column in water data CSV")
            return []
        
        # Convert timestamp strings to datetime objects
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        
        df.dropna(subset=['timestamp'], inplace=True)
        
        filtered_df = df[(df['timestamp'] >= start_date) & (df['timestamp'] <= end_date)]
        
        if filtered_df.empty:
            logger.warning(f"No water data found for period {start_date} to {end_date}")
            return []
        
        
        # Process data
        result = []
        for _, row in filtered_df.iterrows():
            try:
                result.append({
                    "timestamp": row['timestamp'].isoformat(),
                    "flow_rate": float(row['flow_rate'])
                })
            except (TypeError, ValueError) as e:
                logger.error(f"Error processing water data row: {e}")
        return result
    
    except Exception as e:
        logger.error(f"Error fetching water data from S3: {str(e)}")
        return []
    
def fetch_alerts(start_date, end_date):
    """Fetch alerts for DynamoDB for date range"""
    try:
        # Convert date time to string format for scan filter
        start_timestamp = start_date.isoformat()
        end_timestamp = end_date.isoformat()
        
        # Scan the alerts table (since alerts could not have a consistent key structure)
        response = alert_table.scan(
            FilterExpression=Key('timestamp').between(start_timestamp, end_timestamp)
        )        
        
        if not response.get('Items', []):
            logger.warning(f"No alerts found in DynamoDB for period {start_date} to {end_date}")
            return []
        
        # Process alerts
        processed_alerts = []
        for item in response.get('Items', []):
            processed_alerts.append({
                'date': item.get('timestamp'),
                'type': item.get('severity', 'info'),
                'message': f"Thresholds exceeded: {', '.join(item.get('exceeded_thresholds', []))}"
            })
            
        return processed_alerts
    except Exception as e:
        logger.error(f"Error fetching alers from DynamoDB: {str(e)}")
        return []
    
def calculate_statistics(data, field):
    """Calculate basic statistics for a specific field"""
    if not data:
        return {
            "min": None,
            "max": None,
            "avg": None,
            "count": 0
        }
    
    values = []

    # Iterate over each item in the data/array
    for item in data:
        try:
            # Check if specified field exitst and is not None
            if field in item and item[field] is not None:
                value = float(item[field])
                if value != 0: #Only add non zero values
                    values.append(value)
        # Handle any errors during value extraction or conversion
        except (TypeError, ValueError) as e:
            logger.warning(f"Error processing value for {field}: {e}")
            continue
    # If no valid values are collected, return default statistics
    # Returns empty list if theres no minimum value
    if not values:
        return {
            "min": None,
            "max": None,
            "avg": None,
            "count": len(data) # Total data points
        }
    
    # Return and calcualte statistics using valid values
    return {
        "min": min(values),
        "max": max(values),
        "avg": sum(values) / len(values),
        "count": len(data) # Total data points including invalid values
    }
    
def find_anomalies(data, field, threshold=2.0):
    """Find anomalies in data using standard deviation"""
    # Returns an empty list if data is empty
    if not data:
        return []
    
    values = []
    
    # Extracct values from the data for the specified field
    for item in data:
        if field in item and item[field] is not None:
            try:
                value = float(item[field])
                values.append(value)
            except (TypeError, ValueError):
                continue
    
    if len(values) < 3:
        # Need at least 3 data points
        return []
    try:
        mean = sum(values) / len(values)
        variance = sum((x- mean) ** 2 for x in values) / len(values)
        std_dev = variance ** 0.5

        # Avoids division by zer
        if std_dev == 0:
            return []
        
        anomalies = []
        for item in data:
            if field in item and item[field] is not None:
                try:
                    value = float(item[field])
                    z_score = abs(value - mean) / std_dev
                    if z_score > threshold:
                        anomalies.append({
                            "timestamp": item["timestamp"],
                            "value": value,
                            "z_score": z_score
                        })
                except (TypeError, ValueError):
                    continue       
        return anomalies
    except Exception as e:
        logger.error(f"Error calculating anomalies: {str(e)}")
        return []

def generate_report_data(user_id, data_types, start_date, end_date):
    """Generate the report data structure"""
    try:
        # Fetch required data
        sensor_data = fetch_sensor_data(start_date, end_date, data_types)
    
        water_data = []
        if 'all' in data_types or 'water_usage' in data_types:
            water_data = fetch_water_data(start_date, end_date)
    
        alerts = fetch_alerts(start_date, end_date)
    
        # Generate unique report ID
        report_id = f"report-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
        # Build report structure
        report = {
            "metadata": {
                "report_id": report_id,
                "user_id": user_id,
                "generated_at": datetime.now().isoformat(),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "data_types": data_types,
                "data_points": len(sensor_data) + len(water_data)
            },
            "summary": {},
            "anomalies": {},
            "alerts": []
        }
    
        # Calculate statistics and find anomalies
        for data_type in data_types:
            if data_type == 'all':
                continue
            # Select data source 
            if data_type in ['temperature', 'humidity', 'pressure']:
                data_source = sensor_data
            elif data_type == 'water_usage':
                data_source = water_data
            else:
                continue
            
            stats = calculate_statistics(data_source, data_type)
            if stats and stats['count'] > 0:
                report["summary"][data_type] = stats
            
            # Find anomalies 
            anomalies = find_anomalies(data_source, data_type)
            if anomalies:
                report["anomalies"][data_type] = anomalies
        return report, report_id
    except Exception as e:
        logger.error(f"Comprehensive error in report generation: {str(e)}")
        # Raise more information in the error
        raise ValueError(f"Failed to generate report: {str(e)}")

def generate_csv_report(report_data):
    """Generate CSV data from the report data"""
    csv_files = {}
    
    # Create sensor data CSV
    if 'temperature' in report_data['summary'] or 'humidity' in report_data['summary'] or 'pressure' in report_data['summary']:
        sensor_data = fetch_sensor_data(
            datetime.fromisoformat(report_data['metadata']['start_date']),
            datetime.fromisoformat(report_data['metadata']['end_date']),
            report_data['metadata']['data_types']
        )
        
        if sensor_data:
            sensor_df = pd.DataFrame(sensor_data)
            csv_files['sensor_data'] = sensor_df.to_csv(index=False)
    
    # Create water usage CSV
    if 'water_usage' in report_data['summary']:
        water_data = fetch_water_data(
            datetime.fromisoformat(report_data['metadata']['start_date']),
            datetime.fromisoformat(report_data['metadata']['end_date'])
        )
        
        if water_data:
            water_df = pd.DataFrame(water_data)
            csv_files['water_usage'] = water_df.to_csv(index=False)
    
    # Create anomalies CSV, detects if theres any recent anomalies been registered
    anomalies_data = []
    for data_type, anomaly_list in report_data['anomalies'].items():
        for anomaly in anomaly_list:
            anomaly_record = anomaly.copy()
            anomaly_record['data_type'] = data_type
            anomalies_data.append(anomaly_record)
    
    if anomalies_data:
        anomalies_df = pd.DataFrame(anomalies_data)
        csv_files['anomalies'] = anomalies_df.to_csv(index=False)
    
    # Create alerts CSV
    if report_data['alerts']:
        alerts_df = pd.DataFrame(report_data['alerts'])
        csv_files['alerts'] = alerts_df.to_csv(index=False)
        
    # Returns the dictionary containg generated CSV file content
    return csv_files

def store_report(user_id, report_id, report_data, report_format):
    """Store the report in S3 and return the download URL"""
    try:
        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        s3_key = f"reports/{user_id}/{report_id}/{timestamp}.{report_format}"
        
        # Prepare content based on format
        if report_format == 'json':
            content = json.dumps(report_data, default=str)
            content_type = 'application/json'
            body = content.encode('utf-8')
        
        elif report_format == 'csv':
            csv_data = generate_csv_report(report_data)
            
            # If multiple CSVs and create a zip file
            if len(csv_data) > 1:
                import zipfile
                zip_buffer = BytesIO()
                
                with zipfile.ZipFile(zip_buffer, 'a', zipfile.ZIP_DEFLATED) as zip_file:
                    for name, data in csv_data.items():
                        zip_file.writestr(f"{name}.csv", data)
                
                body = zip_buffer.getvalue()
                content_type = 'application/zip'
                s3_key = s3_key.replace('.csv', '.zip')
            else:
                # Single CSV
                name, data = next(iter(csv_data.items()))
                body = data.encode('utf-8')
                content_type = 'text/csv'
        
        elif report_format == 'pdf':
            # Generates simple text representation
            body = generate_pdf_report(report_data)
            content_type = 'application/pdf'
        
        else:
            raise ValueError(f"Unsupported format: {report_format}")
        
        # Upload to S3
        s3_client.put_object(
            Bucket=REPORT_BUCKET,
            Key=s3_key,
            Body=body,
            ContentType=content_type
        )
        
        # Generate presigned URL for download (valid for 24 hours)
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': REPORT_BUCKET,
                'Key': s3_key
            },
            ExpiresIn=86400 # 24 hours
        )
        
        return download_url
    except Exception as e:
        logger.error(f"Error storing report:  {e}")
        raise

def send_email_with_report(email, report_id, download_url, report_format, time_range):
    """Send an email with report download link"""
    try:
        subject = f"Your {time_range} Environmental Report is Ready"
        
        body_text = f"""
        
Hello,

Your environmental data report (ID: {report_id}) is now available for download.
Download Link: {download_url}
Format: {report_format.upper()}
Time Range: {time_range}

This link will expire in 24 hours.

Thank you for using EcoDetect!
        
        """
        
        response = ses_client.send_email(
            Source=SES_EMAIL_SENDER,
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject},
                'Body': {
                    'Text': {'Data': body_text}
                }
            }
        )
        
        logger.info(f"Email sent to {email} with MessageId: {response['MessageId']}")
        return True
    
    except ClientError as e:
        logger.error(f"Error sending email: {e.response['Error']['Message']}")
        return False
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        return False
    
@report_routes.route('/api/reports/preview', methods=['POST'])
def preview_reports():
    """Generate a preview of the report"""
    try:
        # Get parameters from request
        params = request.json
        
        # Validated parameters
        validation_errors = validate_report_parameters(params)
        if validation_errors:
            return jsonify({
                "success": False,
                "errors": validation_errors
            }), 400
        
        # Extract parameters
        time_range = params.get('time_range')
        data_types = params.get('data_types', [])
        custom_start = params.get('custom_start')
        custom_end = params.get('custom_end')
        
        # Get date range
        start_date, end_date = get_date_range(time_range, custom_start,custom_end)
        
        try:
            # Generate report data (user_id is amock for the preview)
            report_data, _ = generate_report_data("preview_user", data_types, start_date, end_date)

            
            # Check if any data is available
            if not report_data['summary'] and not report_data['alerts']:
                return jsonify({
                    "success": False,
                    "message": "No data available for the selected criteria"
                }), 404
            
            return jsonify({
                "success": True,
                "data": report_data
            })
        except ZeroDivisionError:
            # Specifically handle division by zero errors
            logger.error("Division by zero error in report generation")
            return jsonify({
                "success": False,
                "message": "No data varialable for statistical calculsations"
            }), 500
        except ValueError as ve:
            # Handle value errors like datetime comparison issues
            logger.error(f"Value error in report generation: {str(ve)}")
            return jsonify({
                "success": False,
                "message": f"Error processing data: {str(ve)}"
            }), 500
    
    except Exception as e:
        logger.error(f"Error generating report preview: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"An error occurred: {str(e)}"
        }), 500
        
@report_routes.route('/api/reports', methods=['POST'])
def generate_report():
    """Generate and store a report"""
    try:
        # Get parameters from request
        params = request.json
        
        # Validate parameters
        validation_errors = validate_report_parameters(params)
        if validation_errors:
            return jsonify({
                "success": False,
                "errors": validation_errors
            }), 400
        
        # Extract parameters
        time_range = params.get('time_range')
        data_types = params.get('data_types', [])
        report_format = params.get('format')
        email = params.get('email')
        custom_start = params.get('custom_start')
        custom_end = params.get('custom_end')
        
        # Get date range
        start_date, end_date = get_date_range(time_range, custom_start, custom_end)
        
        # Generate report data (usin a dummy user ID for now)
        user_id = "user123"
        
        try:
            report_data, report_id = generate_report_data(user_id, data_types, start_date, end_date)
        except ValueError as ve:
            logger.warning(f"Report generation error: {str(ve)}")
            return jsonify({
                "success": False,
                "message": "No data available for the selected criteria"
            }), 404
        
        # Ensure that meaningful data is added
        if not report_data.get('summary') and not report_data.get('alerts'):
            return jsonify({
                "success": False,
                "message": "No data available for the selected criteria"
            }), 404
            
        # Store report
        try:
            download_url = store_report(user_id, report_id, report_data, report_format)
        except Exception as store_error:
            logger.error(f"Report storage error: {str(store_error)}")
            return jsonify({
                "success": False,
                "message": "Failed to store the generated report"
            }), 500
            
        # Send email if requested
        email_sent = False
        if email:
            try:
                email_sent = send_email_with_report(
                    email,
                    report_id,
                    download_url,
                    report_format,
                    time_range
                )
            except Exception as email_error:
                logger.error(f"Email sending error: {str(email_error)}")
                # So that the entire request does not fail
                
        return jsonify({
            "success": True,
            "report_id": report_id,
            "download_url": download_url,
            "email_sent": email_sent
        })
    
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"An error occurred: {str(e)}"
        }), 500
        

def generate_pdf_report(report_data):
    """Generate more comprehensive report"""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.platypus import TableStyle
        
        # Eco friendly colors
        eco_dark_green = colors.Color(0.13, 0.55, 0.13) # Dark Green
        eco_light_green = colors.Color(0.56, 0.93, 0.56) # Light green
        eco_blue = colors.Color(0.12, 0.47, 0.71) # Water like blue
        eco_earth = colors.Color(0.55, 0.34, 0.17) # brown


        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer,pagesize=letter,
                                rightMargin=0.5*inch, leftMargin=0.5*inch,
                                topMargin=0.5*inch, bottomMargin=0.5*inch)
        
        # Styling
        styles = getSampleStyleSheet()
        
        # Custom Title style with green
        title_style = ParagraphStyle(
            'EcoTitle',
            parent=styles['Title'],
            textColor=eco_dark_green,
            fontSize=24,
            spaceAfter=16
        )

        heading1_style = ParagraphStyle(
            'EcoHeading1',
            parent=styles['Heading1'],
            textColor=eco_dark_green,
            fontSize=18,
            spaceAfter=10
        )

        heading2_style = ParagraphStyle(
            'EcoHeading2',
            parent=styles['Heading2'],
            textColor=eco_blue,
            fontSize=16,
            spaceAfter=8
        )

        # Normal text style
        normal_style = ParagraphStyle(
            'EcoNormal',
            parent=styles['Normal'],
            fontSize=10,
            leading=14
        )

        # Info text style
        info_style = ParagraphStyle(
            'EcoInfo',
            parent=styles['Italic'],
            textColor=eco_blue,
            fontSize=9
        )

        # Collect content
        story = []
        #Title
        story.append(Paragraph("Environmental Data Report", title_style))
        story.append(Spacer(1, 0.1*inch))
        
        # Decorative line
        story.append(Paragraph("<hr width='100%' color='#8fed8f' />" , normal_style))
        metadata = report_data.get('metadata', {})
        story.append(Paragraph("Report Information", heading1_style))

        metadata_text = [
            f"<b>Report ID:</b> {metadata.get('report_id', 'N/A')}",
            f"<b>Generated At:</b>{metadata.get('generated_at', 'N/A')}",
            f"<b>Time Range:</b> {metadata.get('start_date', 'N/A')} to {metadata.get('end_date', 'N/A')}",
            f"<b>Data Types:</b> {', '.join(metadata.get('data_types', ['N/A']))}",
            f"<b>Total Data Points: </b> {metadata.get('data_points', 0)}"
        ]
        
        for line in metadata_text:
            story.append(Paragraph(line, normal_style))
        
        story.append(Spacer(1, 0.2*inch))
        
        # Summary statistics
        summary = report_data.get('summary', {})
        if summary:
            story.append(Paragraph("Summary Statistics", heading1_style))
            story.append(Paragraph("The following table shows key metrics from your main environmental monitoring system", info_style))
            story.append(Spacer(1, 0.1*inch))

            summary_data = [['Metric', 'Min', 'Max', 'Average', 'Data Points']]
            
            for metric, stats in summary.items():
                # Format the metic name to a user friendly style
                metric_name = metric.replace('_', ' ').title()

                # Add units based on the metric type
                unit = ""
                if metric == 'temperature':
                    unit = "°C"
                elif metric == 'humidity':
                    unit = "%"
                elif metric == 'pressure':
                    unit = "hPa"
                elif metric == 'flow_rate':
                    unit = "L/min"

                # Formats the values into units
                min_val = f"{stats.get('min'):.2f} {unit}" if stats.get('min') is not None else 'N/A'
                max_val = f"{stats.get('max'):.2f} {unit}" if stats.get('max') is not None else 'N/A'
                avg_val = f"{stats.get('avg'):.2f} {unit}" if stats.get('avg') is not None else 'N/A'


                summary_data.append([
                    metric_name,
                    min_val,
                    max_val,
                    avg_val,
                    f"{stats.get('count', 0)}"
                ])
            
            summary_table = Table(summary_data, repeatRows=1)
            summary_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0,0), (-1,0), eco_dark_green),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,0), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0,0), (-1, 0), 8),
                # Data styling
                ('BACKGROUND', (0,1), (-1, -1), colors.white),
                ('GRID', (0,0), (-1, -1), 0.5, eco_light_green),
                ('ALIGN', (1,1), (-1, -1), 'CENTER'),

                # For alternate colors and clearer report vierw
                ('ROWBACKGROUNDS', (0,1), (-1, -1), [colors.white, colors.Color(0.95,0.98, 0.95)])
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 0.2*inch))
        
        # Anomalies
        anomalies = report_data.get('anomalies', {})
        if anomalies:
            story.append(Paragraph("Anomalies Detected", heading1_style))
            story.append(Paragraph("The following readings deviated significantly from the normal environmental patterns and could require more attention", info_style))
            story.append(Spacer(1, 0.1*inch))
            
            anomaly_data = [['Metric', 'Timestamp', 'Value', 'Deviation (Z-Score)']]
            for metric, metric_anomalies in anomalies.items():
                # Formats the metrics to a user friendly format
                metric_name = metric.replace('_', ' ').title()

                # Adds the units based in the metric type
                unit = ""
                if metric == 'temperature':
                    unit = "°C"
                elif metric == 'humidity':
                    unit = "%"
                elif metric == 'pressure':
                    unit = "hPa"
                elif metric == 'flow_rate':
                    unit = "L/min"

                for anomaly in metric_anomalies:
                    # Formats
                    try:

                        from datetime import datetime
                        timestamp = datetime.fromisoformat(anomaly.get('timestamp').replace('Z', '+00:00'))
                        formatted_timestamp = timestamp.strftime("%Y-%m-%d %H:%M")
                    except:
                        formatted_timestamp = anomaly.get('timestamp', 'N/A')
                    
                    # Formats the value with the unit
                    value = f"{anomaly.get('value'):.2f} {unit}" if anomaly.get('value') is not None else 'N/A'
                    
                    anomaly_data.append([
                        metric_name,
                        formatted_timestamp,
                        value,
                        f"{anomaly.get('z_score', 'N/A'):.2f}" if anomaly.get('z_score') is not None else 'N/A'
                    ])
            if len(anomaly_data) > 1:
                anomaly_table = Table(anomaly_data, repeatRows=1)
                anomaly_table.setStyle(TableStyle([
                    # Header styling
                    ('BACKGROUND', (0,0), (-1, 0), eco_blue),
                    ('TEXTCOLOR', (0,0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                    # Data styling
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, eco_light_green),
                    ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
                    # Z- Score coloring based on severity
                    ('TEXTCOLOR', (3, 1), (3, -1), colors.red)
                ]))
                story.append(anomaly_table)
                story.append(Spacer(1, 0.2*inch))
                
        # Alerts
        alerts = report_data.get('alerts', [])
        if alerts:
            story.append(Paragraph("Environmental Alerts", heading1_style))
            story.append(Paragraph("The following alerts were generated during the reporting period.", info_style))
            story.append(Spacer(1, 0.1*inch))
            
            alerts_data = [['Date', 'Type', 'Message']]
            for alert in alerts:
                # Formats the timestamp to be readable
                try:
                    from datetime import datetime
                    timestamp = datetime.fromisoformat(alert.get('date').replace('Z', '+00:00'))
                    formatted_date = timestamp.strftime("%Y-%m-%d %H:%M")
                except:
                    formatted_date = alert.get('date', 'N/A')
                
                alerts_data.append([
                    formatted_date,
                    alert.get('type', 'N/A').capitalize(),
                    alert.get('message', 'N/A')
                ])
            
            alerts_table = Table(alerts_data, repeatRows=1)
            alerts_table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0,0), (-1, 0), eco_earth),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                # Data Styling
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, eco_light_green),
                # Message column alignments
                ('ALIGN', (0, 1), (1, -1), 'CENTER'),
                ('ALIGN', (2, 1), (2, -1), 'LEFT'),
                # Alternate row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.98, 0.95)])
            ]))
            story.append(alerts_table)
        
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Environmental Tips", heading2_style))

        tips = [
            "Monitor your water usage patterns to identify potential leaks or inefficiencies.",
            "Maintain optimal indoor humdity between 30-50% to reduce energy usage and improve air quality,",
            "Regular maintenance of your monitoring equipment ensures accurate readings and early detection issues.",
            "Consider setting up custom alerts for your specific environmental goals."
        ]
        
        for tip in tips:
            story.append(Paragraph(f" - {tip}", normal_style))
        
        # Footer styling
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("<hr width='100%' color='#8fed8f' />", normal_style))
        footer_text = "EcoDetect - Helping you create a sustainable environment through smart monitoring"
        story.append(Paragraph(footer_text, info_style))

        doc.build(story)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        buffer.close()
        
        return pdf_content
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        # Fallback to a simple PDF if theres an error
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet

        try:
            # Creates a fallback PDF
            buffer = BytesIO()
            document = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()

            story = [
                Paragraph("EcoDetect Report (Error with formatting)", styles['Title']),
                Paragraph(f"Report generated but formatting failled: {str(e)}", styles['Normal']),
                Paragraph("Report Data:", styles['Heading2'])
            ]

            # Add raw data as a text
            for key, value in report_data.items():
                story.append(Paragraph(f"{key}: :{value}", styles['Normal']))
            
            document.build(story)
            return buffer.getvalue()
        except:
            # If the fallback fails, oonly return a plain text 
            return f"Error generating PDF: {str(e)}".encode('utf-8')
                
