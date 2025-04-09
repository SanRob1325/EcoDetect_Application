import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Layout, Menu, Typography} from 'antd';
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

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const App = () => {
 //Navigation for the different pages
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={250} className="site-layout-background">
          <div style={{ padding: '16px', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
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
          <Header style={{ background: '#fff', padding: '0 16px' }}>
            <Title level={2} style={{ textAlign: 'center' }}>Home Climate Dashboard</Title>
            <img src={logo} alt="EcoDetect Logo" className='logo-top-right'></img>
          </Header>
          <Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/notice-board" element={<NoticeBoard />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<ReportGenerator />} />
              <Route path="/rooms" element={<RoomMonitor />} />
              <Route path="/vehicle" element={<VehicleMovement />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>

  )
}


export default App;
