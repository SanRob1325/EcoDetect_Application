import React,{useCallback, useEffect, useState} from 'react';
import axios from 'axios';
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
            const response = await axios.get(`http://localhost:5000/api/predictive-analysis`, {
                params: { data_type: dataType, days},
                headers: { 'Content-Type': 'application/json'} 
            });
            setPredictions(response.data.predictions || []);
            setAnomalies(response.data.anomalies || []);
            setAlertMessage(response.data.anomalies.length ? "Anomalies detected!" : "Nosignificant anomalies detected.")
        }catch (error) {
            console.error("Error fetching predictive data", error)
            setAlertMessage("Failed to fetch predictive data");
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
            const response = await axios.post('http://localhost:5000/api/ai-assistant',{
                query: `Provide redictive analysis: ${userQuery}`,
            })
            setAiResponse(response.data.answer); //Sets AI response
        }catch (error){
            console.error("Error fetching AI response",error);
            setAiResponse("Sorry errors producing the current request")
        }finally{
            setLoading(false); //ends loading
        }
    }

    useEffect(() => {
        fetchPredictiveData();
    }, [dataType, days]);

    const chartData = {
        label: predictions.map(item => item.date),
        datasets: [
            {
                label: `Predicted ${dataType}`,
                data: predictions.map(item => item.prediction),
                borderColor: 'blue',
                borderWidth: 2,
                fill: false,
                tension: 0.3
            },
            {
                label: 'Anomalies',
                data: anomalies.map(item => item[dataType] ?? null),
                borderColor: 'red',
                backgroundColor: 'red',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false,
            },
        ],
    };
        //Styling for AI processing the user query
        return (
            <div className="predictive-analysis-page">
                <Card title="Predictive Analysis & Anomaly Detection" className='analysis-card'>
                    <div className="controls">
                        <Select value={dataType} onChange={setDataType} style={{ width: 200, marginRight: 1}}>
                            <Select.Option value="temperature">Temperature</Select.Option>
                            <Select.Option value="humidity">Humidity</Select.Option>
                            <Select.Option value="flow_rate">Water Usage</Select.Option>
                        </Select>
                        <Select value={days} onChange={setDays} style={{ width: 120}}>
                            <Select.Option value={1}>1 day</Select.Option>
                            <Select.Option value={7}>7 days</Select.Option>
                            <Select.Option value={14}>14 days</Select.Option>
                            <Select.Option value={30}>30 days</Select.Option>
                        </Select>
                        <RangePicker value={dateRange} onChange={(dates) => setDateRange(dates)} style={{ marginLeft: 10}}/>
                        <Button type="primary" onClick={fetchPredictiveData} style={{ marginLefy: 10}}>
                            Refresh Data
                        </Button>
                    </div>
                    {alertMessage && (
                        <Alert message={alertMessage} type={alertMessage.includes("X") ? "error": "info"} showIcon style={{ marginTop: 20}} />
                    )}

                    {loading ? (
                        <Spin indicator={<LoadingOutlined style={{ fontSize: 24}} spin />} style={{ marginTop: 20}} />
                    ) : predictions.length >0 ? (
                        <Line data={chartData} options={{responsive: true, plugins: { legend: { position: 'top'}}}} />
                    ) : (
                        <Alert message="No prediction data available" type="warning" showIcon style={{marginTop: 20}} />

                    )}

                </Card>

                <Card title="AI Assistant" className="ai-card">
                    <Input.TextArea
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        placeholder="Ask the AI about your environmental trends..."
                        rows={3}
                    />
                    <Button type="primary" onClick={handleQuerySubmit} style={{ marginTop: 10}} disabled={loading}>
                        Submit
                    </Button>

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