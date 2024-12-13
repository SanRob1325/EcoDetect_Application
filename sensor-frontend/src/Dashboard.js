import React, { useEffect, useState } from 'react';
import axios from 'axios';
import GaugeChart from 'react-gauge-chart';
import { Card, Slider, Button, Select, Spin, Progress, Modal, Input, Avatar } from 'antd';
import { RobotOutlined, SendOutlined } from '@ant-design/icons'
import chatbotIcon from './Icon-Only-Color.png'

const { Option } = Select;

const Dashboard = () => {
    const [data, setData] = useState({ temperature: null, humidity: null, waterUsage: null, co2: null });
    const [temperatureTrends, setTemperatureTrends] = useState([]);
    const [co2Trends, setCo2Trends] = useState([]);
    const [thresholds, setThresholds] = useState({
        temperature_range: [20, 25],
        humidity_range: [30, 60],
    });

    const [selectedRange, setSelectedRange] = useState('24h');
    const [loading, setLoading] = useState(false)
    const [isUpdatingThresholds, setIsUpdatingThresholds] = useState(false);
    const [isChatbotVisible, setIsChatbotVisible] = useState(false)
    const [chatHistory, setChatHistory] = useState([
        { sender: 'bot', message: 'Hello! How can I assist you today?' },]);
    const [userInput, setUserInput] = useState('')

    const CPU_TEMPERATURE_OFFSET = 5;

    const normaliseTemperature = (temperature) => {
        if (temperature === null) return null;
        return temperature - CPU_TEMPERATURE_OFFSET;
    }

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/sensor-data')
                const normalisedTemperature = normaliseTemperature(response.data.temperature)
                setData({

                    ...response.data,
                    temperature: normalisedTemperature,

                });
            } catch (error) {
                console.error('Error fetching sensor data', error);
            } finally {
                setLoading(false)
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchCo2Trends = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/co2-trends?range=${selectedRange}`);
                setCo2Trends(response.data);
            } catch (error) {
                console.error('Error fetching CO2 trends', error);
            }
        };
        fetchCo2Trends();
    }, [selectedRange]);

    useEffect(() => {
        const fetchTrends = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/temperature-trends?range=${selectedRange}`);
                setTemperatureTrends(response.data)
            } catch (error) {
                console.error("Error fetching temperature trends", error);
            } finally {
                setLoading(false)
            }
        };
        fetchTrends();
    }, [selectedRange]);

    useEffect(() => {
        const fetchThresholds = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/get-thresholds');
                setThresholds(response.data);
            } catch (error) {
                console.error('Error fetching thresholds', error)
            } finally {
                setLoading(false)
            }
        };
        fetchThresholds();
    }, []);

    const updateThresholds = async () => {
        setIsUpdatingThresholds(true)
        try {
            await axios.post('http://localhost:5000/api/set-thresholds', thresholds)
            alert('Thresholds updated successfully!')
        } catch (error) {
            console.error('Error updating thresholds', error);
        } finally {
            setIsUpdatingThresholds(false)
        }
    };

    const tempValue = data.temperature !== null
        ? Math.min(Math.max((data.temperature - thresholds.temperature_range[0]) / (thresholds.temperature_range[1] - thresholds.temperature_range[0]), 0), 1)
        : 0;
    const humValue = data.humidity !== null
        ? Math.min(Math.max((data.humidity / thresholds.humidity_range[0]) / (thresholds.humidity_range[1] - thresholds.humidity_range[0]), 0), 1)
        : 0;

    const co2Gradient = (value) => {
        const percentage = Math.min((value / 1000) * 100, 100);

        return `linear-gradient(to right, greem ${percentage - 50}%, yellow ${percentage - 20}%, red ${percentage}%)`
    };

    const handleSendMessage = () => {
        if (!userInput.trim()) return;
        setChatHistory([...chatHistory, { sender: 'user', message: userInput }]);

        setChatHistory((prev) => [
            ...prev,
            { sender: 'user', message: userInput },
            { sender: 'bot', message: `You asked: ${userInput}` },
        ]);
        setUserInput('');
    };
    return (
        <>
            {loading && <Spin size="large" />}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px' }}>
                <Card title="Temperature">
                    <GaugeChart id="temperature-gauge" nrOfLevels={20} percent={tempValue} needleBaseColor="red" needleColor='red' />
                    <p>{data.temperature !== null ? `${data.temperature.toFixed(2)}°C` : 'Loading...'}</p>
                </Card>
                <Card title="Humidity">
                    <GaugeChart id="humidity-gauge" nrOfLevels={20} percent={humValue} needleBaseColor="blue" needleColor="blue" />
                    <p>{data.humidity !== null ? `${data.humidity.toFixed(2)}%` : 'Loading...'}</p>
                </Card>
                <Card title="Water Usage">
                    <Progress
                        percent={(data.waterUsage / 100) * 100}
                        status="active"
                        showInfo={true}
                    />
                    <p>{data.waterUsage !== null ? `${data.waterUsage} litres` : 'Loading...'}</p>
                </Card>
                <Card title="Current Co2 Levels"
                    style={{
                        background: co2Gradient(data.co2 || 0),
                        color: '#fff',
                        padding: '20px',
                        textAlign: 'center',
                    }}
                >
                    <h2>{data.co2 ? `${data.co2} ppm` : 'Loading...'} </h2>
                </Card>
            </div>
            {/*Chatbot opens */}
            <Button
                type="primary"
                shape="circle"
                icon={<RobotOutlined />}
                style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, backgroundColor: '#1890ff', color: '#fff' }}
                onClick={() => setIsChatbotVisible(true)}
            />
            {/*Chatbot Modal*/}
            <Modal

                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar src={chatbotIcon} alt="Chatbot Icon" />
                        <span>AI Chatbot</span>
                    </div>
                }
                open={isChatbotVisible}
                onCancel={() => setIsChatbotVisible(false)}
                footer={null}
                width={400}
            >
                <div style={{ height: '300px', overflowY: 'auto', marginBottom: '10px' }}>
                    {/* implementation still being worked on*/}
                    {chatHistory.map((chat, index) => (
                        <div
                            key={index}
                            style={{
                                textAlign: chat.sender === 'user' ? 'right' : 'left',
                                margin: '5px 0',
                                padding: '5px 10px',
                                borderRadius: '10px',
                                backgroundColor: chat.sender === 'user' ? '#e6f7ff' : '#f5f5f5',
                                display: 'inline-block',
                                maxWidth: '80%',
                            }}
                        >
                            {chat.message}
                        </div>
                    ))}
                </div>
                <Input
                    placeholder='Enter you question...'
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onPressEnter={handleSendMessage}
                    addonAfter={
                        <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage}>
                            Send
                        </Button>
                    }
                />
            </Modal>
            <Card title="CO2 Trends" style={{ marginTop: '16px' }}>
                <div style={{ display: "flex", justifyContent: 'space-between', alignItems: 'center' }}>
                    <p>Select Range</p>
                    <Select
                        defaultValue="days"
                        onChange={(value) => setSelectedRange(value)}
                        style={{ width: '150px' }}
                    >
                        <Option value="days">Daily</Option>
                        <Option value="months">Monthly</Option>
                    </Select>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                    {co2Trends.map((trend, index) => (
                        <Card
                            key={index}
                            style={{
                                background: co2Gradient(trend.co2),
                                color: '#fff',
                                width: '150px',
                                textAlign: 'center',
                            }}
                        >
                            <p>{selectedRange === 'days' ? trend.day : trend.month}</p>
                            <h3>{trend.co2} ppm</h3>
                        </Card>
                    ))}
                </div>
            </Card>
            <Card title="Preffered Ranges" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                        <p>Temperature Range (°C):</p>
                        <Slider
                            range
                            min={0}
                            max={40}
                            value={thresholds.temperature_range}
                            onChange={(value) => setThresholds({ ...thresholds, temperature_range: value })}
                        />
                    </div>
                    <div>
                        <p>Humidity Range (%):</p>
                        <Slider
                            range
                            min={0}
                            max={100}
                            value={thresholds.humidity_range}
                            onChange={(value) => setThresholds({ ...thresholds, humidity_range: value })}
                        />
                    </div>
                </div>
                <Button type="primary" onClick={updateThresholds} style={{ marginTop: '16px' }}>
                    Update Thresholds
                </Button>
            </Card>
            <Card title="Temperature Trends" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p>Select Range:</p>
                    <Select defaultValue="24h" onChange={(value) => setSelectedRange(value)} style={{ width: '150px' }}>
                        <Option value="24h">Last 24 Hours</Option>
                        <Option value="7d">Last 7 Days</Option>
                        <Option value="30d">Last 30 Days</Option>
                    </Select>
                </div>
                <div>
                    {temperatureTrends.map((trend, index) => (
                        <div key={index}>
                            <span>{trend.time}</span>
                            <span>{trend.temperature} C</span>
                        </div>

                    ))}
                </div>
            </Card>
        </>
    );
}
export default Dashboard;