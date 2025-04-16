import React, { useCallback, useEffect, useState } from 'react';
import apiService from './apiService';
import { Input, Button, Card, Typography, Spin, Select, Alert, DatePicker } from 'antd'
import { Line } from 'react-chartjs-2';
import moment from 'moment';
import { LoadingOutlined, RobotOutlined } from '@ant-design/icons'; //And Design loading icon
import './AIAssistant.css'; //CSS sytling

import {
    Chart as ChartJS,
    LineElement,
    PointElement,
    CategoryScale,
    LinearScale,
    Title as ChartTitle,
    Tooltip,
    Legend
} from 'chart.js'

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, ChartTitle, Tooltip, Legend)
const { Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

const AIAssistant = () => {
    // State to hold users query,AI response and loading state
    const [dataType, setDataType] = useState('temperature');
    const [days, setDays] = useState(7);
    const [predictions, setPredictions] = useState([]);
    const [anomalies, setAnomalies] = useState([])
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

    useEffect(() => {
        fetchPredictiveData()
    }, [fetchPredictiveData]);

    //Function to handle form sumission (sending the user query to the backend)
    const handleQuerySubmit = async () => {
        if (!userQuery.trim()) return; //no action taken if the query is empty

        setLoading(true); //starts loading 
        setAiResponse(''); // Clear previous response
        try {
            await fetchPredictiveData();
            const response = await apiService.queryAIAssistant({
                query: `Provide redictive analysis: ${userQuery}`,
            })
            setAiResponse(response.data.answer); //Sets AI response
        } catch (error) {
            console.error("Error fetching AI response", error);
            setAiResponse("Sorry errors producing the current request")
        } finally {
            setLoading(false); //ends loading
        }
    };

    useEffect(() => {
        fetchPredictiveData();
    }, [dataType, days]);

    const chartData = {
        labels: predictions.map(p => moment(p.date).format('MMM D')),
        datasets: [
            {
                label: `Predicted ${dataType}`,
                data: predictions.map(p => p.predicted_value),
                borderColor: 'blue',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
            }
        ]
    };

    const charOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: { enabled: true },
        },
        scales: {
            x: {
                ticks: { autoSkip: false },
            },
            y: {
                beginAtZero: true,
            },
        },
        annotation: {
            annotations: anomalies.map((anomaly) => ({
                type: 'line',
                mode: 'vertical',
                scaleID: 'x',
                value: moment(anomaly.date).format('MMM D'),
                borderColor: 'red',
                borderWidth: 2,
                label: {
                    content: `Anomaly: ${anomaly.value}`,
                    enabled: true,
                    position: 'top',
                },
            })),

        },
    };

    //Styling for AI processing the user query
    return (
        <div className="predictive-analysis-page">
            <Card title={
                <div style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '10px' }}> Predictive Analysis & Anomaly Detection</span>
                    {loading && <Spin size="small" style={{ marginLeft: 8 }} />}

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
                    <Button type="primary" onClick={fetchPredictiveData} style={{ backgroundColor: '#4CAF50', borderColor: '#388E3C', borderRadius: '4px' }}>
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

                {loading && predictions.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    </div>
                ) : predictions.length > 0 ? (
                    <div style={{
                        backgroundColor: '#fff',
                        padding: '15px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                        <Line data={chartData} options={charOptions} />
                    </div>
                ) : (
                    <Alert message="No prediction data available" type="warning" showIcon style={{ marginTop: 20 }} />
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