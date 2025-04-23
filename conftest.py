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

@pytest.fixture(autouse=True)
def create_dummy_cert_files(tmp_path, monkeypatch):
    ca_path = tmp_path / "dummy-ca.pem"
    key_path = tmp_path / "dummy-key.pem"
    cert_path = tmp_path / "dummy-cert.pem"

    ca_path.write_text("dummy")
    key_path.write_text("dummy")
    cert_path.write_text("dummy")
    monkeypatch.setenv("CERTIFICATE_PATH2", str(cert_path))
    monkeypatch.setenv("PRIVATE_KEY_PATH2", str(key_path))
    monkeypatch.setenv("ROOT_CA_PATH2", str(ca_path))

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
    monkeypatch.setenv("CI", "true")

@pytest.fixture(autouse=True)
def mock_boto_clients(monkeypatch):
    dummy_client = MagicMock()
    monkeypatch.setattr("boto3.client", lambda *args, **kwargs: dummy_client)
    monkeypatch.setattr("boto3.resource", lambda *args, **kwargs: MagicMock())
    return dummy_client