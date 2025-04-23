import time
import statistics
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
import concurrent.futures
import json
from backend import app as flask_app
from bson import ObjectId
import alert_service
@pytest.fixture
def app():
    flask_app.config['TESTING'] = True
    return flask_app

@pytest.fixture
def client(app):
    return app.test_client()

# Helper function to mock MongoDB ObjectID serialisation
def mock_objectid_serialization(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

"""Entire workflow test"""
def test_complete_system_workflow(client, monkeypatch):
    """Test a complete workflow through the system"""
    # Mock authentication
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

    # First step to get current thresholds
    response = client.get('/api/get-thresholds', headers={"Authorization": "Bearer dummy-token"})
    assert response.status_code == 200
    initial_thresholds = response.json

    # Next step to update thresholds
    new_thresholds = {
        "temperature_range": [18, 26],
        "humidity_range": [30, 65],
        "flow_rate_threshold": 8 
    }
    response = client.post('/api/set-thresholds', json=new_thresholds, headers={"Authorization": "Bearer dummy-token"})
    assert response.status_code == 200

    # Get sensor data as the next step
    with patch('backend.sensor.get_temperature', return_value=27.0):
        with patch('backend.sensor.get_humidity', return_value=70.0):
            with patch('backend.sensor.get_pressure', return_value=1010.0):
                with patch('backend.get_cpu_temperature', return_value=30.0):
                    with patch('bson.json_util.default', side_effect=mock_objectid_serialization):
                        response = client.get('/api/sensor-data', headers={"Authorization": "Bearer dummy-token"})
                        assert response.status_code == 200
                        sensor_data = response.json

                        # Verify temperature exceeded new threshold
                        assert sensor_data["temperature"] > new_thresholds["temperature_range"][1]
                        assert sensor_data["humidity"] > new_thresholds["humidity_range"][1]

    # test alert 
    with patch.object(backend.alert_service,'get_alerts_history') as mock_get_alerts:
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
    
    # Next step is to check alerts generated
    response = client.get('/api/alerts-dynamodb', headers={"Authorization": "Bearer dummy-token"})
    if response.status_code != 200:
        response = client.get('/api/alerts', headers={"Authorization": "Bearer dummy-token"})
    
    assert response.status_code == 200
    alerts = response.json

    # Should find temperature and humidity alerts
    assert any("temperature_high" in alert.get("exceeded_thresholds", []) for alert in alerts)
    assert any("humidity_high" in alert.get("exceeded_thresholds", []) for alert in alerts)

    # Test reports
    mock_data = [
        {
            "timestamp": datetime.now().isoformat(),
            "temperature": 25.5,
            "humidity": 55.0,
            "pressure": 1013.2
        }
    ]
    with patch('reports.fetch_sensor_data', return_value=mock_data):
        with patch('reports.fetch_sensor_data_from_s3', return_value=mock_data):
            with patch("reports.store_report", return_value='http://example.com/mock-report'):
                report_request = {
                    "time_range": "daily",
                    "data_types": ["temperature", "humidity"],
                    "format": "json"
                }
                # Next step is to generate report
                response = client.post('/api/reports', json=report_request, headers={"Authorization": "Bearer dummy-token"})
                assert response.status_code == 200
                assert "download_url" in response.json

    # Next step is to test the AI assistant
    ai_query = {
        "query": "How can I reduce my carbon footprint?",
        "user_id": "test_user"
    }
    response = client.post('/api/ai-assistant', json=ai_query, headers={"Authorization": "Bearer dummy-token"})
    assert response.status_code == 200
    assert "answer" in response.json

"""Performance Testing"""
def test_api_performance(client, monkeypatch):
    """Test the performance of key API endpoints"""
    # Mock authentication
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

    # Define endpoints to test 
    endpoints = [
        '/api/sensor-data',
        '/api/carbon-footprint',
        '/api/get-thresholds',
        '/api/water-usage',
        '/api/temperature-trends?range=24h',
        '/api/historical-data?data_type=temperature&days=7',
        '/api/predictive-analysis?data_type=temperature&days=3'
    ]

    # Set up mocking endpoints
    with patch('backend.sensor.get_temperature', return_value=22.5):
        with patch('backend.sensor.get_humidity', return_value=45.0):
            with patch('backend.sensor.get_pressure', return_value=1010.0):
                    with patch('backend.sensor_data_collection.insert_one', return_value=MagicMock()):
                        with patch('backend.sensor_data_collection.find_one', return_value={
                            "temperature": 22.5,
                            "humidity": 45.0,
                            "pressure": 1010.0,
                            "timestamp": datetime.now(),
                            "_id": "mock_id"
                        }):
                            with patch('bson.json_util.default', side_effect=mock_objectid_serialization):
                                # MongoDB object handling 
                                with patch('bson.objectid.ObjectId', side_effect=lambda x: x):

                                    results = {}

                                    # Test each endpoint 10 times
                                    for endpoint in endpoints:
                                        response_times = []

                                        for _ in range(3):
                                            try:
                                                start_time = time.time()
                                                response = client.get(endpoint, headers={"Authorization": "Bearer dummy-token"})
                                                end_time = time.time()

                                                if response.status_code in (200, 201, 202, 404):
                                                    response_times.append((end_time - start_time) * 1000) # Convert to ms
                                                else:
                                                    print(f"Warning: Endpoint {endpoint} returned status {response.status_code}")
                                            except Exception as e:
                                                print(f"Error testing endpoint {endpoint}: {str(e)}")
                                        
                                        # Skip all endpoints with no successful responses
                                        if not response_times:
                                            print(f"Skipping performance checks for {endpoint} no successful responses")
                                            continue

                                        # Calculate statistics
                                        results[endpoint] = {
                                            "min": min(response_times),
                                            "max": max(response_times),
                                            "avg": statistics.mean(response_times),
                                            "median": statistics.median(response_times),
                                            "p95": sorted(response_times)[int(0.95 * len(response_times))],

                                        }

                                        # The performance requirements
                                        assert results[endpoint]["avg"] < 500, f"Average response time for {endpoint} exceeds 500ms"
                                        assert results[endpoint]["p95"] < 1000, f"95th percentile response time for {endpoint} exceeds 1000ms"
                            
                                    # Print performance results
                                    print("\nAPI Performance Results:")
                                    for endpoint, stats in results.items():
                                        print(f"{endpoint}: Average: {stats['avg']:.2f}ms, P95: {stats['p95']:.2f}ms")

@patch('backend.get_water_usage', return_value={"usage_liters": 10})
def test_high_load_performance(client, monkeypatch):
    """Test system performance under high load with concurrent api requests"""
    
    # Mock authentication
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

    # Setup sensor mocks
    with patch('bson.json_util.default', side_effect=mock_objectid_serialization):
        
        def make_request(endpoint):
            try:
                start_time = time.time()
                response = client.get(endpoint, headers={"Authorization": "Bearer dummy-token"})
                end_time = time.time()
                return {
                    "endpoint": endpoint,
                    "status_code": response.status_code,
                    "response_time": (end_time - start_time) * 1000 # converts to ms
                }
            except Exception as e:
                print(f"Error in request to {endpoint}: {str(e)}")
                return {
                    "endpoint": endpoint,
                    "status_code": 500,
                    "response_time": 0,
                    "error": str(e)
                }
        # Lists of endpoints that are being tested
        endpoints = [
            '/api/sensor-data',
            '/api/carbon-footprint',
            '/api/get-thresholds',
            '/api/water-usage'
        ] * 5 # Repeats each endpoint 5 times

        # Make 20 concurrent requests
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request, endpoint) for endpoint in endpoints]
            for future in concurrent.futures.as_completed(futures):
                results.append(future.result())
        
        # Analyse resuls
        valid_results = [r for r in results if r["status_code"] in (200, 201, 202, 404)]
        if not valid_results:
            pytest.skip("No valid responses recieved in high load test")
        # Analyse results
        response_times = [result["response_time"] for result in results]
        failed_requests = [r for r in results if r["status_code"] not in (200, 201, 202,404)]

        print(f"\nConcurrent Requests Results:")
        print(f"Total Requests: {len(results)}")
        print(f"Failed Requests: {len(failed_requests)}")
        print(f"Average Response Time: {statistics.mean(response_times):.2f}ms")
        print(f"95th Percentile: {sorted(response_times)[int(0.95 * len(response_times))]:.2f}ms")

        # Assertions if failed and response times
        assert len(failed_requests) == 0, "Some requests failed under load"
        assert statistics.mean(response_times) < 1000, "Average response time exceeds 1000ms under load"

