from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTClient
from sense_hat import SenseHat
import json
import time
import logging 

logging.basicConfig(level=logging.DEBUG)
sensor = SenseHat()

client_id = "ecodetect"
endpoint ="a37wpsc9qbf2i8-ats.iot.eu-west-1.amazonaws.com"
topic = "sensor/data"

ca ="/home/seanr/ecodetect/Python-3.9.0/ecodetect/AmazonRootCA1.pem"
key_path ="/home/seanr/ecodetect/Python-3.9.0/ecodetect/76999c276067a7dee956134e7132abdcd41ad60dae115117c9a961fde6bb98fe-private.pem.key"
cert_path="/home/seanr/ecodetect/Python-3.9.0/ecodetect/76999c276067a7dee956134e7132abdcd41ad60dae115117c9a961fde6bb98fe-certificate.pem.crt"

mqtt_client = AWSIoTMQTTClient(client_id)
mqtt_client.configureEndpoint(endpoint,8883)
mqtt_client.configureCredentials(ca,key_path,cert_path)

mqtt_client.configureAutoReconnectBackoffTime(1,32,20)
mqtt_client.configureConnectDisconnectTimeout(120)
mqtt_client.configureMQTTOperationTimeout(60)

print("Connecting to AWS IoT Core...")
mqtt_client.connect()

try:
    while True:
        temperature = sensor.get_temperature()
        humidity = sensor.get_humidity()
        
        payload = {
            "temperature": round(temperature,2),
            "humidity": round(humidity,2)
        }
        
        mqtt_client.publish(topic,json.dumps(payload),1)
        print(f"Published: {payload}")
        
        time.sleep(5)
        
except KeyboardInterrupt:
    print("Disconnection..")
    mqtt_client.disconnect()