import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Alert, Typography, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const { Title } = Typography;

const Login = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newPasswordRequired, setNewPasswordRequired] = useState(false);
    const [challengeAttributes, setChallengeAttributes] = useState([]);
    const [userAttributes, setUserAttributes] = useState({});
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || '/';
    const { login, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated){
            console.log('User is authenticated, redirecting to:', from);
            navigate(from, {replace: true});
        }
    }, [isAuthenticated, navigate, from]);
    const onFinish = async (values) => {
        console.log('Form submitted with:', values);
        setLoading(true);
        setError(null);

        try {
            const result = await login({
                email: values.email,
                password: values.password,
                // For new password challenge
                ...(newPasswordRequired ? {
                    newPassword: values.newPassword,
                    requiredAttributes: {
                        family_name: values.familyName,
                        given_name: values.givenName,
                        phone_number: values.phoneNumber
                    }
                } : {})
            });

            if (result.success) {
                console.log('Login successful');
            } else if (result.requiresNewPassword) {
                console.log('New password required');
                setNewPasswordRequired(true);
                
                // Safely parse user attributes
                let parsedUserAttributes = {};
                try {
                    parsedUserAttributes = typeof result.challengeParameters === 'string' 
                        ? JSON.parse(result.challengeParameters || '{}')
                        : result.challengeParameters || {};
                } catch {
                    parsedUserAttributes = {};
                }
                setUserAttributes(parsedUserAttributes);

                // Determine required attributes
                let requiredAttrs = [];
                try {
                    // Check if requiredAttributes is a JSON string or already an array
                    requiredAttrs = typeof result.requiredAttributes === 'string'
                        ? JSON.parse(result.requiredAttributes)
                        : result.requiredAttributes || [];

                    // Remove 'userAttributes.' prefix if present
                    requiredAttrs = requiredAttrs.map(attr =>
                        attr.replace('userAttributes.', '')
                    );
                } catch {
                    requiredAttrs = [];
                }

                setChallengeAttributes(requiredAttrs);
                setError('New password and additional information are required');
            } else {
                setError(result.error || 'Login failed');
            }
        } catch (err) {
            console.error('Error during login:', err);
            setError(err.message || 'Invalid email or password, please try again');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigate('/forgot-password');
    };

    // Render new password form for first-time login
    if (newPasswordRequired) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Card style={{ width: 400 }}>
                    <Title level={2} style={{ textAlign: 'center' }}>Set New Password</Title>
                    {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
                    <Form
                        name="new-password"
                        onFinish={onFinish}
                        layout="vertical"
                        initialValues={{
                            email: userAttributes.email
                        }}
                    >
                        <Form.Item
                            label="Email"
                            name="email"
                            rules={[{ required: true }]}
                        >
                            <Input disabled prefix={<UserOutlined />} />
                        </Form.Item>

                        <Form.Item
                            label="New Password"
                            name="newPassword"
                            rules={[
                                { required: true, message: 'Please input your new password' },
                                { min: 8, message: 'Password must be at least 8 characters' }
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder='New Password' />
                        </Form.Item>

                        {/* Dynamically render required attribute inputs */}
                        {challengeAttributes.includes('family_name') && (
                            <Form.Item
                                label="Family Name"
                                name="familyName"
                                rules={[{ required: true, message: 'Please input your family name' }]}
                            >
                                <Input placeholder='Family Name' />
                            </Form.Item>
                        )}

                        {challengeAttributes.includes('given_name') && (
                            <Form.Item
                                label="Given Name"
                                name="givenName"
                                rules={[{ required: true, message: 'Please input your given name' }]}
                            >
                                <Input placeholder='Given Name' />
                            </Form.Item>
                        )}

                        {challengeAttributes.includes('phone_number') && (
                            <Form.Item
                                label="Phone Number"
                                name="phoneNumber"
                                rules={[{ required: true, message: 'Please input your phone number' }]}
                            >
                                <Input placeholder='Phone Number' />
                            </Form.Item>
                        )}

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                            >
                                Set New Password
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </div>
        );
    }

    // Regular login form
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Card style={{ width: 400 }}>
                <Title level={2} style={{ textAlign: 'center' }}>EcoDetect Login</Title>
                {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}
                <Form
                    name="login"
                    onFinish={onFinish}
                    layout="vertical"
                >
                    <Form.Item
                        label="Email"
                        name="email"
                        rules={[
                            { required: true, message: 'Please input your email' },
                            { type: 'email', message: 'Please enter a valid email' }
                        ]}
                    >
                        <Input prefix={<UserOutlined />} placeholder='Email' />
                    </Form.Item>
                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: 'Please input your password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder='Password' />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            Log in
                        </Button>
                    </Form.Item>
                    <Form.Item>
                        <Button type="link" onClick={handleForgotPassword} style={{ padding: 0 }}>
                            Forgot Password?
                        </Button>
                        <Button type="link" onClick={() => navigate('/signup')} style={{ float: 'right', padding: 0 }}>
                            Sign Up
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;