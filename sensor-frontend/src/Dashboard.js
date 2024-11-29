import React, { useEffect, useState } from 'react';
import axios from 'axios';
import GaugeChart from 'react-gauge-chart';
import {Card, Slider, Button, Select, Spin } from 'antd';

const { Option } = Select;

const Dashboard = () => {
    const [data, setData] = useState({ temperature: null, humidity: null });
    const [temperatureTrends, setTemperatureTrends] = useState([]);
    const [thresholds, setThresholds] = useState({
        temperature_range: [20, 25],
        humidity_range: [30, 60],
    });

    const [selectedRange, setSelectedRange] = useState('24h');
    const [loading, setLoading] = useState(false)
    const [isUpdatingThresholds, setIsUpdatingThresholds] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/sensor-data')
                setData(response.data);
            } catch (error) {
                console.error('Error fetching sensor data', error);
            } finally {
                setLoading(false)
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
            } finally {
                setLoading(false)
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
            } finally {
                setLoading(false)
            }
        };
        fetchThresholds();
    }, []);

    const updateThresholds = async () => {
        setIsUpdatingThresholds(true)
        try {
            await axios.post('http://localhost:5000/api/set-thresholds', thresholds)
            alert('Thresholds updated successfully!')
        } catch (error) {
            console.error('Error updating thresholds', error);
        } finally {
            setIsUpdatingThresholds(false)
        }
    };

    const tempValue = data.temperature !== null
        ? Math.min(Math.max((data.temperature - thresholds.temperature_range[0]) / (thresholds.temperature_range[1] - thresholds.temperature_range[0]), 0), 1)
        : 0;
    const humValue = data.humidity !== null
        ? Math.min(Math.max((data.humidity / thresholds.humidity_range[0]) / (thresholds.humidity_range[1] - thresholds.humidity_range[0]), 0), 1) 
        : 0;
    return (
        <>
            {loading && <Spin size="large" />}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px' }}>
                <Card title="Temperature">
                    <GaugeChart id="temperature-gauge" nrOfLevels={20} percent={tempValue} needleBaseColor="red" needleColor='red' />
                    <p>{data.temperature !== null ? `${data.temperature.toFixed(2)}°C` : 'Loading...'}</p>
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
            <Card title="Temperature Trends" style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p>Select Range:</p>
                    <Select defaultValue="24h" onChange={(value) => setSelectedRange(value)} style={{ width: '150px' }}>
                        <Option value="24h">Last 24 Hours</Option>
                        <Option value="7d">Last 7 Days</Option>
                        <Option value="30d">Last 30 Days</Option>
                    </Select>
                </div>
                <div>
                    {temperatureTrends.map((trend, index) => (
                        <div key={index}>
                            <span>{trend.time}</span>
                            <span>{trend.temperature} C</span>
                        </div>

                    ))}
                </div>
            </Card>
        </>
    );
}
export default Dashboard;