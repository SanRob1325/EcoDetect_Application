import React, {useState} from 'react';
import { signUp, confirmSignUp} from './authUtils'
import {Card, Form, Input, Button, Alert, Typography, Select, DatePicker } from 'antd';
import {UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;
const { Option } = Select;

const Signup = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmStep, setConfirmStep] = useState(false);
    const [_, setEmail] = useState('');
    const [username, setUsername] = useState('')
    const navigate = useNavigate(); 

    // Generate a username for the email
    const generateUsername = (emailAddress) => {
        // Remove everythin after the @ symbol with a unique identifier
        const baseUsername = emailAddress.split('@')[0];
        // Add a random number to ensure uniqueness
        const uniqueUsername =  `${baseUsername}_${Math.floor(Math.random() * 10000)}`
        return uniqueUsername;
    }
    const onFinish = async (values) => {
        setLoading(true);
        setError(null);

        try {
            if (confirmStep) {
                // Confirm code
                await confirmSignUp({
                    username:username,
                    confirmationCode:values.code
                });
                navigate('/login');
            } else {

                const generatedUsername = generateUsername(values.email);
                // Initial signup
                setEmail(values.email);
                setUsername(generatedUsername)

                await signUp({
                    username: generatedUsername,
                    password: values.password,
                    options: {
                        userAttributes: {
                            email: values.email,
                            // Split the full name into first and last name
                            given_name: values.firstName,
                            family_name: values.lastName,
                            // Format ithdate as YYYY-MM-DD
                            birthdate: values.birthdate ? values.birthdate.format('YYYY-MM-DD') : '',
                            // Format phone number
                            phone_number: values.phoneNumber ? `+${values.phoneCode}${values.phoneNumber}` : ''
                        }
                    }
                });
                setConfirmStep(true);
            }
        } catch (err) {
            console.error('Error in signup process:', err);
            setError(err.message || 'An error occured during the sign up process')
        } finally{
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
            <Card style={{ width: 400}}>
                <Title level={2} style={{textAlign: 'center'}}>
                    {confirmStep ? ' Confirm Registration' : 'Create an Account'}
                </Title>

                {error && <Alert message={error} type="error" style={{ marginBottom: 16}} />}

                <Form
                    name="signup"
                    onFinish={onFinish}
                    layout="vertical"
                >
                    {!confirmStep ? (
                        <>
                            <Form.Item
                                label="Email"
                                name="email"
                                rules={[
                                    { required: true, message: 'Please input you email'},
                                    { type: 'email', message: 'Please enter valid email'}
                                ]}
                            >
                                <Input prefix={<MailOutlined />} placeholder="Email" />
                            </Form.Item>

                            <Form.Item
                                label="First Name"
                                name="firstName"
                                rules={[{ required: true, message: 'Please input you name'}]}
                            >
                                <Input prefix={<UserOutlined />} placeholder="First Name" />
                            </Form.Item>

                            <Form.Item
                                label="Last Name"
                                name="lastName"
                                rules={[{ required: true, message: 'Please input your last name'}]}
                            >
                                <Input prefix={<UserOutlined />} placeholder='Last Name' />
                            </Form.Item>

                            <Form.Item
                                label="Birthdate"
                                name="birthdate"
                                rules={[{ required: true, message: 'Please select your birthdate'}]}
                            >
                                <DatePicker
                                    prefix={<CalendarOutlined />}
                                    style={{ width: '100%'}}
                                    placeholder="Select Birthdate"
                                />
                            </Form.Item>

                            <Form.Item
                                label="Phone Number"
                                style={{ display: 'flex'}}
                            >
                                <Input.Group compact>
                                <Form.Item
                                    name="phoneCode"
                                    noStyle
                                    rules={[{ required: true, message: 'Country code required'}]}
                                
                                >
                                    <Select
                                        style={{ width: '30%'}}
                                        placeholder="Code"
                                    >
                                        <Option value="44">UK (+44)</Option>
                                        <Option value="1">US (+1)</Option>
                                        <Option value="353">Ireland (+353)</Option>
                                    </Select>
                                </Form.Item>
                                <Form.Item
                                    name="phoneNumber"
                                    noStyle
                                    rules={[
                                        { required: true, message: 'Please input your phone number'},
                                        { pattern: /^\d+$/, message: 'Phone number must be numeric'}
                                    ]}
                                >
                                    <Input
                                        prefix={<PhoneOutlined />}
                                        style={{ width: '70%'}}
                                        placeholder='Phone Number'
                                    />
                                    </Form.Item>   
                                </Input.Group>
                            </Form.Item>

                            <Form.Item
                                label="Password"
                                name="password"
                                rules={[
                                    { required: true, message: 'Please input your password'},
                                    { min: 8, message: 'Password must be at least 8 characters' }
                                ]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                            </Form.Item>

                            <Form.Item
                                label="Confirm Password"
                                name="confirmPassword"
                                dependencies={['password']}
                                rules={[
                                    { required: true, message: 'Please confirm password'},
                                    ({ getFieldValue }) => ({
                                        validator(_, value){
                                            if ( !value || getFieldValue('password') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('The two password do no match'))
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder='Confirm Password' />
                            </Form.Item>
                        </>
                    ) : (
                        <Form.Item
                            label="Verification Code"
                            name="code"
                            rules={[{ required: true, message: 'Please enter the verification code to your email'}]}
                        >
                            <Input placeholder="Enter 6 digit code"/>
                        </Form.Item>
                    )}
                    <Form.Item>
                        <Button type="primary" htmlType="submit" block loading={loading}>
                            {confirmStep ? 'Verify Account' : 'Sign Up'}
                        </Button>
                    </Form.Item>

                    {!confirmStep && (
                        <Form.Item>
                            <Button type="link" onClick={() => navigate('/login')} style={{ padding: 0}}>
                                Already have an account? Log in
                            </Button>
                        </Form.Item>
                    )}
                </Form>
            </Card>
        </div>
    );
};

export default Signup;

