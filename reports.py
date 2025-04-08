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
        
        # Conver timestamp strings to datetime objects
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Filter data by date range
        filtered_df = df[(df['timestamp'] >= start_date) & (df['timestamp'] <= end_date)]
        
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
    
    for item in data:
        try:
            if field in item and item[field] is not None:
                value = float(item[field])
                if value != 0: #Only add non zero values
                    values.append(value)
        except (TypeError, ValueError) as e:
            logger.warning(f"Error processing value for {field}: {e}")
            continue
            
    if not values:
        return {
            "min": None,
            "max": None,
            "avg": None,
            "count": len(data)
        }
    

    return {
        "min": min(values),
        "max": max(values),
        "avg": sum(values) / len(values),
        "count": len(data) # Total data points including invalid values
    }
    
def find_anomalies(data, field, threshold=2.0):
    """Find anomalies in data using standard deviation"""
    if not data:
        return []
    
    values = []
    
    for item in data:
        try:
            value = float(item.get(field, 0))
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
    
        anomalies = []
        for item in data:
            try:
                if field in item:
                    z_score = abs(item[field] - mean) / std_dev
                    if z_score > threshold:
                        anomalies.append({
                            "timestamp": item["timestamp"],
                            "value": item[field],
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
    
    # Create anommalies CSV
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
        from reportlab.platypus import SimpleDocTemplate, Table, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import inch
        
        # Create PDF in memory
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer,pagesize=letter,
                                rightMargin=72, leftMargin=72,
                                topMargin=72, bottomMArgin=18)
        
        # Styling
        styles = getSampleStyleSheet()
        
        # Collect content
        story = []
        #Title
        story.append(Paragraph("Environmental Data Report", styles['Title']))
        story.append(Spacer(1, 12))
        
        metadata = report_data.get('metadata', {})
        metadata_text = [
            f"Report ID: {metadata.get('report_id', 'N/A')}",
            f"Generated At:{metadata.get('generated_at', 'N/A')}",
            f"Time Range: {metadata.get('start_date', 'N/A')} to {metadata.get('end_date', 'N/A')}"
        ]
        
        for line in metadata_text:
            story.append(Paragraph(line, styles['Normal']))
        
        story.append(Spacer(1, 12))
        
        # Summary statistics
        summary = report_data.get('summary', {})
        if summary:
            story.append(Paragraph("Summary Statistices", styles["Heading2"]))
            summary_data = [['Metric', 'Min', 'Max', 'Average', 'Data Points']]
            
            for metric, stats in summary.items():
                summary_data.append([
                    metric.capitalize(),
                    f"{stats.get('min', 'N/A'):.2f}" if not None else 'N/A',
                    f"{stats.get('max', 'N/A'):.2f}" if not None else 'N/A',
                    f"{stats.get('avg', 'N/A'):.2f}" if not None else 'N/A',
                    f"{stats.get('count', 0)}"
                ])
            
            summary_table = Table(summary_data, repeatRows=1)
            story.append(summary_table)
        
        # Anomalies
        anomalies = report_data.get('anomalies', {})
        if anomalies:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Anomalies Detected", styles['Heading2']))
            
            anomaly_data = [['Metric', 'Timestamp', 'Value', 'Z-Score']]
            for metric, metric_anomalies in anomalies.items():
                for anomaly in metric_anomalies:
                    anomaly_data.append([
                        metric.capitalize(),
                        anomaly.get('timestamp', 'N/A'),
                        f"{anomaly.get('value', 'N/A'):.2f}" if anomaly.get('value') is not None else 'N/A',
                        f"{anomaly.get('z_score', 'N/A'):.2f}" if anomaly.get('z_score') is not None else 'N/A'
                    ])
            if len(anomaly_data) > 1:
                anomaly_table = Table(anomaly_data, repeatRows=1)
                story.append(anomaly_table)
                
        # Alerts
        alerts = report_data.get('alerts', [])
        if alerts:
            story.append(Spacer(1, 12))
            story.append(Paragraph("Alerts", styles['Heading2']))
            
            alerts_data = [['Date', 'Type', 'Message']]
            for alert in alerts:
                alerts_data.append([
                    alert.get('date', 'N/A'),
                    alert.get('type', 'N/A'),
                    alert.get('message', 'N/A')
                ])
            
            alerts_table = Table(alerts_data, repeatRows=1)
            story.append(alerts_table)
        
        doc.build(story)
        
        # Get PDF content
        pdf_content = buffer.getvalue()
        buffer.close()
        
        return pdf_content
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        # Fallback to simple text PDF
        return f"Error generating PDF: {str(e)}".encode('utf-8')
                
