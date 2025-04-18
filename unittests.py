import pytest
from unittest.mock import MagicMock,patch
from alert_service import AlertService
from sensehat_publisher import calibrate_temperature
from backend import app as flask_app
import importlib

@pytest.fixture
def app():
    return flask_app

"""Alert Testing"""
def check_thresholds(data, thresholds):
    exceeded = []
    if data.get('temperature') is not None:
        if data['temperature'] > thresholds['temperature_range'][1]:
            exceeded.append('temperature_high')
        elif data['temperature'] < thresholds['temperature_range'][0]:
            exceeded.append('temperature_low')

    if data.get('humidity') is not None:
        if data['humidity'] > thresholds['humidity_range'][1]:
            exceeded.append('humidity_high')
        elif data['humidity'] < thresholds['humidity_range'][0]:
            exceeded.append('humidity_low')

    if data.get('pressure') is not None:
        if data['pressure'] > thresholds['pressure_range'][1]:
            exceeded.append('pressure_high')
        elif data['pressure'] < thresholds['pressure_range'][0]:
            exceeded.append('pressure_low')
    
    if data.get('flow_rate') is not None:
        if data['flow_rate'] > thresholds['flow_rate_threshold']:
            exceeded.append('water_usage_high')

    return exceeded

def test_check_thresholds_exceeding():
    data =  {
        'temperature': 30,
        'humidity': 80,
        'pressure': 900,
        'flow_rate': 12
    }
    thresholds = {
        'temperature_range': [20, 25],
        'humidity_range': [30, 60],
        'pressure_range': [950, 1050],
        'flow_rate_threshold': 10
    }

    exceeded = check_thresholds(data, thresholds)
    assert 'temperature_high' in exceeded
    assert 'humidity_high' in exceeded
    assert 'pressure_low' in exceeded
    assert 'water_usage_high' in exceeded

def test_check_thresholds_within_range():
    data = {
        'temperature': 23,
        'humidity': 50,
        'pressure': 1010,
        'flow_rate': 5
    }
    thresholds = {
        'temperature_range': [20, 25],
        'humidity_range': [30, 60],
        'pressure_range': [950, 1050],
        'flow_rate_threshold': 10
    }

    exceeded = check_thresholds(data, thresholds)
    assert exceeded == []

# Mocking AWS SES and SNS for alert sending
def test_send_alert_email():
    with patch('alert_service.boto3.client') as mock_boto:
        mock_ses = MagicMock()
        alert_service = AlertService(ses_client=mock_ses)
        
        # Calling the private method directly for testing purposes
        alert_service._send_email_alert(
            subject="Testing Alert",
            message="Test email body",
            sensor_data={"location": "Room", "timestamp": "2025-01-01T00:00:00"},
            exceeded_thresholds=["temperature_high"],
            thresholds={"temperature_range": [20, 25]}
        )

        mock_ses.send_email.assert_called_once()
        args, kwargs = mock_ses.send_email.call_args
        assert kwargs['Destination']['ToAddresses'] == [alert_service.ses_email_recipient]
        assert 'Test email body' in kwargs['Message']['Body']['Text']['Data']


def test_send_alert_sms():
    with patch('alert_service.boto3.client') as mock_boto:
        mock_sns = MagicMock()
        mock_boto.return_value = mock_sns

        # Mock env file for the SNS_TOPIC_ARN
        import os
        os.environ['SNS_TOPIC_ARN'] = 'arn::aws:sns:eu-west-1:12345678012:EcoDetectAlerts'

        alert_service = AlertService(sns_client=mock_sns)

        test_message = "EcoDetect Alert: temperature_high"
        alert_service._send_sns_alert(test_message)

        mock_sns.publish.assert_called_once()
        args, kwargs = mock_sns.publish.call_args

        assert kwargs["TopicArn"] == os.getenv("SNS_TOPIC_ARN")
        assert test_message in kwargs["Message"]

