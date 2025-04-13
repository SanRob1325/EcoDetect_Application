import React, {useState, useEffect} from 'react';
import {Card, Tabs, Spin} from 'antd';
import GaugeChart from 'react-gauge-chart';
import apiService from './apiService';
const {TabPane} = Tabs;

const RoomMonitor = () => {
    const [rooms, setRooms] = useState([]);
    const [roomData, setRoomData] = useState({});
    const [loading, setLoading] = useState(true);

    // Fetch list of rooms
    useEffect(() => {
        const fetchRooms = async () => {
            try{
                const response = await apiService.getRooms();
                setRooms(response.data);

                // Initialise data structure for each room
                const initialData = {};
                response.data.forEach(room => {
                    initialData[room] = null;
                });
                setRoomData(initialData);
            }catch (error) {
                console.error('Error fetching rooms:', error);
            }
        };

        fetchRooms();

    }, []);

    // Fetch data for each room
    useEffect(() => {
        if (rooms.length === 0) return;

        const fetchAllRoomData = async () => {
            setLoading(true);

            const updatedData = {};

            for (const room of rooms){
                try{
                    const response = await apiService.getRoomSensorData(room)
                    updatedData[room] = response.data;
                }catch (error) {
                    console.error(`Error fetching data for room ${room}:`, error);
                    // Keeps existing data if the fetch fails
                    if (roomData && roomData[room]){
                        updatedData[room] = roomData[room];
                    }
                }
            }

            setRoomData(updatedData);
            setLoading(false);
        };
        fetchAllRoomData();

        // Set up polling
        const interval = setInterval(fetchAllRoomData, 10000);
        return () => clearInterval(interval);
    }, [rooms]);

    if (loading && rooms.length === 0){
        return <Spin size="large" />;
    }

    return (
        <Card title="Room Monitoring">
            <Tabs defaultActiveKey={rooms[0] || "1"}>
                {rooms.map(room => (
                    <TabPane tab={room.charAt(0).toUpperCase() + room.slice(1)} key={room}>
                        {roomData[room] ? (
                            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px'}}>
                                <Card title="Temperature">
                                    <GaugeChart
                                        id={`temp-gauge-${room}`}
                                        nrOfLevels={20}
                                        percent={roomData[room].temperature / 40}
                                        needleColor="red"
                                    />
                                    <p>{roomData[room].temperature.toFixed(2)} C</p>
                                </Card>
                                <Card title="Humidity">
                                    <GaugeChart
                                        id={`hum-gauge-${room}`}
                                        nrOfLevels={20}
                                        percent={roomData[room].humidity / 100}
                                        needleColor="blue"
                                    />
                                    <p>{roomData[room].humidity.toFixed(2)}%</p>
                                </Card>
                                <Card title="Last Updated">
                                    <p>{new Date(roomData[room].timestamp).toLocaleString()}</p>
                                </Card>
                            </div>
                        ) : (
                            <p>No data available for this room </p>
                        )}
                    </TabPane>
                ))}
            </Tabs>
        </Card>
    );
};

export default RoomMonitor;