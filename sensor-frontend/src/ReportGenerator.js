import React, {useState, useEffect} from 'react';
import axios from 'axios';
import {Card, Form, Select, Button, Checkbox, DatePicker, message, Spin, Tabs, Alert, Typography, Space, Modal, Divider, Input, Empty} from 'antd'
import {DownloadOutlined, FileTextOutlined, MailOutlined, LineChartOutlined} from '@ant-design/icons';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const {TabPane} = Tabs;

const ReportGenerator = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Report configuration
    const [timeRange, setTimeRange] = useState('daily');
    const [dataTypes, setDataTypes] = useState(['temperature']);
    const [reportFormat, setReportFormat] = useState('pdf');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [email, setEmail] = useState('');

    // Preview data
    const [previewData, setPreviewData] = useState(null);
    const [previewVisible, setPreviewVisible] = useState(false);

    // Report URL
    const [reportUrl, setReportUrl] = useState('');
    const [reportGenerated, setReportGenerated] = useState(false);

    // Reset custom date rangewhen time range changes
    useEffect(() => {
        if (timeRange !== 'custom'){
            setCustomDateRange(null);
            form.setFieldsValue({ customDateRange: null});
        }
    }, [timeRange, form]);

    const handlePreview = async() =>{
        setPreviewLoading(true);

        try{
            // Validate form first
            await form.validateFields();

            // Prepare request payload
            const payload = {
                time_range: timeRange,
                data_types: dataTypes,
                format: 'json', // ALways JSON in preview
             };
             // Add custom date range if selected
             if (timeRange === 'custom' && customDateRange){
                payload.custom_start = customDateRange[0].toISOString()
                payload.custom_end = customDateRange[1].toISOString();
             }

             // Send request to preview report
             const response = await axios.post('http://localhost:5000/api/reports/preview', payload)

             if (response.data.success) {
                console.log('Preview data recieved:', response.data.data);
                setPreviewData(response.data.data);
                setPreviewVisible(true);

             }else{
                message.warning(response.data.message || 'No data available for preview')
             }
        } catch(error){
            console.error('Error previewing report:', error);

            if(error.response?.data?.error){
                // Show validation errors from the server
                message.error(error.response.data.errors.join(', '));
            } else {
                message.error('Failed to generate preview')
            }
        } finally {
            setPreviewLoading(false);
        }
    }
    // Handle form submission
    const onFinish = async (values) => {
        setLoading(true);

        try {
            // Prepare request payload
            const payload ={
                time_range: timeRange,
                data_types: dataTypes,
                format: reportFormat,
                email: email || undefined,
            };

            // Add custom date range if selected
            if (timeRange === 'custom' && customDateRange) {
                payload.custom_start = customDateRange[0].toISOString();
                payload.custom_end = customDateRange[1].toISOString();
            }

            // Send request to generate report
            const response = await axios.post('http://localhost:5000/api/reports', payload);

            if (response.data.success) {
                setReportUrl(response.data.download_url);
                setReportGenerated(true);
                message.success('Report generated successfully')

                if(email && response.data.email_sent){
                    message.info(`Report has been sent to ${email}`)
                }
            } else {
                message.warning(response.data.message || 'Failed to generate report');
            }
        } catch (error){
            console.error('Error generating report:', error);
            message.error('An error occurred while gnerating the report')
        } finally {
            setLoading(false);
        }
    }

    // Handle time range change
    const handleTimeRangeChange = (value) => {
        setTimeRange(value);

        // Adjust form based on time range 
        if (value === 'custom'){
            form.setFieldsValue({
                customDateRange: [moment().subtract(7, 'days'), moment()]
            });
            setCustomDateRange([moment().subtract(7, 'days'), moment()])
        } else{
            form.setFieldsValue({ customDateRange: null});
            setCustomDateRange(null);
        }
    };

    // Format preview data fro display
    const formatPreviewStats = (stats, dataType) => {
        if (!stats || !stats[dataType]) return 'No data available';

        const { min, max, avg, count} = stats[dataType];
        return (
            <div>
                <p><strong>Min:</strong> {typeof min == 'number' ? min.toFixed(2) : 'N/A'}</p>
                <p><strong>Max:</strong> {typeof max == 'number' ? max.toFixed(2) : 'N/A'}</p>
                <p><strong>Average:</strong> {typeof avg == 'number' ? avg.toFixed(2) : 'N/A'}</p>
                <p><strong>Data points:</strong>{count}</p>
            </div>
        );
    };

    return (
        <Card title="Environmental Data Report Generator" style={{margin: '16px'}}>
            <Form
                form={form}
                layout='vertical'
                onFinish={onFinish}
                initialValues={{
                    timeRange: 'daily',
                    dataTypes: ['temperature'],
                    reportFormat: 'pdf',
                    email: '',
                }}
            >
                <Form.Item
                    label="Time Range"
                    name="timeRange"
                    rules={[{ required: true, message: 'Please select a time range' }]}
                >
                    <Select onChange={handleTimeRangeChange} value={timeRange}>
                        <Option value="daily">Daily (Last 24 hours)</Option>
                        <Option value="weekly">Weekly (Last 7 days)</Option>
                        <Option value="monthly">Monthly (Last 30 days)</Option>
                        <Option value="custom">Custom Range</Option>
                    </Select>
                </Form.Item>
                {timeRange === 'custom' && (
                    <Form.Item
                        label="Custom Date Range"
                        name="customDateRange"
                        rules={[{ required: true, message: 'Please select a date range'}]}

                    >
                        <RangePicker
                            onChange={(dates) => setCustomDateRange(dates)}
                            style={{ width: '100%'}}
                            disabledDate={(current) => current && current > moment().endOf('day')}
                        />
                    </Form.Item>
                )}
                <Form.Item
                    label="Data Types"
                    name="dataTypes"
                    rules={[{ required: true, message: 'Please select at least one type'}]}
                >
                    <Checkbox.Group
                        onChange={(values) => setDataTypes(values)}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px'}}
                        >
                            <Checkbox value="temperature">Temperature</Checkbox>
                            <Checkbox value="humidity">Humidity</Checkbox>
                            <Checkbox value="pressure">Pressure</Checkbox>
                            <Checkbox value="water_usage">Water Usage</Checkbox>
                            <Checkbox value="all">All Available data_types</Checkbox>
                        </Checkbox.Group>
                </Form.Item>
                <Form.Item
                    label="Report Format"
                    name="reportFormat"
                    rules={[{ required: true, message: 'Please select a report format'}]}
                >
                    <Select onChange={(value) => setReportFormat(value)} value={reportFormat}>
                        <Option value="pdf">PDF Document</Option>
                        <Option value="csv">CSV Spreadsheet</Option>
                        <Option value="json">JSON Data</Option>
                    </Select>
                </Form.Item>
                <Form.Item
                    label="Email Report (Optional)"
                    name="email"
                    rules={[
                        {type: 'email',
                            message: 'Please enter a valid email address'
                        }

                    ]}
                >
                    <Input
                        placeholder="Enter email address"
                        onChange={(e) => setEmail(e.target.value)}
                        prefix={<MailOutlined />}
                    />
                </Form.Item>
                <Divider />

                <Form.Item>
                    <Space>
                        <Button
                            type="primary"
                            icon={<LineChartOutlined />}
                            onClick={handlePreview}
                            loading={previewLoading}
                        >
                            Preview Report
                        </Button>

                        <Button
                            type="primary"
                            icon={<FileTextOutlined />}
                            htmlType="submit"
                            loading={loading}
                        >
                            Generate Report
                        </Button>

                        {reportGenerated && (
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                href={reportUrl}
                                target="_blank"
                            >
                              Download Report
                            </Button>
                        )}
                    </Space>
                </Form.Item>
                </Form>
                {/* Preview Modal*/}
                <Modal
                        title="Report PReview"
                        visible={previewVisible}
                        onCancel={() => setPreviewVisible(false)}
                        width={800}
                        footer={[
                            <Button key="close" onClick={() => setPreviewVisible(false)}>
                                Close
                            </Button>,
                            <Button
                                key="generate"
                                type="primary"
                                onClick={() => {
                                    setPreviewVisible(false);
                                    form.submit()
                                }}
                            >
                                Generate Full Report
                            </Button>
                        ]}
                >
                    {previewData ? (
                        <Tabs defaultActiveKey="summary">
                            <TabPane tab="Summary" key="summary">
                                <Title level={4}>Report Summary</Title>
                                <Paragraph>
                                    <Text strong>Time Range:</Text> {timeRange === 'custom'
                                    ? `${moment(customDateRange[0]).format('MMM D, YYYY')} to ${moment(customDateRange[1]).format('MMM D, YYYY')}`
                                    : timeRange
                                    }
                                </Paragraph>
                                <Paragraph>
                                    <Text strong>Data Points Analysed:</Text>{previewData.metadata?.data_points || 'N/A'}
                                </Paragraph>

                                {dataTypes.includes('temperature') && (
                                    <div>
                                        <Title level={5}>Temperatature Statistics</Title>
                                        {formatPreviewStats(previewData.summary, 'temperature')}
                                    </div>
                                )}

                                {dataTypes.includes('humidity') && (
                                    <div>
                                        <Title level={5}>Humidity Statistics</Title>
                                        {formatPreviewStats(previewData.summary, 'humidity')}
                                    </div>
                                )}
                                {dataTypes.includes('pressure') && (
                                    <div>
                                        <Title level={5}>Pressure Statistics</Title>
                                        {formatPreviewStats(previewData.summary, 'pressure')}
                                    </div>
                                )}
                                {dataTypes.includes('water_usage') && (
                                    <div>
                                        <Title level={5}>Water Usage Statistics</Title>
                                        {formatPreviewStats(previewData.summary, 'water_usage')}
                                    </div>
                                )}
                            </TabPane>
                            <TabPane tab="Anomalies" key="anomalies">
                                <Title level={4}>Detected Anomalies</Title>
                                {previewData.anomalies && Object.keys(previewData.anomalies).length > 0 ? (
                                    Object.entries(previewData.anomalies).map(([dataType, anomalies]) => (
                                        <div key={dataType}>
                                            <Title level={5}>{dataType.charAt(0).toUpperCase() + dataType.slice(1)} Anomalies</Title>
                                            {anomalies.map((anomaly, index) => (
                                                <Alert
                                                    key={index}
                                                    type="warning"
                                                    message={`Anomaly detected at ${moment(anomaly.timestamp).format('MMM D, YYYY HH:mm')}`}
                                                    description={`Value: ${anomaly.value.toFixed(2)}, Z-Score: ${anomaly.z_score.toFixed(2)}`}
                                                    style={{marginBottom: 8}}
                                                />
                                            ))}
                                        </div>
                                    ))
                                ) : (
                                    <Empty description="No anomalies detected in the selected time range" />       
                                )}
                            </TabPane>
                            <TabPane tab="Alerts" key="alerts">
                                <Title level={4}>Alert History</Title>
                                {previewData.alerts && previewData.alerts.length > 0 ? (
                                    previewData.alerts.map((alert, index) => (
                                        <Alert
                                            key={index}
                                            type={alert.type === 'critical' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
                                            message={`${moment(alert.date).format('MMM D, YYYY HH:mm')}`}
                                            description={alert.message}
                                            style={{marginBottom: 8}}
                                        />
                                    ))
                                ) : (
                                    <Empty description="No Alerts recorded in the selected time range" />
                                )}
                            </TabPane>
                        </Tabs>
                    ) : (
                        <Spin tip="Loading preview data..." />
                    )}
                </Modal>
        </Card>
    );
};

export default ReportGenerator;