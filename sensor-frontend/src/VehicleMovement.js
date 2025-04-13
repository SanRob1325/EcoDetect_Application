import React, { useState, useEffect} from 'react';
import apiService from './apiService';
import { Card, Row, Col, Statistic, Progress, Select, Spin, Alert} from 'antd';
import {CarOutlined, CompassOutlined, ThunderboltOutlined, BulbOutlined} from '@ant-design/icons';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto'; // Added for making sure the charts work

const { Option } = Select;

const VehicleMovement = () => {
    const [movementData, setMovementData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [timeRange, setTimeRange] = useState(1); // Makes the default time range 1 hour
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch current movement data
    useEffect(() => {
        const fetchMovementData = async () => {
            try{
                const response = await apiService.getVehicleMovement();
                setMovementData(response.data);
                setError(null);
            } catch (e) {
                console.error('Error fetching vehicle movement data:', e);
                setError('Could not fetch vehicle movement data. Is the vehicle sensor connected?')
            }
        };

        fetchMovementData();
        const interval = setInterval(fetchMovementData, 2000);
        return () => clearInterval(interval);
    }, []);

    // Fetch historical data
    useEffect(() => {
        const fetchHistoryData = async () => {
            setLoading(true);
            try {
                const response = await apiService.getVehicleMovementHistory();
                setHistoryData(response.data);
                setError(null);       
            } catch (e){
                console.error('Error fetching movement history:', e);
                setError('Could not fetch movement history data');
            }finally{
                setLoading(false);
            }
        };

        fetchHistoryData();
        const interval = setInterval(fetchHistoryData, 60000); // Updates ever minute
        return () => clearInterval(interval)
    }, [timeRange]);

    // The helper function to get color based movements
    const getMovementColor = (movementType) => {
        const colorMap = {
            accelerating: '#52c41a', // Green
            braking: '#f5222d', // Red
            turning_left: '#faad14', // Yellow
            turning_right: '#faad14', // Yellow
            rough_road: '#722ed1', // Purple
            stationary: '#d9d9d9', // Gray
            steady_movement: '#1890ff',
        };
        return colorMap[movementType] || '#1890ff';
    };

    // Prepare chart data
    const chartData = {
        labels: historyData.map(data => new Date(data.timestamp).toLocaleTimeString()),
        datasets: [
            {
                label: 'G-Force',
                data: historyData.map(data => data.accel_magnitude),
                borderColor: '#1890ff',
                backgroundColor: 'rgba(24, 144, 255, 0.2',
                fill: true,
            },
            {
                label: 'Rotation Rate',
                data: historyData.map(data => data.rotation_rate),
                borderColor: '#52c41a',
                backgroundColor: 'rgba(82, 192, 26, 0.2)',
                fill: true,
            }
        ]
    };

    // Get compass direction from heading
    const getCompassDirection = (heading) => {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return directions[Math.round(heading / 45 ) % 8];
    };

    if (loading && !movementData) {
        return <Spin size="large" />

    }

    return (
        <div>
            <h2>Vehicle Movement Monitor</h2>

            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16}} />}

            {movementData && (
                <Row gutter={16}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Movement Type"
                                value={movementData.movement_type.replace('_', ' ')}
                                valueStyle={{ color: getMovementColor(movementData.movement_type)}}
                                prefix={<CarOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="G-Force"
                                value={movementData.accel_magnitude}
                                precision={2}
                                suffix="g"
                                prefix={<ThunderboltOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Rotation Rate"
                                value={movementData.rotation_rate}
                                precision={2}
                                suffix="degrees/s"
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Heading"
                                value={`${movementData.orientation.heading} degrees ${getCompassDirection(movementData.orientation.heading)}`}
                                prefix={<CompassOutlined />}
                            />
                        </Card>
                    </Col>
                </Row>
            )}

            <Card title="Vehicle Orientation" style={{  marginTop: 16}}>
                {movementData && (
                    <Row gutter={16}>
                        <Col span={12}>
                            <h4>Pitch (Forward/Backward Tilt)</h4>
                            <Progress
                                type="dashboard"
                                percent={Math.min(Math.abs(movementData.orientation.pitch) * 100 / 90, 100)}
                                format={() => `${movementData.orientation.pitch.toFixed(1)} degrees`}
                            />
                            <p>{movementData.orientation.pitch > 0 ? 'Uphill' : 'Downhill'}</p>
                        </Col>
                        <Col span={12}>
                            <h4>Roll (Side to Side Tilting)</h4>
                            <Progress
                                type="dashboard"
                                percent={Math.min(Math.abs(movementData.orientation.roll) * 100 / 90, 100)}
                                format={() => `${movementData.orientation.roll.toFixed(1)} degrees`}
                            />
                            <p>{movementData.orientation.roll > 0 ? 'Tilted Right' : 'Tilted Left' }</p>
                        </Col>
                    </Row>
                )}
            </Card>
            
            <Card title="Movement History" style={{ marginTop: 16}}>
                <div style={{ marginBottom: 16}}>
                    <span style={{marginRight: 8}}> Time Range:</span>
                    <Select
                        value={timeRange}
                        onChange={(value) => setTimeRange(value)}
                        style={{ width: 120}}
                    >
                        <Option value={1}>Last Hour</Option>
                        <Option value={2}>Last 6 hours</Option>
                        <Option value={3}>Last 24 hours</Option>
                    </Select>
                </div>

                {historyData.length > 0 ? (
                    <Line
                        data={chartData}
                        options={{
                            responsive: true,
                            scales: {
                                y: {
                                    beginAtZero: true
                                }
                            }
                        }}
                    />
                ): (
                    <p>No historical data available for the selected time range</p>
                )}
            </Card>

            <Card title="Drive Safety Analysis" style={{ marginTop: 16}}>
                {historyData.length > 0 && (
                    <Row gutter={16}>
                        <Col span={8}>
                            <Statistic
                                title="Harsh breaking Events"
                                value={historyData.filter(d => d.movement_type === 'braking' && d.accel_magnitude > 0.5).length}
                                valueStyle={{ color: '#f5222d' }}
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Rapid Application Events"
                                value={historyData.filter(d => d.movement_type === 'accelerating' && d.accel_magnitude > 0.5).length}
                                valueStyle={{color: '#faad14'}}
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Road Condition Issues"
                                value={historyData.filter(d => d.movement_type === 'rough_road').length}
                                valueStyle={{ color: '#722ed1'}}
                                suffix={`/ ${historyData.length}`}
                            />
                        </Col>
                    </Row>
                )}
            </Card>
        </div>
    );
};

export default VehicleMovement;
