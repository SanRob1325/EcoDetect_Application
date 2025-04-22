import pytest
from unittest.mock import MagicMock,patch
from alert_service import AlertService
from sensehat_publisher import calibrate_temperature
from backend import app as flask_app, calculate_carbon_footprint, calculate_vehicle_impact
from datetime import datetime, timedelta
import importlib
import pandas as pd
from io import StringIO
from reports import generate_report_data, find_anomalies, calculate_statistics,generate_pdf_report,generate_csv_report
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

def test_alert_cache_mecahnism():
    alert_service = AlertService()
    alert_key = "test_device_temperature_high"

    # Initialise to not be in cache
    assert alert_service._is_alert_in_cache(alert_key) == False

    # Add to cache
    alert_service._add_to_cache(alert_key)
    assert alert_service._is_alert_in_cache(alert_key) == True

    # Test cache expiry 
    alert_service._alert_cache[alert_key] = datetime.now().timestamp() - (alert_service._CACHE_TTL + 10)
    assert alert_service._is_alert_in_cache(alert_key) == False

# Carbon footprint calculation tests
def test_calculate_carbon_footprint():
    data = {
        "temperature": 25,
        "pressure": 1010,
        "flow_rate": 5,
        "altitude": 100
    }

    with patch('backend.get_current_vehicle_movement', return_value=None):
        footprint = calculate_carbon_footprint(data)

        # Calculate expected value: (25 * 0.2) + (5 * 0.5) + (100 * 0.1) + (1010 * 0.05)
        expected = 25*0.2 + 5*0.5 + 100*0.1 + 1010*0.05
        assert footprint == min(expected, 100) 

    
# API endpoint tests
def test_get_thresholds_api(client, monkeypatch):
    # Mock authentication
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))
    with patch('backend.get_default_thresholds', return_value={"temperature_range": [20, 25], "humidity_range": [20, 60]}):
        response = client.get('/api/get-thresholds', headers={"Authorization": "Bearer dummy-token"})
        assert response.status_code == 200
        assert response.json["temperature_range"] == [20, 25]

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

# Test vehicle movement impact calculation
def test_calculate_vehicle_impact():
    # Test acceleration impact 
    movement_data = {
        "accel_magnitude": 0.8,
        "movement_type": "accelerating"
    }
    impact = calculate_vehicle_impact(movement_data)
    expected = min(0.8 * 1.5 + 2.0, 50) 
    assert abs(impact - expected) < 0.01 # For approximate equality

    # Test braking impact
    movement_data = {
        "accel_magnitude": 0.5,
        "movement_type": "braking"
    }
    impact = calculate_vehicle_impact(movement_data)
    expected = min(0.5 * 1.5 + 1.0, 50)
    assert impact == expected

    # Test stationary impact
    movement_data = {
        "accel_magnitude": 0.0,
        "movement_type": "stationary"
    }
    impact = calculate_vehicle_impact(movement_data)
    expected = min(0.0 * 1.5, 50)
    assert impact == expected

# Test report generation
def test_generate_report_data():

    mock_sensor_data =[
        {"timestamp": "2025-01-01T00:00:00", "temperature": 22.5, "humidity": 45},
        {"timestamp": "2025-01-02T00:00:00","temperature": 23.5, "humidity": 46}
    ]

    mock_water_data = [
        {"timestamp": "2025-01-01T00:00:00", "flow_rate": 1.2},
        {"timestamp": "2025-01-02T00:00:00", "flow_rate": 2.3}
    ]

    mock_alerts = [
        {"timestamp": "2025-01T06:00:00", "severity": "warning", "exceeed_thresholds": ["humidity_high"]}

    ]

    with patch('reports.fetch_sensor_data', return_value=mock_sensor_data):
        with patch('reports.fetch_water_data', return_value=mock_water_data):
            with patch('reports.fetch_alerts', return_value=mock_alerts):
                start_date = datetime.now() - timedelta(days=2)
                end_date = datetime.now()

                report, report_id = generate_report_data(
                    "test_user",
                    ["temperature", "humidity", "water_usage"],
                    start_date,
                    end_date
                              
                )
                # Check report structure
                assert "metadata" in report
                assert "summary" in report
                assert "anomalies" in report
                assert "alerts" in report

                # Check data summaries
                assert "temperature" in report["summary"]
                assert "humidity" in report["summary"]
                assert "water_usage" in report["summary"]

                # Check temperature statistics
                temp_stats = report["summary"]["temperature"]
                assert temp_stats["min"] == 22.5
                assert temp_stats["max"] == 23.5
                assert temp_stats["avg"] == 23.0
                assert temp_stats["count"] == 2

