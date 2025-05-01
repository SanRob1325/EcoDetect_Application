import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface GaugeProps {
  value: number | null;
  minValue?: number;
  maxValue?: number;
  title?: string;
  unit?: string;
  size?: number;
  thickness?: number;
}

const Gauge = ({
  value,
  minValue = 0,
  maxValue = 100,
  title,
  unit = '',
  size = 150,
  thickness = 10
}: GaugeProps) => {
  const { colors } = useTheme();
  
  // Calculate percentage
  let percent = 0;
  if (value !== null) {
    percent = Math.max(0, Math.min(100, ((value - minValue) / (maxValue - minValue)) * 100));
  }
  
  // Calculate angles for arc
  const startAngle = -135;
  const endAngle = 135;
  const angleRange = endAngle - startAngle;
  const valueAngle = startAngle + (angleRange * percent) / 100;
  
  // Calculate coordinates for the arc path
  const radius = (size - thickness) / 2;
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Calculate start and end points of the arc
  const startX = centerX + radius * Math.cos((startAngle * Math.PI) / 180);
  const startY = centerY + radius * Math.sin((startAngle * Math.PI) / 180);
  const endX = centerX + radius * Math.cos((valueAngle * Math.PI) / 180);
  const endY = centerY + radius * Math.sin((valueAngle * Math.PI) / 180);
  
  // Create SVG arc path
  const largeArcFlag = valueAngle - startAngle <= 180 ? '0' : '1';
  
  const backgroundPath = `
    M ${centerX + radius * Math.cos((startAngle * Math.PI) / 180)} 
    ${centerY + radius * Math.sin((startAngle * Math.PI) / 180)}
    A ${radius} ${radius} 0 1 1
    ${centerX + radius * Math.cos((endAngle * Math.PI) / 180)}
    ${centerY + radius * Math.sin((endAngle * Math.PI) / 180)}
  `;
  
  const valuePath = `
    M ${startX} ${startY}
    A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}
  `;
  
  // Determine color based on percentage
  const getColor = (percent: number) => {
    if (percent < 30) return colors.error;
    if (percent < 70) return colors.warning;
    return colors.success;
  };
  
  const arcColor = getColor(percent);
  
  return (
    <View style={styles.container}>
      {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
      <View style={styles.gaugeContainer}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background Arc */}
          <Path
            d={backgroundPath}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="none"
          />
          
          {/* Value Arc */}
          <Path
            d={valuePath}
            stroke={arcColor}
            strokeWidth={thickness}
            fill="none"
            strokeLinecap="round"
          />
          
          {/* Center Circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={thickness}
            fill={colors.background}
            stroke={colors.border}
            strokeWidth={1}
          />
          
          {/* Value Text */}
          <G x={centerX} y={centerY + 40}>
            <SvgText
              fontSize="18"
              fontWeight="bold"
              fill={colors.text}
              textAnchor="middle"
            >
              {value !== null ? value.toFixed(1) + unit : 'N/A'}
            </SvgText>
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default Gauge;