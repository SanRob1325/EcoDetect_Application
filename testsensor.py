from sense_hat import SenseHat

sensor =SenseHat()

temperature = sensor.get_temperature()
humidity = sensor.get_humidity()

print(temperature)
print(humidity)