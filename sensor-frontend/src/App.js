import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { Dropdown, Layout, Menu, Typography, Avatar, message, Spin} from 'antd';
import {UserOutlined, LogoutOutlined} from '@ant-design/icons'
import './App.css';

import AIAssistant from './AIAssistant';
import Dashboard from './Dashboard'
import NoticeBoard from './NoticeBoard';
import SettingsPage from './SettingsPage';
import Alerts from './Alerts';
import logo from './Icon-Only-Black.png'
import ReportGenerator from './ReportGenerator';
import RoomMonitor from './RoomMonitor';
import VehicleMovement from './VehicleMovement';

// Authentication components
import Login from './Login';
import Signup from './Signup';
import ForgotPassword from './ForgotPassword';
import ProtectedRoute from './ProtectedRoute';
import {signOut } from './authUtils';
import { AuthProvider,useAuth } from './AuthContext';
const { Header, Content, Sider } = Layout;

const { Title } = Typography;

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const {user, isAuthenticated, loading, logout} = useAuth();
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    if (!loading) {
      setIsLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    console.log('Auth stat in AppContent:', {isAuthenticated, loading, user});
  }, [isAuthenticated, loading, user])

  useEffect (() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    // Add event listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    // Check for inactivity every miniute
    const inactivityInterval = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      const inactiveTimeout = 30 * 60 * 1000; // For 30 minutes

      if (inactiveTime > inactiveTimeout){
        handleLogout(true);
      }
    }, 60000); // check every minute

    return () => {
      // Cleanup event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(inactivityInterval);
    };
  }, [isAuthenticated, lastActivity]);

  const handleLogout = async (isAutoLogout = false) => {
    try{
      await signOut();
      logout()

      if (isAutoLogout) {
        message.info('You have been logged out because of inactivity, please login again')
      }
    } catch (error){
      console.error('Error signing out:', error);
    }
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />}>
        <Link to="/settings">Profile</Link>
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={() => handleLogout()}>
        Logout
      </Menu.Item>
    </Menu>
  );

  // If its still loading it should only show this spinner
  if (isLoading){
    return(
      <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh'}}>
        <Spin size="large" />
      </div>
    )
  }

  // If not authenticated show the auth routes
  
  return (
    <Router>
       {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <Layout style={{ minHeight: '100vh' }}>
        <Sider width={250} className="site-layout-background">
          <div style={{ padding: '16px', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
            <img src={logo} alt="EcoDetect Logo" className='logo-top-right'></img>
            EcoDetect Home Dashboard
          </div>
          <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%', borderRight: 0 }}>
            <Menu.Item key="1"><Link to="/">Dashboard</Link></Menu.Item>
            <Menu.Item key="2"><Link to="/ai-assistant">AI Assistant Predictive Analysis</Link></Menu.Item>
            <Menu.Item key="3"><Link to="/notice-board">Notice Board</Link></Menu.Item>
            <Menu.Item key="4"><Link to="/alerts">Alerts</Link></Menu.Item>
            <Menu.Item key="5"><Link to="/settings">Settings</Link></Menu.Item>
            <Menu.Item key="6"><Link to="/reports">Reports</Link></Menu.Item>
            <Menu.Item key="7"><Link to="/rooms">Room Monitoring</Link></Menu.Item>
            <Menu.Item key="8"><Link to="/vehicle">Vehicle Monitoring</Link></Menu.Item>
          </Menu>
        </Sider>
        <Layout>
          <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2}>Home Climate Dashboard</Title>
            <div style={{ display: 'flex', alignItems: 'center'}}>
            <Dropdown overlay={userMenu} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                <Avatar icon={<UserOutlined />} style={{ marginRight: '8px'}} />
                <span>{user?.attributes?.name || user?.username || 'User'}</span>
              </div>
            </Dropdown>
            </div>
          </Header>
          <Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
                } />
              <Route path="/ai-assistant" element={
                <ProtectedRoute>
                  <AIAssistant />
                </ProtectedRoute>
                } />
              <Route path="/notice-board" element={
                <ProtectedRoute>
                  <NoticeBoard />
                </ProtectedRoute>
               } />
              <Route path="/alerts" element={
                <ProtectedRoute>
                  <Alerts />
                </ProtectedRoute>
                } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
                } />
              <Route path="/reports" element={
                <ProtectedRoute>
                  <ReportGenerator />
                </ProtectedRoute>
                } />
              <Route path="/rooms" element={
                <ProtectedRoute>
                  <RoomMonitor />
                </ProtectedRoute>
                
                } />
              <Route path="/vehicle" element={
                <ProtectedRoute>
                  <VehicleMovement />
                </ProtectedRoute>
                } />

              {/* Redirecting to any other routes to the dashboard*/}
              <Route path="/*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
      )}
    </Router>
  )
}
    //Navigation for the different pages

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
 
export default App;
