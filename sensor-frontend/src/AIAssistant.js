import React, { useCallback, useEffect, useState, useRef } from 'react';
import apiService from './apiService';
import { Input, Button, Card, Typography, Spin, Select, Alert, DatePicker, Switch, Tooltip, Avatar, Empty } from 'antd'
import { Line } from 'react-chartjs-2';
import moment from 'moment';
import { HistoryOutlined, LoadingOutlined, RobotOutlined, SendOutlined, BulbOutlined, UserOutlined, SyncOutlined, QuestionCircleOutlined } from '@ant-design/icons'; //And Design loading icon
import './AIAssistant.css'; //CSS styling

import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Title as ChartTitle,
    Tooltip as ChartTooltip,
    Legend
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, ChartTitle, ChartTooltip, Legend)
const { Title, Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

const AIAssistant = () => {
    // State to hold users query,AI response and loading state
    const [dataType, setDataType] = useState('temperature');
    const [days, setDays] = useState(7);
    const [predictions, setPredictions] = useState([]);
    const [anomalies, setAnomalies] = useState([])
    const [historicalLoading, setHistoricalLoading] = useState(false);
    // State for historical data
    const [historicalData, setHistoricalData] = useState([]);
    const [showHistorical, setShowHistorical] = useState(true);
    const [userQuery, setUserQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [dateRange, setDateRange] = useState([moment().subtract(7, 'days')])

    // Chat staate
    const conversationEndRef = useRef(null);
    const [conversationHistory, setConversationHistory] = useState([]);
    const [quickSuggestions, setQuickSuggestions] = useState([
        'What does this data mean?',
        'Why are ther anomalies in the data?',
        'How can I optimise my environment?',
        'Explain temperature trends'
    ])

    const fetchPredictiveData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiService.getPredictiveAnalysis(dataType, days)
            console.log("Predictive data:", response.data);
            if (response.data && response.data.error) {
                setAlertMessage(`Error: ${response.data.error}`)
                setPredictions([])
                setAnomalies([])
            } else {
                setPredictions(response.data.predictions || []);
                setAnomalies(response.data.anomalies || []);
                setAlertMessage(response.data.anomalies && response.data.anomalies.length ?
                    `${response.data.anomalies.length} anomalies detected!` :
                    "No significant anomalies detected."
                );
            }

        } catch (error) {
            console.error("Error fetching predictive data", error)
            setAlertMessage(error.response?.data?.error || "Failed to fetch predictive data");
            setPredictions([])
            setAnomalies([])
        } finally {
            setLoading(false);
        }
    }, [dataType, days])

    // Fetch historical data
    const fetchHistoricalData = useCallback(async () => {
        setHistoricalLoading(true);
        try {
            const response = await apiService.getHistoricalData(dataType, days);
            console.log("Historical data:", response.data);
            if (response.data && response.data.historical_data) {
                setHistoricalData(response.data.historical_data);
            } else {
                setHistoricalData([]);
            }
        } catch (error) {
            console.error("Error fetching historical data", error);
            setHistoricalData([]);
        } finally {
            setHistoricalLoading(false);
        }
    }, [dataType, days]);

    // Fetch bot data sets wheneve the component mounts
    useEffect(() => {
        fetchPredictiveData();
        fetchHistoricalData();

    }, [fetchPredictiveData, fetchHistoricalData]);

    // Auto scroll to  bottom of conversation when new messages are added
    useEffect(() => {
        if (conversationEndRef.current) {
            conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [conversationHistory]);
    
    useEffect(() => {
        let newSuggestions = ['What does this data mean?'];

        if (anomalies.length > 0) {
            newSuggestions.push('Why are there anomalies in the data?');
        }

        switch (dataType) {
            case 'temperature':
                newSuggestions.push('How can I optimise temperature settings?');
                newSuggestions.push('What is a normal temperature range?');
                break;
            case 'humidity':
                newSuggestions.push('What is the ideal humidity level?');
                newSuggestions.push('How does humidity affect energy usage?')
                break;
            case 'pressure':
                newSuggestions.push('What do these pressure readings indicate?');
                newSuggestions.push('Is this pressure level normal?');
                break;
            case 'flow_rate':
                newSuggestions.push('How can I reduce water usage?');
                newSuggestions.push('Is my water consumption efficient?');
                break;
            default:
                break;
        }
        setQuickSuggestions(newSuggestions);
    }, [dataType, anomalies.length])

    //Function to handle form sumission (sending the user query to the backend)
    const handleQuerySubmit = async () => {
        if (!userQuery.trim()) return; //no action taken if the query is empty

        // user message in the conversation
        const userMessage = {
            type: 'user',
            content: userQuery,
            timestamp: new Date()
        };
        setConversationHistory(prev => [...prev, userMessage]);

        // Clears user input field
        setUserQuery('');

        // Loading message
        const loadingMessage = {
            type: 'assistant',
            content: 'Thinking...',
            isLoading: true,
            timestamp: new Date()
        };
        setConversationHistory(prev => [...prev, loadingMessage]);

        try {
            // Get latest data before querying AI
            await fetchPredictiveData();

            // Include context about current data
            const contextData = {
                query: userMessage.content,
                user_id: "frontend-user",
                location: "Web Dashboard",
                context: {
                    data_type: dataType,
                    time_range: days,
                    has_anomalies: anomalies.length > 0,
                    anomalies: anomalies.slice(0, 3),
                    recent_data_points: historicalData.slice(-5),
                    predictions: predictions.slice(0, 5)
                }
            };

            const response = await apiService.queryAIAssistant(contextData);

            // Adds AI response by removing loading message
            const aiMessage = {
                type: 'assistant',
                content: response.data.answer || "Sorry, I couldn't process you request.Please try again",
                timestamp: new Date()
            };

            setConversationHistory(prev =>
                prev.map((msg, i) =>
                    i === prev.length - 1 && msg.isLoading ? aiMessage : msg
                )
            );
        } catch (error) {
            console.error("Error fetching AI response", error);

            // loads error message
            const errorMessage = {
                type: 'assistant',
                content: "Sorry, I encountered an error processing your request. Please try again.",
                isError: true,
                timestamp: new Date()
            };

            setConversationHistory(prev =>
                prev.map((msg, i) =>
                    i === prev.length - 1 && msg.isLoading ? errorMessage : msg

                )
            )
        }
    }

    // Handle suggestion click
    const handleSuggestionClick = (suggestion) => {
        setUserQuery(suggestion);
        // Auto submit suggestion
        setTimeout(() => {
            handleQuerySubmit();
        }, 100);
    }

    // Handle refresh button click
    const handleRefresh = () => {
        fetchPredictiveData();
        fetchHistoricalData();
    };

    // Handle Enter key submission
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleQuerySubmit();
        }
    };

    // Formats message timestamp
    const formatMessageTime = (timestamp) => {
        return moment(timestamp).format('h:mm A')
    };

    // A helper function to get Y-acis lable based in data type
    function getYAxisLabel(dataType) {
        switch (dataType) {
            case 'temperature': return 'Temperature (°C)';
            case 'humidity': return 'Humidity (%)';
            case 'pressure': return 'Pressure (hPa)';
            case 'flow_rate': return 'Flow Rate (L/min)';
            default: return dataType;
        }
    }

    const chartData = {
        labels: [
            // Historical dates
            ...(showHistorical ? historicalData.map(h => moment(h.timestamp).format('MMM D')) : []),

            // Prediction dates
            ...predictions.map(p => moment(p.date).format('MMM D')),
        ],
        datasets: [
            //Historical dataset 
            ...(showHistorical ? [{
                label: `Historical ${dataType}`,
                data: [
                    ...historicalData.map(h => h.value),
                    ...Array(predictions.length).fill(null) // fill null with prediction dates
                ],
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            }] : []),
            // Prediction datasets
            {
                label: `Predicted ${dataType}`,
                data: [
                    ...Array(showHistorical ? historicalData.length : 0).fill(null),
                    ...predictions.map(p => p.predicted_value),
                ],
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.3,
                pointRadius: 3,
                pointStyle: 'triangle'
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            tooltip: { enabled: true },
            title: {
                display: true,
                text: `${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Trends and Predictions`,
                font: { size: 16 }
            }
        },
        scales: {
            x: {
                ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 },
                title: { display: true, text: 'Date' }
            },
            y: {
                beginAtZero: false,
                title: {
                    display: true,
                    text: getYAxisLabel(dataType)
                }
            },
        },
        interaction: {
            mode: 'index',
            intersect: false
        }
    };

    //Styling for AI processing the user query
    return (
        <div className="predictive-analysis-page">
            <Card title={
                <div style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '10px' }}> Predictive Analysis & Historical Anomaly Detection</span>
                    {(loading || historicalLoading) && <Spin size="small" style={{ marginLeft: 8 }} />}
                </div>
            }
                className='analysis-card'
                style={{
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: '#F1F8E9',
                    marginBottom: '20px'
                }}
                headStyle={{
                    backgroundColor: '#388E3C',
                    color: 'white',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                }}
            >
                <div className="controls" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    <Select value={dataType} onChange={setDataType} style={{ width: 200, marginRight: 10 }} dropdownStyle={{ backgroundColor: '#F1F8E9' }}>
                        <Select.Option value="temperature">Temperature</Select.Option>
                        <Select.Option value="humidity">Humidity</Select.Option>
                        <Select.Option value="pressure">Pressure</Select.Option>
                        <Select.Option value="flow_rate">Water Usage</Select.Option>
                    </Select>
                    <Select value={days} onChange={setDays} style={{ width: 120 }} dropdownStyle={{ backgroundColor: '#F1F8E9' }}>
                        <Select.Option value={1}>1 day</Select.Option>
                        <Select.Option value={7}>7 days</Select.Option>
                        <Select.Option value={14}>14 days</Select.Option>
                        <Select.Option value={30}>30 days</Select.Option>
                    </Select>
                    <RangePicker value={dateRange} onChange={setDateRange} style={{ marginLeft: 10 }} />
                    <Tooltip title="Show/Hide Historical Data">
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 10 }}>
                            <HistoryOutlined style={{ marginRight: 5 }} />
                            <Switch
                                checked={showHistorical}
                                onChange={setShowHistorical}
                                size="small"
                            />
                        </div>
                    </Tooltip>
                    <Button type="primary" onClick={handleRefresh} style={{ backgroundColor: '#4CAF50', borderColor: '#388E3C', borderRadius: '4px' }}>
                        Refresh Data
                    </Button>
                </div>
                {alertMessage && (
                    <Alert message={alertMessage}
                        type={alertMessage.includes("anomalies detected!") ? "warning" :
                            alertMessage.includes("Error:") ? "error" : "success"}
                        showIcon
                        style={{ marginTop: 20 }}
                    />
                )}

                {(loading || historicalLoading) && predictions.length === 0 && historicalData.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20, minHeight: '300px', alignItems: 'center' }}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    </div>
                ) : (predictions.length > 0 || historicalData.length > 0) ? (
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '15px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        height: '400px'
                    }}>
                        <Line data={chartData} options={chartOptions} />
                    </div>
                ) : (
                    <Alert message="No data available" type="warning" showIcon style={{ marginTop: 20 }} />
                )}

                {anomalies.length > 0 && (
                    <Card title="Anomalies Detected" style={{ marginTop: 20, borderRadius: '8px', borderColor: '#AED581' }}
                        headStyle={{ backgroundColor: '#8BC34A', color: 'white', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}
                    >
                        <ul style={{ paddingLeft: '20px' }}>
                            {anomalies.map((anomaly, i) => (
                                <li key={i} style={{ margin: '8px 0', color: '#333' }}>
                                    {moment(anomaly.date).format('MMMM Do YYYY, h:mm a')} - Value: {anomaly.value}
                                </li>))}
                        </ul>
                    </Card>
                )}

                {historicalData.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '14px', color: '#555' }}>
                        <span style={{ fontWeight: 'bold' }}>Data Summary:</span> Showing
                        {showHistorical ? ` ${historicalData.length} historical data points and` : ' '}
                        {predictions.length} predicted values for {dataType}.
                    </div>
                )}
            </Card>

            <Card title={
                <div style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
                    <RobotOutlined style={{ marginRight: '8px' }} />
                    <span>AI Assistant</span>
                </div>

            }
                className="ai-card"
                style={{
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
                {/*Conversation History*/}
                <div
                    className="conversation-container"
                    style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        marginBottom: '16px',
                        padding: '10px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        border: '1px solid #e8e8e8'
                    }}
                >
                    {conversationHistory.length > 0 ? (
                        conversationHistory.map((message, index) => (
                            <div
                                key={index}
                                className={`message ${message.type}`}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: message.type === 'user' ? 'flex-end' : 'flex-start',
                                    marginBottom: '12px',
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        marginBottom: '4px'
                                    }}
                                >
                                    {message.type === 'assistant' && (
                                        <Avatar
                                            icon={<RobotOutlined />}
                                            style={{
                                                backgroundColor: '#388E3C',
                                                marginRight: '8px'
                                            }}
                                            size="small"
                                        />
                                    )}
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {message.type === 'user' ? 'You' : 'AI Assistant'} • {formatMessageTime(message.timestamp)}
                                    </Text>
                                    {message.type === 'user' && (
                                        <Avatar
                                            icon={<UserOutlined />}
                                            style={{
                                                backgroundColor: '#1890ff',
                                                marginLeft: '8px'
                                            }}
                                            size="small"
                                        />
                                    )}
                                </div>

                                <div
                                    style={{
                                        backgroundColor: message.type === 'user' ? '#1890ff15' : '#f5f5f5',
                                        padding: '10px 14px',
                                        borderRadius: '12px',
                                        maxWidth: '85%',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    {message.isLoading ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <SyncOutlined spin />
                                            <span>Thinking...</span>
                                        </div>
                                    ) : message.isError ? (
                                        <div>
                                            <div style={{ color: '#ff4d4f', marginBottom: '8px' }}>
                                                {message.content}
                                            </div>
                                            <Button
                                                size="small"
                                                danger
                                                onClick={() => {
                                                    // Finds the last user message and retries it
                                                    const lastUserMsg = [...conversationHistory]
                                                        .reverse()
                                                        .find(msg => msg.type === 'user')

                                                    if (lastUserMsg) {
                                                        setUserQuery(lastUserMsg.content);
                                                        // Removes the error message
                                                        setConversationHistory(prev =>
                                                            prev.filter((_, i) => i !== index)
                                                        );
                                                    }

                                                }}
                                            >
                                                Retry
                                            </Button>
                                        </div>
                                    ) : (
                                        <div>{message.content}</div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <div>
                                    <p>No conversation yet. Ask a question to get started</p>
                                    <p style={{ fontSize: '12px', color: '#888' }}>
                                        Try asking about your environmental data, trends, recommendations
                                    </p>
                                </div>
                            }
                        />
                    )}
                    <div ref={conversationEndRef} />
                </div>

                {/* Quick Suggestions */}
                {quickSuggestions.length > 0 && (
                    <div style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {quickSuggestions.map((suggestion, index) => (
                            <Button
                                key={index}
                                size="small"
                                icon={<BulbOutlined />}
                                onClick={() => handleSuggestionClick(suggestion)}
                                style={{
                                    backgroundColor: '#f0f8ff',
                                    borderColor: '#d9d9d9',
                                    borderRadius: '16px'
                                }}
                            >
                                {suggestion}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Input Area*/}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Input.TextArea
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Ask about you environmental data..."
                        onKeyPress={handleKeyPress}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        style={{
                            borderColor: '#AED581',
                            borderRadius: '8px',
                            flexGrow: 1,
                            resize: 'none'
                        }}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleQuerySubmit}
                        disabled={!userQuery.trim() || loading}
                        style={{
                            height: 'auto',
                            backgroundColor: '#4CAF50',
                            borderColor: '#388E3C',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px 16px'
                        }}
                    />
                </div>

                {/* Help Text */}
                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                        <QuestionCircleOutlined style={{ marginRight: '4px' }} />
                        Ask questions about your data, anomalies, or for optimisation recommendations
                    </Text>
                </div>
            </Card>
        </div>

    );
}
export default AIAssistant;

