import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Alert, Typography} from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import ecoBackground from './Ecofriendly_background.jpg'
import logoImg from './Icon-Only-Color.png';
const { Text } = Typography;

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
        if (isAuthenticated) {
            console.log('User is authenticated, redirecting to:', from);
            navigate(from, { replace: true });
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

    // Shared card styles are created for consistency
    const cardStyle = {
        width: 400,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    }
    const cardHeadStyle = {
        background: '#388E3C',
        color: 'white',
        textAlign: 'center',
        padding: '20px',
        fontSize: '24px',
        fontWeight: 'bold',
        borderBottom: '1px solid #4CAF50'
    }

    const buttonStyle = {
        backgroundColor: '#4CAF50',
        borderColor: '#388E3C',
        height: '40px',
        borderRadius: '4px'
    };
    // Render new password form for first-time login
    if (newPasswordRequired) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: `url(${ecoBackground}) center/cover no-repeat`, position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(241, 248, 233, 0.8)' }}></div>
                <Card style={{ ...cardStyle, zIndex: 1, background: '#FFF' }}>

                    <div style={cardHeadStyle}>
                        <LoginOutlined style={{ fontSize: '28px', marginRight: '8px' }} />
                        Set New Password
                    </div>
                    <div style={{ padding: '24px' }}>
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
                                <Input.Password prefix={<LockOutlined />} placeholder='New Password' style={{ borderColor: '#AED581' }} />
                            </Form.Item>

                            {/* Dynamically render required attribute inputs */}
                            {challengeAttributes.includes('family_name') && (
                                <Form.Item
                                    label="Family Name"
                                    name="familyName"
                                    rules={[{ required: true, message: 'Please input your family name' }]}
                                >
                                    <Input placeholder='Family Name' style={{ borderColor: '#AED581' }} />
                                </Form.Item>
                            )}

                            {challengeAttributes.includes('given_name') && (
                                <Form.Item
                                    label="Given Name"
                                    name="givenName"
                                    rules={[{ required: true, message: 'Please input your given name' }]}
                                >
                                    <Input placeholder='Given Name' style={{ borderColor: '#AED581' }} />
                                </Form.Item>
                            )}

                            {challengeAttributes.includes('phone_number') && (
                                <Form.Item
                                    label="Phone Number"
                                    name="phoneNumber"
                                    rules={[{ required: true, message: 'Please input your phone number' }]}
                                >
                                    <Input placeholder='Phone Number' style={{ borderColor: '#AED581' }} />
                                </Form.Item>
                            )}

                            <Form.Item style={{ marginTop: '24px' }}>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    block
                                    loading={loading}
                                    style={buttonStyle}
                                >
                                    Set New Password
                                </Button>
                            </Form.Item>
                        </Form>
                    </div>
                </Card>
            </div>
        );
    }

    // Regular login form
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: `url(${ecoBackground}) center/cover no-repeat`, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(241, 248, 233, 0.8)' }}></div>
            <Card style={{ ...cardStyle, zIndex: 1, backgroundColor: '#FFF' }}>
                <div style={cardHeadStyle}>
                    <img
                        src={logoImg}
                        alt="EcoDetect Logo"
                        style={{
                            height: '40px',
                            marginRight: '10px',
                            verticalAlign: 'middle'
                        }}
                    />
                    EcoDetect Login
                </div>
                <div style={{ padding: '24px' }}>
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
                            <Input prefix={<UserOutlined />} placeholder='Email' style={{ borderColor: '#AED581'}} />
                        </Form.Item>
                        <Form.Item
                            label="Password"
                            name="password"
                            rules={[{ required: true, message: 'Please input your password' }]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder='Password' style={{ borderColor: '#AED581' }} />
                        </Form.Item>
                        <Form.Item style={{ marginTop: '24px' }}>
                            <Button type="primary" htmlType="submit" block loading={loading} style={buttonStyle}>
                                Log in
                            </Button>
                        </Form.Item>
                  
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                                <Button type="link" onClick={handleForgotPassword} style={{ padding: 0, color: '#388E3C' }}>
                                    Forgot Password?
                                </Button>
                                <Button type="link" onClick={() => navigate('/signup')} style={{ padding: 0, color: '#388E3C' }}>
                                    Sign Up
                                </Button>
                            </div>
                    </Form>
                </div>
                <div style={{
                    padding: '12px 24px',
                    backgroundColor: '#F1F8E9',
                    borderTop: '1px solid #E8F5E9',
                    textAlign: 'center'
                }}>
                    <Text type="secondary">
                        Monitoring for a greener environment
                    </Text>
                </div>
            </Card>
        </div>
    );
};

export default Login;