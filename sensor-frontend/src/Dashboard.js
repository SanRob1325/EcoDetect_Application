import React, { useEffect, useState } from 'react';
import GaugeChart from 'react-gauge-chart'; // Gauge chart component https://antoniolago.github.io/react-gauge-component/ and https://www.npmjs.com/package/react-gauge-chart
import { Card, Slider, Button, Select, Spin, Progress, Modal, Input, Avatar, Checkbox } from 'antd'; // Ant Design Components Reference: https://ant.design/components/overview
import { RobotOutlined, SendOutlined } from '@ant-design/icons' // Avatar Icon for chatbot window:https://www.v0.app/icon/ant-design/robot-outlined 
import chatbotIcon from './Icon-Only-Color.png' // leaf icon for AI chatbot Icon
import { notification} from 'antd';
import Alerts from './Alerts';
import CarbonFootprintCard from './CarbonFootprint';
import ReportCard from './ReportCard';
import VehicleEmissions from './VehicleEmissions';
import apiService from './apiService';

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
            acceleration: [0, 0, 0],
            gyroscope: [0, 0, 0],
            magnetometer: [0, 0, 0],
        },
    });
    const [alerts, setAlerts] = useState([])
    const [waterFlow, setWaterFlow] = useState(null);
    const [waterUnit, setWaterUnit] = useState("L/min");
    const [temperatureTrends, setTemperatureTrends] = useState([]);
    const [co2Trends, setCo2Trends] = useState([]);
    const [thresholds, setThresholds] = useState({
        temperature_range: [20, 25],
        humidity_range: [30, 60],
    });
    // For displaying trends in temperature and CO2 levels,including user defined thresholds
    const [selectedRange, setSelectedRange] = useState('24h');
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isUpdatingThresholds, setIsUpdatingThresholds] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);
    const [isChatbotVisible, setIsChatbotVisible] = useState(false) //stores user queries in the bot,still in development for SageMaker 
    const [chatHistory, setChatHistory] = useState([
        { sender: 'bot', message: 'Hello! How can I assist you today?' },]);
    const [userInput, setUserInput] = useState('');
    const [dataLastUpdated, setDataLastUpdated] = useState('');

    const CPU_TEMPERATURE_OFFSET = 5; //Normalise CPU temperature to reduce noise in the temperature value

    const [notificationPrefs, setNotificationPrefs] = useState({
        sms_enabled: true,
        email_enabled: true,
        critical_only: false
    })

    // Format numbers consitently
    const formatNumber = (value, precision = 1) => {
        if (value === null || value === undefined) return null;
        return Number(value).toFixed(precision);
    };
    // Loads a subtl fade
    const LoadingContent = () => (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '120px',
            opacity: 0.5,
            transition: 'opacity 0.5s ease',
            position: 'relative'
        }}>
            <Spin size="small" />
        </div>
    );
    const CardTitle = ({ title, isFirstLoad }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{title}</span>
            {isFirstLoad && <Spin size="small" style={{ opacity: 0.6 }} />}
        </div>
    );

    // Card styling
    const cardStyle = {
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        backgroundColor: '#F1F8E9',
        height: '100%'
    };

    const cardHeadStyle = {
        backgroundColor: '#388E2C',
        color: 'white',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
    };

    // Calculate time since last update
    const getDataFreshness = () => {
        const seconds = Math.floor((Date.now() - dataLastUpdated) / 1000);
        return seconds
    }

    /**
     * Adjusts temperature readings to exclude CPU output
     * @param {number} temperature 
     * @returns {number|null} - Normalised temperature normalise or null if there is no data 
     * Reference within Requirements documentation
     */
    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const response = await apiService.getAlerts()
                setAlerts(response.data)

                // Show notification for the most recent alert if its new
                if (response.data.length > 0 && alerts.length === 0) {
                    const latestAlert = response.data[0];
                    notification.warning({
                        message: 'Threshold Alert',
                        description: `${latestAlert.exceeded_thresholds.join(', ')} thresholds exceeded.`,
                        duration: 5
                    })
                }
            } catch (error) {
                console.error('Error fetching alerts:', error)
            }
        }

        fetchAlerts();
        const interval = setInterval(fetchAlerts, 30000); // every 30 seconds
        return () => clearInterval(interval)

    }, [alerts.length])

    useEffect(() => {
        const fetchNotificationPrefs = async () => {
            try {
                const response = await apiService.getNotificationPreferences()
                setNotificationPrefs(response.data);
            } catch (error) {
                console.error('Error fetching notification preferences:', error)
            }
        }

        fetchNotificationPrefs();
    }, [])

    // Fetch water flow data withinoult loading indicator
    useEffect(() => {
        const fetchWaterFlowData = async () => {
            try {
                const response = await apiService.getWaterUsage()
                setWaterFlow(response.data.flow_rate);
                setWaterUnit(response.data.unit);
            } catch (error) {
                console.error('Error fetching water usage:', error)
            }
        };
        fetchWaterFlowData();
        const interval = setInterval(fetchWaterFlowData, 5000);
        return () => clearInterval(interval);
    }, [])

    // Normalise temperature by taking CPU heat to account
    const normaliseTemperature = (temperature) => {
        if (temperature === null) return null;
        return temperature - CPU_TEMPERATURE_OFFSET;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await apiService.getSensorData();
                const normalisedTemperature = normaliseTemperature(response.data.temperature);
                setData({
                    ...response.data,
                    temperature: normalisedTemperature,
                });
                setDataLastUpdated(Date.now());
            } catch (error) {
                console.error('Error fetching sensor data', error);
            } finally {
                setIsInitialLoading(false)
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);



    //fetches ranges for co2 and temperature  References:https://blog.logrocket.com/understanding-axios-get-requests/
    useEffect(() => {
        const fetchCo2Trends = async () => {
            if (!selectedRange) return;

            try {
                const response = await apiService.getCo2Trends(selectedRange);
                setCo2Trends(response.data);
            } catch (error) {
                console.error('Error fetching CO2 trends', error);
            }
        };
        fetchCo2Trends();
    }, [selectedRange]);

    useEffect(() => {
        const fetchTrends = async () => {

            if (!selectedRange) return
            try {
                const response = await apiService.getTemperatureTrends(selectedRange);
                setTemperatureTrends(response.data)
            } catch (error) {
                console.error("Error fetching temperature trends", error);
            }
        };
        fetchTrends();
    }, [selectedRange]);

    // Fetches the defail threshold ranges from the backend for the humidity and temperature
    useEffect(() => {
        const fetchThresholds = async () => {
            try {
                const response = await apiService.getThresholds();
                setThresholds(response.data);
            } catch (error) {
                console.error('Error fetching thresholds', error)
            }
        };
        fetchThresholds();
    }, []);
    //Sends updated thresholds to the backend API 
    //Reference: https://axios-http.com/docs/post_example
    const updateThresholds = async () => {
        setIsUpdatingThresholds(true)
        try {
            await apiService.setThresholds(thresholds);
            notification.success({
                message: 'Success',
                description: 'Thresholds updated successfully!',
                duration: 3
            });
        } catch (error) {
            console.error('Error updating thresholds', error);
            notification.error({
                message: 'Error',
                description: 'Failed to update thresholds',
                duration: 3
            });
        } finally {
            setIsUpdatingThresholds(false)
        }
    };
    // Update notificaiton preferences
    const updateNotificationPrefs = async () => {
        try {
            await apiService.setNotificationPreferences(notificationPrefs);
            notification.success({
                message: 'Success',
                description: 'Notification preferences updated successfully',
                duration: 3
            });
        } catch (error) {
            console.error('Error updating notification preferences:', error)
            notification.error({
                message: 'Error',
                description: 'Failed to update notification preferences',
                duration: 3
            })
        }
    }

    //caluclation of threshold ranges for temperature and humidity
    const tempValue = data.temperature !== null
        ? Math.min(Math.max((data.temperature - thresholds.temperature_range[0]) / (thresholds.temperature_range[1] - thresholds.temperature_range[0]), 0), 1)
        : 0;
    const humValue = data.humidity !== null
        ? Math.min(Math.max((data.humidity - thresholds.humidity_range[0]) / (thresholds.humidity_range[1] - thresholds.humidity_range[0]), 0), 1)
        : 0;
    //Calculates the displayed CO2 value Reference:
    const co2Gradient = (value) => {
        const percentage = Math.min((value / 1000) * 100, 100);
        return `linear-gradient(to right, green ${percentage - 50}%, yellow ${percentage - 20}%, red ${percentage}%)`
    };

    //Not working yet but this track chat history of submitted queries
    const handleSendMessage = async (message = userInput) => {
        message = String(message)
        if (!message.trim()) return;

        setChatHistory(prev => [
            ...prev,
            { sender: 'user', message: message.trim() },
            { sender: 'bot', message: 'Typing...' }
        ]);

        setLoadingAI(true);

        try {
            const { data } = await apiService.queryAIAssistant(message.trim());
            //Update chat history with AI response
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: data.answer || "No response generated" }
            ]);
        } catch (error) {
            console.error('Error communicating with AI assistant:', error);
            setChatHistory(prev => [
                ...prev.slice(0, -1),
                { sender: 'bot', message: "Apologies, unable to process an answer for you request, please try again" }
            ]);
        } finally {
            setUserInput('');
            setLoadingAI(false);
        }
    };
    // Handling suggestion clicks
    const handleSuggestionClick = (suggestion) => {
        setUserInput(suggestion);
        handleSendMessage(suggestion)
    }

    return ( //styling and structure for gauges,progress bars,and CO2 gradient percentage referenced above.This also is the sytling and customisation for the user preferences fo the range of temperature data
        <>
            <div style={{
                display: 'flex', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap'
            }}>
                {/*Temperature Card*/}
                <Card
                    title={<CardTitle title="Temperature" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}
                >
                    <p style={{ fontSize: '12px', color: '#666' }}>
                        Monitors room temperature to optimize heating/cooling systems and reduce energy use and carbon footprint
                    </p>
                    {isInitialLoading ? (
                        <LoadingContent />
                    ) : (
                        <>
                            <GaugeChart
                                id="temperature-gauge"
                                nrOfLevels={20}
                                percent={tempValue}
                                needleBaseColor="red"
                                needleColor='red'
                                colors={['#C8E6C9', '#81C784', '#4CAF50']}
                            />
                            <p>{data.temperature !== null && data.temperature !== undefined ? `${formatNumber(data.temperature)}°C` : 'No Data...'}</p>
                        </>
                    )}
                </Card>
                {/* Humidity Card*/}
                <Card
                    title={<CardTitle title="Humidity" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}
                >
                    {isInitialLoading ? (
                        <LoadingContent />
                    ) : (
                        <>
                            <GaugeChart
                                id="humidity-gauge"
                                nrOfLevels={20}
                                percent={humValue}
                                needleBaseColor="blue"
                                needleColor="blue"
                                colors={['#C8E6C9', '#81C784', '#4CAF50']}
                            />
                            <p>{data.humidity !== null && data.humidity !== undefined ? `${formatNumber(data.humidity)}%` : 'No Data...'}</p>
                        </>
                    )}
                </Card>

                {/*Barometric Pressure Card*/}
                <Card
                    title={<CardTitle title="Barometric Pressure" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}
                >
                    <p style={{ fontSize: '12px', color: 'gray' }}>
                        Provides weather insights and helps scheduling operations efficiently, reducing unnecessary energy usage
                    </p>
                    {isInitialLoading ? (
                        <LoadingContent />
                    ) : (
                        <>
                            <Progress
                                percent={data.pressure !== null && data.pressure !== undefined ? Math.round(Math.min((data.pressure / 1100) * 100, 100)) : 0} // Max 1100 hPa
                                status="active"
                                showInfo={true}
                                strokeColor={{
                                    '0%': '#AED581',
                                    '100%': '#4CAF50',
                                }}
                            />
                            <p>{data.pressure !== null && data.pressure !== undefined ? `${formatNumber(data.pressure)} hPa` : 'No Data...'}</p>
                        </>
                    )}
                </Card>

                {/* Altitude Card */}
                <Card
                    title={<CardTitle title="Altitude" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}

                >
                    <p style={{ fontSize: '12px', color: 'gray' }}>
                        Tracks changes to elevation, which can impact energy consumption for machinery and transport, indirectly influencing emissions
                    </p>
                    {isInitialLoading ? (
                        <LoadingContent />

                    ) : (
                        <>
                            <Progress
                                percent={data.altitude !== null && data.altitude !== undefined ? Math.round(Math.min((data.altitude / 5000) * 100, 100)) : 0} // Max 5000 meters
                                status="active"
                                showInfo={true}
                            />
                            <p>{data.altitude !== null && data.altitude !== undefined ? `${formatNumber(data.altitude)} m` : 'No Data...'}</p>
                        </>
                    )}
                </Card>

                {/* IMU Data Card*/}
                <Card
                    title={<CardTitle title="IMU Data" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}
                >
                    <p style={{ fontSize: '12px', color: 'gray' }}>
                        Measures equipment usage and driving behaviour and asset tracking to improve operation efficiency and reduce carbon footprint
                    </p>
                    {isInitialLoading ? (
                        <LoadingContent />
                    ) : (
                        <>
                            <p>Acceleration (m/s²)</p>
                            <Progress
                                percent={data.imu && data.imu.acceleration && data.imu.acceleration[0] !== undefined ? Math.round(Math.min(Math.abs(data.imu.acceleration[0]), 100)) : 0}
                                status="active"
                                showInfo={true}
                            />
                            <p>Gyroscope (°/s):</p>
                            <Progress
                                percent={data.imu && data.imu.gyroscope && data.imu.gyroscope[0] !== undefined ? Math.round(Math.min(Math.abs(data.imu.gyroscope[0]), 100)) : 0}
                                status="active"
                                showInfo={true}
                            />
                            <p>Magnetometer (μT):</p>
                            <Progress
                                percent={data.imu && data.imu.magnetometer && data.imu.magnetometer[0] !== undefined ? Math.round(Math.min(Math.abs(data.imu.magnetometer[0]), 100)) : 0}
                                status="active"
                                showInfo={true}
                            />

                        </>
                    )}
                </Card>
                <Card
                    title={<CardTitle title="Water Usage" isFirstLoad={isInitialLoading} />}
                    style={cardStyle}
                    headStyle={cardHeadStyle}
                >
                    <p style={{ fontSize: '12px', color: 'gray' }}>
                        Monitors water consumption in real time
                    </p>
                    {isInitialLoading ? (
                        <LoadingContent />
                    ) : (
                        <>
                            <Progress
                                percent={waterFlow !== null ? Math.round(Math.min((waterFlow / 10) * 100, 100)) : 0}
                                status="active"
                                showInfo={true}
                            />


                            <p>{waterFlow !== null ? `${waterFlow.toFixed(2)} ${waterUnit}` : 'No Data...'}</p>
                            {thresholds.flow_rate_threshold && (
                                <p style={{ color: waterFlow > thresholds.flow_rate_threshold ? 'red' : 'green' }}>
                                    Threshold: {thresholds.flow_rate_threshold} {waterUnit}
                                </p>

                            )}
                        </>
                    )}

                </Card>
                <CarbonFootprintCard sensorData={data} waterFlow={waterFlow} />
                <ReportCard style={{ margin: 0 }} />
                <VehicleEmissions />
            </div>

            {/*Last Updated Status*/}
            <div style={{
                textAlign: 'right',
                marginTop: '10px',
                color: '#888',
                fontSize: '12px',
                padding: '0 20px'
            }}>
                Data last updated: {getDataFreshness()} seconds ago
            </div>

            {/*Chatbot opens */}
            <Button
                type="primary"
                shape="circle"
                icon={<RobotOutlined />}
                style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000, backgroundColor: '#1890ff', color: '#fff', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', border: 'none' }}
                onClick={() => setIsChatbotVisible(true)}
            />
            {/*Chatbot Modal*/}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar src={chatbotIcon} alt="Chatbot Icon" />
                        <span style={{ color: '#388E2C', fontweight: 'bold' }}>EcoBot AI Chatbot</span>
                    </div>
                }
                open={isChatbotVisible}
                onCancel={() => setIsChatbotVisible(false)}
                footer={null}
                width={400}
                bodyStyle={{ backgroundColor: '#F1F8E9' }}
                style={{ top: 20 }}
            >
                <div style={{ height: '300px', overflowY: 'auto', marginBottom: '10px', padding: '5px', border: '1px solid #d9d9d9', borderRadius: '10px' }}>
                    {/* implementation still being worked on*/}
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
                        }}
                        >
                            <div>{chat.message}</div>
                            <span style={{ fontSize: '10px', color: 'gray' }}>{new Date().toLocaleTimeString()}</span>
                        </div>
                    ))}
                </div>
                {loadingAI && <Spin style={{ display: 'block', margin: '10px auto' }} />}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    {["How can I reduce my carbon footprint?", "Tips for saving water", "Best eco-friendly materials"].map((suggestion, idx) => (
                        <Button key={idx} size="small" onClick={() => handleSuggestionClick(suggestion)}>
                            {suggestion}
                        </Button>
                    ))}
                </div>
                <Input
                    placeholder='Enter your question...'
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onPressEnter={(e) => {
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
            <Alerts />

            <Card title={<CardTitle title="CO2 Trends" isFirstLoad={isInitialLoading} />}
                style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: '#F1F8E9'
                }}
                headStyle={{
                    backgroundColor: '#388E3C',
                    color: 'white',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                }}
            >
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
                {isInitialLoading ? (
                    <LoadingContent />


                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                        {co2Trends.map((trend, index) => (
                            <Card
                                key={index}
                                style={{
                                    background: co2Gradient(trend.co2),
                                    color: '#fff',
                                    width: '150px',
                                    textAlign: 'center',
                                    borderRadius: '8px',
                                    boxShadow: '0, 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                <p>{selectedRange === 'days' ? trend.day : trend.month}</p>
                                <h3>{formatNumber(trend.co2)} ppm</h3>
                            </Card>
                        ))}
                    </div>
                )}
            </Card>
            <Card
                title="Preferred Ranges"
                style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: '#F1F8E9'

                }}
                headStyle={cardHeadStyle}
            >
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <div>
                        <p>Temperature Range (°C):</p>
                        <Slider
                            range
                            min={0}
                            max={40}
                            value={thresholds.temperature_range}
                            onChange={(value) => setThresholds({ ...thresholds, temperature_range: value })}
                            railStyle={{ backgroundColor: '#C8E6C9' }}
                            trackStyle={[{ backgroundColor: '#4CAF50' }]}
                            handleStyle={[
                                { borderColor: '#388E3C', backgroundColor: '#4CAF50' },
                                { borderColor: '#388E3C', backgroundColor: '#4CAF50' }
                            ]}
                            tipFormatter={value => `${formatNumber(value)}°C`}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                            <span>{formatNumber(thresholds.temperature_range[0])}°C</span>
                            <span>{formatNumber(thresholds.temperature_range[1])}°C</span>
                        </div>
                    </div>
                    <div>
                        <p>Humidity Range (%):</p>
                        <Slider
                            range
                            min={0}
                            max={100}
                            value={thresholds.humidity_range}
                            onChange={(value) => setThresholds({ ...thresholds, humidity_range: value })}
                            railStyle={{ backgroundColor: '#C8E6C9' }}
                            trackStyle={[{ backgroundColor: '#4CAF50' }]}
                            handleStyle={[
                                { borderColor: '#388E3C', backgroundColor: '#4CAF50' },
                                { borderColor: '#388E3C', backgroundColor: '#4CAF50' }
                            ]}
                            tipFormatter={value => `${formatNumber(value)}%`}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                            <span>{formatNumber(thresholds.humidity_range[0])}%</span>
                            <span>{formatNumber(thresholds.humidity_range[1])}%</span>
                        </div>
                    </div>
                    <div>
                        <p>Water Flow Threshold ({waterUnit}):</p>
                        <Slider
                            min={0}
                            max={20}
                            value={thresholds.flow_rate_threshold}
                            onChange={(value) => setThresholds({ ...thresholds, flow_rate_threshold: value })}
                            railStyle={{ backgroundColor: '#C8E6C9' }}
                            trackStyle={{ backgroundColor: '#4CAF50' }}
                            handleStyle={{ borderColor: '#388E3C', backgroundColor: '#4CAF50' }}
                            tipFormatter={value => `${formatNumber(value)} ${waterUnit}`}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                            <span>0 {waterUnit}</span>
                            <span>{formatNumber(thresholds.flow_rate_threshold)} {waterUnit}</span>
                        </div>
                    </div>
                </div>
                <Button
                    type="primary"
                    onClick={updateThresholds}
                    loading={isUpdatingThresholds}
                    style={{
                        marginTop: '16px',
                        backgroundColor: '#4CAF50',
                        borderColor: '#388E3C',
                        borderRadius: '4px'
                    }}
                >
                    Update Thresholds
                </Button>
            </Card>
            <Card
                title="Notification Preferences"
                style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: '#F1F8E9'
                }}
                headStyle={cardHeadStyle}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <Checkbox
                            checked={notificationPrefs.sms_enabled}
                            onChange={(e) => setNotificationPrefs({ ...notificationPrefs, sms_enabled: e.target.checked })}
                        >
                            Receive SMS Alerts
                        </Checkbox>
                    </div>
                    <div>
                        <Checkbox
                            checked={notificationPrefs.email_enabled}
                            onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_enabled: e.target.checked })}
                        >
                            Receive Email Alerts

                        </Checkbox>
                    </div>
                    <div>
                        <Checkbox
                            checked={notificationPrefs.critical_only}
                            onChange={(e) => setNotificationPrefs({ ...notificationPrefs, critical_only: e.target.checked })}
                        >
                            Critical Alerts Only
                        </Checkbox>
                    </div>
                </div>
                <Button
                    type="primary"
                    onClick={updateNotificationPrefs}
                    style={{
                        marginTop: '16px',
                        backgroundColor: '#4CAF50',
                        borderColor: '#388E3C',
                        borderRadius: '4px'
                    }}
                >
                    Update Notification Preferences
                </Button>
            </Card>
            <Card
                title={<CardTitle title="Temperature Trends" isFirstLoad={isInitialLoading} />}
                style={{
                    marginTop: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: '#F1F8E9'
                }}
                headStyle={cardHeadStyle}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p>Select Range:</p>
                    <Select defaultValue="24h" onChange={(value) => setSelectedRange(value)} style={{ width: '150px' }}>
                        <Option value="24h">Last 24 Hours</Option>
                        <Option value="7d">Last 7 Days</Option>
                        <Option value="30d">Last 30 Days</Option>
                    </Select>
                </div>
                {isInitialLoading ? (
                    <LoadingContent />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {temperatureTrends.map((trend, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    background: index % 2 === 0 ? '#E8F5E9' : 'transparent'
                                }}
                            >
                                <span>{trend.time}</span>
                                <span>{formatNumber(trend.temperature)} °C</span>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </>
    );
}
export default Dashboard;