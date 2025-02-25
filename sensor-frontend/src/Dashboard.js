import React, { useEffect, useState } from 'react'; 
import axios from 'axios'; // Avios is used for HTTP requests. Reference: https://axios-http.com/docs/intro
import GaugeChart from 'react-gauge-chart'; // Gauge chart component https://antoniolago.github.io/react-gauge-component/ and https://www.npmjs.com/package/react-gauge-chart
import { Card, Slider, Button, Select, Spin, Progress, Modal, Input, Avatar } from 'antd'; // Ant Design Components Reference: https://ant.design/components/overview
import { RobotOutlined, SendOutlined } from '@ant-design/icons' // Avatar Icon for chatbot window:https://www.v0.app/icon/ant-design/robot-outlined 
import chatbotIcon from './Icon-Only-Color.png' // leaf icon for AI chatbot Icon

const { Option } = Select;
//Stores sensor data such as temperature,humidity,water usage and CO2 leves
const Dashboard = () => {
    const [data, setData] = useState({ 
        temperature: null,
        humidity: null,
        waterUsage: null,
        co2: null,
        pressure: null,
        altitude: null,
        imu: { 
            acceleration: [0,0,0],
            gyroscope: [0,0,0],
            magnetometer: [0,0,0],
        },
     });
    const [waterFlow, setWaterFlow] = useState(null);
    const [waterUnit, setWaterUnit] = useState("L/min");
    const [carbonFootprint, setCarbonFootprint] = useState(0);
    const [temperatureTrends, setTemperatureTrends] = useState([]);
    const [co2Trends, setCo2Trends] = useState([]);
    const [thresholds, setThresholds] = useState({
        temperature_range: [20, 25],
        humidity_range: [30, 60],
    });
    // For displayinh trends in temperature and CO2 levels,including user defined thresholds
    const [selectedRange, setSelectedRange] = useState('24h');
    const [loading, setLoading] = useState(false)
    const [isUpdatingThresholds, setIsUpdatingThresholds] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);
    const [isChatbotVisible, setIsChatbotVisible] = useState(false) //stores user queries in the bot,still in development for SageMaker 
    const [chatHistory, setChatHistory] = useState([
        { sender: 'bot', message: 'Hello! How can I assist you today?' },]);
    const [userInput, setUserInput] = useState('')

    const CPU_TEMPERATURE_OFFSET = 5; //Normalise CPU temperature to reduce noise in the temperature value

    /**
     * Adjusts temperature readings to exclude CPU output
     * @param {number} temperature 
     * @returns {number|null} - Normalised temperature normalise or null if there is no data 
     * Reference within Requirements documentation
     */
    useEffect(() => {
        const fetchWaterFlowData = async() => {
            try{
                const response = await axios.get('http://localhost:5000/api/water-usage')
                setWaterFlow(response.data.flow_rate);
                setWaterUnit(response.data.unit);
            } catch (error){
                console.error('Error fetching water usage:', error)
            }
        };
        fetchWaterFlowData();
        const interval = setInterval(fetchWaterFlowData, 5000);
        return () => clearInterval(interval);
    }, [])
    
    const normaliseTemperature = (temperature) => {
        if (temperature === null) return null;
        return temperature - CPU_TEMPERATURE_OFFSET;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await axios.get('http://localhost:5000/api/sensor-data');
                const normalisedTemperature = normaliseTemperature(response.data.temperature);
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
        const fetchWaterFlowData = async () => {
            try {
                const response = await axios.get(`http://localhost:5000/api/water-usage`);
                setWaterFlow(response.data.flow_rate);
            } catch (error) {
                console.error('Error fetching water flow data', error);
            }
        };
            fetchWaterFlowData();
            const interval = setInterval(fetchWaterFlowData, 5000);
            return () => clearInterval(interval);
        }, []);
        


