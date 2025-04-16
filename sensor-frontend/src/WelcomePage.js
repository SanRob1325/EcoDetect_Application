import React from 'react';
import { Card, Row, Col, Typography, Button, Statistic, Divider, Space, Image } from 'antd';
import {
    DashboardOutlined,
    BarChartOutlined,
    ThunderboltOutlined,
    CheckCircleOutlined,
    RocketOutlined,
    SafetyOutlined,
    ArrowRightOutlined
} from '@ant-design/icons';
import logo from './Icon-Only-Color.png';
import { useNavigate } from 'react-router-dom';
const { Title, Paragraph, Text } = Typography;

const WelcomePage = () => {
    const navigate = useNavigate();
    return (
        <div style={{ background: '#F1F8E9', minHeight: '100vh', padding: '20px' }}>
            <Card
                style={{
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    border: 'none',
                    marginBottom: '24px'
                }}
                bodyStyle={{ padding: 0 }}
            >
                <div style={{
                    background: 'linear-gradient(135deg, #388E3C 0%, #81C784 100%)',
                    padding: '40px 24px',
                    color: 'white',
                    textAlign: 'center'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
                        <Image
                            src={logo}
                            alt="EcoDetect Logo"
                            preview={false}
                            width={80}
                            style={{ marginRight: '16px' }}
                        />
                        <Title style={{ color: 'white', margin: 0, fontSize: '42px' }}>EcoDetect</Title>
                    </div>
                    <Title level={3} style={{ color: 'white', fontWeight: 'normal', marginTop: 0 }}>
                        Smart Environmental Monitoring for a Greener Future
                    </Title>
                    <Paragraph style={{ fontSize: '16px', maxWidth: '800px', margin: '24px auto' }}>
                        EcoDetect provides real-time monitoring and analysis of envrionmental conditions,
                        helping you reduce energy consumption,maintain environmental sustainability and minimise your Carbon Footprint
                    </Paragraph>
                    <Space size="large">
                        <Button
                            type="primary"
                            size="large"
                            icon={<DashboardOutlined />}
                            onClick={() => navigate('/dashboard')}
                            style={{
                                backgroundColor: 'white',
                                borderColor: 'white',
                                color: '#388E3C',
                                height: '46px',
                                fontWeight: 'bold',
                                borderRadius: '4px'
                            }}
                        >
                            Go to Dashboard
                        </Button>
                        <Button
                            type="default"
                            size="large"
                            icon={<ArrowRightOutlined />}
                            onClick={() => navigate('/guide')}
                            style={{
                                borderColor: '#388E3C',
                                color: '#388E3C',
                                fontWeight: 'bold',
                                height: '46px',
                                borderRadius: '4px'
                            }}
                        >
                            User Guide
                        </Button>
                    </Space>
                </div>
            </Card>

            <Card
                title={
                    <Title level={3} style={{ margin: 0 }}>
                        Key Features
                    </Title>
                }
                style={{
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: 'white',
                    marginBottom: '25px'
                }}
                headStyle={{
                    backgroundColor: '#388E3C',
                    color: 'white',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                }}
            >
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <DashboardOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}>Real time Monitoring</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Track temperature, humidity, pressure and othe environmental metrics in real time with intuitive gauges and visualisations
                            </Paragraph>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <BarChartOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}>Advanced Analytics</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Analyse historical data trends, generated detailed reports, and identify oppourtunities for environmental optimisation
                            </Paragraph>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <RocketOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}> AI Powered Insights</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Leverage EcoBot the AI Assistant for predictive analysis, anomaly detection, and personalised
                                recommendations to reduce your environmental impact.
                            </Paragraph>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <SafetyOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}> Proactive Alerts</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Recieve timely notifications when environmental conditions your defined thresholds, enabling quick corrective actions
                            </Paragraph>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <ThunderboltOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}> Energy Optimisation</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Identify energy wastage patterns and implementing targeted improvements such as reducing the heating consumption
                                to reduce costs
                            </Paragraph>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} lg={8}>
                        <Card
                            style={{
                                height: '100%',
                                borderRadius: '8px',
                                borderColor: '#E8F5E9'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                <CheckCircleOutlined style={{ fontSize: '32px', color: '#388E3C' }} />
                            </div>
                            <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}> Carbon Footprint Tracking</Title>
                            <Paragraph style={{ textAlign: 'center' }}>
                                Monitor your carbon emissions and track progress towards environental sustainability goals with detailed metrics and reporting
                            </Paragraph>
                        </Card>
                    </Col>
                </Row>
            </Card>

            {/*Impact Statistics*/}
            <Card
                title={
                    <Title level={3} style={{ margin: 0 }}>
                        The Goal of environmental Impact
                    </Title>

                }
                style={{
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: 'white',
                    marginBottom: '24px'
                }}
                headStyle={{
                    backgroundColor: '#388E3C',
                    color: 'white',
                    borderTopLeftRadius: '8px',
                    borderTopRightRadius: '8px'
                }}
            >
                <Paragraph style={{ fontSize: '16px', marginBottom: '24px' }}>
                    EcoDetect helps users with environmental sustainability by addressing and reducing the following:
                </Paragraph>
                <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic
                            title="Energy Savings"
                            value={15}
                            suffix="%"
                            valueStyle={{ color: '#388E3C' }}
                        />
                        <Text>Of average reduction in energy usage</Text>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic
                            title="Water Conservation"
                            value={22}
                            suffix="%"
                            valueStyle={{ color: '#388E3C' }}
                        />
                        <Text>Of average water consumption reduction</Text>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic
                            title="CO2 Reduction"
                            value={7500}
                            suffix="tons"
                            valueStyle={{ color: '#388E3C' }}
                        />
                        <Text>Total carbon emissions that are prevented</Text>
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <Statistic
                            title="Aimed Sustainability Score"
                            value={84}
                            suffix="/100"
                            valueStyle={{ color: '#388E3C' }}
                        />
                        <Text>Average user sustainability ratings</Text>
                    </Col>
                </Row>
            </Card>

            {/*Get Started Page*/}
            <Card
                style={{
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    backgroundColor: 'white'
                }}
                bodyStyle={{
                    textAlign: 'center',
                    padding: '40px 40px'
                }}
            >

                <Title level={4} style={{ textAlign: 'center', color: '#388E3C' }}>Ready To get started?</Title>
                <Paragraph style={{ textAlign: 'center' }}>
                    Begin your journey toward a greener future with EcoDetect. EcoDetect is a platform that makes it easy
                    to monitor, analyse an optimise environmental impact.
                </Paragraph>

                <Space size="large">
                    <Button
                        type="primary"
                        size="large"
                        icon={<DashboardOutlined />}
                        onClick={() => navigate('/dashboard')}
                        style={{
                            backgroundColor: '#388E3C',
                            borderColor: '#388E3C',
                            color: 'white',
                            fontWeight: 'bold',
                            height: '46px',
                            borderRadius: '4px'
                        }}
                    >
                        Go to Dashboard
                    </Button>
                    <Button
                        type="default"
                        size="large"
                        icon={<ArrowRightOutlined />}
                        onClick={() => navigate('/guide')}
                        style={{
                            borderColor: '#388E3C',
                            color: '#388E3C',
                            fontWeight: 'bold',
                            height: '46px',
                            borderRadius: '4px'
                        }}
                    >
                        Take a Tour
                    </Button>
                </Space>

                <Divider style={{ borderColor: '#AED581', margin: '40px 0 24px' }} />
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Image
                        src={logo}
                        alt="EcoDetect Logo"
                        preview={false}
                        width={40}
                        style={{ marginRight: '8px' }}
                    />
                    <Text style={{ fontSize: '16px', color: '#388E3C' }}>EcoDetect 2025 - For a greener world</Text>
                </div>
            </Card>
        </div>
    )
}

export default WelcomePage;