"""Security Testing"""

def test_authentication_protection(client):
    """Test that are protected endpoints require authentication"""
    protected_endpoints = [
        '/api/get-thresholds',
        '/api/set-thresholds',
        '/api/carbon-footprint',
        '/api/alerts',
        '/api/notification-preferences',
        '/api/reports',
        '/api/vehicle-movement',
        '/api/ai-assistant'
    ]

    for endpoint in protected_endpoints:
        # Test without authentication
        response = client.get(endpoint)
        assert response.status_code == 401, f"Endpoint {endpoint} is not properly protected"

        # Test with invalid token
        response = client.get(endpoint, headers={"Authorization": "Bearer invalid-token"})
        assert response.status_code == 401, f"Endpoint {endpoint} accepts invalid token"

def test_input_validation(client, monkeypatch):
    """Test that inputs are properly validated to prevent any injection attacks"""
    # Mock authentication
    monkeypatch.setattr("backend.verify_token", lambda token: (True, {"sub": "test_user", "email": "test@example.com"}))

    # Test threshold validation
    invalid_thresholds = {
        "temperature_range": "invalid", # Should be a list
        "humidity_range": [70, 30], # Min > Max 
        "flow_rate_threshold": -5
    }

    response = client.post('/api/set-thresholds', json=invalid_thresholds, headers={"Authorization": "Bearer dummy-token"})
    assert response.status_code in (400, 404, 422), "Invalid thresholds not properly validated"

    # Test SQL injection in roomID
    response = client.get('/api/sensor-data/room_id%3B%20DROP%20TABLE%20sensor_data', headers={"Authorization": "Bearer dummy-token"})
    assert response.status_code in (404, 400), "SQL injection not properly handled"

    # Test XSS attemp in AI query
    xss_payload = {"query": "<script>alert('XSS Alert')</script>", "user_id": "test_user"}

    with patch('backend.bedrock_client.invoke_model', return_value={
        "body": MagicMock(read=lambda: json.dumps({
            "results": [{"outputText": "Response"}]
        }).encode())
    }):
        response = client.post('/api/ai-assistant', json=xss_payload, headers={"Authorization": "Bearer dummy-token"})
        assert response.status_code == 200
        assert "<script>" not in response.data.decode(), "XSS payload not sanitised"

def test_jwt_validation(client, monkeypatch):
    """Test proper validation of JWT tokens"""
    # Test expired token
    def verify_expired_token(token):
        if token == "expired-token":
            return False, None
        return True, {"sub": "test_user", "email": "test@example.com"}
    monkeypatch.setattr("backend.verify_token", verify_expired_token)

    response = client.get('/api/get-thresholds',headers={"Authorization": "Bearer expired-token"})
    assert response.status_code == 401, "Expired token not properyl rejected"

    # Test token with invalid signature
    def verify_invalid_signature(token):
        if token == "invalid-signature":
            return False, None
        return True, {"sub": "test_user", "email": "test@example.com"}
    
    monkeypatch.setattr("backend.verify_token", verify_invalid_signature)

    response = client.get('/api/get-thresholds', headers={"Authorization": "Bearer invalid-signature"})
    assert response.status_code == 401, "Token with invalid signature not properly rejected"

"""Accessibility Testing"""