//fetches ranges for co2 and temperature  References:https://blog.logrocket.com/understanding-axios-get-requests/
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
        const fetchCarbonFootprint = async () => {
            try{
                const response = await axios.get('http://localhost:5000/api/carbon-footprint');
                setCarbonFootprint(response.data.carbon_footprint);
            } catch (error){
                console.error('Error fetching carbon footprint', error);
            }
        };
        fetchCarbonFootprint();
        const interval = setInterval(fetchCarbonFootprint, 5000)
        return () => clearInterval(interval);
    },[])

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
    // Fetches the defail threshold ranges from the backend for the humidity and temperature
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
    //Sends updated thresholds to the backend API 
    //Reference: https://axios-http.com/docs/post_example
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

    const calculateCarbonFootprint = () => {
        if (data.temperature !== null && waterFlow !== null) {
            let footprint = (data.temperature * 0.2) + (waterFlow * 0.5);

            if(data.altitude !== null){
                footprint += data.altitude * 0.1;
            }

            if(data.pressure !== null){
                footprint += data.pressure * 0.05;
            }
            return Math.min(footprint, 100);
        }

        return 0;
    }

    useEffect(() => {
        setCarbonFootprint(calculateCarbonFootprint());
    }, [data, waterFlow])

//caluclation of threshold ranges for temperature and humidity
    const tempValue = data.temperature !== null
        ? Math.min(Math.max((data.temperature - thresholds.temperature_range[0]) / (thresholds.temperature_range[1] - thresholds.temperature_range[0]), 0), 1)
        : 0;
    const humValue = data.humidity !== null
        ? Math.min(Math.max((data.humidity / thresholds.humidity_range[0]) / (thresholds.humidity_range[1] - thresholds.humidity_range[0]), 0), 1)
        : 0;
