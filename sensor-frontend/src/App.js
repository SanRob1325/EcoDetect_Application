import React, { useEffect, useState } from 'react';
import axios from 'axios';
import GaugeChart from 'react-gauge-chart';
import { Layout, Menu, Typography, Card, Slider, Button,Select } from 'antd';
import './App.css';
import logo from './Icon-Only-Black.png'

const { Header, Content, Sider } = Layout;
const { Title } = Typography;
const {Option} = Select;
const App = () => {
  const [data, setData] = useState({ temperature: null, humidity: null });
  const [temperatureTrends, setTemperatureTrends] = useState([]);
  const [thresholds, setThresholds] = useState({
    temperature_range: [20, 25],
    humidity_range: [30, 60],
  });
  const [selectedRange, setSelectedRange] = useState('24h');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/sensor-data')
        setData(response.data);
      } catch (error) {
        console.error('Error fetching sensor data', error);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/temperature-trends?range=${selectedRange}`);
        setTemperatureTrends(response.data)
      } catch (error) {
        console.error("Error fetching temperature trends", error);
      }
    };
    fetchTrends();
  }, [selectedRange]);

  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/get-thresholds');
        setThresholds(response.data);
      } catch (error) {
        console.error('Error fetching thresholds', error)
      }
    };
    fetchThresholds();
  }, []);

  const updateThresholds = async () => {
    try {
      await axios.post('http://localhost:5000/api/set-thresholds', thresholds)
      alert('Thresholds updated successfully!')
    } catch (error) {
      console.error('Error updating thresholds', error);
    }
  };


  const tempValue = data.temperature !== null ? Math.min(Math.max((data.temperature - 0) / 40, 0), 1) : 0;
  const humValue = data.humidity !== null ? Math.min(Math.max(data.humidity / 100, 0), 1) : 0;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={250} className="site-layout-background">
        <div style={{ padding: '16px', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
          EcoDetect Home Dashboard
        </div>
        <Menu theme="dark" mode="inline" defaultSelectedKeys={['1']} style={{ height: '100%', borderRight: 0 }}>
          <Menu.Item key="1">Dashboard</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px' }}>
          <Title level={2} style={{ textAlign: 'center' }}>Home Climate Dashboard</Title>
          <img src={logo} alt="EcoDetect Logo" className='logo-top-right'></img>
        </Header>
        <Content style={{ margin: '16px', padding: '24px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px' }}>
            <Card title="Temperature">
              <GaugeChart id="temperature-gauge" nrOfLevels={20} percent={tempValue} needleBaseColor="red" needleColor='red' />
              <p>{data.temperature  !==null ? `${data.temperature.toFixed(2)}°C` : 'Loading...'}</p>
            </Card>
            <Card title="Humidity">
              <GaugeChart id="humidity-gauge" nrOfLevels={20} percent={humValue} needleBaseColor="blue" needleColor="blue" />
              <p>{data.humidity !== null ? `${data.humidity.toFixed(2)}%` : 'Loading...'}</p>
            </Card>
          </div>
          <Card title="Preffered Ranges" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <p>Temperature Range (°C):</p>
                <Slider
                  range
                  min={0}
                  max={40}
                  value={thresholds.temperature_range}
                  onChange={(value) => setThresholds({ ...thresholds, temperature_range: value })}
                />
              </div>
              <div>
                <p>Humidity Range (%):</p>
                <Slider
                  range
                  min={0}
                  max={100}
                  value={thresholds.humidity_range}
                  onChange={(value) => setThresholds({ ...thresholds, humidity_range: value })}
                />
              </div>
            </div>
            <Button type="primary" onClick={updateThresholds} style={{ marginTop: '16px' }}>
              Update Thresholds
            </Button>
          </Card>
          <Card title="Temperature Trends" style={{marginTop: '16px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between',alignItems: 'center'}}>
              <p>Select Range:</p>
              <Select value={selectedRange} onChange={setSelectedRange} style={{width: '150px'}}>
                <Option value="24h">Last 24 Hours</Option>
                <Option value="7d">Last 7 Days</Option>
                <Option value="30d">Last 30 Days</Option>
              </Select>
            </div>
            <div style={{marginTop: '16px'}}>
              {temperatureTrends.length > 0 ? (
                <ul>
                  {temperatureTrends.map((trend,index) =>(
                    <li key={index}>{`${trend.time}: ${trend.temperature.toFixed(2)}°C`}</li>
                  ))}
                </ul>
              ) : (
                <p>No trends available...</p>
              )}
            </div>
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}


export default App;
