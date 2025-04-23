import pytest
from unittest.mock import MagicMock, patch
import json
from datetime import datetime, timedelta
from backend import app as flask_app, alert_service, calculate_carbon_footprint,calculate_vehicle_impact, ai_assistant
from reports import generate_report_data, find_anomalies
import pandas as pd
import numpy as np
from io import StringIO
from alert_service import AlertService

@pytest.fixture
def app():
    flask_app.config['TESTING'] = True
    return flask_app

@pytest.fixture
def client(app):
    return app.test_client()

class TestSystemIntegration:
    """Testing system flow and integrations with different fuctionality"""
    def test_complete_monitoring_flow(self, client, monkeypatch):
        """Test complete flow from sensor data -> threshold check -> alert -> report"""

        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))


        # First step to set the thresholds
        thresholds = {
            "temperature_range": [20, 25],
            "humidity_range": [30, 60],
            "flow_rate_threshold": 10
        }

        response = client.post('/api/set-thresholds', json=thresholds, headers={"Authorization": "Bearer dummy-token"})
        assert response.status_code == 200

        # Second step is simiulate sensor data that exceeds the thresholds
        sensor_data = {
            "room_id": "living_room",
            "device_id": "test_device",
            "temperature": 30.0,
            "humidity": 70.0,
            "pressure": 1012.0,
            "flow_rate": 15.0,
            "location": "Living Room"
        }

        with patch('backend.sensor_data_collection.insert_one') as mock_insert:
            with patch('backend.alert_service.check_thresholds') as mock_check:
                mock_check.return_value = ["temperature_high", "humidity_high", "water_usage_high"]

                response = client.post('/api/sensor-data-upload', json=sensor_data)
                assert response.status_code == 200
                assert "exceeded_thresholds" in response.json
                assert len(response.json["exceeded_thresholds"]) > 0
        
        # Third step is to verify alerts are generated
        with patch('backend.alert_service.AlertService.get_alerts_history') as mock_get_alerts:
            mock_get_alerts.return_value = {
                "Items": [{
                    "id": "alert-123",
                    "timestamp": datetime.now().isoformat(),
                    "exceeded_thresholds": ["temperature_high", "humidity_high"],
                    "severity" : "critical"
                }]
            }

            response = client.get('/api/alerts', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert len(response.json) > 0
        
        # Generate report with the data
        report_params = {
            "time_range": "daily",
            "data_types": ["temperature", "humidity", "water_usage"],
            "format": "json"
        }

        # Mock sensor data for report
        mock_sensor_data = [sensor_data]
        mock_water_data = [{"timestamp": datetime.now().isoformat(), "flow_rate": 15.0}]

        with patch('reports.fetch_sensor_data', return_value=mock_sensor_data):
            with patch('reports.fetch_water_data', return_value=mock_water_data):
                with patch('reports.fetch_alerts', return_value=[]):
                    response = client.post('/api/reports', json=report_params, headers={"Authorization": "Bearer dummy-token"})
                    assert response.status_code == 200
                    assert "report_id" in response.json
                    assert "download_url" in response.json
    
    def test_room_monitoring_with_ai_analysis(self, client, monkeypatch):
        """Test room monitoring integrated with AI analysis"""
        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))
        room_data = {
            "_id": "abc1234",
            "room_id": "bedroom",
            "temperature": 23.5,
            "humidity": 55,
            "pressure": 1010,
            "timestamp": datetime.now()
        }

        # Get room data
        with patch('backend.sensor_data_collection.find_one', return_value=room_data):
            response = client.get('/api/sensor-data/bedroom', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
        
        # Create a query about room
        ai_query = {
            "query": "Is the bedroom temeprature comfortable?",
            "user_id": "test_user",
            "rooms":[{
                "room_id": "bedroom",
                "data": room_data
            }]
        }

        mock_ai_response = {
            "answer": "The bedroom is 23°C, which is within the optimal comfort range of 20-24°C."
        }

        with patch('backend.bedrock_client.invoke_model') as mock_bedrock:
            mock_bedrock.return_value = {
                "body": MagicMock(read=lambda: json.dumps({
                    "results": [{"outputText": mock_ai_response["answer"]}]
                }).encode())
            }

            response = client.post('/api/ai-assistant',json=ai_query, headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "answer" in response.json
            assert "bedroom" in response.json["answer"].lower()
    
    def test_room_monitoring_integration(self, client, monkeypatch):
        """Test the room monitoring flow with multpl✖ Something is already running on port 3000. Probably:
  /usr/bin/node /home/seanr/Documents/EcoDetect_Application/sensor-frontend/node_modules/react-scripts/scripts/start.js (pid 5643)
  in /home/seanr/Documents/EcoDetect_Application/sensor-frontend
e rooms"""
        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

        # Mock room list
        with patch('backend.sensor_data_collection.distinct', return_value=['living_room', 'bedroom', 'kitchen']):
            # Mock room data
            with patch('backend.sensor_data_collection.find_one', side_effect=[
                # Call the living room first
                {
                    "_id": "123abc",
                    "room_id": "living_room",
                    "temperature": 23.5,
                    "humidity": 45,
                    "timestamp": datetime.now()
                },
                # Second call to the bedroom
                {
                    "_id": "456def",
                    "room_id": "bedroom",
                    "temperature": 21.0,
                    "humidity": 50,
                    "timestamp": datetime.now()
                },
                {
                    "_id": "789ghi",
                    "room_id": "kitchen",
                    "temperature": 26.5,
                    "humidity": 60,
                    "timestamp": datetime.now()
                }
            ]):
                # Get rooms
                response = client.get('/api/rooms', headers={"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert set(response.json) == {'living_room', "bedroom", "kitchen"}

                # Getting living room data
                response = client.get('/api/sensor-data/living_room', headers={"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert response.json["temperature"] == 23.5
                assert response.json["humidity"] == 45

                # Get bedroom data
                response = client.get('/api/sensor-data/bedroom', headers = {"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert response.json["temperature"] == 21.0
                assert response.json["humidity"] == 50

                # Get kitchen data - shoul exceed temperature threshold
                response = client.get('/api/sensor-data/kitchen', headers={"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert response.json["temperature"] == 26.5
                assert response.json["humidity"] == 60
    
    def test_vehicle_monitoring_and_carbon_impact(self, client, monkeypatch):
        """Test vehicle movement monitoring with carbon impact calculation"""
        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

        # Mock sensor readings  for vehicle
        mock_sensor = MagicMock()
        mock_sensor.get_accelerometer_raw.return_value = {"x": 0.8, "y": 0.1, "z": 0.1}
        mock_sensor.get_gyroscope_raw.return_value = {"x": 0.2, "y": 0.3, "z": 0.1}
        mock_sensor.get_compass_raw.return_value = {"x": 0, "y": 0, "z": 0}

        # Other sensor data 
        mock_sensor.get_temperature.return_value = 22.5
        mock_sensor.get_humidity.return_value = 45.0
        mock_sensor.get_pressure.return_value = 1013.25

        with patch('backend.sensor', mock_sensor):
            # Get vehicle movement data
            response = client.get('/api/vehicle-movement', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "movement_type" in response.json
            assert response.json["movement_type"] == "accelerating"

            # Get carbon impact
            response = client.get('/api/vehicle-carbon-impact', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "impact" in response.json
            assert 0 <= response.json["impact"] <= 50

    def test_end_to_end_predictive_analysis(self, client, monkeypatch):
        """Test predictive analysis from data collection to anomaly detection"""
        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

        # Generate mock historical data
        historical_data = []
        start_date = datetime.now() - timedelta(days=30)

        for i in range(30):
            current_date = start_date + timedelta(days=i)
            # patterns of anomaly data added for analysis
            temp = 22 + (3 * np.sin(i/5)) if i != 15 else 40 # Anomaly on day 15

            historical_data.append({
                "timestamp": current_date.isoformat(),
                "temperature": temp
            })
        
        # Mock data retrieval
        with patch('backend.sensor_data_collection.find', return_value=historical_data):
            # Run predictive analysis
            response = client.get('/api/predictive-analysis?data_type=temperature&days=7', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "predictions" in response.json
            assert "anomalies" in response.json
            assert len(response.json["predictions"]) == 7

            # Check for anomaly detection
            assert len(response.json["anomalies"]) > 0
            anomaly_values = [a["value"] for a in response.json["anomalies"]]
            assert 40 in anomaly_values

    def test_historical_data_integration(self, client, monkeypatch):
        """Test fetching and analysis of historical data"""
        # Mock authentication
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

        # Generating mock historical data
        mock_data = []
        start_date = datetime.now() - timedelta(days=10)

        for i in range(10):
            mock_data.append({
                "timestamp": (start_date + timedelta(days=i)).isoformat(),
                "temperature": 20 + i * 0.5,
                "humidity": 40 + i,
                "pressure": 1000 + i * 2
            })
        
        with patch('backend.sensor_data_collection.find', return_value=mock_data):
            # Get histroical temperature data
            response = client.get('/api/historical-data?data_type=temperature&days=10', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "historical_data" in response.json
            assert len(response.json["historical_data"]) == 10

            # Check data is in the correct format and order
            data = response.json["historical_data"]
            for i in range(len(data) -1):
                assert data[i]["timestamp"] < data[i+1]["timestamp"]
                assert data[i]["value"] < data[i+1]["value"]
            
            # Get predictive analysis
            response = client.get('/api/predictive-analysis?data_type=temperature&days=5', headers={"Authorization": "Bearer dummy-token"})
            assert response.status_code == 200
            assert "predictions" in response.json
            assert len(response.json["predictions"]) == 5

            # Check predictions that should follow a specific trend of events
            predictions = response.json["predictions"]
            for i in range(len(predictions) - 1):
                assert predictions[i]["date"] < predictions[i+1]["date"]

            # Verifying predictions are higher than the last actual value
            # Since the mock data has an increasing trend 
            last_actual = mock_data[-1]["temperature"]
            first_prediction = predictions[0]["predicted_value"]
            assert first_prediction > last_actual
    
    def test_ai_assistant_integration(self, client, monkeypatch):
        """Test AI assistant integration with environment and recommendations"""
        monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

        # First step to test data for multiple rooms and sensors
        room_data = {
            "living_room": {
                "_id": "lr123",
                "room_id": "living_room",
                "temperature": 26.5, # Slightly warm
                "humidity": 35, # Slightly dry
                "air_quality": 45, # Moderate
                "timestamp": datetime.now()
            },
            "bedroom": {
                "_id": "br123",
                "room_id": "bedroom",
                "temperature": 20.5, # Comfortable
                "humidity": 55, # Comfortable
                "air_quality": 25,
                "timestamp": datetime.now()
            },
            "kitchen": {
                "_id": "kt123",
                "room_id": "kitchen",
                "temperature": 28.8,
                "humidity": 65,
                "air_quality": 60,
                "timestamp": datetime.now() - timedelta(minutes=30) # For slightly older data
            }
        }

        # Mock sensor data collection
        with patch('backend.sensor_data_collection.find_one', side_effect=lambda *args, **kwargs:
                   room_data.get(args[0].get('room_id') if args and len(args) > 0 and isinstance(args[0], dict) else
                                 kwargs.get('filter', {}).get('room_id')) if (args and len(args) > 0) or 'filter' in kwargs else None):
            
            # Mock distinct room endpoint
            with patch('backend.sensor_data_collection.distinct', return_value=list(room_data.keys())):

                # The next step is verify that room data can be retrieved from the list
                response = client.get('/api/rooms', headers={"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert set(response.json) == set(room_data.keys())

                # The next step is  to verify each rooms data can be accessed
                for room_id, data in room_data.items():
                    response = client.get(f'/api/sensor-data/{room_id}', headers={"Authorization": "Bearer dummy-token"}) 
                    assert response.status_code == 200
                    assert response.json["temperature"] == data["temperature"]
                    assert response.json["humidity"] == data["humidity"]
                
                mock_ai_responses = {
                    "temperature": "The living room is quite warm at 26°C while the kitchen is hot at 28°C. "
                                   "The bedroom is comfortable at 20°C. Consider adjusting you thermostat or "
                                   "using fans in warm areas.",

                    "comfort": "Your bedroom has optimal conditions with ideal temperature and humidity. "
                               "The living room is bit warm and dry which might feel uncomfortable. "
                               "The kitchen has poor air quality and is too hot and humid - ventilation would help. ",

                    "energy": "Based on your temperature readings, you could save energy by increasing the "
                              "thermostat setting in the bedroom (currently at 20.5°C) and improving insulation "
                              "in the kitchen where temperatures are high (28°C).",
                    
                    "air quality": "Kitchen air quality is poor (60), which could be from cooking. Consider "
                                  "running exhaust fans. Living room air quality is moderate (45). Bedroom "
                                  "air quality is good (25). Regular ventilation in all rooms in recommended."
                }

                # Next step to test AI assistant with differen queries
                for query_type, expected_response in mock_ai_responses.items():
                    with patch('backend.bedrock_client.invoke_model') as mock_bedrock:
                        # Configure mock to return appropriate response based on query
                        mock_bedrock.return_value = {
                            "body": MagicMock(read=lambda: json.dumps({
                                "results": [{"outputText": expected_response}]
                            }).encode())
                        }

                        # Make query to AI Assistant
                        ai_query = {
                            "query": f"Tell me about the {query_type} in my home",
                            "user_id": "test_user",
                            "rooms": [
                                {"room_id":room_id, "data": data}
                                for room_id, data in room_data.items()
                            ]
                        }

                        response = client.post('/api/ai-assistant', json=ai_query, headers={"Authorization": "Bearer dummy-token"})
                        # Verify response
                        assert response.status_code == 200
                        assert "answer" in response.json
                        assert response.json["answer"].strip() == expected_response.strip()

                        # Verify the model was called with the appropriate input
                        mock_bedrock.assert_called_once()

        with patch('backend.bedrock_client.invoke_model', side_effect=Exception("API unavailable")):
            ai_query = {
                "query": "What's the temperature?",
                "user_id": "test_user",
                "rooms": [{"room_id": "living_room", "data": room_data["living_room"]}]
            }

            response = client.post('/api/ai-assistant', json=ai_query, headers={"Authorization": "Bearer dummy-token"})

            # Verifies proper error handling
            assert response.status_code == 200
            assert "answer" in response.json
    
    def test_threshold_alert_integration(self):
        """Test the complete threshold alert notification flow"""
        # Mock dependencies
        mock_sns = MagicMock()
        mock_ses = MagicMock()
        mock_dynamodb = MagicMock()
        mock_db = MagicMock()

        # Mock database should return thresholds,
        mock_db.thresholds.find_one.return_value = {
            "temperature_range": [20, 25],
            "humidity_range": [30, 60]
        }
        # Creating Alert service with mock data
        alert_service = AlertService(
            sns_client=mock_sns,
            ses_client=mock_ses,
            dynamodb=mock_dynamodb,
            mongo_db=mock_db
        )

        # Simulated data that exceeds thresholds
        data = {
            "temperature": 30,
            "humidity": 25,
            "device_id": "test_device",
            "location": "Test Location",
            "timestamp": datetime.now().isoformat()
        }

        # Define thresholds
        thresholds = {
            "temperature_range": [20, 25],
            "humidity_range": [30, 60]
        }

        # Test the check thresholds flow
        exceeded = alert_service.check_thresholds(data)

        # Verify expected thresholds were exceeded
        assert "temperature_high" in exceeded
        assert "humidity_low" in exceeded

        # Verify notifications were sent
        mock_sns.publish.assert_called()
        mock_ses.send_email.assert_called()

        # Verify alert was stored in DynamoDB
        mock_dynamodb.Table.return_value.put_item.assert_called()
    
    def test_predictive_analysis_integration(self,client):
        """Test the predictive analysis pipeline with historical data"""
        # Prepare mock data
        mock_data = [
            {"timestamp": (datetime.now() - timedelta(days=5)).isoformat(), "temperature": 20.5},
            {"timestamp": (datetime.now() - timedelta(days=5)).isoformat(), "temperature": 21.0},
            {"timestamp": (datetime.now() - timedelta(days=5)).isoformat(), "temperature": 22.5},
            {"timestamp": (datetime.now() - timedelta(days=5)).isoformat(), "temperature": 23.0},
            {"timestamp": (datetime.now() - timedelta(days=5)).isoformat(), "temperature": 24.5},
        ]

        with patch('backend.sensor_data_collection.find', return_value=mock_data):
            response = client.get('/api/predictive-analysis?data_type=temperature&days=3')

            # Verifies response structure
            assert response.status_code == 200
            data = json.loads(response.data)

            print("Response data:", data)
            print("Predictions structure:", data["predictions"])

            assert "predictions" in data
            assert len(data["predictions"]) == 3
            assert "anomalies" in data

            # Verify prediction values follow a trend
            predictions = data["predictions"]
            assert all("date" in p and "predicted_value" in p for p in predictions)
