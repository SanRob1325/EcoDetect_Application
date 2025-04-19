import React, { useState, useEffect } from 'react';
import { Card, Tabs, Spin, Empty, Badge, Typography } from 'antd';
import { HomeOutlined, EnvironmentOutlined, ClockCircleOutlined, DropboxOutlined } from '@ant-design/icons'
import GaugeChart from 'react-gauge-chart';
import apiService from './apiService';

const { TabPane } = Tabs;
const { Text, Title } = Typography

const RoomMonitor = () => {
    const [rooms, setRooms] = useState([]);
    const [roomData, setRoomData] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeRoom, setActiveRoom] = useState(null);
    // Fetch list of rooms
    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const response = await apiService.getRooms();
                setRooms(response.data);
                setActiveRoom(response.data[0] || null);
                // Initialise data structure for each room
                const initialData = {};
                response.data.forEach(room => {
                    initialData[room] = null;
                });
                setRoomData(initialData);
            } catch (error) {
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

            for (const room of rooms) {
                try {
                    const response = await apiService.getRoomSensorData(room)
                    updatedData[room] = response.data;
                } catch (error) {
                    console.error(`Error fetching data for room ${room}:`, error);
                    // Keeps existing data if the fetch fails
                    if (roomData && roomData[room]) {
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

    const handleTabChange = (activeKey) => {
        setActiveRoom(activeKey);
    }
    if (loading && rooms.length === 0) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '300px'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (rooms.length === 0) {
        return (
            <Card
                title="Room Monitoring"
                style={{
                    margin: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroudColor: '#F1F8E9'
                }}
                headStyle={{
                    backgroundColor: '#388E3C',
                    color: 'white',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                }}

            >
                <Empty
                    description="No rooms configured"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
            </Card>
        );
    };

    return (
        <Card
            title={
                <div style={{
                    display: 'flex',
                    alignItems: 'center'
                }}>
                    <HomeOutlined style={{ marginRight: '8px' }} />
                    <span>Room Monitoring</span>
                </div>
            }
            style={{
                margin: '16px',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                backgroundColor: '#F1F8E9'
            }}
            headStyle={{
                backgroundColor: '#388E3C',
                color: 'white',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
            }}
            extra={loading && <Spin size="small" />}
        >
            <Tabs
                defaultActiveKey={rooms[0] || "1"}
                onChange={handleTabChange}
                type="card"
                tabBarStyle={{
                    marginBottom: '16px',
                }}
                tabBarGutter={8}
            >
                {rooms.map(room => (
                    <TabPane
                        tab={
                            <div>
                                <EnvironmentOutlined style={{ marginRight: '4px' }} />
                                {room.charAt(0).toUpperCase() + room.slice(1)}
                                {roomData[room] && roomData[room].temperature > 25 && (
                                    <Badge
                                        status="warning"
                                        style={{ marginLeft: '8px' }}
                                    />
                                )}
                                {roomData[room] && roomData[room].flow_rate > 10 && (
                                    <Badge
                                        status="processing"
                                        style={{ marginLeft: '4px' }}
                                    />
                                )}
                            </div>
                        }
                        key={room}
                    >
                        {roomData[room] ? (
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-around',
                                gap: '20px'
                            }}>
                                <Card
                                    title="Temperature"
                                    style={{
                                        flex: 1,
                                        minWidth: '250px',
                                        borderRadius: '8px',
                                        borderColor: '#AED581'
                                    }}
                                    headStyle={{
                                        backgroundColor: '#8BC34A',
                                        color: 'white',
                                        borderTopLeftRadius: '8px',
                                        borderTopRightRadius: '8px'
                                    }}
                                >
                                    <GaugeChart
                                        id={`temp-gauge-${room}`}
                                        nrOfLevels={20}
                                        percent={(roomData[room].temperature || 0) / 40}
                                        needleColor='#4CAF50'
                                        needleBaseColor="#4CAF50"
                                        colors={['#C8E6C9', '#81C784', '#4CAF50']}
                                        animate={false}
                                    />
                                    <div style={{
                                        textAlign: 'center',
                                        marginTop: '8px'
                                    }}>
                                        <Title
                                            level={2}
                                            style={{
                                                margin: 0,
                                                color: '#388E3C'
                                            }}
                                        >
                                            {roomData[room]?.temperature !== undefined ?
                                                roomData[room].temperature.toFixed(1) : "N/A"} C
                                        </Title>
                                        <Text
                                            type={
                                                roomData[room]?.temperature > 25 ? "warning" :
                                                    roomData[room]?.temperature < 18 ? "secondary" :
                                                        "success"
                                            }
                                        >
                                            {roomData[room]?.temperature > 25 ? "High" :
                                                roomData[room]?.temperature < 18 ? "Low" :
                                                    "Optimal"}
                                        </Text>
                                    </div>
                                </Card>
                                <Card
                                    title="Humidity"
                                    style={{
                                        flex: 1,
                                        minWidth: '250px',
                                        borderRadius: '8px',
                                        borderColor: '#AED581'
                                    }}
                                    headStyle={{
                                        backgroundColor: '#8BC34A',
                                        color: 'white',
                                        borderTopLeftRadius: '8px',
                                        borderTopRightRadius: '8px'
                                    }}
                                >
                                    <GaugeChart
                                        id={`humidity-gauge-${room}`}
                                        nrOfLevels={20}
                                        percent={(roomData[room].humidity || 0) / 100}
                                        needleColor='#4CAF50'
                                        needleBaseColor="#4CAF50"
                                        colors={['#C8E6C9', '#81C784', '#4CAF50']}
                                        animate={false}
                                    />
                                    <div style={{
                                        textAlign: 'center',
                                        marginTop: '8px'
                                    }}>
                                        <Title
                                            level={2}
                                            style={{
                                                margin: 0,
                                                color: '#388E3C'
                                            }}
                                        >
                                            {roomData[room]?.humidity !== undefined ?
                                                roomData[room].humidity.toFixed(1) : "N/A"}%
                                        </Title>
                                        <Text
                                            type={
                                                roomData[room]?.humidity > 70 ? "warning" :
                                                    roomData[room]?.humidity < 30 ? "secondary" :
                                                        "success"
                                            }
                                        >
                                            {roomData[room]?.humidity > 70 ? "High" :
                                                roomData[room]?.humidity < 30 ? "Low" :
                                                    "Optimal"}
                                        </Text>
                                    </div>
                                </Card>
                                <Card
                                    title={
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <DropboxOutlined style={{ marginRight: '8px' }} />
                                            <span>Water Flow</span>
                                        </div>
                                    }
                                    style={{
                                        flex: 1,
                                        minWidth: '250px',
                                        borderRadius: '8px',
                                        borderColor: '#AED581',
                                    }}
                                    headStyle={{
                                        backgroundColor: '#8BC34A',
                                        color: 'white',
                                        borderTopLeftRadius: '8px',
                                        borderTopRightRadius: '8px'
                                    }}
                                >
                                    <div style={{
                                        height: '200px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center'

                                    }}>
                                        <Title
                                            level={2}
                                            style={{
                                                margin: 0,
                                                color: '#1976D2',
                                                textAlign: 'center'
                                            }}
                                        >
                                            {(roomData[room]?.flow_rate !== undefined && roomData[room]?.flow_rate !==null) ?
                                                parseFloat(roomData[room].flow_rate).toFixed(1) : "N/A"} L/min

                                        </Title>
                                        <div style={{ margin: '20px 0', padding: '0 10px' }}>
                                            <div style={{
                                                marginBottom: '10px',
                                                display: 'flex',
                                                justifyContent: 'space-between'
                                            }}>
                                                <Text>0 L/min</Text>
                                                <Text>10 L/min</Text>
                                                <Text>20 L/min</Text>
                                            </div>
                                            <div style={{
                                                height: '24px',
                                                backgroundColor: '#E3F2FD',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                border: '1px solid #BBDEFB'
                                            }}>
                                                <div style={{
                                                    width: `${Math.min(100, ((roomData[room]?.flow_rate != null ? roomData[room].flow_rate : 0) / 20 * 100))}%`,
                                                    height: '100%',
                                                    backgroundColor: (roomData[room]?.flow_rate != null && roomData[room]?.flow_rate > 10) ? '#FF9800' : '#2196F3',
                                                    borderRadius: '12px',
                                                    transition: 'width 0.5s ease'
                                                }}>

                                                </div>
                                            </div>
                                            <Text
                                                style={{ textAlign: 'center', marginTop: '10px', display: 'block' }}
                                                type={
                                                    roomData[room]?.flow_rate > 10 ? "warning" :
                                                        roomData[room]?.flow_rate > 0 ? "processing" :
                                                            "success"
                                                }
                                            >
                                                {roomData[room]?.flow_rate > 10 ? "High Usage" :
                                                    roomData[room]?.flow_rate > 0 ? "Active" : "No Flow"}
                                            </Text>
                                        </div>
                                    </div>
                                </Card>
                                <Card
                                    title="Status"
                                    style={{
                                        flex: 1,
                                        minWidth: '250px',
                                        maxWidth: '350px',
                                        borderRadius: '8px',
                                        borderColor: '#AED581'
                                    }}
                                    headStyle={{
                                        backgroundColor: '#8BC34A',
                                        color: 'white',
                                        borderTopLeftRadius: '8px',
                                        borderTopRightRadius: '8px'
                                    }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%',
                                        justifyContent: 'center',
                                        padding: '20px 0'
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            margin: '8px 0'
                                        }}>

                                            <Badge
                                                status={
                                                    roomData[room]?.temperature > 25 ||
                                                        roomData[room]?.temperature < 18 ||
                                                        roomData[room]?.humidity > 70 ||
                                                        roomData[room]?.humidity < 30 ||
                                                        roomData[room]?.flow_rate > 10 ?
                                                        "warning" : "success"
                                                }
                                                style={{ marginRight: '8px' }}
                                            />
                                            <Text>
                                                Overall Status: {
                                                    roomData[room]?.temperature > 25 ||
                                                        roomData[room]?.temperature < 18 ||
                                                        roomData[room]?.humidity > 70 ||
                                                        roomData[room]?.humidity < 30 ||
                                                        roomData[room]?.flow_rate > 10 ?
                                                        "Needs Attention" : "Optimal"
                                                }
                                            </Text>
                                        </div>
                                        <div style={{ margin: '8px 0' }}>
                                            <ClockCircleOutlined style={{ marginRight: '8px', color: '#388E2C' }} />
                                            <Text>Last Updated: {roomData[room]?.timestamp ?
                                                new Date(roomData[room].timestamp).toLocaleString() : "N/A"}</Text>
                                        </div>
                                        {roomData[room]?.flow_rate > 0 && (
                                            <div style={{ margin: '8px 0'}}>
                                                <DropboxOutlined style={{ marginRight: '8px', color: '#1976D2'}} />
                                                <Text type={roomData[room]?.flow_rate > 10 ? "warning" : "processing"}>
                                                    Water is currently flowing at {roomData[room].flow_rate.toFixed(1)} L/min
                                                </Text>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </div>

                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
                                {loading ? (
                                    <Spin size="large" />
                                ) : (
                                    <Empty
                                        description="No data available for this room"
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    />
                                )}
                            </div>
                        )}
                    </TabPane>
                ))}
            </Tabs>
        </Card>
    );
}
export default RoomMonitor;