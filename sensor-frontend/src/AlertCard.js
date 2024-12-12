import React from 'react';
import {Card, Badge, Typography} from 'antd'

const {Text} = Typography;

const AlertCard = ({alert}) => {
    const getStatusColor = (type) =>{
        switch(type){
            case 'crtical':
                return 'red';
            case 'warning':
                return 'orange';
            case 'info':
                return 'blue'
            default:
                return 'gray';

        }
    };

    return(
       <Card style={{marginBottom: '16px', border: `1px solid ${getStatusColor(alert.type)}`}}>
            <Badge.Ribbon text={alert.type.toUpperCase()} color={getStatusColor(alert.type)}>
                <div>
                    <Text strong>{alert.message}</Text>
                </div>
                <div style={{ marginTop: '8px'}}>
                    <Text type="secondary">Date: {new Date(alert.date).toLocaleString()}</Text>
                </div>
                <div style={{ marginTop: '8px'}}>
                    <Text type="secondary">Suggested Action: {alert.suggestedAction || 'None'}</Text>
                </div>
            </Badge.Ribbon>
       </Card>
    );
};

export default AlertCard;