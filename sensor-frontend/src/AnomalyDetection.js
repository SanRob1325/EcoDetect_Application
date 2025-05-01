import React, {useState, useEffect } from 'react';
import { Card, Alert, List, Tag, Button, Spin, Empty, Typography, Statistic, Timeline} from 'antd';
import { WarningOutlined, CheckCircleOutlined, ExperimentOutlined, SyncOutlined, AreaChartOutlined} from '@ant-design/icons';
import apiService from './apiService';

const { Title, Text } = Typography;

const AnomalyDetection = ({ sensorData, roomId }) => {
    const [loading, setLoading] = useState(false);
    const [anomalyResult, setAnomalyResult] = useState(null);
    const [recentAnomalies, setRecentAnomalies] = useState([]);
    const [loadingAnomalies, setLoadingAnomalies] = useState(false);

    // Function to run anomaly detection
    const runAnomalyDetection = async () => {
        if (!sensorData) {
            return;
        }

        setLoading(true);
        try{
            const response = await apiService.detectAnomalies({
                ...sensorData,
                room_id: roomId
            });
            setAnomalyResult(response.data);

        } catch (error) {
            console.error('Error running anomaly detection:', error);
        } finally {
            setLoading(false);
        }

    };

    // Load recent anomalies
    const loadRecentAnomalies = async () => {
        setLoadingAnomalies(true);
        try {
            const response = await apiService.getRecentAnomalies(roomId);
            setRecentAnomalies(response.data.anomalies)
        } catch (error) {
            console.error('Error loading recent anomalies:', error)
        } finally {
            setLoadingAnomalies(false);
        }
    };

    // Load anomalies on the component
    useEffect(() => {
        loadRecentAnomalies();
    }, [roomId]);

    // Format date for display
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    // Formats the number toFixed
    const safeToFixed = (value, digits = 2) => {
        if (value !== undefined && value !== null){
            return Number(value).toFixed(digits);
        }
        return 'N/A';
    };

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center'}}>
                    <ExperimentOutlined style={{ marginRight: 8, color: '#722ED1'}} />
                    <span>On Device Machine Learning</span>
                </div>
            }
            extra={
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={runAnomalyDetection}
                    loading={loading}
                    style={{ backgroundColor: '#722ED1', borderColor: '#722ED1' }}
                >
                    Run Anomaly Detection
                </Button>
            }
            style={{
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '20px'
            }}
        >
            {anomalyResult ? (
                <div>
                    <Alert
                        message={
                            anomalyResult.is_anomaly
                                ? "Anomaly Detected!"
                                : "Normal Conditions"
                        }
                        description={
                            anomalyResult.is_anomaly
                                ? `Unusual environmental conditions detected with ${safeToFixed(anomalyResult.confidence * 100, 1 )}% confidence.`
                                : "Current environmental conditions appear normal."
                        }
                        type={anomalyResult.is_anomaly ? "warning" :"success"}
                        showIcon
                        icon={anomalyResult.is_anomaly ? <WarningOutlined /> : <CheckCircleOutlined />}
                        style={{ marginBottom: 16}}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 20}}>
                        <Statistic
                            title="Anomaly Score"
                            value={safeToFixed(anomalyResult.anomaly_score)}
                            suffix="/ 1.0"
                            valueStyle={{
                                color: anomalyResult.is_anomaly ? '#cf1322' : '#3f8600',
                            }}
                        />
                        <Statistic
                            title="Model Used"
                            value={anomalyResult.prediction_model || 'Unknown'}
                            valueStyle={{
                                fontSize: '16px',
                                color: '#722ED1',
                            }}
                        />
                        <Statistic
                            title="Analysis Time"
                            value={formatDate(anomalyResult.timestamp)}
                            valueStyle={{
                                fontSize: '14px',
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '20px'}}>
                    <Text type="secondary">
                        Run the anomaly detection to analyse current environment conditions
                    </Text>
                </div>
            )}

            <div style={{ marginTop: 24}}>
                <Title level={4} style={{ display: 'flex', alignItems: 'center'}}>
                    <AreaChartOutlined style={{ marginRight: 8}} />
                    Recent Anomalies
                </Title>

                {loadingAnomalies ? (
                    <div style={{ textAlign: 'center', padding: '20px'}}>
                        <Spin />
                    </div>
                ) : recentAnomalies.length > 0 ? (
                    <Timeline mode="left">
                        {recentAnomalies.map((anomaly, index) => (
                            <Timeline.Item
                                key={index}
                                color={(anomaly.anomaly_score || 0) > 0.8 ? "red": "orange"}
                                label={formatDate(anomaly.timestamp)}
                            >
                                <div>
                                    <Text strong>Anomaly Score: {safeToFixed(anomaly.anomaly_score)}</Text>
                                    <Tag color={anomaly.prediction_model === "tensorflow_lite" ? "blue" : "purple"}>
                                        {anomaly.prediction_model}
                                    </Tag>
                                </div>
                                <div>
                                    <Text type="secondary">
                                        Temperature: {anomaly.data?.temperature || 'N/A'}°C,
                                        Humidity: {anomaly.data?.humidity || 'N/A'}%
                                    </Text>
                                </div>
                            </Timeline.Item>
                        ))}
                    </Timeline>
                ) : (
                    <Empty description="No anomalies detected recently" />
                )}
            </div>
        </Card>
    );
};

export default AnomalyDetection;