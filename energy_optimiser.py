import logging
import json 
import os
import random
from datetime import datetime, time

class EnergyOptimiser:
    """Rule based-energy optimisation recommendations"""

    def __init__(self):
        self.comfort_range = {
            "temperature": {
                "default": [20, 24],
                "night": [18, 22],
                "away": [16, 28]
            },
            "humidity": {
                "default": [30, 60],
                "comfort": [40, 60]
            }
        }
        self.energy_savings = {
            "lower_temp_1": 5, # 5% per 1°C reduction in heating
            "raise_temp_1": 3, # 3% per 1°C reduction in cooling
            "opitmal_humidity": 2 # 2% for keeping humidity in optimal range
        }

        ## Load history recommendations if the exist
        self.recommendations_history = self._load_recommendations_history()
    
    def _load_recommendations_history(self):
        """Load historical recommendations from file"""
        history_file = "models/energy_recommendations_history.json"
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logging.error(f"Error loading recommendations history: {str(e)}")
        
        # Return empty history if the file doesn't exist or if theres an error
        return {
            "by_room": {},
            "by_time": {},
            "total_energy_saved": 0
        }
    
    def _save_recommendations_history(self):
        """Save recommendations to file"""
        os.makedirs("models", exist_ok=True)

        try:
            with open("models/energy_recommendations_history.json", 'w') as f:
                json.dump(self.recommendations_history, f)
        except Exception as e:
            logging.error(f"Error saving recommendations history: {str(e)}")
    
    def _get_time_context(self, timestamp=None):
        """Get context based on time of day"""
        if not timestamp:
            current_time = datetime.now().time()
        else:
            try:
                if not timestamp:
                    current_time = datetime.now().time()

                # Handling different timestamp format
                elif isinstance(timestamp, datetime):
                    current_time = timestamp.time()
                elif isinstance(timestamp, str):
                    try:
                        # Handle string timestamp
                        date = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        current_time = date.time()
                    except (ValueError, AttributeError):
                        logging.warning(f"Could not parse timestamp string: {timestamp}")
                        current_time = datetime.now().time()
                
                elif isinstance(timestamp, int) or isinstance(timestamp, float):
                    # Handle unix timestamp
                    try:
                        date = datetime.fromtimestamp(timestamp)
                        current_time = date.time()
                    except (ValueError, OSError):
                        logging.warning(f"Could not convert timestamp value to datetime: {timestamp}")
                        current_time = datetime.now().time()
                
                else:
                    logging.warning(f"Could not convert timestamp value to datetime: {timestamp}")
                    current_time = datetime.now().time()
            except (ValueError, AttributeError, TypeError) as e:
                logging.warning(f"Error processing timestamp {timestamp}: {str(e)}")
                current_time = datetime.now().time()

        
        # Defining the time periods
        morning = time(6, 0)
        day = time(9, 0)
        evening = time(17, 0)
        night = time(22, 0)

        if morning <= current_time < day:
            return "morning"
        elif day <= current_time < evening:
            return "day"
        elif evening <= current_time < night:
            return "evening"
        else:
            return "night"
    
    def _get_energy_tip(self, time_context, temperature, humidity):
        """Get an energy saving tip based on context"""
        tips = {
            "high_temp": [
                "Consider using ceiling fans instead of lowering the AC temperature.",
                "Close blinds or curtains during the day to block heat from sunlight.",
                "Use energy-efficient LED lighting to reduce heat output from bulbs."
            ],
            "low_temp": [
                "Seal drafts around windows and doors to prevent heat loss.",
                "Use a programmable thermostat to lower temperature when away or sleeping",
                "Open curtains during the day to let in natural heat fro sunlight."
            ],
            "humidity": [
                "Run ventilation fans when showering or cooking to reduce humidity.",
                "Consider using dehumidifier in very humid conditions.",
                "Use a humidifier in dry conditions to maintain comfort without raising temperature."
            ],
            "general": [
                "Consider smart power strips to eliminate phantom energy use.",
                "Replace air filters regularly to improve HVAC efficiency.",
                "Schedule an energy audit to identify other saving opportunities"
            ]
        }

        # Choose category based on conditions
        if temperature > 24:
            category = "high_temp"
        elif temperature < 20:
            category = "low_temp"
        elif humidity < 30 or humidity > 60:
            category = "humidity"
        else:
            category = "general"
        
        # Returns random tip from selected category
        return random.choice(tips[category])
    
    def _calculate_savings_potential(self, current_temp, recommended_temp, current_humidity):
        """Calculate potential energy savings percentage"""
        savings = 0

        # Temperature based savings
        if current_temp > recommended_temp:
            # Heating reduction
            temp_difference = current_temp - recommended_temp
            savings += temp_difference * self.energy_savings["lower_temp_1"]
        elif current_temp < recommended_temp:
            # Cooling reduction 
            temp_difference = recommended_temp - current_temp
            savings += temp_difference * self.energy_savings["raise_temp_1"]
        
        # Humdiity optimisation
        if 40 <= current_humidity <= 50:
            # Optimal humidity range
            savings += self.energy_savings.get("optimal_humidity", 2)
        
        return min(savings, 50) # If at 50% to keep recommendations at a realistic state
    
    def get_recommendations(self, room_id, temperature, humidity, timestamp=None):
        """Get energy optimisation recommendations"""
        try:
            temperature = float(temperature)
            humidity = float(humidity)
        except (ValueError, TypeError) as e:
            logging.error(f"Invalid values for temperature or humidity: {str(e)}")
            temperature = 22.0 # These are defaults
            humidity = 45.0

        time_context = self._get_time_context(timestamp)

        # Get appropriate temperature range based on time context
        if time_context == "night":
            temp_range = self.comfort_range["temperature"]["night"]
        else:
            temp_range = self.comfort_range["temperature"]["default"]

        # Determine optimal temperature
        if temperature < temp_range[0]:
            # Too cold, reommends increasing to the minimum comfort level
            recommended_temp = temp_range[0]
            recommendation = f"Increase temperature to {recommended_temp}°C for minimum comfort level"
            action = "increase"
        elif temperature > temp_range[1]:
            # Too warm, recommends decreasing to the maximum comfort level
            recommended_temp = temp_range[1]
            recommendation = f"Decrease temperature to {recommended_temp}°C for energy savings"
            action = "decrease"
        else:
            # Within comfort range, it will still have optimisation
            if temperature > (temp_range[0] + temp_range[1]) / 2:
                # In upper half of the comfort range
                recommended_temp = (temp_range[0] + temp_range[1]) / 2
                recommendation = f"Consider lowering temperature to {recommended_temp:.1f}°C for extra savings"
                action = "optimize"
            else:
                # Already optimised
                recommended_temp = temperature
                recommendation = "Temperature already in optimal energy efficiency range"
                action = "maintain"
        
        # Calculate potential savings
        savings_potential = self._calculate_savings_potential(temperature, recommended_temp, humidity)

        # Get energy saving tip
        energy_tip = self._get_energy_tip(time_context, temperature, humidity)

        # Prepare recommendation object
        result = {
            "room_id": room_id,
            "current_temperature": temperature,
            "current_humidity": humidity,
            "recommended_temperature": round(recommended_temp, 1),
            "action": action,
            "recommendation": recommendation,
            "energy_tip": energy_tip,
            "savings_potential": round(savings_potential, 1),
            "savings_potential_category": "High" if savings_potential > 15 else "Medium" if savings_potential > 5 else "Low",
            "time_context": time_context,
            "timestamp": datetime.now().isoformat()
        }

        # Update history
        self._update_history(room_id, result)

        return result
    
    def _update_history(self, room_id, recommendation):
        """Update recommendations history"""
        # Initialise room if not present
        if room_id not in self.recommendations_history["by_room"]:
            self.recommendations_history["by_room"][room_id] = []

        # Add recommendation
        self.recommendations_history["by_room"][room_id].append({
            "timestamp": recommendation["timestamp"],
            "action": recommendation["action"],
            "savings_potential": recommendation["savings_potential"]
        })

        # Keep only the last 50 recommendations per room 
        if len(self.recommendations_history["by_room"][room_id]) > 50:
            self.recommendations_history["by_room"][room_id] = self.recommendations_history["by_room"][room_id][-50:]
        
        # Update total energy saved 
        self.recommendations_history["total_energy_saved"] += recommendation["savings_potential"] / 100

        self._save_recommendations_history()
    
    def get_savings_summary(self):
        """Get summary of energy savings"""
        # Calculate savings in kWh
        estimated_kwhatts_saved = self.recommendations_history["total_energy_saved"] * 10

        # Calcualtes CO2 reduction - rough estimate
        co2_reduction = estimated_kwhatts_saved * 0.5 # 0.5 Kgs CO2 per kWh
        # Count total recommendations
        total_recommendations = sum(len(recs) for recs in self.recommendations_history["by_room"].values())

        average_savings = 0
        if total_recommendations > 0:
            average_savings = self.recommendations_history["total_energy_saved"] * 100 / total_recommendations

        return {
            "total_energy_saved_kwh": round(estimated_kwhatts_saved, 2),
            "co2_reduction_kg": round(co2_reduction, 2),
            "total_recommendations": total_recommendations,
            "average_savings_percent": round(average_savings, 2)
        }
    