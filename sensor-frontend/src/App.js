import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { Layout, Menu, Typography} from 'antd';
import './App.css';
import AIAssistant from './AIAssistant';
import Dashboard from './Dashboard'
import logo from './Icon-Only-Black.png'

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const App = () => {
 
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider width={250} className="site-layout-background">
          <div style={{ padding: '16px', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
            EcoDetect Home Dashboard
          </div>
          <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%', borderRight: 0 }}>
            <Menu.Item key="1"><Link to="/">Dashboard</Link></Menu.Item>
            <Menu.Item key="2"><Link to="/ai-assistant">AI Assistant</Link></Menu.Item>
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
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>

  )
}


export default App;
