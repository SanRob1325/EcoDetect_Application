import React, { useCallback, useEffect, useState } from 'react';
import apiService from './apiService';
import { Input, Button, Card, Typography, Spin, Select, Alert, DatePicker, Switch, Tooltip } from 'antd'
import { Line } from 'react-chartjs-2';
import moment from 'moment';
import { HistoryOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons'; //And Design loading icon
import './AIAssistant.css'; //CSS sytling

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
const { Title, Paragraph } = Typography;
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
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [dateRange, setDateRange] = useState([moment().subtract(7, 'days')])

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
        try{
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

    //Function to handle form sumission (sending the user query to the backend)
    const handleQuerySubmit = async () => {
        if (!userQuery.trim()) return; //no action taken if the query is empty

        setLoading(true); //starts loading 
        setAiResponse(''); // Clear previous response
        try {
            await fetchPredictiveData();
            const response = await apiService.queryAIAssistant({
                query: userQuery,
                user_id: "frontend-user",
                location: "Web Dashboard"
            })
            setAiResponse(response.data.answer); //Sets AI response
        } catch (error) {
            console.error("Error fetching AI response", error);
            setAiResponse("Sorry, errors producing the current request")
        } finally {
            setLoading(false); //ends loading
        }
    };

    // Handle refresh button click
    const handleRefresh = () => {
        fetchPredictiveData();
        fetchHistoricalData();
    };

    const chartData = {
        labels:[ 
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
                font: { size: 16}
            }
        },
        scales: {
            x: {
                ticks: { autoSkip: true, maxRotation: 45, minRotation: 45 },
                title: { display: true, text: 'Date'}
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

    // Helper function to get Y-axis lable based on data type
    function getYAxisLabel(dataType) {
        switch(dataType) {
            case 'temperature': return 'Temperature (°C)';
            case 'humidity' : return 'Humidity (%)';
            case 'pressure' : return 'Pressure (hPa)';
            case 'flow_rate' : return 'Flow Rate (L/min)';
            default: return dataType;
        }
    }
        

    //Styling for AI processing the user query
    return (
        <div className="predictive-analysis-page">
            <Card title={
                <div style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '10px' }}> Predictive Analysis & Historical Anomaly Detection</span>
                    {(loading || historicalLoading ) && <Spin size="small" style={{ marginLeft: 8 }} />}
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
                        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 10}}>
                            <HistoryOutlined style={{ marginRight: 5}}/>
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
                ) : (predictions.length > 0 || historicalData.length > 0)? (
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
                    <div style={{ marginTop: '10px', fontSize: '14px', color: '#555'}}>
                        <span style={{ fontWeight: 'bold'}}>Data Summary:</span> Showing
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
                <Input.TextArea
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder='Ask the AI about your environmental trends...'
                    rows={3}
                    style={{
                        borderColor: '#AED581',
                        borderRadius: '4px',
                        marginBottom: '10px'
                    }}
                />
                <Button type="primary" onClick={handleQuerySubmit} style={{ marginTop: 10, backgroundColor: '#4CAF50', borderColor: '#388E3C', borderRadius: '4px' }} disabled={loading}>Submit</Button>
                {aiResponse && (
                    <div style={{ marginTop: 20, backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
                        <Title level={4} style={{ color: '#388E3C'}}>AI Response:</Title>
                        <Paragraph style={{ color: '#333'}}>{aiResponse}</Paragraph>
                    </div>
                )}
            </Card>
        </div>
    );
};
export default AIAssistant;