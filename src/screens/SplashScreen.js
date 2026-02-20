// ─────────────────────────────────────────────────────────────────────────────
// DALI MASK SPLASH — shown on first load and API connect
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// SVG-style Dali mask drawn with pure View components
function DaliMask({ size = 200, color = '#e63946', glowColor = 'rgba(230,57,70,0.3)' }) {
  const s = size / 200;
  const sc = n => Math.round(n * s);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Glow */}
      <View style={{
        position: 'absolute', width: size * 1.3, height: size * 1.3,
        borderRadius: size * 0.65, backgroundColor: glowColor,
      }}/>
      {/* Head oval */}
      <View style={{
        width: sc(120), height: sc(160), borderRadius: sc(60),
        backgroundColor: '#0a0008',
        borderWidth: sc(3), borderColor: color,
        position: 'absolute', top: sc(20),
        alignItems: 'center', overflow: 'hidden',
      }}>
        {/* Forehead lines (mask markings) */}
        {[sc(20), sc(30), sc(40)].map((y, i) => (
          <View key={i} style={{
            position: 'absolute', top: y, left: sc(20), right: sc(20),
            height: sc(1.5), backgroundColor: color, opacity: 0.5,
          }}/>
        ))}
        {/* Eye holes */}
        <View style={{ flexDirection: 'row', gap: sc(18), position: 'absolute', top: sc(55) }}>
          {[0, 1].map(i => (
            <View key={i} style={{
              width: sc(22), height: sc(14),
              borderRadius: sc(7),
              backgroundColor: '#000',
              borderWidth: sc(2), borderColor: color,
            }}/>
          ))}
        </View>
        {/* Nose bridge */}
        <View style={{
          position: 'absolute', top: sc(70), width: sc(4), height: sc(18),
          backgroundColor: color, opacity: 0.7, borderRadius: sc(2),
        }}/>
        {/* Mouth slit */}
        <View style={{
          position: 'absolute', top: sc(105),
          width: sc(44), height: sc(5),
          backgroundColor: '#000', borderRadius: sc(3),
          borderWidth: sc(1.5), borderColor: color,
        }}/>
        {/* Chin line */}
        <View style={{
          position: 'absolute', bottom: sc(18), left: sc(22), right: sc(22),
          height: sc(1.5), backgroundColor: color, opacity: 0.35,
        }}/>
      </View>
      {/* Neck */}
      <View style={{
        position: 'absolute', bottom: sc(2), width: sc(30), height: sc(22),
        backgroundColor: '#0a0008', borderWidth: sc(2), borderColor: color,
      }}/>
      {/* Collar */}
      <View style={{
        position: 'absolute', bottom: 0, width: sc(80), height: sc(10),
        backgroundColor: color, opacity: 0.6, borderRadius: sc(5),
      }}/>
    </View>
  );
}

export default function SplashScreen({ onDone, message = 'CONNECTING...' }) {
  const fade    = useRef(new Animated.Value(0)).current;
  const scale   = useRef(new Animated.Value(0.7)).current;
  const scanY   = useRef(new Animated.Value(-H * 0.6)).current;
  const textOp  = useRef(new Animated.Value(0)).current;
  const dotsOp  = useRef(new Animated.Value(0)).current;
  const exitOp  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start(() => {
      // Scan line
      Animated.timing(scanY, { toValue: H * 0.6, duration: 1200, useNativeDriver: true }).start();
      // Text fade in
      Animated.timing(textOp, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }).start();
      // Dots pulse
      Animated.loop(Animated.sequence([
        Animated.timing(dotsOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dotsOp, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])).start();
      // Auto dismiss
      setTimeout(() => {
        Animated.timing(exitOp, { toValue: 0, duration: 500, useNativeDriver: true })
          .start(() => onDone && onDone());
      }, 2200);
    });
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: exitOp }]}>
      {/* Red scan line */}
      <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]}/>

      {/* Mask */}
      <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
        <DaliMask size={200}/>
      </Animated.View>

      {/* Title */}
      <Animated.Text style={[styles.title, { opacity: textOp }]}>
        DERIV PRO SUITE
      </Animated.Text>

      {/* Status */}
      <Animated.Text style={[styles.status, { opacity: textOp }]}>
        {message}
      </Animated.Text>

      {/* Pulsing dots */}
      <Animated.View style={[styles.dots, { opacity: dotsOp }]}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.dot}/>
        ))}
      </Animated.View>

      {/* Corner accents */}
      {[{top:0,left:0},{top:0,right:0},{bottom:0,left:0},{bottom:0,right:0}].map((pos,i)=>(
        <View key={i} style={[styles.corner, pos,
          {borderTopWidth:    pos.top===0?2:0,
           borderBottomWidth: pos.bottom===0?2:0,
           borderLeftWidth:   pos.left===0?2:0,
           borderRightWidth:  pos.right===0?2:0}]}/>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root:     {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 999,
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(230,57,70,0.7)',
    shadowColor: '#e63946', shadowOffset:{width:0,height:0}, shadowRadius:8, shadowOpacity:1,
    zIndex: 10,
  },
  title:    {
    fontSize: 20, fontWeight: '800', color: '#e63946',
    fontFamily: 'monospace', letterSpacing: 4, marginTop: 28,
  },
  status:   {
    fontSize: 11, color: '#a0a0b0', fontFamily: 'monospace',
    letterSpacing: 2, marginTop: 10,
  },
  dots:     { flexDirection: 'row', gap: 8, marginTop: 20 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e63946' },
  corner:   {
    position: 'absolute', width: 24, height: 24,
    borderColor: '#e63946', margin: 16,
  },
});
