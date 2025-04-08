import React, {useState,useEffect} from 'react';
import axios from 'axios'
import './Noticeboard.css';//import CSS styling

const NoticeBoard = () => {
    const [alerts, setAlerts] = useState([])
    const [error, setError] = useState(null);//State to hold errors
//Fetch notifications from the Flask backend
    const fetchAlerts = async () => {
        try{
            const response = await axios.get('http://localhost:5000/api/alerts');
            setAlerts(response.data)
            setError(null)
        }catch (error){
            console.error("Error fetching alerts:", error)
            setError('Failed to load alerts. Please try again later')
        }
    }

    useEffect(() => {
        fetchAlerts()
        const interval = setInterval(fetchAlerts, 10000); //fetch alerts every 10 seconds
        return () => clearInterval(interval);
    }, []);

    return(
        <div className='notice-board'>
            <h3>Environmental Alerts</h3>
            {error && <p style={{color: 'red'}}>{error}</p>} {/*Display error message */}
            {alerts.length > 0 ?(
                <ul>
                    {alerts.map((alert,index) => (
                        <li key={index} className={alert.severity}>
                            <span className="timestamp">{new Date(alert.timestamp).toLocaleString()}</span>
                            <span className="message">
                                {alert.exceeded_thresholds.map(threshold => {
                                    if (threshold === 'temperature_high') return 'Temperature is too high';
                                    if (threshold === 'temperature_low') return 'Temperature is too low';
                                    if (threshold === 'humidity_high') return 'Humidity is too high';
                                    if (threshold === 'humidity_low') return 'Humidity is too low';
                                    if (threshold === 'water_usage_high') return 'Water usage is too high';
                                    return threshold
                                }).join(', ')}
                            </span>
                        </li> //Display each notification message
                    ))}
                </ul>
            ) :(
                <p>No alert yet</p> //Display message if there are no notifications
            )}
        </div>
    );
};

export default NoticeBoard;