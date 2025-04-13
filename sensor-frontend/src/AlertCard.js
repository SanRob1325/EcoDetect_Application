import React, {useEffect, useState} from 'react';
import {Card, Form, InputNumber,Switch, Button, Slider, message, notification} from 'antd';
import apiService from './apiService';
//Settings page inspiration:https://plainenglish.io/blog/how-to-build-a-user-settings-page
//State to hold the settings for temperature,humidity,CO2 and notification preferences
const SettingsPage = () => {

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try{
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
            } catch (error){
                console.error('Error fetching settings:', error);
                message.error('Failed to load settings');
            } finally {
                setLoading(false)
            }
        };

        fetchSettings();
    }, [form]);

    const onFinish = async (values) => {
        try{
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
        }catch (error){
            console.error('Error updating settings:', error);
            message.error('Failed to update settings')
        } finally {
            setLoading(false);
        }
    };
    return(
        <Card title="Settings" style={{margin: '16px'}} loading={loading}>
            {/*Form with initial values to set the current settings*/}
            <Form
                form={form}
                layout='vertical'
                onFinish={onFinish}
            >
                <h3>Temperature Thresholds</h3>
                <Form.Item label="Low Threshold (C)" name={['temperature', 'low']}>
                    <InputNumber min={-50} max={50} />
                </Form.Item>
                <Form.Item label="High Threshold (C)" name={['temperature', 'high']}>
                    <InputNumber min={-50} max={50} />
                </Form.Item>

                <h3>Humidity Thresholds</h3>
                <Form.Item label="Low Threshold (%)" name={['humidity', 'low']}>
                    <InputNumber min={0} max={100} />
                </Form.Item>
                <Form.Item label="High Threshold (%)" name={['humidity', 'high']}>
                    <InputNumber min={0} max={100} />
                </Form.Item>
                
                <h3>Water Usage Threshold</h3>
                <Form.Item label="Maximum Flow Rate (L/min)" name={['water', 'threshold']}>
                    <InputNumber min={0} max={20} />
                </Form.Item>

                <h3>Notification Preferences</h3>
                <Form.Item label="Email Notifications" name={['notificationPreferences', 'email']} valuePropName='checked'>
                    <Switch />
                </Form.Item>
                <Form.Item label="SMS Notifications" name={['notificationPreferences', 'sms']} valuePropName='checked'>
                    <Switch />
                </Form.Item>
                <Form.Item name={['notificationPreferences', 'criticalOnly']} valuePropName='checked' label="Critical Alerts Only">
                    <Switch />
                </Form.Item>

                <Form.Item>
                    <Button type="primary" htmlType='submit'>
                        Save Settings
                    </Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default SettingsPage;