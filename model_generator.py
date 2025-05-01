import numpy as np
from sklearn.ensemble import IsolationForest
import pickle
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def generate_sample_data(n_samples=1000):
    """Generates synthetic sensor data for training"""
    logging.info(f"Generating {n_samples} sample data points")

    # Normal temperature range
    temp = np.random.normal(22, 2, n_samples)
    # Normal humidity range
    humidity = np.random.normal(45, 10, n_samples)
    # Normal pressure range
    pressure = np.random.normal(1013, 5, n_samples)

    # Add some anomalies for 5% of data
    anomaly_indices = np.random.choice(n_samples, size=int(n_samples * 0.05), replace=False)

    # Makes the anomalies more extreme
    temp[anomaly_indices] = np.random.normal(30, 5, len(anomaly_indices))
    humidity[anomaly_indices] = np.random.normal(80, 10, len(anomaly_indices))

    # Comine features
    X = np.column_stack([temp, humidity, pressure])

    # Create labels (1 if normal whilst -1 is an anomaly)
    y = np.ones(n_samples)
    y[anomaly_indices] = -1

    logging.info(f"Generated {len(anomaly_indices)} anomalies")

    return X, y

def create_isolation_forest_model():
    """Creates and save Isolation Forests model"""
    try:
        # Train Isolation Forest
        models_dir = 'models'
        # Creating a directory if it does not exist
        os.makedirs(models_dir, exist_ok=True)
        logging.info(f"Creating models directory: {os.path.abspath(models_dir)}")

        # Generates data 
        X, _ = generate_sample_data()

        # Train Isolation Forest data
        logging.info("Training Isolation Forest model")
        model = IsolationForest(contamination=0.05, random_state=42)
        model.fit(X)
        
        # Save model using pickle
        isolation_forest_path = os.path.join(models_dir, 'isolation_forest.pkl')
        with open(isolation_forest_path, 'wb') as f:
            pickle.dump(model, f)
        logging.info(f"Isolation Forest model saved to {isolation_forest_path}")

        # File aaves placeholder to replacce TFLite file
        placeholder_path = os.path.join(models_dir, 'anomaly_direction.tflite')
        with open(placeholder_path, 'wb') as f:
            f.write(b'PLACEHOLDER') # Should write bytes
        logging.info(f"Created placeholder TFLite file at {placeholder_path}")

        # Create a placeholder for TF model directory
        tf_model_dir = os.path.join(models_dir, 'anomaly_detection_tf')
        os.makedirs(tf_model_dir, exist_ok=True)
        with open(os.path.join(tf_model_dir, 'README.txt'), 'w') as f:
            f.write("This is a placeholder for TensorFlow model directory.\n")
            f.write("The actual TensorFlow model was not created due to compatability issues. \n")
            f.write("The system will use the Isolation Forest model instead. \n")
        logging.info(f"Created placeholder TF model directory at {tf_model_dir}")


        # Verify files exist
        file_created = os.listdir(models_dir)
        logging.info(f"Files in models directory: {file_created}")

        return True, "Isolation Forest model created successfully, with placeholders for TensorFlow models"

    except Exception as e:
        logging.error(f"Error Isolation Forest model: {str(e)}")
        return False, str(e)


if __name__ == "__main__":
    print("n" + "=" * 60)
    print("Isolation Forest Model Generator")
    print("=" * 60)
    print("\nThis script creats only the Isolation Forest model with now TensorFlow dependency")

    success, message = create_isolation_forest_model() 
    if success:
        print("Insolation Forest Model creation completed successfully")
    else:
        print(f"Model creation failed: {message}")



