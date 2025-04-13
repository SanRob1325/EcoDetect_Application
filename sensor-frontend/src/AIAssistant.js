import React,{useCallback, useEffect, useState} from 'react';
import apiService from './apiService';
import {Input,Button,Card,Typography,Spin,Select,Alert, DatePicker} from 'antd'
import {Line} from 'react-chartjs-2';
import moment from 'moment';
import {LoadingOutlined} from '@ant-design/icons'; //And Design loading icon
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

ChartJS.register(LineElement,PointElement,CategoryScale,LinearScale,ChartTitle,Tooltip,Legend)
const {Title, Paragraph} = Typography;
const { RangePicker } = DatePicker;

const AIAssistant = () => {
    // State to hold users query,AI response and loading state
    const [dataType,  setDataType] = useState('temperature');
    const [days, setDays] = useState(7);
    const [predictions, setPredictions] = useState([]);
    const [anomalies, setAnomalies] = useState([])
    const [userQuery,setUserQuery] = useState('');
    const [aiResponse, setAiResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [alertMessage, setAlertMessage] = useState('');
    const [dateRange, setDateRange] = useState([moment().subtract(7, 'days')])

    const fetchPredictiveData = useCallback (async () => {
        setLoading(true);
        try{
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

        }catch (error) {
            console.error("Error fetching predictive data", error)
            setAlertMessage( error.response?.data?.error ||"Failed to fetch predictive data");
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
        try{
            await fetchPredictiveData();
            const response = await apiService.queryAIAssistant({
                query: `Provide redictive analysis: ${userQuery}`,
            })
            setAiResponse(response.data.answer); //Sets AI response
        }catch (error){
            console.error("Error fetching AI response",error);
            setAiResponse("Sorry errors producing the current request")
        }finally{
            setLoading(false); //ends loading
        }
    };

    useEffect(() => {
        fetchPredictiveData();
    }, [dataType, days]);

    const chartData = {
        labels: predictions.map(p => moment(p.date).format( 'MMM D')),
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
            legend: { position: 'top'},
            tooltip: { enabled: true},
        },
        scales: {
            x: {
                ticks: { autoSkip: false},
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
                <Card title="Predictive Analysis & Anomaly Detection" className='analysis-card'>
                    <div className="controls">
                        <Select value={dataType} onChange={setDataType} style={{ width: 200, marginRight: 10}}>
                            <Select.Option value="temperature">Temperature</Select.Option>
                            <Select.Option value="humidity">Humidity</Select.Option>
                            <Select.Option value="pressure">Pressure</Select.Option>
                            <Select.Option value="flow_rate">Water Usage</Select.Option>
                        </Select>
                        <Select value={days} onChange={setDays} style={{ width: 120}}>
                            <Select.Option value={1}>1 day</Select.Option>
                            <Select.Option value={7}>7 days</Select.Option>
                            <Select.Option value={14}>14 days</Select.Option>
                            <Select.Option value={30}>30 days</Select.Option>
                        </Select>
                        <RangePicker value={dateRange} onChange={setDateRange} style={{ marginLeft: 10}}/>
                        <Button type="primary" onClick={fetchPredictiveData}>
                            Refresh Data
                        </Button>
                    </div>
                    {alertMessage && (
                        <Alert message={alertMessage} 
                        type={alertMessage.includes("anomalies detected!") ? "warning":
                              alertMessage.includes("Error:") ? "error" : "success"} 
                        showIcon 
                        style={{ marginTop: 20}} 
                        />
                    )}

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20}}>
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24}} spin />} />
                        </div>
                    ) : predictions.length >0 ? (
                        <Line data={chartData} options={charOptions} />
                    ) : (
                        <Alert message="No prediction data available" type="warning" showIcon style={{marginTop: 20}} />
                    )}

                    {anomalies.length > 0 && (
                        <Card title="Anomalies Detected" style={{ marginTop: 20}}>
                            <ul>
                                {anomalies.map((anomaly, i) => (
                                    <li key={i}>
                                        {moment(anomaly.date).format('MMMM Do YYYY, h:mm a')} - Value: {anomaly.value}
                                    </li>))}
                            </ul>
                        </Card>
                    )}
                </Card>

                <Card title="AI Assistant" className="ai-card">
                    <Input.TextArea
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder='Ask the AI about your environmental trends...'
                        rows={3}
                    />
                    <Button type="primary" onClick={handleQuerySubmit} style={{ marginTop: 10}} disabled={loading}>Submit</Button>
                    {aiResponse && (
                        <div style={{ marginTop: 20}}>
                            <Title level={4}>AI Response:</Title>
                            <Paragraph>{aiResponse}</Paragraph>
                        </div>
                    )}                   
                </Card>
            </div>
        );
    };
export default AIAssistant;