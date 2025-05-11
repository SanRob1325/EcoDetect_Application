import numpy as np
import pickle
import logging
import os
from datetime import datetime

# Code inspiration: https://pyimagesearch.com/2020/03/02/anomaly-detection-with-keras-tensorflow-and-deep-learning/
# Code inspiration: https://www.geeksforgeeks.org/anomaly-detection-using-isolation-forest/
class DeviceMLModel:
    """Machine learning model for on-device anomaly detection"""

    def __init__(self, model_path="models/anomaly_detection.tflite", fallback_model_path="models/isolation_forest.pkl"):
        self.tflite_model_path = model_path
        self.fallback_model_path = fallback_model_path
        self.interpreter = None
        self.fallback_model = None
        self.input_details = None
        self.output_details = None
        self.model_loaded = False

        # Creates models directory if it doesnt exist
        os.makedirs("models", exist_ok=True)

        # Loading models
        self._load_models()

        if not self.model_loaded and not self.fallback_model:
            logging.error(" No Machine Learning models could be loaded, Anomaly detection will return default values.")

    def _load_models(self):
        """Load the TFLite model and fallback model"""
        try:
            # Try to load TFLite model
            if os.path.exists(self.tflite_model_path):
                logging.info(f"Found TFLite model at {self.tflite_model_path}")
                try:
                    # Only imports TensorFlow when needed
                    try:
                        import tensorflow as tf
                        self.interpreter = tf.lite.Interpreter(model_path=self.tflite_model_path)
                        self.interpreter.allocate_tensors()

                        # Get input and output tensors
                        self.input_details = self.interpreter.get_input_details()
                        self.output_details = self.interpreter.get_output_details()

                        self.model_loaded = True
                        logging.info("TensorFlow Lite model loaded successfully")
                    except (ImportError, AttributeError) as tf_error:
                        logging.error(f"TensorFlow error: {str(tf_error)}")
                        logging.warning("TensorFlow compatability issue, will use the fall back model")
            
                except Exception as model_error:
                    logging.error(f"Error loading TFLite model: {str(model_error)}")
            else:
                logging.warning(f"TFLite model not found at {self.tflite_model_path}")
            
            # Always load fallback model for reliability
            if os.path.exists(self.fallback_model_path):
                try:
                    with open(self.fallback_model_path, 'rb') as f:
                        self.fallback_model = pickle.load(f)
                    logging.info("Fallback model loaded successfully")
                except Exception as fallback_error:
                    logging.error(f"Error loading fallbackmodel: {str(fallback_error)}")
            else:
                logging.warning(f"Fallback model not found at {self.fallback_model_path}")
        except Exception as e:
            logging.error(f"Error loading models: {str(e)}")
            self.model_loaded = False

    def _convert_to_python_type(self, value):
        """Convert NumPy types to Python native types for MongoDB compatability"""
        if value is None:
            return None
        
        if isinstance(value, (np.integer, np.floating, np.bool_)):
            return value.item() # Convers NumPy types to Python native types
        return value
    
    def detect_anomalies(self, sensor_data, use_fallback=False):
        """Detect anomalies in sensor data"""

        # Sensor data- dictionary containing temperature, humidity, pressure
        # use fallback if TFLite fails

        if not self.model_loaded and not self.fallback_model:
            logging.warning("No models available for anomaly detection")
            return {
                "error": "No models available",
                "is_anomaly": False,
                "anomaly_score": 0.0,
                "prediction_model": "none",
                "confidence": 0.0,
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "temperature": sensor_data.get('temperature'),
                    "humidity": sensor_data.get('humidity'),
                    "pressure": sensor_data.get('pressure')
                }
            }

        try:
            features = self._extract_features(sensor_data)

            # Use fallback model if requested or if TFLite model is not available
            if use_fallback or not self.model_loaded:
                if self.fallback_model:
                    return self._predict_with_fallback(features, sensor_data)
                else:
                    raise ValueError("Fallback model requested but not available")
            else:
                return self._predict_with_tflite(features, sensor_data)
            
        except Exception as e:
            logging.error(f"Error in anomaly detection: {str(e)}")
            # Try fallback model if the main prediction fails
            if not use_fallback and self.fallback_model:
                logging.info("Trying fallback model after error")
                return self.detect_anomalies(sensor_data, use_fallback= True)
            
            return {
                "error": "No models available for anomaly detection",
                "is_anomaly": False,
                "anomaly_score": 0.0,
                "prediction_model": "none",
                "confidence": 0.0,
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "temperature": self._convert_to_python_type(sensor_data.get('temperature')),
                    "humidity": self._convert_to_python_type(sensor_data.get('humidity')),
                    "pressure": self._convert_to_python_type(sensor_data.get('pressure'))
                }
            }
        
    
    def _extract_features(self, sensor_data):
        """Extract and normalise features from data"""
        # Get value with defaults if missing
        temperature = float(sensor_data.get('temperature', 22.0))
        humidity = float(sensor_data.get('humidity', 45.0))
        pressure = float(sensor_data.get('pressure', 1013.0))

        # Validation
        if temperature < -50 or temperature > 100:
            logging.warning(f"Temperature out of reasonable range: {temperature}")
            temperature = 22.0 # Use as a safe default
            
        if humidity < 0 or humidity > 100:
            logging.warning(f"Humidity out of reasonable range: {humidity}")
            humidity = 45.0 # Use as a safe default
        if pressure < 800 or pressure > 1200:
            logging.warning(f"Pressure out of reasonable range: {pressure}")
            pressure = 1013.0 # Use as a safe default
        
        return np.array([temperature, humidity, pressure], dtype=np.float32).reshape(1, 3)
    
    def _predict_with_tflite(self, features, original_data):
        """Make prediction using TensorFlow Lite model"""
        try:

            # Set input tensor
            self.interpreter.set_tensor(self.input_details[0]['index'], features)

            # Run inference
            self.interpreter.invoke()

            # Get output tensor
            output = self.interpreter.get_tensor(self.output_details[0]['index'])

            anomaly_score = float(output[0][0])
            is_anomaly = bool(anomaly_score > 0.7) # Threshold for anomaly
            confidence = float(min(abs(anomaly_score - 0.5) * 2, 1.0))

            return {
                "is_anomaly": is_anomaly,
                "anomaly_score": anomaly_score,
                "confidence": confidence,
                "prediction_model": "tensorflow_lite",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "temperature": self._convert_to_python_type(original_data.get('temperature')),
                    "humidity": self._convert_to_python_type(original_data.get('humidity')),
                    "pressure": self._convert_to_python_type(original_data.get('pressure'))
                }
            }
        except Exception as e:
            logging.error(f"Error in TFLite prediction: {str(e)}")
            # Fallback to isolation Forest if TFLite fails
            if self.fallback_model:
                logging.info("Falling back to Isolation Forest after TFLite")
                return self._predict_with_fallback(features, original_data)
            else:
                raise
    
    def _predict_with_fallback(self, features, original_data):
        """Make prediction using fallback model with IsolationForest"""
        # Predict with isolation forest as anomalies = -1 and normal values = 1
        prediction = self.fallback_model.predict(features)

        # Get anomaly score, if it is higher its more anomalous
        anomaly_score = self.fallback_model.score_samples(features)

        # Process the output
        is_anomaly = bool(prediction[0] == -1)
        normalised_score = float(0.5 - anomaly_score[0] / 2) # convert to 0-1 scale
        confidence = float(min(abs(normalised_score * 2), 1.0)) # Scale to 0-1
        return {
            "is_anomaly": is_anomaly,
            "anomaly_score": normalised_score,
            "confidence": confidence, 
            "prediction_model": "isolation_forest",
            "timestamp": datetime.now().isoformat(),
            "data": {
                "temperature": self._convert_to_python_type(original_data.get('temperature')),
                "humidity": self._convert_to_python_type(original_data.get('humidity')),
                "pressure": self._convert_to_python_type(original_data.get('pressure'))
            }

        }
    