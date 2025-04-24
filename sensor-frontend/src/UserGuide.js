import React from 'react'
import { Card, Collapse, Typography, Divider, Steps, Button} from 'antd';
import { QuestionCircleOutlined, SettingOutlined, BellOutlined, RobotOutlined, LineChartOutlined,CarOutlined, DashboardOutlined, HomeOutlined} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const UserGuide = () => {
    return(
        <Card
            title={
                <div style={{ display: 'flex', alignItems: 'center', color: 'white'}}>
                    <QuestionCircleOutlined style={{ marginRight: '8px'}} />
                    <span>EcoDetect User Guide</span>
                </div>
            }
            style={{
                margin: '16px',
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
            <div style={{ padding: '16px 0'}}>
                <Title level={4} style={{ color: '#388E3C'}}>Welcome to the EcoDetect User Guide</Title>
                <Paragraph>
                    This guide helps you navigate through all the features and capabilies of the EcoDetect application,
                    enabling you to affectively monitor and reduce your environmental impact.
                </Paragraph>
            </div>

            <Divider style={{ borderColor: '#AED581'}} />
            <Collapse
                defaultActiveKey={['1']}
                style={{
                    backgroundColor: '#F1F8E9',
                    border: 'none',
                    borderRadius: '8px'
                }}
            >
                <Collapse.Panel
                    header={<Title level={5} style={{ margin: 0}}><DashboardOutlined /> Dashboard Overview</Title>}
                    key="1"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The Dashboard helps monitor environmental metrics in real time. Here you'll find the following:
                    </Paragraph>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li>
                            <Text strong>Temperature and Humidity Gauges:</Text> Monitor room conditions with visual inidicators for optimal ranges.
                        </li>
                        <li>
                            <Text strong>Barometric Pressure:</Text> That Provides weather insights to optimise environmental activity
                        </li>
                        <li>
                            <Text strong>Altitude Monitoring:</Text> Tracks elevation changes which can impact energy consumption
                        </li>
                        <li>
                            <Text strong>IMU Data</Text> That measures equipment usage and movement patterns
                        </li>
                        <li>
                            <Text strong>Water Usage:</Text> Tracks water consumption in real time against set thresholds
                        </li>
                        <li>
                            <Text strong>Carbon Footprint</Text> Calculates your environmental impact based on all sensor data obtained
                        </li>
                    </ul>
                    <Title level={5} style={{ color: '#388E3C', marginTop: '16px'}}> Using the Dashboard</Title>
                    <Steps direction="vertical" size="small" current={-1}>
                        <Steps.Step title="View Real time Data" description="All gauges and charts update automatically every few seconds." />
                        <Steps.Step title="Adjust Thresholds" description="Use the 'Preferred Ranges' section to set you environmental targets." />
                        <Steps.Step title="Monitor Alerts" description="The system will notify you when readings exceed your thresholds" />
                        <Steps.Step title="Analyse Trends" description="View historical data in the Temperature and CO2 Trends sections." />
                    </Steps>
                </Collapse.Panel>
                <Collapse.Panel
                    header={<Title level={5} style={{margin: 0}}><SettingOutlined />Settings</Title>}
                    key="2"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The settings page allows you to configure the application according to you preferences and requirements
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Settings Available to You</Title>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li><Text strong>Temperature Thresholds:</Text>Set to your accpeted temperature range</li>
                        <li><Text strong>Humidity Thresholds:</Text>Define the optimal humidiy levels</li>
                        <li><Text strong>Water Usage Threshold:</Text>Set maximum flow rate values.</li>
                        <li><Text strong>Notification Preferences:</Text>configure how you recieve, it could be emails,SMS messages or both</li>
                    </ul>
                    <Paragraph style={{ marginTop: '16px'}}>
                        Remember to click the "Save Settings" button after making any changes to apply you new preferences
                    </Paragraph>
                </Collapse.Panel>
                <Collapse.Panel
                    header={<Title level={5} style={{ margin: 0}}><BellOutlined />Alerts</Title>}
                    key="3"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The Alerts system helps you stay informed about important environmental changes any thresholds that have exceeded 
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Alert Types</Title>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li><Text strong style={{ color: '#f5222d'}}>Critical Alerts:</Text> Significant threshold violations that need immediate action</li>
                        <li><Text strong style={{ color: '#faad14'}}>Warning Alerts:</Text>Conditions approaching threshold limits.</li>
                        <li><Text strong style={{ color: '#1890ff'}}>Information Alerts:</Text> General updates about system performance</li>
                    </ul>
                    <Title level={5} style={{ color: '#388E3C', marginTop: '16px'}}>Alert Delivery</Title>
                    <Paragraph>
                        Based on you notification preferences, alerts can be delivered through:
                    </Paragraph>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li>In app notifications</li>
                        <li>Email alerts</li>
                        <li>SMS messages</li>
                    </ul>
                </Collapse.Panel>
                <Collapse.Panel
                    header={<Title level={5} style={{ marginTop: 0}}><RobotOutlined /> AI Assistant</Title>}
                    key="4"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The AI Assistant provides predictive analysis and personalised recommendations to help you optimise you environmental impact.
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Using the AI Assistant</Title>
                    <Steps direction="vertical" size="small" current={-1}>
                        <Steps.Step title="Ask Questions" description="Type your environmental questions in the chatbot" />
                        <Steps.Step title="Get Predictions" description="View forecasted trends for temperature, humidity, and other sensor measurements" />
                        <Steps.Step title="Recieve Recommendations" description="Get personalised suggestions for reducing you carbon footprint" />
                        <Steps.Step title="Detect Anomalies" description="The AI will identify unusual patterns in your environmental data and history" />
                    </Steps>
                    <Paragraph style={{ marginTop: '16px'}}>
                        <Text strong>Example questions you can ask:</Text>
                    </Paragraph>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li>"How can I reduce my carbon footprint?"</li>
                        <li>"What's the predicted temperature trend for the new week?"</li>
                        <li>"Suggest ways to optimise water usage"</li>
                        <li>"Explain the recent humidity variations"</li>
                    </ul>
                </Collapse.Panel>
                <Collapse.Panel
                    header={<Title level={5} style={{ margin: 0}}><LineChartOutlined />Reports</Title>}
                    key="5"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The Reports feature allows you to generate detailed environmental analysis documents for different time periods.
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Report Options</Title>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li><Text strong>Quick Reports:</Text> Generate standard reports with common metrics over daily-monthly periods.</li>
                        <li><Text strong>Advanced Report Genrator:</Text> Generate standard reports with common metrics over daily-monthly periods</li>
                        <li><Text strong>Scheduled Reports:</Text> Set up automatic report generation and delivery on a recurring basis.</li>
                    </ul>
                    <Paragraph style={{ marginTop: '16px'}}>
                        Reports can be exported as PDF documents that you can send to your email for accurate record keeping.
                    </Paragraph>
                </Collapse.Panel>

                <Collapse.Panel 
                    header={<Title level={5} style={{ margin: 0}}><HomeOutlined />Room Monitoring</Title>}
                    key="6"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The Room Monitoring feature allows you to track conditions across different spaces in your household.
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Features</Title>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li><Text strong>Multiple Room Tracking:</Text> Monitor different rooms simultaneously.</li>
                        <li><Text strong>Room-specific Metrics:</Text>View temperature,humidity, and other conditions for each space. </li>
                        <li><Text strong>Status Indicators:</Text>Quickly identify which rooms need attention.</li>
                    </ul>
                    <Paragraph style={{ marginTop: '16px'}}>
                        Use the tab interface to switch between different rooms and can view their specific environmental conditions.
                    </Paragraph>
                </Collapse.Panel>
                <Collapse.Panel
                    header={<Title level={5} style={{margin:0}}><CarOutlined /> Vehicle Monitoring</Title>}
                    key="7"
                    style={{
                        backgroundColor: 'white',
                        marginBottom: '16px',
                        borderRadius: '8px',
                        border: '1px solid #E8F5E9'
                    }}
                >
                    <Paragraph>
                        The Vehicle Monitoring feature helps track vehicle movement and driving behaviou to optimise fuel efficiency and reduce emissions.
                    </Paragraph>
                    <Title level={5} style={{ color: '#388E3C'}}>Key Metrics</Title>
                    <ul style={{ paddingLeft: '20px'}}>
                        <li><Text strong>Movement Type:</Text>Identifies acceleration such as breakind,turning and steady movement patterns</li>
                        <li><Text strong>G-Force:</Text>Measures the intensity of acceleration and braking</li>
                        <li><Text strong>Orientation:</Text> Tracks vehicle pitch and roll to identify road conditions and driving behaviour.</li>
                        <li><Text strong>Drive Safety Analysis:</Text> Summarises harsh braking events, rapid acceleration, and road condition issues.</li>
                    </ul>
                    <Paragraph style={{ marginTop: '16px'}}>
                        Use this data to identify oppourtunities for more efficient driving practices and reduce your vehicle's environental imapact.
                    </Paragraph>
                </Collapse.Panel>
            </Collapse>

            <Divider style={{ borderColor: '#AED581'}} />

            <div style={{ textAlign: 'center', marginTop: '20px'}}>
                <Title level={5} style={{ color: '#388E3C'}}>Need More Help?</Title>
                <Paragraph>
                    If you have any additional questions or need any assitance, email me at seanrobertblitzntonya@gmail.com
                </Paragraph>
                <Button
                    type="primary"
                    icon={<QuestionCircleOutlined />}
                    style={{
                        backgroundColor: '#4CAF50',
                        borderColor: '#388E3C',
                        borderRadius: '4px'
                    }}
                >
                    Contact Support
                </Button>
            </div>

        </Card>
    );
};

export default UserGuide;