//Calculates the displayed CO2 value Reference:
    const co2Gradient = (value) => {
        const percentage = Math.min((value / 1000) * 100, 100);

        return `linear-gradient(to right, green ${percentage - 50}%, yellow ${percentage - 20}%, red ${percentage}%)`
    };
    //Not working yet but this track chat history of submitted queries
    const handleSendMessage = async (message = userInput) => {
        message =String(message)
        if (!message.trim()) return;

        setChatHistory(prev => [
            ...prev, 
            { sender: 'user', message: message.trim()}, 
            {sender: 'bot', message: 'Typing...'}]);

        setLoadingAI(true);
        
        try{
            const { data } = await axios.post('http://localhost:5000/api/ai-assistant', {
                query: message.trim()
            });

            //Update chat history with AI response
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: data.answer || "No response generated"}
            ]);
        } catch (error){
            console.error('Error communicating with AI assistant:', error);
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: "Apologies, unable to process an answer for you request, please try again"}
            ]);
        } finally {
            setUserInput('');
            setLoadingAI(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setUserInput(suggestion);
        handleSendMessage(suggestion)
    }

    return ( //styling and structure for gauges,progress bars,and CO2 gradient percentage referenced above.This also is the sytling and customisation for the user preferences fo the range of temperature data
        <>
            {loading && <Spin size="large" />}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px' }}>
                <Card title="Temperature">
                    <p style={{fontSize: '12px',color: 'gray'}}>
                        Monitors room temperature to optimize heating/cooling systems and reduce energy use and carbon footprint
                    </p>
                    <GaugeChart id="temperature-gauge" nrOfLevels={20} percent={tempValue} needleBaseColor="red" needleColor='red' />
                    <p>{data.temperature !== null && data.temperature !== undefined ? `${data.temperature.toFixed(2)}°C` : 'Loading...'}</p>
                </Card>
                <Card title="Humidity">
                    <p style={{fontSize: '12px', color:'gray'}}>
                        Measures humidity to maintain optimal levels of storage greenhouse environments reducing waste
                    </p>
                    <GaugeChart id="humidity-gauge" nrOfLevels={20} percent={humValue} needleBaseColor="blue" needleColor="blue" />
                    <p>{data.humidity !== null && data.humidity !== undefined ? `${data.humidity.toFixed(2)}%` : 'Loading...'}</p>
                </Card>
                <Card title="Barometric Pressure">
                <p style={{ fontSize: '12px', color: 'gray'}}>
                        Provides weather insights and helps scheduling operations efficiently, reducing eneccessary energy usage
                    </p>
                    <Progress
                        percent={data.pressure !== null && data.pressure !== undefined ? Math.min((data.pressure / 1100) * 100, 100) : 0} // Max 1100 hPa
                        status = "active"
                        showInfo ={true}
                    />
                    <p>{data.pressure !== null && data.pressure !== undefined ? `${data.pressure.toFixed(2)} hPa` : 'Loading..'}</p>
                </Card>
                <Card title="Altitude">
                    <p style={{ fontSize: '12px', color: 'gray'}}>
                        Tracks changes to elevation, which can impact energy consumption for machiner and transport, inirectly influencing emissions
                    </p>
                    <Progress
                        percent={data.altitude !== null && data.altitude !== undefined ? Math.min((data.altitude / 5000) * 100, 100) : 0} // Max 5000 meters
                        status="active"
                        showInfo={true}
                    />
                    <p>{data.altitude !== null && data.altitude !== undefined ? `${data.altitude.toFixed(2)} m` : 'Loading..'}</p>
                </Card>
                <Card title="IMU Data">
                    <p style={{ fontsize: '12px', color: 'gray'}}>
                        Measures equipment usage and driving behaviou and asset tracking to improve operation efficiency and reduce carbon footprint
                    </p>
                    <p>Acceleration (m/s²)</p>
                    <Progress 
                        percent={data.imu && data.imu.acceleration && data.imu.acceleration[0] !== undefined ? Math.min(Math.abs(data.imu.acceleration[0]), 100) :0 }
                        status="active"
                        showInfo={true}
                    />
                    <p>Gyroscope (°/s):</p>
                    <Progress
                        percent={data.imu && data.imu.gyroscope && data.imu.gyroscope[0] !== undefined ? Math.min(Math.abs(data.imu.gyroscope[0]), 100) :0}
                        status="active"
                        showInfo={true}
                    />
                    <p>Magnetometer (μT):</p>
                    <Progress
                        percent={data.imu && data.imu.magnetometer && data.imu.magnetometer[0] !== undefined ? Math.min(Math.abs(data.imu.magnetometer[0]), 100) :0}
                        status="active"
                        showInfo={true}
                    />
                </Card>
                <Card title="Water Usage">
                    <p style={{fontSize: '12px', color: 'gray'}}>
                        Monitors water consumption in real time
                    </p>
                    <Progress
                        percent={(data.waterFlow / 100) * 100}
                        status="active"
                        showInfo={true}
                    />
                    <p>{waterFlow !== null ? `${waterFlow.toFixed(2)} ${waterUnit}` : 'Loading...'}</p>
                </Card>
                <Card title="Carbon Footprint Impact">
                    <Progress 
                        percent={carbonFootprint}
                        status="active"
                        showInfo={true}
                    />
                    <p>{carbonFootprint.toFixed(2)}% environmental impact</p>
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
                <div style={{ height: '300px', overflowY: 'auto', marginBottom: '10px', padding: '5px', border: '1px solid #d9d9d9', borderRadius: '10px'}}>
                    {/* implementation still being worked on*/}
                    {chatHistory.map((chat, index) => (
                        <div key={index} style={{
                                textAlign: chat.sender === 'user' ? 'right' : 'left',
                                margin: '8px 0',
                                padding: '10px',
                                borderRadius: '15px',
                                backgroundColor: chat.sender === 'user' ? '#d9f7be' : '#f0f0f0',
                                maxWidth: '80%',
                                alignSelf: chat.sender === 'user' ? 'flex-end': 'flex-start',
                                fontSize: '14px',
                            }}
                        >
                            <div>{chat.message}</div>
                            <span style={{ fontSize: '10px', color: 'gray'}}>{new Date().toLocaleTimeString()}</span>
                        </div>
                    ))} 
                </div>
                {loadingAI && <Spin style={{ display: 'block', margin: '10px auto'}} />}
                <div style={{ display: 'flex', gap:'10px', marginBottom: '10px'}}>
                    {["How can I reduce my carbon footprint?", "Tips for saving water", "Best eco-friendly matierals"].map((suggestion, idx) => (
                        <Button key={idx} size="small" onClick={() => handleSuggestionClick(suggestion)}>
                            {suggestion}
                        </Button>
                    ))}
                </div>
                <Input
                    placeholder='Enter you question...'
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onPressEnter={(e) =>{
                        e.preventDefault();
                        handleSendMessage();
                    }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',marginBottom: '10px' }}>
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