import  React, { useState, useEffect } from 'react';
import { Card, Button, Tag, Statistic, Descriptions, Typography, Alert, Divider, Progess, Spin, Progress} from 'antd';
import { ThunderboltOutlined, FireOutlined, DollarOutlined, LineChartOutlined, SyncOutlined, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined} from '@ant-design/icons';
import apiService from './apiService';
import { Line } from 'react-chartjs-2';

const { Title, Text, Paragraph } = Typography;

const EnergyOptimiser = ({ roomId }) => {
    const [recommendations, setRecommendations] = useState(null);
    const [savingsSummary, setSavingsSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [summaryLoading, setSummaryLoading] = useState(false);

    // Fetch recommendations
    const fetchRecommendations = async () => {
        if (!roomId) return;

        setLoading(true);
        try{
            const response = await apiService.getEnergyRecommendations(roomId);
            setRecommendations(response.data);
        } catch (error) {
            console.error('Error fetching energy recommendations:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch savings summary
    const fetchSavingsSummary = async () => {
        setSummaryLoading(true);
        try{
            const response = await apiService.getEnergySavingsSummary();
            setSavingsSummary(response.data);
        } catch (error) {
            console.error('Error fetching energy savings summary:', error);
        } finally {
            setSummaryLoading(false);
        }
    };

    // Load data when roomId changes
    useEffect(() => {
        if (roomId) {
            fetchRecommendations();
        }
        fetchSavingsSummary();
    }, [roomId]);

    // Get the action icon that should be based on the action type
    const getActionIcon = (action) => {
        switch (action){
            case 'increase':
                return <ArrowUpOutlined style={{ color: '#fa8c16'}} />;
            case 'decrease':
                return <ArrowDownOutlined style={{ color: '#52c41a'}} />;
            case 'optimise':
                return <LineChartOutlined style={{ color: '#1890ff'}} />;
            case 'maintain':
            default:
                return <MinusOutlined style={{ color: '#8c8c8c'}} />
        }
     };

     // Gets the color for savings category
     const getSavingsColor = (category) => {
        switch (category) {
            case 'High':
                return '#52c41a';
            case 'Medium':
                return '#1890ff';
            case 'Low':
                return '#faad14';
            default:
                return '#8c8c8c'
        }
     };

     // Get an appropriate emoji for time context
     const getTimeContextEmoji = (context) => {
        switch (context) {
            case 'morning':
                return '🌅';
            case 'day':
                return '☀️';
            case 'evening':
                return '🌇';
            case 'night':
                return '🌙';
            default:
                return '🌙';
        }
     };

     return (
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center'}}>
                    <ThunderboltOutlined style={{ marginRight: 8, color: '#52c41a'}} />
                    <span>Energy Optimisation</span>
                </div>
            }
            extra={
                <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={fetchRecommendations}
                    loading={loading}
                    style={{ backgroundColor: '#52c41a', borderColor: '#52c41a'}}
                    disabled={!roomId}
                >
                    Update Recommendations
                </Button>
            }
            style={{
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '20px'
            }}
        >
            {!roomId ? (
                <Alert
                    message="Select a Room"
                    description="Please selevt a room to see energy optimisation recommendations."
                    type="info"
                    showIcon
                />
            ) : loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0'}}>
                    <Spin size="large" />
                </div>
            ) : recommendations ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px'}}>
                        <Statistic
                            title="Current Temperature"
                            value={recommendations.current_temperature}
                            suffix="°C"
                            valueStyle={{ color: '#1890ff'}}
                        />
                        <Statistic
                            title="Recommended"
                            value={recommendations.recommended_temperature}
                            suffix="°C"
                            valueStyle={{ color: '#52c41a'}}
                            prefix={getActionIcon(recommendations.action)}
                        />
                        <Statistic
                            title="Current Humidity"
                            value={recommendations.current_humidity}
                            suffix="%"
                            valueStyle={{ color: '#1890ff'}}
                        />
                        <Statistic
                            title="Potential Savings"
                            value={recommendations.savings_potential}
                            suffix="%"
                            valueStyle={{ color: getSavingsColor(recommendations.savings_potential_category) }}
                        />
                    </div>

                    <Alert
                        message={<Text strong>{recommendations.recommendation}</Text>}
                        description={recommendations.energy_tip}
                        type={recommendations.action === 'maintain' ? 'success' : 'info'}
                        showIcon
                        style={{ marginBottom: '16px'}}
                    />
                    <div style={{ marginBottom: '16px'}}>
                        <Text strong>Time Context: </Text>
                        <Tag color="blue">
                            {getTimeContextEmoji(recommendations.time_context)} {recommendations.time_context.charAt(0).toUpperCase() + recommendations.time_context.slice(1)} 
                        </Tag>
                    </div>

                    <div>
                        <Text strong>Savings Potential: </Text>
                        <Progress
                            percent={recommendations.savings_potential * 2}
                            status="active"
                            strokeColor={getSavingsColor(recommendations.savings_potential_category)}
                        />
                    </div>
                </div>
            ) : (
                <Alert
                    message="No Recommendations"
                    description="No energy optimisation recommendations are available. Try refreshing"
                    type="warning"
                    showIcon
                />
            )}

            <Divider />

            <Title level={4} style={{ display: 'flex', alignItems: 'center'}}>
                <DollarOutlined style={{ color: '#52c41a', marginRight: 8}} />
                Energy Savings Summary
            </Title>

            {summaryLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0'}}>
                    <Spin />
                </div>
            ) : savingsSummary ? (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px', marginBottom: '20px'}}>
                        <Statistic
                            title="Energy Saved"
                            value={savingsSummary.total_energy_saved_kwh}
                            suffix="kWh"
                            prefix={<ThunderboltOutlined />}
                            valueStyle={{ color: '#1890ff'}}
                        />
                        <Statistic
                            title="CO2 Reduction"
                            value={savingsSummary.co2_reduction_kg}
                            suffix="kg"
                            prefix={<FireOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                        <Statistic
                            title="Avg. Savings"
                            value={savingsSummary.average_savings_percent}
                            suffix="%"
                            prefix={<DollarOutlined />}
                            valueStyle={{ color: '#fa8c16'}}
                        />  
                    </div>

                    <Paragraph type="secondary" style={{ textAlign: 'center'}}>
                        These are estimates based on your optimisation history. Actual savings will vary
                    </Paragraph>
                </div>
            ) : (
                <Alert
                    message="No Savings Data"
                    description="No energy savings data is available yet."
                    type="info"
                    showIcon
                />
            )}
        </Card>
     );
};

export default EnergyOptimiser;