import React, { useState,useEffect} from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Modal, message} from 'antd';
import { DashboardOutlined,SettingOutlined, LogoutOutlined, UserOutlined, LineOutlined} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom';
import  { signOut, currentAuthenticatedUser} from './authUtils';

const { Header, Sider, Content } = Layout;

const AppLayout = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [username, setUsername] = useState('');
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState(false); // Set the application state
    const navigate = useNavigate();
    const location = useLocation();

    // Get user info on componnent mount
    useEffect(() => {
        const getUserInfo = async () => {
            try{
                const user = await currentAuthenticatedUser();
                setUsername(user.attributes.name || user.username);
            } catch (error){
                console.error('Error getting user info:', error);
            }
        };

        getUserInfo();
    }, []);

    // Auto logout for inactivity within 30 minutes
    useEffect(() => {
        const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

        const handleActivity = () => {
            setLastActivity(Date.now());
        };

        // Add event listeners
        activityEvents.forEach(event => {
            document.addEventListener(event, handleActivity);
        });

        // Check for inactivity every minute
        const inactivityInterval = setInterval(() => {
            const inactiveTime = Date.now() - lastActivity;
            const inactiveTimeout = 30 * 60 * 1000;

            if (inactiveTime > inactiveTimeout) {
                handleAutoLogout();
            }
        }, 60000); // Check every minute

        return () => {
            // Clean up event listeners
            activityEvents.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });
            clearInterval(inactivityInterval);
        };
    }, [lastActivity]);

    const handleAutoLogout = async () => {
        try{
            await signOut();
            navigate('/login');
            message.info('You have logged out due to inactivity, please login again');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleLogout = async () => {
        if (unsavedChanges) {
            setLogoutModalVisible(true);
        } else{
            await performLogout();
        }
    };

    const performLogout = async () => {
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
            message.error('Error signing out. Please try again.')
        }
    };

    const userMenu = (
        <Menu>
            <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
                Account Settings
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
                Logout
            </Menu.Item>
        </Menu>
    );

    return (
        <Layout style={{ minHeight: '100vh'}}>
            <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
                <div className="logo" style={{ height: 32, margin: 16, background: 'rgba(255,255,255, 0.3'}} />
                <Menu theme="dark" selectedKeys={[location.pathname]} mode="inline">
                    <Menu.Item key="/dashboard" icon={<DashboardOutlined />} onClick={() => navigate('/dashboard')}>
                        Dashboard
                    </Menu.Item>
                    <Menu.Item key="/reports" icon={<LineOutlined />} onClick={() => navigate('/reports')}>
                        Report
                    </Menu.Item>
                    {/* To add other menu items*/}
                </Menu>
            </Sider>
            <Layout className="site-layout">
                <Header className="site-layout-background" style={{ padding: 0, background: '#fff'}}>
                    <div style={{float: 'right', marginRight: 24}}>
                        <Dropdown overlay={userMenu} placement="bottomRight">
                            <div style={{ cursor: 'pointer'}}>
                                <Avatar icon={<UserOutlined />} style={{ marginRight: 8}} />
                                <span>{username}</span>
                            </div>
                        </Dropdown>
                    </div>
                </Header>
                <Content style={{ margin: '16px'}}>
                    {children}
                </Content>
            </Layout>

            {/* Confirm Logout Modal*/}
            <Modal
                title="Confirm Logout"
                visible={logoutModalVisible}
                onOk={performLogout}
                onCancel={() => setLogoutModalVisible(false)}
            >
                <p>You have unsaved changes. Are you sure you want to logout?</p>    
            </Modal> 
        </Layout>
    );
};

export default AppLayout;

