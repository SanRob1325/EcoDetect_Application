import React, {useState, useEffect, useCallback} from 'react';
import { Card, Progress,Spin} from 'antd';
import apiService from './apiService';

const CarbonFootprintCard = ({ sensorData, waterFlow}) => {
    const [carbonFootprint, setCarbonFootprint] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [source, setSource] = useState('api');

    const calculateLocalFootprint = useCallback(() => {
        // Only calculate if we have necessary data
        if (
            sensorData &&
            sensorData.temperature !== null &&
            sensorData.temperature !== undefined &&
            waterFlow !== null && 
            waterFlow !== undefined

        ) {
            let footprint = (sensorData.temperature * 0.2) + (waterFlow * 0.5)

            if (sensorData.altitude !== null && sensorData.altitude !== undefined){
                footprint += sensorData.altitude * 0.1;
            }

            if (sensorData.pressure !== null && sensorData.pressure !== undefined) {
                footprint += sensorData.pressure * 0.05;
            }

            const cappedFootprint = Math.min(Math.max(footprint, 0), 100);
            setCarbonFootprint(cappedFootprint);
            setSource('local');
            setError(null);
        }
    }, [sensorData, waterFlow]);

    useEffect(() =>{
        const fetchCarbonFootprint = async () => {
            try{
                setLoading(true)
                const response = await apiService.getCarbonFootprint();
                
                if (response.data && response.data.carbon_footprint !== undefined) {
                    setCarbonFootprint(response.data.carbon_footprint);
                    setSource('api');
                    setError(null);
                } else {
                    // If API doesnt return valid data, fall back to local calculation
                    calculateLocalFootprint();
                }
            } catch (error){
                console.error('Error fetching carbon footprint:', error)
                setError('Failed to fetch carbon footprint data in API')

                // Fall back to local calculation
                calculateLocalFootprint();
            } finally {
                setLoading(false);
            }
        }

        fetchCarbonFootprint();

        // Refresh carbon footprint data every 10 seconds
        const interval = setInterval(fetchCarbonFootprint, 10000);
        return () => clearInterval(interval);
    }, [calculateLocalFootprint]);

    useEffect(() => {
        // Second approach is to calculate locall if API fails or retunrs invalid data
        // This also runs if theres changes to waterflow or sensor data
        if(source !== 'api' || carbonFootprint === 0){
            calculateLocalFootprint();
        }

    }, [sensorData, waterFlow, source, carbonFootprint, calculateLocalFootprint]);
    

    return (
        <Card title="Carbon Footprint Impact">
            {loading ? (
                <Spin size="small" />
            ) : error ? (
                <div style={{color: 'red'}}>{error}</div>
            ) : (
                <>
                <Progress
                    percent={carbonFootprint}
                    status="active"
                    showInfo={true}
                />
                <p>{carbonFootprint.toFixed(2)}% environmental impact</p>
                <p style={{ fontSize: '12px', color: 'gray'}}>
                    {source === 'api'
                        ? 'Data from server calculation'
                        : 'Data from local calculation'
                    }    
                </p>
                </>
            )}
        </Card>
    );
};

export default CarbonFootprintCard;

