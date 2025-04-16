import React, { useState, useEffect } from 'react';
import apiService from './apiService';
import './Noticeboard.css';//import CSS styling
import { Card, Alert, List, Typography, Spin, Badge } from 'antd';
import { WarningOutlined, InfoCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text} = Typography;
const NoticeBoard = () => {
    const [alerts, setAlerts] = useState([])
    const [error, setError] = useState(null);//State to hold errors
    const [loading, setLoading] = useState(true);
    //Fetch notifications from the Flask backend
    const fetchAlerts = async () => {
        try {
            setLoading(true);
            const response = await apiService.getAlerts();
            setAlerts(response.data)
            setError(null)
        } catch (error) {
            console.error("Error fetching alerts:", error)
            setError('Failed to load alerts. Please try again later')
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAlerts()
        const interval = setInterval(fetchAlerts, 10000); //fetch alerts every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const getAlertIcon = (severity) => {
        switch (severity) {
            case 'critical':
                return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
            case 'warning':
                return <WarningOutlined style={{ color: '#faad14' }} />
            default:
                return <InfoCircleOutlined style={{ color: '#1890ff' }} />
        }
    };

    const formatThresholdMessage = (threshold) => {
        if (threshold === 'temperature_high') return 'Temperature is too high';
        if (threshold === 'temperature_low') return 'Temperature is too low';
        if (threshold === 'humidity_high') return 'Humidity is too high';
        if (threshold === 'humidity_low') return 'Humidity is too low';
        if (threshold === 'water_usage_high') return 'Water usage is too high';
        return threshold
    }
    return (
        <Card
            title={<Title level={4} style={{ margin: 0, color: 'white' }}>Environmental Alerts</Title>}
            style={{
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                backgroundColor: '#F1F8E9',
                margin: '16px'
            }}
            headStyle={{
                backgroundColor: '#388E3C',
                color: 'white',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px'
            }}
            extra={
                <Badge count={alerts.length} style={{ backgroundColor: alerts.length > 0 ? '#f5222d' : '#52c41a' }} />
            }
        >
            {error && (
                <Alert
                    message="Error"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {loading && alerts.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                    <Spin size="large" />
                </div>

            ) : alerts.length > 0 ? (
                <List
                    itemLayout="horizontal"
                    dataSource={alerts}
                    renderItem={(alert, index) => (
                        <List.Item
                            className={alert.severity}
                            style={{
                                padding: '12px 16px',
                                marginBottom: '10px',
                                backgroundColor: alert.severity === 'critical' ? '#fff1f0' :
                                    alert.severity === 'warning' ? '#fffbe6' : '#e6f7ff',
                                borderLeft: `4px solid ${alert.severity === 'critical' ? '#f5222d' :
                                    alert.severity === 'warning' ? '#faad14' : '#1890ff'}`,
                                borderRadius: '4px',
                                transition: 'all 0.3s ease'

                            }}
                        >
                            <List.Item.Meta
                                avatar={getAlertIcon(alert.severity)}
                                title={
                                    <div style={{ fontWeight: 'bold', color: '#333' }}>
                                        {alert.exceeded_thresholds.map(formatThresholdMessage).join(', ')}
                                    </div>
                                }
                                description={
                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                        {new Date(alert.timestamp).toLocaleString()}
                                    </Text>
                                }
                            />
                        </List.Item>

                    )}
                />

            ) : (
                <Alert
                    message="No Alerts"
                    description="All environmental metrics are within normal ranges."
                    type="success"
                    showIcon
                />
            )}
        </Card>
    );
};

export default NoticeBoard;