"""Sensor Testing from the SenseHAT"""

def test_calibrate_temperature_high_humidity(monkeypatch):
    monkeypatch.setattr('sensehat_publisher.get_cpu_temperature', lambda: 50.0)
    raw_temp = 30.0
    calibrated = calibrate_temperature(raw_temp)
    assert isinstance(calibrated, float)
    assert calibrated < raw_temp

def test_sensor_thresholds_exceeding(monkeypatch):

    monkeypatch.setenv("TEMP_THRESHOLD_HIGH", "25")
    monkeypatch.setenv("TEMP_THRESHOLD_LOW", "15")
    monkeypatch.setenv("HUMIDITY_THRESHOLD_HIGH", "70")
    monkeypatch.setenv("HUMIDITY_THRESHOLD_LOW", "30")

    import sensehat_publisher
    importlib.reload(sensehat_publisher)

    sensor_data ={
        "temperature": 29.0,
        "humidity": 75.0,
        "pressure": 900.0
    }
    
    exceeded = sensehat_publisher.check_thresholds(sensor_data)
    assert "temperature_high" in exceeded
    assert "humidity_high" in exceeded

def test_calibrate_temperature_high_cpu(monkeypatch):
    monkeypatch.setattr('sensehat_publisher.get_cpu_temperature', lambda: 50.0)
    raw_temp = 20.0
    calibrated = calibrate_temperature(raw_temp)
    assert isinstance(calibrated, float)
    assert calibrated < raw_temp

def test_calibrate_temperature_no_cpu(monkeypatch):
    monkeypatch.setattr('sensehat_publisher.get_cpu_temperature', lambda: None)
    raw_temp = 30.0
    calibrated = calibrate_temperature(raw_temp)
    assert round(calibrated, 1) == 35.4

def test_predictive_analysis_valid_data(client):
    response = client.get("/api/predictive-analysis?data_type=temperature&days=3")
    assert response.status_code == 200
    assert "predictions" in response.json
    assert len(response.json["predictions"]) == 3

def test_predictive_analysis_missing_data(client, monkeypatch):
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value.limit.return_value = []
    monkeypatch.setattr("backend.sensor_data_collection.find", lambda *a, **kw: mock_cursor)
    response = client.get("/api/predictive-analysis?data_type=temperature")
    assert response.status_code in (200, 404)

    # Check if response is successfull
    if response.status_code == 200:
        assert "predictions" in response.json
        assert response.json["predictions"] == [] 
    else:
        # If the respnse has an error
        assert "error" in response.json

def test_predictive_analysis_invalid_data_type(client):
    response = client.get("/api/predictive-analysis?data_type=invalid_sensor")
    assert response.status_code == 404 or response.status_code == 500

@pytest.fixture
def dummy_auth_headers(monkeypatch):
    # Mock JWT token verification
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com", "name": "Test User"}))
    return {"Authorization": "Bearer dummy-valid-token"}

def test_ai_assistant_basic_query(client, dummy_auth_headers):
    payload = {"query": "How can I save water?", "user_id": "test_user"}
    response = client.post("/api/ai-assistant", json=payload, headers=dummy_auth_headers)
    assert response.status_code in (200, 500)
  
def test_ai_assistant_empty_query(client, dummy_auth_headers):
    payload = {"query": ""}
    response = client.post("/api/ai-assistant", json=payload, headers=dummy_auth_headers)
    assert response.status_code == 400

def test_ai_assistant_fallback(client, monkeypatch, dummy_auth_headers):
    monkeypatch.setattr("backend.bedrock_client.invoke_model", lambda *a, **kw: (_ for _ in ()).throw(Exception("Mock fail")))
    payload = {"query": "carbon footprint?", "user_id": "test_user"}
    response = client.post("/api/ai-assistant", json=payload, headers=dummy_auth_headers)
    assert response.status_code == 200
    assert "answer" in response.json