import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { C } from '../theme';

export default function MiniLineChart({ prices=[], color=C.ac, width=160, height=60, showLabel=false }) {
  const { linePath, fillPath, last } = useMemo(() => {
    const data = prices.slice(-60);
    if (data.length < 2) return { linePath:'', fillPath:'', last: null };
    const min = Math.min(...data), max = Math.max(...data);
    const range = max - min || 0.0001;
    const px = (i) => (i / (data.length-1)) * width;
    const py = (v) => height - ((v-min)/range) * (height-6) - 3;
    let line = `M${px(0)},${py(data[0])}`;
    let fill = `M${px(0)},${height} L${px(0)},${py(data[0])}`;
    for (let i=1;i<data.length;i++) {
      line += ` L${px(i)},${py(data[i])}`;
      fill += ` L${px(i)},${py(data[i])}`;
    }
    fill += ` L${px(data.length-1)},${height} Z`;
    return { linePath: line, fillPath: fill, last: data[data.length-1] };
  }, [prices, width, height]);

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`g_${color}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.25"/>
            <Stop offset="1" stopColor={color} stopOpacity="0"/>
          </LinearGradient>
        </Defs>
        {fillPath ? <Path d={fillPath} fill={`url(#g_${color})`}/> : null}
        {linePath ? <Path d={linePath} stroke={color} strokeWidth="1.5" fill="none"/> : null}
      </Svg>
      {showLabel && last !== null ? (
        <Text style={{position:'absolute', bottom:4, right:4, fontSize:9, color, fontFamily:'monospace'}}>
          {last.toFixed(4)}
        </Text>
      ) : null}
    </View>
  );
}