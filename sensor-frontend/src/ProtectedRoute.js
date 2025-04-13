import React, { useEffect, useState} from 'react';
import { currentAuthenticatedUser } from './authUtils';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

const ProtectedRoute = ({ children}) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            try{
                await currentAuthenticatedUser();
                setIsAuthenticated(true);
            } catch(error) {
                setIsAuthenticated(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Spin size="large" />
            </div>
        );
    }

    if(!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location}} replace />
    }

    return children;
}

export default  ProtectedRoute;