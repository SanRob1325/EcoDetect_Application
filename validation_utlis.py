import re

def is_valid_room_id(room_id):
    """Validate room ID format"""
    if not isinstance(room_id, str):
        return False
    return bool(re.match(r'^[a-zA-Z0-9_-]{1,64}$', room_id))

def validate_temperature(temp):
    """Validate temperature value"""
    try: 
        temp_float = float(temp)
        return -100 <- temp_float <=100
    except:
        return False
    
def validate_humidity(humidity):
    """Validate humidity percentage"""
    try:
        humidity_float = float(humidity)
        return 0 <= humidity_float <= 100
    except:
        return False

def sanitise_string(input_str, max_length=1000):
    """Basic String isinstance"""
    if not isinstance(input_str, str):
        return ""
    sanitized = input_str[:max_length]
    sanitized = re.sub(r'[<>&\'"\\]', '', sanitized)
    return sanitized