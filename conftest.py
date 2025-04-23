import sys
from unittest.mock import MagicMock

# Mocking Sensehats since its using mock sensor data
#  Pi is not being run
mock_sensehat_class = MagicMock()
mock_sensehat_instance = MagicMock()
mock_sensehat_class.return_value = mock_sensehat_instance
sys.modules['sense_hat'] = MagicMock(SenseHat=mock_sensehat_class)

import pytest
import os
from backend import app 

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "test")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "test")
    monkeypatch.setenv("SES_EMAIL_SENDER", "sender@example.com")
    monkeypatch.setenv("IOT_ENDPOINT2", "test_device")
    monkeypatch.setenv("THING_NAME2", "test_device")
    monkeypatch.setenv("IOT_TOPIC2", "test_device")
    monkeypatch.setenv("CERTIFICATE_PATH2", "/tmp/dummy-cert.pem")
    monkeypatch.setenv("PRIVATE_KEY_PATH2", "/tmp/dummy-key.pem")
    monkeypatch.setenv("ROOT_CA_PATH2", "/tmp/dummy-ca.pem")
    monkeypatch.setenv("CI", "true")

@pytest.fixture(autouse=True)
def mock_boto_clients(monkeypatch):
    dummy_client = MagicMock()
    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: dummy_client)
    monkeypatch.setattr("boto3.resource", lambda *args, **kwargs: MagicMock())
    return dummy_client