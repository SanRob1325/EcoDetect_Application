import React, { useState} from 'react';
import {Card, Button, Modal, Select, Space, Tag, Typography} from 'antd';
import {FileTextOutlined, DownloadOutlined, LineChartOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const {Title, Paragraph} = Typography;
const {Option} = Select;

const ReportCard = () => {
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
            onDragExitCapture={
                <Tag color="green">
                    <LineChartOutlined /> Data Analysis
                </Tag>
            }
            style={{margin: '16px'}}
        >
            <Paragraph>
                Generate detailed reports on your environmental data to track trends,
                identify anomalies, and make informed decisions to reduce your carbon footprint
            </Paragraph>

            <Space direction="vertical" style={{width: '100%'}}>
                <Button
                    type="primary"
                    icon={<FileTextOutlined />}
                    onClick={goToReportGenerator}
                    block
                >
                    Advanced Report Generator
                </Button>
                <Button
                    icon={<DownloadOutlined />}
                    onClick={showQuickReport}
                    block
                >
                    Quick Report
                </Button>
            </Space>

            <Modal
                title="Generate Quick Report"
                open={quickReportVisible}
                onOk={handleQuickReport}
                onCancel={() => setQuickReportVisible(false)}
            >
                <Paragraph>
                    Generate a quick report with common environmental metrics,
                    This report will include temperature,humidity, and water usage data.
                </Paragraph>
                <div style={{marginBottom: 16}}>
                    <Title level={5}>Time Range:</Title>
                    <Select
                        defaultValue="daily"
                        style={{width: '100%'}}
                        onChange={(value) => setTimeRange(value)}
                    >
                        <Option value="daily">Daily (LAst 24 hours)</Option>
                        <Option value="weekly">Weekly (Last 7 days)</Option>
                        <Option value="monthly">Monthly (Last 30 days)</Option>
                    </Select>
                </div>
            </Modal>
        </Card>
    );
};

export default ReportCard;