# Test anomaly detection
def test_find_anomalies():
    data = [
        {"timestamp": "2025-01-01T00:00:00", "temperature": 22.0},
        {"timestamp": "2025-01-01T00:00:00", "temperature": 23.0},
        {"timestamp": "2025-01-01T00:00:00", "temperature": 21.0},
        {"timestamp": "2025-01-01T00:00:00", "temperature": 35.0}, # Anomaly
        {"timestamp": "2025-01-01T00:00:00", "temperature": 24.0}
    ]

    anomalies = find_anomalies(data, "temperature", threshold=1.9)

    assert len(anomalies) > 0 # At least one anomaly
    if len (anomalies) > 0:
        assert anomalies[0]["value"] == 35.0
        assert anomalies[0]["z_score"] > 1.9
    

# Test the statistics calculation method
def test_calculate_statitics():
    data = [
        {"temperature": 20.0},
        {"temperature": 25.0},
        {"temperature": 22.0},
        {"temperature": None}, # Still handles calculation
        {"pressure": 1010} # Missing temperature
    ]

    stats = calculate_statistics(data, "temperature")

    assert stats["min"] == 20.0
    assert stats["max"] == 25.0
    assert stats["avg"] ==  pytest.approx(22.333, 0.001)
    assert stats["count"] == 5 # Total data points including any that are invalid

# Test email aler generation
def test_generate_html_email():
    alert_service = AlertService()

    sensor_data = {
        "temperature": 30.0,
        "humidity": 25.0,
        "flow_rate": 12.0,
        "location": "Living Room",
        "timestamp": "2025-01-01T12:00:00"
    }

    exceeded_thresholds = ["temperature_high", "humidity_low", "water_usage_high"]

    thresholds = {
        "temperature_range": [20, 25],
        "humidity_range": [30, 60],
        "flow_rate_thresholds": 10
    }

    html = alert_service._generate_html_email(sensor_data, exceeded_thresholds, thresholds)

    # Check that HTML contains all threshold information
    assert "Temperature is too high: 30.0" in html
    assert "Humidity is too low: 25.0" in html
    assert "Water usage is too high: 12.0" in html
    assert "Living Room" in html

# Test PDF report generation
def test_generate_pdf_report():
    report_data = {
        "metadata": {
            "report_id": "test-report-123",
            "user_id": "test_user",
            "generated_at": "2025-01-01T12:00:00",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-01-07T00:00:00",
            "data_types": ["temperature", "humidity"],
            "data_points": 100
        },
        "summary": {
            "temperature": {
                "min": 20.0,
                "max": 25.0,
                "avg": 22.5,
                "count": 60
            },
            "humidity": {
                "min": 30.0,
                "max": 60.0,
                "avg": 45.0,
                "count": 50
            }

        },
        "anomalies": {
            "temperature": [
                {
                    "timestamp": "2025-01-03T12:00:00",
                    "value": 30.0,
                    "z_score": 3.5
                }
            ]
        },
        "alerts": [
            {
                "date": "2025-01-03T12:05:00",
                "type": "critical",
                "message": "Temperature is too high: 30° C"
            }
        ]
    }

    pdf_content = generate_pdf_report(report_data)

    # Verify PDF was generated 
    assert isinstance(pdf_content, bytes)
    assert len(pdf_content) > 0

# Test CSV report generation
def test_generate_csv_report():
    report_data = {
        "metadata": {
            "report_id": "test-report-123",
            "start_date": "2025-01-01T00:00:00",
            "end_date": "2025-01-07T00:00:00",
            "data_types": ["temperature", "humidity"]
        },
        "summary": {
            "temperature": {
                "min": 20.0,
                "max": 25.0,
                "avg": 22.5,
                "count": 50
            },
            "humidity": {
                "min": 30.0,
                "max": 60.0,
                "avg": 45.0,
                "count": 50
            }
        },
        "anomalies": {
            "temperature": [
                {
                    "timestamp": "2025-01-03T12:00:00",
                    "value": 30.0,
                    "z_score": 3.5
                }
            ]
        },
        "alerts": [
            {
                "date": "2025-01-03T12:05:00",
                "type": "critical",
                "message": "Temperature is too high"
            }
        ]
    }

    with patch('reports.fetch_sensor_data', return_value=[
        {"timestamp": "2025-01-01T00:00", "temperature": 22.5, "humidity": 45},
        {"timestamp": "2025-01-02T00:00", "temperature": 23.5, "humidity": 46},
    ]):
        with patch('reports.fetch_water_data', return_value=[
            {"timestamp": "2025-01-01T00:00", "flow_rate":  3.5},
            {"timestamp": "2025-01-01T00:00", "flow_rate": 6.5}
        ]):
            
            csv_files = generate_csv_report(report_data)

            # Check CSV files were generated
            assert 'sensor_data' in csv_files
            assert isinstance(csv_files["sensor_data"], str)

            # Parse CSV content
            df = pd.read_csv(StringIO(csv_files["sensor_data"]))
            assert "timestamp" in df.columns
            assert "temperature" in df.columns
            assert "humidity" in df.columns
            assert len(df) == 2

