import React, { useState, useEffect, useCallback } from 'react';
import { Card, Tabs, Spin, Empty, Badge, Typography, Switch, Select, Button, message, Modal, Avatar, Input } from 'antd';
import { HomeOutlined, EnvironmentOutlined, ClockCircleOutlined, DropboxOutlined, PoweroffOutlined, RobotOutlined, QuestionCircleOutlined, SendOutlined } from '@ant-design/icons'
import GaugeChart from 'react-gauge-chart';
import AnomalyDetection from './AnomalyDetection';
import EnergyOptimiser from './EnergyOptimiser';
import apiService from './apiService';

const { Text, Title } = Typography;
const { Option } = Select;

const RoomMonitor = () => {
    const [rooms, setRooms] = useState([]);
    const [roomData, setRoomData] = useState({});
    const [loading, setLoading] = useState(true);
    const [activeRoom, setActiveRoom] = useState(null);
    const [enabledRooms, setEnabledRooms] = useState({});
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [aiQuery, setAiQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [selectedRoomsForAI, setSelectedRoomsForAI] = useState([]);

    // Chatbot from Dashboard
    const [chatbotVisible, setChatbotVisible] = useState(false);
    const [chatHistory, setChatHistory] = useState([
        { sender: 'bot', message: 'Hello I can help you monitor you rooms and provide eco-friendly tips.' },
    ]);
    const [chatInput, setChatInput] = useState('');

    // Fetch list of rooms
    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const response = await apiService.getRooms();
                if (response.data && Array.isArray(response.data)) {
                    setRooms(response.data);
                    if (response.data.length > 0) {
                        setActiveRoom(response.data[0])
                    }

                    // Initialise data structure for each room
                    const initialData = {};
                    const initialEnabledState = {};
                    response.data.forEach(room => {
                        initialData[room] = null;
                        initialEnabledState[room] = true;
                    });
                    setRoomData(initialData);
                    setEnabledRooms(initialEnabledState);
                } else {
                    console.error('Invalid rooms data format:', response.data);
                    message.error('Error loading rooms data');
                }
            } catch (error) {
                console.error('Error fetching rooms:', error);
                message.error('Failed to fetch rooms');
            }
        };

        fetchRooms();

    }, []);

    // Fetch data for each room
    const fetchAllRoomData = useCallback(async () => {
        if (rooms.length === 0) return;

        setLoading(true);
        const updatedData = { ...roomData };

        for (const room of rooms) {
            // Skips disabled rooms
            if (!enabledRooms[room]) {
                updatedData[room] = { ...updatedData[room], disabled: true };
                continue;
            }

            try {
                const response = await apiService.getRoomSensorData(room)
                updatedData[room] = response.data;

                // Formats timestamp to the local tim if present
                if (updatedData[room]?.timestamp) {
                    try {
                        const timestampStr = updatedData[room].timestamp;
                        let timestamp;

                        if (typeof timestampStr === 'string') {
                        
                            // Create a local time date object
                            timestamp = new Date(timestampStr);
                            

                            // Force to display UTC time instead
                            updatedData[room].formattedTime = timestamp.toUTCString();

                            // for displaying the standard format
                            const options = {
                                year: 'numeric',
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                timeZone: 'UTC' // Forcing UTC
                            };
                            updatedData[room].formattedTime = timestamp.toLocaleString('en-US', options) + ' GMT';
                        } else {
                            // If it's already a date object or number
                            timestamp = new Date(timestampStr);
                            // Store the formatted time to display
                            updatedData[room].formattedTime = timestamp.toUTCString();
                        }           
                        console.log('Original timestamp:', timestampStr);
                        console.log('Formatted timestamp:', updatedData[room].formattedTime);
                    } catch (error) {
                        console.error('Error formatting timestamp', error);
                        // Fallback to original timestamp string
                        updatedData[room].formattedTime = String(updatedData[room].timestamp);
                    }
                }
            } catch (error) {
                console.error(`Error fetching data for room ${room}`, error);
                // Keeps existing data it fetch fails
                if (roomData && roomData[room]) {
                    updatedData[room] = roomData[room];
                }
            }
        }

        setRoomData(updatedData);
        setLoading(false);
    }, [rooms, enabledRooms, roomData]);


    useEffect(() => {
        fetchAllRoomData();
        // Set up polling
        const interval = setInterval(fetchAllRoomData, 10000);
        return () => clearInterval(interval);
    }, [fetchAllRoomData]);

    const handleTabChange = (activeKey) => {
        setActiveRoom(activeKey);
    };

    const toggleRoomStatus = (room) => {
        const newEnabledRooms = {
            ...enabledRooms,
            [room]: !enabledRooms[room]
        };
        setEnabledRooms(newEnabledRooms);

        // If disabling the active room, switch to the enabled room
        if (activeRoom === room && !newEnabledRooms[room]) {
            const firstEnabledRoom = Object.keys(newEnabledRooms).find(r => newEnabledRooms[r]);
            if (firstEnabledRoom) {
                setActiveRoom(firstEnabledRoom);
            }
        }

        message.success(`Room ${room} ${newEnabledRooms[room] ? 'enabled' : 'disabled'}`)
    };

    const openAIAssistant = () => {
        // Set the active room as the default selected room for AI
        setSelectedRoomsForAI(activeRoom ? [activeRoom] : []);

        // Decide to open the AI in open modal or chatbot
        const useExistingChatbot = localStorage.getItem('useExistingChatbot') === 'true';

        if (useExistingChatbot) {
            // Set existing chatbot
            setChatbotVisible(true);

            // Welcom message that mentions the active room
            if (activeRoom) {
                setChatHistory(prev => [
                    ...prev,
                    {
                        sender: 'bot',
                        message: `I notice you're looking at the ${activeRoom} room. Would you like me to analyse this rooms data?`
                    }
                ]);
            }

        } else {
            // Use modal
            setAiModalVisible(true);
        }
    };

    const handleAIQuery = async () => {
        if (!aiQuery.trim()) {
            message.warning('Please enter a question');
            return;
        }

        setAiLoading(true);
        try {
            // Creates a query object with selected room data
            const queryData = {
                query: aiQuery,
                rooms: selectedRoomsForAI.map(room => ({
                    room_id: room,
                    data: roomData[room]
                })),
                user_id: 'web_user',
                location: activeRoom || 'Unknown'
            };

            const response = await apiService.queryAIAssistant(queryData);
            setAiResponse(response.data.answer);

            // Chat history 
            if (chatbotVisible) {
                setChatHistory(prev => [
                    ...prev,
                    { sender: 'user', message: aiQuery },
                    { sender: 'bot', message: response.data.answer }
                ]);
            }
        } catch (error) {
            console.error('Error querying AI assistant:', error);
            setAiResponse('Sorry, I encountered an error processing your request. Please try again later');
        } finally {
            setAiLoading(false);
        }
    };

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;

        // Add user message to the chat
        setChatHistory(prev => [
            ...prev,
            { sender: 'user', message: chatInput.trim() },
            { sender: 'bot', message: 'Thinking...' }
        ]);

        try {
            // Prepare data for selected rooms
            const roomsToInclude = selectedRoomsForAI.length > 0 ?
                selectedRoomsForAI :
                (activeRoom ? [activeRoom] : []);

            const queryData = {
                query: chatInput.trim(),
                rooms: roomsToInclude.map(room => ({
                    room_id: room,
                    data: roomData[room]
                })),
                user_id: 'web_user',
                location: activeRoom || 'Unknown'
            };

            const response = await apiService.queryAIAssistant(queryData);

            // Update the thinking message to an actual response
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: response.data.answer || "I couldn't process that request. Please try again." }

            ]);
        } catch (error) {
            console.error('Error in chat query:', error)
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: "Sorry, I encountered an error. Please try again." }
            ]);
        } finally {
            setChatInput('');
        }
    };

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
        <>
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
                extra={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Button
                            type="primary"
                            ghost
                            icon={<RobotOutlined />}
                            onClick={openAIAssistant}
                        >
                            Ask EcoBot
                        </Button>
                        {loading && <Spin size="small" />}
                    </div>
                }

            >
                <Tabs
                    defaultActiveKey={rooms[0] || "1"}
                    activeKey={activeRoom}
                    onChange={handleTabChange}
                    type="card"
                    tabBarStyle={{
                        marginBottom: '16px',
                    }}
                    tabBarGutter={8}
                >
                    {rooms.map(room => (
                        <Tabs.TabPane
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
                                    {roomData[room] && !roomData[room].disabled && roomData[room].flow_rate > 5 && (
                                        <Badge
                                            status={roomData[room].flow_rate > 11 ? "error" : "warning"}
                                            style={{ marginLeft: '4px' }}
                                        />
                                    )}
                                </div>
                            }
                            key={room}
                        >
                            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={{ marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                                    <PoweroffOutlined style={{ marginRight: '8px' }} />
                                    Room {enabledRooms[room] ? 'Enabled' : 'Disabled'}:
                                </span>
                                <Switch
                                    checked={enabledRooms[room]}
                                    onChange={() => toggleRoomStatus(room)}
                                    checkedChildren="ON"
                                    unCheckedChildren="OFF"
                                />
                            </div>

                            {!enabledRooms[room] ? (
                                <Empty
                                    description={`Room ${room} is currently disabled`}
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                />
                            ) : roomData[room] ? (
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
                                            percent={Math.min(1, (roomData[room].temperature || 0) / 40)}
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
                                                    roomData[room].temperature.toFixed(1) : "N/A"} °C
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
                                                {(roomData[room]?.flow_rate !== undefined && roomData[room]?.flow_rate !== null) ?
                                                    parseFloat(roomData[room].flow_rate).toFixed(1) : "N/A"} L/min

                                            </Title>
                                            <div style={{ margin: '20px 0', padding: '0 10px' }}>
                                                <div style={{
                                                    marginBottom: '10px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <Text>0 L/min</Text>
                                                    <Text>5.5 L/min</Text>
                                                    <Text>11 L/min</Text>
                                                </div>
                                                <div style={{
                                                    height: '24px',
                                                    backgroundColor: '#E3F2FD',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    border: '1px solid #BBDEFB'
                                                }}>
                                                    <div style={{
                                                        width: `${Math.min(100, ((roomData[room]?.flow_rate != null ? roomData[room].flow_rate : 0) / 11 * 100))}%`,
                                                        height: '100%',
                                                        backgroundColor: (roomData[room]?.flow_rate != null && roomData[room]?.flow_rate > 11) ? '#F44336' : 
                                                                        (roomData[room]?.flow_rate != null && roomData[room]?.flow_rate >5) ? '#FF9800' : '#2196F3',
                                                        borderRadius: '12px',
                                                        transition: 'width 0.5s ease'
                                                    }}>

                                                    </div>
                                                </div>
                                                <Text
                                                    style={{ textAlign: 'center', marginTop: '10px', display: 'block' }}
                                                    type={
                                                        roomData[room]?.flow_rate > 11 ? "danger" :
                                                        roomData[room]?.flow_rate > 5 ? "warning" :
                                                            roomData[room]?.flow_rate > 0 ? "processing" :
                                                                "success"
                                                    }
                                                >
                                                    {roomData[room]?.flow_rate > 11 ? "High Usage" :
                                                     roomData[room]?.flow_rate > 5 ? "Warning: Elevated Usage" :
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
                                                            roomData[room]?.flow_rate > 11 ?
                                                            "error" :
                                                            roomData[room]?.flow_rate > 5 ?
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
                                                            roomData[room]?.flow_rate > 11 ?
                                                            "Needs Attention" :
                                                            roomData[room]?.flow_rate > 5 ?
                                                            "Warning: Check Water Usage" : "Optimal"
                                                    }
                                                </Text>
                                            </div>
                                            <div style={{ margin: '8px 0' }}>
                                                <ClockCircleOutlined style={{ marginRight: '8px', color: '#388E2C' }} />
                                                <Text>Last Updated: {roomData[room]?.formattedTime ||
                                                    (roomData[room]?.timestamp ?
                                                        new Date(roomData[room].timestamp).toLocaleString() : "N/A")}</Text>
                                            </div>
                                            {roomData[room]?.flow_rate > 0 && (
                                                <div style={{ margin: '8px 0' }}>
                                                    <DropboxOutlined style={{ marginRight: '8px', color: '#1976D2' }} />
                                                    <Text type={
                                                        roomData[room]?.flow_rate > 11 ? "danger" :
                                                        roomData[room]?.flow_rate > 5 ? "warning" : "processing"}>
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
                        </Tabs.TabPane>
                    ))}
                </Tabs>

                {activeRoom && enabledRooms[activeRoom] && roomData[activeRoom] && (
                    <div style={{ marginTop: '20px' }}>
                        <AnomalyDetection
                            sensorData={roomData[activeRoom]}
                            roomId={activeRoom}
                        />
                        <EnergyOptimiser
                            roomId={activeRoom}
                        />
                    </div>
                )}
            </Card>
            {/*AI assistant Modal*/}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <RobotOutlined style={{ marginRight: '10px', color: '#1976D2' }} />
                        <span>EcoBot AI Assistant</span>
                    </div>
                }
                open={aiModalVisible}
                onCancel={() => setAiModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setAiModalVisible(false)}>
                        Close
                    </Button>,
                    <Button
                        key="ask"
                        type="primary"
                        loading={aiLoading}
                        onClick={handleAIQuery}
                    >
                        Ask EcoBot
                    </Button>
                ]}
                width={700}

            >
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                        <Text strong style={{ marginRight: '10px' }}>Select rooms to include in analysis:</Text>
                        <QuestionCircleOutlined title="Data from these rooms will be included in EcoBot's analysis" />
                    </div>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Select rooms to include"
                        value={selectedRoomsForAI}
                        onChange={setSelectedRoomsForAI}
                    >
                        {rooms.filter(room => enabledRooms[room]).map(room => (
                            <Option key={room} value={room}>
                                {room.charAt(0).toUpperCase() + room.slice(1)}
                            </Option>
                        ))}
                    </Select>
                </div>
                <div style={{ marginBottom: '20px' }}>
                    <Text strong>Ask EcoBot about your environmental data:</Text>
                    <textarea
                        style={{
                            width: '100%',
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #d9d9d9',
                            marginTop: '8px',
                            minHeight: '80px',
                            resize: 'vertical'
                        }}
                        placeholder="e.g, How can I improve the temperature in my bedroom? or Is my water usage normal?"
                        value={aiQuery}
                        onChange={(e) => setAiQuery(e.target.value)}
                    />
                </div>
                {aiResponse && (
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        backgroundColor: '#f0f8ff',
                        borderRadius: '8px',
                        border: '1px solid #91d5ff'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1976D2' }}>
                            <RobotOutlined style={{ marginRight: '8px' }} />
                            EcoBot Response:
                        </div>
                        <div style={{ whiteSpace: 'pre-line' }}>
                            {aiResponse}
                        </div>
                    </div>
                )}
            </Modal>
            {/* EcoBot ChatBot*/}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#4CAF50' }} />
                        <span style={{ color: '#388E2C', fontWeight: 'bold' }}>EcoBot AI Chatbot</span>
                        {selectedRoomsForAI.length > 0 && (
                            <Badge count={selectedRoomsForAI.length} style={{ backgroundColor: '#52c41a' }}>
                                <span style={{ marginLeft: '5px', fontSize: '12px', color: '#555' }}>
                                    Rooms Selected
                                </span>
                            </Badge>
                        )}
                    </div>
                }
                open={chatbotVisible}
                onCancel={() => setChatbotVisible(false)}
                footer={null}
                width={400}
                bodyStyle={{ backgroundColor: '#F1F8E9' }}
                style={{ top: 20 }}
            >

                <div style={{ marginBottom: '10px' }}>
                    <Text strong>Selected rooms for analysis:</Text>
                    <Select
                        mode="multiple"
                        style={{ width: '100%', marginTop: '5px' }}
                        placeholder="Selected Rooms to include"
                        value={selectedRoomsForAI}
                        onChange={setSelectedRoomsForAI}
                        size="small"
                    >
                        {rooms.filter(room => enabledRooms[room]).map(room => (
                            <Option key={room} value={room}>
                                {room.charAt(0).toUpperCase() + room.slice(1)}
                            </Option>
                        ))}
                    </Select>
                </div>
                <div style={{
                    height: '300px',
                    overflowY: 'auto',
                    marginBottom: '10px',
                    padding: '5px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {chatHistory.map((chat, index) => (
                        <div key={index} style={{
                            textAlign: chat.sender === 'user' ? 'right' : 'left',
                            margin: '8px 0',
                            padding: '10px',
                            borderRadius: '15px',
                            backgroundColor: chat.sender === 'user' ? '#C8E5C9' : '#E8F5E9',
                            maxWidth: '80%',
                            alignSelf: chat.sender === 'user' ? 'flex-end' : 'flex-start',
                            fontSize: '14px',
                            display: 'inline-block',
                            marginLeft: chat.sender === 'user' ? 'auto' : '0',
                            marginRight: chat.sender === 'user' ? '0' : 'auto',
                        }}>
                            <div>{chat.message}</div>
                            <span style={{ fontSize: '10px', color: 'gray' }}>
                                {new Date().toLocaleTimeString()}
                            </span>
                        </div>
                    ))}
                </div>

                {aiLoading && <Spin style={{ display: 'block', margin: '10px auto' }} />}

                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    {["Hows my bedroom temperature?", "Water usage in bathroom", "Compare all rooms"].map((suggestion, idx) => (
                        <Button
                            key={idx}
                            size="small"
                            onClick={() => {
                                setChatInput(suggestion);
                                setChatHistory(prev => [...prev, { sender: 'user', message: suggestion }]);
                                setTimeout(() => handleChatSend(), 100);
                            }}
                        >
                            {suggestion}
                        </Button>
                    ))}
                </div>
                <Input.Search
                    placeholder='Ask about room data...'
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    enterButton={<SendOutlined />}
                    onSearch={handleChatSend}
                    loading={aiLoading}
                />
            </Modal>
        </>

    );
}
export default RoomMonitor;