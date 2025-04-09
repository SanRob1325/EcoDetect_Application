import os
import json
import logging
import boto3
from datetime import datetime
from flask import current_app
from decimal import Decimal
#Set up Logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class AlertService:
    """Manage alert generation, delivery, and tracking based on sensor thresholds"""
    
    # Cahche alerts to prevent duplicates 
    _alert_cache = {}
    _CACHE_TTL = 15 * 60 # Aound 15 minutes in seconds
    
    def __init__(self,sns_client=None,ses_client=None,dynamodb=None,mongo_db=None):
        """Initailaise the alert Service with AWS clients ad database connections"""
        self.sns_client = sns_client or boto3.client("sns", region_name="eu-west-1")
        self.ses_client = ses_client or boto3.client("ses", region_name="eu-west-1")
        self.dynamodb = dynamodb or boto3.resource("dynamodb", region_name="eu-west-1")
        self.mongo_db = mongo_db
        
        
        # Get environment variables
        self.sns_topic_arn = os.getenv("SNS_TOPIC_ARN")
        self.ses_email_sender = os.getenv("SES_EMAIL_SENDER")
        self.ses_email_recipient = os.getenv("SES_EMAIL_RECIPIENT")
        
        self.threshold_table_name = os.getenv("THRESHOLD_TABLE","Thresholds")
        # Connect to DynamoDB tables
        self.threshold_table = self.dynamodb.Table(self.threshold_table_name)
        
    def check_thresholds(self, raw_data):
        """Check the sensor data against configured thresholds and trigger alerts if exceeded"""
    
        try:
            exceeded_thresholds = []
            thresholds = self._get_thresholds()
        
            # Log raw data and thresholds for debugging
            print(f"DEBUG: Raw data: {raw_data}")
            print(f"DEBUG: Thresholds: {thresholds}")
        
            # Extract sensor data from nested structure
            sensor_data = {}
        
            if 'payload' in raw_data and 'M' in raw_data.get('payload', {}):
                # Extract from DynamoDB payload
                payload = raw_data['payload']['M']
            
                device_id = payload.get('device_id', {}).get('S', '')
                sensor_data['timestamp'] = payload.get('timestamp', {}).get('S', '')
                sensor_data['device_id'] = device_id
                sensor_data['location'] = f"Device {device_id}"
            
                if 'WaterSensor' in device_id:
                    # Handle water flow data
                    if 'flow_rate' in payload:
                        sensor_data['flow_rate'] = float(payload['flow_rate']['N'])
                        sensor_data['unit'] = payload.get('unit', {}).get('S', 'L/min')
                
                else:
                    # Handle Sensehat data
                    if 'temperature' in payload:
                        sensor_data['temperature'] = float(payload['temperature']['N'])
                    if 'humidity' in payload:
                        sensor_data['humidity'] = float(payload['humidity']['N'])
                    if 'pressure' in payload:
                        sensor_data['pressure'] = float(payload['pressure']['N'])
        
            else:
                # Handle JSON data that's not from DynamoDB
                sensor_data = raw_data
        
            print(f"DEBUG: Processed sensor data: {sensor_data}")
        
            # Rest of the method with debug output...
            if 'temperature' in sensor_data and 'temperature_range' in thresholds:
                temp = sensor_data['temperature']
                temp_range = thresholds['temperature_range']
                print(f"DEBUG: Comparing temperature {temp} with range {temp_range}")
                print(f"DEBUG: Is temp < low? {temp < temp_range[0]}")
                print(f"DEBUG: Is temp > high? {temp > temp_range[1]}")
            
                if temp < temp_range[0]:
                    exceeded_thresholds.append('temperature_low')
                    print("DEBUG: Added temperature_low to exceeded_thresholds")
            
                elif temp > temp_range[1]:
                    exceeded_thresholds.append('temperature_high')
                    print("DEBUG: Added temperature_high to exceeded_thresholds")
        
            if 'humidity' in sensor_data and 'humidity_range' in thresholds:
                humidity = sensor_data['humidity']
                humidity_range = thresholds['humidity_range']
                print(f"DEBUG: Comparing humidity {humidity} with range {humidity_range}")
                print(f"DEBUG: Is humidity < low? {humidity < humidity_range[0]}")
                print(f"DEBUG: Is humidity > high? {humidity > humidity_range[1]}")
            
                if humidity < humidity_range[0]:
                    exceeded_thresholds.append('humidity_low')
                    print("DEBUG: Added humidity_low to exceeded_thresholds")
                elif humidity > humidity_range[1]:
                    exceeded_thresholds.append('humidity_high')
                    print("DEBUG: Added humidity_high to exceeded_thresholds")
        
            if 'flow_rate' in sensor_data and 'flow_rate_threshold' in thresholds:
                flow_rate = sensor_data['flow_rate']
                flow_threshold = thresholds['flow_rate_threshold']
                print(f"DEBUG: Comparing flow_rate {flow_rate} with threshold {flow_threshold}")
                print(f"DEBUG: Is flow_rate > threshold? {flow_rate > flow_threshold}")
            
                if flow_rate > flow_threshold:
                    exceeded_thresholds.append('water_usage_high')
                    print("DEBUG: Added water_usage_high to exceeded_thresholds")
        
            print(f"DEBUG: Final exceeded_thresholds: {exceeded_thresholds}")
        
            # If thresholds are exceeded trigger alerts
            if exceeded_thresholds:
                self._trigger_alerts(sensor_data, exceeded_thresholds, thresholds)
                self._store_alert_history_dynamodb(sensor_data, exceeded_thresholds, thresholds)
        
            return exceeded_thresholds
        except Exception as e:
            logger.error(f"Error checking thresholds: {str(e)}")
            print(f"DEBUG: Exception in check_thresholds: {str(e)}")
            return []
    
    def _get_thresholds(self):
        """Retrieving threhold settings from database, with fallback defaults"""
        
        if self.mongo_db is not None: # Comparing with none
            mongo_thresholds = self.mongo_db.thresholds.find_one({}, {"_id":0})
            if mongo_thresholds is not None:
                return mongo_thresholds
            
        # Then try DynamoDB
        try:
            response = self.threshold_table.scan()
            if response.get('Items'):
                return response['Items'][0]
        
        except Exception as e:
            logger.error(f"Error retrieving thresholds from DynamoDB: {str(e)}")
            
        return {
            "temperature_range": [20,25],
            "humidity_range": [30,60],
            "flow_rate_threshold": 10,
        }
    
    def _trigger_alerts(self, sensor_data, exceeded_thresholds, thresholds):
        
        """Sends notifications for exceeded thresholds"""
        message = self._generate_alert_message(sensor_data, exceeded_thresholds, thresholds)
        
        # send SMS alert via SNS
        self._send_sns_alert(message)
        
        # Send email alert via SES
        self._send_email_alert(
            subject="Environmental Alert: Threshold Exceeded",
            message=message,
            sensor_data=sensor_data,
            exceeded_thresholds=exceeded_thresholds,
            thresholds=thresholds
        )
    
    def _generate_alert_message(self, sensor_data, exceeded_thresholds, thresholds):
        """Create a formatted alert message based on exceeded thresholds"""
        location = sensor_data.get('location', 'unknown location')
        timestamp = sensor_data.get('timestamp', datetime.now())
        if isinstance(timestamp, str):
            # Parse ISO format if it's a string
            try:
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            
            except ValueError:
                timestamp = datetime.now()
        
        message = f"Alert: environmental conditions exceeded at {location} ({timestamp.strftime('%Y-%m-%d %H:%M:%S')})"
        
        for threshold in exceeded_thresholds:
            if threshold == 'temperature_high':
                message += f"Temperature is too high: {sensor_data.get('temperature')} C (Threshold: {thresholds.get('temperature_range', [0,25])[1]})"
                message += "Recommended action: Increase ventilation or activate cooling system,or decrease heating of the house.\n\n"
                
            elif threshold == 'temperature_low':
                message += f"Temperature is too low: {sensor_data.get('temperature')} C (Threshold: {thresholds.get('temperature_range', [20, 100])[0]})"
                message += "Recomended action: Check heating system or increase temperature.\n\n"

            elif threshold == 'humidity_high':
                message += f"Humidity is too high:{sensor_data.get('humidity')}% (Threshold: {thresholds.get('humidity_range', [0 ,60])[1]})"
                message += "Recommended action: Use a dehumidfier or increase ventilation"
            
            elif threshold == 'humidity_low':
                message += f"Humidity is too low: {sensor_data.get('humidity')}% (Threshold: {thresholds.get('humidity_range', [30, 100])[0]})"
                message += "Recommended action: Use a humidifier to increase moisture in the air"
            
            elif threshold == 'water_usage_high':
                message += f"Water usage is too high: {sensor_data.get('flow_rate')} L/min (Threshold: {thresholds.get('flow_rate_threshold', 10)} L/min)\n"            
                message += "Recommeneded action: Check for leaks or reduce water consumption"
        message += "Login to dashboard for more detials and historical data"
        return message
    
    def _send_sns_alert(self,message):
        """Sends an SMS notification via AWS SNS"""
        try:
            if not self.sns_topic_arn:
                logger.warning("SNS_TOPIC_ARN not configure, skipping SMS alert")
                return
            
            response = self.sns_client.publish(
                TopicArn=self.sns_topic_arn,
                Message=message,
                Subject="Environmental Alert"
            )
            
            logger.info(f"SMS alert sent successfully: {response.get('MessageId')}")
        except Exception as e:
            logger.error(f"Failed to send SMS alert: {str(e)}")
            # Logs failure in Cloudwatch
            
    def _send_email_alert(self,subject, message, sensor_data, exceeded_thresholds,thresholds):
        """Sends an email notification through AWS SES"""
        try:
            if not self.ses_email_sender or not self.ses_email_recipient:
                logger.warning("SES email configuration incomplete skipping email alert")
                return
        
            html_body = self._generate_html_email(
                sensor_data,
                exceeded_thresholds,
                thresholds
            )
        
            response = self.ses_client.send_email(
                Source=self.ses_email_sender,
                Destination={
                
                    "ToAddresses": [self.ses_email_recipient]
                },
                Message={
                    "Subject": {
                        "Charset": "UTF-8",
                        "Data": subject
                    },
                    "Body": {
                        "Html":{
                            "Charset": "UTF-8",
                            "Data": html_body
                        },
                        "Text": {
                        "Charset": "UTF-8",
                        "Data": message
                        }
                    }
                }
            )
        
            logger.info(f"Email alert sent successfully: {response.get('MessageId')}")
        except Exception as e:
            logger.error(f"Failed to send email alert: {str(e)}")
            
    
    def _generate_html_email(self,sensor_data, exceeded_thresholds, thresholds):
        """Creates an HTML formatted email with detailed alert information"""
        location = sensor_data.get('location', 'unknown location')
        timestamp = sensor_data.get('timestamp', datetime.now())
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except ValueError:
                timestamp = datetime.now()
        
        # Format timestamp as a readable string
        timestamp_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
        
        html = f"""
        
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333;}}
                .container {{ max-width: 600px; margin: 0 auto; }}
                .header {{ background-color: #4a90e2; color:white; padding: 15px; border-radius: 5px 5px 0 0; }}
                .content {{ background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }}
                .alert {{ color: #D8000C; background-color: #FFBABA; padding: 10px; border-radius: 5px; margin-bottom: 15px;}}
                .reading {{ margin: 15px 0; padding-bottom: 10px; border-bottom: 1px solid #eee; }}
                .threshold {{ font-weight: bold; }}
                .action {{ margin-top: 5px; font-style: italic; color: #666; }}
                .footer {{ margin-top: 20px; font-size: 0.9em; color: #66; text-align: center}}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2> Environmental Alert Notification </h2>
                </div>
                <div class="content">
                    <p>The folowing thresholds have been exceeded at <strong>{location}</strong> at {timestamp_str}:</p>
                    
                    <div class="alert">
        """
        
        # Add content for each exceeded threshold
        if 'temperature_high' in exceeded_thresholds:
            html += f"""
            
                        <div class="reading">
                            <p class="threshold">Temperature is too high: {sensor_data.get('temperature')} C (Threshold: {thresholds.get('temperature_range', [0, 25])[1]})</p>
                            <p class="action">Recommended action: Increase ventilation cooling system.</p>
                        </div>   
                            
            """
        if 'temperature_low' in exceeded_thresholds:
            html += f"""
            
                        <div class="reading">
                            <p class="threshold">Temperature is too low: {sensor_data.get('temperature')} C (Threshold: {thresholds.get('temperature_range', [20, 100])[0]})</p>
                            <p class="action">Recommended action: Check heating system or increase temperature setting</p>
                        </div>   
                            
            """
        if 'humidity_high' in exceeded_thresholds:
             html += f"""
            
                        <div class="reading">
                            <p class="threshold">Humidity is too high: {sensor_data.get('humidity')}% (Threshold: {thresholds.get('humidity_range', [0, 60])[1]})</p>
                            <p class="action">Recommended action: Use dehumidifier or increase ventilation</p>
                        </div>   
                            
            """
        if 'humidity_low' in exceeded_thresholds:
             html += f"""
            
                        <div class="reading">
                            <p class="threshold">Humidity is too low: {sensor_data.get('humidity')}% (Threshold: {thresholds.get('humidity_range', [30, 100])[0]})</p>
                            <p class="action">Recommended action: Use humidifier to increase moisture in the air</p>
                        </div>   
                            
            """
        if 'water_usage_high' in exceeded_thresholds:
             html += f"""
            
                        <div class="reading">
                            <p class="threshold">Water usage is too high: {sensor_data.get('flow_rate')} L/min (Threshold: {thresholds.get('flow_rate_threshold', 10)} L/min)</p>
                            <p class="action">Recommended action: Check for leaks or reduce water consumption</p>
                        </div>   
                            
            """
        
        dashboard_url = os.getenv('DASHBOARD_URL', 'https://localhost:3000')
        html += f"""
                    </div>
                    
                    <p> For more detailed information and historical data, please <a href="{dashboard_url}">login to you dashboard</a></p>
                </div>
                <div class="footer">
                    <p> This is an automated message from your EcoDetect Monitoring System. </p>
                </div>
            </div>
        </body>
        </html>       
        """
        
        return html

    def _is_alert_in_cache(self,key):
        """Checks if alert was recently sent to avoid any duplicates"""
        
        now = datetime.now().timestamp()
        if key not in self._alert_cache:
            return False
        
        cache_time = self._alert_cache[key]
        # If cached alert is older than TTL, it should  be considered as expired
        if now - cache_time > self._CACHE_TTL:
            # Deletes object
            del self._alert_cache[key]
            return False
        return True
    
    def _add_to_cache(self, key):
        """Adds alerts to cahce with the current timestamp"""
        
        # Cleans up the old cache entries
        self._alert_cache[key] = datetime.now().timestamp()
        
        if len(self._alert_cache) > 100:
            self._clean_cache()
            
    def _clean_cache(self):
        """Removes expired entries for the alert cache"""
        now = datetime.now().timestamp()
        expired_keys = [
            k for k, v in self._alert_cache.items()
            if now -v > self._CACHE_TTL
        ]
        
        for key in expired_keys:
            del self._alert_cache[key]
    
    def _convert_floats_to_decimal(self,obj):
        """Recursivley convert all float values to Decimal for DynamoDB compatability"""
        if isinstance(obj, float):
            return Decimal(str(obj))
        elif isinstance(obj, dict):
            return {k: self._convert_floats_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_floats_to_decimal(item) for item in obj]
        else:
            return obj
        
    def _store_alert_history_dynamodb(self, sensor_data, exceeded_thresholds, thresholds):
        """Stores alert information in DynamoDB for historical tracking"""
    
        try:
            # Determine alert severity
            severity = "critical" if any(t in ['temperature_high', 'temperature_low','humidity_high', 'humidity_low'] for t in exceeded_thresholds) else "warning"
        
            # Create alert item
            alert_id = f"alert-{datetime.now().timestamp()}"
            device_id = sensor_data.get("device_id", "unknown_device")
                 
            # Convert all float values to decimal for DynamoDB compatability
            sensor_data_for_dynamo = self._convert_floats_to_decimal(sensor_data.copy())
            timestamp = sensor_data.get("timestamp", datetime.now())

            if isinstance(timestamp, datetime):
                timestamp = timestamp.isoformat()

            if isinstance(sensor_data_for_dynamo.get("timestamp"), datetime):
                # Converts datetime to a string                
                # Convert all float values to decimal for DynamoDB compatability
                sensor_data_for_dynamo["timestamp"] = sensor_data_for_dynamo["timestamp"].isoformat()
            
            # Remove MongoDB ObjectId which can't be serialised
            if '_id' in sensor_data_for_dynamo:
                del sensor_data_for_dynamo['_id']

            alert_item = {
                "id": alert_id,
                "device_id": device_id,
                "timestamp": timestamp,
                "sensor_data": sensor_data_for_dynamo,
                "exceeded_thresholds": exceeded_thresholds,
                "severity": severity,
                "processed": True
            }
        
            # Store in DynamoDB
            alert_table_name = os.getenv("ALERT_TABLE", "Alerts")
            alert_table = self.dynamodb.Table(alert_table_name)
            alert_table.put_item(Item=alert_item)
        
            logger.info(f"Alert history stored in DynamoDB: {alert_id}")
        
        except Exception as e:
            logger.error(f"Failed to store alert history in DynamoDB: {str(e)}")
                                         
            
        
            
            
    
    
        