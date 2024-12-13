import React, {useState,useEffect} from 'react';
import axios from 'axios'
import './Noticeboard.css';//import CSS styling

const NoticeBoard = () => {
    const [notifications,setNotifications] = useState([]);//State to hold notifcations
    const [error, setError] = useState(null);//State to hold errors
//Fetch notifications from the Flask backend
    const fetchNotifications = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/notifications'); //API call
            setNotifications(response.data); //sets notifications data from API
            setError(null); //resets previous errors
        }catch (error){
            console.error("Error fetching notifications:",error);
            setError('Failed to load notifications.Please try again later')
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); //fetch notifications every 10 seconds
        return () => clearInterval(interval);
    }, []);

    return(
        <div className='notice-board'>
            <h3>Humidity Alerts</h3>
            {error && <p stlye={{color: 'red'}}>{error}</p>} {/*Display error message */}
            {notifications.length > 0 ?(
                <ul>
                    {notifications.map((notification,index) => (
                        <li key={index}>{notification.message}</li> //Display each notification message
                    ))}
                </ul>
            ) :(
                <p>No alert yet</p> //Display message if there are no notifications
            )}
        </div>
    );
};

export default NoticeBoard;