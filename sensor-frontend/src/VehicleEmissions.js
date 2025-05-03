import React, { useState } from 'react';
import { Card, Progress, Statistic, Select, Spin, Row, Col, Tooltip, Button, Space, Modal } from 'antd';
import { CarOutlined, EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import useVehicleEmissions from './useVehicleEmissions';

const { Option } = Select;

const VehicleEmissions = () => {
    const [timeRange, setTimeRange] = useState('day'); // 'day', 'week', 'month'
    const [vehicleType, setVehicleType] = useState('MEDIUM_PETROL'); // Default vehicle type
    const { emissionsData, loading, error } = useVehicleEmissions(timeRange, vehicleType);
    const [showInfo, setShowInfo] = useState(false);
    
    // Toggle info modal/tooltip
    const toggleInfo = () => {
        setShowInfo(!showInfo);
    };

    // Calculate eco driving score color
    const getScoreColor = (score) => {
        if (score >= 80) return '#52c41a'; // Green
        if (score >= 60) return '#faad14'; // Yellow
        return '#f5222d'; // Red
    };

    // Format CO2 value with unit
    const formatCO2 = (value) => {
        if (value === undefined || value === null) return '0.0 kg';
        return `${value.toFixed(1)} kg`;
    };

    // Environmental impact equivalents
    const getEnvironmentalEquivalents = (co2Amount) => {
        if (!co2Amount) return {};
        
        return {
            trees: Math.round(co2Amount / 21 * 10) / 10, // Trees needed to absorb this CO2 in a year
            phone_charges: Math.round(co2Amount * 450), // Phone charges equivalent
            light_bulbs: Math.round(co2Amount * 125 * 10) / 10, // Hours of LED light bulb
            plastic_bottles: Math.round(co2Amount * 56) // Plastic water bottles produced
        };
    };

    if (loading && !emissionsData) {
        return <Spin size="large" />;
    }

    const equivalents = emissionsData ? getEnvironmentalEquivalents(emissionsData.total_co2) : {};

    return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Vehicle Carbon Footprint</span>
                    <Button 
                        type="text" 
                        icon={<InfoCircleOutlined />} 
                        onClick={toggleInfo}
                        style={{ color: 'white' }}
                    />
                </div>
            }
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
            extra={
                <Space>
                    <Select
                        value={vehicleType}
                        onChange={(value) => setVehicleType(value)}
                        style={{ width: 140 }}
                    >
                        <Option value="SMALL_PETROL">Small Petrol</Option>
                        <Option value="MEDIUM_PETROL">Medium Petrol</Option>
                        <Option value="LARGE_PETROL">Large Petrol/SUV</Option>
                        <Option value="MEDIUM_DIESEL">Medium Diesel</Option>
                        <Option value="MEDIUM_HYBRID">Medium Hybrid</Option>
                        <Option value="MEDIUM_EV">Medium Electric</Option>
                    </Select>
                    <Select
                        value={timeRange}
                        onChange={(value) => setTimeRange(value)}
                        style={{ width: 120 }}
                    >
                        <Option value="day">Today</Option>
                        <Option value="week">This Week</Option>
                        <Option value="month">This Month</Option>
                    </Select>
                </Space>
            }
        >
            {error && <div style={{ color: 'orange', marginBottom: '16px', fontSize: '12px' }}>{error}</div>}

            {emissionsData && (
                <>
                    <Row gutter={16} style={{ marginBottom: '20px' }}>
                        <Col span={8}>
                            <Statistic
                                title="Total CO₂ Emissions"
                                value={emissionsData.total_co2}
                                precision={1}
                                valueStyle={{ color: '#389e0d' }}
                                prefix={<EnvironmentOutlined />}
                                suffix="kg"
                            />
                            <Tooltip title="Your vehicle's carbon footprint">
                                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                                    Equivalent to {equivalents.trees} trees/year
                                </div>
                            </Tooltip>
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Distance Traveled"
                                value={emissionsData.distance_traveled}
                                precision={1}
                                valueStyle={{ color: '#1890ff' }}
                                prefix={<CarOutlined />}
                                suffix="km"
                            />
                        </Col>
                        <Col span={8}>
                            <Statistic
                                title="Average CO₂/km"
                                value={emissionsData.average_co2_per_km}
                                precision={0}
                                valueStyle={{ color: '#722ed1' }}
                                suffix="g/km"
                            />
                        </Col>
                    </Row>

                    <div style={{ marginBottom: '20px' }}>
                        <Tooltip title="Based on acceleration, braking, and idling patterns">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4>Eco-Driving Score</h4>
                                <span style={{ 
                                    color: getScoreColor(emissionsData.driving_efficiency_score),
                                    fontWeight: 'bold' 
                                }}>
                                    {emissionsData.driving_efficiency_score}/100
                                </span>
                            </div>
                            <Progress
                                percent={emissionsData.driving_efficiency_score}
                                strokeColor={getScoreColor(emissionsData.driving_efficiency_score)}
                                status="active"
                                showInfo={false}
                            />
                        </Tooltip>
                    </div>

                    <Row gutter={16} style={{ marginBottom: '20px' }}>
                        <Col span={8}>
                            <Card size="small" title="Harsh Braking">
                                <p style={{ fontSize: '24px', textAlign: 'center', color: emissionsData.eco_driving_events.harsh_braking > 5 ? '#f5222d' : '#389e0d' }}>
                                    {emissionsData.eco_driving_events.harsh_braking}
                                </p>
                                <p style={{ fontSize: '12px', textAlign: 'center', color: '#666' }}>events</p>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" title="Rapid Acceleration">
                                <p style={{ fontSize: '24px', textAlign: 'center', color: emissionsData.eco_driving_events.rapid_acceleration > 5 ? '#f5222d' : '#389e0d' }}>
                                    {emissionsData.eco_driving_events.rapid_acceleration}
                                </p>
                                <p style={{ fontSize: '12px', textAlign: 'center', color: '#666' }}>events</p>
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card size="small" title="Idle Time">
                                <p style={{ fontSize: '24px', textAlign: 'center', color: emissionsData.eco_driving_events.idle_time_minutes > 15 ? '#f5222d' : '#389e0d' }}>
                                    {emissionsData.eco_driving_events.idle_time_minutes}
                                </p>
                                <p style={{ fontSize: '12px', textAlign: 'center', color: '#666' }}>minutes</p>
                            </Card>
                        </Col>
                    </Row>

                    <div>
                        <h4>Emissions Over Time</h4>
                        <div style={{ display: 'flex', overflowX: 'auto' }}>
                            {emissionsData.emission_trend.map((day, index) => (
                                <div
                                    key={index}
                                    style={{
                                        flex: '0 0 14%',
                                        padding: '8px',
                                        textAlign: 'center'
                                    }}
                                >
                                    <div style={{ fontSize: '12px', marginBottom: '5px' }}>
                                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                    </div>
                                    <div
                                        style={{
                                            height: `${day.co2 * 30}px`,
                                            backgroundColor: day.co2 > 3 ? '#ff7875' : '#4CAF50',
                                            borderRadius: '4px',
                                            minHeight: '20px',
                                            marginBottom: '5px'
                                        }}
                                    ></div>
                                    <div style={{ fontSize: '12px' }}>{formatCO2(day.co2)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Environmental Impact Section */}
                    <Card
                        title="Environmental Impact Equivalents"
                        size="small"
                        style={{ marginTop: '20px', backgroundColor: '#E8F5E9' }}
                    >
                        <Row gutter={16}>
                            <Col span={12}>
                                <Tooltip title="Number of tree-years needed to absorb this carbon">
                                    <Statistic
                                        title="Tree Absorption"
                                        value={equivalents.trees}
                                        precision={1}
                                        valueStyle={{ color: '#389e0d', fontSize: '16px' }}
                                        suffix="trees/year"
                                    />
                                </Tooltip>
                            </Col>
                            <Col span={12}>
                                <Tooltip title="Equivalent number of smartphone charges">
                                    <Statistic
                                        title="Phone Charges"
                                        value={equivalents.phone_charges}
                                        valueStyle={{ color: '#1890ff', fontSize: '16px' }}
                                    />
                                </Tooltip>
                            </Col>
                        </Row>
                    </Card>
                </>
            )}
            
            {/* Info Modal */}
            <Modal
                title="Vehicle Carbon Footprint Information"
                open={showInfo}
                onCancel={toggleInfo}
                footer={[
                    <Button key="close" onClick={toggleInfo}>
                        Close
                    </Button>
                ]}
                width={600}
            >
                <div style={{ padding: '10px' }}>
                    <h3>Understanding Vehicle Emissions</h3>
                    <p>
                        This panel tracks the carbon dioxide (CO₂) emissions from your vehicle based on
                        driving data collected by the movement sensors. It helps you understand your transportation
                        carbon footprint and identifies ways to reduce it.
                    </p>
                    
                    <h4>Key Metrics</h4>
                    <ul>
                        <li><strong>Total CO₂ Emissions</strong>: The estimated total carbon dioxide emitted by your vehicle during the selected time period.</li>
                        <li><strong>Distance Traveled</strong>: Total kilometers driven in the selected period.</li>
                        <li><strong>Average CO₂/km</strong>: Your vehicle's emissions rate per kilometer, which varies based on vehicle type, driving style, and road conditions.</li>
                        <li><strong>Eco-Driving Score</strong>: A rating (0-100) based on how efficiently you're driving. Higher scores indicate more fuel-efficient, eco-friendly driving.</li>
                    </ul>
                    
                    <h4>Driving Events</h4>
                    <ul>
                        <li><strong>Harsh Braking</strong>: Sudden, hard braking events that increase fuel consumption and emissions.</li>
                        <li><strong>Rapid Acceleration</strong>: Quick acceleration events that consume more fuel and generate more emissions.</li>
                        <li><strong>Idle Time</strong>: Minutes spent with the engine running while stationary, which uses fuel with no travel benefit.</li>
                    </ul>
                    
                    <h4>Environmental Equivalents</h4>
                    <p>
                        To help visualize your carbon impact, we show equivalents like how many trees would be 
                        needed to absorb your emissions or how many smartphone charges could be powered with 
                        the same energy.
                    </p>
                    
                    <h4>Tips to Reduce Your Vehicle Carbon Footprint</h4>
                    <ul>
                        <li>Practice smooth acceleration and gentle braking</li>
                        <li>Reduce idling - turn off your engine when stopped for more than 30 seconds</li>
                        <li>Maintain proper tire pressure to improve fuel efficiency</li>
                        <li>Remove unnecessary weight from your vehicle</li>
                        <li>Combine trips to reduce cold starts</li>
                        <li>Consider carpooling or using public transportation when possible</li>
                    </ul>
                </div>
            </Modal>
        </Card>
    );
};

export default VehicleEmissions;