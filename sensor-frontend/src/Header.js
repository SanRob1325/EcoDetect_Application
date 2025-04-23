import React from 'react';
import { Menu, Layout, Avatar, Dropdown, Button } from 'antd';
import { UserOutlined, LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const { Header: AntHeader } = Layout;

const Header = ({ onNavigate }) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  // If onNavigate is provided, use it (for testing)
  // Otherwise use react-router's navigate
  const handleNavigation = (path) => {
    if (onNavigate) {
      onNavigate(path);
    } else {
      navigate(path);
    }
  };

  const handleLogout = () => {
    logout();
    handleNavigation('/login');
  };

  const menuItems = [
    {
      key: 'profile',
      label: <span>Profile</span>,
      icon: <UserOutlined />
    },
    {
      key: 'logout',
      label: <span>Logout</span>,
      icon: <LogoutOutlined />,
      onClick: handleLogout
    }
  ];

  return (
    <AntHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
      <div className="logo" style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
        Smart Home Monitor
      </div>
      
      <div style={{ display: 'flex' }}>
        <Button type="link" onClick={() => handleNavigation('/')} style={{ color: 'white' }}>
          Dashboard
        </Button>
        <Button type="link" onClick={() => handleNavigation('/rooms')} style={{ color: 'white' }}>
          Rooms
        </Button>
        <Button type="link" onClick={() => handleNavigation('/ai-assistant')} style={{ color: 'white' }}>
          AI Assistant
        </Button>
        <Button type="link" onClick={() => handleNavigation('/settings')} style={{ color: 'white' }}>
          Settings
        </Button>
        <Button type="link" onClick={() => handleNavigation('/reports')} style={{ color: 'white' }}>
          Reports
        </Button>
      </div>

      <div>
        <Dropdown
          menu={{ items: menuItems }}
          placement="bottomRight"
        >
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Avatar icon={<UserOutlined />} />
            <span style={{ color: 'white', marginLeft: '8px' }}>
              {user?.username || 'User'}
            </span>
          </div>
        </Dropdown>
      </div>
    </AntHeader>
  );
};

export default Header;