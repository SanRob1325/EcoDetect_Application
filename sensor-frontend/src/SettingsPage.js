import React, {useState} from 'react';
import {Card, Form, InputNumber,Switch, Button} from 'antd';

//Settings page inspiration:https://plainenglish.io/blog/how-to-build-a-user-settings-page
//State to hold the settings for temperature,humidity,CO2 and notification preferences
const SettingsPage = () => {
    const [settings,setSettings] = useState({
        temperature: {low:20, high: 25},
        humiidity: {low: 30, high: 30},
        co2: {max: 1000},
        notificationPreferences: {email: true, sms: true},
    });
    // function to handle submission and update settings state
    const onFinish = (values) => {
        console.log('Updated settings:', values); //logs updated values
        setSettings(values); // update state with new values
    };

    return(
        <Card title="Settings" style={{margin: '16px'}}>
            {/*Form with initial values to set the current settings*/}
            <Form
                initialValues={settings}
                layout='vertical'
                onFinish={onFinish}
            >
                <Form.Item label="Temperature Low Threshold" name={['temperature', 'low']}>
                    <InputNumber min={-50} max={50} />
                </Form.Item>
                <Form.Item labl="Temperature High Threshold" name={['temperature', 'high']}>
                    <InputNumber min={-50} max={50} />
                </Form.Item>
                <Form.Item label="Humidity Low Threshold" name={['humidity', 'low']}>
                    <InputNumber min={0} max={100} />
                </Form.Item>
                <Form.Item label="Humidity High Threshold" name={['humidity', 'high']}>
                    <InputNumber min={0} max={100} />
                </Form.Item>
                <Form.Item label="CO2 Max Threshold" name={['co2', 'max']}>
                    <InputNumber min={0} max={5000} />
                </Form.Item>
                <Form.Item label="Email Notifications" name={['notificationPreferences', 'email']} valuePropName='checked'>
                    <Switch />
                </Form.Item>
                <Form.Item label="SMS Notifications" name={['notificationPreferences', 'sms']} valuePropName='checked'>
                    <Switch />
                </Form.Item>
                <Form.Item>
                    <Button type="primary" htmlType='submit'>Save Settings</Button>
                </Form.Item>
            </Form>
        </Card>
    );
};

export default SettingsPage;