import React, { useState } from 'react';
import { forgotPassword, forgotPasswordSubmit } from './authUtils';
import {Card, Form, Input, Button, Alert, Steps, Typography} from 'antd';
import { MailOutlined, LockOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const {Title, Text} = Typography;

const ForgotPassword = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [email, setEmail] = useState('');
    const [currentStep, setCurrentStep] = useState(0);
    const navigate = useNavigate();

    const requestCode = async (values) => {
        setLoading(true);
        setError(null);
        setEmail(values.email);

        try {
            await forgotPassword({username: values.email});
            setCurrentStep(1);
            setSuccess('Verification code sent to your email.');
        }catch (err) {
            console.error('Error requesting password reset:', err);
            setError(err.message || 'Error requesting password reset');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (values) => {
        setLoading(true);
        setError(null);

        try{
            await forgotPasswordSubmit({ username: email, confirmationCode: values.code, newPassword: values.newPassword});
            setSuccess('Password has been reset successfully');
            // Redirected to login after 3 seconds
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            console.error('Error resetting password:', err);
            setError(err.message || 'Error resetting password')
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
            <Card style={{ width: 400}}>
                <Title level={2} style={{textAlign: 'center'}}> Reset Password</Title>
                <Steps current={currentStep} style={{marginBottom: 24}}>
                    <Steps.Step title="Request" description="Get code" />
                    <Steps.Step title="Reset" description="New password"/>
                </Steps>

                {error && <Alert message={error} type="error" style={{ marginBottom: 16}} />}
                {success && <Alert message={success} type="success" style={{marginBottom: 16}}/>}

                {currentStep === 0 ? (
                    <Form name="forgotPasswordRequest" onFinish={requestCode} layout="vertical">
                        <Form.Item
                            label="Email"
                            name="email"
                            rules={[
                                { required: true, message: 'Please input your email'},
                                { type: 'email', message: 'Please enter a valid email' }
                            ]}
                        >
                            <Input prefix={<MailOutlined />} placeholder="Email" />
                        </Form.Item>

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading}>
                                Send Reset Code
                            </Button>
                        </Form.Item>

                        <Form.Item>
                            <Button type="link" onClick={() => navigate('/login')} style={{ padding: 0}}>
                                Back to Login
                            </Button>
                        </Form.Item>
                    </Form>
                ) : (
                    <Form name="resetPassword" onFinish={resetPassword} layout="vertical">
                        <Form.Item
                            label="Verification Code"
                            name="code"
                            rules={[{ required: true, message: 'Please enter verification code'}]}
                        >
                            <Input placeholder="Enter code from email" />
                        </Form.Item>

                        <Form.Item
                            label="New Password"
                            name="newPassword"
                            rules={[
                                { required: true, message: 'Please input new password'},
                                { min: 8, message: 'Password must be at least 8 characters'}
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="New Password" />
                        </Form.Item>

                        <Form.Item
                            label="Confirm New Password"
                            name="confirmPassword"
                            dependencies={['newPassword']}
                            rules={[
                                {required: true, message: 'Please confirm you password'},
                                ({getFieldValue}) => ({
                                    validator(_, value){
                                        if (!value || getFieldValue('newPassword') === value){
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('The two passwords do not match')); 
                                    },
                                }),
                            ]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder="Confirm New Password" />
                            </Form.Item>

                            <Form.Item>
                                <Button type="primary" htmlType='submit' block loading={loading}>
                                    Reset Password
                                </Button>
                            </Form.Item>
                    </Form>
                )}
            </Card>
        </div>
    );
};

export default ForgotPassword;