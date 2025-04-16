import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom'
import { Dropdown, Layout, Menu, Typography, Avatar, message, Spin, Button } from 'antd';
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons'
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
import UserGuide from './UserGuide';
import WelcomePage from './WelcomePage';

// Authentication components
import Login from './Login';
import Signup from './Signup';
import ForgotPassword from './ForgotPassword';
import ProtectedRoute from './ProtectedRoute';
import { signOut } from './authUtils';
import { AuthProvider, useAuth } from './AuthContext';
const { Header, Content, Sider } = Layout;

const { Title } = Typography;

const AppContent = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    if (!loading) {
      setIsLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    console.log('Auth stat in AppContent:', { isAuthenticated, loading, user });
  }, [isAuthenticated, loading, user])

  useEffect(() => {
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

      if (inactiveTime > inactiveTimeout) {
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
    try {
      await signOut();
      logout()

      if (isAutoLogout) {
        message.info('You have been logged out because of inactivity, please login again')
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };


  const navigationMenu = (
    <Menu style={{ width: '250px', padding: '8px 0', borderRadius: '4px', boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px rgba(0,0,0,0.23)', background: '#388E3C'}}>
      <Menu.Item key="1"><Link to="/welcome">Welcome</Link></Menu.Item>
      <Menu.Item key="2"><Link to="/dashboard">Dashboard</Link></Menu.Item>
      <Menu.Item key="3"><Link to="/guide">User Guide</Link></Menu.Item>
      <Menu.Item key="4"><Link to="/ai-assistant">AI Assistant Predictive Analysis</Link></Menu.Item>
      <Menu.Item key="5"><Link to="/notice-board">Notice Board</Link></Menu.Item>
      <Menu.Item key="6"><Link to="/alerts">Alerts</Link></Menu.Item>
      <Menu.Item key="7"><Link to="/settings">Settings</Link></Menu.Item>
      <Menu.Item key="8"><Link to="/reports">Reports</Link></Menu.Item>
      <Menu.Item key="9"><Link to="/rooms">Room Monitoring</Link></Menu.Item>
      <Menu.Item key="10"><Link to="/vehicle">Vehicle Monitoring</Link></Menu.Item>
    </Menu>
  )
  const userMenu = (
    <Menu style={{width: '200px', padding: '8px 0', borderRadius: '4px', boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)', background: '#4CAF50'}}>
      <Menu.Item key="profile" icon={<UserOutlined style={{ color: 'white'}} />}>
        <Link to="/settings" style={{ color: 'white' }}>Profile</Link>
      </Menu.Item>
      <Menu.Divider style={{ borderColor: 'rgba(255,255,255,0.2)'}} />
      <Menu.Item key="logout" icon={<LogoutOutlined style={{ color: 'white' }}/>} onClick={() => handleLogout()}>
        Logout
      </Menu.Item>
    </Menu>
  );

  // If its still loading it should only show this spinner
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
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
          <Header style={{ background: 'linear-gradient(to right, #2E7D32, #81C784)', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' , boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', color: 'white'}}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Dropdown overlay={navigationMenu} trigger={['click']} placement="bottomLeft">
                <Button type="text" icon={<MenuOutlined style={{ fontSize: '20px', color: 'white' }} />} style={{marginRight: '8px'}} />
              </Dropdown>
              <span style={{ marginLeft: '8px', fontWeight: 'bold', fontSize: '18px', color: '#E8F5E9', textShadow: '1px 1px 2px rgba(0,0,0,0.2)'}}>EcoDetect</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={logo} alt="EcoDetect Logo" style={{ height: '40px', marginRight: '10px', filter: 'drop-shadow(1px 1px 3px rgba(0,0,0,0.2))' }}></img>
              <Title level={2} style={{ margin: 0, color: 'white', textShadow: '1px 1px 3px rgba(0,0,0,0.2)' }}>Home Climate Dashboard</Title>
            </div>

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Dropdown overlay={userMenu} placement="bottomRight">
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.3s ease' }}>
                  <Avatar icon={<UserOutlined />} style={{ marginRight: '8px', backgroundColor: '#1B5E20' }} />
                  <span>{user?.attributes?.name || user?.username || 'User'}</span>
                </div>
              </Dropdown>
            </div>
          </Header>
          <Content style={{ margin: '16px', padding: '24px', background: '#F1F8E9', borderRadius: '8px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
            <Routes>
              <Route path="/welcome" element={
                <ProtectedRoute>
                  <WelcomePage />
                </ProtectedRoute>
              } />
              <Route path="/guide" element={
                <ProtectedRoute>
                  <UserGuide />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
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
              <Route path="/" element={<Navigate to="/welcome" replace />} />
            </Routes>
          </Content>
        </Layout>
      )}
    </Router >
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
