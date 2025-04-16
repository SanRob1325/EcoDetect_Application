import React, { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Switch, Button, message, Divider } from 'antd';
import { SettingOutlined, SaveOutlined } from '@ant-design/icons';
import apiService from './apiService';
//Settings page inspiration:https://plainenglish.io/blog/how-to-build-a-user-settings-page
//State to hold the settings for temperature,humidity,CO2 and notification preferences
const SettingsPage = () => {

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                // Fetch thresholds
                const thresholdResponse = await apiService.getThresholds();
                // Fetch notification preferences
                const prefsResponse = await apiService.getNotificationPreferences();

                // Set form values based on API response
                form.setFieldsValue({
                    temperature: {
                        low: thresholdResponse.data.temperature_range[0],
                        high: thresholdResponse.data.temperature_range[1]
                    },
                    humidity: {
                        low: thresholdResponse.data.humidity_range[0],
                        high: thresholdResponse.data.humidity_range[1]
                    },
                    water: {
                        threshold: thresholdResponse.data.flow_rate_threshold || 10
                    },
                    notificationPreferences: {
                        email: prefsResponse.data.email_enabled,
                        sms: prefsResponse.data.sms_enabled,
                        criticalOnly: prefsResponse.data.critical_only
                    }
                });
            } catch (error) {
                console.error('Error fetching settings:', error);
                message.error('Failed to load settings');
            } finally {
                setLoading(false)
            }
        };

        fetchSettings();
    }, [form]);

    const onFinish = async (values) => {
        try {
            setLoading(true);

            // Update thresholds
            await apiService.setThresholds({
                temperature_range: [values.temperature.low, values.temperature.high],
                humidity_range: [values.humidity.low, values.humidity.high],
                flow_rate_threshold: values.water.threshold
            });

            // Update notification preferences
            await apiService.setNotificationPreferences({
                email_enabled: values.notificationPreferences.email,
                sms_enabled: values.notificationPreferences.sms,
                critical_only: values.notificationPreferences.criticalOnly
            })

            message.success('Settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            message.error('Failed to update settings')
        } finally {
            setLoading(false);
        }
    };
    return (
        <Card title={
            <div style={{ color: 'white', display: 'flex', alignItems: 'center' }}>
                <SettingOutlined style={{ marginRight: '8px' }} />
                <span>Settings</span>
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
            loading={loading}
        >
            {/*Form with initial values to set the current settings*/}
            <Form
                form={form}
                layout='vertical'
                onFinish={onFinish}
            >
                <Divider orientation='left' style={{ color: '#388E3C', borderColor: '#AED581', fontWeight: 'bold' }}>
                    Temperature Thresholds
                </Divider>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <Form.Item label="Low Threshold (C)" name={['temperature', 'low']} style={{ flex: 1, minWidth: '200px' }}>
                        <InputNumber min={-50} max={50} style={{ width: '100%' }} controls={{ upIcon: null, downIcon: null }} />
                    </Form.Item>
                    <Form.Item label="High Threshold (C)" name={['temperature', 'high']} style={{ flex: 1, minWidth: '200px' }}>
                        <InputNumber min={-50} max={50} style={{ width: '100%' }} controls={{ upIcon: null, downIcon: null }} />
                    </Form.Item>
                </div>
                <Divider orientation="left" style={{ color: '#388E3C', borderColor: '#AED581', fontWeight: 'bold' }}>
                    Humidity Thresholds
                </Divider>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}></div>
                <Form.Item label="Low Threshold (%)" name={['humidity', 'low']} style={{ flex: 1, minWidth: '200px' }}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} controls={{ upIcon: null, downIcon: null }} />
                </Form.Item>
                <Form.Item label="High Threshold (%)" name={['humidity', 'high']} style={{ flex: 1, minWidth: '200px' }}>
                    <InputNumber min={0} max={100} style={{ width: '100%' }} controls={{ upIcon: null, downIcon: null }} />
                </Form.Item>

                <Divider orientation="left" style={{ color: '#388E3C', borderColor: '#AED581', fontWeight: 'bold' }}>Water Usage Threshold</Divider>
                <Form.Item label="Maximum Flow Rate (L/min)" name={['water', 'threshold']}>
                    <InputNumber min={0} max={20} style={{ width: '100%', maxWidth: '300px' }} controls={{ upIcon: null, downIcon: null }} />
                </Form.Item>

                <Divider orientation="left" style={{ color: '#388E3C', borderColor: '#AED581', fontWeight: 'bold' }}>
                    Notification Preferences
                </Divider>
                <div style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '16px'
                }}>
                    <Form.Item label="Email Notifications" name={['notificationPreferences', 'email']} valuePropName='checked' style={{ marginBottom: '12px' }}>
                        <Switch
                            checkedChildren="On"
                            unCheckedChildren="Off"
                            style={{ backgroundColor: '#4CAF50' }}
                        />
                    </Form.Item>
                    <Form.Item label="SMS Notifications" name={['notificationPreferences', 'sms']} valuePropName='checked' style={{ marginBottom: '12px' }}>
                        <Switch
                            checkedChildren="On"
                            unCheckedChildren="Off"
                            style={{ backgroundColor: '#4CAF50' }}
                        />
                    </Form.Item>
                    <Form.Item name={['notificationPreferences', 'criticalOnly']} valuePropName='checked' label="Critical Alerts Only">
                        <Switch
                            checkedChildren="On"
                            unCheckedChildren="Off"
                            style={{ backgroundColor: '#4CAF50' }}
                        />
                    </Form.Item>
                </div>

                <Form.Item>
                    <Button type="primary" htmlType='submit' icon={<SaveOutlined />} style={{ backgroundColor: '#4CAF50', borderColor: '#388E3C', height: '40px', borderRadius: '4px' }}
                        loading={loading}
                    >
                        Save Settings
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default SettingsPage;