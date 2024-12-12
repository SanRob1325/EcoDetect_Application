import React from 'react';
import {Card} from 'antd';
import AlertCard from './AlertCard';

const alerts = [
    {id: 1, message: 'Humidity is critical high at 80%',type: 'critical',date: '2024-12-10T10:15:00', suggestedAction: 'Check the dehumidifier'},
    {id: 2, message: 'Temperature is slightly above 37 degree C',type: 'warning',date: '2024-12-09T15:20:00', suggestedAction: 'Turn down heating'},
    {id: 3, message: 'CO2 levels are stable at 900ppm',type: 'info',date: '2024-12-08T12:30:00', suggestedAction: 'No action needed'}
    
];

const Alerts = () => {
    return(
        <Card title="Alerts" style={{margin: '16px'}}>
            {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
            ))}
        </Card>
    );

};
export default Alerts;