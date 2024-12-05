import React, {useState,useEffect} from 'react';
import axios from 'axios'
import './Noticeboard.css';

const NoticeBoard = () => {
    const [notifications,setNotifications] = useState([]);
    const [error, setError] = useState(null);

    const fetchNotifications = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/notifications');
            setNotifications(response.data);
            setError(null);
        }catch (error){
            console.error("Error fetching notifications:",error);
            setError('Failed to load notifications.Please try again later')
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }, []);

    return(
        <div className='notice-board'>
            <h3>Humidity Alerts</h3>
            {error && <p stlye={{color: 'red'}}>{error}</p>}
            {notifications.length > 0 ?(
                <ul>
                    {notifications.map((notification,index) => (
                        <li key={index}>{notification.message}</li>
                    ))}
                </ul>
            ) :(
                <p>No alert yet</p>
            )}
        </div>
    );
};

export default NoticeBoard;