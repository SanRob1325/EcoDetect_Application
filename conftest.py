import sys
from unittest.mock import MagicMock

# Mocking Sensehats sinc Pi is not being run
mock_sensehat = MagicMock()
sys.modules['sense_hat'] = MagicMock(SenseHat=mock_sensehat)