import React, {useEffect,useState} from 'react';
import axios from 'axios'
import GaugeChart from 'react-gauge-chart'

const SensorDashboard = () =>{
  const [data,setData] = useState({
    temperature:null,
    humidity:null

  });
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  

  useEffect(() =>{
    axios.get('http://192.168.9.123:5000/api/sensor-data')
    .then(response => {
      setData({
        temperature: response.data.temperature,
        humidity: response.data.humidity
      });
      setLoading(false)
    })
    .catch(error => {
      console.error('Error fetching sensor data',error);
      setError('Failed to fetch data')
      setLoading(false)
    });
  },[]);

  const tempValue = data.temperature ? (data.temperature +10)/50 :0;
  const humValue = data.humidity ? data.humidity /100 :0;

  return (
    <div style= {{display: 'flex',justifyContent: 'center',gap: '20px'}}>
      <div>
        <h2>Temperature</h2>
        {loading ? (
          <p>Loading...</p>
        ) :error ?(
          <p style={{color: 'red'}}>{error}</p>
        ) :(
          <>
        <GaugeChart
          id="temperature-gauge"
          nrOfLevels={20}
          percent={tempValue}
          needleColor='black'
          needleBaseColor='red'
          />
          <p>{data.temperature ? `${data.temperature.toFixed(2)} C`  : 'Loading...'}</p>
          </>
        )}
      </div>
      <div>
        <h2>Humidity</h2>
        {loading ? (
          <p>Loading...</p>
        ) :error ?(
          <p style={{color: 'red'}}>{error}</p>
        ) :(
          <>
        <GaugeChart
          id="humidity-gauge"
          nrOfLevels={20}
          percent={humValue}
          needleColor='blue'
          needleBaseColor='black'
          />
          <p>{data.humidity ? `${data.humidity.toFixed(2)} %`: 'Loading...'}</p>
          </>
        )}
      </div>

    </div>
  )
    

}
export default SensorDashboard;
