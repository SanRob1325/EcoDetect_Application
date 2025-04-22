import React, { useState} from 'react';
import {Card, Button, Modal, Select, Space, Tag, Typography} from 'antd';
import {FileTextOutlined, DownloadOutlined, LineChartOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const {Title, Paragraph} = Typography;

const ReportCard = ({style = {}}) => {
    const [quickReportVisible, setQuickReportVisible] = useState(false);
    const [timeRange, setTimeRange] = useState('daily');
    const navigate = useNavigate();

    // This function navigates to the full report generator page
    const goToReportGenerator = () =>{
        navigate('/reports');
    };

    // Quick report generation would open a modal with basic options
    const showQuickReport = () =>{
        setQuickReportVisible(true);
    };

    // Handle quick report generation
    const handleQuickReport = () => {
        setQuickReportVisible(false);
        navigate('/reports', {
            state: {
                presetOptions: {
                    timeRange: timeRange,
                    dataTypes: ['temperature', 'humidity', 'water_usage'],
                    reportFormat: 'pdf'
                }
            }
        });
    };

    return(
        <Card
            title="Environmental Reports"
            extra={
                <Tag color="green">
                    <LineChartOutlined /> Data Analysis
                </Tag>
            }
            style={{ borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backgroundColor: '#F1F8E9', ...style}}
            headStyle={{backgroundColor: '#388E3C', color: 'white', borderTopLeftRadius: '8px', borderTopRightRadius: '8px'}}
        >
            <Paragraph style={{ color: '#333'}}>
                Generate detailed reports on your environmental data to track trends,
                identify anomalies, and make informed decisions to reduce your carbon footprint
            </Paragraph>

            <Space direction="vertical" style={{width: '100%', marginTop: '16px'}}>
                <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={goToReportGenerator}
                    block
                    style={{
                        backgroundColor: '#4CAF50',
                        borderColor: '#388E3C',
                        height: '40px',
                        borderRadius: '4px'
                    }}
                >
                    Advanced Report Generator
                </Button>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={showQuickReport}
                    block
                    style={{
                        borderColor: '#4CAF50',
                        color: '#388E3C',
                        height: '40px',
                        borderRadius: '4px'
                    }}
                >
                    Quick Report
                </Button>
            </Space>

            <Modal
                title={
                    <div style={{ color: '#388E3C', fontWeight: 'bold'}}>
                        Generate Quick Report
                    </div>
                }
                open={quickReportVisible}
                onOk={handleQuickReport}
                onCancel={() => setQuickReportVisible(false)}
                okButtonProps={{
                    style: { backgroundColor: '#4CAF50', borderColor: '#388E3C'}
                }}
                styles={{ backgroundColor: '#F1F8E9'}}
                style={{ top: 20}}
            >
                <Paragraph>
                    Generate a quick report with common environmental metrics,
                    This report will include temperature,humidity, and water usage data.
                </Paragraph>
                <div style={{marginBottom: 16}}>
                    <Title level={5} style={{ color: '#388E3C' }}>Time Range:</Title>
                    <Select
                        defaultValue="daily"
                        style={{width: '100%'}}
                        onChange={(value) => setTimeRange(value)}
                        dropdownStyle={{ backgroundColor: '#F1F8E9'}}
                        options={[
                            {value: 'daily', label: 'Daily (Last 24 hours)'},
                            {value: 'weekly', label: 'Weekly (Last 7 days)'},
                            {value: 'monthly', label: 'Monthly (Last 30 days)'}
                        ]}
                    />
                       
                </div>
            </Modal>
        </Card>
    );
};

export default ReportCard;