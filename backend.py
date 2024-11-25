from flask import Flask,jsonify
from flask_cors import CORS
from sense_hat import SenseHat

app = Flask(__name__)
CORS(app)
sensor = SenseHat()

@app.route('/api/sensor-data', methods=['GET'])
def get_sensor_data():
    temperature = sensor.get_temperature()
    humidity = sensor.get_humidity()
    return jsonify({"temperature": temperature,"humidity":humidity})

if __name__ == '__main__':
    app.run(host='0.0.0.0',port=5000)